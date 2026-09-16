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
  businessModel?: string | null;
  customerProfile?: string | null;
  localContext?: string | null;
  domainContexts?: {
    finance?: string | null;
    accounting?: string | null;
    sales?: string | null;
    marketing?: string | null;
    hr?: string | null;
    operations?: string | null;
  };
  knowledgeCoverage?: {
    overall: number;
    level: string;
    sections: Array<{
      key: string;
      label: string;
      score: number;
      freshness?: string;
      lastUpdatedAt?: string | null;
      nextQuestion?: string | null;
      dimensions?: Array<{ key: string; label: string; status: string; question: string }>;
    }>;
  } | null;
  businessRhythms?: Array<{
    key: string;
    domain: string;
    title: string;
    cadence: string;
    months: number[];
    nextExpectedAt: string;
    leadDays: number;
    confidence: number;
    summary: string;
  }>;
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
  businessGraph?: {
    readinessScore: number;
    entityCount: number;
    factCount: number;
    connectedSourceCount: number;
    freshSourceCount: number;
    entityTypes: Array<{ type: string; count: number }>;
  } | null;
  evidence?: Array<{
    subject: string;
    predicate: string;
    value: unknown;
    source: string;
    confidence: number;
    observedAt: string;
  }>;
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
  topOpportunities?: Array<{
    id: string;
    title: string;
    category: string;
    impactLevel: string;
    complexity: string;
    estimatedHoursPerMonth: number;
    estimatedValueEur: number;
    status: string;
  }>;
}

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  reply: string;
  matchedTemplateId?: string;
}