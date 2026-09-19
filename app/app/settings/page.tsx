import { getDashboardShellAccess, hasCompanyPermission } from "@/lib/companies/access";
import { safeRead } from "@/lib/runtime/safe-read";
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

function formatDateTime(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default async function SettingsPage() {
  const access = await getDashboardShellAccess();
  const session = access.session;
  const billingState = await safeRead(
    "settings.billing-state",
    async () => {
      const [subscription, companySettings] = await Promise.all([
        prisma.subscription.findFirst({
          where: { companyId: access.company.id },
          orderBy: { createdAt: "desc" },
          select: { plan: true, status: true, stripeCustomerId: true },
        }),
        prisma.company.findUnique({
          where: { id: access.company.id },
          select: { automationPurchaseMonthlyCapEur: true },
        }),
      ]);
      return {
        subscription,
        automationPurchaseMonthlyCapEur: companySettings?.automationPurchaseMonthlyCapEur ?? 0,
      };
    },
    { subscription: null, automationPurchaseMonthlyCapEur: 0 }
  );
  const company = { ...access.company, automationPurchaseMonthlyCapEur: billingState.automationPurchaseMonthlyCapEur };
  const canManageBilling = hasCompanyPermission(access.role, "manage_billing");
  const subscription = billingState.subscription;
  const currentPlan = subscription?.plan ?? "free";
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);
  const usage = await safeRead(
    "settings.usage",
    () => getUsageStatus(company.id),
    {
      paid: false,
      hasPaidHistory: false,
      subscriptionInactive: false,
      plan: "free",
      planLabel: "Découverte",
      nextPlan: "starter",
      periodKind: "trial" as const,
      periodStartsAt: null,
      periodEndsAt: null,
      daysRemaining: null,
      trialStartedAt: null,
      trialEndsAt: null,
      trialActive: false,
      trialExpired: false,
      creditsUsed: 0,
      baseCreditsLimit: 0,
      addonCredits: 0,
      creditsLimit: 0,
      creditsRemaining: 0,
      reservedCostEur: 0,
      baseCostCapEur: 0,
      addonCostCapEur: 0,
      costCapEur: 0,
      costRemainingEur: 0,
      alertLevel: "normal" as const,
    }
  );
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const automationPurchases = await safeRead(
    "settings.automation-purchases",
    () =>
      prisma.purchase.aggregate({
        where: {
          companyId: company.id,
          createdAt: { gte: monthStart },
          status: { in: ["pending", "payment_action_required", "payment_failed", "paid"] },
        },
        _sum: { amountEur: true },
      }),
    { _sum: { amountEur: null } }
  );
  const automationPurchaseCommittedEur = automationPurchases._sum.amountEur ?? 0;
  const automationPurchaseHistory = await safeRead(
    "settings.automation-purchase-history",
    () =>
      prisma.purchase.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amountEur: true,
          status: true,
          providerRef: true,
          paidAt: true,
          termsVersion: true,
          termsAcceptedAt: true,
          immediateFulfillmentRequestedAt: true,
          deliveredAt: true,
          firstUsedAt: true,
          createdAt: true,
          opportunity: { select: { title: true } },
        },
      }),
    []
  );
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

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Historique et preuve des achats numériques</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Pilotzia conserve la validation des conditions, la confirmation du paiement, la livraison et le premier usage lorsqu'ils sont disponibles. Les achats antérieurs à cette traçabilité restent identifiés comme tels.
            </p>
            {automationPurchaseHistory.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Aucun achat d'automatisation enregistré.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {automationPurchaseHistory.map((purchase) => (
                  <div key={purchase.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{purchase.opportunity.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatEur(purchase.amountEur)} HT · {purchase.status}
                          {purchase.providerRef ? ` · Stripe ${purchase.providerRef}` : ""}
                        </p>
                      </div>
                      <Badge tone={purchase.deliveredAt ? "success" : purchase.paidAt ? "accent" : "neutral"}>
                        {purchase.firstUsedAt ? "Utilisée" : purchase.deliveredAt ? "Livrée" : purchase.paidAt ? "Payée" : "En cours"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>Commande : {formatDateTime(purchase.createdAt)}</p>
                      <p>Paiement : {formatDateTime(purchase.paidAt)}</p>
                      <p>
                        Conditions : {purchase.termsAcceptedAt
                          ? `acceptées le ${formatDateTime(purchase.termsAcceptedAt)} · v${purchase.termsVersion ?? "historique"}`
                          : "achat antérieur à la traçabilité contractuelle"}
                      </p>
                      <p>Exécution immédiate demandée : {formatDateTime(purchase.immediateFulfillmentRequestedAt)}</p>
                      <p>Livraison / installation : {formatDateTime(purchase.deliveredAt)}</p>
                      <p>Premier usage réel : {formatDateTime(purchase.firstUsedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
