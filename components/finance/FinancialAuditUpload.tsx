"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Loader2, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Ratio {
  key: string;
  label: string;
  value: number;
  unit: "percent" | "days" | "ratio";
  interpretation: string;
}

interface Priority {
  key: string;
  title: string;
  rationale: string;
  businessImpact: "cash" | "margin" | "growth" | "risk" | "productivity";
  priority: "high" | "medium" | "low";
  automationTemplateId?: string;
  nextEvidence: string;
}

interface AuditResponse {
  extraction: {
    statement: Record<string, number | string | null | undefined>;
    documentType: string;
    extractionConfidence: number;
    warnings: string[];
  };
  audit: {
    periodLabel: string;
    ratios: Ratio[];
    alerts: string[];
    questions: string[];
    missingData: string[];
  };
  priorities: Priority[];
  privacy: { rawPdfStored: boolean; note: string };
}

function ratioValue(ratio: Ratio) {
  if (ratio.unit === "percent") return `${ratio.value.toFixed(1)} %`;
  if (ratio.unit === "days") return `${Math.round(ratio.value)} j`;
  return ratio.value.toFixed(2);
}

export function FinancialAuditUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResponse | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || status === "loading") return;
    setStatus("loading");
    setError("");
    setResult(null);

    const body = new FormData();
    body.set("file", file);

    try {
      const response = await fetch("/api/finance/analyze", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Analyse impossible.");
      setResult(data as AuditResponse);
      setStatus("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analyse impossible.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><FileText size={19} /></div>
          <div>
            <h2 className="font-semibold">Importer un bilan ou un compte de résultat</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              PDF uniquement, 8 Mo maximum. Pilotzia extrait les postes visibles, calcule des ratios, signale les données manquantes et transforme les signaux en questions et priorités opérationnelles.
            </p>
          </div>
        </div>

        <label className="mt-5 block cursor-pointer rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center transition-colors hover:border-accent/40">
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setStatus("idle");
              setError("");
              setResult(null);
            }}
          />
          <p className="text-sm font-medium">{file ? file.name : "Choisir un document PDF"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Le document brut n'est pas enregistré par cette fonctionnalité.</p>
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Une analyse consomme 15 crédits d'usage intelligent.</p>
          <Button type="submit" disabled={!file || status === "loading"}>
            {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {status === "loading" ? "Analyse en cours…" : "Lancer l'audit"}
          </Button>
        </div>
        {status === "error" && <p className="mt-3 text-sm text-danger">{error}</p>}
      </form>

      {status === "done" && result && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Lecture du document</p>
                <h2 className="mt-1 text-xl font-semibold">{result.audit.periodLabel}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confiance d'extraction : {Math.round(result.extraction.extractionConfidence * 100)} % · {result.audit.ratios.length} ratio{result.audit.ratios.length > 1 ? "s" : ""} exploitable{result.audit.ratios.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-card px-3 py-1.5 text-xs font-medium text-accent">
                <ShieldCheck size={13} /> PDF non conservé
              </div>
            </div>
            {(result.extraction.warnings.length > 0 || result.audit.missingData.length > 0) && (
              <div className="mt-4 rounded-xl bg-card p-4 text-xs leading-5 text-muted-foreground">
                {result.extraction.warnings.length > 0 && <p><strong className="text-foreground">Avertissements d'extraction :</strong> {result.extraction.warnings.join(" · ")}</p>}
                {result.audit.missingData.length > 0 && <p className="mt-1"><strong className="text-foreground">Données à compléter :</strong> {result.audit.missingData.join(" · ")}</p>}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2"><Target size={18} className="text-accent" /><h2 className="font-semibold">Priorités de direction</h2></div>
            <p className="mt-1 text-sm text-muted-foreground">Pilotzia ne classe pas les chiffres pour faire joli : il cherche quelle décision mérite votre attention en premier.</p>
            <div className="mt-4 grid gap-4">
              {result.priorities.map((priority, index) => (
                <div key={priority.key} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-3xl">
                      <p className="text-xs font-semibold text-accent">Priorité {index + 1}</p>
                      <h3 className="mt-1 font-semibold">{priority.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{priority.rationale}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priority.priority === "high" ? "bg-danger/10 text-danger" : priority.priority === "medium" ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground"}`}>
                      {priority.priority === "high" ? "Prioritaire" : priority.priority === "medium" ? "À approfondir" : "Surveiller"}
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                    <strong className="text-foreground">Preuve suivante à obtenir :</strong> {priority.nextEvidence}
                  </div>
                  {priority.automationTemplateId && (
                    <p className="mt-3 text-xs font-medium text-accent">Automatisation potentiellement liée : {priority.automationTemplateId}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">Ratios calculés</h2>
              <div className="mt-4 space-y-3">
                {result.audit.ratios.map((ratio) => (
                  <div key={ratio.key} className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div><p className="text-sm font-medium">{ratio.label}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{ratio.interpretation}</p></div>
                    <span className="shrink-0 text-sm font-semibold">{ratioValue(ratio)}</span>
                  </div>
                ))}
                {result.audit.ratios.length === 0 && <p className="text-sm text-muted-foreground">Pas assez de postes fiables pour calculer un ratio.</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2"><AlertTriangle size={17} className="text-accent" /><h2 className="font-semibold">Alertes à investiguer</h2></div>
                <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {result.audit.alerts.length ? result.audit.alerts.map((alert) => <p key={alert}>• {alert}</p>) : <p>Aucune alerte déterministe majeure à partir des seules données extraites.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2"><CheckCircle2 size={17} className="text-accent" /><h2 className="font-semibold">Questions de dirigeant à poser maintenant</h2></div>
                <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {result.audit.questions.map((question) => <p key={question}>• {question}</p>)}
                </div>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-border bg-card p-5 text-xs leading-5 text-muted-foreground">
            <strong className="text-foreground">Limite importante :</strong> cet audit aide à structurer une décision de gestion. Il ne remplace pas un expert-comptable, un commissaire aux comptes, un conseil fiscal ou financier lorsque leur intervention professionnelle est requise.
          </div>
        </div>
      )}
    </div>
  );
}
