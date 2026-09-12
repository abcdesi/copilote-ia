export interface DiagnosticOpportunity {
  templateId: string;
  title: string;
  description: string;
  category: string;
  impactLevel: "low" | "medium" | "high";
  complexity: "low" | "medium" | "high";
  estimatedHoursPerMonth: number;
  estimatedValueEur: number;
  priceEur: number;
  steps: string[];
}

export interface DiagnosticResult {
  automationScore: number;
  detectedTools: string[];
  opportunities: DiagnosticOpportunity[];
  potentialHoursPerMonth: number;
  potentialValueEur: number;
  summary: string;
}

export interface ChatContext {
  companyId: string;
  companyName: string;
  industry?: string | null;
  country?: string | null;
  sizeRange?: string | null;
  objectives?: string | null;
  painPoints?: string | null;
  tools: string[];
  connections: {
    provider: string;
    status: string;
    accountLabel?: string | null;
    lastSyncedAt?: string | null;
  }[];
  observations?: {
    unreadInboxLast7Days?: number;
    upcomingEventsNext7Days?: number;
    observedAt?: string;
  } | null;
  automations: {
    name: string;
    status: string;
    health: string;
    estimatedHoursPerMonth: number;
  }[];
  automationScore: number;
  totalHoursSavedThisMonth: number;
  totalValueEurThisMonth: number;
  topOpportunity?: { title: string; estimatedHoursPerMonth: number } | null;
}

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  reply: string;
  matchedTemplateId?: string;
}
