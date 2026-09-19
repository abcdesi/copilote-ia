import {
  CUSTOMER_MANAGED_INTEGRATION_POLICY,
  type IntegrationAccountOwnership,
  type IntegrationAuthMode,
  type IntegrationSubscriptionOwner,
} from "@/lib/integrations/connection-framework";

export type PermissionMode = "read_only" | "read_action_confirm" | "autonomous_low_risk";

export interface IntegrationDefinition {
  name: string;
  category: "email" | "calendar" | "crm" | "collaboration" | "knowledge" | "commerce" | "payments" | "other";
  permissionMode: PermissionMode;
  permissionLabel: string;
  sensitiveActions: string[];
  mvpPriority: "now" | "next" | "later";
  authMode: IntegrationAuthMode;
  accountOwnership: IntegrationAccountOwnership;
  subscriptionOwner: IntegrationSubscriptionOwner;
}

const customerManaged = {
  accountOwnership: CUSTOMER_MANAGED_INTEGRATION_POLICY.accountOwnership,
  subscriptionOwner: CUSTOMER_MANAGED_INTEGRATION_POLICY.subscriptionOwner,
};

const DEFINITIONS: IntegrationDefinition[] = [
  {
    name: "Gmail",
    category: "email",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["envoyer un email", "archiver en masse", "supprimer un message"],
    mvpPriority: "now",
    authMode: "oauth",
    ...customerManaged,
  },
  {
    name: "Google Calendar",
    category: "calendar",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["créer, déplacer ou annuler un rendez-vous"],
    mvpPriority: "now",
    authMode: "oauth",
    ...customerManaged,
  },
  {
    name: "Slack",
    category: "collaboration",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["publier un message", "modifier un message"],
    mvpPriority: "next",
    authMode: "oauth",
    ...customerManaged,
  },
  {
    name: "Notion",
    category: "knowledge",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["modifier ou supprimer une page"],
    mvpPriority: "next",
    authMode: "oauth",
    ...customerManaged,
  },
  {
    name: "HubSpot",
    category: "crm",
    permissionMode: "read_only",
    permissionLabel: "OAuth lecture seule · deals gagnés observés",
    sensitiveActions: ["modifier un contact", "changer une étape du pipeline", "envoyer une communication"],
    mvpPriority: "now",
    authMode: "oauth",
    ...customerManaged,
  },
  {
    name: "Google Analytics 4",
    category: "other",
    permissionMode: "read_only",
    permissionLabel: "API Google disponible · analytics.readonly",
    sensitiveActions: [],
    mvpPriority: "now",
    authMode: "oauth",
    ...customerManaged,
  },
  {
    name: "Google Ads",
    category: "other",
    permissionMode: "read_only",
    permissionLabel: "API Google disponible · Pilotzia lit uniquement les performances",
    sensitiveActions: ["modifier un budget de campagne", "mettre en pause une campagne"],
    mvpPriority: "now",
    authMode: "oauth",
    ...customerManaged,
  },
  {
    name: "Meta Ads",
    category: "other",
    permissionMode: "read_only",
    permissionLabel: "Application renseignée · connexion API prévue en lecture seule",
    sensitiveActions: ["modifier un budget de campagne", "mettre en pause une campagne"],
    mvpPriority: "next",
    authMode: "oauth",
    ...customerManaged,
  },
  {
    name: "LinkedIn Ads",
    category: "other",
    permissionMode: "read_only",
    permissionLabel: "Application renseignée · connexion API prévue en lecture seule",
    sensitiveActions: ["modifier un budget de campagne", "mettre en pause une campagne"],
    mvpPriority: "next",
    authMode: "oauth",
    ...customerManaged,
  },
  {
    name: "Stripe",
    category: "payments",
    permissionMode: "read_only",
    permissionLabel: "Webhook signé · factures payées uniquement",
    sensitiveActions: ["rembourser", "annuler", "déplacer de l'argent"],
    mvpPriority: "now",
    authMode: "signed_webhook",
    ...customerManaged,
  },
  {
    name: "Shopify",
    category: "commerce",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["modifier une commande", "changer un prix", "modifier un produit"],
    mvpPriority: "next",
    authMode: "oauth",
    ...customerManaged,
  },
];

export function getIntegrationDefinition(name: string): IntegrationDefinition {
  return (
    DEFINITIONS.find((definition) => definition.name === name) ?? {
      name,
      category: "other",
      permissionMode: "read_action_confirm",
      permissionLabel: "Permissions à définir lors de la connexion",
      sensitiveActions: [],
      mvpPriority: "later",
      authMode: "manual",
      ...customerManaged,
    }
  );
}

export const MVP_INTEGRATIONS = DEFINITIONS.filter((definition) => definition.mvpPriority === "now");
export const INTEGRATION_DEFINITIONS = DEFINITIONS;
