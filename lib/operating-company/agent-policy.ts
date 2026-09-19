export type AgentRole = "sales" | "reception" | "collections" | "support" | "operations";
export type AutonomyLevel = "observe" | "prepare" | "execute_low_risk";

export interface AgentCapability {
  role: AgentRole;
  label: string;
  goal: string;
  autonomy: AutonomyLevel;
  allowedActions: string[];
  alwaysConfirm: string[];
  kpis: string[];
}

export const AGENT_CAPABILITIES: Record<AgentRole, AgentCapability> = {
  sales: {
    role: "sales",
    label: "Commercial",
    goal: "Réduire le délai de réponse et faire progresser les opportunités commerciales.",
    autonomy: "prepare",
    allowedActions: ["qualify_lead", "prepare_reply", "prepare_followup", "prepare_meeting", "update_context"],
    alwaysConfirm: ["send_external_message", "discount", "contract_commitment"],
    kpis: ["demand_received", "quote_sent", "quote_accepted", "response_delay"],
  },
  reception: {
    role: "reception",
    label: "Accueil",
    goal: "Trier les demandes entrantes et préparer leur orientation.",
    autonomy: "prepare",
    allowedActions: ["classify_request", "prepare_reply", "prepare_meeting"],
    alwaysConfirm: ["send_external_message", "cancel_meeting"],
    kpis: ["demand_received", "response_delay"],
  },
  collections: {
    role: "collections",
    label: "Recouvrement",
    goal: "Réduire les retards de paiement sans dépasser les règles définies par l'entreprise.",
    autonomy: "prepare",
    allowedActions: ["detect_overdue_invoice", "prepare_followup", "summarize_account"],
    alwaysConfirm: ["send_external_message", "payment_commitment", "legal_escalation"],
    kpis: ["invoice_paid", "overdue_invoice", "collection_delay"],
  },
  support: {
    role: "support",
    label: "Support",
    goal: "Préparer des réponses fiables et escalader les situations qui dépassent le périmètre autorisé.",
    autonomy: "prepare",
    allowedActions: ["classify_request", "prepare_reply", "summarize_case"],
    alwaysConfirm: ["send_external_message", "refund", "contract_commitment"],
    kpis: ["demand_received", "response_delay", "case_resolved"],
  },
  operations: {
    role: "operations",
    label: "Opérations",
    goal: "Surveiller les processus et préparer les ajustements utiles.",
    autonomy: "observe",
    allowedActions: ["detect_exception", "prepare_schedule_change", "prepare_supplier_followup"],
    alwaysConfirm: ["change_schedule", "send_external_message", "purchase_commitment"],
    kpis: ["planning_optimized", "supplier_followup", "operational_exception"],
  },
};

export function requiresHumanConfirmation(role: AgentRole, action: string) {
  const policy = AGENT_CAPABILITIES[role];
  return policy.alwaysConfirm.includes(action) || !policy.allowedActions.includes(action);
}
