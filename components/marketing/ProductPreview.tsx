import { Bot, Building2, Home, Lightbulb, Mail, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { Badge } from "@/components/ui/Badge";

const NAV_ICONS = [Home, Bot, Zap, Lightbulb, Building2];

export function ProductPreview() {
  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-[0_18px_60px_rgba(23,22,28,0.10)]">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-3 text-xs text-muted-foreground">pilotzia.com/app</span>
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Copilote opérationnel actif
        </span>
      </div>

      <div className="flex">
        <div className="hidden w-16 shrink-0 flex-col items-center gap-4 border-r border-border py-5 sm:flex">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Sparkles size={15} />
          </div>
          {NAV_ICONS.map((Icon, i) => (
            <div
              key={i}
              className={
                i === 0
                  ? "flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"
                  : "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground"
              }
            >
              <Icon size={16} />
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="rounded-2xl border border-accent/20 bg-accent-soft p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent">
              <Sparkles size={14} />
              Votre brief du jour
            </div>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-lg font-semibold tracking-tight sm:text-xl">Bonjour Nova — voici ce qui mérite votre attention.</p>
                <p className="mt-1 text-xs text-muted-foreground">Pilotzia a analysé vos opérations et préparé les priorités du jour.</p>
              </div>
              <Badge tone="accent">3 priorités</Badge>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <BriefStat value="3" label="opportunités" />
              <BriefStat value="11 h" label="potentiel / mois" />
              <BriefStat value="2/2" label="en bonne santé" />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.5fr]">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-background p-5 text-center">
              <ScoreGauge score={77} size={96} />
              <p className="mt-2 text-xs font-semibold">Automation Score</p>
              <p className="mt-1 max-w-[180px] text-[10px] leading-4 text-muted-foreground">
                Votre maturité opérationnelle progresse à mesure que Pilotzia automatise et mesure.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">Valeur générée ce mois-ci</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Estimations basées sur les tâches automatisées.</p>
                </div>
                <span className="text-[10px] font-medium text-success">100 % opérationnel</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <PreviewStat label="Heures" value="11 h" />
                <PreviewStat label="Valeur estimée" value="385 €" />
                <PreviewStat label="Automatisations" value="2" />
                <PreviewStat label="Alertes critiques" value="0" />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-2xl border border-accent/20 bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-accent">💡 Action prioritaire proposée par Pilotzia</p>
                <Badge tone="success">🔥 Haute priorité</Badge>
              </div>
              <p className="mt-2 text-sm font-semibold">Relances de factures impayées</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Surveiller les échéances et préparer automatiquement les relances avant validation.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span>~4 h gagnées / mois</span>
                <span>~120 € de valeur estimée</span>
                <span>Validation avant envoi</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold">Contexte connecté</p>
              <div className="mt-3 space-y-2.5">
                <ContextRow icon={Mail} label="Gmail" detail="Lecture" />
                <ContextRow icon={Building2} label="CRM" detail="Lecture + action" />
                <ContextRow icon={ShieldCheck} label="Actions sensibles" detail="Confirmation" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BriefStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-card/80 px-3 py-2.5 text-center">
      <p className="text-sm font-semibold sm:text-base">{value}</p>
      <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">{label}</p>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ContextRow({ icon: Icon, label, detail }: { icon: React.ElementType; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon size={13} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium">{label}</p>
        <p className="truncate text-[9px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
