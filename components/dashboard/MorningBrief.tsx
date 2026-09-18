import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, Lightbulb, ShieldAlert, Sun } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export type MorningBriefBucket = "know" | "handled" | "decide";

export interface MorningBriefItem {
  bucket: MorningBriefBucket;
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
  const know = items.filter((item) => item.bucket === "know");
  const handled = items.filter((item) => item.bucket === "handled");
  const decisions = items.filter((item) => item.bucket === "decide");
  const decisionCount = decisions.length + (priority ? 1 : 0);

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sun size={18} className="text-accent" />
          <p className="text-sm font-semibold text-accent">Votre brief du jour</p>
        </div>
        {decisionCount > 0 && (
          <Badge tone="accent">
            {decisionCount} décision{decisionCount > 1 ? "s" : ""} requise{decisionCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Bonjour, {firstName} 👋</h1>
      <p className="mt-1 text-sm text-foreground/80">
        Ce qui a changé, ce que Pilotzia prend en charge et ce qui attend réellement votre décision.
      </p>

      {stats && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatBox value={String(stats.opportunitiesCount)} label="opportunités identifiées" />
          <StatBox value={stats.potentialHoursLabel} label="potentiel mensuel estimé" />
          <StatBox value={stats.healthRatioLabel} label="automatisations en bonne santé" />
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <BriefColumn icon={Eye} title="À savoir" empty="Aucun nouveau signal important." items={know} />
        <BriefColumn icon={CheckCircle2} title="Pilotzia s'en occupe" empty="Aucune action autonome en cours à signaler." items={handled} />
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className="text-accent" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Décisions requises</p>
          </div>

          {priority ? (
            <Link href={priority.href} className="mt-3 block rounded-xl border border-accent/20 bg-accent-soft/60 p-3 transition-colors hover:border-accent/40">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lightbulb size={15} className="text-accent" />
                  <p className="text-sm font-semibold">{priority.title}</p>
                </div>
                {priority.isHighImpact && <Badge tone="success">Prioritaire</Badge>}
              </div>
              <p className="mt-2 text-xs leading-5 text-foreground/80">{priority.description}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                Décider <ArrowRight size={13} />
              </span>
            </Link>
          ) : (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Aucune décision urgente n'attend votre validation.</p>
          )}

          {decisions.length > 0 && (
            <ul className="mt-3 space-y-2">
              {decisions.map((item, index) => <BriefItem key={item.href + "-" + index} item={item} />)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BriefColumn({
  icon: Icon,
  title,
  empty,
  items,
}: {
  icon: typeof Eye;
  title: string;
  empty: string;
  items: MorningBriefItem[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-accent" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => <BriefItem key={item.href + "-" + index} item={item} />)}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function BriefItem({ item }: { item: MorningBriefItem }) {
  return (
    <li>
      <Link href={item.href} className="flex items-start gap-2 text-xs leading-5 text-foreground transition-colors hover:text-accent">
        <ToneDot tone={item.tone} />
        <span>{item.text}</span>
      </Link>
    </li>
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
  return <span className={"mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " + cls} />;
}
