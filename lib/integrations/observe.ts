import { prisma } from "@/lib/db/client";
import { googleApi } from "@/lib/integrations/google";
import { rebuildBusinessGraph } from "@/lib/business-graph";
import { recordOperationalEvent } from "@/lib/operating-company/events";

interface GmailListResponse {
  resultSizeEstimate?: number;
  messages?: { id: string }[];
}

interface CalendarEventsResponse {
  items?: Array<{ id: string; status?: string; start?: unknown }>;
}

export interface GoogleOperationalSnapshot {
  unreadInboxLast7Days: number;
  upcomingEventsNext7Days: number;
  observedAt: string;
}

export async function syncGoogleOperationalSnapshot(companyId: string): Promise<GoogleOperationalSnapshot> {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [gmail, recentInbox, calendar] = await Promise.all([
    googleApi<GmailListResponse>(
      companyId,
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label%3Ainbox%20is%3Aunread%20newer_than%3A7d&maxResults=50"
    ),
    googleApi<GmailListResponse>(
      companyId,
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label%3Ainbox%20newer_than%3A1d&maxResults=100"
    ),
    googleApi<CalendarEventsResponse>(
      companyId,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${encodeURIComponent(
        now.toISOString()
      )}&timeMax=${encodeURIComponent(inSevenDays.toISOString())}`
    ),
  ]);

  const snapshot: GoogleOperationalSnapshot = {
    unreadInboxLast7Days: gmail.resultSizeEstimate ?? gmail.messages?.length ?? 0,
    upcomingEventsNext7Days: (calendar.items ?? []).filter((event) => event.status !== "cancelled").length,
    observedAt: now.toISOString(),
  };

  // Chaque message est enregistré avec son ID Gmail : les synchronisations peuvent
  // être répétées sans gonfler le brief dirigeant. On conserve uniquement le signal,
  // jamais le contenu brut du mail dans ce journal opérationnel.
  await Promise.all(
    (recentInbox.messages ?? []).map((message) =>
      recordOperationalEvent({
        companyId,
        kind: "email_received",
        source: "google:gmail",
        externalRef: message.id,
        metadata: { contentStored: false },
      })
    )
  );

  await Promise.all([
    prisma.integrationConnection.updateMany({
      where: { companyId, provider: "google" },
      data: { lastSyncedAt: now, status: "connected", lastError: null },
    }),
    prisma.event.create({
      data: {
        companyId,
        type: "INTEGRATION_SNAPSHOT",
        metadata: JSON.stringify({ provider: "google", ...snapshot }),
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
    return parsed.provider === "google" ? parsed : null;
  } catch {
    return null;
  }
}
