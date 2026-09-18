import Link from "next/link";
import { ArrowRight, Lightbulb, Sun } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export interface MorningBriefItem {
  tone: "danger" | "accent" | "success";
  text: string;
  href: string;
}

export interface MorningBriefStats {
  opportunitiesCount: number;
  potentialHoursLabel: string;
  healthRatioLabel: string;
}

export interface MorningBriefPriority {
  title: string;
  description: string;
  href: string;
  isHighImpact: boolean;
}

export function MorningBrief({
  firstName,
  items,
  stats,
  priority,
}: {
  firstName: string;
  items: MorningBriefItem[];
  stats?: MorningBriefStats;
  priority?: MorningBriefPriority;
}) {
  const priorityCount = items.length;

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sun size={18} className="text-accent" />
          <p className="text-sm font-semibold text-accent">Votre brief du jour</p>
        </div>
        {priorityCount > 0 && (
          <Badge tone="accent">
            {priorityCount} priorité{priorityCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Bonjour, {firstName} 👋</h1>
      <p className="mt-1 text-sm text-foreground/80">
        Voici ce qui ressort des données actuellement disponibles et mérite votre attention aujourd&apos;hui.
      </p>

      {stats && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatBox value={String(stats.opportunitiesCount)} label="opportunités identifiées" />
          <StatBox value={stats.potentialHoursLabel} label="potentiel mensuel estimé" />
          <StatBox value={stats.healthRatioLabel} label="automatisations en bonne santé" />
        </div>
      )}

      {priority && (
        <Link
          href={priority.href}
          className="mt-4 block rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-accent" />
              <p className="font-semibold">{priority.title}</p>
            </div>
            {priority.isHighImpact && <Badge tone="success">🔥 Haute priorité</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Action prioritaire proposée par {"Pilotzia"}</p>
          <p className="mt-2 text-sm text-foreground/80">{priority.description}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent">
            Voir <ArrowRight size={14} />
          </span>
        </Link>
      )}

      {items.length > 0 && (
        <div className="mt-4">
          {priority && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Autres éléments à suivre</p>}
          <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i}>
              <Link
                href={item.href}
                className="flex items-center gap-2 text-sm text-foreground hover:text-accent transition-colors"
              >
                <ToneDot tone={item.tone} />
                {item.text}
              </Link>
            </li>
          ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-card p-3 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ToneDot({ tone }: { tone: MorningBriefItem["tone"] }) {
  const cls = tone === "danger" ? "bg-danger" : tone === "success" ? "bg-success" : "bg-accent";
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}
