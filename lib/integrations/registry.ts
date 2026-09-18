export type PermissionMode = "read_only" | "read_action_confirm" | "autonomous_low_risk";

export interface IntegrationDefinition {
  name: string;
  category: "email" | "calendar" | "crm" | "collaboration" | "knowledge" | "commerce" | "payments" | "other";
  permissionMode: PermissionMode;
  permissionLabel: string;
  sensitiveActions: string[];
  mvpPriority: "now" | "next" | "later";
}

const DEFINITIONS: IntegrationDefinition[] = [
  {
    name: "Gmail",
    category: "email",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["envoyer un email", "archiver en masse", "supprimer un message"],
    mvpPriority: "now",
  },
  {
    name: "Google Calendar",
    category: "calendar",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["créer, déplacer ou annuler un rendez-vous"],
    mvpPriority: "now",
  },
  {
    name: "Slack",
    category: "collaboration",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["publier un message", "modifier un message"],
    mvpPriority: "next",
  },
  {
    name: "Notion",
    category: "knowledge",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["modifier ou supprimer une page"],
    mvpPriority: "next",
  },
  {
    name: "HubSpot",
    category: "crm",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["modifier un contact", "changer une étape du pipeline", "envoyer une communication"],
    mvpPriority: "next",
  },
  {
    name: "Stripe",
    category: "payments",
    permissionMode: "read_only",
    permissionLabel: "Lecture seule recommandée par défaut",
    sensitiveActions: ["rembourser", "annuler", "déplacer de l'argent"],
    mvpPriority: "next",
  },
  {
    name: "Shopify",
    category: "commerce",
    permissionMode: "read_action_confirm",
    permissionLabel: "Lecture + actions avec confirmation",
    sensitiveActions: ["modifier une commande", "changer un prix", "modifier un produit"],
    mvpPriority: "next",
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
    }
  );
}

export const MVP_INTEGRATIONS = DEFINITIONS.filter((definition) => definition.mvpPriority === "now");
