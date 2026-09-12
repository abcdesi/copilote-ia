import { Brain, CheckCircle2, CircleDashed, Target } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { updateCompanyAction } from "@/lib/companies/actions";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const SIZE_OPTIONS = ["1-5", "6-20", "21-50", "51-200", "200+"];
const COUNTRY_OPTIONS = ["France", "Belgique", "Suisse", "Canada", "Autre"];

export default async function CompanyPage() {
  const company = await getCurrentCompany();
  const memorySignals = [
    Boolean(company.industry),
    Boolean(company.country),
    Boolean(company.sizeRange),
    Boolean(company.objectives),
    Boolean(company.painPoints),
    company.tools.length > 0,
  ];
  const completedSignals = memorySignals.filter(Boolean).length;
  const memoryScore = Math.round((completedSignals / memorySignals.length) * 100);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Mémoire de l'entreprise</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Mon entreprise</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Ce profil donne au copilote le contexte durable dont il a besoin pour mieux prioriser ses recommandations et
          éviter de vous reposer les mêmes questions.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-accent">
              <Brain size={19} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">Ce que Pilotzia connaît déjà</h2>
                <Badge tone="accent">{memoryScore}% complet</Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-foreground/75">
                Secteur, taille, objectifs, pertes de temps et applications alimentent directement le contexte du copilote.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <MemorySignal label="Activité" ready={Boolean(company.industry)} />
            <MemorySignal label="Taille de l'équipe" ready={Boolean(company.sizeRange)} />
            <MemorySignal label="Objectifs" ready={Boolean(company.objectives)} />
            <MemorySignal label="Pertes de temps" ready={Boolean(company.painPoints)} />
            <MemorySignal label="Applications utilisées" ready={company.tools.length > 0} />
            <MemorySignal label="Pays / contexte local" ready={Boolean(company.country)} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
            <Target size={18} />
          </div>
          <h2 className="mt-4 font-semibold">Pourquoi c'est utile</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Plus le contexte est précis, plus Pilotzia peut distinguer une bonne idée générique d'une priorité réellement adaptée à votre entreprise.
          </p>
        </div>
      </section>

      <form action={updateCompanyAction} className="space-y-5 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom de l'entreprise</Label>
          <Input id="name" name="name" defaultValue={company.name} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="industry">Activité</Label>
          <Input id="industry" name="industry" defaultValue={company.industry ?? ""} placeholder="Agence marketing, e-commerce…" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="country">Pays</Label>
            <select
              id="country"
              name="country"
              defaultValue={company.country ?? "France"}
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sizeRange">Taille</Label>
            <select
              id="sizeRange"
              name="sizeRange"
              defaultValue={company.sizeRange ?? "6-20"}
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            >
              {SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s} employés</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="employeeCount">Nombre d'employés (optionnel)</Label>
          <Input id="employeeCount" name="employeeCount" type="number" min={1} defaultValue={company.employeeCount ?? ""} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="painPoints">Principales pertes de temps</Label>
          <Textarea
            id="painPoints"
            name="painPoints"
            rows={4}
            defaultValue={company.painPoints ?? ""}
            placeholder="Ex. relances prospects, tri des demandes clients, reporting hebdomadaire…"
          />
          <p className="text-xs text-muted-foreground">Décrivez les tâches répétitives, les blocages et les points de friction récurrents.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="objectives">Objectifs</Label>
          <Textarea
            id="objectives"
            name="objectives"
            rows={4}
            defaultValue={company.objectives ?? ""}
            placeholder="Ex. réduire le temps administratif, augmenter le taux de relance, améliorer le délai de réponse…"
          />
          <p className="text-xs text-muted-foreground">Ces objectifs servent à arbitrer entre plusieurs opportunités possibles.</p>
        </div>

        <Button type="submit">Mettre à jour la mémoire</Button>
      </form>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Applications connues</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {company.tools.length ? company.tools.map((t) => t.name).join(" · ") : "Aucune application renseignée pour l'instant."}
            </p>
          </div>
          <Button href="/app/tools" variant="outline" size="sm">Gérer</Button>
        </div>
      </div>
    </div>
  );
}

function MemorySignal({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-card/80 px-3 py-2 text-sm">
      {ready ? <CheckCircle2 size={15} className="shrink-0 text-success" /> : <CircleDashed size={15} className="shrink-0 text-muted-foreground" />}
      <span className={ready ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
