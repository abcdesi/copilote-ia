import Link from "next/link";
import { getDashboardShellAccess } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { deriveMarketingKpis, getLatestMarketingKpiSnapshot } from "@/lib/marketing/kpis";

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatHours(value: unknown) {
  const hours = safeNumber(value);
  return (hours % 1 === 0 ? String(hours) : hours.toFixed(1)) + " h";
}

function formatEur(value: unknown) {
  const amount = safeNumber(value);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function DashboardHomePage() {
  const access = await getDashboardShellAccess();
  const company = access.company;

  const [profile, automations, opportunities, pendingActions, outcomes, marketingSnapshot] =
    await Promise.all([
      prisma.company
        .findUnique({
          where: { id: company.id },
          select: { automationScore: true },
        })
        .catch((error) => {
          console.error("Dashboard profile unavailable", error);
          return null;
        }),
      prisma.automation
        .findMany({
          where: { companyId: company.id },
          orderBy: { installedAt: "desc" },
          take: 100,
          select: {
            id: true,
            name: true,
            status: true,
            health: true,
            estimatedHoursPerMonth: true,
            estimatedValueEur: true,
          },
        })
        .catch((error) => {
          console.error("Dashboard automations unavailable", error);
          return [];
        }),
      prisma.opportunity
        .findMany({
          where: { companyId: company.id, status: { in: ["detected", "viewed"] } },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            title: true,
            impactLevel: true,
            estimatedHoursPerMonth: true,
            estimatedValueEur: true,
          },
        })
        .catch((error) => {
          console.error("Dashboard opportunities unavailable", error);
          return [];
        }),
      prisma.pendingAction
        .findMany({
          where: { companyId: company.id, status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            title: true,
            riskLevel: true,
          },
        })
        .catch((error) => {
          console.error("Dashboard pending actions unavailable", error);
          return [];
        }),
      prisma.automationOutcome
        .findMany({
          where: { automation: { companyId: company.id } },
          orderBy: { observedAt: "desc" },
          take: 100,
          select: {
            automationId: true,
            kind: true,
            value: true,
          },
        })
        .catch((error) => {
          console.error("Dashboard outcomes unavailable", error);
          return [];
        }),
      getLatestMarketingKpiSnapshot(company.id).catch((error) => {
        console.error("Dashboard marketing snapshot unavailable", error);
        return null;
      }),
    ]);

  const activeAutomations = automations.filter((item) => item.status === "active");
  const healthyAutomations = activeAutomations.filter((item) => item.health === "green").length;
  const estimatedHours = activeAutomations.reduce(
    (sum, item) => sum + safeNumber(item.estimatedHoursPerMonth),
    0
  );
  const estimatedValue = activeAutomations.reduce(
    (sum, item) => sum + safeNumber(item.estimatedValueEur),
    0
  );

  const latestOutcomeByMetric = new Map<string, (typeof outcomes)[number]>();
  for (const outcome of outcomes) {
    const key = outcome.automationId + ":" + outcome.kind;
    if (!latestOutcomeByMetric.has(key)) latestOutcomeByMetric.set(key, outcome);
  }
  const latestOutcomes = [...latestOutcomeByMetric.values()];
  const observedHoursPerWeek = latestOutcomes
    .filter((item) => item.kind === "time_saved_weekly_hours")
    .reduce((sum, item) => sum + safeNumber(item.value), 0);
  const observedValue30d = latestOutcomes
    .filter((item) => item.kind === "value_observed_eur_30d")
    .reduce((sum, item) => sum + safeNumber(item.value), 0);

  const marketingKpis = marketingSnapshot ? deriveMarketingKpis(marketingSnapshot) : null;
  const firstName =
    access.session.user.name?.trim().split(/\s+/)[0] ||
    access.session.user.email?.split("@")[0] ||
    company.name;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Tableau de bord</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Bonjour, {firstName}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">
          Voici les signaux essentiels disponibles pour {company.name}. Les blocs restent indépendants :
          une source indisponible ne doit plus empêcher l&apos;accès au reste de Pilotzia.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Décisions à valider"
          value={String(pendingActions.length)}
          href="/app/actions"
        />
        <Metric
          label="Automatisations actives"
          value={String(activeAutomations.length)}
          href="/app/automations"
        />
        <Metric
          label="Santé automatisations"
          value={
            activeAutomations.length > 0
              ? healthyAutomations + "/" + activeAutomations.length
              : "Aucune active"
          }
          href="/app/automations"
        />
        <Metric
          label="Maturité automatisation"
          value={String(profile?.automationScore ?? 0) + "/100"}
          href="/app/company"
        />
      </section>

      {(observedHoursPerWeek > 0 || observedValue30d > 0) && (
        <section className="rounded-2xl border border-success/20 bg-card p-5">
          <h2 className="text-base font-semibold">Résultats observés</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ces valeurs proviennent de résultats déclarés ou observés, distincts des estimations.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SimpleStat
              label="Temps observé / mois"
              value={observedHoursPerWeek > 0 ? "~" + formatHours(observedHoursPerWeek * 4.33) : "À mesurer"}
            />
            <SimpleStat
              label="Impact observé · 30 j"
              value={observedValue30d > 0 ? formatEur(observedValue30d) : "À mesurer"}
            />
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Décisions requises</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Actions préparées qui attendent votre validation.
              </p>
            </div>
            <Link href="/app/actions" className="text-sm font-semibold text-accent hover:underline">
              Voir tout
            </Link>
          </div>
          {pendingActions.length > 0 ? (
            <div className="mt-4 space-y-3">
              {pendingActions.map((action) => (
                <Link
                  key={action.id}
                  href="/app/actions"
                  className="block rounded-xl border border-border p-3 transition-colors hover:border-accent/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{action.title}</p>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {action.riskLevel}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucune décision n&apos;attend votre validation.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Opportunités</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Les prochaines pistes détectées par Pilotzia.
              </p>
            </div>
            <Link
              href="/app/opportunities"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Voir tout
            </Link>
          </div>
          {opportunities.length > 0 ? (
            <div className="mt-4 space-y-3">
              {opportunities.map((opportunity) => (
                <Link
                  key={opportunity.id}
                  href={"/app/opportunities/" + opportunity.id}
                  className="block rounded-xl border border-border p-3 transition-colors hover:border-accent/40"
                >
                  <p className="text-sm font-medium">{opportunity.title}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Potentiel : {formatHours(opportunity.estimatedHoursPerMonth)}/mois</span>
                    <span>Valeur estimée : {formatEur(opportunity.estimatedValueEur)}</span>
                    <span>Impact : {opportunity.impactLevel || "non classé"}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                Aucune opportunité n&apos;est actuellement en attente.
              </p>
              <Link
                href="/app/copilot"
                className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline"
              >
                Demander une recommandation au Copilote
              </Link>
            </div>
          )}
        </section>
      </div>

      {marketingSnapshot && (
        <section className="rounded-2xl border border-accent/20 bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Marketing</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {marketingSnapshot.source === "google_marketing"
                  ? "Dernier instantané Google synchronisé."
                  : "Dernier instantané saisi manuellement."}
              </p>
            </div>
            <Link href="/app/marketing" className="text-sm font-semibold text-accent hover:underline">
              Ouvrir
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SimpleStat
              label="Dépenses Ads"
              value={
                marketingSnapshot.spendEur == null
                  ? "—"
                  : formatEur(marketingSnapshot.spendEur)
              }
            />
            <SimpleStat
              label="Revenu"
              value={
                marketingSnapshot.revenueEur == null
                  ? "—"
                  : formatEur(marketingSnapshot.revenueEur)
              }
            />
            <SimpleStat
              label="ROAS"
              value={marketingKpis?.roas == null ? "—" : marketingKpis.roas.toFixed(2) + "×"}
            />
            <SimpleStat
              label="Sessions GA4"
              value={
                marketingSnapshot.sessions == null
                  ? "—"
                  : Math.round(marketingSnapshot.sessions).toLocaleString("fr-FR")
              }
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Potentiel estimé</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimations liées aux automatisations actives — elles ne sont pas présentées comme des gains réalisés.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SimpleStat label="Temps potentiel / mois" value={formatHours(estimatedHours)} />
          <SimpleStat label="Valeur potentielle / mois" value={formatEur(estimatedValue)} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/app/copilot" title="Copilote" description="Poser une question ou préparer une action." />
        <QuickLink href="/app/company" title="Entreprise" description="Compléter le contexte et les priorités." />
        <QuickLink href="/app/tools" title="Outils" description="Gérer les connexions et leurs autorisations." />
        <QuickLink href="/app/results" title="Résultats" description="Suivre les gains réellement observés." />
      </section>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </Link>
  );
}

function SimpleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/40"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </Link>
  );
}
