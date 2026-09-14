import Link from "next/link";
import { Activity, Check, Database, Eye, Network, ShieldCheck, Sparkles, Wrench, Zap } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { DiagnosticExperience } from "@/components/marketing/DiagnosticExperience";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { APP_NAME } from "@/lib/config";

const HOW_IT_WORKS = [
  ["01", "Connecter", "Reliez progressivement les outils où votre entreprise travaille déjà."],
  ["02", "Structurer", "Pilotzia transforme les signaux utiles en entités, relations et faits traçables."],
  ["03", "Comprendre", "Le copilote raisonne sur un contexte cohérent avec provenance, fraîcheur et permissions."],
  ["04", "Observer", "Pilotzia repère ce qui mérite votre attention sans attendre une question."],
  ["05", "Agir", "Il recommande ou exécute l'action utile selon le niveau d'autorisation choisi."],
  ["06", "Apprendre", "Le contexte s'enrichit avec les nouvelles données, décisions et résultats."],
];

const CONTEXT_FEATURES = [
  [Database, "Données reliées", "Outils, automatisations, opportunités et signaux opérationnels sont transformés en objets compréhensibles par l'IA."],
  [Network, "Business Graph", "Pilotzia relie progressivement personnes, systèmes, processus et résultats au lieu de laisser chaque source isolée."],
  [ShieldCheck, "Confiance & provenance", "Chaque fait conserve sa source, sa fraîcheur, son niveau de confiance et les permissions qui encadrent son usage."],
];

const PLANS = [
  { name: "Core", price: "49 €", description: "Pour comprendre et suivre votre entreprise.", perks: ["Business Graph vivant", "Copilote opérationnel", "Morning Brief", "Recommandations continues"] },
  { name: "Action", price: "99 €", description: "Pour agir dans vos outils avec contrôle.", perks: ["Tout Core", "Actions et automatisations", "Confirmations sensibles", "Suivi ROI et exécutions"], featured: true },
  { name: "Scale", price: "249 €", description: "Pour les équipes et usages plus importants.", perks: ["Tout Action", "Volumes supérieurs", "Permissions avancées", "API / agents à mesure de leur disponibilité"] },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section id="top" className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
              <Sparkles size={13} /> Le copilote opérationnel de votre entreprise
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Connectez vos outils. {APP_NAME} comprend votre entreprise et vous aide à l'améliorer.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Pilotzia transforme vos données dispersées en contexte opérationnel : ce qui se passe, ce qui mérite votre attention et ce que vous pouvez faire ensuite.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium text-accent">
              {['Connecter','Structurer','Comprendre','Observer','Agir','Mesurer','Apprendre'].map((item, index, arr) => (
                <span key={item} className="inline-flex items-center gap-2"><span>{item}</span>{index < arr.length - 1 && <span className="text-accent/40">→</span>}</span>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-4xl">
            <p className="mb-3 text-center text-sm font-medium text-muted-foreground">Commencez par décrire ce qui vous fait perdre du temps</p>
            <DiagnosticExperience />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Diagnostic gratuit</span>
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Sans carte bancaire</span>
              <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-success" /> Essai complet ensuite borné à 14 jours et 100 crédits</span>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-1.5">
            {KNOWN_TOOLS.slice(0, 8).map((tool) => <span key={tool} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">{tool}</span>)}
          </div>
        </section>

        <section className="border-t border-border bg-card/60 px-6 py-16 sm:py-20">
          <div className="mx-auto mb-9 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Le cockpit</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Votre entreprise, résumée en décisions utiles</h2>
            <p className="mt-3 text-muted-foreground">Un brief quotidien, la santé des automatisations, les signaux importants et la prochaine opportunité au même endroit.</p>
          </div>
          <ProductPreview />
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Pilotzia Context Engine</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Vos outils deviennent un contexte que l'IA peut réellement utiliser</h2>
              <p className="mt-3 text-muted-foreground">Pas un ETL de plus. Pilotzia construit une représentation vivante de votre entreprise, sans prétendre remplacer vos systèmes sources.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {CONTEXT_FEATURES.map(([Icon, title, body]) => {
                const FeatureIcon = Icon as typeof Database;
                return <div key={String(title)} className="rounded-2xl border border-border bg-card p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><FeatureIcon size={18} /></div><h3 className="mt-4 font-semibold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{String(body)}</p></div>;
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Proactif, pas seulement réactif</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Pilotzia travaille avant même que vous pensiez à demander</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <Feature icon={Eye} title="Observe" body="Rassemble le contexte utile et repère ce qui mérite votre attention." />
              <Feature icon={Zap} title="Agit avec vous" body="Prépare les prochaines actions et demande votre validation quand elle est nécessaire." />
              <Feature icon={Wrench} title="Maintient dans la durée" body="Suit la santé de ce qui est automatisé et vous aide à corriger ce qui se dégrade." />
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center"><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Comment ça marche</h2><p className="mt-3 text-muted-foreground">Une boucle qui transforme les données en compréhension, puis la compréhension en action.</p></div>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
              {HOW_IT_WORKS.map(([n,title,body]) => <div key={n}><p className="text-sm font-semibold text-accent/60">{n}</p><p className="mt-1 font-semibold">{title}</p><p className="mt-1.5 text-sm leading-6 text-muted-foreground">{body}</p></div>)}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><ShieldCheck size={19} /></div><h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Vous gardez le contrôle</h2><p className="mt-3 text-muted-foreground">Lecture, préparation, confirmation et autonomie ne sont pas la même chose. Pilotzia adapte l'action au niveau de permission choisi.</p></div>
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
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Commencez petit. Payez surtout quand Pilotzia travaille réellement pour vous.</h2>
              <p className="mt-3 text-muted-foreground">Le diagnostic reste gratuit. L'essai complet est borné à 14 jours, 100 crédits et des limites techniques de sécurité. Une fois la limite atteinte, votre contexte reste disponible.</p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => <div key={plan.name} className={`rounded-2xl border p-6 ${plan.featured ? 'border-accent bg-accent-soft' : 'border-border bg-card'}`}><div className="flex items-center justify-between"><h3 className="font-semibold">{plan.name}</h3>{plan.featured && <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">Recommandé</span>}</div><p className="mt-3 text-3xl font-semibold">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mois</span></p><p className="mt-2 text-sm text-muted-foreground">{plan.description}</p><ul className="mt-5 space-y-2 text-sm">{plan.perks.map((perk) => <li key={perk} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-accent" /><span>{perk}</span></li>)}</ul></div>)}
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">Prix indicatifs hors taxes lorsque la fiscalité applicable l'exige. Les volumes et fonctions exacts sont ceux affichés au moment de la souscription.</p>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-20">
            <Activity size={22} className="mx-auto text-accent" />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">La valeur avant le paiement, pas la consommation illimitée</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Vous pouvez comprendre ce que Pilotzia apporte avant de payer. Quand une fonction entraîne un coût réel, son usage est borné et visible. Pas de facture surprise.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/faq" className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold">Lire la FAQ</Link><Link href="/signup" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground">Créer mon espace</Link></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {APP_NAME}. Les estimations de temps et de valeur sont indicatives.</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2"><Link href="/faq">FAQ</Link><Link href="/cgv">CGV</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/mentions-legales">Mentions légales</Link></nav>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof Eye; title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={18} /></div><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div>;
}

function PermissionCard({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><p className="font-semibold">{title}</p><p className="mt-1.5 text-sm leading-6 text-muted-foreground">{body}</p></div>;
}
