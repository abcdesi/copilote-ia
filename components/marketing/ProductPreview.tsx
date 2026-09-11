import { Bot, Building2, Home, Lightbulb, Zap } from "lucide-react";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { Badge } from "@/components/ui/Badge";

const NAV_ICONS = [Home, Bot, Zap, Lightbulb, Building2];

export function ProductPreview() {
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(23,22,28,0.08)]">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-3 text-xs text-muted-foreground">pilotzia.com/app</span>
      </div>

      <div className="flex">
        <div className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-border py-5 sm:flex">
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

        <div className="flex-1 p-5 sm:p-6">
          <p className="text-sm font-semibold">Bonjour, Nova 👋</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Voici où en sont vos automatisations aujourd&apos;hui.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-background p-4">
              <ScoreGauge score={72} size={88} />
              <p className="mt-2 text-[11px] font-medium text-muted-foreground">Automation Score</p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-4">
              <PreviewStat label="Heures économisées" value="15 h" />
              <PreviewStat label="Valeur estimée" value="525 €" />
              <PreviewStat label="Automatisations" value="3" />
              <PreviewStat label="Fonctionnement" value="87,5 %" />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-accent/20 bg-accent-soft p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-accent">💡 Prochaine opportunité</p>
              <Badge tone="success">🔥 Haute priorité</Badge>
            </div>
            <p className="mt-1.5 text-sm font-medium">Génération automatique de devis</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Potentiel estimé : ~5 h / mois</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
