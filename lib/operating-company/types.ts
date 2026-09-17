export type OperationalEventKind =
  | "demand_received"
  | "quote_sent"
  | "quote_accepted"
  | "invoice_paid"
  | "supplier_followup"
  | "planning_optimized"
  | "action_completed";

export interface OperationalMetric {
  key: OperationalEventKind | string;
  label: string;
  count: number;
  source: string;
}

export interface OperatingDecision {
  id: string;
  title: string;
  description: string;
  riskLevel: string;
  createdAt: string;
}

export interface OperatingBrief {
  from: string;
  to: string;
  metrics: OperationalMetric[];
  decisions: OperatingDecision[];
  completedActions: number;
  evidenceCount: number;
}
