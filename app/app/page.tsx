"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardSummary = {
  ok: boolean;
  companyName?: string;
  firstName?: string;
  automationScore?: number;
  pendingActions?: Array<{ id: string; title: string; riskLevel: string }>;
  opportunities?: Array<{
    id: string;
    title: string;
    impactLevel: string;
    estimatedHoursPerMonth: number;
    estimatedValueEur: number;
  }>;
  activeAutomations?: number;
  healthyAutomations?: number;
  observedHoursPerMonth?: number;
  observedValue30d?: number;
  estimatedHoursPerMonth?: number;
  estimatedValuePerMonth?: number;
  marketing?: {
    source: string;
    spendEur: number | null;
    revenueEur: number | null;
    roas: number | null;
    sessions: number | null;
  } | null;
};

function formatHours(value: number | null | undefined) {
  const hours = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return (hours % 1 === 0 ? String(hours) : hours.toFixed(1)) + " h";
}

function formatEur(value: number | null | undefined) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardHomePage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    fetch("/api/dashboard/summary", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as DashboardSummary;
        if (!response.ok || !data.ok) throw new Error("dashboard_summary_unavailable");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setSummary(data);
        setLoadState("ready");
      })
      .catch((error) => {
        console.error("Dashboard summary unavailable", error);
        if (!active) return;
        setLoadState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const pendingActions = summary?.pendingActions ?? [];
  const opportunities = summary?.opportunities ?? [];
  const activeAutomations = summary?.activeAutomations ?? 0;
  const healthyAutomations = summary?.healthyAutomations ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Tableau de bord</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {summary?.firstName ? `Bonjour, ${summary.firstName}` : "Pilotzia"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/80">
          {summary?.companyName
            ? `Voici les signaux essentiels disponibles pour ${summary.companyName}.`
            : "Vos principaux accès restent disponibles même si une source de données tarde à répondre."}
        </p>
        {loadState === "error" && (
          <p className="mt-3 rounded-xl border border-warning/20 bg-card px-3 py-2 text-xs text-muted-foreground">
            Certaines données du tableau de bord sont temporairement indisponibles. La navigation et les écrans métier restent accessibles.
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Décisions à valider" value={loadState === "loading" ? "…" : String(pendingActions.length)} href="/app/actions" />
        <Metric label="Automatisations actives" value={loadState === "loading" ? "…" : String(activeAutomations)} href="/app/automations" />
        <Metric
          label="Santé automatisations"
          value={loadState === "loading" ? "…" : activeAutomations > 0 ? `${healthyAutomations}/${activeAutomations}` : "Aucune active"}
          href="/app/automations"
        />
        <Metric
          label="Maturité automatisation"
          value={loadState === "loading" ? "…" : `${summary?.automationScore ?? 0}/100`}
          href="/app/company"
        />
      </section>

      {summary && ((summary.observedHoursPerMonth ?? 0) > 0 || (summary.observedValue30d ?? 0) > 0) && (
        <section className="rounded-2xl border border-success/20 bg-card p-5">
          <h2 className="text-base font-semibold">Résultats observés</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ces valeurs restent séparées des estimations de potentiel.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SimpleStat label="Temps observé / mois" value={formatHours(summary.observedHoursPerMonth)} />
            <SimpleStat label="Impact observé · 30 j" value={formatEur(summary.observedValue30d)} />
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Décisions requises</h2>
              <p className="mt-1 text-sm text-muted-foreground">Actions préparées qui attendent votre validation.</p>
            </div>
            <Link href="/app/actions" className="text-sm font-semibold text-accent hover:underline">Voir tout</Link>
          </div>
          {pendingActions.length > 0 ? (
            <div className="mt-4 space-y-3">
              {pendingActions.map((action) => (
                <Link key={action.id} href="/app/actions" className="block rounded-xl border border-border p-3 transition-colors hover:border-accent/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{action.title}</p>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{action.riskLevel}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {loadState === "loading" ? "Chargement…" : "Aucune décision n'attend votre validation."}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Opportunités</h2>
              <p className="mt-1 text-sm text-muted-foreground">Les prochaines pistes détectées par Pilotzia.</p>
            </div>
            <Link href="/app/opportunities" className="text-sm font-semibold text-accent hover:underline">Voir tout</Link>
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
                {loadState === "loading" ? "Chargement…" : "Aucune opportunité n'est actuellement en attente."}
              </p>
              <Link href="/app/copilot" className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline">
                Demander une recommandation au Copilote
              </Link>
            </div>
          )}
        </section>
      </div>

      {summary?.marketing && (
        <section className="rounded-2xl border border-accent/20 bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Marketing</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.marketing.source === "google_marketing"
                  ? "Dernier instantané Google synchronisé."
                  : "Dernier instantané saisi manuellement."}
              </p>
            </div>
            <Link href="/app/marketing" className="text-sm font-semibold text-accent hover:underline">Ouvrir</Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SimpleStat label="Dépenses Ads" value={summary.marketing.spendEur == null ? "—" : formatEur(summary.marketing.spendEur)} />
            <SimpleStat label="Revenu" value={summary.marketing.revenueEur == null ? "—" : formatEur(summary.marketing.revenueEur)} />
            <SimpleStat label="ROAS" value={summary.marketing.roas == null ? "—" : summary.marketing.roas.toFixed(2) + "×"} />
            <SimpleStat label="Sessions GA4" value={summary.marketing.sessions == null ? "—" : Math.round(summary.marketing.sessions).toLocaleString("fr-FR")} />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Potentiel estimé</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimations liées aux automatisations actives — elles ne sont pas présentées comme des gains réalisés.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SimpleStat label="Temps potentiel / mois" value={loadState === "loading" ? "…" : formatHours(summary?.estimatedHoursPerMonth)} />
          <SimpleStat label="Valeur potentielle / mois" value={loadState === "loading" ? "…" : formatEur(summary?.estimatedValuePerMonth)} />
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
    <Link href={href} className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/40">
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

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-accent/40">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </Link>
  );
}
