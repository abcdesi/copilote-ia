export type IntegrationAuthMode = "oauth" | "signed_webhook" | "api_key" | "service_account" | "manual";
export type IntegrationAccountOwnership = "customer_managed";
export type IntegrationSubscriptionOwner = "customer";

export type IntegrationConnectionState =
  | "not_connected"
  | "connecting"
  | "connected"
  | "degraded"
  | "needs_reauth"
  | "disconnected";

export interface IntegrationConnectionSnapshot {
  status?: string | null;
  lastError?: string | null;
}

export interface IntegrationConnectionStateOptions {
  requirementsSatisfied?: boolean;
}

export const CUSTOMER_MANAGED_INTEGRATION_POLICY = {
  accountOwnership: "customer_managed" as const,
  subscriptionOwner: "customer" as const,
  principle:
    "Le client conserve son compte, son abonnement et sa relation contractuelle avec le fournisseur. Pilotzia ne fait que se connecter aux accès explicitement autorisés.",
};

export function normalizeIntegrationConnectionState(
  connection?: IntegrationConnectionSnapshot | null,
  options: IntegrationConnectionStateOptions = {}
): IntegrationConnectionState {
  if (!connection) return "not_connected";

  if (connection.status === "needs_reauth") return "needs_reauth";
  if (connection.status === "connecting") return "connecting";
  if (connection.status === "disconnected" || connection.status === "revoked") return "disconnected";

  if (connection.status === "connected") {
    if (options.requirementsSatisfied === false) return "needs_reauth";
    if (connection.lastError) return "degraded";
    return "connected";
  }

  return connection.lastError ? "degraded" : "disconnected";
}

export function integrationConnectionStateLabel(state: IntegrationConnectionState): string {
  switch (state) {
    case "connected":
      return "Connecté";
    case "connecting":
      return "Connexion en cours";
    case "degraded":
      return "Connecté · attention requise";
    case "needs_reauth":
      return "Reconnexion requise";
    case "disconnected":
      return "Déconnecté";
    default:
      return "Non connecté";
  }
}

export function integrationConnectionStateTone(
  state: IntegrationConnectionState
): "success" | "warning" | "danger" | "accent" {
  switch (state) {
    case "connected":
      return "success";
    case "degraded":
    case "needs_reauth":
    case "connecting":
      return "warning";
    case "disconnected":
      return "accent";
    default:
      return "accent";
  }
}
