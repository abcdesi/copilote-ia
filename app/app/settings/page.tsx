import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/companies/current";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PLAN_LABELS, PLAN_PRICES_EUR } from "@/lib/config";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { getUsageStatus } from "@/lib/billing/usage-policy";

const PLAN_PERKS: Record<string, string[]> = {
  free: ["Diagnostic initial", "1 connexion réelle", "Crédits d'essai pour tester le copilote"],
  starter: ["Copilote avec contexte entreprise", "Morning Brief", "Recommandations continues", "Historique conservé"],
  pro: ["Tout Core", "Actions et automatisations", "Validation avant exécution", "Monitoring et suivi ROI"],
  business: ["Tout Action", "Usage plus élevé", "Équipe et gouvernance avancée", "Accès API et agents selon disponibilité"],
};

const PLAN_POSITIONING: Record<string, string> = {
  free: "Pour découvrir la valeur de Pilotzia avant de s'abonner.",
  starter: "Pour comprendre quoi améliorer et décider plus vite.",
  pro: "Pour passer du conseil à l'action et automatiser les opérations.",
  business: "Pour déployer Pilotzia à plus grande échelle dans l'entreprise.",
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
  const creditsRemaining = Math.max(0, usage.creditsLimit - usage.creditsUsed);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gérez votre compte, votre essai et votre abonnement Pilotzia.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Compte</h2>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>Nom : {session?.user?.name}</p>
          <p>Email : {session?.user?.email}</p>
        </div>
      </div>

      {!usage.paid && (
        <div className="rounded-2xl border border-accent/25 bg-accent-soft p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Votre essai gratuit</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">Testez Pilotzia sur votre entreprise réelle</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Utilisez le copilote, obtenez des recommandations et voyez ce que Pilotzia peut réellement vous faire gagner avant de choisir un abonnement.
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Aucune facturation automatique : l'essai s'arrête simplement lorsque sa durée ou ses crédits sont épuisés.
              </p>
            </div>
            <Badge tone={usage.trialExpired ? "neutral" : "accent"}>
              {usage.trialExpired ? "Essai terminé" : usage.trialActive ? "Essai en cours" : "Essai disponible"}
            </Badge>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Crédits disponibles</p>
              <p className="mt-1 text-xl font-semibold">{creditsRemaining} / {usage.creditsLimit}</p>
              <p className="mt-1 text-xs text-muted-foreground">Pour les analyses et réponses IA pendant l'essai.</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-accent" style={{ width: `${Math.max(0, 100 - creditPct)}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Démarrage</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(usage.trialStartedAt)}</p>
              <p className="mt-1 text-xs text-muted-foreground">L'essai démarre au premier usage IA réel.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Fin de l'essai</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(usage.trialEndsAt)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Votre contexte et votre historique restent conservés ensuite.</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Choisissez jusqu'où Pilotzia doit aller pour vous</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Core vous aide à décider. Action vous aide aussi à exécuter. Scale étend Pilotzia à une organisation plus large.
            </p>
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
            const recommended = plan === "pro";

            return (
              <div
                key={plan}
                className={cn(
                  "relative rounded-2xl border p-5",
                  active ? "border-accent bg-accent-soft" : recommended ? "border-accent/40 bg-card" : "border-border bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{PLAN_LABELS[plan]}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{PLAN_POSITIONING[plan]}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {active ? <Badge tone="accent">Plan actuel</Badge> : recommended ? <Badge tone="accent">Recommandé</Badge> : null}
                    {!ready && !active ? <Badge tone="neutral">Bientôt disponible</Badge> : null}
                  </div>
                </div>

                <p className="mt-4 text-2xl font-semibold tracking-tight">
                  {PLAN_PRICES_EUR[plan] === 0 ? "Gratuit" : `${formatEur(PLAN_PRICES_EUR[plan])}`} 
                  {PLAN_PRICES_EUR[plan] > 0 && <span className="text-sm font-normal text-muted-foreground">/ mois</span>}
                </p>

                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {PLAN_PERKS[plan].map((p) => <li key={p}>✓ {p}</li>)}
                </ul>

                {!active && paid && ready && (
                  <form method="post" action="/api/billing/checkout" className="mt-5">
                    <input type="hidden" name="plan" value={plan} />
                    <Button type="submit" size="sm" variant={recommended ? "primary" : "outline"} className="w-full">
                      Choisir {PLAN_LABELS[plan]}
                    </Button>
                  </form>
                )}

                {!active && paid && !ready && (
                  <p className="mt-5 text-xs leading-5 text-muted-foreground">
                    Cette offre sera activable dès que sa configuration de paiement sera terminée.
                  </p>
                )}

                {!active && plan === "free" && hasStripeCustomer && (
                  <p className="mt-5 text-xs leading-5 text-muted-foreground">
                    Pour revenir à Découverte, utilisez « Gérer la facturation » afin d'annuler votre abonnement proprement.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Les connexions et le contexte ne sont pas facturés au volume. Les limites portent surtout sur les opérations qui génèrent un coût réel d'IA ou d'exécution.
        </p>
      </div>
    </div>
  );
}
