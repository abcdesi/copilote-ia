import { prisma } from "@/lib/db/client";

export type KnowledgeSectionKey =
  | "activity"
  | "team"
  | "objectives"
  | "painPoints"
  | "applications"
  | "local"
  | "finance"
  | "accounting"
  | "sales"
  | "marketing"
  | "hr"
  | "operations";

export interface KnowledgeSection {
  key: KnowledgeSectionKey;
  label: string;
  score: number;
  description: string;
  href: string;
}

export interface CompanyKnowledgeCoverage {
  overall: number;
  level: "faible" | "partiel" | "solide" | "avance";
  sections: KnowledgeSection[];
  radar: Array<{ label: string; score: number }>;
  nextSection: KnowledgeSection | null;
  message: string;
}

const DOMAIN_KEYWORDS: Record<"finance" | "accounting" | "sales" | "marketing" | "hr" | "operations", string[]> = {
  finance: ["finance", "cash", "tresorer", "marge", "revenue", "ca", "ebit", "bilan", "resultat", "creance", "dette", "payment", "stripe"],
  accounting: ["compta", "account", "invoice", "factur", "ledger", "journal", "rapproch", "xero", "sage", "pennylane", "quickbooks"],
  sales: ["sales", "commercial", "prospect", "lead", "crm", "pipeline", "devis", "hubspot", "pipedrive", "salesforce"],
  marketing: ["marketing", "campagne", "ads", "acquisition", "seo", "contenu", "mailchimp", "meta", "google_ads", "newsletter"],
  hr: ["rh", "human", "recrut", "employee", "salar", "onboarding", "talent", "factorial", "lucca", "bamboo"],
  operations: ["operation", "process", "workflow", "meeting", "calendar", "notion", "slack", "teams", "support", "production", "delivery"],
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function richTextScore(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 5) return 30;
  if (words < 15) return 55;
  if (words < 35) return 75;
  if (words < 70) return 90;
  return 100;
}

function weighted(parts: Array<[number, number]>) {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  if (!totalWeight) return 0;
  return bounded(parts.reduce((sum, [score, weight]) => sum + score * weight, 0) / totalWeight);
}

function providerOrToolMatches(value: string, keywords: string[]) {
  const normalized = normalize(value);
  return keywords.some((keyword) => normalized.includes(normalize(keyword)));
}

function factMatches(
  fact: { predicate: string; sourceProvider: string; sourceRef: string | null; valueJson: string | null },
  keywords: string[]
) {
  const haystack = normalize(
    `${fact.predicate} ${fact.sourceProvider} ${fact.sourceRef ?? ""} ${fact.valueJson ?? ""}`
  );
  return keywords.some((keyword) => haystack.includes(normalize(keyword)));
}

function domainScore(input: {
  declared: string | null;
  facts: number;
  connectedSignals: number;
}) {
  const declared = richTextScore(input.declared);
  const facts = Math.min(100, input.facts * 25);
  const connections = Math.min(100, input.connectedSignals * 50);
  return weighted([
    [declared, 60],
    [facts, 25],
    [connections, 15],
  ]);
}

