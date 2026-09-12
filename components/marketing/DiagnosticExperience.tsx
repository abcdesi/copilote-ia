"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Lock, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
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
      await new Promise((r) => setTimeout(r, 500)); // laisse le temps de percevoir l'analyse
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
            <span className="text-xs text-muted-foreground">Entrée pour envoyer</span>
            <Button type="submit" size="sm" disabled={status === "loading" || input.trim().length < 3}>
              {status === "loading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Analyser gratuitement <ArrowRight size={16} />
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
            Analyse de votre entreprise en cours…
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
  const visible = result.opportunities.slice(0, 2);
  const locked = result.opportunities.slice(2);

  return (
    <div className="mx-auto mt-12 max-w-3xl animate-[fadeIn_0.4s_ease-out]">
      <div className="text-center">
        <p className="text-sm font-medium text-accent">Votre première analyse</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{result.summary}</h2>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-[auto_1fr] items-center rounded-2xl border border-border bg-card p-6">
        <ScoreGauge score={result.automationScore} />
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Automation Score</p>
            <p className="text-lg font-semibold">{result.automationScore} / 100</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Potentiel identifié</p>
            <p className="text-lg font-semibold">~{formatHours(result.potentialHoursPerMonth)} / mois</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Outils détectés</p>
            <p className="text-sm font-medium mt-1">
              {result.detectedTools.length ? result.detectedTools.join(" · ") : "Aucun outil identifié pour l'instant"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {visible.map((opp) => (
          <div key={opp.templateId} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-accent">
              <Zap size={16} />
              <p className="font-semibold text-foreground">{opp.title}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{opp.description}</p>
            <div className="mt-4 flex items-center gap-2">
              <Badge tone="accent">Potentiel ~{formatHours(opp.estimatedHoursPerMonth)}/mois</Badge>
              <Badge tone={opp.impactLevel === "high" ? "success" : "neutral"}>{IMPACT_LABELS[opp.impactLevel]}</Badge>
            </div>
          </div>
        ))}
        {locked.map((opp) => (
          <div key={opp.templateId} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
            <div className="blur-[3px] select-none pointer-events-none opacity-70">
              <div className="flex items-center gap-2 text-accent">
                <Zap size={16} />
                <p className="font-semibold text-foreground">{opp.title}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{opp.description}</p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-card/40">
              <Lock size={18} className="text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-accent/20 bg-accent-soft p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-card text-accent">
          <Lock size={18} />
        </div>
        <h3 className="mt-3 text-lg font-semibold">Votre analyse complète est prête.</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez votre espace gratuitement pour découvrir toutes vos opportunités, votre score détaillé, les
          automatisations recommandées et votre plan d'automatisation personnalisé.
        </p>
        <div className="mt-5">
          <Button href="/signup" size="lg">
            Créer mon espace gratuitement <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
