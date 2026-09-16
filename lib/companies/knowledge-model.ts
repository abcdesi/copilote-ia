import {
  KNOWLEDGE_DIMENSIONS,
  assessDeclaredKnowledge,
  dimensionTextMatches,
  type KnowledgeDimensionSectionKey,
} from "@/lib/companies/knowledge-dimensions";

export type KnowledgeSectionKey = KnowledgeDimensionSectionKey;
export type KnowledgeFreshness = "fresh" | "aging" | "stale" | "unknown";
export type KnowledgeDimensionStatus = "known" | "observed" | "stale" | "missing";

export interface KnowledgeDimensionState {
  key: string;
  label: string;
  question: string;
  status: KnowledgeDimensionStatus;
}

export interface KnowledgeSection {
  key: KnowledgeSectionKey;
  label: string;
  score: number;
  description: string;
  href: string;
  freshness: KnowledgeFreshness;
  lastUpdatedAt: string | null;
  dimensions: KnowledgeDimensionState[];
  knownDimensions: number;
  totalDimensions: number;
  nextQuestion: string | null;
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

export interface KnowledgeModelInput {
  company: {
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
  };
  tools: string[];
  connections: Array<{ provider: string; accountLabel: string | null; lastSyncedAt?: string | null }>;
  facts: Array<{
    predicate: string;
    sourceProvider: string;
    sourceRef: string | null;
    valueJson: string | null;
    observedAt?: string | null;
  }>;
  sectionUpdatedAt?: Partial<Record<KnowledgeSectionKey, string | null>>;
  now?: string;
}

const DOMAIN_KEYS = ["finance", "accounting", "sales", "marketing", "hr", "operations"] as const;

const DOMAIN_KEYWORDS: Record<(typeof DOMAIN_KEYS)[number], string[]> = {
  finance: ["finance", "cash", "tresorer", "marge", "revenue", "ca", "ebit", "bilan", "resultat", "creance", "dette", "payment", "stripe"],
  accounting: ["compta", "account", "invoice", "factur", "ledger", "journal", "rapproch", "xero", "sage", "pennylane", "quickbooks"],
  sales: ["sales", "commercial", "prospect", "lead", "crm", "pipeline", "devis", "hubspot", "pipedrive", "salesforce"],
  marketing: ["marketing", "campagne", "ads", "acquisition", "seo", "contenu", "mailchimp", "meta", "google ads", "newsletter"],
  hr: ["rh", "human", "recrut", "employee", "salar", "onboarding", "talent", "factorial", "lucca", "bamboo"],
  operations: ["operation", "process", "workflow", "meeting", "calendar", "notion", "slack", "teams", "support", "production", "delivery", "temps", "delai"],
};

const SECTION_GUIDANCE: Record<KnowledgeSectionKey, { title: string; why: string }> = {
  activity: {
    title: "Mieux cadrer l'activité et les clients",
    why: "Le modèle économique et les clients déterminent quelles recommandations sont réalistes pour votre entreprise.",
  },
  team: {
    title: "Mieux comprendre l'organisation de l'équipe",
    why: "La capacité disponible et les rôles changent fortement la faisabilité des actions proposées.",
  },
  objectives: {
    title: "Actualiser les priorités du dirigeant",
    why: "Pilotzia doit savoir ce qui compte maintenant pour classer les opportunités au bon moment.",
  },
  painPoints: {
    title: "Préciser les blocages actuels",
    why: "Un problème devient priorisable lorsque son processus, sa fréquence et son impact sont compris.",
  },
  applications: {
    title: "Renforcer les sources de données",
    why: "Les connexions réelles permettent de confirmer les déclarations par des faits observés.",
  },
  local: {
    title: "Compléter le contexte local",
    why: "Saisonnalité, réglementation et usages locaux peuvent changer la recommandation.",
  },
  finance: {
    title: "Approfondir la lecture financière",
    why: "Pilotzia peut mieux distinguer les sujets de marge, trésorerie, coûts et financement avec des faits distincts.",
  },
  accounting: {
    title: "Approfondir le fonctionnement comptable",
    why: "Facturation, clôture, rapprochements et relances n'ont pas les mêmes causes ni les mêmes leviers.",
  },
  sales: {
    title: "Approfondir le moteur commercial",
    why: "Pipeline, conversion, cycle et relances permettent de relier une action à son impact revenu.",
  },
  marketing: {
    title: "Approfondir l'acquisition marketing",
    why: "Canaux, budget, conversion et attribution permettent de trouver les vrais goulets d'acquisition.",
  },
  hr: {
    title: "Approfondir la connaissance RH",
    why: "Organisation, recrutement, onboarding, charge et processus récurrents sont des informations différentes : les répéter ne crée pas de connaissance supplémentaire.",
  },
  operations: {
    title: "Approfondir les opérations",
    why: "Volumes, délais, qualité et goulots permettent d'identifier les nœuds qui freinent réellement l'entreprise.",
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
  hr: ["rh", "recrut", "equipe", "onboarding", "salar", "talent", "charge"],
  operations: ["temps", "delai", "process", "operation", "workflow", "support", "production", "reunion", "blocage"],
};

const FRESHNESS_DAYS: Record<KnowledgeSectionKey, number> = {
  activity: 365,
  team: 120,
  objectives: 60,
  painPoints: 60,
  applications: 90,
  local: 365,
  finance: 90,
  accounting: 120,
  sales: 60,
  marketing: 60,
  hr: 90,
  operations: 60,
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function knowledgeIntentMatches(text: string, keyword: string) {
  const normalizedText = normalize(text);
  const normalizedKeyword = normalize(keyword);
  if (!normalizedText || !normalizedKeyword) return false;

  if (normalizedKeyword.includes(" ")) {
    return ` ${normalizedText} `.includes(` ${normalizedKeyword} `);
  }

  const tokens = normalizedText.split(/\s+/).filter(Boolean);
  if (normalizedKeyword.length <= 3) return tokens.includes(normalizedKeyword);
  return tokens.some((token) => token === normalizedKeyword || token.startsWith(normalizedKeyword));
}

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function weighted(parts: Array<[number, number]>) {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0);
  if (!totalWeight) return 0;
  return bounded(parts.reduce((sum, [score, weight]) => sum + score * weight, 0) / totalWeight);
}

function freshnessFor(sectionKey: KnowledgeSectionKey, updatedAt: string | null | undefined, nowIso: string): KnowledgeFreshness {
  if (!updatedAt) return "unknown";
  const changed = new Date(updatedAt).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(changed) || !Number.isFinite(now)) return "unknown";
  const ageDays = Math.max(0, (now - changed) / 86_400_000);
  const horizon = FRESHNESS_DAYS[sectionKey];
  if (ageDays <= horizon * 0.6) return "fresh";
  if (ageDays <= horizon) return "aging";
  return "stale";
}

function freshnessFactor(freshness: KnowledgeFreshness) {
  if (freshness === "fresh") return 1;
  if (freshness === "aging") return 0.9;
  if (freshness === "stale") return 0.72;
  return 0.9;
}

function factHaystack(fact: KnowledgeModelInput["facts"][number]) {
  return `${fact.predicate} ${fact.sourceProvider} ${fact.sourceRef ?? ""} ${fact.valueJson ?? ""}`;
}

function factMatches(fact: KnowledgeModelInput["facts"][number], keywords: string[]) {
  const haystack = factHaystack(fact);
  return keywords.some((keyword) => knowledgeIntentMatches(haystack, keyword));
}

function dimensionStates(
  sectionKey: KnowledgeSectionKey,
  declaredText: string | null,
  facts: KnowledgeModelInput["facts"],
  freshness: KnowledgeFreshness
) {
  const assessment = assessDeclaredKnowledge(sectionKey, declaredText);
  const covered = new Set(assessment.coveredKeys);
  return KNOWLEDGE_DIMENSIONS[sectionKey].map((dimension) => {
    const observed = facts.some((fact) => dimension.keywords.some((keyword) => dimensionTextMatches(factHaystack(fact), keyword)));
    const declared = covered.has(dimension.key);
    const status: KnowledgeDimensionStatus = observed
      ? "observed"
      : declared && freshness === "stale"
        ? "stale"
        : declared
          ? "known"
          : "missing";
    return { key: dimension.key, label: dimension.label, question: dimension.question, status };
  });
}

function observedDimensionScore(sectionKey: KnowledgeSectionKey, facts: KnowledgeModelInput["facts"]) {
  const dimensions = KNOWLEDGE_DIMENSIONS[sectionKey];
  if (!dimensions.length) return 0;
  const observed = dimensions.filter((dimension) =>
    facts.some((fact) => dimension.keywords.some((keyword) => dimensionTextMatches(factHaystack(fact), keyword)))
  ).length;
  return bounded((observed / dimensions.length) * 100);
}

function semanticDeclaredScore(sectionKey: KnowledgeSectionKey, text: string | null, freshness: KnowledgeFreshness) {
  return bounded(assessDeclaredKnowledge(sectionKey, text).score * freshnessFactor(freshness));
}

function domainScore(input: {
  sectionKey: (typeof DOMAIN_KEYS)[number];
  declared: string | null;
  facts: KnowledgeModelInput["facts"];
  connectedSignals: number;
  freshness: KnowledgeFreshness;
}) {
  const declared = semanticDeclaredScore(input.sectionKey, input.declared, input.freshness);
  const facts = observedDimensionScore(input.sectionKey, input.facts);
  const connections = Math.min(100, input.connectedSignals * 50);
  return weighted([
    [declared, 60],
    [facts, 25],
    [connections, 15],
  ]);
}

function buildSection(input: {
  key: KnowledgeSectionKey;
  label: string;
  score: number;
  description: string;
  href: string;
  declaredText: string | null;
  facts: KnowledgeModelInput["facts"];
  freshness: KnowledgeFreshness;
  lastUpdatedAt: string | null;
}) : KnowledgeSection {
  const dimensions = dimensionStates(input.key, input.declaredText, input.facts, input.freshness);
  const knownDimensions = dimensions.filter((dimension) => dimension.status !== "missing").length;
  const nextDimension = dimensions.find((dimension) => dimension.status === "stale")
    ?? dimensions.find((dimension) => dimension.status === "missing")
    ?? null;

  return {
    key: input.key,
    label: input.label,
    score: input.score,
    description: input.description,
    href: input.href,
    freshness: input.freshness,
    lastUpdatedAt: input.lastUpdatedAt,
    dimensions,
    knownDimensions,
    totalDimensions: dimensions.length,
    nextQuestion: nextDimension?.question ?? null,
  };
}

function guidanceAction(section: KnowledgeSection) {
  const stale = section.dimensions.find((dimension) => dimension.status === "stale");
  if (stale) return `Cette information peut avoir évolué. À confirmer : ${stale.question}`;

  const missing = section.dimensions.find((dimension) => dimension.status === "missing");
  if (missing) return `Pour faire progresser la connaissance utile, répondez d'abord à ceci : ${missing.question}`;

  if (section.key === "applications" && section.score < 90) {
    return "Vos outils sont recensés. Activez maintenant une connexion réelle ou une synchronisation disponible pour augmenter la part de faits observés.";
  }

  if (DOMAIN_KEYS.includes(section.key as (typeof DOMAIN_KEYS)[number]) && section.score < 90) {
    return "La couverture déclarative est bonne. Ajoutez maintenant une source connectée ou des faits récents pour confirmer la situation actuelle.";
  }

  return "Vérifiez que ces informations restent à jour ; la vie de l'entreprise évolue et Pilotzia privilégie toujours le contexte le plus récent.";
}

function buildGuidanceSteps(sections: KnowledgeSection[], intentText: string): KnowledgeGuidanceStep[] {
  return sections
    .filter((section) => section.score < 90 || section.freshness === "stale")
    .map((section) => {
      const keywords = RELEVANCE_KEYWORDS[section.key] ?? [];
      const relevant = keywords.some((keyword) => knowledgeIntentMatches(intentText, keyword));
      const foundationBoost = ["objectives", "painPoints", "activity", "applications"].includes(section.key) ? 1.15 : 1;
      const relevanceBoost = relevant ? 1.6 : 1;
      const freshnessBoost = section.freshness === "stale" ? 1.35 : section.freshness === "aging" ? 1.12 : 1;
      const priorityScore = (100 - Math.min(section.score, 95)) * SECTION_GLOBAL_WEIGHT[section.key] * foundationBoost * relevanceBoost * freshnessBoost;
      const guidance = SECTION_GUIDANCE[section.key];

      return {
        priorityScore,
        step: {
          sectionKey: section.key,
          label: section.label,
          currentScore: section.score,
          href: section.href,
          title: guidance.title,
          action: guidanceAction(section),
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

export function computeCompanyKnowledgeCoverage(input: KnowledgeModelInput): CompanyKnowledgeCoverage {
  const { company, tools, connections, facts } = input;
  const nowIso = input.now ?? new Date().toISOString();
  const updatedAt = (key: KnowledgeSectionKey) => input.sectionUpdatedAt?.[key] ?? null;
  const freshness = (key: KnowledgeSectionKey) => freshnessFor(key, updatedAt(key), nowIso);
  const connectionSignalNames = connections.flatMap((connection) => [connection.provider, connection.accountLabel ?? ""]).filter(Boolean);
  const countDomainConnections = (domain: (typeof DOMAIN_KEYS)[number]) =>
    connectionSignalNames.filter((name) => DOMAIN_KEYWORDS[domain].some((keyword) => knowledgeIntentMatches(name, keyword))).length;
  const domainFacts = (domain: (typeof DOMAIN_KEYS)[number]) => facts.filter((fact) => factMatches(fact, DOMAIN_KEYWORDS[domain]));

  const activityText = [company.industry, company.businessModel, company.customerProfile].filter(Boolean).join(" ");
  const teamText = [company.sizeRange, company.employeeCount ? `${company.employeeCount} personnes` : null, company.hrContext].filter(Boolean).join(" ");
  const localText = [company.country, company.localContext].filter(Boolean).join(" ");
  const applicationsText = [...tools, ...connectionSignalNames].join(" ");

  const activityScore = weighted([
    [company.industry ? 100 : 0, 25],
    [semanticDeclaredScore("activity", activityText, freshness("activity")), 75],
  ]);
  const teamScore = weighted([
    [company.sizeRange ? 100 : 0, 25],
    [company.employeeCount ? 100 : 0, 20],
    [semanticDeclaredScore("team", teamText, freshness("team")), 55],
  ]);
  const objectivesScore = semanticDeclaredScore("objectives", company.objectives, freshness("objectives"));
  const painPointsScore = semanticDeclaredScore("painPoints", company.painPoints, freshness("painPoints"));
  const applicationsScore = bounded(Math.min(55, tools.length * 14) + Math.min(45, connections.length * 23));
  const localScore = weighted([
    [company.country ? 100 : 0, 40],
    [semanticDeclaredScore("local", localText, freshness("local")), 60],
  ]);

  const financeFacts = domainFacts("finance");
  const accountingFacts = domainFacts("accounting");
  const salesFacts = domainFacts("sales");
  const marketingFacts = domainFacts("marketing");
  const hrFacts = domainFacts("hr");
  const operationsFacts = domainFacts("operations");

  const financeScore = domainScore({ sectionKey: "finance", declared: company.financeContext, facts: financeFacts, connectedSignals: countDomainConnections("finance"), freshness: freshness("finance") });
  const accountingScore = domainScore({ sectionKey: "accounting", declared: company.accountingContext, facts: accountingFacts, connectedSignals: countDomainConnections("accounting"), freshness: freshness("accounting") });
  const salesScore = domainScore({ sectionKey: "sales", declared: company.salesContext, facts: salesFacts, connectedSignals: countDomainConnections("sales"), freshness: freshness("sales") });
  const marketingScore = domainScore({ sectionKey: "marketing", declared: company.marketingContext, facts: marketingFacts, connectedSignals: countDomainConnections("marketing"), freshness: freshness("marketing") });
  const hrScore = domainScore({ sectionKey: "hr", declared: company.hrContext, facts: hrFacts, connectedSignals: countDomainConnections("hr"), freshness: freshness("hr") });
  const operationsScore = domainScore({ sectionKey: "operations", declared: company.operationsContext, facts: operationsFacts, connectedSignals: countDomainConnections("operations"), freshness: freshness("operations") });

  const sections: KnowledgeSection[] = [
    buildSection({ key: "activity", label: "Activité", score: activityScore, description: "Secteur, modèle économique et profil client.", href: "/app/company#activity", declaredText: activityText, facts: [], freshness: freshness("activity"), lastUpdatedAt: updatedAt("activity") }),
    buildSection({ key: "team", label: "Taille de l'équipe", score: teamScore, description: "Effectif, rôles, organisation et capacité.", href: "/app/company#team", declaredText: teamText, facts: [], freshness: freshness("team"), lastUpdatedAt: updatedAt("team") }),
    buildSection({ key: "objectives", label: "Objectifs", score: objectivesScore, description: "Résultat, indicateur, cible et horizon actuels.", href: "/app/company#objectives", declaredText: company.objectives, facts: [], freshness: freshness("objectives"), lastUpdatedAt: updatedAt("objectives") }),
    buildSection({ key: "painPoints", label: "Pertes de temps", score: painPointsScore, description: "Processus, fréquence, effort et impact des blocages.", href: "/app/company#painPoints", declaredText: company.painPoints, facts: [], freshness: freshness("painPoints"), lastUpdatedAt: updatedAt("painPoints") }),
    buildSection({ key: "applications", label: "Applications utilisées", score: applicationsScore, description: "Outils déclarés et connexions réellement autorisées.", href: "/app/tools", declaredText: applicationsText, facts: [], freshness: freshness("applications"), lastUpdatedAt: updatedAt("applications") }),
    buildSection({ key: "local", label: "Pays / contexte local", score: localScore, description: "Marché, saisonnalité, réglementation et usages locaux.", href: "/app/company#local", declaredText: localText, facts: [], freshness: freshness("local"), lastUpdatedAt: updatedAt("local") }),
    buildSection({ key: "finance", label: "Finance", score: financeScore, description: "Revenus, marge, cash, créances, dettes, coûts et prévisions.", href: "/app/company#finance", declaredText: company.financeContext, facts: financeFacts, freshness: freshness("finance"), lastUpdatedAt: updatedAt("finance") }),
    buildSection({ key: "accounting", label: "Comptabilité", score: accountingScore, description: "Outil, facturation, clôture, rapprochements, relances et reporting.", href: "/app/company#accounting", declaredText: company.accountingContext, facts: accountingFacts, freshness: freshness("accounting"), lastUpdatedAt: updatedAt("accounting") }),
    buildSection({ key: "sales", label: "Commercial", score: salesScore, description: "Leads, pipeline, conversion, devis, cycle, relances et CRM.", href: "/app/company#sales", declaredText: company.salesContext, facts: salesFacts, freshness: freshness("sales"), lastUpdatedAt: updatedAt("sales") }),
    buildSection({ key: "marketing", label: "Marketing", score: marketingScore, description: "Canaux, budget, acquisition, campagnes, conversion et attribution.", href: "/app/company#marketing", declaredText: company.marketingContext, facts: marketingFacts, freshness: freshness("marketing"), lastUpdatedAt: updatedAt("marketing") }),
    buildSection({ key: "hr", label: "RH", score: hrScore, description: "Organisation, recrutement, onboarding, charge, processus, outils et indicateurs agrégés.", href: "/app/company#hr", declaredText: company.hrContext, facts: hrFacts, freshness: freshness("hr"), lastUpdatedAt: updatedAt("hr") }),
    buildSection({ key: "operations", label: "Opérations", score: operationsScore, description: "Processus, volumes, support, réunions, délais, qualité et goulots.", href: "/app/company#operations", declaredText: company.operationsContext, facts: operationsFacts, freshness: freshness("operations"), lastUpdatedAt: updatedAt("operations") }),
  ];

  const coreKeys: KnowledgeSectionKey[] = ["activity", "team", "objectives", "painPoints", "applications", "local"];
  const businessKeys: KnowledgeSectionKey[] = ["finance", "accounting", "sales", "marketing", "hr", "operations"];
  const coreAverage = sections.filter((section) => coreKeys.includes(section.key)).reduce((sum, section) => sum + section.score, 0) / coreKeys.length;
  const businessAverage = sections.filter((section) => businessKeys.includes(section.key)).reduce((sum, section) => sum + section.score, 0) / businessKeys.length;
  const overall = bounded(coreAverage * 0.55 + businessAverage * 0.45);
  const level: CompanyKnowledgeCoverage["level"] = overall >= 80 ? "avance" : overall >= 60 ? "solide" : overall >= 35 ? "partiel" : "faible";

  const radar = [
    { label: "Finance", score: financeScore },
    { label: "Compta", score: accountingScore },
    { label: "Commercial", score: salesScore },
    { label: "Marketing", score: marketingScore },
    { label: "RH", score: hrScore },
    { label: "Opérations", score: operationsScore },
    { label: "Données", score: applicationsScore },
  ];

  const intentText = `${company.objectives ?? ""} ${company.painPoints ?? ""}`;
  const guidanceSteps = buildGuidanceSteps(sections, intentText);
  const nextMilestone = getNextMilestone(overall);
  const nextSection = guidanceSteps[0] ? sections.find((section) => section.key === guidanceSteps[0].sectionKey) ?? null : null;
  const staleCount = sections.filter((section) => section.freshness === "stale").length;

  const message = staleCount > 0
    ? `${staleCount} rubrique${staleCount > 1 ? "s" : ""} mérite${staleCount > 1 ? "nt" : ""} d'être reconfirmée${staleCount > 1 ? "s" : ""} : Pilotzia tient compte du fait que l'entreprise, ses objectifs et ses contraintes évoluent.`
    : overall >= 80
      ? "Votre contexte est riche. Pilotzia privilégie désormais les données connectées, les faits récents et la situation actuelle pour affiner les décisions."
      : overall >= 60
        ? "Pilotzia dispose d'une base solide. La progression vient surtout des dimensions métier encore manquantes et des données récentes qui confirment vos déclarations."
        : overall >= 35
          ? "Pilotzia peut déjà conseiller, mais certaines dimensions clés restent inconnues. Les prochaines questions sont choisies pour réduire l'incertitude utile, pas pour vous faire écrire davantage."
          : "Pilotzia connaît encore peu votre entreprise. Le score progresse lorsque de nouvelles informations distinctes et utiles sont comprises — répéter la même idée ne l'augmente pas.";

  return { overall, level, sections, radar, nextSection, guidanceSteps, nextMilestone, message };
}
