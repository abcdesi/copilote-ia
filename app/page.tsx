import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  Database,
  Eye,
  FileSearch,
  Gauge,
  Network,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { DiagnosticExperience } from "@/components/marketing/DiagnosticExperience";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { RadarChart } from "@/components/knowledge/RadarChart";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { APP_NAME, SITE_URL } from "@/lib/config";
import { PLAN_DEFINITIONS } from "@/lib/billing/plans";
import { MARKETING_SOLUTIONS } from "@/lib/marketing/solutions";

const HOW_IT_WORKS = [
  ["01", "Connecter", "Reliez progressivement les outils et données qui comptent vraiment."],
  ["02", "Structurer", "Pilotzia transforme les signaux utiles en entités, relations et faits traçables."],
  ["03", "Comprendre", "Le copilote distingue faits observés, déclarations, calculs, hypothèses et références externes."],
  ["04", "Auditer", "Il repère écarts, risques, pertes de temps, tensions financières et questions à clarifier."],
  ["05", "Agir", "Il recommande, prépare ou exécute l'action utile selon le niveau d'autorisation choisi."],
  ["06", "Mesurer", "Il suit les résultats pour apprendre ce qui fonctionne réellement dans votre entreprise."],
];

const CONTEXT_FEATURES = [
  [Database, "Données reliées", "Outils, documents, automatisations, opportunités et signaux opérationnels deviennent un contexte exploitable par l'IA."],
  [Network, "Business Graph", "Pilotzia relie personnes, systèmes, processus, clients, décisions et résultats au lieu de laisser chaque source isolée."],
  [ShieldCheck, "Confiance & provenance", "Chaque fait garde sa source, sa fraîcheur, son niveau de confiance et les permissions qui encadrent son usage."],
];

const MATURITY_LEVELS = [
  {
    icon: BrainCircuit,
    title: "Au départ : des hypothèses utiles",
    body: "Avec peu d'informations, Pilotzia raisonne comme un consultant senior : il propose des pistes, explicite ce qu'il suppose et demande la donnée qui fera le plus progresser le diagnostic.",
  },
  {
    icon: FileSearch,
    title: "Ensuite : un audit personnalisé",
    body: "Avec votre activité, vos outils, vos volumes et vos signaux réels, les conseils deviennent plus précis, chiffrés et adaptés à votre façon de travailler.",
  },
  {
    icon: TrendingUp,
    title: "Puis : une direction augmentée",
    body: "Quand le contexte est riche, Pilotzia relie opérations, finance, risques, automatisations et résultats pour prioriser comme un directeur expérimenté — avec un niveau de preuve visible.",
  },
];

const EXAMPLE_RADAR = [
  { label: "Finance", score: 72 },
  { label: "Compta", score: 58 },
  { label: "Commercial", score: 84 },
  { label: "Marketing", score: 51 },
  { label: "RH", score: 34 },
  { label: "Opérations", score: 76 },
  { label: "Données", score: 68 },
];

const KNOWLEDGE_DOMAINS = [
  ["Finance", "Marge, trésorerie, bilan, compte de résultat, créances et coûts."],
  ["Commercial", "Pipeline, leads, relances, devis, cycle de vente et CRM."],
  ["Marketing", "Acquisition, campagnes, budget, conversion, contenu et attribution."],
  ["RH", "Organisation, recrutement, onboarding, charge et processus agrégés."],
  ["Opérations", "Processus, production, support, réunions, délais et points de blocage."],
  ["Comptabilité", "Facturation, clôture, rapprochements, reporting et outils comptables."],
];

const PAID_PLANS = [PLAN_DEFINITIONS.starter, PLAN_DEFINITIONS.pro, PLAN_DEFINITIONS.business];

