import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { APP_NAME } from "@/lib/config";

const FAQ = [
  ["Que fait Pilotzia ?", "Pilotzia relie le contexte utile de votre entreprise, le structure en Business Graph, détecte ce qui mérite votre attention et vous aide à agir dans vos outils selon les permissions que vous choisissez."],
  ["Dois-je connecter tous mes outils ?", "Non. Vous pouvez commencer avec une seule source. Chaque connexion supplémentaire enrichit le contexte et débloque de nouveaux cas d'usage, sans obligation de tout connecter."],
  ["Pilotzia stocke-t-il le contenu de mes emails ?", "Le produit privilégie la minimisation des données. Les observations opérationnelles sont structurées et traçables ; le stockage intégral de contenus bruts n'est pas nécessaire par défaut. Les traitements dépendent toutefois du connecteur et du cas d'usage activé."],
  ["Pilotzia peut-il agir sans mon accord ?", "Les actions sont gouvernées par un niveau de permission. Les opérations sensibles, irréversibles ou à risque élevé nécessitent une confirmation explicite. L'autonomie est réservée aux actions à faible risque que vous avez autorisées."],
  ["Comment fonctionne l'essai ?", "L'essai complet est borné à 14 jours, 100 crédits et une enveloppe technique interne de sécurité. Le premier plafond atteint arrête les nouvelles consommations coûteuses. Votre contexte et votre historique ne sont pas supprimés à la fin de l'essai."],
  ["Pourquoi y a-t-il des crédits ?", "Les crédits évitent l'usage illimité de fonctions qui ont un coût externe réel, comme certaines analyses IA ou actions. La connexion et la structuration du contexte restent conçues pour être généreuses afin de ne pas décourager l'enrichissement de Pilotzia."],
  ["Que se passe-t-il si j'atteins ma limite ?", "Pilotzia conserve votre espace, votre contexte et votre historique. Les nouvelles opérations coûteuses sont simplement suspendues jusqu'à l'activation d'un abonnement ou au renouvellement d'une enveloppe prévue par votre offre."],
  ["Quels sont les plans ?", "Core est proposé à 49 €/mois, Action à 99 €/mois et Scale à 249 €/mois. Les fonctionnalités et volumes peuvent évoluer ; le prix applicable est celui affiché au moment de la souscription."],
  ["Puis-je résilier ?", "Oui. Vous pouvez gérer votre abonnement depuis l'espace de facturation. La résiliation prend effet selon la période de facturation en cours et les conditions précisées dans les CGV."],
  ["Puis-je supprimer mes données ?", "Oui. Pilotzia doit permettre l'exercice de vos droits sur les données personnelles et la suppression du compte selon les obligations légales et les durées de conservation applicables."],
  ["Pilotzia revend-il mes données ?", "Non. Le modèle produit n'est pas fondé sur la revente de données brutes client. Les données connectées servent à fournir le service, sous réserve des traitements et sous-traitants décrits dans la politique de confidentialité."],
  ["Le ROI affiché est-il garanti ?", "Non. Les économies de temps, valeurs et ROI affichés sont des estimations destinées à aider à prioriser. Ils ne constituent pas une garantie de résultat."],
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">FAQ</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Comprendre {APP_NAME} avant de connecter votre entreprise</h1>
        <p className="mt-4 max-w-3xl text-muted-foreground">Nous voulons que la valeur, les limites, les permissions et l'utilisation des données soient compréhensibles avant toute souscription.</p>
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
          {FAQ.map(([question, answer]) => (
            <section key={question} className="p-5 sm:p-6">
              <h2 className="font-semibold">{question}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
            </section>
          ))}
        </div>
        <div className="mt-8 rounded-2xl bg-accent-soft p-5 text-sm">
          Besoin de vérifier les règles contractuelles ou de confidentialité ? Consultez les <Link className="font-semibold text-accent" href="/cgv">CGV</Link> et la <Link className="font-semibold text-accent" href="/confidentialite">politique de confidentialité</Link>.
        </div>
      </main>
    </div>
  );
}
