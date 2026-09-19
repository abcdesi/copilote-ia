import { AlertTriangle, CheckCircle2, Database, Network, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { getDashboardShellAccess, hasCompanyPermission } from "@/lib/companies/access";
import { safeRead } from "@/lib/runtime/safe-read";
import { getBusinessGraphContext } from "@/lib/business-graph";
import { prisma } from "@/lib/db/client";
import { rebuildBusinessGraphAction } from "@/lib/business-graph/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const TYPE_LABELS: Record<string, string> = {
  company: "Entreprise",
  tool: "Outils",
  connection: "Connexions",
  automation: "Automatisations",
  opportunity: "Opportunités",
  process: "Processus",
  person: "Personnes",
  customer: "Clients",
  document: "Documents",
};

const PREDICATE_LABELS: Record<string, string> = {
  uses: "utilise",
  connected_to: "connecté à",
  provides: "fournit",
  runs: "exécute",
  has_opportunity: "a comme opportunité",
  industry: "secteur",
  country: "pays",
  size_range: "taille",
  employee_count: "effectif",
  has_goal: "objectif",
  has_pain_point: "friction",
  automation_score: "score d'automatisation",
  unread_inbox_last_7_days: "emails non lus sur 7 jours",
  upcoming_events_next_7_days: "événements à venir sur 7 jours",
};

