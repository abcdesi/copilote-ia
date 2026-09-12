// Flux d'activité réelle de l'entreprise — chaque ligne vient d'un événement
// effectivement journalisé (table Event), jamais d'une donnée inventée. Une
// exécution qui n'a rien trouvé à traiter n'est volontairement pas journalisée
// (voir lib/n8n/execution.ts), donc ce flux ne montre que ce qui s'est vraiment passé.

import { AlertTriangle, Lightbulb, MessageSquare, Power, Sparkles, Zap } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { getTemplateById } from "@/lib/automations/catalog";
import { relativeTime } from "@/lib/format";

const FEED_EVENT_TYPES = [
  "AUTOMATION_INSTALLED",
  "AUTOMATION_DEACTIVATED",
  "AUTOMATION_REACTIVATED",
  "FEEDBACK_SUBMITTED",
  "AUTOMATION_OPPORTUNITY_DETECTED",
  "AUTOMATION_EXECUTED",
  "AUTOMATION_EXECUTION_ISSUE",
];

interface FeedEntry {
  id: string;
  icon: typeof Zap;
  text: string;
  createdAt: Date;
}

export async function PilotziaFeed({ companyId }: { companyId: string }) {
  const events = await prisma.event.findMany({
    where: { companyId, type: { in: FEED_EVENT_TYPES } },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  if (events.length === 0) return null;

  const automationIds = new Set<string>();
  for (const e of events) {
    const meta = parseMetadata(e.metadata);
    if (typeof meta.automationId === "string") automationIds.add(meta.automationId);
  }

  const automations = automationIds.size
    ? await prisma.automation.findMany({ where: { id: { in: [...automationIds] } }, select: { id: true, name: true } })
    : [];
  const automationNames = new Map(automations.map((a) => [a.id, a.name]));

  const entries = events.map((e) => formatEvent(e, automationNames)).filter((e): e is FeedEntry => e !== null);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-accent" />
        <h2 className="font-semibold">Activité récente</h2>
      </div>
      <ul className="mt-4 space-y-3">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <li key={entry.id} className="flex items-start gap-3 text-sm">
              <Icon size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-foreground">{entry.text}</p>
                <p className="text-xs text-muted-foreground">{relativeTime(entry.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function formatEvent(
  event: { id: string; type: string; metadata: string | null; createdAt: Date },
  automationNames: Map<string, string>
): FeedEntry | null {
  const meta = parseMetadata(event.metadata);
  const automationId = typeof meta.automationId === "string" ? meta.automationId : undefined;
  const automationName = automationId ? automationNames.get(automationId) : undefined;
  const templateId = typeof meta.templateId === "string" ? meta.templateId : undefined;
  const templateTitle = templateId ? getTemplateById(templateId)?.title : undefined;
  const name = automationName ?? templateTitle;

  switch (event.type) {
    case "AUTOMATION_INSTALLED":
      return name
        ? { id: event.id, icon: Zap, text: `Automatisation installée : ${name}`, createdAt: event.createdAt }
        : null;
    case "AUTOMATION_DEACTIVATED":
      return name
        ? { id: event.id, icon: Power, text: `Automatisation désactivée : ${name}`, createdAt: event.createdAt }
        : null;
    case "AUTOMATION_REACTIVATED":
      return name
        ? { id: event.id, icon: Power, text: `Automatisation réactivée : ${name}`, createdAt: event.createdAt }
        : null;
    case "FEEDBACK_SUBMITTED":
      return name
        ? { id: event.id, icon: MessageSquare, text: `Retour envoyé pour ${name}`, createdAt: event.createdAt }
        : null;
    case "AUTOMATION_OPPORTUNITY_DETECTED": {
      if (templateTitle) {
        return {
          id: event.id,
          icon: Lightbulb,
          text: `Nouvelle opportunité détectée : ${templateTitle}`,
          createdAt: event.createdAt,
        };
      }
      const count = typeof meta.count === "number" ? meta.count : undefined;
      return count
        ? {
            id: event.id,
            icon: Lightbulb,
            text: `${count} nouvelle${count > 1 ? "s" : ""} opportunité${count > 1 ? "s" : ""} détectée${count > 1 ? "s" : ""}`,
            createdAt: event.createdAt,
          }
        : null;
    }
    case "AUTOMATION_EXECUTED": {
      const sentCount = typeof meta.sentCount === "number" ? meta.sentCount : 0;
      if (!templateTitle || sentCount <= 0) return null;
      return {
        id: event.id,
        icon: Zap,
        text: `${sentCount} email${sentCount > 1 ? "s" : ""} envoyé${sentCount > 1 ? "s" : ""} automatiquement — ${templateTitle}`,
        createdAt: event.createdAt,
      };
    }
    case "AUTOMATION_EXECUTION_ISSUE": {
      const errorCount = typeof meta.errorCount === "number" ? meta.errorCount : 0;
      if (!templateTitle || errorCount <= 0) return null;
      return {
        id: event.id,
        icon: AlertTriangle,
        text: `${errorCount} échec${errorCount > 1 ? "s" : ""} détecté${errorCount > 1 ? "s" : ""} — ${templateTitle}`,
        createdAt: event.createdAt,
      };
    }
    default:
      return null;
  }
}
