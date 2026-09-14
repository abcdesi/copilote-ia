import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";

const sections = [
  ["1. Objet", "Cette politique explique comment Pilotzia traite les données personnelles nécessaires à la création d'un compte, à la fourniture du service, à la connexion d'outils tiers, au support, à la sécurité et à la facturation."],
  ["2. Responsable du traitement", "Le responsable du traitement est l'éditeur de Pilotzia. Ses informations juridiques complètes doivent figurer dans les mentions légales avant l'ouverture commerciale du service."],
  ["3. Données traitées", "Pilotzia peut traiter des données de compte, d'entreprise, de facturation, d'usage, des identifiants techniques de connexions, des métadonnées opérationnelles et les données nécessaires aux cas d'usage activés. Le produit est conçu pour minimiser le stockage de contenus bruts lorsqu'ils ne sont pas nécessaires."],
  ["4. Finalités", "Les données sont utilisées pour fournir et sécuriser le service, construire et maintenir le contexte opérationnel de l'entreprise, exécuter les fonctionnalités demandées, mesurer l'usage et la qualité, gérer la facturation, prévenir les abus et répondre aux demandes de support."],
  ["5. Bases juridiques", "Selon le traitement, Pilotzia s'appuie notamment sur l'exécution du contrat, l'intérêt légitime lié à la sécurité et à l'amélioration du service, le respect d'obligations légales et, lorsque requis, le consentement."],
  ["6. Sous-traitants et services tiers", "Pilotzia peut recourir à des prestataires d'hébergement, d'IA, de paiement, d'emailing, de monitoring et d'automatisation. Les données ne sont transmises qu'aux prestataires nécessaires à la fourniture du service et dans la limite de leur rôle."],
  ["7. Connexions à des services externes", "Lorsqu'un utilisateur connecte Google Workspace ou un autre fournisseur, Pilotzia n'accède qu'aux scopes autorisés. Les permissions peuvent être retirées auprès du fournisseur et, lorsque disponible, depuis Pilotzia."],
  ["8. Conservation", "Les données sont conservées pendant la durée nécessaire à la fourniture du service, à la sécurité, au respect des obligations comptables et légales, puis supprimées ou anonymisées selon les durées applicables. Les durées précises seront documentées à mesure que chaque catégorie de traitement est activée en production."],
  ["9. Transferts hors EEE", "Certains prestataires peuvent traiter des données hors de l'Espace économique européen. Lorsque cela s'applique, Pilotzia doit s'appuyer sur un mécanisme de transfert reconnu et les garanties contractuelles appropriées."],
  ["10. Vos droits", "Selon votre situation, vous pouvez demander l'accès, la rectification, l'effacement, la limitation, l'opposition ou la portabilité de vos données, ainsi que retirer un consentement lorsqu'il constitue la base du traitement. Vous pouvez également introduire une réclamation auprès de la CNIL."],
  ["11. Sécurité", "Pilotzia met en œuvre des mesures techniques et organisationnelles adaptées, notamment la limitation des accès, le chiffrement des secrets et tokens sensibles lorsqu'ils sont stockés, et la séparation entre contexte métier et secrets d'authentification."],
  ["12. IA et données client", "Les données client peuvent être transmises à un fournisseur d'IA lorsque cela est nécessaire pour répondre à une fonctionnalité activée. Pilotzia cherche à envoyer uniquement le contexte nécessaire et à conserver la provenance des informations utilisées."],
  ["13. Modifications", "Cette politique peut évoluer avec les fonctionnalités et les fournisseurs utilisés. Une modification substantielle doit être portée à la connaissance des utilisateurs de manière appropriée."],
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Données personnelles</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Politique de confidentialité</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Version de travail du 14 septembre 2026. Elle devra être complétée avec l'identité juridique définitive de l'éditeur et validée avant commercialisation à grande échelle.</p>
        <div className="mt-10 space-y-7">
          {sections.map(([title, body]) => <section key={title}><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></section>)}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">Voir aussi les <Link href="/cgv" className="font-semibold text-accent">CGV</Link> et les <Link href="/mentions-legales" className="font-semibold text-accent">mentions légales</Link>.</p>
      </main>
    </div>
  );
}
