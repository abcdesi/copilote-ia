export type ImpactLevel = "low" | "medium" | "high";
export type Complexity = "low" | "medium" | "high";

export interface AutomationTemplate {
  id: string;
  title: string;
  businessGoal: string;
  description: string;
  category: string;
  keywords: string[]; // pour le pattern-matching du moteur mock
  relevantTools: string[]; // outils qui rendent ce template plus pertinent
  impactLevel: ImpactLevel;
  complexity: Complexity;
  estimatedHoursPerMonth: number;
  priceEur: number;
  steps: string[]; // flux simplifié visible avant achat — jamais la logique interne réelle
}

export const KNOWN_TOOLS = [
  "Gmail",
  "Outlook",
  "Google Sheets",
  "Excel",
  "Slack",
  "Microsoft Teams",
  "Notion",
  "HubSpot",
  "Salesforce",
  "Pipedrive",
  "Shopify",
  "Stripe",
  "Zoom",
  "Google Meet",
  "Trello",
  "Asana",
  "Mailchimp",
  "Google Analytics 4",
  "Google Ads",
  "Meta Ads",
  "LinkedIn Ads",
  "WhatsApp",
  "Airtable",
  "Google Calendar",
] as const;

export const HOURLY_RATE_EUR = 35;
