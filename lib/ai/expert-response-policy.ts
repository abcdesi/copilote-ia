import type { ChatContext, ChatMessageInput } from "./types";

export type ConversationIntent =
  | "time"
  | "response_time"
  | "revenue"
  | "margin"
  | "cash"
  | "hr"
  | "marketing"
  | "accounting"
  | "operations"
  | "automation"
  | "general";

export type BusinessDomain = "finance" | "accounting" | "sales" | "marketing" | "hr" | "operations";

export interface ContextDomainSelection {
  primaryDomains: BusinessDomain[];
  expandedDomains: BusinessDomain[];
  allDomains: BusinessDomain[];
  expansionReasons: string[];
}

const DOMAIN_KEYWORDS: Record<BusinessDomain, string[]> = {
  finance: ["finance", "marge", "rentabil", "tresorer", "cash", "cout", "charge", "ebit", "dette", "creance", "budget"],
  accounting: ["compta", "factur", "impaye", "rapproch", "cloture", "journal", "recouvrement", "paiement"],
  sales: ["commercial", "vente", "ca", "prospect", "lead", "pipeline", "devis", "crm", "conversion", "relance", "client"],
  marketing: ["marketing", "acquisition", "campagne", "seo", "ads", "publicite", "contenu", "audience", "cpl", "cac"],
  hr: ["rh", "recrut", "salar", "equipe", "onboarding", "charge", "absence", "talent", "manager", "embauche"],
  operations: ["operation", "process", "workflow", "production", "support", "delai", "reunion", "qualite", "blocage", "temps", "capacite"],
};