export async function getCompanyKnowledgeCoverage(companyId: string): Promise<CompanyKnowledgeCoverage> {
  const [company, connections, facts] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { tools: true } }),
    prisma.integrationConnection.findMany({
      where: { companyId, status: { in: ["connected", "active"] } },
      select: { provider: true, accountLabel: true },
    }),
    prisma.businessFact.findMany({
      where: { companyId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { predicate: true, sourceProvider: true, sourceRef: true, valueJson: true },
      take: 500,
    }),
  ]);

  const signalNames = [
    ...company.tools.map((tool) => tool.name),
    ...connections.flatMap((connection) => [connection.provider, connection.accountLabel ?? ""]),
  ].filter(Boolean);

  const countDomainFacts = (domain: keyof typeof DOMAIN_KEYWORDS) =>
    facts.filter((fact) => factMatches(fact, DOMAIN_KEYWORDS[domain])).length;
  const countDomainConnections = (domain: keyof typeof DOMAIN_KEYWORDS) =>
    signalNames.filter((name) => providerOrToolMatches(name, DOMAIN_KEYWORDS[domain])).length;

  const activityScore = weighted([
    [company.industry ? 100 : 0, 30],
    [richTextScore(company.businessModel), 35],
    [richTextScore(company.customerProfile), 35],
  ]);
  const teamScore = weighted([
    [company.sizeRange ? 100 : 0, 55],
    [company.employeeCount ? 100 : 0, 30],
    [richTextScore(company.hrContext), 15],
  ]);
  const objectivesScore = richTextScore(company.objectives);
  const painPointsScore = richTextScore(company.painPoints);
  const applicationsScore = bounded(Math.min(60, company.tools.length * 15) + Math.min(40, connections.length * 20));
  const localScore = weighted([
    [company.country ? 100 : 0, 55],
    [richTextScore(company.localContext), 45],
  ]);

  const financeScore = domainScore({
    declared: company.financeContext,
    facts: countDomainFacts("finance"),
    connectedSignals: countDomainConnections("finance"),
  });
  const accountingScore = domainScore({
    declared: company.accountingContext,
    facts: countDomainFacts("accounting"),
    connectedSignals: countDomainConnections("accounting"),
  });
  const salesScore = domainScore({
    declared: company.salesContext,
    facts: countDomainFacts("sales"),
    connectedSignals: countDomainConnections("sales"),
  });
  const marketingScore = domainScore({
    declared: company.marketingContext,
    facts: countDomainFacts("marketing"),
    connectedSignals: countDomainConnections("marketing"),
  });
  const hrScore = domainScore({
    declared: company.hrContext,
    facts: countDomainFacts("hr"),
    connectedSignals: countDomainConnections("hr"),
  });
  const operationsScore = domainScore({
    declared: company.operationsContext,
    facts: countDomainFacts("operations"),
    connectedSignals: countDomainConnections("operations"),
  });

  const sections: KnowledgeSection[] = [
    { key: "activity", label: "Activité", score: activityScore, description: "Secteur, modèle économique et profil client.", href: "/app/company#activity" },
    { key: "team", label: "Taille de l'équipe", score: teamScore, description: "Taille, effectif et premiers éléments d'organisation.", href: "/app/company#team" },
    { key: "objectives", label: "Objectifs", score: objectivesScore, description: "Résultats attendus et priorités à 90 jours.", href: "/app/company#objectives" },
    { key: "painPoints", label: "Pertes de temps", score: painPointsScore, description: "Blocages, tâches répétitives et irritants récurrents.", href: "/app/company#painPoints" },
    { key: "applications", label: "Applications utilisées", score: applicationsScore, description: "Outils déclarés et connexions réellement autorisées.", href: "/app/tools" },
    { key: "local", label: "Pays / contexte local", score: localScore, description: "Pays, marché, langue et contraintes locales utiles.", href: "/app/company#local" },
    { key: "finance", label: "Finance", score: financeScore, description: "CA, marge, trésorerie, bilan, compte de résultat et signaux financiers.", href: "/app/company#finance" },
    { key: "accounting", label: "Comptabilité", score: accountingScore, description: "Facturation, clôture, rapprochements et outils comptables.", href: "/app/company#accounting" },
    { key: "sales", label: "Commercial", score: salesScore, description: "Pipeline, leads, relances, devis et cycle de vente.", href: "/app/company#sales" },
    { key: "marketing", label: "Marketing", score: marketingScore, description: "Canaux, acquisition, campagnes, budget et conversion.", href: "/app/company#marketing" },
    { key: "hr", label: "RH", score: hrScore, description: "Organisation, recrutement, onboarding et processus RH agrégés.", href: "/app/company#hr" },
    { key: "operations", label: "Opérations", score: operationsScore, description: "Processus, production, support, réunions et exécution quotidienne.", href: "/app/company#operations" },
  ];

  const coreKeys: KnowledgeSectionKey[] = ["activity", "team", "objectives", "painPoints", "applications", "local"];
  const businessKeys: KnowledgeSectionKey[] = ["finance", "accounting", "sales", "marketing", "hr", "operations"];
  const coreAverage = sections.filter((section) => coreKeys.includes(section.key)).reduce((sum, section) => sum + section.score, 0) / coreKeys.length;
  const businessAverage = sections.filter((section) => businessKeys.includes(section.key)).reduce((sum, section) => sum + section.score, 0) / businessKeys.length;
  const overall = bounded(coreAverage * 0.55 + businessAverage * 0.45);
  const level: CompanyKnowledgeCoverage["level"] = overall >= 80 ? "avance" : overall >= 60 ? "solide" : overall >= 35 ? "partiel" : "faible";
  const nextSection = [...sections]
    .filter((section) => section.score < 90)
    .sort((a, b) => a.score - b.score)[0] ?? null;

  const radar = [
    { label: "Finance", score: financeScore },
    { label: "Compta", score: accountingScore },
    { label: "Commercial", score: salesScore },
    { label: "Marketing", score: marketingScore },
    { label: "RH", score: hrScore },
    { label: "Opérations", score: operationsScore },
    { label: "Données", score: applicationsScore },
  ];

  const message = overall >= 80
    ? "Votre contexte est suffisamment riche pour produire des recommandations très personnalisées. Les données connectées restent prioritaires pour confirmer les hypothèses."
    : overall >= 60
      ? "Pilotzia dispose déjà d'une base solide. Compléter les domaines les plus faibles augmentera surtout la précision du classement et du chiffrage."
      : overall >= 35
        ? "Pilotzia peut déjà conseiller, mais une partie des réponses repose encore sur des hypothèses. Quelques informations ciblées feront fortement progresser la précision."
        : "Pilotzia connaît encore peu votre entreprise. Les premières recommandations restent utiles, mais elles sont volontairement prudentes tant que le contexte n'est pas mieux renseigné.";

  return { overall, level, sections, radar, nextSection, message };
}
