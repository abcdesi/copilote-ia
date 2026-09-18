import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { APP_NAME, SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "FAQ — IA, données, sécurité, essai et tarifs",
  description:
    "Comment Pilotzia comprend votre entreprise, utilise vos données, gère les permissions, fonctionne pendant l'essai et différencie Core, Action et Scale.",
  alternates: { canonical: "/faq" },
  openGraph: {
    url: "/faq",
    title: `FAQ ${APP_NAME}`,
    description: "Réponses sur la valeur, les données, les permissions, l'essai et les abonnements Pilotzia.",
  },
};

const FAQ = [
  [
    "Que fait Pilotzia ?",
    "Pilotzia relie le contexte utile de votre entreprise, le structure en Business Graph, distingue faits et hypothèses, détecte ce qui mérite votre attention et vous aide à décider puis agir dans vos outils selon les permissions que vous choisissez.",
  ],
  [
    "Pourquoi Pilotzia est différent d'un chatbot IA ?",
    "Un chatbot répond surtout à partir du message courant. Pilotzia construit progressivement une représentation opérationnelle de l'entreprise : outils, processus, opportunités, décisions, résultats, provenance et niveau de confiance. L'objectif est de devenir plus précis à mesure que le contexte réel s'enrichit.",
  ],
  [
    "Dois-je connecter tous mes outils ?",
    "Non. Vous pouvez commencer avec une seule source. Chaque connexion supplémentaire enrichit le contexte et débloque de nouveaux cas d'usage, sans obligation de tout connecter.",
  ],
  [
    "Pilotzia utilise-t-il les données d'autres entreprises pour me conseiller ?",
    "Pilotzia ne réinjecte pas les données privées brutes d'un autre client dans vos réponses. Les recommandations actuelles s'appuient sur votre propre contexte, les sources que vous avez connectées, des règles métier explicites et des connaissances générales — pas sur un benchmark client présenté comme disponible alors qu'il ne l'est pas encore.",
  ],
  [
    "Pilotzia stocke-t-il le contenu de mes emails ?",
    "Le produit privilégie la minimisation des données. Les observations opérationnelles sont structurées et traçables ; le stockage intégral de contenus bruts n'est pas nécessaire par défaut. Les traitements dépendent toutefois du connecteur et du cas d'usage activé.",
  ],
  [
    "Pilotzia peut-il agir sans mon accord ?",
    "Les actions sont gouvernées par un niveau de permission. Les opérations sensibles, irréversibles ou à risque élevé nécessitent une confirmation explicite. L'autonomie est réservée aux actions à faible risque que vous avez autorisées.",
  ],
  [
    "Comment fonctionne l'essai ?",
    "La première analyse publique est gratuite. L'essai de l'IA réelle démarre au premier usage coûteux et est borné à 14 jours, 100 crédits et une enveloppe technique de sécurité. Le premier plafond atteint suspend les nouvelles consommations coûteuses. Votre contexte et votre historique restent disponibles.",
  ],
  [
    "Pourquoi y a-t-il des crédits ?",
    "Les crédits servent à rendre l'usage intelligent prévisible et à éviter une consommation externe illimitée. La connexion et la structuration du contexte ne sont pas conçues pour être facturées au volume de données, car enrichir le contexte rend Pilotzia plus utile.",
  ],
  [
    "Que se passe-t-il si j'atteins ma limite ?",
    "Pilotzia conserve votre espace, votre contexte et votre historique. Pendant l'essai, vous pouvez activer un abonnement. Sur un abonnement, Pilotzia vous alerte avant la limite et vous permet soit d'acheter un pack de crédits supplémentaires, soit de passer à l'offre supérieure.",
  ],
  [
    "Quels sont les plans ?",
    "Core à 79 €/mois approfondit le contexte, le pilotage, le Morning Brief et le rafraîchissement hebdomadaire. Action à 179 €/mois ouvre le moteur d'exécution et le suivi des résultats ; les automatisations exécutables sont ensuite achetées séparément au prix affiché. Scale à 399 €/mois ajoute l'audit avancé, l'intelligence financière, les analyses croisées et 10 utilisateurs inclus. Les crédits couvrent l'usage courant des fonctions et automatisations, pas leur prix d'achat initial.",
  ],
  [
    "Comment sont facturées les automatisations ?",
    "Une offre Action ou Scale est nécessaire pour accéder au moteur d'exécution. Chaque automatisation exécutable est ensuite achetée une seule fois au prix affiché. Après le premier abonnement, Pilotzia utilise le compte Stripe déjà associé à l'entreprise afin d'éviter de ressaisir la carte à chaque achat ; une confirmation bancaire supplémentaire peut toutefois être demandée. L'usage courant de l'automatisation consomme ensuite les crédits du plan.",
  ],
  [
    "Pilotzia peut-il analyser un bilan ou un compte de résultat ?",
    "Scale permet d'analyser un PDF financier, d'extraire les données structurées, de calculer des ratios déterministes, de signaler les informations manquantes et de produire des priorités. Une extraction trop incertaine n'alimente pas le Business Graph, et un document semblant appartenir à une autre entreprise est bloqué avant intégration sauf validation tracée d'un rôle autorisé.",
  ],
  [
    "Puis-je résilier ?",
    "Oui. Les offres mensuelles sont sans engagement au-delà de la période déjà payée. Vous pouvez résilier depuis l'espace de facturation ; la résiliation prend effet à la fin de la période en cours, selon les CGV.",
  ],
  [
    "Puis-je supprimer mes données ?",
    "Oui. Vous pouvez demander l'accès, l'export ou l'effacement des données personnelles concernées via l'assistance Pilotzia. La demande est traitée selon les obligations légales et les durées de conservation applicables ; les éléments devant être conservés pour la facturation, la sécurité ou la preuve ne sont pas supprimés avant l'expiration de leur durée légale.",
  ],
  [
    "Pilotzia revend-il mes données ?",
    "Non. Le modèle produit n'est pas fondé sur la revente de données brutes client. Les données connectées servent à fournir le service, sous réserve des traitements et sous-traitants décrits dans la politique de confidentialité.",
  ],
  [
    "Comment Pilotzia reste-t-il à jour ?",
    "Le contexte opérationnel est rafraîchi automatiquement chaque semaine pour les espaces éligibles : sources connectées, Business Graph et opportunités déterministes sont réévalués. Ce refresh est conçu pour coûter 0 € d'IA lorsqu'aucune analyse payante n'est nécessaire ; toute future analyse IA hebdomadaire devra respecter une enveloppe explicite avant exécution.",
  ],
  [
    "Les gains affichés sont-ils garantis ?",
    "Non. Pilotzia sépare les estimations de potentiel des résultats observés ou déclarés. Le temps gagné ou l'impact financier renseigné par un utilisateur reste identifié comme une déclaration, tandis que les métriques issues d'un fournisseur sont conservées avec leur provenance. Aucun résultat futur n'est garanti.",
  ],
];

export default function FaqPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${SITE_URL}/faq`,
    mainEntity: FAQ.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">FAQ</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Comprendre {APP_NAME} avant de connecter votre entreprise</h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          La valeur, les limites, le niveau de preuve, les permissions, l'utilisation des données et la facturation doivent être compréhensibles avant toute souscription.
        </p>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
          {FAQ.map(([question, answer]) => (
            <section key={question} className="p-5 sm:p-6">
              <h2 className="font-semibold">{question}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
            </section>
          ))}
        </div>
        <div className="mt-8 rounded-2xl bg-accent-soft p-5 text-sm leading-6">
          Besoin de vérifier les règles contractuelles ou de confidentialité ? Consultez les <Link className="font-semibold text-accent" href="/cgv">CGV</Link> et la <Link className="font-semibold text-accent" href="/confidentialite">politique de confidentialité</Link>. Vous pouvez aussi <Link className="font-semibold text-accent" href="/#diagnostic">tester une première question gratuitement</Link>.
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </div>
  );
}
