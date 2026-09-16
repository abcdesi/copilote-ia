import type { KnowledgeSectionKey } from "@/lib/companies/knowledge-model";

export interface CompanyProfileSummaryInput {
  industry: string | null;
  country: string | null;
  sizeRange: string | null;
  employeeCount: number | null;
  objectives: string | null;
  painPoints: string | null;
  businessModel: string | null;
  customerProfile: string | null;
  localContext: string | null;
  financeContext: string | null;
  marketingContext: string | null;
  accountingContext: string | null;
  salesContext: string | null;
  hrContext: string | null;
  operationsContext: string | null;
  tools: Array<{ name: string }>;
}

export interface CompanyProfileSummaryItem {
  key: KnowledgeSectionKey;
  label: string;
  summary: string;
  href: string;
  filled: boolean;
}

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function excerpt(value: string | null | undefined, max = 220) {
  const text = clean(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function join(parts: Array<string | null | undefined>) {
  return parts.map((part) => clean(part)).filter(Boolean).join(" · ");
}

export function buildCompanyProfileSummary(company: CompanyProfileSummaryInput): CompanyProfileSummaryItem[] {
  const activity = join([
    company.industry ? `Secteur : ${company.industry}` : null,
    company.businessModel ? `Modèle : ${company.businessModel}` : null,
    company.customerProfile ? `Clients : ${excerpt(company.customerProfile, 150)}` : null,
  ]);
  const team = join([
    company.employeeCount ? `${company.employeeCount} employés` : null,
    company.sizeRange ? `Taille : ${company.sizeRange}` : null,
  ]);
  const local = join([
    company.country ? `Zone : ${company.country}` : null,
    company.localContext ? excerpt(company.localContext, 160) : null,
  ]);
  const applications = company.tools.map((tool) => tool.name).filter(Boolean).join(" · ");

  const items: CompanyProfileSummaryItem[] = [
    { key: "activity", label: "Activité", summary: activity, href: "/app/company#activity", filled: Boolean(activity) },
    { key: "team", label: "Équipe", summary: team, href: "/app/company#team", filled: Boolean(team) },
    { key: "objectives", label: "Objectifs", summary: excerpt(company.objectives), href: "/app/company#objectives", filled: Boolean(clean(company.objectives)) },
    { key: "painPoints", label: "Pertes de temps", summary: excerpt(company.painPoints), href: "/app/company#painPoints", filled: Boolean(clean(company.painPoints)) },
    { key: "applications", label: "Applications", summary: applications, href: "/app/tools", filled: Boolean(applications) },
    { key: "local", label: "Contexte local", summary: local, href: "/app/company#local", filled: Boolean(local) },
    { key: "finance", label: "Finance", summary: excerpt(company.financeContext), href: "/app/company#finance", filled: Boolean(clean(company.financeContext)) },
    { key: "accounting", label: "Comptabilité", summary: excerpt(company.accountingContext), href: "/app/company#accounting", filled: Boolean(clean(company.accountingContext)) },
    { key: "sales", label: "Commercial", summary: excerpt(company.salesContext), href: "/app/company#sales", filled: Boolean(clean(company.salesContext)) },
    { key: "marketing", label: "Marketing", summary: excerpt(company.marketingContext), href: "/app/company#marketing", filled: Boolean(clean(company.marketingContext)) },
    { key: "hr", label: "RH", summary: excerpt(company.hrContext), href: "/app/company#hr", filled: Boolean(clean(company.hrContext)) },
    { key: "operations", label: "Opérations", summary: excerpt(company.operationsContext), href: "/app/company#operations", filled: Boolean(clean(company.operationsContext)) },
  ];

  return items;
}