const DOMAIN_RELATIONS: Record<BusinessDomain, Array<{ domain: BusinessDomain; reason: string }>> = {
  finance: [
    { domain: "accounting", reason: "comptabilité, échéances et encaissements peuvent expliquer le cash" },
    { domain: "sales", reason: "pipeline, facturation et relances peuvent expliquer revenu et trésorerie" },
    { domain: "operations", reason: "délais et capacité peuvent modifier coûts, facturation et encaissements" },
    { domain: "hr", reason: "capacité et masse salariale peuvent expliquer une dérive de coût ou de marge" },
  ],
  accounting: [
    { domain: "finance", reason: "les écritures et paiements prennent leur sens dans la trésorerie et la rentabilité" },
    { domain: "sales", reason: "devis, facturation et impayés sont liés au cycle client" },
    { domain: "operations", reason: "validations et traitements peuvent créer retards et erreurs comptables" },
  ],
  sales: [
    { domain: "marketing", reason: "origine et qualité des leads influencent conversion et pipeline" },
    { domain: "operations", reason: "délai de réponse et capacité d'exécution influencent vente et fidélisation" },
    { domain: "finance", reason: "marge, prix et cash peuvent changer la priorité commerciale" },
    { domain: "accounting", reason: "facturation et impayés peuvent révéler un problème dans le cycle client" },
  ],
  marketing: [
    { domain: "sales", reason: "l'acquisition doit être reliée aux leads, conversions et ventes" },
    { domain: "finance", reason: "budget, CAC et marge déterminent la rentabilité réelle de l'acquisition" },
    { domain: "operations", reason: "la capacité à absorber la demande peut limiter l'intérêt d'accélérer l'acquisition" },
  ],
  hr: [
    { domain: "operations", reason: "un besoin de recrutement provient souvent d'un problème de charge, capacité ou processus" },
    { domain: "finance", reason: "coût du recrutement et capacité financière peuvent modifier la solution" },
    { domain: "sales", reason: "un recrutement commercial doit être relié au pipeline et à la capacité de vente" },
  ],
  operations: [
    { domain: "hr", reason: "charge, rôles et capacité humaine expliquent souvent les goulots opérationnels" },
    { domain: "sales", reason: "délais et passages de relais peuvent affecter réponse client, conversion et revenu" },
    { domain: "accounting", reason: "des processus défaillants peuvent retarder facturation, contrôle et paiement" },
    { domain: "finance", reason: "coûts, marge et cash permettent de mesurer l'impact réel d'un problème opérationnel" },
  ],
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textMatches(text: string, keyword: string) {
  const haystack = normalize(text);
  const needle = normalize(keyword);
  if (!haystack || !needle) return false;
  const tokens = haystack.split(/\s+/).filter(Boolean);
  if (needle.includes(" ")) return ` ${haystack} `.includes(` ${needle} `);
  if (needle.length <= 3) return tokens.includes(needle);
  return tokens.some((token) => token === needle || token.startsWith(needle));
}

function compactText(value: string | null | undefined, lastUser: string, domain?: BusinessDomain, maxChars = 700) {
  if (!value?.trim()) return null;
  const sentences = value
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((sentence, index) => ({ sentence: sentence.trim(), index }))
    .filter((item) => item.sentence.length > 0);
  const seen = new Set<string>();
  const unique = sentences.filter((item) => {
    const key = normalize(item.sentence);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const questionTokens = normalize(lastUser).split(/\s+/).filter((token) => token.length >= 4);
  const keywords = domain ? DOMAIN_KEYWORDS[domain] : [];
  const scored = unique.map((item) => {
    const direct = questionTokens.filter((token) => textMatches(item.sentence, token)).length;
    const domainMatches = keywords.filter((keyword) => textMatches(item.sentence, keyword)).length;
    const quantified = /\d|%|€|\$/.test(item.sentence) ? 2 : 0;
    return { ...item, score: direct * 6 + domainMatches * 2 + quantified };
  });
  const selected = scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence)
    .join(" · ");
  if (selected.length <= maxChars) return selected;
  return `${selected.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

export function inferConversationIntent(text: string): ConversationIntent {
  const value = normalize(text);
  if (/delai de reponse|temps de reponse|repondre plus vite|rapidite de reponse/.test(value)) return "response_time";
  if (/tresorer|cash|encaissement|impaye|facture.*retard/.test(value)) return "cash";
  if (/marge|rentabil|profit|cout.*eleve/.test(value)) return "margin";
  if (/recrut|onboarding|salar|rh|ressource humaine|absenteisme/.test(value)) return "hr";
  if (/marketing|acquisition|campagne|seo|publicite|ads|contenu/.test(value)) return "marketing";
  if (/compta|comptabil|rapproch|cloture|facturation/.test(value)) return "accounting";
  if (/production|operation|workflow|process|support|qualite|blocage/.test(value)) return "operations";
  if (/chiffre d['’]?affaires|revenu|vente|commercial|prospect|pipeline|gagner plus d['’]?argent/.test(value)) return "revenue";
  if (/gagner du temps|economiser du temps|perdre du temps|temps dirigeant|productiv|optimis.*temps|ou.*temps/.test(value)) return "time";
  if (/automatise|automatiser|automatisation|workflow|mets? en place/.test(value)) return "automation";
  return "general";
}

export function conversationIntent(messages: ChatMessageInput[], context: ChatContext): ConversationIntent {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const intent = inferConversationIntent(message.content);
    if (intent !== "general") return intent;
  }
  return inferConversationIntent(`${context.objectives ?? ""} ${context.painPoints ?? ""}`);
}

function currentUserText(messages: ChatMessageInput[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function intentDomainBoost(intent: ConversationIntent): BusinessDomain[] {
  if (intent === "cash" || intent === "margin") return ["finance", "accounting"];
  if (intent === "revenue") return ["sales", "marketing"];
  if (intent === "response_time") return ["sales", "operations"];
  if (intent === "hr") return ["hr", "operations"];
  if (intent === "marketing") return ["marketing", "sales"];
  if (intent === "accounting") return ["accounting", "finance"];
  if (intent === "operations") return ["operations", "hr"];
  if (intent === "time") return ["operations"];
  return [];
}

function domainEvidenceStrength(domain: BusinessDomain, context: ChatContext) {
  const coverage = context.knowledgeCoverage?.sections.find((section) => section.key === domain)?.score ?? 0;
  const declared = context.domainContexts?.[domain]?.trim() ? 3 : 0;
  const evidence = (context.evidence ?? []).filter((item) => {
    const text = `${item.subject} ${item.predicate} ${JSON.stringify(item.value)}`;
    return DOMAIN_KEYWORDS[domain].some((keyword) => textMatches(text, keyword));
  }).length;
  const rhythm = (context.businessRhythms ?? []).some((item) => item.domain === domain) ? 1 : 0;
  return Math.min(4, coverage / 25) + declared + Math.min(4, evidence) + rhythm;
}

function rankDomains(messages: ChatMessageInput[], context: ChatContext) {
  const lastUser = currentUserText(messages);
  const activeSituation = `${context.objectives ?? ""} ${context.painPoints ?? ""}`;
  const intent = conversationIntent(messages, context);
  const boosted = new Set(intentDomainBoost(intent));

  return (Object.keys(DOMAIN_KEYWORDS) as BusinessDomain[])
    .map((domain) => {
      const keywords = DOMAIN_KEYWORDS[domain];
      const directMatches = keywords.filter((keyword) => textMatches(lastUser, keyword)).length;
      const situationMatches = keywords.filter((keyword) => textMatches(activeSituation, keyword)).length;
      const coverage = context.knowledgeCoverage?.sections.find((section) => section.key === domain)?.score ?? 0;
      const score = directMatches * 9 + situationMatches * 2 + (boosted.has(domain) ? 7 : 0) + Math.min(2, coverage / 50);
      return { domain, score, directMatches, situationMatches, strength: domainEvidenceStrength(domain, context) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.strength - a.strength);
}

export function inferDomainSelection(messages: ChatMessageInput[], context: ChatContext): ContextDomainSelection {
  const ranked = rankDomains(messages, context);
  const intent = conversationIntent(messages, context);
  const fallback = (Object.keys(context.domainContexts ?? {}) as BusinessDomain[])
    .filter((domain) => Boolean(context.domainContexts?.[domain]))
    .slice(0, 2);

  const primaryDomains = ranked.length
    ? ranked.slice(0, intent === "general" ? 1 : 2).map((item) => item.domain)
    : fallback;

  const expandedDomains: BusinessDomain[] = [];
  const expansionReasons: string[] = [];
  const primaryStrengths = primaryDomains.map((domain) => domainEvidenceStrength(domain, context));
  const weakPrimary = primaryStrengths.length === 0 || primaryStrengths.reduce((sum, value) => sum + value, 0) / primaryStrengths.length < 5;
  const candidates = new Map<BusinessDomain, { score: number; reason: string }>();

  for (const primary of primaryDomains) {
    for (const relation of DOMAIN_RELATIONS[primary]) {
      if (primaryDomains.includes(relation.domain)) continue;
      const rankedItem = ranked.find((item) => item.domain === relation.domain);
      const strength = domainEvidenceStrength(relation.domain, context);
      const explicit = (rankedItem?.directMatches ?? 0) > 0;
      const activeRelation = (rankedItem?.situationMatches ?? 0) >= 2;
      if (!explicit && !activeRelation && !(weakPrimary && strength > 0)) continue;
      const score = (rankedItem?.score ?? 0) + strength * 2 + (explicit ? 10 : 0) + (weakPrimary ? 4 : 0);
      const existing = candidates.get(relation.domain);
      if (!existing || existing.score < score) candidates.set(relation.domain, { score, reason: relation.reason });
    }
  }

  for (const [domain, candidate] of [...candidates.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 2)) {
    expandedDomains.push(domain);
    expansionReasons.push(`${domain}: ${candidate.reason}`);
  }

  const allDomains = [...primaryDomains, ...expandedDomains].slice(0, 4);
  return { primaryDomains, expandedDomains, allDomains, expansionReasons };
}

export function inferRelevantDomains(messages: ChatMessageInput[], context: ChatContext): BusinessDomain[] {
  return inferDomainSelection(messages, context).allDomains;
}

function evidenceRelevanceScore(
  evidence: NonNullable<ChatContext["evidence"]>[number],
  lastUser: string,
  selection: ContextDomainSelection
) {
  const text = `${evidence.subject} ${evidence.predicate} ${JSON.stringify(evidence.value)}`;
  const direct = normalize(lastUser)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && textMatches(text, token)).length;
  const primaryMatches = selection.primaryDomains.reduce(
    (sum, domain) => sum + DOMAIN_KEYWORDS[domain].filter((keyword) => textMatches(text, keyword)).length,
    0
  );
  const expandedMatches = selection.expandedDomains.reduce(
    (sum, domain) => sum + DOMAIN_KEYWORDS[domain].filter((keyword) => textMatches(text, keyword)).length,
    0
  );
  const ageDays = Math.max(0, (Date.now() - new Date(evidence.observedAt).getTime()) / 86_400_000);
  const freshness = ageDays <= 30 ? 4 : ageDays <= 90 ? 2 : ageDays <= 180 ? 1 : 0;
  return direct * 6 + primaryMatches * 3 + expandedMatches + freshness + Math.max(0, evidence.confidence) * 3;
}

export function compactExpertEvidence(messages: ChatMessageInput[], context: ChatContext) {
  const opportunities = context.topOpportunities?.slice(0, 3) ?? [];
  const connected = context.connections.filter((connection) => connection.status === "connected" || connection.status === "active");
  const selection = inferDomainSelection(messages, context);
  const lastUser = currentUserText(messages);
  const selectedDomainContexts = Object.fromEntries(
    selection.allDomains
      .map((domain) => [domain, compactText(context.domainContexts?.[domain], lastUser, domain)] as const)
      .filter(([, value]) => Boolean(value))
  );
  const relevantSections = (context.knowledgeCoverage?.sections ?? [])
    .filter((section) => selection.allDomains.includes(section.key as BusinessDomain))
    .map((section) => ({
      key: section.key,
      score: section.score,
      freshness: section.freshness ?? null,
      lastUpdatedAt: section.lastUpdatedAt ?? null,
      missingOrStale: section.dimensions
        ?.filter((dimension) => dimension.status === "missing" || dimension.status === "stale")
        .slice(0, 2)
        .map((dimension) => ({ label: dimension.label, status: dimension.status, question: dimension.question })) ?? [],
    }));
  const graphEvidence = [...(context.evidence ?? [])]
    .sort((a, b) => evidenceRelevanceScore(b, lastUser, selection) - evidenceRelevanceScore(a, lastUser, selection))
    .slice(0, 10);
  const relevantRhythms = (context.businessRhythms ?? [])
    .filter((rhythm) => selection.allDomains.includes(rhythm.domain as BusinessDomain))
    .sort((a, b) => new Date(a.nextExpectedAt).getTime() - new Date(b.nextExpectedAt).getTime())
    .slice(0, 4)
    .map((rhythm) => ({
      domain: rhythm.domain,
      summary: rhythm.summary,
      cadence: rhythm.cadence,
      nextExpectedAt: rhythm.nextExpectedAt,
      confidence: rhythm.confidence,
    }));

  return {
    currentSituation: {
      question: lastUser || null,
      objectives: compactText(context.objectives, lastUser, undefined, 420),
      painPoints: compactText(context.painPoints, lastUser, undefined, 420),
      primaryDomains: selection.primaryDomains,
      expandedDomains: selection.expandedDomains,
      expansionReasons: selection.expansionReasons,
      relevantKnowledge: relevantSections,
    },
    company: {
      name: context.companyName,
      industry: context.industry ?? null,
      country: context.country ?? null,
      sizeRange: context.sizeRange ?? null,
      businessModel: compactText(context.businessModel, lastUser, undefined, 280),
      customerProfile: compactText(context.customerProfile, lastUser, undefined, 320),
      localContext: compactText(context.localContext, lastUser, undefined, 280),
    },
    domainContexts: selectedDomainContexts,
    recurringPatterns: relevantRhythms,
    knowledgeCoverage: context.knowledgeCoverage
      ? { overall: context.knowledgeCoverage.overall, level: context.knowledgeCoverage.level }
      : null,
    tools: context.tools.slice(0, 12),
    connectedSources: connected.slice(0, 8).map((item) => ({
      provider: item.provider,
      lastSyncedAt: item.lastSyncedAt ?? null,
    })),
    observations: context.observations ?? null,
    opportunities,
    automations: context.automations
      .filter((automation) => automation.status === "active" || automation.health !== "green")
      .slice(0, 5),
    measuredValue: {
      estimatedHoursSavedPerMonth: context.totalHoursSavedThisMonth,
      estimatedValueEurPerMonth: context.totalValueEurThisMonth,
    },
    businessGraph: context.businessGraph
      ? {
          readinessScore: context.businessGraph.readinessScore,
          factCount: context.businessGraph.factCount,
          connectedSourceCount: context.businessGraph.connectedSourceCount,
          freshSourceCount: context.businessGraph.freshSourceCount,
        }
      : null,
    evidence: graphEvidence,
  };
}

export function expertOperatingDoctrine(messages: ChatMessageInput[], context: ChatContext) {
  const intent = conversationIntent(messages, context);
  const selection = inferDomainSelection(messages, context);
  const relevantMissing = (context.knowledgeCoverage?.sections ?? [])
    .filter((section) => selection.primaryDomains.includes(section.key as BusinessDomain))
    .flatMap((section) =>
      (section.dimensions ?? [])
        .filter((dimension) => dimension.status === "missing" || dimension.status === "stale")
        .map((dimension) => ({ section: section.label, ...dimension }))
    )[0];

  return `MODE DIRECTEUR/CONSULTANT EXPERT — INTENTION ACTUELLE: ${intent}
DOMAINES PRINCIPAUX: ${selection.primaryDomains.join(", ") || "contexte général"}
ÉLARGISSEMENT RELATIONNEL: ${selection.expandedDomains.join(", ") || "aucun"}${selection.expansionReasons.length ? ` — ${selection.expansionReasons.join(" ; ")}` : ""}

Tu réponds comme un excellent humain qui connaît le produit Pilotzia et qui conseille un dirigeant réel.

PRINCIPES NON NÉGOCIABLES
1. Réponds d'abord à la question posée. Ne commence jamais par « je peux vous aider », « je manque de contexte » ou « première lecture ».
2. Commence par le noyau d'informations directement lié au sujet. N'utilise pas tout le dossier entreprise par défaut.
3. Élargis intelligemment d'un domaine si le noyau est insuffisant, si une cause plausible se situe dans un domaine adjacent, ou si une contrainte ailleurs peut changer la décision. Cherche les relations cause → processus → capacité → revenu/marge/cash/risque plutôt que des silos.
4. Un domaine secondaire n'a le droit d'apparaître dans la réponse que s'il apporte une preuve, une explication, une contrainte ou une option qui change réellement le diagnostic. Sinon, ignore-le.
5. Les attentes du dirigeant, les problèmes, l'équipe, les chiffres et les priorités évoluent. Une information récente et directe prime sur une ancienne déclaration. Une donnée stale doit être signalée ou reconfirmée avant d'être traitée comme actuelle.
6. Utilise d'abord les faits de l'entreprise et l'historique. Si les faits directs sont insuffisants, élargis aux relations utiles avant de demander une information. Si cela reste insuffisant, formule une hypothèse professionnelle clairement qualifiée.
7. Ne répète jamais une question déjà répondue. Une réponse courte (« délai de réponse », « marge », « prospects ») est une sélection, pas une nouvelle question.
8. Une seule question de clarification maximum. Choisis celle qui réduit le plus l'incertitude sur la décision actuelle.${relevantMissing ? ` Question actuellement utile : ${relevantMissing.section} — ${relevantMissing.question}` : ""}
9. Ne confonds jamais mesure passée et potentiel futur. « 11 h/mois déjà économisées » n'est pas la réponse à « où puis-je gagner du temps ? ».
10. Ne propose pas une automatisation parce qu'un mot-clé correspond au catalogue. Pars du problème, du résultat attendu, de la fréquence, du risque et de l'impact.
11. Sois capable de trancher. Si plusieurs pistes existent, classe-les et explique brièvement pourquoi la première passe avant la deuxième.
12. Adapte la profondeur au niveau de preuve : données connectées fraîches > faits structurés récents > déclarations utilisateur actuelles > estimations Pilotzia > bonnes pratiques générales > hypothèses.
13. Les récurrences mémorisées (clôture, bilan, recrutement, campagnes, revues...) sont des signaux d'anticipation. Utilise-les pour rappeler ou suggérer au bon moment, sans les présenter comme certaines si leur confiance est faible ou si elles sont anciennes.
14. Parle le langage d'un dirigeant : revenu, marge, trésorerie, délai, charge, risque, qualité, capacité, ROI. Évite le jargon IA inutile.
15. Reste dans la boucle Pilotzia : comprendre → relier → diagnostiquer → prioriser → agir → mesurer → réviser la compréhension de l'entreprise.

STYLE
- Ton calme, expérimenté, direct, humain.
- Pour une question simple : 1 à 3 paragraphes, éventuellement 2-3 priorités.
- Pour une question complexe : recommandation, preuves utiles, prochaine décision.
- Ne récite jamais le contexte ni le Business Graph.
- Si tu connais déjà une information, utilise-la au lieu de la redemander.

EXEMPLES DE COMPORTEMENT
- « Où dois-je gagner du temps ? » → commence par les processus et irritants actuels ; si un goulot vient d'un manque de capacité, relie ensuite RH/opérations ; demande seulement le volume qui peut changer le classement.
- « trésorerie » → commence Finance + Comptabilité ; élargis au Commercial si retards de facturation, conversion ou relances peuvent expliquer le cash.
- « recrutement » → commence RH + capacité opérationnelle ; regarde ensuite Finance si le coût/capacité financière change l'option, ou Commercial si le recrutement concerne la vente.
- « délai de réponse » → commence Commercial + Opérations ; Marketing n'intervient que si la qualité/quantité des leads explique le problème.
- « pas compris » → reformule plus simplement et concrètement, sans repartir de zéro.
- « que dois-je faire ? » → tranche sur la prochaine action la plus utile à partir des preuves pertinentes et des relations qui changent réellement la décision.`;
}