import { notFound } from "next/navigation";
import { BarChart3, BrainCircuit, Building2, CheckCircle2, ShieldCheck, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
import { auth } from "@/lib/auth";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { buildAdminIntelligenceSummary } from "@/lib/admin/intelligence";
import { formatEur, formatHours } from "@/lib/format";

function percent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export default async function AdminIntelligencePage() {
  const session = await auth();
  if (!isPilotziaAdmin(session?.user?.email)) notFound();

  const data = await buildAdminIntelligenceSummary();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Pilotzia Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Intelligence marché & produit</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Comprendre quels profils ont quels besoins, quelles solutions sont adoptées et où la valeur se concentre — sans exposer les données brutes des entreprises clientes.
          </p>
        </div>
        <div className="rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
          Cohorte minimale : {data.privacy.minimumCohort} entreprises
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={Building2} label="Entreprises" value={String(data.totals.companies)} />
        <Kpi icon={TrendingUp} label="Entreprises payantes" value={`${data.totals.paidCompanies} · ${percent(data.totals.paidRate)}`} />
        <Kpi icon={Target} label="Opportunités" value={String(data.totals.opportunities)} />
        <Kpi icon={Zap} label="Automatisations" value={String(data.totals.automations)} />
        <Kpi icon={CheckCircle2} label="Actives" value={String(data.totals.activeAutomations)} />
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <SegmentTable title="Par secteur" rows={data.segments.industry} />
        <SegmentTable title="Par pays" rows={data.segments.country} />
        <SegmentTable title="Par taille" rows={data.segments.size} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <BrainCircuit size={18} className="text-accent" />
            <h2 className="font-semibold">Besoins les plus fréquents</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Classés par nombre d'entreprises distinctes dans lesquelles le besoin apparaît.</p>
          {data.topNeeds.length ? (
            <div className="mt-5 space-y-3">
              {data.topNeeds.slice(0, 10).map((need, index) => (
                <div key={need.need} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-accent">#{index + 1}</p>
                      <p className="mt-0.5 font-semibold">{need.need}</p>
                    </div>
                    <span className="text-sm font-semibold">{need.companies} entreprises</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>Accepté : <strong className="text-foreground">{percent(need.acceptanceRate)}</strong></span>
                    <span>Temps : <strong className="text-foreground">{formatHours(need.avgEstimatedHoursPerMonth)}/mois</strong></span>
                    <span>Valeur : <strong className="text-foreground">{formatEur(need.avgEstimatedValueEur)}/mois</strong></span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyCohort />
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" />
            <h2 className="font-semibold">Solutions les plus installées</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Une première lecture des solutions qui trouvent réellement leur place dans les entreprises.</p>
          {data.topSolutions.length ? (
            <div className="mt-5 space-y-3">
              {data.topSolutions.slice(0, 10).map((solution, index) => (
                <div key={solution.solution} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-accent">#{index + 1}</p>
                      <p className="mt-0.5 font-semibold">{solution.name}</p>
                    </div>
                    <span className="text-sm font-semibold">{solution.companies} entreprises</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Actives : <strong className="text-foreground">{percent(solution.activeRate)}</strong></span>
                    <span>Valeur : <strong className="text-foreground">{formatEur(solution.avgEstimatedValueEur)}</strong></span>
                    <span>Temps : <strong className="text-foreground">{formatHours(solution.avgEstimatedHoursPerMonth)}</strong></span>
                    <span>
                      Feedback : <strong className="text-foreground">{solution.positiveFeedbackRate == null ? "—" : percent(solution.positiveFeedbackRate)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyCohort />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <h2 className="font-semibold">Règle produit : apprendre sans réutiliser les données privées</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{data.privacy.note}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Les prochaines décisions produit doivent chercher les intersections « besoin fréquent × forte valeur × forte adoption × solution reproductible ». C'est cette boucle qui peut faire émerger de nouveaux produits, offres verticales ou services à forte marge.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon size={15} /><span className="text-xs">{label}</span></div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function SegmentTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    segment: string;
    companies: number;
    paidRate: number;
    avgEstimatedHoursPerCompany: number;
    opportunityAcceptanceRate: number;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length ? (
        <div className="mt-4 space-y-3">
          {rows.slice(0, 8).map((row) => (
            <div key={row.segment} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium">{row.segment}</p>
                <span className="text-xs text-muted-foreground">{row.companies} entreprises</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>payant {percent(row.paidRate)}</span>
                <span>acceptation {percent(row.opportunityAcceptanceRate)}</span>
                <span>~{formatHours(row.avgEstimatedHoursPerCompany)}/mois identifiées</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyCohort compact />
      )}
    </div>
  );
}

function EmptyCohort({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "mt-4 text-xs leading-5 text-muted-foreground" : "mt-6 rounded-xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground"}>
      Pas encore assez d'entreprises comparables pour afficher cette statistique sans affaiblir la confidentialité.
    </div>
  );
}
