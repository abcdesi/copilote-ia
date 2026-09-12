import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/companies/current";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PLAN_LABELS, PLAN_PRICES_EUR } from "@/lib/config";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

const PLAN_PERKS: Record<string, string[]> = {
  free: ["Diagnostic initial", "Aperçu du cockpit", "1 automatisation active"],
  starter: ["Automatisations étendues", "Surveillance de base", "Recommandations continues"],
  pro: ["Surveillance avancée", "Historique & ROI détaillés", "Priorisation continue", "Support prioritaire"],
  business: ["Tout Pro", "Accompagnement dédié", "Intégrations et gouvernance avancées"],
};

function stripeReady(plan: "starter" | "pro" | "business") {
  const priceKey = plan === "starter" ? "STRIPE_PRICE_STARTER" : plan === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_BUSINESS";
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env[priceKey]);
}

export default async function SettingsPage() {
  const session = await auth();
  const company = await getCurrentCompany();
  const subscription = company.subscriptions[0];
  const currentPlan = subscription?.plan ?? "free";
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">Votre compte, votre abonnement et la facturation.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Compte</h2>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>Nom : {session?.user?.name}</p>
          <p>Email : {session?.user?.email}</p>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Abonnement</h2>
            <p className="mt-1 text-sm text-muted-foreground">La facturation payante est confirmée uniquement par les webhooks Stripe.</p>
          </div>
          {hasStripeCustomer && (
            <form method="post" action="/api/billing/portal">
              <Button type="submit" size="sm" variant="outline">Gérer la facturation</Button>
            </form>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(["free", "starter", "pro", "business"] as const).map((plan) => {
            const active = plan === currentPlan;
            const paid = plan !== "free";
            const ready = !paid || stripeReady(plan);
            return (
              <div
                key={plan}
                className={cn(
                  "rounded-2xl border p-5",
                  active ? "border-accent bg-accent-soft" : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{PLAN_LABELS[plan]}</p>
                  {active ? <Badge tone="accent">Plan actuel</Badge> : !ready ? <Badge tone="neutral">Configuration requise</Badge> : null}
                </div>
                <p className="mt-1 text-lg font-semibold">
                  {PLAN_PRICES_EUR[plan] === 0 ? "Gratuit" : `${formatEur(PLAN_PRICES_EUR[plan])}/mois`}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {PLAN_PERKS[plan].map((p) => <li key={p}>✓ {p}</li>)}
                </ul>

                {!active && paid && ready && (
                  <form method="post" action="/api/billing/checkout" className="mt-4">
                    <input type="hidden" name="plan" value={plan} />
                    <Button type="submit" size="sm" variant="outline" className="w-full">
                      Passer à {PLAN_LABELS[plan]}
                    </Button>
                  </form>
                )}

                {!active && paid && !ready && (
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    Le plan sera activable dès que le prix Stripe correspondant sera configuré côté serveur.
                  </p>
                )}

                {!active && plan === "free" && hasStripeCustomer && (
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    Pour revenir au plan gratuit, utilisez « Gérer la facturation » afin d'annuler l'abonnement Stripe proprement.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
