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
