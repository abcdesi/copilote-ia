// Config des automatisations à exécution réelle basées sur une liste de contacts +
// un email envoyé via le moteur n8n. Un seul moteur générique (lib/n8n/workflows.ts),
// paramétré ici par templateId — ajouter une nouvelle automatisation de ce type ne
// demande qu'une entrée ici, pas un nouveau workflow n8n écrit à la main.

export interface RealExecutionConfig {
  contactListTitle: string;
  contactListDescription: string;
  emptyLabel: string;
  defaultSubject: string;
  defaultBody: string;
  // Nombre de jours avant de recontacter un même contact ; null = un seul envoi jamais répété
  // (ex: message de bienvenue, on ne va pas re-souhaiter la bienvenue tous les 7 jours).
  recontactDays: number | null;
}

const REAL_EXECUTION_CONFIGS: Record<string, RealExecutionConfig> = {
  "relance-prospects": {
    contactListTitle: "Vos prospects",
    contactListDescription:
      "Cette automatisation relance automatiquement les prospects sans réponse depuis plusieurs jours.",
    emptyLabel: "Aucun prospect pour l'instant.",
    defaultSubject: "{{name}}, un petit rappel de notre part",
    defaultBody:
      "Bonjour {{name}},\n\nNous voulions simplement prendre de vos nouvelles suite à notre dernier échange. N'hésitez pas à nous répondre si vous avez des questions.\n\nCordialement",
    recontactDays: 7,
  },
  "onboarding-clients": {
    contactListTitle: "Vos nouveaux clients",
    contactListDescription:
      "Cette automatisation envoie un message de bienvenue à chaque nouveau client ajouté à la liste.",
    emptyLabel: "Aucun nouveau client pour l'instant.",
    defaultSubject: "Bienvenue {{name}} !",
    defaultBody:
      "Bonjour {{name}},\n\nBienvenue ! Nous sommes ravis de vous compter parmi nos clients. Notre équipe revient vers vous très rapidement avec les prochaines étapes.\n\nCordialement",
    recontactDays: null,
  },
  "suivi-satisfaction": {
    contactListTitle: "Vos clients à sonder",
    contactListDescription: "Cette automatisation envoie un court sondage de satisfaction à vos clients.",
    emptyLabel: "Aucun client à sonder pour l'instant.",
    defaultSubject: "{{name}}, votre avis compte pour nous",
    defaultBody:
      "Bonjour {{name}},\n\nAfin de continuer à vous offrir le meilleur service, pourriez-vous prendre 30 secondes pour nous dire comment s'est passée votre expérience récente ? Répondez simplement à cet email.\n\nMerci et à bientôt !",
    recontactDays: 30,
  },
};

export function getRealExecutionConfig(templateId: string): RealExecutionConfig | undefined {
  return REAL_EXECUTION_CONFIGS[templateId];
}

export function isRealExecutionTemplate(templateId: string): boolean {
  return templateId in REAL_EXECUTION_CONFIGS;
}
