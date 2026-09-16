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

export interface KnowledgeGuidanceStep {
  sectionKey: KnowledgeSectionKey;
  label: string;
  currentScore: number;
  href: string;
  title: string;
  action: string;
  why: string;
  priority: "haute" | "moyenne";
}

export interface KnowledgeMilestone {
  score: number;
  label: string;
  remaining: number;
}

export interface CompanyKnowledgeCoverage {
  overall: number;
  level: "faible" | "partiel" | "solide" | "avance";
  sections: KnowledgeSection[];
  radar: Array<{ label: string; score: number }>;
  nextSection: KnowledgeSection | null;
  guidanceSteps: KnowledgeGuidanceStep[];
  nextMilestone: KnowledgeMilestone | null;
  message: string;
}

const DOMAIN_KEYWORDS: Record<"finance" | "accounting" | "sales" | "marketing" | "hr" | "operations", string[]> = {
  finance: ["finance", "cash", "tresorer", "marge", "revenue", "ca", "ebit", "bilan", "resultat", "creance", "dette", "payment", "stripe"],
  accounting: ["compta", "account", "invoice", "factur", "ledger", "journal", "rapproch", "xero", "sage", "pennylane", "quickbooks"],
  sales: ["sales", "commercial", "prospect", "lead", "crm", "pipeline", "devis", "hubspot", "pipedrive", "salesforce"],
  marketing: ["marketing", "campagne", "ads", "acquisition", "seo", "contenu", "mailchimp", "meta", "google_ads", "newsletter"],
  hr: ["rh", "human", "recrut", "employee", "salar", "onboarding", "talent", "factorial", "lucca", "bamboo"],
  operations: ["operation", "process", "workflow", "meeting", "calendar", "notion", "slack", "teams", "support", "production", "delivery", "temps", "delai"],
};

const SECTION_GUIDANCE: Record<KnowledgeSectionKey, { title: string; action: string; why: string }> = {
  activity: {
    title: "Décrire clairement votre activité et vos clients",
    action: "Renseignez votre secteur, votre modèle économique et le profil de vos clients principaux.",
    why: "C'est la base qui permet à Pilotzia d'éviter les conseils génériques et d'adapter ses raisonnements à votre marché.",
  },
  team: {
    title: "Préciser la taille et l'organisation de l'équipe",
    action: "Indiquez la taille de l'équipe, l'effectif réel et les principaux rôles ou contraintes d'organisation.",
    why: "Une recommandation réaliste dépend fortement des ressources disponibles et de la manière dont le travail est réparti.",
  },
  objectives: {
    title: "Fixer 2 à 3 objectifs mesurables",
    action: "Décrivez vos priorités à 90 jours avec un indicateur : CA, marge, trésorerie, délai, temps gagné ou qualité.",
    why: "Les objectifs permettent au copilote de classer les opportunités selon ce qui compte réellement pour vous.",
  },
  painPoints: {
    title: "Quantifier vos pertes de temps et points de blocage",
    action: "Ajoutez les irritants récurrents avec leur fréquence, le temps consommé et, si possible, leur impact business.",
    why: "La fréquence et l'impact transforment une impression en priorité opérationnelle exploitable.",
  },
  applications: {
    title: "Relier vos outils et sources réelles",
    action: "Ajoutez les applications utilisées puis connectez au moins une source utile quand l'intégration est disponible.",
    why: "Les connexions réelles donnent à Pilotzia des faits observés et réduisent la part d'hypothèses dans ses conseils.",
  },
  local: {
    title: "Donner le contexte local de votre activité",
    action: "Renseignez le pays ou la zone principale, puis les contraintes locales utiles : saisonnalité, réglementation, langue ou marché.",
    why: "Le contexte local peut changer les priorités commerciales, financières et opérationnelles.",
  },
  finance: {
    title: "Donner une première lecture financière",
    action: "Ajoutez CA, marge, trésorerie, créances, dettes, principaux coûts et saisonnalité. Importez ensuite des données réelles quand possible.",
    why: "Ces éléments permettent de distinguer une optimisation de temps d'un vrai enjeu de marge ou de trésorerie.",
  },
  accounting: {
    title: "Décrire votre fonctionnement comptable",
    action: "Précisez l'outil comptable, la facturation, la clôture, les rapprochements, les relances et le rythme de reporting.",
    why: "Pilotzia peut alors détecter les tâches répétitives, les risques de retard et les opportunités de contrôle ou d'automatisation.",
  },
  sales: {
    title: "Documenter votre moteur commercial",
    action: "Renseignez leads, pipeline, taux de réponse, devis, cycle de vente, relances et CRM.",
    why: "Avec ces données, Pilotzia peut relier les actions recommandées au revenu plutôt qu'au seul gain de temps.",
  },
  marketing: {
    title: "Décrire vos canaux d'acquisition",
    action: "Ajoutez canaux, budget, campagnes, coût par lead, conversion, contenu et méthode d'attribution si elle existe.",
    why: "Cela permet de chercher les goulets d'acquisition et les dépenses peu productives au lieu de proposer des actions marketing génériques.",
  },
  hr: {
    title: "Cartographier les processus RH utiles",
    action: "Décrivez l'organisation, les recrutements, l'onboarding, la charge et les indicateurs agrégés sans données personnelles sensibles.",
    why: "Pilotzia peut ainsi repérer les frictions de processus tout en restant au bon niveau de confidentialité.",
  },
  operations: {
    title: "Décrire vos processus les plus critiques",
    action: "Ajoutez production, support, réunions, volumes, délais, contrôles et principaux points de blocage.",
    why: "C'est ce qui permet d'identifier les nœuds opérationnels et de recommander les automatisations les plus utiles.",
  },
};