export default function HomePage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: APP_NAME,
      url: SITE_URL,
      description: "Pilotzia transforme le contexte d'une entreprise en décisions, actions et apprentissage opérationnel traçables.",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: APP_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Système opérationnel IA pour comprendre l'entreprise, détecter les priorités, recommander des actions, automatiser avec contrôle et mesurer les résultats.",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "79",
        highPrice: "399",
        priceCurrency: "EUR",
        offerCount: "3",
      },
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section id="top" className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-16">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
              <Sparkles size={13} /> Le copilote opérationnel qui apprend votre entreprise
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.45rem] lg:leading-[1.08]">
              Voyez ce qui compte. Décidez. Pilotzia prend en charge le reste.
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              Pilotzia relie vos données, repère ce qui mérite votre attention, prépare la prochaine action et mesure ce qui a réellement changé — sans présenter une estimation comme un résultat.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium text-accent">
              {[
                "Connecter",
                "Structurer",
                "Comprendre",
                "Auditer",
                "Agir",
                "Mesurer",
                "Apprendre",
              ].map((item, index, arr) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <span>{item}</span>
                  {index < arr.length - 1 && <span className="text-accent/40">→</span>}
                </span>
              ))}
            </div>
          </div>

          <div id="diagnostic" className="mx-auto mt-10 max-w-4xl scroll-mt-20">
            <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
              Décrivez un problème, une perte de temps ou une priorité business. Pilotzia vous donne une première lecture.
            </p>
            <DiagnosticExperience />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Première analyse gratuite</span>
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Sans carte bancaire</span>
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Essai réel ensuite : 14 jours, usage borné</span>
            </div>
          </div>

          <div className="mx-auto mt-9 grid max-w-4xl gap-3 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Le matin</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Ce qui a changé, ce qui bloque et les décisions qui attendent réellement votre validation.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Pendant la journée</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Pilotzia prépare ou exécute les tâches autorisées, avec cadence, permissions et preuve.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Après l'action</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Le potentiel estimé reste séparé des résultats réellement constatés pour apprendre ce qui fonctionne.</p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-1.5">
            {KNOWN_TOOLS.slice(0, 8).map((tool) => (
              <span key={tool} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">{tool}</span>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Une vision par domaine</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Voyez ce que Pilotzia connaît — et ce qu&apos;il doit encore apprendre
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Connectez vos outils, complétez votre contexte et laissez Pilotzia transformer vos données en recommandations concrètes, automatisations utiles et plans d&apos;action mesurables.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {KNOWLEDGE_DOMAINS.map(([name, description]) => (
                  <div key={name} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm font-medium text-foreground">
                Pilotzia ne cache pas son niveau de connaissance : il vous montre où ses conseils peuvent déjà être précis et quelles données amélioreraient le plus la suite.
              </p>
            </div>

            <div className="rounded-2xl border border-accent/20 bg-accent-soft p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Cartographie des connaissances</p>
                  <p className="mt-1 text-sm text-foreground/75">La couverture réelle évolue avec votre profil, vos connexions et vos faits structurés.</p>
                </div>
                <Gauge size={20} className="shrink-0 text-accent" />
              </div>
              <div className="mt-3 flex justify-center">
                <RadarChart items={EXAMPLE_RADAR} size={350} showValues={false} ariaLabel="Exemple illustratif de couverture par domaine" />
              </div>
              <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
                Exemple illustratif. Dans votre espace, chaque score est calculé à partir des informations et sources réellement disponibles.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60 px-6 py-16 sm:py-20">
          <div className="mx-auto mb-9 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Le cockpit</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Ouvrez Pilotzia le matin. Voyez ce qui a changé, ce qui bloque et quoi faire ensuite.</h2>
            <p className="mt-3 text-muted-foreground">
              Un brief quotidien, les risques, les actions à valider, la santé des automatisations et la prochaine décision utile au même endroit.
            </p>
          </div>
          <ProductPreview />
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">La différence</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Plus Pilotzia connaît votre entreprise, plus il devient précis — sans inventer ce qu&apos;il ne sait pas</h2>
              <p className="mt-3 text-muted-foreground">
                La qualité du conseil progresse avec le contexte. Les données d&apos;autres entreprises ne deviennent utiles qu&apos;à travers des benchmarks suffisamment agrégés et anonymisés.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {MATURITY_LEVELS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={18} /></div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Pilotzia Context Engine</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Vos outils deviennent un contexte que l&apos;IA peut réellement utiliser</h2>
              <p className="mt-3 text-muted-foreground">
                Pas un chatbot posé au-dessus de données dispersées. Pilotzia construit une représentation vivante et traçable de l&apos;entreprise sans remplacer les systèmes sources.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {CONTEXT_FEATURES.map(([Icon, title, body]) => {
                const FeatureIcon = Icon as typeof Database;
                return (
                  <div key={String(title)} className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><FeatureIcon size={18} /></div>
                    <h3 className="mt-4 font-semibold">{String(title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{String(body)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">De l&apos;analyse à l&apos;action</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Un conseiller qui peut devenir opérateur — seulement quand vous l&apos;autorisez</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <Feature icon={Eye} title="Observe" body="Rassemble les signaux utiles et repère ce qui mérite réellement votre attention." />
              <Feature icon={Zap} title="Prépare et agit" body="Transforme un diagnostic en prochaine action, puis demande votre validation lorsque le risque l'exige." />
              <Feature icon={Wrench} title="Maintient dans la durée" body="Suit ce qui est automatisé, détecte les dégradations et mesure si la solution apporte réellement de la valeur." />
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Cas d&apos;usage</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Commencez par un problème business, pas par une fonctionnalité</h2>
              <p className="mt-3 text-muted-foreground">Chaque cas d&apos;usage devient plus précis lorsque Pilotzia dispose de vos volumes, outils et faits réels.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {MARKETING_SOLUTIONS.map((solution) => (
                <Link key={solution.slug} href={`/solutions/${solution.slug}`} className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent/40">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">{solution.eyebrow}</p>
                  <h3 className="mt-2 text-lg font-semibold leading-7">{solution.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{solution.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">Voir comment Pilotzia raisonne <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Méthode</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Une boucle qui transforme les données en résultat mesurable</h2>
              <p className="mt-3 text-muted-foreground">Le produit s&apos;améliore quand il apprend ce qui a réellement fonctionné, pas simplement quand il génère davantage de texte.</p>
            </div>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
              {HOW_IT_WORKS.map(([n, title, body]) => (
                <div key={n}>
                  <p className="text-sm font-semibold text-accent/60">{n}</p>
                  <p className="mt-1 font-semibold">{title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><ShieldCheck size={19} /></div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Vous gardez le contrôle</h2>
              <p className="mt-3 text-muted-foreground">
                Lecture, préparation, confirmation et autonomie ne sont pas la même chose. Pilotzia adapte l&apos;action au niveau de permission choisi.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PermissionCard title="Lecture seule" body="Consulter le contexte utile sans modifier vos données." />
              <PermissionCard title="Action contrôlée" body="Agir dans les outils pour les tâches que vous autorisez." />
              <PermissionCard title="Confirmation requise" body="Demander votre validation avant une action sensible." />
              <PermissionCard title="Autonomie encadrée" body="Automatiser uniquement des actions à faible risque explicitement autorisées." />
            </div>
          </div>
        </section>

        <section id="tarifs" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Tarifs</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Payez pour la profondeur et l&apos;exécution, pas pour stocker davantage de contexte</h2>
              <p className="mt-3 text-muted-foreground">
                Plus Pilotzia connaît votre entreprise, plus il peut être utile. Les offres montent surtout en profondeur d&apos;analyse, capacité d&apos;action et usage intelligent inclus.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {PAID_PLANS.map((plan) => {
                const featured = plan.key === "pro";
                return (
                  <div key={plan.key} className={`rounded-2xl border p-6 ${featured ? "border-accent bg-accent-soft" : "border-border bg-card"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{plan.label}</h3>
                      {featured && <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">Meilleur équilibre</span>}
                    </div>
                    <p className="mt-3 text-3xl font-semibold">{plan.priceEur} €<span className="text-sm font-normal text-muted-foreground">/mois</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">ou {plan.annualPriceEur.toLocaleString("fr-FR")} €/an · 1 mois offert</p>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{plan.positioning}</p>
                    <ul className="mt-5 space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-accent" /><span>{feature}</span></li>
                      ))}
                      <li className="flex items-start gap-2"><Gauge size={15} className="mt-0.5 shrink-0 text-accent" /><span>{plan.monthlyCredits.toLocaleString("fr-FR")} crédits d&apos;usage intelligent inclus / mois</span></li>
                    </ul>
                    <div className="mt-6">
                      <Link href="/signup" className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold ${featured ? "bg-accent text-accent-foreground" : "border border-border bg-background"}`}>
                        Tester gratuitement
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
              Première analyse gratuite, puis essai réel borné à 14 jours. Les limites d&apos;usage protègent aussi contre les dépenses surprises. Prix hors taxes lorsque la fiscalité applicable l&apos;exige.
            </p>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-20">
            <Activity size={22} className="mx-auto text-accent" />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Commencez par une vraie question de dirigeant</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              « Où est-ce que je perds le plus de marge ? », « Que dois-je automatiser en premier ? », « Qu&apos;est-ce qui menace ma trésorerie ? ». Pilotzia doit répondre avec le niveau de preuve réellement disponible — puis vous montrer comment obtenir une réponse plus précise.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/#diagnostic" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground">Tester une question gratuitement</Link>
              <Link href="/faq" className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold">Lire la FAQ</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {APP_NAME}. Les estimations de temps, valeur et ROI sont indicatives.</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/faq">FAQ</Link>
            <Link href="/cgv">CGV</Link>
            <Link href="/confidentialite">Confidentialité</Link>
            <Link href="/mentions-legales">Mentions légales</Link>
          </nav>
        </div>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof Eye; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={18} /></div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
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
