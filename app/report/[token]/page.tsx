import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { verifyDiagnosticShareToken } from "@/lib/diagnostics/share";
import type { DiagnosticResult } from "@/lib/ai/types";
import { formatEur, formatHours } from "@/lib/format";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "Première lecture Pilotzia",
  description: "Une première hypothèse d'amélioration opérationnelle générée par Pilotzia.",
  robots: { index: false, follow: false },
};

function parseResult(value: string): DiagnosticResult | null {
  try {
    const result = JSON.parse(value) as DiagnosticResult;
    return result && typeof result.summary === "string" && Array.isArray(result.opportunities) ? result : null;
  } catch {
    return null;
  }
}

export default async function SharedDiagnosticPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const diagnosticId = verifyDiagnosticShareToken(token);
  if (!diagnosticId) notFound();

  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    select: { resultJson: true, createdAt: true },
  });
  if (!diagnostic) notFound();

  const result = parseResult(diagnostic.resultJson);
  if (!result) notFound();
  const primary = result.opportunities[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-semibold tracking-tight">{APP_NAME}</Link>
          <Link href="/#diagnostic" className="text-sm font-semibold text-accent">Faire mon diagnostic</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <div className="text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
            <Sparkles size={13} /> Première lecture Pilotzia
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{result.summary}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Rapport partagé sans le texte d'origine, sans identité d'entreprise et sans données connectées. Il s'agit d'une hypothèse initiale, pas d'un audit complet.
          </p>
        </div>

        {primary && (
          <section className="mt-10 rounded-2xl border border-accent/25 bg-card p-6 sm:p-7">
            <div className="flex items-center gap-2 text-accent"><Zap size={17} /><span className="text-xs font-semibold uppercase tracking-[0.14em]">Levier à vérifier</span></div>
            <h2 className="mt-2 text-xl font-semibold">{primary.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{primary.description}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Temps théorique" value={`~${formatHours(primary.estimatedHoursPerMonth)}/mois`} />
              <Metric label="Valeur indicative" value={`~${formatEur(primary.estimatedValueEur)}/mois`} />
              <Metric label="Niveau de preuve" value="Hypothèse initiale" />
            </div>
          </section>
        )}

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Ce que cette lecture ne prouve pas encore</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-2"><Check size={14} className="mt-1 shrink-0 text-accent" /> Les volumes et temps réellement consommés.</li>
              <li className="flex gap-2"><Check size={14} className="mt-1 shrink-0 text-accent" /> L'impact réel sur marge, chiffre d'affaires ou trésorerie.</li>
              <li className="flex gap-2"><Check size={14} className="mt-1 shrink-0 text-accent" /> La faisabilité technique dans les outils de l'entreprise.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Comment obtenir une vraie recommandation</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Pilotzia devient plus précis lorsqu'il connaît l'activité, la taille, les objectifs, les outils, les volumes et les signaux réellement observés. Il doit alors distinguer faits, calculs, hypothèses et benchmarks agrégés.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-accent/20 bg-accent-soft p-6 text-center sm:p-8">
          <ShieldCheck size={22} className="mx-auto text-accent" />
          <h2 className="mt-3 text-xl font-semibold">Et votre entreprise ?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Posez une vraie question de dirigeant. La première lecture est gratuite, puis vous pouvez tester Pilotzia 14 jours sur votre propre contexte.
          </p>
          <Link href="/#diagnostic" className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground">
            Faire mon diagnostic gratuit <ArrowRight size={15} />
          </Link>
        </section>
      </main>
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