function parseValue(valueJson: string | null) {
  if (!valueJson) return null;
  try {
    const value = JSON.parse(valueJson);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  } catch {
    return valueJson;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Jamais synchronisé";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default async function ContextPage() {
  const access = await getDashboardShellAccess();
  const company = access.company;
  const canRebuild = hasCompanyPermission(access.role, "edit_company");
  const [graph, weeklyRefreshEvent] = await Promise.all([
    safeRead(
      "context.business-graph",
      () => getBusinessGraphContext(company.id),
      {
        summary: {
          readinessScore: 0,
          entityCount: 0,
          factCount: 0,
          sourceCount: 0,
          connectedSourceCount: 0,
          freshSourceCount: 0,
          staleSourceCount: 0,
          entityTypes: [],
          sources: [],
          lastBuiltAt: null,
        },
        entities: [],
        facts: [],
        entityCount: 0,
      }
    ),
    safeRead(
      "context.weekly-refresh",
      () =>
        prisma.event.findFirst({
          where: { companyId: company.id, type: "WEEKLY_REFRESH_COMPLETED" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, metadata: true },
        }),
      null
    ),
  ]);
  const weeklyRefresh = parseWeeklyRefresh(weeklyRefreshEvent?.metadata ?? null);
  const entityById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const visibleFacts = graph.facts.slice(0, 8);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Pilotzia Context Engine</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Contexte IA de l'entreprise</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Pilotzia transforme les informations dispersées de {company.name} en un graphe de contexte traçable,
            actualisé et exploitable par le copilote, les automatisations et, à terme, vos agents externes.
          </p>
        </div>
        {canRebuild ? (
          <form action={rebuildBusinessGraphAction}>
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw size={14} /> Actualiser le contexte
            </Button>
          </form>
        ) : (
          <span className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">Lecture seule</span>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-accent/20 bg-accent-soft">
        <div className="grid gap-6 p-6 lg:grid-cols-[220px_1fr]">
          <div className="flex items-center gap-4 lg:block">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-card text-accent shadow-sm">
              <Network size={29} />
            </div>
            <div className="lg:mt-5">
              <p className="text-4xl font-semibold tracking-tight">{graph.summary.readinessScore}<span className="text-lg text-muted-foreground">/100</span></p>
              <p className="mt-1 text-sm font-medium">Préparation du contexte IA</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Score interne basé sur la couverture, les connexions et la fraîcheur — pas un benchmark externe.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Entités comprises" value={String(graph.summary.entityCount)} icon={Database} />
            <Metric label="Faits traçables" value={String(graph.summary.factCount)} icon={Sparkles} />
            <Metric label="Sources réelles" value={String(graph.summary.connectedSourceCount)} icon={Network} />
            <Metric label="Sources fraîches" value={String(graph.summary.freshSourceCount)} icon={CheckCircle2} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold">Rafraîchissement hebdomadaire</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Pilotzia resynchronise les sources autorisées, reconstruit le contexte géré et réévalue les opportunités déterministes sans déclencher d'IA payante par défaut.
            </p>
          </div>
          <Badge tone={weeklyRefreshEvent ? "success" : "neutral"}>
            {weeklyRefreshEvent ? "Actif" : "Premier refresh à venir"}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Metric label="Dernier refresh" value={weeklyRefreshEvent ? formatDate(weeklyRefreshEvent.createdAt.toISOString()) : "À venir"} icon={RefreshCw} />
          <Metric label="Sources synchronisées" value={String(weeklyRefresh?.providerSyncs?.length ?? 0)} icon={Network} />
          <Metric label="IA déclenchée" value={weeklyRefresh?.aiTriggered ? "Oui" : "Non"} icon={Sparkles} />
          <Metric label="Coût IA du refresh" value={weeklyRefresh?.aiVariableCostEur ? `${weeklyRefresh.aiVariableCostEur.toFixed(2)} €` : "0,00 €"} icon={ShieldCheck} />
        </div>
        {weeklyRefresh?.providerErrors?.length ? (
          <p className="mt-3 rounded-xl bg-warning/10 p-3 text-xs leading-5 text-warning">
            Certaines sources n'ont pas pu être rafraîchies : {weeklyRefresh.providerErrors.map((item) => item.split(":")[0]).join(", ")}. Les données existantes sont conservées avec leur date de dernière observation.
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Sources & confiance</h2>
              <p className="mt-1 text-sm text-muted-foreground">Une source n'est considérée réelle que si elle a été autorisée.</p>
            </div>
            <ShieldCheck size={18} className="text-accent" />
          </div>

          {graph.summary.sources.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Aucune source externe connectée. Les faits actuels proviennent du contexte déclaré dans Pilotzia et de ses calculs internes traçables.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {graph.summary.sources.map((source) => (
                <div key={source.provider} className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold capitalize">{source.accountLabel || source.provider}</p>
                      <Badge tone={source.status === "connected" ? "success" : "neutral"}>{source.status === "connected" ? "Connecté" : source.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Dernière synchro : {formatDate(source.lastSyncedAt)}</p>
                  </div>
                  {source.fresh ? (
                    <CheckCircle2 size={17} className="shrink-0 text-success" />
                  ) : (
                    <AlertTriangle size={17} className="shrink-0 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Ce que Pilotzia comprend déjà</h2>
          <p className="mt-1 text-sm text-muted-foreground">Les entités sont canoniques : plusieurs sources pourront progressivement converger vers le même objet.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {graph.summary.entityTypes.map((item) => (
              <div key={item.type} className="rounded-xl border border-border bg-background p-3">
                <p className="text-xl font-semibold">{item.count}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{TYPE_LABELS[item.type] || item.type}</p>
              </div>
            ))}
            {graph.summary.entityTypes.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">Le graphe sera enrichi dès qu'une source ou une donnée opérationnelle sera disponible.</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Faits récents avec provenance</h2>
            <p className="mt-1 text-sm text-muted-foreground">Chaque fait garde sa source, sa date d'observation et son niveau de confiance.</p>
          </div>
          <Badge tone="accent">Agent-ready</Badge>
        </div>

        <div className="mt-5 divide-y divide-border rounded-xl border border-border">
          {visibleFacts.map((fact, index) => {
            const subject = entityById.get(fact.subjectEntityId);
            const object = fact.objectEntityId ? entityById.get(fact.objectEntityId) : null;
            const value = parseValue(fact.valueJson);
            return (
              <div key={`${fact.subjectEntityId}-${fact.predicate}-${index}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{subject?.name || "Entité"}</span>{" "}
                  <span className="text-muted-foreground">{PREDICATE_LABELS[fact.predicate] || fact.predicate.replaceAll("_", " ")}</span>{" "}
                  <span className="font-medium">{object?.name || value || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{factSourceLabel(fact.sourceProvider, fact.sourceRef, fact.provenanceJson)}</span>
                  <span>·</span>
                  <span>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(fact.observedAt))}</span>
                  <span>·</span>
                  <span>{Math.round(fact.confidence * 100)}% confiance</span>
                </div>
              </div>
            );
          })}
          {visibleFacts.length === 0 && <p className="px-4 py-5 text-sm text-muted-foreground">Aucun fait disponible pour le moment.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">La couche qui rend les agents utiles</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1. Connecter", "Sources et permissions réelles"],
            ["2. Structurer", "Entités, relations et provenance"],
            ["3. Comprendre", "Contexte cohérent et actualisé"],
            ["4. Agir", "Actions gouvernées et mesurées"],
          ].map(([title, description]) => (
            <div key={title} className="rounded-xl bg-muted p-4">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Le graphe ne remplace pas les systèmes sources : il conserve leur provenance et leur autorité. Les données conflictuelles pourront être exposées comme telles plutôt que masquées.
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-accent/10 bg-card/80 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}


function factSourceLabel(provider: string, sourceRef: string | null, provenanceJson: string | null) {
  if (provider === "google") return "Google API";
  if (provider === "pilotzia-memory") return "Mémoire dérivée";
  if (provider === "pilotzia") {
    try {
      const provenance = provenanceJson ? JSON.parse(provenanceJson) as { method?: string } : {};
      if (provenance.method === "company_profile") return "Profil renseigné";
      if (provenance.method === "declared") return "Application renseignée";
    } catch {
      // Provenance ancienne : on retombe sur le type de sourceRef.
    }
    if (sourceRef?.startsWith("graph:company:")) return "Profil renseigné";
    if (sourceRef?.startsWith("graph:tool:")) return "Application renseignée";
    return "Pilotzia dérivé";
  }
  return provider;
}

function parseWeeklyRefresh(value: string | null): {
  providerSyncs?: string[];
  providerErrors?: string[];
  aiTriggered?: boolean;
  aiVariableCostEur?: number;
} | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      providerSyncs?: unknown;
      providerErrors?: unknown;
      aiTriggered?: unknown;
      aiVariableCostEur?: unknown;
    };
    return {
      providerSyncs: Array.isArray(parsed.providerSyncs) ? parsed.providerSyncs.filter((item): item is string => typeof item === "string") : [],
      providerErrors: Array.isArray(parsed.providerErrors) ? parsed.providerErrors.filter((item): item is string => typeof item === "string") : [],
      aiTriggered: parsed.aiTriggered === true,
      aiVariableCostEur: typeof parsed.aiVariableCostEur === "number" ? parsed.aiVariableCostEur : 0,
    };
  } catch {
    return null;
  }
}
