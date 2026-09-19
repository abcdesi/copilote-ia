import { prisma } from "@/lib/db/client";
import { googleApi } from "@/lib/integrations/google";
import { rebuildBusinessGraph } from "@/lib/business-graph";
import { observeProspectMeetings, observeProspectReplies } from "@/lib/automations/provider-outcomes";

interface GmailListResponse {
  resultSizeEstimate?: number;
  messages?: { id: string }[];
}

interface GmailMessageResponse {
  id?: string;
  internalDate?: string;
}

interface CalendarEventsResponse {
  items?: Array<{
    id?: string;
    status?: string;
    created?: string;
    start?: { dateTime?: string; date?: string };
    attendees?: Array<{ email?: string; responseStatus?: string }>;
  }>;
}

export interface GoogleOperationalSnapshot {
  // Gmail renvoie resultSizeEstimate pour une recherche : cette valeur ne doit pas
  // être présentée comme un comptage comptable exact dans le produit.
  unreadInboxLast7Days: number;
  unreadInboxIsEstimate: boolean;
  upcomingEventsNext7Days: number;
  prospectRepliesObserved: number;
  prospectMeetingsObserved: number;
  observedAt: string;
}

function gmailSearchDate(value: Date) {
  return value.toISOString().slice(0, 10).replace(/-/g, "/");
}

function gmailSubjectQuery(subject: string | null) {
  const value = subject?.trim();
  if (!value) return "";
  return ` subject:"${value.replace(/[\\"]/g, " ").slice(0, 120)}"`;
}

async function findGmailReplyAfter(companyId: string, input: {
  prospectEmail: string;
  sentAt: Date;
  subject: string | null;
}) {
  const searchFrom = new Date(input.sentAt.getTime() - 24 * 60 * 60 * 1000);
  const query = `from:${input.prospectEmail} after:${gmailSearchDate(searchFrom)}${gmailSubjectQuery(input.subject)}`;
  const list = await googleApi<GmailListResponse>(
    companyId,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`
  );

  for (const message of list.messages ?? []) {
    if (!message.id) continue;
    const detail = await googleApi<GmailMessageResponse>(
      companyId,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(message.id)}?format=metadata`
    );
    const internalDate = Number(detail.internalDate);
    if (!Number.isFinite(internalDate) || internalDate <= input.sentAt.getTime()) continue;
    return { messageId: detail.id || message.id, observedAt: new Date(internalDate) };
  }
  return null;
}

function calendarStartAt(event: NonNullable<CalendarEventsResponse["items"]>[number]) {
  const raw = event.start?.dateTime ?? event.start?.date;
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isFinite(value.getTime()) ? value : null;
}

function findCalendarMeetingAfter(
  events: NonNullable<CalendarEventsResponse["items"]>,
  input: { prospectEmail: string; sentAt: Date }
) {
  const prospectEmail = input.prospectEmail.trim().toLowerCase();
  const matches = events
    .filter((event) => {
      if (!event.id || event.status === "cancelled" || !event.created) return false;
      const createdAt = new Date(event.created);
      const startAt = calendarStartAt(event);
      if (!Number.isFinite(createdAt.getTime()) || !startAt) return false;
      if (createdAt.getTime() <= input.sentAt.getTime() || startAt.getTime() <= input.sentAt.getTime()) return false;
      return (event.attendees ?? []).some(
        (attendee) =>
          attendee.responseStatus !== "declined" &&
          attendee.email?.trim().toLowerCase() === prospectEmail
      );
    })
    .map((event) => ({
      eventId: event.id!,
      createdAt: new Date(event.created!),
      startAt: calendarStartAt(event)!,
    }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return matches[0] ?? null;
}

export async function syncGoogleOperationalSnapshot(
  companyId: string,
  actorUserId?: string | null,
  source: "manual" | "oauth_callback" | "scheduled" = "manual"
): Promise<GoogleOperationalSnapshot> {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const calendarLookback = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const calendarHorizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [gmail, calendar] = await Promise.all([
    googleApi<GmailListResponse>(
      companyId,
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label%3Ainbox%20is%3Aunread%20newer_than%3A7d&maxResults=50"
    ),
    googleApi<CalendarEventsResponse>(
      companyId,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${encodeURIComponent(
        calendarLookback.toISOString()
      )}&timeMax=${encodeURIComponent(calendarHorizon.toISOString())}`
    ),
  ]);

  const replyObservation = await observeProspectReplies({
    companyId,
    actorUserId,
    source,
    searchReply: (input) => findGmailReplyAfter(companyId, input),
  }).catch((error) => {
    console.error("Prospect reply observation unavailable", error);
    return { checked: 0, repliesObserved: 0, errors: 1 };
  });

  const meetingObservation = await observeProspectMeetings({
    companyId,
    actorUserId,
    source,
    searchMeeting: async (input) => findCalendarMeetingAfter(calendar.items ?? [], input),
  }).catch((error) => {
    console.error("Prospect meeting observation unavailable", error);
    return { checked: 0, meetingsObserved: 0, errors: 1 };
  });

  const snapshot: GoogleOperationalSnapshot = {
    unreadInboxLast7Days: gmail.resultSizeEstimate ?? gmail.messages?.length ?? 0,
    unreadInboxIsEstimate: typeof gmail.resultSizeEstimate === "number",
    upcomingEventsNext7Days: (calendar.items ?? []).filter((event) => {
      if (event.status === "cancelled") return false;
      const startAt = calendarStartAt(event);
      return Boolean(startAt && startAt >= now && startAt <= inSevenDays);
    }).length,
    prospectRepliesObserved: replyObservation.repliesObserved,
    prospectMeetingsObserved: meetingObservation.meetingsObserved,
    observedAt: now.toISOString(),
  };

  await Promise.all([
    prisma.integrationConnection.updateMany({
      where: { companyId, provider: "google" },
      data: { lastSyncedAt: now, status: "connected", lastError: null },
    }),
    prisma.event.create({
      data: {
        userId: actorUserId ?? null,
        companyId,
        type: "INTEGRATION_SNAPSHOT",
        metadata: JSON.stringify({ provider: "google", source, ...snapshot }),
      },
    }),
  ]);

  // La synchronisation n'alimente pas seulement un compteur UI : elle met à jour la
  // représentation canonique de l'entreprise utilisée par le copilote et les agents.
  await rebuildBusinessGraph(companyId);

  return snapshot;
}

export async function getLatestGoogleOperationalSnapshot(companyId: string): Promise<GoogleOperationalSnapshot | null> {
  const event = await prisma.event.findFirst({
    where: { companyId, type: "INTEGRATION_SNAPSHOT" },
    orderBy: { createdAt: "desc" },
  });
  if (!event?.metadata) return null;
  try {
    const parsed = JSON.parse(event.metadata) as { provider?: string } & GoogleOperationalSnapshot;
    if (parsed.provider !== "google") return null;
    const observedAt = new Date(parsed.observedAt);
    if (!Number.isFinite(observedAt.getTime())) return null;
    if (Date.now() - observedAt.getTime() > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}
