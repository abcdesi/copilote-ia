import { SiteHeader } from "@/components/marketing/SiteHeader";
import { DiagnosticExperience } from "@/components/marketing/DiagnosticExperience";
import { APP_NAME } from "@/lib/config";

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
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}. Les estimations de temps et de valeur sont indicatives.
        </div>
      </footer>
    </div>
  );
}
