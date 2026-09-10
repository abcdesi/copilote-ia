"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { completeOnboardingAction } from "@/lib/onboarding/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils/cn";

const SIZE_OPTIONS = ["1-5", "6-20", "21-50", "51-200", "200+"];
const COUNTRY_OPTIONS = ["France", "Belgique", "Suisse", "Canada", "Autre"];

const STEPS = [
  { title: "Votre entreprise", subtitle: "Quelques informations pour personnaliser votre cockpit." },
  { title: "Sa taille", subtitle: "Cela nous aide à calibrer nos recommandations." },
  { title: "Vos outils", subtitle: "Sélectionnez ceux que vous utilisez déjà." },
  { title: "Vos priorités", subtitle: "Qu'est-ce qui vous fait perdre le plus de temps ?" },
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
  const [selectedTools, setSelectedTools] = useState<string[]>(prefill?.detectedTools ?? []);

  const isLast = step === STEPS.length - 1;
  const canAdvance = step === 0 ? name.trim().length > 0 : true;

  function toggleTool(tool: string) {
    setSelectedTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]));
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <p className="text-sm text-muted-foreground">
            {userName ? `Bienvenue ${userName.split(" ")[0]} —` : "Bienvenue —"} configurons {APP_NAME} pour votre
            entreprise
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn("h-1.5 w-10 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-muted")}
              />
            ))}
          </div>
        </div>

        <form action={completeOnboardingAction} className="rounded-2xl border border-border bg-card p-7 shadow-[0_1px_3px_rgba(23,22,28,0.06)]">
          {prefill && <input type="hidden" name="diagnosticId" value={prefill.diagnosticId} />}

          <h1 className="text-xl font-semibold tracking-tight">{STEPS[step].title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{STEPS[step].subtitle}</p>

          <div className="mt-6 space-y-4">
            {/* Étape 0 — Entreprise */}
            <div hidden={step !== 0} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom de l'entreprise</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nova Studio"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry">Activité</Label>
                <Input id="industry" name="industry" placeholder="Agence marketing, e-commerce, conseil…" />
              </div>
            </div>

            {/* Étape 1 — Taille */}
            <div hidden={step !== 1} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="country">Pays</Label>
                <select
                  id="country"
                  name="country"
                  defaultValue="France"
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
                <Label>Taille de l'équipe</Label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((s, i) => (
                    <label key={s} className="cursor-pointer">
                      <input type="radio" name="sizeRange" value={s} defaultChecked={i === 1} className="peer sr-only" />
                      <span className="inline-block rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent transition-colors">
                        {s}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="employeeCount">Nombre d'employés (optionnel)</Label>
                <Input id="employeeCount" name="employeeCount" type="number" min={1} placeholder="8" />
              </div>
            </div>

            {/* Étape 2 — Outils */}
            <div hidden={step !== 2} className="space-y-3">
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
                        checked
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border text-muted-foreground hover:border-accent/40"
                      )}
                    >
                      {tool}
                    </button>
                  );
                })}
              </div>
              {selectedTools.map((tool) => (
                <input key={tool} type="hidden" name="tools" value={tool} />
              ))}
            </div>

            {/* Étape 3 — Priorités */}
            <div hidden={step !== 3} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="painPoints">Vos principales pertes de temps</Label>
                <Textarea
                  id="painPoints"
                  name="painPoints"
                  rows={3}
                  defaultValue={prefill?.rawInput ?? ""}
                  placeholder="Ex : relancer les prospects, rédiger les comptes-rendus…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="objectives">Vos objectifs pour les prochains mois</Label>
                <Textarea id="objectives" name="objectives" rows={2} placeholder="Ex : gagner du temps, mieux suivre mes prospects…" />
              </div>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className={step === 0 ? "invisible" : ""}
            >
              <ArrowLeft size={16} /> Retour
            </Button>

            {isLast ? (
              <Button type="submit">Découvrir mon plan d'automatisation</Button>
            ) : (
              <Button type="button" disabled={!canAdvance} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Continuer <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
