import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { GOOGLE_ACTION_SCOPES, googleApi, hasGoogleScopes } from "@/lib/integrations/google";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { refundExecutionReservation, reserveActionExecution } from "@/lib/billing/execution-usage";

export type SupportedActionKind = "gmail.create_draft" | "calendar.create_event";

interface ActionActor {
  userId: string;
  role: string;
  name?: string | null;
  email?: string | null;
}

const gmailDraftSchema = z.object({
  to: z.string().email().max(254),
  subject: z.string().min(1).max(200).refine((value) => !/[\r\n]/.test(value), "Objet invalide."),
  body: z.string().min(1).max(20_000),
});

const calendarEventSchema = z.object({
  summary: z.string().min(1).max(300),
  description: z.string().max(10_000).optional(),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  attendeeEmails: z.array(z.string().email().max(254)).max(100).optional(),
}).refine((value) => new Date(value.end).getTime() > new Date(value.start).getTime(), {
  message: "La fin du rendez-vous doit être postérieure au début.",
});

type GmailDraftPayload = z.infer<typeof gmailDraftSchema>;
type CalendarEventPayload = z.infer<typeof calendarEventSchema>;

function parseActionPayload(kind: SupportedActionKind, payload: unknown) {
  return kind === "gmail.create_draft" ? gmailDraftSchema.parse(payload) : calendarEventSchema.parse(payload);
}

function requiredGoogleScopes(kind: SupportedActionKind) {
  return kind === "gmail.create_draft" ? [GOOGLE_ACTION_SCOPES[0]] : [GOOGLE_ACTION_SCOPES[1]];
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
  const validatedPayload = parseActionPayload(input.kind, input.payload);
  return prisma.pendingAction.create({
    data: {
      companyId: input.companyId,
      provider: input.provider,
      kind: input.kind,
      title: input.title.slice(0, 300),
      description: input.description.slice(0, 2_000),
      payloadJson: JSON.stringify(validatedPayload),
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
    { method: "POST", body: JSON.stringify({ message: { raw: encodeMimeMessage(payload) } }) }
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

export async function executePendingAction(companyId: string, actionId: string, actor: ActionActor) {
  const action = await prisma.pendingAction.findFirst({ where: { id: actionId, companyId } });
  if (!action) throw new Error("Action introuvable.");
  if (action.status !== "pending" && action.status !== "approved") throw new Error("Cette action n'est plus exécutable.");
  if (action.expiresAt && action.expiresAt.getTime() < Date.now()) {
    await prisma.pendingAction.update({ where: { id: action.id }, data: { status: "expired" } });
    throw new Error("Cette action a expiré.");
  }

  const kind = action.kind as SupportedActionKind;
  if (kind !== "gmail.create_draft" && kind !== "calendar.create_event") {
    throw new Error(`Action non supportée: ${action.kind}`);
  }
  const payload = parseActionPayload(kind, JSON.parse(action.payloadJson));

  const entitlements = await getCompanyEntitlements(companyId);
  if (!entitlements.canExecute) throw new Error("L'exécution réelle des actions est incluse à partir de l'offre Action.");

  if (action.provider === "google" && !(await hasGoogleScopes(companyId, requiredGoogleScopes(kind)))) {
    throw new Error("GOOGLE_ACTION_SCOPE_REQUIRED");
  }

  const usage = await reserveActionExecution(companyId);
  if (!usage.allowed) {
    throw new Error("La capacité d'exécution incluse dans votre offre est arrivée à sa limite pour cette période.");
  }

  const claimed = await prisma.pendingAction.updateMany({
    where: { id: action.id, companyId, status: { in: ["pending", "approved"] } },
    data: { status: "executing" },
  });
  if (claimed.count !== 1) {
    await refundExecutionReservation(companyId, "action", usage);
    throw new Error("Cette action est déjà en cours ou a déjà été traitée.");
  }

  await prisma.event.create({
    data: {
      userId: actor.userId,
      companyId,
      type: "COPILOT_ACTION_APPROVED",
      metadata: JSON.stringify({ actionId: action.id, provider: action.provider, kind, riskLevel: action.riskLevel, actorRole: actor.role }),
    },
  });

  try {
    const result = kind === "gmail.create_draft"
      ? await executeGmailDraft(companyId, payload as GmailDraftPayload)
      : await executeCalendarEvent(companyId, payload as CalendarEventPayload);

    const executedAt = new Date();
    await Promise.all([
      prisma.pendingAction.update({
        where: { id: action.id },
        data: { status: "executed", resultJson: JSON.stringify(result), error: null, executedAt },
      }),
      prisma.event.create({
        data: {
          userId: actor.userId,
          companyId,
          type: "COPILOT_ACTION_EXECUTED",
          metadata: JSON.stringify({
            actionId: action.id,
            provider: action.provider,
            kind,
            riskLevel: action.riskLevel,
            actorRole: actor.role,
            plan: entitlements.plan,
          }),
        },
      }),
    ]);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur d'exécution";
    await Promise.all([
      refundExecutionReservation(companyId, "action", usage),
      prisma.pendingAction.update({
        where: { id: action.id },
        data: { status: "failed", error: message.slice(0, 500) },
      }),
      prisma.event.create({
        data: {
          userId: actor.userId,
          companyId,
          type: "COPILOT_ACTION_FAILED",
          metadata: JSON.stringify({ actionId: action.id, provider: action.provider, kind, actorRole: actor.role }),
        },
      }),
    ]);
    throw error;
  }
}

export async function rejectPendingAction(companyId: string, actionId: string, actor: ActionActor) {
  const action = await prisma.pendingAction.findFirst({ where: { id: actionId, companyId } });
  if (!action) throw new Error("Action introuvable.");
  if (action.status !== "pending") return action;
  const rejected = await prisma.pendingAction.update({ where: { id: action.id }, data: { status: "rejected" } });
  await prisma.event.create({
    data: {
      userId: actor.userId,
      companyId,
      type: "COPILOT_ACTION_REJECTED",
      metadata: JSON.stringify({ actionId: action.id, provider: action.provider, kind: action.kind, riskLevel: action.riskLevel, actorRole: actor.role }),
    },
  });
  return rejected;
}
