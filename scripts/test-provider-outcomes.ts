import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db/client";
import { observeProspectMeetings, observeProspectReplies } from "../lib/automations/provider-outcomes";

async function main() {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `provider-outcomes-${suffix}@pilotzia.invalid`,
      passwordHash: "integration-test-only",
      name: "Provider Outcomes Test",
    },
  });

  const company = await prisma.company.create({
    data: {
      userId: user.id,
      name: "Pilotzia Provider Outcomes Test",
      memberships: { create: { userId: user.id, role: "owner", status: "active" } },
    },
  });

  try {
    const opportunity = await prisma.opportunity.create({
      data: {
        companyId: company.id,
        templateId: "relance-prospects",
        title: "Relancer les prospects silencieux",
        description: "Test de résultat fournisseur.",
        category: "Ventes",
        impactLevel: "high",
        complexity: "low",
        estimatedHoursPerMonth: 8,
        estimatedValueEur: 1200,
        priceEur: 29,
        status: "installed",
      },
    });

    const automation = await prisma.automation.create({
      data: {
        companyId: company.id,
        opportunityId: opportunity.id,
        templateId: "relance-prospects",
        name: "Relance prospects",
        businessGoal: "Obtenir des réponses sans relance manuelle.",
        toolsUsed: "Gmail",
        estimatedHoursPerMonth: 8,
        estimatedValueEur: 1200,
        status: "active",
        health: "green",
      },
    });

    const prospect = await prisma.prospect.create({
      data: {
        companyId: company.id,
        templateId: "relance-prospects",
        name: "Prospect Test",
        email: `prospect-${suffix}@example.com`,
        lastContactedAt: new Date(Date.now() - 60_000),
        contactCount: 1,
        lastOutcome: "sent",
        status: "active",
      },
    });

    const run = await prisma.automationRun.create({
      data: {
        automationId: automation.id,
        status: "success",
        source: "manual",
        itemsProcessed: 1,
        startedAt: new Date(Date.now() - 70_000),
        finishedAt: new Date(Date.now() - 55_000),
      },
    });

    const sentAt = new Date(Date.now() - 60_000);
    const sentEvent = await prisma.automationContactEvent.create({
      data: {
        automationId: automation.id,
        automationRunId: run.id,
        prospectId: prospect.id,
        kind: "message_sent",
        status: "sent",
        recipientName: prospect.name,
        recipientEmail: prospect.email,
        renderedSubject: "Suite à notre échange",
        renderedBody: "Bonjour, je reviens vers vous.",
        provider: "resend",
        providerMessageId: `resend-${suffix}`,
        messageVersion: 1,
        evidenceJson: JSON.stringify({ sentAt: sentAt.toISOString() }),
        createdAt: sentAt,
      },
    });

    let searches = 0;
    const observedAt = new Date(sentAt.getTime() + 30_000);
    const first = await observeProspectReplies({
      companyId: company.id,
      actorUserId: user.id,
      source: "manual",
      searchReply: async ({ prospectEmail, sentAt: searchedSentAt, subject }) => {
        searches += 1;
        assert.equal(prospectEmail, prospect.email);
        assert.equal(searchedSentAt.getTime(), sentEvent.createdAt.getTime());
        assert.equal(subject, "Suite à notre échange");
        return { messageId: `gmail-reply-${suffix}`, observedAt };
      },
    });

    assert.deepEqual(first, { checked: 1, repliesObserved: 1, errors: 0 });
    assert.equal(searches, 1);

    const updatedProspect = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    assert.equal(updatedProspect.lastOutcome, "replied");

    const outcome = await prisma.automationOutcome.findFirstOrThrow({
      where: { automationId: automation.id, kind: "prospect_reply" },
    });
    assert.equal(outcome.value, 1);
    assert.equal(outcome.unit, "count");
    assert.equal(outcome.source, "provider_observed");
    assert.equal(outcome.confidence, 0.98);
    const evidence = JSON.parse(outcome.evidenceJson ?? "{}");
    assert.equal(evidence.replyMessageId, `gmail-reply-${suffix}`);
    assert.equal(evidence.sourceContactEventId, sentEvent.id);

    const replyEvent = await prisma.automationContactEvent.findFirstOrThrow({
      where: { automationId: automation.id, prospectId: prospect.id, kind: "reply_observed" },
    });
    assert.equal(replyEvent.provider, "gmail");
    assert.equal(replyEvent.providerMessageId, `gmail-reply-${suffix}`);

    const auditEvent = await prisma.event.findFirstOrThrow({
      where: { companyId: company.id, type: "AUTOMATION_PROVIDER_OUTCOME_OBSERVED" },
    });
    const auditMetadata = JSON.parse(auditEvent.metadata ?? "{}");
    assert.equal(auditMetadata.kind, "prospect_reply");
    assert.equal(auditMetadata.provider, "gmail");

    const second = await observeProspectReplies({
      companyId: company.id,
      searchReply: async () => {
        searches += 1;
        return { messageId: `gmail-reply-${suffix}`, observedAt };
      },
    });
    assert.deepEqual(second, { checked: 0, repliesObserved: 0, errors: 0 });
    assert.equal(searches, 1, "Une réponse déjà observée ne doit pas déclencher une nouvelle recherche ni un doublon.");

    const outcomeCount = await prisma.automationOutcome.count({
      where: { automationId: automation.id, kind: "prospect_reply" },
    });
    assert.equal(outcomeCount, 1, "Une réponse fournisseur ne doit être comptée qu'une seule fois.");

    let meetingSearches = 0;
    const meetingCreatedAt = new Date(sentAt.getTime() + 45_000);
    const meetingStartAt = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000);
    const meeting = await observeProspectMeetings({
      companyId: company.id,
      actorUserId: user.id,
      source: "manual",
      searchMeeting: async ({ prospectEmail, sentAt: searchedSentAt }) => {
        meetingSearches += 1;
        assert.equal(prospectEmail, prospect.email);
        assert.equal(searchedSentAt.getTime(), sentEvent.createdAt.getTime());
        return {
          eventId: `calendar-meeting-${suffix}`,
          createdAt: meetingCreatedAt,
          startAt: meetingStartAt,
        };
      },
    });

    assert.deepEqual(meeting, { checked: 1, meetingsObserved: 1, errors: 0 });
    assert.equal(meetingSearches, 1);

    const meetingProspect = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    assert.equal(meetingProspect.lastOutcome, "meeting_booked");

    const meetingOutcome = await prisma.automationOutcome.findFirstOrThrow({
      where: { automationId: automation.id, kind: "meeting_booked" },
    });
    assert.equal(meetingOutcome.value, 1);
    assert.equal(meetingOutcome.unit, "count");
    assert.equal(meetingOutcome.source, "provider_observed");
    assert.equal(meetingOutcome.confidence, 0.85);
    const meetingEvidence = JSON.parse(meetingOutcome.evidenceJson ?? "{}");
    assert.equal(meetingEvidence.calendarEventId, `calendar-meeting-${suffix}`);
    assert.equal(meetingEvidence.attribution, "temporal_after_pilotzia_follow_up");
    assert.equal(meetingEvidence.sourceContactEventId, sentEvent.id);

    const meetingContactEvent = await prisma.automationContactEvent.findFirstOrThrow({
      where: { automationId: automation.id, prospectId: prospect.id, kind: "meeting_observed" },
    });
    assert.equal(meetingContactEvent.provider, "google_calendar");
    assert.equal(meetingContactEvent.providerMessageId, `calendar-meeting-${suffix}`);

    const secondMeeting = await observeProspectMeetings({
      companyId: company.id,
      searchMeeting: async () => {
        meetingSearches += 1;
        return {
          eventId: `calendar-meeting-${suffix}`,
          createdAt: meetingCreatedAt,
          startAt: meetingStartAt,
        };
      },
    });
    assert.deepEqual(secondMeeting, { checked: 0, meetingsObserved: 0, errors: 0 });
    assert.equal(meetingSearches, 1, "Un rendez-vous déjà observé ne doit pas être recherché ou compté deux fois.");

    const meetingOutcomeCount = await prisma.automationOutcome.count({
      where: { automationId: automation.id, kind: "meeting_booked" },
    });
    assert.equal(meetingOutcomeCount, 1, "Un rendez-vous Calendar ne doit produire qu'un seul résultat métier.");

    console.log("Provider-observed automation outcome tests: OK");
  } finally {
    await prisma.company.delete({ where: { id: company.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
