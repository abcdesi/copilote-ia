import { Check, X } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { DiagnosticExperience } from "@/components/marketing/DiagnosticExperience";
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

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-10 pb-24 sm:pt-16">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Que voulez-vous automatiser ?
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Décrivez votre entreprise, votre problème ou une tâche qui vous fait perdre du temps. Notre copilote
              identifie les meilleures opportunités d'automatisation.
            </p>
          </div>

          <div className="mt-10">
            <DiagnosticExperience />
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-5xl px-6 py-16 grid gap-10 sm:grid-cols-3 text-center">
            <div>
              <p className="text-sm font-semibold text-accent">Comprendre</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {APP_NAME} apprend votre activité, vos outils et vos priorités — vous n'avez rien à configurer.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-accent">Automatiser</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Chaque opportunité est installée, testée et surveillée sans que vous ayez à toucher un outil technique.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-accent">Progresser</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {APP_NAME} mesure les résultats et vous propose la prochaine opportunité, mois après mois.
              </p>
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
