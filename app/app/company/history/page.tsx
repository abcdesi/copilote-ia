import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, History } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { getCompanyContextHistoryPage } from "@/lib/companies/history";

const SECTION_LABELS: Record<string, string> = {
  activity: "Activité",
  team: "Équipe",
  objectives: "Objectifs",
  painPoints: "Problématiques",
  applications: "Applications",
  local: "Contexte local",
  finance: "Finance",
  accounting: "Comptabilité",
  sales: "Commercial",
  marketing: "Marketing",
  hr: "RH",
  operations: "Opérations",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nom de l'entreprise",
  industry: "Activité / secteur",
  country: "Pays / zone",
  sizeRange: "Taille de l'équipe",
  employeeCount: "Effectif",
  objectives: "Objectifs prioritaires",
  painPoints: "Blocages / irritants",
  businessModel: "Modèle économique",
  customerProfile: "Clients principaux",
  localContext: "Contexte local",
  financeContext: "Contexte finance",
  accountingContext: "Contexte comptable",
  salesContext: "Contexte commercial",
  marketingContext: "Contexte marketing",
  hrContext: "Contexte RH",
  operationsContext: "Contexte opérations",
  tool: "Application / outil",
};

function displayValue(value: unknown) {
  if (value == null || value === "") return "Non renseigné";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 600 ? `${text.slice(0, 599)}…` : text;
}

export default async function CompanyHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const company = await getCurrentCompany();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const history = await getCompanyContextHistoryPage(company.id, page, 40);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/app/company" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          <ArrowLeft size={15} /> Mon entreprise
        </Link>
        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <History size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Historique de l'entreprise</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Pilotzia conserve les évolutions du contexte pour comprendre ce qui a changé dans le temps. L'état actuel reste prioritaire ; l'historique n'est mobilisé que lorsqu'il aide à expliquer une évolution ou à améliorer une décision.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{history.total} modification{history.total > 1 ? "s" : ""} conservée{history.total > 1 ? "s" : ""}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ancienne valeur, nouvelle valeur, rubrique, source et date sont conservées tant que l'entreprise existe dans Pilotzia.</p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Page {history.page}/{history.pageCount}</span>
        </div>
      </div>

      {history.items.length ? (
        <div className="space-y-3">
          {history.items.map((revision) => (
            <article key={revision.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                    {SECTION_LABELS[revision.section] ?? revision.section}
                  </p>
                  <h2 className="mt-1 font-semibold">{FIELD_LABELS[revision.field] ?? revision.field}</h2>
                </div>
                <time className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(revision.effectiveAt))}
                </time>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Avant</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground/75">{displayValue(revision.previous)}</p>
                </div>
                <div className="rounded-xl border border-accent/15 bg-accent-soft/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">Après</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground/85">{displayValue(revision.next)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          L'historique commencera à se remplir lors de vos prochaines modifications de « Mon entreprise » ou de vos outils déclarés.
        </div>
      )}

      {history.pageCount > 1 && (
        <div className="flex items-center justify-between">
          {history.page > 1 ? (
            <Link href={`/app/company/history?page=${history.page - 1}`} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium">
              <ChevronLeft size={15} /> Précédent
            </Link>
          ) : <span />}
          {history.page < history.pageCount && (
            <Link href={`/app/company/history?page=${history.page + 1}`} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium">
              Suivant <ChevronRight size={15} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}