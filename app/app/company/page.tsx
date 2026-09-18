import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, Database, Route, Sparkles, Target } from "lucide-react";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { getCompanyKnowledgeCoverage, type KnowledgeGuidanceStep } from "@/lib/companies/knowledge-coverage";
import { buildCompanyProfileSummary } from "@/lib/companies/profile-summary";
import { updateCompanyAction } from "@/lib/companies/actions";
import { RadarChart } from "@/components/knowledge/RadarChart";
import { CompanyProfileSummary } from "@/components/knowledge/CompanyProfileSummary";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const SIZE_OPTIONS = ["1-5", "6-20", "21-50", "51-200", "200+"];

export default async function CompanyPage() {
  const access = await getCurrentCompanyAccess();
  const company = access.company;
  const canEditCompany = hasCompanyPermission(access.role, "edit_company");
  const coverage = await getCompanyKnowledgeCoverage(company.id);
  const profileSummary = buildCompanyProfileSummary(company);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Contexte de l'entreprise</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Mon entreprise</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Plus Pilotzia comprend votre activité, vos chiffres, vos équipes et vos processus, plus ses recommandations
            peuvent devenir précises, personnalisées et fondées sur votre réalité.
          </p>
        </div>
        {coverage.guidanceSteps[0] && (
          <Button href={coverage.guidanceSteps[0].href} size="sm">
            Faire la prochaine étape
          </Button>
        )}
      </div>

      <section className="grid gap-5 rounded-2xl border border-accent/20 bg-accent-soft p-5 lg:grid-cols-[0.85fr_1.35fr] lg:p-6">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-card/70 p-4 text-center">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-accent" />
            <h2 className="font-semibold">Niveau de connaissance</h2>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-semibold tracking-tight">{coverage.overall}%</span>
            <Badge tone="accent">{coverage.level}</Badge>
          </div>
          <RadarChart items={coverage.radar} size={330} />
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            Ce score mesure la couverture des informations disponibles, pas la performance de votre entreprise.
          </p>
        </div>

        <div>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-accent">
              <Target size={18} />
            </div>
            <div>
              <h2 className="font-semibold">La précision du conseil progresse avec vos données</h2>
              <p className="mt-1 text-sm leading-6 text-foreground/75">{coverage.message}</p>
            </div>
          </div>

          {coverage.nextMilestone && (
            <div className="mt-4 rounded-xl border border-accent/20 bg-card/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Prochain palier</p>
                  <p className="mt-1 font-semibold">{coverage.nextMilestone.label} · {coverage.nextMilestone.score}%</p>
                </div>
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                  encore {coverage.nextMilestone.remaining} pts
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (coverage.overall / coverage.nextMilestone.score) * 100)}%` }} />
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {coverage.sections.map((section) => (
              <CoverageRow key={section.key} section={section} />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Route size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Parcours recommandé</p>
              <h2 className="mt-1 text-lg font-semibold">Les prochaines étapes pour rendre Pilotzia plus précis</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Pilotzia ne vous demande pas de tout remplir. Il classe les prochaines étapes selon le manque actuel,
                leur poids dans le score et leur pertinence par rapport aux objectifs et blocages que vous avez déjà déclarés.
              </p>
            </div>
          </div>
          {coverage.guidanceSteps[0] && (
            <Button href={coverage.guidanceSteps[0].href} size="sm">
              Commencer par {coverage.guidanceSteps[0].label.toLowerCase()}
            </Button>
          )}
        </div>

        {coverage.guidanceSteps.length > 0 ? (
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {coverage.guidanceSteps.map((step, index) => (
              <GuidanceStepCard key={step.sectionKey} step={step} index={index} />
            ))}
          </div>
        ) : (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-success/20 bg-success-soft p-4">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
            <div>
              <p className="font-medium">Votre profil est déjà très bien renseigné</p>
              <p className="mt-1 text-sm text-muted-foreground">
                La prochaine progression viendra surtout de sources connectées, de données récentes et de résultats mesurés dans le temps.
              </p>
            </div>
          </div>
        )}
      </section>

      <CompanyProfileSummary items={profileSummary} sections={coverage.sections} updatedAt={company.updatedAt} />

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <Database size={18} />
          </div>
          <div>
            <h2 className="font-semibold">Comment le pourcentage est calculé</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Pilotzia compte les informations réellement renseignées, la profondeur du contexte, les outils déclarés,
              les connexions actives et les faits structurés disponibles. Une case vide n'est jamais considérée comme connue.
            </p>
          </div>
        </div>
      </div>

      {!canEditCompany && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Votre rôle <strong className="text-foreground">{access.role}</strong> permet de consulter le contexte, mais pas de le modifier. Un Propriétaire ou Administrateur peut mettre ces informations à jour.
        </div>
      )}

      <form action={updateCompanyAction} className="space-y-6">
        <fieldset disabled={!canEditCompany} className="contents">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Fondations</p>
            <h2 className="mt-1 text-lg font-semibold">Ce que Pilotzia doit savoir pour comprendre votre entreprise</h2>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom de l'entreprise</Label>
              <Input id="name" name="name" defaultValue={company.name} required />
            </div>

            <div id="activity" className="grid gap-4 scroll-mt-24 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="industry">Activité / secteur</Label>
                <Input id="industry" name="industry" defaultValue={company.industry ?? ""} placeholder="Agence marketing, cabinet de conseil, e-commerce…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="businessModel">Modèle économique</Label>
                <Input id="businessModel" name="businessModel" defaultValue={company.businessModel ?? ""} placeholder="Abonnement, prestations, marge sur vente, commission…" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customerProfile">Clients principaux</Label>
              <Textarea
                id="customerProfile"
                name="customerProfile"
                rows={3}
                defaultValue={company.customerProfile ?? ""}
                placeholder="Ex. PME de 10 à 50 salariés, décisionnaire dirigeant, panier moyen, cycle d'achat…"
              />
            </div>

            <div id="team" className="grid gap-4 scroll-mt-24 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sizeRange">Taille de l'équipe</Label>
                <select
                  id="sizeRange"
                  name="sizeRange"
                  defaultValue={company.sizeRange ?? ""}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">Non renseigné</option>
                  {SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size} employés</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="employeeCount">Nombre d'employés</Label>
                <Input id="employeeCount" name="employeeCount" type="number" min={1} defaultValue={company.employeeCount ?? ""} placeholder="Ex. 18" />
              </div>
            </div>

            <div id="local" className="grid gap-4 scroll-mt-24 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="country">Pays / zone principale</Label>
                <Input id="country" name="country" defaultValue={company.country ?? ""} placeholder="Ex. France, Martinique, Belgique…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timezone">Fuseau horaire opérationnel</Label>
                <Input id="timezone" name="timezone" defaultValue={company.timezone ?? ""} placeholder="Ex. America/Martinique" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Pilotzia le détecte automatiquement une seule fois au premier accès d'un administrateur. Vous pouvez le corriger ici.
                  Les automatisations planifiées commencent à partir de 10:00 heure locale par défaut, du lundi au samedi.
                </p>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="localContext">Contexte local utile</Label>
                <Input id="localContext" name="localContext" defaultValue={company.localContext ?? ""} placeholder="Marché local, saisonnalité, réglementation, langue…" />
              </div>
            </div>

            <div id="objectives" className="space-y-1.5 scroll-mt-24">
              <Label htmlFor="objectives">Objectifs prioritaires</Label>
              <Textarea
                id="objectives"
                name="objectives"
                rows={4}
                defaultValue={company.objectives ?? ""}
                placeholder="Ex. réduire de 20 % le temps administratif, raccourcir le cycle de vente, améliorer la marge…"
              />
              <p className="text-xs text-muted-foreground">Précisez idéalement l'horizon et l'indicateur que vous voulez améliorer.</p>
            </div>

            <div id="painPoints" className="space-y-1.5 scroll-mt-24">
              <Label htmlFor="painPoints">Pertes de temps, blocages et irritants</Label>
              <Textarea
                id="painPoints"
                name="painPoints"
                rows={4}
                defaultValue={company.painPoints ?? ""}
                placeholder="Ex. relances oubliées, reporting manuel 5 h/semaine, devis trop lents, factures impayées…"
              />
              <p className="text-xs text-muted-foreground">Le volume, la fréquence et l'impact rendent la priorisation beaucoup plus fiable.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Domaines métier</p>
            <h2 className="mt-1 text-lg font-semibold">Donnez au copilote la profondeur d'un vrai comité de direction</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Renseignez seulement ce que vous connaissez. Pilotzia distingue vos déclarations des données réellement connectées.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <DomainField
              id="finance"
              name="financeContext"
              label="Finance"
              value={company.financeContext}
              placeholder="CA, marge, trésorerie, créances, dettes, saisonnalité, principaux coûts, objectifs financiers…"
            />
            <DomainField
              id="accounting"
              name="accountingContext"
              label="Comptabilité"
              value={company.accountingContext}
              placeholder="Outil comptable, facturation, clôture, rapprochements, relances, fréquence de reporting…"
            />
            <DomainField
              id="sales"
              name="salesContext"
              label="Commercial"
              value={company.salesContext}
              placeholder="Nombre de leads, pipeline, taux de réponse, devis, cycle de vente, relances, CRM…"
            />
            <DomainField
              id="marketing"
              name="marketingContext"
              label="Marketing"
              value={company.marketingContext}
              placeholder="Canaux, budget, acquisition, coût par lead, campagnes, contenu, conversion, attribution…"
            />
            <DomainField
              id="hr"
              name="hrContext"
              label="RH"
              value={company.hrContext}
              placeholder="Organisation, recrutements, onboarding, charge, rôles, processus RH et indicateurs agrégés…"
              hint="Évitez les données personnelles ou sensibles sur des salariés ; privilégiez les processus et métriques agrégées."
            />
            <DomainField
              id="operations"
              name="operationsContext"
              label="Opérations"
              value={company.operationsContext}
              placeholder="Processus clés, production, support, réunions, délais, volumes, contrôles, points de blocage…"
            />
          </div>
        </section>

        </fieldset>

        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-accent/20 bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="shrink-0 text-accent" />
            <p className="text-sm text-muted-foreground">
              Chaque information utile enregistrée enrichit le contexte du copilote et le Business Graph.
            </p>
          </div>
          <Button type="submit" disabled={!canEditCompany}>{canEditCompany ? "Enregistrer et améliorer mes recommandations" : "Modification réservée aux administrateurs"}</Button>
        </div>
      </form>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Applications et sources de données</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {company.tools.length ? company.tools.map((tool) => tool.name).join(" · ") : "Aucune application renseignée pour l'instant."}
            </p>
          </div>
          <Button href="/app/tools" variant="outline" size="sm">Gérer mes connexions</Button>
        </div>
      </section>
    </div>
  );
}

function GuidanceStepCard({ step, index }: { step: KnowledgeGuidanceStep; index: number }) {
  return (
    <Link href={step.href} className="group rounded-2xl border border-border p-4 transition hover:border-accent/40 hover:bg-accent-soft/30">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{step.title}</p>
              {step.priority === "haute" && <Badge tone="accent">prioritaire</Badge>}
            </div>
            <span className="text-xs font-semibold tabular-nums text-accent">{step.currentScore}%</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground/80">{step.action}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Pourquoi : {step.why}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent">
            Compléter cette étape <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function CoverageRow({ section }: { section: { label: string; score: number; description: string; href: string } }) {
  return (
    <Link href={section.href} className="rounded-xl border border-border/70 bg-card/80 p-3 transition hover:border-accent/40">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{section.label}</span>
        <span className="text-sm font-semibold tabular-nums">{section.score}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${section.score}%` }} />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{section.description}</p>
    </Link>
  );
}

function DomainField({
  id,
  name,
  label,
  value,
  placeholder,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  value: string | null;
  placeholder: string;
  hint?: string;
}) {
  return (
    <div id={id} className="space-y-1.5 scroll-mt-24">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} rows={5} defaultValue={value ?? ""} placeholder={placeholder} />
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}