const SECTION_GLOBAL_WEIGHT: Record<KnowledgeSectionKey, number> = {
  activity: 0.55 / 6,
  team: 0.55 / 6,
  objectives: 0.55 / 6,
  painPoints: 0.55 / 6,
  applications: 0.55 / 6,
  local: 0.55 / 6,
  finance: 0.45 / 6,
  accounting: 0.45 / 6,
  sales: 0.45 / 6,
  marketing: 0.45 / 6,
  hr: 0.45 / 6,
  operations: 0.45 / 6,
};

const RELEVANCE_KEYWORDS: Partial<Record<KnowledgeSectionKey, string[]>> = {
  finance: ["marge", "tresorer", "cash", "cout", "rentabil", "finance", "ebit", "dette"],
  accounting: ["factur", "impaye", "compta", "cloture", "rapproch"],
  sales: ["ca", "vente", "commercial", "prospect", "lead", "devis", "pipeline", "client"],
  marketing: ["marketing", "acquisition", "seo", "campagne", "pub", "ads", "conversion"],
  hr: ["rh", "recrut", "equipe", "onboarding", "salar", "talent"],
  operations: ["temps", "delai", "process", "operation", "workflow", "support", "production", "reunion", "blocage"],
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

function buildGuidanceSteps(sections: KnowledgeSection[], intentText: string): KnowledgeGuidanceStep[] {
  return sections
    .filter((section) => section.score < 90)
    .map((section) => {
      const keywords = RELEVANCE_KEYWORDS[section.key] ?? [];
      const relevant = keywords.some((keyword) => intentText.includes(normalize(keyword)));
      const foundationBoost = ["objectives", "painPoints", "activity", "applications"].includes(section.key) ? 1.15 : 1;
      const relevanceBoost = relevant ? 1.4 : 1;
      const priorityScore = (100 - section.score) * SECTION_GLOBAL_WEIGHT[section.key] * foundationBoost * relevanceBoost;
      const guidance = SECTION_GUIDANCE[section.key];
      return {
        priorityScore,
        step: {
          sectionKey: section.key,
          label: section.label,
          currentScore: section.score,
          href: section.href,
          title: guidance.title,
          action: guidance.action,
          why: guidance.why,
          priority: "moyenne" as const,
        },
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.step.currentScore - b.step.currentScore)
    .slice(0, 4)
    .map(({ step }, index) => ({ ...step, priority: index < 2 ? "haute" : "moyenne" }));
}

function getNextMilestone(overall: number): KnowledgeMilestone | null {
  const milestones = [
    { score: 35, label: "Base exploitable" },
    { score: 60, label: "Contexte solide" },
    { score: 80, label: "Conseil avancé" },
    { score: 90, label: "Couverture très complète" },
  ];
  const next = milestones.find((milestone) => overall < milestone.score);
  return next ? { ...next, remaining: next.score - overall } : null;
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

  const intentText = normalize(`${company.objectives ?? ""} ${company.painPoints ?? ""}`);
  const guidanceSteps = buildGuidanceSteps(sections, intentText);
  const nextMilestone = getNextMilestone(overall);

  const message = overall >= 80
    ? "Votre contexte est suffisamment riche pour produire des recommandations très personnalisées. Les données connectées restent prioritaires pour confirmer les hypothèses."
    : overall >= 60
      ? "Pilotzia dispose déjà d'une base solide. Compléter les domaines les plus faibles augmentera surtout la précision du classement et du chiffrage."
      : overall >= 35
        ? "Pilotzia peut déjà conseiller, mais une partie des réponses repose encore sur des hypothèses. Quelques informations ciblées feront fortement progresser la précision."
        : "Pilotzia connaît encore peu votre entreprise. Les premières recommandations restent utiles, mais elles sont volontairement prudentes tant que le contexte n'est pas mieux renseigné.";

  return { overall, level, sections, radar, nextSection, guidanceSteps, nextMilestone, message };
}
