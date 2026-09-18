"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { completeOnboardingAction } from "@/lib/onboarding/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils/cn";

const SIZE_OPTIONS = ["1-5", "6-20", "21-50", "51-200", "200+"];
const COUNTRY_OPTIONS = [
  "France métropolitaine",
  "Guadeloupe",
  "Martinique",
  "Guyane",
  "La Réunion",
  "Mayotte",
  "Saint-Martin",
  "Saint-Barthélemy",
  "Saint-Pierre-et-Miquelon",
  "Polynésie française",
  "Nouvelle-Calédonie",
  "Wallis-et-Futuna",
  "Autre",
];

const STEPS = [
  { title: "Votre entreprise", subtitle: "Le minimum utile pour calibrer les premières priorités." },
  { title: "Vos outils", subtitle: "Renseignez ce que vous utilisez déjà. Rien n'est connecté sans votre accord." },
  { title: "Votre priorité", subtitle: "Le problème que Pilotzia doit aider à résoudre en premier." },
];

export function OnboardingWizard({
  prefill,
  userName,
}: {
  prefill: { diagnosticId: string; detectedTools: string[]; rawInput: string } | null;
  userName?: string;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>(prefill?.detectedTools ?? []);
  const [navLocked, setNavLocked] = useState(false);

  const isLast = step === STEPS.length - 1;
  const canAdvance = step === 0 ? name.trim().length > 0 && country.length > 0 : true;

  function lockNav() {
    setNavLocked(true);
    setTimeout(() => setNavLocked(false), 400);
  }

  function goNext() {
    if (navLocked) return;
    lockNav();
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  }

  function goBack() {
    if (navLocked) return;
    lockNav();
    setStep((value) => Math.max(0, value - 1));
  }

  function toggleTool(tool: string) {
    setSelectedTools((previous) => previous.includes(tool) ? previous.filter((item) => item !== tool) : [...previous, tool]);
  }

  const welcomeName = userName ? userName.split(" ")[0] : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <p className="text-sm text-muted-foreground">
            {welcomeName ? "Bienvenue " + welcomeName + " — " : "Bienvenue — "}
            3 étapes pour donner à {APP_NAME} assez de contexte pour être utile immédiatement.
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={cn("h-1.5 w-12 rounded-full transition-colors", index <= step ? "bg-accent" : "bg-muted")}
              />
            ))}
          </div>
        </div>

        <form
          action={completeOnboardingAction}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            const tag = (event.target as HTMLElement).tagName;
            if (tag === "TEXTAREA") return;
            if (!isLast) {
              event.preventDefault();
              if (canAdvance) goNext();
            }
          }}
          className="rounded-2xl border border-border bg-card p-7 shadow-[0_1px_3px_rgba(23,22,28,0.06)]"
        >
          {prefill && <input type="hidden" name="diagnosticId" value={prefill.diagnosticId} />}

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Étape {step + 1} / {STEPS.length}</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">{STEPS[step].title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{STEPS[step].subtitle}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div hidden={step !== 0} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom de l'entreprise</Label>
                <Input id="name" name="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nova Studio" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry">Activité</Label>
                <Input id="industry" name="industry" placeholder="Agence marketing, e-commerce, conseil…" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="country">Territoire principal</Label>
                  <select
                    id="country"
                    name="country"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    required
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option value="" disabled>Sélectionner votre territoire</option>
                    {COUNTRY_OPTIONS.map((country) => <option key={country} value={country}>{country}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employeeCount">Effectif</Label>
                  <Input id="employeeCount" name="employeeCount" type="number" min={1} placeholder="Ex. 18" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Taille de l'équipe</Label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((size, index) => (
                    <label key={size} className="cursor-pointer">
                      <input type="radio" name="sizeRange" value={size} className="peer sr-only" />
                      <span className="inline-block rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent">
                        {size}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Si vous renseignez l'effectif exact, Pilotzia déduit automatiquement la tranche correspondante pour éviter toute incohérence.
                </p>
              </div>
            </div>

            <div hidden={step !== 1} className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {KNOWN_TOOLS.map((tool) => {
                  const checked = selectedTools.includes(tool);
                  return (
                    <button
                      type="button"
                      key={tool}
                      onClick={() => toggleTool(tool)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        checked ? "border-accent bg-accent-soft text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                      )}
                    >
                      {tool}
                    </button>
                  );
                })}
              </div>
              {selectedTools.map((tool) => <input key={tool} type="hidden" name="tools" value={tool} />)}
              <p className="text-xs leading-5 text-muted-foreground">
                Cette étape indique seulement les outils utilisés. Une vraie connexion API demandera toujours une autorisation séparée.
              </p>
            </div>

            <div hidden={step !== 2} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="painPoints">Qu'est-ce qui mérite d'être réglé en premier ?</Label>
                <Textarea
                  id="painPoints"
                  name="painPoints"
                  rows={4}
                  defaultValue={prefill?.rawInput ?? ""}
                  placeholder="Ex : nous perdons des prospects faute de relance, je manque de visibilité sur ma marge…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="objectives">Résultat recherché</Label>
                <Textarea id="objectives" name="objectives" rows={2} placeholder="Ex : obtenir plus de rendez-vous sans ajouter de charge manuelle." />
              </div>
              <div className="rounded-xl bg-accent-soft p-3 text-xs leading-5 text-foreground/80">
                À l'étape suivante, Pilotzia construit vos premières priorités à partir de ce contexte. Les estimations restent identifiées comme telles tant qu'un résultat réel n'est pas mesuré.
              </div>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={goBack} disabled={navLocked} className={step === 0 ? "invisible" : ""}>
              <ArrowLeft size={16} /> Retour
            </Button>

            {isLast ? (
              <SubmitButton navLocked={navLocked} />
            ) : (
              <Button type="button" disabled={!canAdvance || navLocked} onClick={goNext}>
                Continuer <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ navLocked }: { navLocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || navLocked}>
      {pending ? <Loader2 size={16} className="animate-spin" /> : "Obtenir mes premières priorités"}
    </Button>
  );
}
