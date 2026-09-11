import { getCurrentCompany } from "@/lib/companies/current";
import { updateCompanyAction } from "@/lib/companies/actions";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const SIZE_OPTIONS = ["1-5", "6-20", "21-50", "51-200", "200+"];
const COUNTRY_OPTIONS = ["France", "Belgique", "Suisse", "Canada", "Autre"];

export default async function CompanyPage() {
  const company = await getCurrentCompany();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon entreprise</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ces informations aident votre copilote à affiner ses recommandations.</p>
      </div>

      <form action={updateCompanyAction} className="rounded-2xl border border-border bg-card p-6 space-y-5">
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
                <option key={c} value={c}>
                  {c}
                </option>
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
                <option key={s} value={s}>
                  {s} employés
                </option>
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
          <Textarea id="painPoints" name="painPoints" rows={3} defaultValue={company.painPoints ?? ""} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="objectives">Objectifs</Label>
          <Textarea id="objectives" name="objectives" rows={3} defaultValue={company.objectives ?? ""} />
        </div>

        <Button type="submit">Enregistrer les modifications</Button>
      </form>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Outils connectés</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {company.tools.length ? company.tools.map((t) => t.name).join(" · ") : "Aucun outil renseigné pour l'instant."}
        </p>
        <Button href="/app/tools" variant="outline" size="sm" className="mt-4">
          Gérer mes outils
        </Button>
      </div>
    </div>
  );
}
