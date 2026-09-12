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
  country?: string | null;
  sizeRange?: string | null;
  objectives?: string | null;
  painPoints?: string | null;
  tools: string[];
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
  // Présent quand le copilote a trouvé une correspondance catalogue pour un besoin
  // décrit en texte libre — l'appelant matérialise alors une nouvelle Opportunity.
  matchedTemplateId?: string;
}
