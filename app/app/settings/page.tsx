import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/companies/current";
import { changePlanAction } from "@/lib/companies/subscription";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PLAN_LABELS, PLAN_PRICES_EUR } from "@/lib/config";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const PLAN_PERKS: Record<string, string[]> = {
  free: ["Diagnostic initial", "Aperçu du dashboard", "1 automatisation active"],
  starter: ["Automatisations illimitées", "Surveillance de base", "Support par email"],
  pro: ["Surveillance avancée", "Recommandations continues", "Rapports mensuels détaillés", "Support prioritaire"],
  business: ["Tout Pro", "Accompagnement dédié", "Intégrations sur mesure"],
};

export default async function SettingsPage() {
  const session = await auth();
  const company = await getCurrentCompany();
  const currentPlan = company.subscriptions[0]?.plan ?? "free";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">Votre compte et votre abonnement.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Compte</h2>
        <div className="mt-3 text-sm text-muted-foreground space-y-1">
          <p>Nom : {session?.user?.name}</p>
          <p>Email : {session?.user?.email}</p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Abonnement</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["free", "starter", "pro", "business"] as const).map((plan) => {
            const active = plan === currentPlan;
            return (
              <div
                key={plan}
                className={cn(
                  "rounded-2xl border p-5",
                  active ? "border-accent bg-accent-soft" : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{PLAN_LABELS[plan]}</p>
                  {active && <Badge tone="accent">Plan actuel</Badge>}
                </div>
                <p className="mt-1 text-lg font-semibold">
                  {PLAN_PRICES_EUR[plan] === 0 ? "Gratuit" : `${formatEur(PLAN_PRICES_EUR[plan])}/mois`}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {PLAN_PERKS[plan].map((p) => (
                    <li key={p}>✓ {p}</li>
                  ))}
                </ul>
                {!active && (
                  <form action={changePlanAction} className="mt-4">
                    <input type="hidden" name="plan" value={plan} />
                    <Button type="submit" size="sm" variant="outline" className="w-full">
                      Passer à {PLAN_LABELS[plan]}
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Changement de plan simulé pour cette version de démonstration — aucun paiement réel n&apos;est effectué.
        </p>
      </div>
    </div>
  );
}
