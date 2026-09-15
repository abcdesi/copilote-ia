"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Check, Loader2, SearchCheck, Share2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IMPACT_LABELS, formatEur, formatHours } from "@/lib/format";
import type { DiagnosticResult } from "@/lib/ai/types";

const SUGGESTIONS = [
  "Où puis-je gagner du temps et de la marge ?",
  "Relance mes prospects qui ne répondent plus",
  "Comment améliorer ma trésorerie ?",
  "Que devrais-je automatiser en premier ?",
];

const PLACEHOLDER =
  "Exemple : Je dirige une agence de 8 personnes. Nous utilisons Gmail, HubSpot et Slack. Nous perdons beaucoup de temps à relancer les prospects et les factures…";

type Status = "idle" | "loading" | "done" | "error";

export function DiagnosticExperience() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);

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
      await new Promise((r) => setTimeout(r, 400));
      setResult(data.result);
      setDiagnosticId(data.diagnosticId ?? null);
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
        <div className="rounded-2xl border border-border bg-card p-2 shadow-[0_1px_3px_rgba(23,22,28,0.06)] transition-shadow focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
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
            <span className="text-xs text-muted-foreground">Plus vous donnez de contexte, plus la première lecture est utile.</span>
            <Button type="submit" size="sm" disabled={status === "loading" || input.trim().length < 3}>
              {status === "loading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Obtenir une première lecture <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {status !== "done" && (
        <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestion(suggestion)}
              disabled={status === "loading"}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {status === "loading" && (
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles size={16} className="animate-pulse text-accent" />
            Pilotzia cherche le levier le plus plausible avec les informations disponibles…
          </div>
        </div>
      )}

      {status === "error" && (
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-danger">
          Une erreur est survenue. Réessayez dans un instant.
        </p>
      )}

      {status === "done" && result && <DiagnosticReveal result={result} diagnosticId={diagnosticId} />}
    </div>
  );
}

function DiagnosticReveal({ result, diagnosticId }: { result: DiagnosticResult; diagnosticId: string | null }) {
  const primary = result.opportunities[0];
  const secondary = result.opportunities.slice(1, 3);
  const detectedTools = result.detectedTools.length ? result.detectedTools.join(" · ") : null;
  const [shareStatus, setShareStatus] = useState<"idle" | "loading" | "shared" | "error">("idle");

  async function shareDiagnostic() {
    if (!diagnosticId || shareStatus === "loading") return;
    setShareStatus("loading");
    try {
      const response = await fetch("/api/diagnostic/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ diagnosticId }),
      });
      if (!response.ok) throw new Error("share_failed");
      const data = (await response.json()) as { url: string };
      if (navigator.share) {
        await navigator.share({
          title: "Première lecture Pilotzia",
          text: "Voici une première hypothèse Pilotzia sur un levier d'amélioration opérationnelle.",
          url: data.url,
        });
      } else {
        await navigator.clipboard.writeText(data.url);
      }
      setShareStatus("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareStatus("idle");
        return;
      }
      setShareStatus("error");
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-3xl animate-[fadeIn_0.4s_ease-out]">
      <div className="text-center">
        <p className="text-sm font-medium text-accent">Première hypothèse de travail</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{result.summary}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Cette lecture utilise uniquement ce que vous venez de décrire. Elle ne prétend pas connaître vos volumes, vos marges, votre processus réel ni l'état de vos outils.
        </p>
      </div>

      {primary && (
        <div className="mt-8 rounded-2xl border border-accent/25 bg-card p-6 shadow-[0_1px_3px_rgba(23,22,28,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-accent">
                <Zap size={17} />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">Levier à vérifier en premier</p>
              </div>
              <h3 className="mt-2 text-xl font-semibold">{primary.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{primary.description}</p>
            </div>
            <Badge tone={primary.impactLevel === "high" ? "success" : "accent"}>{IMPACT_LABELS[primary.impactLevel]}</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Temps théorique" value={`~${formatHours(primary.estimatedHoursPerMonth)}/mois`} />
            <Metric label="Valeur indicative" value={`~${formatEur(primary.estimatedValueEur)}/mois`} />
            <Metric label="Niveau de preuve" value="Hypothèse initiale" />
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <SearchCheck size={17} className="text-accent" />
            <p className="font-semibold">Ce que Pilotzia doit vérifier pour devenir précis</p>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            <li className="flex gap-2"><Check size={14} className="mt-1 shrink-0 text-accent" /> Fréquence, volume et temps réellement consacrés à ce processus.</li>
            <li className="flex gap-2"><Check size={14} className="mt-1 shrink-0 text-accent" /> Outils utilisés et données réellement disponibles.</li>
            <li className="flex gap-2"><Check size={14} className="mt-1 shrink-0 text-accent" /> Impact sur chiffre d'affaires, marge, trésorerie ou risque.</li>
            <li className="flex gap-2"><Check size={14} className="mt-1 shrink-0 text-accent" /> Ce qui peut être automatisé sans dégrader la qualité ou le contrôle.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">Contexte détecté pour l'instant</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {detectedTools
              ? `Outils mentionnés : ${detectedTools}. Ils ne sont pas considérés comme connectés tant que vous ne les avez pas autorisés.`
              : "Aucun outil suffisamment clair n'a été détecté. Pilotzia devra d'abord comprendre où vivent les données qui permettent de confirmer cette hypothèse."}
          </p>
          {secondary.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">Autres pistes possibles</p>
              <div className="mt-2 space-y-1.5 text-sm">
                {secondary.map((opportunity) => <p key={opportunity.templateId}>• {opportunity.title}</p>)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-accent/20 bg-accent-soft p-6 text-center">
        <h3 className="text-lg font-semibold">Passez de l'hypothèse à une vraie simulation sur votre entreprise.</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Créez votre espace gratuitement. Pilotzia reprend ce diagnostic, apprend votre contexte, vous pose les questions qui changent réellement la décision et affine les recommandations à mesure que les faits deviennent disponibles.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button href="/signup" size="lg">Faire ma vraie simulation gratuitement <ArrowRight size={18} /></Button>
          {diagnosticId && (
            <Button type="button" size="lg" variant="outline" onClick={shareDiagnostic} disabled={shareStatus === "loading"}>
              {shareStatus === "loading" ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
              {shareStatus === "shared" ? "Lien partagé / copié" : "Partager cette première lecture"}
            </Button>
          )}
        </div>
        {shareStatus === "error" && <p className="mt-2 text-xs text-danger">Impossible de créer le lien pour l'instant.</p>}
        <p className="mt-3 text-xs text-muted-foreground">Sans carte bancaire · 14 jours pour tester l'IA réelle · Votre contexte reste disponible ensuite</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
