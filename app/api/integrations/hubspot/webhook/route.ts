import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  hubspotApi,
  verifyHubSpotWebhookSignatureV3,
} from "@/lib/integrations/hubspot";
import { findAttributedContactEvent } from "@/lib/integrations/provider-attribution";
import { triggerProviderOutcomeRelay } from "@/lib/n8n/provider-outcome-workflows";

type HubSpotWebhookEvent = {
  eventId?: number | string;
  subscriptionId?: number | string;
  portalId?: number | string;
  occurredAt?: number;
  subscriptionType?: string;
  objectId?: number | string;
  propertyName?: string;
  propertyValue?: string;
};

type HubSpotDeal = {
  id: string;
  properties?: {
    hs_is_closed_won?: string | null;
    amount?: string | null;
    closedate?: string | null;
  };
  associations?: {
    contacts?: {
      results?: Array<{ id?: string }>;
    };
  };
};

type HubSpotContact = {
  id: string;
  properties?: { email?: string | null };
};

function isClosedWon(value: string | null | undefined) {
  return value === "true" || value === "1";
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const verified = verifyHubSpotWebhookSignatureV3({
    method: req.method,
    url: req.url,
    rawBody,
    timestamp: req.headers.get("x-hubspot-request-timestamp"),
    signature: req.headers.get("x-hubspot-signature-v3"),
  });
  if (!verified) return NextResponse.json({ error: "Signature HubSpot invalide." }, { status: 401 });

  let events: HubSpotWebhookEvent[];
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    events = Array.isArray(parsed) ? parsed : [];
  } catch {
    return NextResponse.json({ error: "Payload HubSpot invalide." }, { status: 400 });
  }

  let relayed = 0;
  let ignored = 0;

  for (const event of events.slice(0, 100)) {
    if (
      !event.portalId ||
      !event.objectId ||
      event.subscriptionType !== "deal.propertyChange" ||
      event.propertyName !== "hs_is_closed_won" ||
      !isClosedWon(event.propertyValue)
    ) {
      ignored += 1;
      continue;
    }

    const connection = await prisma.integrationConnection.findFirst({
      where: {
        provider: "hubspot",
        externalAccountId: String(event.portalId),
        status: "connected",
      },
      select: { companyId: true },
    });
    if (!connection) {
      ignored += 1;
      continue;
    }

    const companyId = connection.companyId;
    const deal = await hubspotApi<HubSpotDeal>(
      companyId,
      `/crm/objects/2026-03/deals/${encodeURIComponent(String(event.objectId))}?properties=hs_is_closed_won,amount,closedate&associations=contacts`
    );
    if (!isClosedWon(deal.properties?.hs_is_closed_won)) {
      ignored += 1;
      continue;
    }

    const observedAt =
      event.occurredAt && Number.isFinite(event.occurredAt)
        ? new Date(event.occurredAt)
        : deal.properties?.closedate
          ? new Date(deal.properties.closedate)
          : new Date();
    if (!Number.isFinite(observedAt.getTime())) {
      ignored += 1;
      continue;
    }

    const contactIds = deal.associations?.contacts?.results
      ?.map((contact) => contact.id)
      .filter((id): id is string => Boolean(id)) ?? [];

    let attribution: Awaited<ReturnType<typeof findAttributedContactEvent>> = null;
    for (const contactId of contactIds.slice(0, 20)) {
      const contact = await hubspotApi<HubSpotContact>(
        companyId,
        `/crm/objects/2026-03/contacts/${encodeURIComponent(contactId)}?properties=email`
      );
      const email = contact.properties?.email?.trim();
      if (!email) continue;
      attribution = await findAttributedContactEvent({
        companyId,
        prospectEmail: email,
        templateId: "relance-prospects",
        observedAt,
      });
      if (attribution) break;
    }

    if (!attribution) {
      ignored += 1;
      continue;
    }

    const providerEventId = String(
      event.eventId ?? `${event.portalId}:${event.objectId}:${event.occurredAt ?? observedAt.getTime()}`
    );

    await triggerProviderOutcomeRelay("hubspot", {
      companyId,
      automationId: attribution.contactEvent.automationId,
      prospectId: attribution.prospect.id,
      provider: "hubspot",
      providerEventId,
      kind: "deal_won",
      observedAt: observedAt.toISOString(),
      externalEntityRef: deal.id,
      note:
        "Deal fermé gagné observé dans HubSpot après une relance Pilotzia attribuée au même prospect.",
    });

    relayed += 1;
  }

  return NextResponse.json({ ok: true, relayed, ignored });
}
