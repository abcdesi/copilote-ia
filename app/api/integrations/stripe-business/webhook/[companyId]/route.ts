import { NextRequest, NextResponse } from "next/server";
import {
  getStripeBusinessWebhookSecret,
  verifyStripeWebhookSignature,
} from "@/lib/integrations/stripe-business";
import { findAttributedContactEvent } from "@/lib/integrations/provider-attribution";
import { triggerProviderOutcomeRelay } from "@/lib/n8n/provider-outcome-workflows";

type StripeInvoicePaidEvent = {
  id?: string;
  type?: string;
  created?: number;
  data?: {
    object?: {
      id?: string;
      customer_email?: string | null;
      amount_paid?: number;
      currency?: string;
      status?: string;
    };
  };
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const rawBody = await req.text();

  let secret: string;
  try {
    secret = await getStripeBusinessWebhookSecret(companyId);
  } catch {
    return NextResponse.json({ error: "Connexion Stripe métier introuvable." }, { status: 404 });
  }

  if (
    !verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: req.headers.get("stripe-signature"),
      secret,
    })
  ) {
    return NextResponse.json({ error: "Signature Stripe invalide." }, { status: 401 });
  }

  let event: StripeInvoicePaidEvent;
  try {
    event = JSON.parse(rawBody) as StripeInvoicePaidEvent;
  } catch {
    return NextResponse.json({ error: "Payload Stripe invalide." }, { status: 400 });
  }

  if (event.type !== "invoice.paid") {
    return NextResponse.json({ ok: true, ignored: "event_type" });
  }

  const invoice = event.data?.object;
  const email = invoice?.customer_email?.trim();
  const amountPaid = Number(invoice?.amount_paid ?? 0);
  const currency = invoice?.currency?.toLowerCase();
  if (!event.id || !invoice?.id || !email || !Number.isFinite(amountPaid) || amountPaid <= 0 || currency !== "eur") {
    return NextResponse.json({ ok: true, ignored: "insufficient_invoice_evidence" });
  }

  const observedAt = event.created && Number.isFinite(event.created)
    ? new Date(event.created * 1000)
    : new Date();

  const attribution = await findAttributedContactEvent({
    companyId,
    prospectEmail: email,
    templateId: "relance-factures",
    observedAt,
  });
  if (!attribution) {
    return NextResponse.json({ ok: true, ignored: "no_attributed_follow_up" });
  }

  await triggerProviderOutcomeRelay("stripe", {
    companyId,
    automationId: attribution.contactEvent.automationId,
    prospectId: attribution.prospect.id,
    provider: "stripe",
    providerEventId: event.id,
    kind: "payment_received",
    observedAt: observedAt.toISOString(),
    amountEur: amountPaid / 100,
    externalEntityRef: invoice.id,
    note:
      "Facture payée observée dans le Stripe métier après une relance Pilotzia attribuée au même contact.",
  });

  return NextResponse.json({ ok: true, relayed: 1 });
}
