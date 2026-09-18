import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";

const sections = [
  ["1. Responsable du traitement", "EVOLUSS, SASU, éditrice de Pilotzia, dont le siège social est situé 1 rue Marguerin, 75014 Paris, France, est responsable des traitements réalisés pour fournir Pilotzia. Contact général : contact@pilotzia.com. Contact données personnelles : dpo-contact@pilotzia.com."],
  ["2. Données traitées", "Pilotzia peut traiter des données de compte et d'entreprise, des données de facturation, des journaux d'usage et de sécurité, des informations liées aux rôles et permissions, des métadonnées opérationnelles, des données issues des outils connectés dans la limite des scopes accordés, ainsi que les documents volontairement transmis pour les fonctionnalités activées. Le produit est conçu pour éviter de conserver les contenus bruts lorsqu'ils ne sont pas nécessaires."],
  ["3. Finalités", "Les données sont utilisées pour créer et sécuriser le compte, fournir le service, construire le contexte opérationnel de l'entreprise, synchroniser les intégrations autorisées, produire des recommandations, préparer ou exécuter les actions validées, maintenir le Business Graph, effectuer le rafraîchissement hebdomadaire, mesurer les résultats, gérer la facturation, prévenir les abus et traiter les demandes d'assistance."],
  ["4. Bases juridiques", "Selon le traitement, EVOLUSS s'appuie sur l'exécution du contrat, son intérêt légitime à sécuriser et améliorer le service, le respect de ses obligations légales et, lorsque la réglementation l'exige, le consentement."],
  ["5. Provenance, IA et minimisation", "Pilotzia distingue les informations renseignées par les utilisateurs, les observations provenant d'une API, les calculs, les estimations et les résultats déclarés. Lorsqu'une fonctionnalité nécessite un fournisseur d'IA, seul le contexte utile à la tâche est transmis dans la mesure du possible. Les résultats estimés ne sont pas présentés comme des résultats constatés."],
  ["6. Sous-traitants et services tiers", "Pilotzia peut recourir notamment à IONOS pour l'hébergement, Anthropic pour certaines fonctionnalités d'intelligence artificielle, Stripe pour la facturation et les paiements, Resend pour l'envoi d'emails transactionnels, n8n pour l'orchestration de certains workflows et Google lorsque l'utilisateur connecte explicitement Google Workspace. Les prestataires n'accèdent qu'aux données nécessaires à leur rôle."],
  ["7. Connexions externes", "Une connexion à Google Workspace ou à un autre fournisseur repose sur une autorisation explicite. Pilotzia n'accède qu'aux scopes demandés et autorisés. Une connexion peut être révoquée depuis Pilotzia lorsqu'une fonction de déconnexion est disponible et directement auprès du fournisseur."],
  ["8. Sécurité", "Pilotzia met en œuvre des contrôles d'accès par rôle, des journaux d'audit, la protection des secrets et tokens sensibles, des mécanismes d'idempotence et de limitation d'abus, des validations humaines pour les actions sensibles et une séparation entre contexte métier, permissions et secrets techniques."],
  ["9. Conservation", "Les diagnostics publics non revendiqués sont supprimés après 30 jours. Les éléments techniques temporaires de limitation d'abus et d'authentification sont conservés pendant une durée limitée compatible avec leur finalité, notamment 90 jours pour certains journaux de sécurité. Les données contractuelles et d'entreprise sont conservées pendant la relation commerciale puis supprimées ou anonymisées dans un délai raisonnable, sous réserve des informations devant être conservées pour les obligations comptables, fiscales, de sécurité ou de preuve."],
  ["10. Facturation et pièces comptables", "Les informations nécessaires à la facturation et les pièces devant être conservées au titre des obligations comptables ou fiscales peuvent être conservées pendant les durées légales applicables, y compris après la fermeture du compte. Les données de carte bancaire sont traitées par le prestataire de paiement et ne sont pas stockées par Pilotzia lorsque le prestataire prend directement en charge le paiement."],
  ["11. Transferts hors EEE", "Certains prestataires peuvent traiter des données en dehors de l'Espace économique européen. Lorsqu'un transfert hors EEE est nécessaire, EVOLUSS s'appuie sur les mécanismes juridiques applicables et les garanties contractuelles disponibles auprès du prestataire concerné."],
  ["12. Vos droits", "Selon votre situation, vous pouvez demander l'accès, la rectification, l'effacement, la limitation, l'opposition ou la portabilité de vos données et retirer un consentement lorsqu'il constitue la base du traitement. Les demandes peuvent être adressées à dpo-contact@pilotzia.com ou via l'assistance Pilotzia. Vous pouvez également introduire une réclamation auprès de la CNIL."],
  ["13. Données des collaborateurs et contacts", "Le client professionnel doit s'assurer qu'il dispose d'une base légitime pour importer ou connecter les données relatives à ses collaborateurs, prospects, clients et partenaires. Pilotzia fournit des contrôles de rôles, d'exclusion et de traçabilité, mais ne remplace pas les obligations propres du client en tant que responsable de ses traitements."],
  ["14. Vente de données", "EVOLUSS ne commercialise pas les données brutes de ses clients et n'a pas pour modèle économique la revente des conversations, documents ou données opérationnelles de l'entreprise."],
  ["15. Modifications", "Cette politique peut évoluer avec le service, les fournisseurs utilisés ou la réglementation. Les modifications substantielles sont portées à la connaissance des utilisateurs de manière appropriée."],
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Données personnelles</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Politique de confidentialité</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Dernière mise à jour : 18 septembre 2026.</p>
        <div className="mt-10 space-y-7">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Voir aussi les <Link href="/cgv" className="font-semibold text-accent">CGV</Link> et les <Link href="/mentions-legales" className="font-semibold text-accent">mentions légales</Link>.
        </p>
      </main>
    </div>
  );
}
