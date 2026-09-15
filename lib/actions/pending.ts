import { prisma } from "@/lib/db/client";
import { googleApi } from "@/lib/integrations/google";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { reserveActionExecution } from "@/lib/billing/execution-usage";

export type SupportedActionKind = "gmail.create_draft" | "calendar.create_event";

interface GmailDraftPayload {
  to: string;
  subject: string;
  body: string;
}

interface CalendarEventPayload {
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendeeEmails?: string[];
}

export async function createPendingAction(input: {
  companyId: string;
  provider: string;
  kind: SupportedActionKind;
  title: string;
  description: string;
  payload: GmailDraftPayload | CalendarEventPayload;
  riskLevel?: "low" | "medium" | "high" | "critical";
  expiresAt?: Date;
}) {
  return prisma.pendingAction.create({
    data: {
      companyId: input.companyId,
      provider: input.provider,
      kind: input.kind,
      title: input.title,
      description: input.description,
      payloadJson: JSON.stringify(input.payload),
      riskLevel: input.riskLevel ?? "medium",
      expiresAt: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

function encodeMimeMessage(payload: GmailDraftPayload) {
  const lines = [
    `To: ${payload.to}`,
    `Subject: ${payload.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    payload.body,
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

async function executeGmailDraft(companyId: string, payload: GmailDraftPayload) {
  const response = await googleApi<{ id: string; message?: { id?: string; threadId?: string } }>(
    companyId,
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      body: JSON.stringify({ message: { raw: encodeMimeMessage(payload) } }),
    }
  );
  return { draftId: response.id, messageId: response.message?.id ?? null, threadId: response.message?.threadId ?? null };
}

async function executeCalendarEvent(companyId: string, payload: CalendarEventPayload) {
  const response = await googleApi<{ id: string; htmlLink?: string }>(
    companyId,
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      body: JSON.stringify({
        summary: payload.summary,
        description: payload.description,
        start: { dateTime: payload.start },
        end: { dateTime: payload.end },
        attendees: payload.attendeeEmails?.map((email) => ({ email })) ?? [],
      }),
    }
  );
  return { eventId: response.id, htmlLink: response.htmlLink ?? null };
}

export async function executePendingAction(companyId: string, actionId: string) {
  const action = await prisma.pendingAction.findFirst({ where: { id: actionId, companyId } });
  if (!action) throw new Error("Action introuvable.");
  if (action.status !== "pending" && action.status !== "approved") throw new Error("Cette action n'est plus exécutable.");
  if (action.expiresAt && action.expiresAt.getTime() < Date.now()) {
    await prisma.pendingAction.update({ where: { id: action.id }, data: { status: "expired" } });
    throw new Error("Cette action a expiré.");
  }

  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.canExecute) {
    throw new Error("L'exécution réelle des actions est incluse à partir de l'offre Action.");
  }

  const usage = await reserveActionExecution(companyId);
  if (!usage.allowed) {
    throw new Error("La capacité d'exécution incluse dans votre offre est arrivée à sa limite pour cette période.");
  }

  await prisma.pendingAction.update({ where: { id: action.id }, data: { status: "approved" } });

  try {
    let result: unknown;
    if (action.kind === "gmail.create_draft") {
      result = await executeGmailDraft(companyId, JSON.parse(action.payloadJson) as GmailDraftPayload);
    } else if (action.kind === "calendar.create_event") {
      result = await executeCalendarEvent(companyId, JSON.parse(action.payloadJson) as CalendarEventPayload);
    } else {
      throw new Error(`Action non supportée: ${action.kind}`);
    }

    const executedAt = new Date();
    await Promise.all([
      prisma.pendingAction.update({
        where: { id: action.id },
        data: { status: "executed", resultJson: JSON.stringify(result), error: null, executedAt },
      }),
      prisma.event.create({
        data: {
          companyId,
          type: "COPILOT_ACTION_EXECUTED",
          metadata: JSON.stringify({ provider: action.provider, kind: action.kind, riskLevel: action.riskLevel, plan: entitlements.plan }),
        },
      }),
    ]);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur d'exécution";
    await prisma.pendingAction.update({
      where: { id: action.id },
      data: { status: "failed", error: message.slice(0, 500) },
    });
    throw error;
  }
}

export async function rejectPendingAction(companyId: string, actionId: string) {
  const action = await prisma.pendingAction.findFirst({ where: { id: actionId, companyId } });
  if (!action) throw new Error("Action introuvable.");
  if (action.status !== "pending") return action;
  const rejected = await prisma.pendingAction.update({ where: { id: action.id }, data: { status: "rejected" } });
  await prisma.event.create({
    data: {
      companyId,
      type: "COPILOT_ACTION_REJECTED",
      metadata: JSON.stringify({ provider: action.provider, kind: action.kind, riskLevel: action.riskLevel }),
    },
  });
  return rejected;
}
