"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, ShieldCheck, Sparkles, Target } from "lucide-react";
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
  context?: { businessGraphEnriched: boolean; factsWritten: number };
  privacy: { rawPdfStored: boolean; note: string };
}

interface AuditErrorPayload {
  error?: string;
  code?: string;
  retryable?: boolean;
  creditsRefunded?: boolean;
  adminHealthHref?: string;
  href?: string;
  usageLimited?: boolean;
}

const MAX_PDF_BYTES = 4 * 1024 * 1024;

function ratioValue(ratio: Ratio) {
  if (ratio.unit === "percent") return `${ratio.value.toFixed(1)} %`;
  if (ratio.unit === "days") return `${Math.round(ratio.value)} j`;
  return ratio.value.toFixed(2);
}

function parseErrorPayload(raw: string): AuditErrorPayload {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AuditErrorPayload;
  } catch {
    return {};
  }
}

export function FinancialAuditUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [errorMeta, setErrorMeta] = useState<AuditErrorPayload | null>(null);
  const [result, setResult] = useState<AuditResponse | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || status === "loading") return;

    if (file.size > MAX_PDF_BYTES) {
      setError("Ce PDF dépasse 4 Mo. Réduisez sa taille avant de lancer l'audit.");
      setErrorMeta({ code: "upload_too_large", retryable: false, creditsRefunded: true });
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");
    setErrorMeta(null);
    setResult(null);

    const body = new FormData();
    body.set("file", file);

    try {
      const response = await fetch("/api/finance/analyze", { method: "POST", body });
      const raw = await response.text();
      const data = parseErrorPayload(raw);

      if (!response.ok) {
        const fallback = response.status === 413
          ? "Le fichier est trop volumineux pour être envoyé. Utilisez un PDF de 4 Mo maximum."
          : "L'analyse n'a pas pu aboutir.";
        setError(data.error || fallback);
        setErrorMeta(data);
        setStatus("error");
        return;
      }

      const parsed = JSON.parse(raw) as AuditResponse;
      setResult(parsed);
      setStatus("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analyse impossible.");
      setErrorMeta({ retryable: true, creditsRefunded: true });
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
              PDF uniquement, 4 Mo maximum. Pilotzia extrait les postes visibles, calcule des ratios, signale les données manquantes et transforme les signaux en questions et priorités opérationnelles.
            </p>
          </div>
        </div>

        <label className="mt-5 block cursor-pointer rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center transition-colors hover:border-accent/40">
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              setStatus("idle");
              setError("");
              setErrorMeta(null);
              setResult(null);
              if (selected && selected.size > MAX_PDF_BYTES) {
                setError("Ce PDF dépasse 4 Mo. Réduisez sa taille avant de lancer l'audit.");
                setErrorMeta({ code: "upload_too_large", retryable: false, creditsRefunded: true });
                setStatus("error");
              }
            }}
          />
          <p className="text-sm font-medium">{file ? file.name : "Choisir un document PDF"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Le document brut n'est pas enregistré par cette fonctionnalité.</p>
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Une analyse réussie consomme 15 crédits d'usage intelligent.</p>
          <Button type="submit" disabled={!file || status === "loading" || Boolean(file && file.size > MAX_PDF_BYTES)}>
            {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {status === "loading" ? "Analyse en cours…" : "Lancer l'audit"}
          </Button>
        </div>

        {status === "error" && (
          <div className="mt-4 rounded-xl border border-danger/20 bg-danger/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger" />
              <div>
                <p className="text-sm font-medium text-danger">{error}</p>
                {errorMeta?.creditsRefunded && (
                  <p className="mt-1 text-xs text-muted-foreground">Aucun crédit n'est conservé pour cette analyse échouée.</p>
                )}
                {errorMeta?.retryable && (
                  <p className="mt-1 text-xs text-muted-foreground">Vous pouvez relancer l'analyse sans modifier votre document.</p>
                )}
                {errorMeta?.adminHealthHref && (
                  <div className="mt-3">
                    <Button href={errorMeta.adminHealthHref} variant="outline" size="sm">Vérifier le moteur IA</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
              {result.priorities.length === 0 && (
                <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                  Aucune priorité fiable n'est déduite de ce document seul. Les questions ci-dessous indiquent les données à compléter avant de conclure.
                </div>
              )}
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
