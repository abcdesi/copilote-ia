import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/companies/current";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { getUsageStatus } from "@/lib/billing/usage-policy";
import { PAID_PLAN_KEYS, PLAN_DEFINITIONS } from "@/lib/billing/plans";

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
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compte & abonnement</h1>
        <p className="mt-1 text-sm text-muted-foreground">Votre compte, la capacité d'usage incluse et ce que chaque offre débloque réellement.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Compte</h2>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>Nom : {session?.user?.name}</p>
          <p>Email : {session?.user?.email}</p>
        </div>
      </div>

      {!usage.paid ? (
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Votre essai</p>
              <h2 className="mt-1 text-lg font-semibold">Testez Pilotzia sur votre entreprise réelle</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                L'essai démarre au premier usage IA réel. Vous avez 14 jours et une enveloppe d'usage suffisante pour vérifier la qualité du copilote, enrichir le contexte et tester les premières recommandations sans carte bancaire.
              </p>
            </div>
            <Badge tone={usage.trialExpired ? "neutral" : "accent"}>{usage.trialExpired ? "Essai terminé" : usage.trialActive ? "Essai actif" : "Prêt à démarrer"}</Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Usage intelligent</p>
              <p className="mt-1 text-xl font-semibold">{usage.creditsUsed} / {usage.creditsLimit} crédits</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent" style={{ width: `${creditPct}%` }} /></div>
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
            Connecter davantage de contexte ne consomme pas automatiquement davantage de crédits. Pilotzia borne surtout les analyses et opérations qui génèrent un coût externe réel.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Capacité mensuelle</p>
              <h2 className="mt-1 text-lg font-semibold">{usage.planLabel} · usage intelligent inclus</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Votre abonnement inclut une enveloppe mensuelle d'analyses IA. Elle protège la prévisibilité des coûts tout en laissant le contexte et les connexions s'enrichir sans facturation au volume de données.
              </p>
            </div>
            <Badge tone="accent">Plan actif</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Crédits utilisés ce mois</p>
              <p className="mt-1 text-xl font-semibold">{usage.creditsUsed} / {usage.creditsLimit}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent" style={{ width: `${creditPct}%` }} /></div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Période</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(usage.periodStartsAt)} → {formatDate(usage.periodEndsAt)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Capacité restante</p>
              <p className="mt-1 text-sm font-semibold">{usage.creditsRemaining.toLocaleString("fr-FR")} crédits</p>
            </div>
          </div>
        </div>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Choisissez jusqu'où Pilotzia doit aller pour vous</h2>
            <p className="mt-1 text-sm text-muted-foreground">Core aide à décider. Action aide aussi à exécuter. Scale ajoute une profondeur d'audit et de pilotage supérieure.</p>
          </div>
          {hasStripeCustomer && (
            <form method="post" action="/api/billing/portal">
              <Button type="submit" size="sm" variant="outline">Gérer ou modifier mon abonnement</Button>
            </form>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PAID_PLAN_KEYS.map((planKey) => {
            const plan = PLAN_DEFINITIONS[planKey];
            const active = planKey === currentPlan;
            const ready = stripeReady(planKey);
            const recommended = planKey === "pro";
            return (
              <div
                key={planKey}
                className={cn(
                  "rounded-2xl border p-5",
                  active ? "border-accent bg-accent-soft" : recommended ? "border-accent/40 bg-card" : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{plan.label}</p>
                  {active ? <Badge tone="accent">Plan actuel</Badge> : recommended ? <Badge tone="success">Recommandé</Badge> : !ready ? <Badge tone="neutral">Configuration requise</Badge> : null}
                </div>
                <p className="mt-2 text-2xl font-semibold">{formatEur(plan.priceEur)}<span className="text-sm font-normal text-muted-foreground">/mois</span></p>
                <p className="mt-2 min-h-16 text-sm leading-6 text-muted-foreground">{plan.positioning}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
                  <li>✓ {plan.monthlyCredits.toLocaleString("fr-FR")} crédits d'usage intelligent / mois</li>
                </ul>

                {!active && ready && !usage.paid && (
                  <form method="post" action="/api/billing/checkout" className="mt-5">
                    <input type="hidden" name="plan" value={planKey} />
                    <Button type="submit" size="sm" variant={recommended ? "default" : "outline"} className="w-full">
                      Activer {plan.label}
                    </Button>
                  </form>
                )}

                {!active && ready && usage.paid && (
                  <form method="post" action="/api/billing/portal" className="mt-5">
                    <Button type="submit" size="sm" variant="outline" className="w-full">Changer d'offre</Button>
                  </form>
                )}

                {!active && !ready && (
                  <p className="mt-5 text-xs leading-5 text-muted-foreground">Cette offre sera activable dès que son prix Stripe sera configuré côté serveur.</p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Si vous avez déjà un abonnement, les changements de formule passent par le portail de facturation afin d'éviter toute création accidentelle d'un second abonnement.
        </p>
      </section>
    </div>
  );
}
