import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";

const sections = [
  ["1. Champ d'application", "Les présentes conditions générales de vente encadrent l'accès payant au service Pilotzia par des clients professionnels, sauf conditions particulières convenues par écrit."],
  ["2. Service", "Pilotzia fournit un copilote opérationnel permettant notamment de structurer du contexte métier, d'analyser des informations, de recommander des actions, de piloter certaines automatisations et de suivre des résultats. Les fonctionnalités disponibles dépendent de l'offre souscrite et des intégrations effectivement configurées."],
  ["3. Essai", "Un essai peut être proposé avec une durée, des crédits et des plafonds d'usage. L'essai peut s'arrêter dès que l'un des plafonds est atteint. La fin de l'essai ne supprime pas automatiquement le contexte ou l'historique ; certaines fonctions peuvent simplement être suspendues jusqu'à souscription."],
  ["4. Prix", "Sauf indication contraire au moment de la souscription, les offres publiques de référence sont Core à 79 € par mois (869 € par an), Action à 179 € par mois (1 969 € par an) et Scale à 399 € par mois (4 389 € par an). Les prix applicables sont ceux affichés lors de la commande, hors taxes lorsque la fiscalité applicable l'exige. Les crédits supplémentaires éventuels font l'objet d'un prix affiché avant achat."],
  ["5. Facturation et paiement", "Les abonnements sont facturés via le prestataire de paiement configuré par Pilotzia. Le client autorise les prélèvements correspondant à l'offre choisie. Les éventuels crédits ou usages additionnels sont facturés selon les conditions affichées avant achat."],
  ["6. Renouvellement et résiliation", "Sauf offre contraire, l'abonnement se renouvelle automatiquement à chaque période de facturation jusqu'à résiliation. Le client peut résilier depuis l'espace de facturation ou selon la procédure indiquée dans le produit. La résiliation n'emporte pas remboursement automatique de la période déjà commencée."],
  ["7. Obligations du client", "Le client s'engage à fournir des informations exactes, à utiliser le service conformément à la loi, à ne connecter que des systèmes et données pour lesquels il dispose des droits nécessaires, et à protéger ses accès."],
  ["8. Permissions et actions", "Pilotzia distingue lecture, préparation d'action, action avec confirmation et autonomie encadrée. Le client reste responsable du niveau d'autorisation qu'il accorde et des validations qu'il confirme. Les actions sensibles sont conçues pour exiger une validation explicite."],
  ["9. Services tiers", "Certaines fonctionnalités dépendent de services externes tels que fournisseurs d'IA, cloud, paiement, email, automatisation ou applications connectées. Une interruption ou modification d'un service tiers peut affecter temporairement certaines fonctions de Pilotzia."],
  ["10. Données", "Le traitement des données personnelles est décrit dans la politique de confidentialité. Pilotzia n'a pas pour modèle économique la revente de données brutes client. Les systèmes sources restent l'autorité de référence pour les données qui y résident."],
  ["11. Estimations et résultats", "Les scores, gains de temps, économies, opportunités, ROI et recommandations sont des estimations ou aides à la décision. Pilotzia ne garantit pas un résultat financier, commercial ou opérationnel déterminé."],
  ["12. Disponibilité", "Pilotzia s'efforce de maintenir le service disponible et fiable mais ne garantit pas une disponibilité ininterrompue. Des maintenances, incidents, limites de fournisseurs tiers ou mesures de sécurité peuvent entraîner des interruptions."],
  ["13. Responsabilité", "Dans les limites permises par la loi et sauf faute lourde ou obligation contraire, la responsabilité de l'éditeur est limitée aux dommages directs et prévisibles résultant d'un manquement prouvé. Le client demeure responsable de ses décisions métiers et des actions qu'il autorise."],
  ["14. Propriété intellectuelle", "Le logiciel, la marque, les interfaces, modèles, catalogues et éléments fournis par Pilotzia restent protégés par les droits de propriété intellectuelle applicables. Le client conserve ses droits sur ses données et contenus."],
  ["15. Évolution des conditions", "Les présentes conditions peuvent évoluer avec le service, les tarifs ou la réglementation. Les changements substantiels applicables à un abonnement en cours sont communiqués selon un délai raisonnable lorsque cela est requis."],
  ["16. Droit applicable", "Le droit applicable et la juridiction compétente devront être précisés avec l'identité juridique définitive de l'éditeur avant ouverture commerciale. Pour les clients professionnels, les règles de compétence pourront être précisées contractuellement dans le respect du droit applicable."],
];

export default function CgvPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Contrat</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Conditions générales de vente</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Version de travail du 14 septembre 2026. Ces CGV doivent être relues et complétées avec l'identité juridique, la fiscalité, le droit applicable et les coordonnées définitives de l'éditeur avant commercialisation.</p>
        <div className="mt-10 space-y-7">
          {sections.map(([title, body]) => <section key={title}><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></section>)}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">La <Link href="/confidentialite" className="font-semibold text-accent">politique de confidentialité</Link> est distincte des présentes CGV.</p>
      </main>
    </div>
  );
}
