import { prisma } from "@/lib/db/client";

export interface ProviderReplyMatch {
  messageId: string;
  observedAt: Date;
}

export interface ProspectReplySearchInput {
  prospectEmail: string;
  sentAt: Date;
  subject: string | null;
}

export type ProspectReplySearch = (input: ProspectReplySearchInput) => Promise<ProviderReplyMatch | null>;

export async function observeProspectReplies(input: {
  companyId: string;
  searchReply: ProspectReplySearch;
  actorUserId?: string | null;
  source?: "manual" | "oauth_callback" | "scheduled";
  limit?: number;
}) {
  const sentEvents = await prisma.automationContactEvent.findMany({
    where: {
      automation: {
        companyId: input.companyId,
        templateId: "relance-prospects",
      },
      kind: "message_sent",
      status: "sent",
      prospect: {
        status: "active",
        lastOutcome: "sent",
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(input.limit ?? 20, 50)),
    select: {
      id: true,
      automationId: true,
      automationRunId: true,
      renderedSubject: true,
      messageVersion: true,
      createdAt: true,
      prospect: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const seenProspects = new Set<string>();
  let checked = 0;
  let repliesObserved = 0;
  let errors = 0;

  for (const sentEvent of sentEvents) {
    if (seenProspects.has(sentEvent.prospect.id)) continue;
    seenProspects.add(sentEvent.prospect.id);
    checked += 1;

    let reply: ProviderReplyMatch | null = null;
    try {
      reply = await input.searchReply({
        prospectEmail: sentEvent.prospect.email,
        sentAt: sentEvent.createdAt,
        subject: sentEvent.renderedSubject,
      });
    } catch (error) {
      errors += 1;
      console.error("Unable to observe prospect reply", {
        companyId: input.companyId,
        prospectId: sentEvent.prospect.id,
        error,
      });
      continue;
    }
    if (!reply) continue;

    const recorded = await prisma.$transaction(async (tx) => {
      const updated = await tx.prospect.updateMany({
        where: {
          id: sentEvent.prospect.id,
          companyId: input.companyId,
          lastOutcome: "sent",
        },
        data: { lastOutcome: "replied" },
      });
      if (updated.count === 0) return false;

      const evidence = {
        provider: "gmail",
        replyMessageId: reply.messageId,
        replyObservedAt: reply.observedAt.toISOString(),
        sourceContactEventId: sentEvent.id,
        sourceAutomationRunId: sentEvent.automationRunId,
      };

      await tx.automationContactEvent.create({
        data: {
          automationId: sentEvent.automationId,
          automationRunId: sentEvent.automationRunId,
          prospectId: sentEvent.prospect.id,
          kind: "reply_observed",
          status: "observed",
          recipientName: sentEvent.prospect.name,
          recipientEmail: sentEvent.prospect.email,
          renderedSubject: sentEvent.renderedSubject,
          provider: "gmail",
          providerMessageId: reply.messageId,
          messageVersion: sentEvent.messageVersion,
          evidenceJson: JSON.stringify(evidence),
        },
      });

      await tx.automationOutcome.create({
        data: {
          automationId: sentEvent.automationId,
          kind: "prospect_reply",
          value: 1,
          unit: "count",
          source: "provider_observed",
          confidence: 0.98,
          note: "Réponse prospect détectée automatiquement dans Gmail après une relance Pilotzia.",
          evidenceJson: JSON.stringify(evidence),
          actorName: "Google Gmail",
          actorRole: "provider",
          observedAt: reply.observedAt,
        },
      });

      await tx.event.create({
        data: {
          companyId: input.companyId,
          userId: input.actorUserId ?? null,
          type: "AUTOMATION_PROVIDER_OUTCOME_OBSERVED",
          metadata: JSON.stringify({
            automationId: sentEvent.automationId,
            prospectId: sentEvent.prospect.id,
            kind: "prospect_reply",
            provider: "gmail",
            source: input.source ?? "scheduled",
            observedAt: reply.observedAt.toISOString(),
          }),
        },
      });

      return true;
    });

    if (recorded) repliesObserved += 1;
  }

  return { checked, repliesObserved, errors };
}


export interface ProviderMeetingMatch {
  eventId: string;
  createdAt: Date;
  startAt: Date;
}

export interface ProspectMeetingSearchInput {
  prospectEmail: string;
  sentAt: Date;
}

export type ProspectMeetingSearch = (input: ProspectMeetingSearchInput) => Promise<ProviderMeetingMatch | null>;

export async function observeProspectMeetings(input: {
  companyId: string;
  searchMeeting: ProspectMeetingSearch;
  actorUserId?: string | null;
  source?: "manual" | "oauth_callback" | "scheduled";
  limit?: number;
}) {
  const sentEvents = await prisma.automationContactEvent.findMany({
    where: {
      automation: {
        companyId: input.companyId,
        templateId: "relance-prospects",
      },
      kind: "message_sent",
      status: "sent",
      prospect: {
        status: "active",
        lastOutcome: { in: ["sent", "replied"] },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(input.limit ?? 20, 50)),
    select: {
      id: true,
      automationId: true,
      automationRunId: true,
      renderedSubject: true,
      messageVersion: true,
      createdAt: true,
      prospect: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const seenProspects = new Set<string>();
  let checked = 0;
  let meetingsObserved = 0;
  let errors = 0;

  for (const sentEvent of sentEvents) {
    if (seenProspects.has(sentEvent.prospect.id)) continue;
    seenProspects.add(sentEvent.prospect.id);
    checked += 1;

    let meeting: ProviderMeetingMatch | null = null;
    try {
      meeting = await input.searchMeeting({
        prospectEmail: sentEvent.prospect.email,
        sentAt: sentEvent.createdAt,
      });
    } catch (error) {
      errors += 1;
      console.error("Unable to observe prospect meeting", {
        companyId: input.companyId,
        prospectId: sentEvent.prospect.id,
        error,
      });
      continue;
    }
    if (!meeting) continue;

    const recorded = await prisma.$transaction(async (tx) => {
      const updated = await tx.prospect.updateMany({
        where: {
          id: sentEvent.prospect.id,
          companyId: input.companyId,
          lastOutcome: { in: ["sent", "replied"] },
        },
        data: { lastOutcome: "meeting_booked" },
      });
      if (updated.count === 0) return false;

      const evidence = {
        provider: "google_calendar",
        calendarEventId: meeting.eventId,
        eventCreatedAt: meeting.createdAt.toISOString(),
        meetingStartAt: meeting.startAt.toISOString(),
        sourceContactEventId: sentEvent.id,
        sourceAutomationRunId: sentEvent.automationRunId,
        attribution: "temporal_after_pilotzia_follow_up",
      };

      await tx.automationContactEvent.create({
        data: {
          automationId: sentEvent.automationId,
          automationRunId: sentEvent.automationRunId,
          prospectId: sentEvent.prospect.id,
          kind: "meeting_observed",
          status: "observed",
          recipientName: sentEvent.prospect.name,
          recipientEmail: sentEvent.prospect.email,
          renderedSubject: sentEvent.renderedSubject,
          provider: "google_calendar",
          providerMessageId: meeting.eventId,
          messageVersion: sentEvent.messageVersion,
          evidenceJson: JSON.stringify(evidence),
        },
      });

      await tx.automationOutcome.create({
        data: {
          automationId: sentEvent.automationId,
          kind: "meeting_booked",
          value: 1,
          unit: "count",
          source: "provider_observed",
          confidence: 0.85,
          note:
            "Rendez-vous avec ce prospect détecté dans Google Calendar après une relance Pilotzia. Le lien est temporel et ne prouve pas à lui seul que la relance a causé le rendez-vous.",
          evidenceJson: JSON.stringify(evidence),
          actorName: "Google Calendar",
          actorRole: "provider",
          observedAt: meeting.createdAt,
        },
      });

      await tx.event.create({
        data: {
          companyId: input.companyId,
          userId: input.actorUserId ?? null,
          type: "AUTOMATION_PROVIDER_OUTCOME_OBSERVED",
          metadata: JSON.stringify({
            automationId: sentEvent.automationId,
            prospectId: sentEvent.prospect.id,
            kind: "meeting_booked",
            provider: "google_calendar",
            source: input.source ?? "scheduled",
            observedAt: meeting.createdAt.toISOString(),
            meetingStartAt: meeting.startAt.toISOString(),
            attribution: "temporal_after_pilotzia_follow_up",
          }),
        },
      });

      return true;
    });

    if (recorded) meetingsObserved += 1;
  }

  return { checked, meetingsObserved, errors };
}


export type TrustedProviderOutcomeKind = "deal_won" | "payment_received";
export type TrustedProviderName = "hubspot" | "stripe";

export async function recordTrustedProviderOutcome(input: {
  companyId: string;
  automationId: string;
  prospectId?: string | null;
  provider: TrustedProviderName;
  providerEventId: string;
  kind: TrustedProviderOutcomeKind;
  observedAt: Date;
  amountEur?: number | null;
  externalEntityRef?: string | null;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Automation" WHERE id = ${input.automationId} FOR UPDATE`;

    const automation = await tx.automation.findFirst({
      where: { id: input.automationId, companyId: input.companyId },
      select: { id: true, messageVersion: true },
    });
    if (!automation) return { ok: false as const, reason: "automation_not_found" as const };

    let prospect: { id: string; name: string; email: string } | null = null;
    if (input.prospectId) {
      prospect = await tx.prospect.findFirst({
        where: { id: input.prospectId, companyId: input.companyId },
        select: { id: true, name: true, email: true },
      });
      if (!prospect) return { ok: false as const, reason: "prospect_not_found" as const };
    }

    const evidence = {
      provider: input.provider,
      providerEventId: input.providerEventId,
      externalEntityRef: input.externalEntityRef ?? null,
      prospectId: prospect?.id ?? null,
      observedAt: input.observedAt.toISOString(),
      ingestion: "authenticated_n8n_callback",
    };
    const evidenceJson = JSON.stringify(evidence);

    const existing = await tx.automationOutcome.findFirst({
      where: {
        automationId: automation.id,
        source: "provider_observed",
        evidenceJson,
      },
      select: { id: true },
    });
    if (existing) {
      return { ok: true as const, created: false as const, outcomeId: existing.id };
    }

    const value = input.kind === "payment_received" ? input.amountEur ?? 0 : 1;
    const unit = input.kind === "payment_received" ? "eur" : "count";
    const providerName = input.provider === "hubspot" ? "HubSpot" : "Stripe";

    const outcome = await tx.automationOutcome.create({
      data: {
        automationId: automation.id,
        kind: input.kind,
        value,
        unit,
        source: "provider_observed",
        confidence: input.provider === "stripe" ? 0.99 : 0.98,
        note: input.note ?? null,
        evidenceJson,
        actorName: providerName,
        actorRole: "provider",
        observedAt: input.observedAt,
      },
    });

    if (prospect && input.kind === "deal_won") {
      await tx.prospect.update({
        where: { id: prospect.id },
        data: { lastOutcome: "deal_won" },
      });
      await tx.automationContactEvent.create({
        data: {
          automationId: automation.id,
          prospectId: prospect.id,
          kind: "deal_won_observed",
          status: "observed",
          recipientName: prospect.name,
          recipientEmail: prospect.email,
          provider: input.provider,
          providerMessageId: input.providerEventId,
          messageVersion: automation.messageVersion,
          evidenceJson,
        },
      });
    }

    await tx.event.create({
      data: {
        companyId: input.companyId,
        type: "AUTOMATION_PROVIDER_OUTCOME_OBSERVED",
        metadata: JSON.stringify({
          automationId: automation.id,
          prospectId: prospect?.id ?? null,
          kind: input.kind,
          provider: input.provider,
          providerEventId: input.providerEventId,
          externalEntityRef: input.externalEntityRef ?? null,
          value,
          unit,
          observedAt: input.observedAt.toISOString(),
          ingestion: "authenticated_n8n_callback",
        }),
      },
    });

    return { ok: true as const, created: true as const, outcomeId: outcome.id };
  });
}
