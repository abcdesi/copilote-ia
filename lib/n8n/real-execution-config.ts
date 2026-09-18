import type { ApprovalMode } from "@/lib/automations/governance";

export interface RealExecutionConfig {
  contactListTitle: string;
  contactListDescription: string;
  emptyLabel: string;
  defaultSubject: string;
  defaultBody: string;
  defaultCadenceDays: number | null;
  defaultMaxSendsPerContact: number;
  riskLevel: "low" | "medium" | "high";
  recommendedApprovalMode: ApprovalMode;
  allowedApprovalModes: ApprovalMode[];
}

const PROFESSIONAL_SIGNATURE =
  "Bien cordialement,\n\n{{company_name}}\n{{phone}}\n{{address}}\nSIRET : {{siret}}";

const REAL_EXECUTION_CONFIGS: Record<string, RealExecutionConfig> = {
  "relance-prospects": {
    contactListTitle: "Prospects suivis",
    contactListDescription:
      "Pilotzia sélectionne uniquement les prospects encore actifs qui respectent la cadence et la limite de relances définies.",
    emptyLabel: "Aucun prospect actif pour l'instant.",
    defaultSubject: "Suite à notre échange — {{company_name}}",
    defaultBody:
      `Bonjour {{name}},\n\nJe me permets de revenir vers vous à la suite de notre dernier échange. Je reste à votre disposition si vous souhaitez avancer ou si vous avez besoin d'un complément d'information.\n\n${PROFESSIONAL_SIGNATURE}`,
    defaultCadenceDays: 7,
    defaultMaxSendsPerContact: 3,
    riskLevel: "low",
    recommendedApprovalMode: "first_then_auto",
    allowedApprovalModes: ["first_then_auto", "always_review"],
  },
  "onboarding-clients": {
    contactListTitle: "Nouveaux clients",
    contactListDescription:
      "Un message de bienvenue est envoyé une seule fois à chaque client actif ajouté à cette automatisation.",
    emptyLabel: "Aucun nouveau client pour l'instant.",
    defaultSubject: "Bienvenue chez {{company_name}}",
    defaultBody:
      `Bonjour {{name}},\n\nNous vous remercions pour votre confiance et sommes heureux de vous compter parmi nos clients. Nous revenons vers vous avec les prochaines étapes utiles à votre démarrage.\n\n${PROFESSIONAL_SIGNATURE}`,
    defaultCadenceDays: null,
    defaultMaxSendsPerContact: 1,
    riskLevel: "low",
    recommendedApprovalMode: "first_then_auto",
    allowedApprovalModes: ["first_then_auto", "always_review"],
  },
  "suivi-satisfaction": {
    contactListTitle: "Clients à sonder",
    contactListDescription:
      "Chaque client reçoit au maximum une demande de retour pour cette séquence afin d'éviter les sollicitations répétitives.",
    emptyLabel: "Aucun client à sonder pour l'instant.",
    defaultSubject: "Votre retour sur votre expérience avec {{company_name}}",
    defaultBody:
      `Bonjour {{name}},\n\nDans une démarche d'amélioration continue, nous souhaiterions recueillir votre retour sur votre expérience récente avec {{company_name}}. Quelques lignes en réponse à cet email nous seront très utiles.\n\nMerci par avance pour votre retour.\n\n${PROFESSIONAL_SIGNATURE}`,
    defaultCadenceDays: null,
    defaultMaxSendsPerContact: 1,
    riskLevel: "low",
    recommendedApprovalMode: "first_then_auto",
    allowedApprovalModes: ["first_then_auto", "always_review"],
  },
  "relance-factures": {
    contactListTitle: "Factures à relancer",
    contactListDescription:
      "Pilotzia applique la cadence choisie et arrête automatiquement après le nombre maximal de relances prévu.",
    emptyLabel: "Aucune facture à relancer pour l'instant.",
    defaultSubject: "Rappel concernant votre règlement — {{company_name}}",
    defaultBody:
      `Bonjour {{name}},\n\nSauf erreur de notre part, un règlement reste en attente. Nous vous remercions de bien vouloir vérifier sa situation ou de revenir vers nous si un élément nécessite clarification.\n\n${PROFESSIONAL_SIGNATURE}`,
    defaultCadenceDays: 7,
    defaultMaxSendsPerContact: 4,
    riskLevel: "medium",
    recommendedApprovalMode: "first_then_auto",
    allowedApprovalModes: ["first_then_auto", "always_review"],
  },
};

export function getRealExecutionConfig(templateId: string): RealExecutionConfig | undefined {
  return REAL_EXECUTION_CONFIGS[templateId];
}

export function isRealExecutionTemplate(templateId: string): boolean {
  return templateId in REAL_EXECUTION_CONFIGS;
}
