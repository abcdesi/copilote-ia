import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/companies/current";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PLAN_LABELS, PLAN_PRICES_EUR } from "@/lib/config";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { getUsageStatus } from "@/lib/billing/usage-policy";

const PLAN_PERKS: Record<string, string[]> = {
  free: ["Diagnostic sans carte bancaire", "1 première connexion réelle", "Essai IA borné par durée et usage"],
  starter: ["Contexte IA maintenu à jour", "Morning Brief & Copilote", "Recommandations continues", "Historique du contexte"],
  pro: ["Tout Core", "Actions et automatisations", "Confirmations & monitoring", "Suivi ROI détaillé"],
  business: ["Tout Action", "Équipe et gouvernance avancée", "Volumes supérieurs", "API / agents externes à mesure de leur disponibilité"],
};

function stripeReady(plan: "starter" | "pro" | "business") {
  const priceKey = plan === "starter" ? "STRIPE_PRICE_STARTER" : plan === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_BUSINESS";
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env[priceKey]);
}

function formatDate(value: Date | null) {
  if (!value) return "Pas encore démarré";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value);
}

export default async function SettingsPage() {
  const session = await auth();
  const company = await getCurrentCompany();
  const subscription = company.subscriptions[0];
  const currentPlan = subscription?.plan ?? "free";
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);
  const usage = await getUsageStatus(company.id);
  const creditPct = usage.creditsLimit > 0 ? Math.min(100, Math.round((usage.creditsUsed / usage.creditsLimit) * 100)) : 100;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">Votre compte, votre enveloppe d'usage et la facturation.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Compte</h2>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>Nom : {session?.user?.name}</p>
          <p>Email : {session?.user?.email}</p>
        </div>
      </div>

      {!usage.paid && (
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Essai Pilotzia borné</p>
              <h2 className="mt-1 font-semibold">Essayez la vraie IA sans facture surprise</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                L'essai s'arrête automatiquement au premier seuil atteint : durée ou enveloppe d'usage. Votre contexte et votre historique restent conservés.
              </p>
            </div>
            <Badge tone={usage.trialExpired ? "neutral" : "accent"}>{usage.trialExpired ? "Essai terminé" : usage.trialActive ? "Essai actif" : "Prêt à démarrer"}</Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Crédits utilisés</p>
              <p className="mt-1 text-xl font-semibold">{usage.creditsUsed} / {usage.creditsLimit}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-accent" style={{ width: `${creditPct}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Début</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(usage.trialStartedAt)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Fin au plus tard</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(usage.trialEndsAt)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Les connexions et le contexte ne sont pas facturés au volume. Pilotzia limite surtout les opérations qui génèrent un coût externe réel.
          </p>
        </div>
      )}

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
                      Activer {PLAN_LABELS[plan]}
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
