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
  companyName: string;
  industry?: string | null;
  tools: string[];
  automations: {
    name: string;
    status: string;
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
