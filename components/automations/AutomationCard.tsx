import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AUTOMATION_STATUS_LABELS, HEALTH_EMOJI, formatHours, relativeTime } from "@/lib/format";

export interface AutomationCardData {
  id: string;
  name: string;
  businessGoal: string;
  status: string;
  health: string;
  toolsUsed: string; // JSON string
  estimatedHoursPerMonth: number;
  lastCheckedAt: Date | string;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  warning: "warning",
  error: "danger",
  inactive: "neutral",
};

export function AutomationCard({ automation }: { automation: AutomationCardData }) {
  const tools = JSON.parse(automation.toolsUsed) as string[];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{automation.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{automation.businessGoal}</p>
        </div>
        <Badge tone={STATUS_TONE[automation.status]}>
          {automation.status !== "inactive" && `${HEALTH_EMOJI[automation.health]} `}
          {AUTOMATION_STATUS_LABELS[automation.status]}
        </Badge>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{tools.join(" → ")}</p>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          <p>Valeur estimée : ~{formatHours(automation.estimatedHoursPerMonth)}/mois</p>
          <p>Dernière vérification : {relativeTime(automation.lastCheckedAt)}</p>
        </div>
        <Button href={`/app/automations/${automation.id}`} size="sm" variant="outline">
          Voir le détail
        </Button>
      </div>
    </div>
  );
}
