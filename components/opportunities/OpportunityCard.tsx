import Link from "next/link";
import { Flame, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IMPACT_LABELS, COMPLEXITY_SHORT_LABELS, formatEur, formatHours } from "@/lib/format";
import { isRealExecutionTemplate } from "@/lib/n8n/real-execution-config";

export interface OpportunityCardData {
  id: string;
  templateId: string;
  title: string;
  description: string;
  category: string;
  impactLevel: string;
  complexity: string;
  estimatedHoursPerMonth: number;
  priceEur: number;
}

export function OpportunityCard({ opportunity, highlight = false }: { opportunity: OpportunityCardData; highlight?: boolean }) {
  const isReal = isRealExecutionTemplate(opportunity.templateId);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {highlight ? <Flame size={16} className="text-warning" /> : <Zap size={16} className="text-accent" />}
          <Badge tone="neutral">{opportunity.category}</Badge>
        </div>
        <div className="flex flex-col items-end gap-1">
          {opportunity.impactLevel === "high" && <Badge tone="success">🔥 Haute priorité</Badge>}
          <Badge tone={isReal ? "accent" : "neutral"}>{isReal ? "⚡ Exécution réelle" : "🧪 Version simulée"}</Badge>
        </div>
      </div>

      <h3 className="mt-3 font-semibold">{opportunity.title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{opportunity.description}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted py-2">
          <p className="text-[11px] text-muted-foreground">Potentiel</p>
          <p className="text-sm font-semibold">{formatHours(opportunity.estimatedHoursPerMonth)}/mois</p>
        </div>
        <div className="rounded-lg bg-muted py-2">
          <p className="text-[11px] text-muted-foreground">Complexité</p>
          <p className="text-sm font-semibold">{COMPLEXITY_SHORT_LABELS[opportunity.complexity] ?? "—"}</p>
        </div>
        <div className="rounded-lg bg-muted py-2">
          <p className="text-[11px] text-muted-foreground">Coût</p>
          <p className="text-sm font-semibold">{formatEur(opportunity.priceEur)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{IMPACT_LABELS[opportunity.impactLevel]}</span>
        <Button href={`/app/opportunities/${opportunity.id}`} size="sm">
          Voir l'opportunité
        </Button>
      </div>
    </div>
  );
}
