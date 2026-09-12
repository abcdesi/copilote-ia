import { Activity, Check, Eye, ShieldCheck, Sparkles, Wrench, X, Zap } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { DiagnosticExperience } from "@/components/marketing/DiagnosticExperience";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { APP_NAME } from "@/lib/config";

const CHATGPT_POINTS = [
  { label: "Vous aide à réfléchir ou à rédiger", has: true },
  { label: "Connaît votre entreprise dans la durée", has: false },
  { label: "Suit la santé de vos automatisations", has: false },
  { label: "Mesure le temps et la valeur générés", has: false },
  { label: "Détecte les problèmes opérationnels", has: false },
  { label: "Vous propose la prochaine amélioration", has: false },
];

const APP_POINTS = [
  { label: "Comprend votre activité, vos outils et vos priorités", has: true },
  { label: "Garde la mémoire de votre contexte opérationnel", has: true },
  { label: "Surveille ce qui fonctionne et ce qui nécessite votre attention", has: true },
  { label: "Mesure le temps et la valeur estimée générés", has: true },
  { label: "Vous aide à maintenir vos automatisations dans la durée", has: true },
  { label: "Cherche en permanence la prochaine opportunité", has: true },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Connecter",
    body: "Décrivez les outils que vous utilisez déjà et donnez à Pilotzia le contexte dont il a besoin.",
  },
  {
    n: "02",
    title: "Comprendre",
    body: "Pilotzia apprend votre activité, vos priorités, vos processus et ce qui vous fait perdre du temps.",
  },
  {
    n: "03",
    title: "Agir",
    body: "Le copilote recommande l'action ou l'automatisation la plus utile et vous montre ce qu'il va faire.",
  },
  {
    n: "04",
    title: "Mesurer",
    body: "Vous suivez les heures économisées, la valeur estimée, la santé et les résultats de vos automatisations.",
  },
  {
    n: "05",
    title: "Anticiper",
    body: "Pilotzia détecte de nouvelles opportunités et les problèmes qui méritent votre attention.",
  },
];

const PROACTIVE_FEATURES = [
  {
    icon: Eye,
    title: "Observe",
    body: "Pilotzia rassemble le contexte utile de vos opérations et repère ce qui mérite votre attention.",
  },
  {
    icon: Zap,
    title: "Agit avec vous",
    body: "Il propose les prochaines actions, prépare les automatisations et demande votre validation quand elle est nécessaire.",
  },
  {
    icon: Wrench,
    title: "Maintient dans la durée",
    body: "Il suit la santé de ce qui est automatisé, mesure les résultats et vous aide à corriger ce qui se dégrade.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
              <Sparkles size={13} />
              Le copilote opérationnel de votre entreprise
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Parlez à votre entreprise. {APP_NAME} vous aide à agir.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Décrivez ce que vous voulez accomplir, donnez à {APP_NAME} le contexte de vos outils et laissez votre
              copilote comprendre, automatiser, surveiller et améliorer vos opérations dans la durée.
            </p>
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium text-accent">
              <span>Connecter</span>
              <span className="text-accent/40">→</span>
              <span>Comprendre</span>
              <span className="text-accent/40">→</span>
              <span>Observer</span>
              <span className="text-accent/40">→</span>
              <span>Agir</span>
              <span className="text-accent/40">→</span>
              <span>Mesurer</span>
              <span className="text-accent/40">→</span>
              <span>Anticiper</span>
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-4xl">
            <p className="mb-3 text-center text-sm font-medium text-muted-foreground">Que voulez-vous faire ?</p>
            <DiagnosticExperience />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Analyse gratuite</span>
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Sans carte bancaire</span>
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Aucune configuration technique</span>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-1.5">
            {KNOWN_TOOLS.slice(0, 8).map((tool) => (
              <span key={tool} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                {tool}
              </span>
            ))}
            {KNOWN_TOOLS.length > 8 && (
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                +{KNOWN_TOOLS.length - 8} autres
              </span>
            )}
          </div>
        </section>

        <section className="border-t border-border bg-card/60 px-6 py-16 sm:py-20">
          <div className="mx-auto mb-9 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Le cockpit</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Votre entreprise, résumée en décisions utiles</h2>
            <p className="mt-3 text-muted-foreground">
              Un brief quotidien, la santé de vos automatisations, la valeur générée et la prochaine opportunité au même endroit.
            </p>
          </div>
          <ProductPreview />
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Proactif, pas seulement réactif</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {APP_NAME} travaille avant même que vous pensiez à demander
              </h2>
              <p className="mt-3 text-muted-foreground">
                Le but n'est pas d'ajouter un chatbot de plus. Le but est de créer une couche intelligente au-dessus de vos opérations.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {PROACTIVE_FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Icon size={18} />
                  </div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Comment ça marche</h2>
              <p className="mt-3 text-muted-foreground">Une boucle simple qui s'améliore avec le contexte de votre entreprise.</p>
            </div>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.n}>
                  <p className="text-sm font-semibold text-accent/60">{step.n}</p>
                  <p className="mt-1 font-semibold">{step.title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <ShieldCheck size={19} />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Vous gardez le contrôle</h2>
              <p className="mt-3 text-muted-foreground">
                Une action n'a pas le même risque qu'une lecture. Pilotzia est conçu pour distinguer l'observation, l'action et les opérations sensibles.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PermissionCard title="Lecture seule" body="Consulter le contexte utile sans modifier vos données." />
              <PermissionCard title="Lecture + action" body="Agir dans les outils pour les tâches que vous autorisez." />
              <PermissionCard title="Confirmation requise" body="Demander votre validation avant une action sensible." />
              <PermissionCard title="Autonomie encadrée" body="Automatiser seulement les actions à faible risque que vous avez explicitement autorisées." />
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pourquoi pas simplement ChatGPT ?</h2>
              <p className="mt-3 text-muted-foreground">
                ChatGPT vous aide à réfléchir. {APP_NAME} est conçu pour apprendre votre contexte opérationnel, suivre ce qui a été mis en place et transformer les recommandations en résultats mesurables.
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

        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center sm:py-20">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Activity size={19} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">Commencez par ce qui vous fait perdre du temps</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Décrivez votre entreprise, vos outils et votre problème. Pilotzia vous montre où se trouve la première opportunité.
            </p>
            <a
              href="#top"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <Sparkles size={15} />
              Analyser gratuitement
            </a>
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

function PermissionCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}
