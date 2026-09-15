"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Check, Lock, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IMPACT_LABELS, formatHours } from "@/lib/format";
import type { DiagnosticResult } from "@/lib/ai/types";

const SUGGESTIONS = [
  "Relance mes prospects qui ne répondent plus",
  "Accueille mes nouveaux clients automatiquement",
  "Sonde la satisfaction de mes clients",
  "Relance mes factures impayées",
];

const PLACEHOLDER =
  "Exemple : Je dirige une agence de 8 personnes. Nous utilisons Gmail, HubSpot et Slack. Nous perdons beaucoup de temps à relancer les prospects…";

type Status = "idle" | "loading" | "done" | "error";

export function DiagnosticExperience() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  async function submit(text: string) {
    if (text.trim().length < 3 || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      await new Promise((r) => setTimeout(r, 500));
      setResult(data.result);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit(input);
  }

  function handleSuggestion(text: string) {
    setInput(text);
    submit(text);
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-2 shadow-[0_1px_3px_rgba(23,22,28,0.06)] focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent transition-shadow">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={3}
            className="w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-xs text-muted-foreground">Décrivez un problème réel, même en une phrase</span>
            <Button type="submit" size="sm" disabled={status === "loading" || input.trim().length < 3}>
              {status === "loading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Voir ce que Pilotzia ferait <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {status !== "done" && (
        <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSuggestion(s)}
              disabled={status === "loading"}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {status === "loading" && (
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles size={16} className="animate-pulse text-accent" />
            Pilotzia cherche l'action la plus utile pour votre situation…
          </div>
        </div>
      )}

      {status === "error" && (
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-danger">
          Une erreur est survenue. Réessayez dans un instant.
        </p>
      )}

      {status === "done" && result && <DiagnosticReveal result={result} />}
    </div>
  );
}

function DiagnosticReveal({ result }: { result: DiagnosticResult }) {
  const primary = result.opportunities[0];
  const secondary = result.opportunities.slice(1, 3);
  const hasBusinessContext = result.detectedTools.length > 0;

  if (!primary) return null;

  return (
    <div className="mx-auto mt-12 max-w-3xl animate-[fadeIn_0.4s_ease-out]">
      <div className="text-center">
        <p className="text-sm font-medium text-accent">Première lecture de votre besoin</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Voilà ce que Pilotzia regarderait en premier.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Ceci est une estimation rapide à partir de votre phrase. La vraie simulation utilise votre contexte, vos outils et vos volumes réels pour prioriser plus précisément.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-accent/25 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Action prioritaire</p>
            <h3 className="mt-1 text-xl font-semibold">{primary.title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{primary.description}</p>
          </div>
          <Badge tone={primary.impactLevel === "high" ? "success" : "accent"}>{IMPACT_LABELS[primary.impactLevel]}</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Temps potentiellement récupérable</p>
            <p className="mt-1 text-xl font-semibold">~{formatHours(primary.estimatedHoursPerMonth)} / mois</p>
            <p className="mt-1 text-xs text-muted-foreground">Estimation à affiner avec vos volumes réels.</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Valeur mensuelle estimée</p>
            <p className="mt-1 text-xl font-semibold">~{primary.estimatedValueEur} € / mois</p>
            <p className="mt-1 text-xs text-muted-foreground">Une indication, pas une promesse de résultat.</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold">Comment Pilotzia s'y prendrait</p>
          <div className="mt-3 grid gap-2">
            {primary.steps.slice(0, 4).map((step) => (
              <div key={step} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!hasBusinessContext && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">Ce qu'il manque pour passer d'une idée à une vraie décision</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Pilotzia ne connaît pas encore vos outils, vos volumes ni votre façon de travailler. En créant votre espace, vous pourrez ajouter ce contexte et obtenir une recommandation beaucoup plus crédible : quoi faire, dans quel ordre, avec quel gain potentiel et quelles actions préparer.
          </p>
        </div>
      )}

      {secondary.length > 0 && (
        <div className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Ce que Pilotzia vérifierait ensuite</p>
              <p className="mt-1 text-sm text-muted-foreground">Des pistes secondaires, à confirmer avec votre contexte réel.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {secondary.map((opp, index) => (
              <div key={opp.templateId} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
                <div className={index === secondary.length - 1 ? "blur-[2px] opacity-70 select-none" : ""}>
                  <div className="flex items-center gap-2 text-accent">
                    <Zap size={16} />
                    <p className="font-semibold text-foreground">{opp.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{opp.description}</p>
                </div>
                {index === secondary.length - 1 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-card/35">
                    <div className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                      À confirmer dans votre espace
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7 rounded-2xl border border-accent/25 bg-accent-soft p-7 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-card text-accent">
          <Sparkles size={19} />
        </div>
        <h3 className="mt-3 text-xl font-semibold">Passez maintenant de l'estimation à votre vraie simulation.</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Créez votre espace gratuitement, ajoutez le contexte de votre entreprise et voyez ce que Pilotzia recommande réellement pour vous : priorités, potentiel, plan d'action et prochaines automatisations à tester.
        </p>
        <div className="mt-5">
          <Button href="/signup" size="lg">
            Tester Pilotzia gratuitement sur mon entreprise <ArrowRight size={18} />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Sans carte bancaire</span>
          <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> 14 jours pour tester sérieusement</span>
          <span className="inline-flex items-center gap-1.5"><Lock size={13} /> Votre contexte reste disponible après l'essai</span>
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-xs leading-5 text-muted-foreground">
          Vous pouvez rester en découverte gratuite. Si vous voulez connecter davantage de contexte, obtenir des recommandations continues et surtout faire exécuter ou automatiser les actions, les offres payantes prennent naturellement le relais.
        </p>
      </div>
    </div>
  );
}
