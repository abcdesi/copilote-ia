import { AlertTriangle, CheckCircle2, Database, Fingerprint, Network, RefreshCw, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { getBusinessGraphContext } from "@/lib/business-graph";
import { getEntityResolutionSummary } from "@/lib/business-graph/entity-resolution";
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
  const company = await getCurrentCompany();
  const [graph, resolution] = await Promise.all([
    getBusinessGraphContext(company.id),
    getEntityResolutionSummary(company.id),
  ]);
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
        <form action={rebuildBusinessGraphAction}>
          <Button type="submit" variant="outline" size="sm">
            <RefreshCw size={14} /> Actualiser le contexte
          </Button>
        </form>
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Entités comprises" value={String(graph.summary.entityCount)} icon={Database} />
            <Metric label="Faits traçables" value={String(graph.summary.factCount)} icon={Sparkles} />
            <Metric label="Identités résolues" value={String(resolution.identityCount)} icon={Fingerprint} />
            <Metric label="Personnes canoniques" value={String(resolution.personEntityCount)} icon={Users} />
            <Metric label="Entités multi-sources" value={String(resolution.multiProviderEntityCount)} icon={Network} />
            <Metric label="Sources fraîches" value={String(graph.summary.freshSourceCount)} icon={CheckCircle2} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Fingerprint size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Résolution d'identité</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pilotzia rapproche progressivement les enregistrements qui désignent la même personne sans fusionner sur un simple nom.
                </p>
              </div>
              <Badge tone={resolution.multiProviderEntityCount > 0 ? "success" : "neutral"}>
                {resolution.multiProviderEntityCount} rapprochement{resolution.multiProviderEntityCount > 1 ? "s" : ""} multi-sources
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted p-4">
                <p className="text-2xl font-semibold">{resolution.identityCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">identifiants source reliés</p>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <p className="text-2xl font-semibold">{resolution.multiIdentityEntityCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">entités avec plusieurs identifiants</p>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <p className="text-2xl font-semibold">{resolution.providerCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">fournisseurs contribuant aux identités</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Fusion automatique uniquement sur des identifiants déterministes normalisés, comme une adresse email identique. Les valeurs sensibles ne sont pas recopiées dans le graphe : Pilotzia conserve une empreinte cryptographique et un indice masqué avec la provenance.
            </p>
          </div>
        </div>
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
              Aucune source externe connectée. Les données actuelles proviennent uniquement de la mémoire interne Pilotzia.
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
          <p className="mt-1 text-sm text-muted-foreground">Les entités sont canoniques : plusieurs sources peuvent converger vers le même objet sans perdre leur provenance.</p>
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
                  <span className="capitalize">{fact.sourceProvider}</span>
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
            ["2. Structurer", "Entités, identités, relations et provenance"],
            ["3. Comprendre", "Contexte cohérent, résolu et actualisé"],
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
