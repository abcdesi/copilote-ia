import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import { getUsageStatus } from "@/lib/billing/usage-policy";
import { PAID_PLAN_KEYS, PLAN_DEFINITIONS, type BillingCycle } from "@/lib/billing/plans";
import { CREDIT_PACKS, creditPackStripeReady } from "@/lib/billing/credit-packs";
import { prisma } from "@/lib/db/client";
import { updateAutomationPurchaseCapAction } from "@/lib/billing/settings-actions";
import { Input, Label } from "@/components/ui/Input";

function stripeReady(_plan: "starter" | "pro" | "business", _billingCycle: BillingCycle) {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function formatDate(value: Date | null) {
  if (!value) return "Pas encore démarré";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value);
}

export default async function SettingsPage() {
  const access = await getCurrentCompanyAccess();
  const session = access.session;
  const company = access.company;
  const canManageBilling = hasCompanyPermission(access.role, "manage_billing");
  const subscription = company.subscriptions[0];
  const currentPlan = subscription?.plan ?? "free";
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);
  const usage = await getUsageStatus(company.id);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const automationPurchases = await prisma.purchase.aggregate({
    where: {
      companyId: company.id,
      createdAt: { gte: monthStart },
      status: { in: ["pending", "payment_action_required", "payment_failed", "paid"] },
    },
    _sum: { amountEur: true },
  });
  const automationPurchaseCommittedEur = automationPurchases._sum.amountEur ?? 0;
  const creditPct = usage.creditsLimit > 0 ? Math.min(100, Math.round((usage.creditsUsed / usage.creditsLimit) * 100)) : 100;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compte & abonnement</h1>
        <p className="mt-1 text-sm text-muted-foreground">Votre compte, votre capacité d'usage et les options pour continuer sans interruption.</p>
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
                L'essai démarre au premier usage IA réel. Vous avez 14 jours et une enveloppe d'usage suffisante pour vérifier la qualité du copilote, enrichir le contexte et tester les premières recommandations sans carte bancaire. Vous pouvez souscrire à tout moment sans attendre la fin de l'essai.
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
                Votre abonnement inclut une enveloppe mensuelle. Pilotzia vous alerte avant la limite et vous laisse choisir entre crédits supplémentaires et offre supérieure.
              </p>
            </div>
            <Badge tone={usage.alertLevel === "critical" ? "warning" : "accent"}>{usage.alertLevel === "critical" ? "Capacité presque épuisée" : "Plan actif"}</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Crédits utilisés</p>
              <p className="mt-1 text-xl font-semibold">{usage.creditsUsed.toLocaleString("fr-FR")} / {usage.creditsLimit.toLocaleString("fr-FR")}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-accent" style={{ width: `${creditPct}%` }} /></div>
              {usage.addonCredits > 0 && <p className="mt-2 text-[11px] text-muted-foreground">dont {usage.addonCredits.toLocaleString("fr-FR")} crédits supplémentaires achetés</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Période d'usage</p>
              <p className="mt-1 text-sm font-semibold">{formatDate(usage.periodStartsAt)} → {formatDate(usage.periodEndsAt)}</p>
              {usage.daysRemaining !== null && <p className="mt-2 text-[11px] text-muted-foreground">Renouvellement dans {usage.daysRemaining} jour{usage.daysRemaining > 1 ? "s" : ""}</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Capacité restante</p>
              <p className="mt-1 text-sm font-semibold">{usage.creditsRemaining.toLocaleString("fr-FR")} crédits</p>
            </div>
          </div>
        </div>
      )}

      {!canManageBilling && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Vous pouvez consulter l'abonnement et l'usage de l'entreprise, mais seul le Propriétaire peut modifier l'offre, acheter des crédits ou ouvrir le portail de facturation.
        </div>
      )}

      <section id="plans" className="scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Choisissez jusqu'où Pilotzia doit aller pour vous</h2>
            <p className="mt-1 text-sm text-muted-foreground">Core aide à décider. Action ouvre le moteur d'exécution ; les automatisations sont ensuite achetées séparément au prix affiché. Scale ajoute une profondeur d'audit et de pilotage supérieure.</p>
          </div>
          {hasStripeCustomer && canManageBilling && (
            <form method="post" action="/api/billing/portal">
              <Button type="submit" size="sm" variant="outline">Gérer ou modifier mon abonnement</Button>
            </form>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PAID_PLAN_KEYS.map((planKey) => {
            const plan = PLAN_DEFINITIONS[planKey];
            const active = planKey === currentPlan;
            const monthlyReady = stripeReady(planKey, "monthly");
            const annualReady = stripeReady(planKey, "annual");
            return (
              <div
                key={planKey}
                className={cn(
                  "rounded-2xl border p-5",
                  active ? "border-accent bg-accent-soft" : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{plan.label}</p>
                  {active ? <Badge tone="accent">Plan actuel</Badge> : !monthlyReady ? <Badge tone="neutral">Configuration requise</Badge> : null}
                </div>
                <p className="mt-2 text-2xl font-semibold">{formatEur(plan.priceEur)}<span className="text-sm font-normal text-muted-foreground">/mois</span></p>
                <p className="mt-1 text-xs text-muted-foreground">ou {formatEur(plan.annualPriceEur)}/an · 1 mois offert</p>
                <p className="mt-2 min-h-16 text-sm leading-6 text-muted-foreground">{plan.positioning}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
                  <li>✓ {plan.monthlyCredits.toLocaleString("fr-FR")} crédits d'usage intelligent / mois</li>
                </ul>

                {!active && !usage.paid && canManageBilling && (
                  <div className="mt-5 grid gap-2">
                    {monthlyReady ? (
                      <form method="post" action="/api/billing/checkout">
                        <input type="hidden" name="plan" value={planKey} />
                        <input type="hidden" name="billingCycle" value="monthly" />
                        <Button type="submit" size="sm" variant="outline" className="w-full">Activer {plan.label} mensuel</Button>
                      </form>
                    ) : <p className="text-xs leading-5 text-muted-foreground">Le prix mensuel Stripe doit être configuré.</p>}
                    {annualReady ? (
                      <form method="post" action="/api/billing/checkout">
                        <input type="hidden" name="plan" value={planKey} />
                        <input type="hidden" name="billingCycle" value="annual" />
                        <Button type="submit" size="sm" variant="outline" className="w-full">Choisir l'annuel · {formatEur(plan.annualPriceEur)}</Button>
                      </form>
                    ) : <p className="text-[11px] text-muted-foreground">L'annuel sera activable dès que son prix Stripe sera configuré.</p>}
                  </div>
                )}

                {!active && usage.paid && canManageBilling && (
                  <form method="post" action="/api/billing/portal" className="mt-5">
                    <Button type="submit" size="sm" variant="outline" className="w-full">Changer d'offre</Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Les changements d'un abonnement actif passent par le portail de facturation afin d'éviter tout doublon. Les crédits inclus se renouvellent à chaque période d'usage mensuelle, y compris sur l'abonnement annuel. Les automatisations exécutables sont des achats uniques séparés : leur prix est affiché avant validation et leur usage courant consomme ensuite les crédits du plan.
        </p>
      </section>

      {canManageBilling && (
        <section id="automation-purchases" className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold">Budget d'achat des automatisations</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Les automatisations exécutables sont achetées séparément de l'abonnement. Ce plafond dur empêche Pilotzia d'engager plus que le montant autorisé sur un même mois, même en cas de double clic ou de demandes rapprochées.
              </p>
            </div>
            <Badge tone={automationPurchaseCommittedEur >= company.automationPurchaseMonthlyCapEur ? "warning" : "neutral"}>
              {formatEur(automationPurchaseCommittedEur)} / {formatEur(company.automationPurchaseMonthlyCapEur)} engagés
            </Badge>
          </div>
          <form action={updateAutomationPurchaseCapAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full max-w-xs space-y-1.5">
              <Label htmlFor="monthlyCapEur">Plafond mensuel HT</Label>
              <Input
                id="monthlyCapEur"
                name="monthlyCapEur"
                type="number"
                min={0}
                max={5000}
                step={10}
                defaultValue={company.automationPurchaseMonthlyCapEur}
              />
            </div>
            <Button type="submit" size="sm" variant="outline">Enregistrer le plafond</Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            0 € bloque tout nouvel achat. Le plafond ne déclenche aucun achat automatiquement : chaque automatisation doit toujours être validée manuellement par le Propriétaire. Une facture Stripe déjà initiée reste comptée jusqu'à paiement ou annulation.
          </p>
        </section>
      )}

      {usage.paid && canManageBilling && (
        <section id="credits" className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Crédits supplémentaires</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Pour absorber un pic ponctuel sans changer immédiatement d'offre. Les crédits achetés s'ajoutent à la période d'usage en cours ; pour un besoin récurrent, l'offre supérieure est généralement plus adaptée.</p>
            </div>
            {usage.nextPlan && <a href="#plans" className="text-sm font-semibold text-accent hover:underline">Comparer avec {PLAN_DEFINITIONS[usage.nextPlan].label}</a>}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {CREDIT_PACKS.map((pack) => {
              const ready = creditPackStripeReady(pack.key);
              return (
                <div key={pack.key} className="rounded-xl border border-border p-4">
                  <p className="text-lg font-semibold">{pack.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatEur(pack.priceEur)} · paiement unique</p>
                  {ready ? (
                    <form method="post" action="/api/billing/credits/checkout" className="mt-4">
                      <input type="hidden" name="pack" value={pack.key} />
                      <Button type="submit" size="sm" variant="outline" className="w-full">Ajouter {pack.label}</Button>
                    </form>
                  ) : (
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">Disponible dès que ce pack est configuré dans Stripe.</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Pilotzia bloque les opérations payantes avant tout dépassement de l'enveloppe autorisée : pas de consommation externe non budgétée ni de facture surprise.</p>
        </section>
      )}
    </div>
  );
}
