import Link from "next/link";
import { AlertTriangle, Gauge } from "lucide-react";
import { getPlanDefinition } from "@/lib/billing/plans";

export function UsageAlert({
  usage,
}: {
  usage: {
    paid: boolean;
    alertLevel: "normal" | "warning" | "critical";
    creditsRemaining: number;
    creditsLimit: number;
    daysRemaining: number | null;
    nextPlan: "starter" | "pro" | "business" | null;
  };
}) {
  if (!usage.paid) return null;

  const nearPeriodEnd = usage.daysRemaining !== null && usage.daysRemaining <= 5;
  const lowNearEnd = nearPeriodEnd && usage.creditsRemaining <= Math.max(100, Math.round(usage.creditsLimit * 0.25));
  if (usage.alertLevel === "normal" && !lowNearEnd) return null;

  const critical = usage.alertLevel === "critical";
  const nextPlan = usage.nextPlan ? getPlanDefinition(usage.nextPlan) : null;
  const title = critical ? "Votre capacité Pilotzia est presque épuisée" : "Votre capacité Pilotzia arrive à sa limite";

  return (
    <div className="border-b border-amber-300/50 bg-amber-50 px-4 py-3 text-amber-950 sm:px-6 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {critical ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <Gauge size={18} className="mt-0.5 shrink-0" />}
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-xs opacity-80">
              {usage.creditsRemaining.toLocaleString("fr-FR")} crédits restants
              {usage.daysRemaining !== null ? ` · renouvellement de la capacité dans ${usage.daysRemaining} jour${usage.daysRemaining > 1 ? "s" : ""}` : ""}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/settings#credits" className="rounded-lg border border-current/20 bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white dark:bg-black/10 dark:hover:bg-black/20">
            Ajouter des crédits
          </Link>
          {nextPlan && (
            <Link href="/app/settings#plans" className="rounded-lg bg-amber-950 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 dark:bg-amber-100 dark:text-amber-950">
              Passer à {nextPlan.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
