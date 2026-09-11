import { Check, X } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { DiagnosticExperience } from "@/components/marketing/DiagnosticExperience";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { APP_NAME } from "@/lib/config";

const CHATGPT_POINTS = [
  { label: "Vous aide à rédiger une automatisation", has: true },
  { label: "Connaît votre entreprise dans la durée", has: false },
  { label: "Surveille vos automatisations en continu", has: false },
  { label: "Mesure les résultats obtenus", has: false },
  { label: "Détecte les problèmes et les corrige", has: false },
  { label: "Vous propose la prochaine opportunité", has: false },
];

const APP_POINTS = [
  { label: "Comprend votre activité et vos outils", has: true },
  { label: "Garde la mémoire de vos automatisations", has: true },
  { label: "Surveille leur bon fonctionnement", has: true },
  { label: "Mesure le temps et la valeur générés", has: true },
  { label: "Détecte les problèmes et les maintient", has: true },
  { label: "Cherche en permanence la prochaine opportunité", has: true },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Connectez vos outils",
    body: "Indiquez ce que vous utilisez déjà (Gmail, CRM, Slack, Notion…). Pilotzia comprend votre environnement, sans configuration technique.",
  },
  {
    n: "02",
    title: "Parlez à votre copilote",
    body: "Décrivez en langage naturel ce qui vous fait perdre du temps — pas besoin de connaître n8n, Make ou Zapier.",
  },
  {
    n: "03",
    title: "Pilotzia agit",
    body: "Il recommande la meilleure automatisation, l'installe et la teste avant de vous la confier.",
  },
  {
    n: "04",
    title: "Pilotzia surveille",
    body: "Il détecte les erreurs, les signale et maintient vos automatisations en état de marche.",
  },
  {
    n: "05",
    title: "Pilotzia progresse",
    body: "Il mesure les résultats obtenus et cherche en continu votre prochaine opportunité.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-10 pb-16 sm:pt-16">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Le copilote opérationnel de votre entreprise
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Connectez vos outils, décrivez ce qui vous ralentit, et laissez {APP_NAME} comprendre, automatiser et
              surveiller vos opérations dans la durée.
            </p>
            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium text-accent">
              <span>Connecté à vos outils</span>
              <span className="text-accent/40">→</span>
              <span>Comprend votre entreprise</span>
              <span className="text-accent/40">→</span>
              <span>Agit</span>
              <span className="text-accent/40">→</span>
              <span>Mesure</span>
              <span className="text-accent/40">→</span>
              <span>Anticipe</span>
            </p>
          </div>

          <div className="mt-10">
            <p className="text-center text-sm font-medium text-muted-foreground mb-3">Que voulez-vous automatiser ?</p>
            <DiagnosticExperience />
          </div>
        </section>

        <section className="border-t border-border bg-card/60 px-6 py-16">
          <ProductPreview />
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Connectez toutes vos applications</h2>
            <p className="mt-3 text-muted-foreground">
              {APP_NAME} se connecte aux outils que vous utilisez déjà et rassemble leur contexte dans un seul
              copilote.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {KNOWN_TOOLS.map((tool) => (
                <span
                  key={tool}
                  className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Comment ça marche</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.n}>
                  <p className="text-sm font-semibold text-accent/60">{step.n}</p>
                  <p className="mt-1 font-semibold">{step.title}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight">Pourquoi pas simplement ChatGPT ?</h2>
              <p className="mt-3 text-muted-foreground">
                ChatGPT peut vous aider à créer une automatisation. {APP_NAME} connaît votre entreprise, garde la
                mémoire de vos automatisations, les surveille, mesure leurs résultats et cherche en permanence la
                prochaine opportunité.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="font-semibold text-muted-foreground">ChatGPT</p>
                <ul className="mt-4 space-y-3">
                  {CHATGPT_POINTS.map((p) => (
                    <li key={p.label} className="flex items-start gap-2.5 text-sm">
                      {p.has ? (
                        <Check size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <X size={16} className="mt-0.5 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className={p.has ? "text-foreground" : "text-muted-foreground"}>{p.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-accent/30 bg-accent-soft p-6">
                <p className="font-semibold text-accent">{APP_NAME}</p>
                <ul className="mt-4 space-y-3">
                  {APP_POINTS.map((p) => (
                    <li key={p.label} className="flex items-start gap-2.5 text-sm">
                      <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                      <span className="text-foreground">{p.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}. Les estimations de temps et de valeur sont indicatives.
        </div>
      </footer>
    </div>
  );
}
