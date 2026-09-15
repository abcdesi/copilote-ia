export type EvidenceKind =
  | "company_declared"
  | "connected_observation"
  | "business_graph_fact"
  | "financial_ratio"
  | "external_research"
  | "aggregated_benchmark"
  | "pilotzia_pattern";

export interface OpportunityEvidence {
  kind: EvidenceKind;
  label: string;
  value?: string | number | boolean | null;
  confidence: number;
  observedAt?: string | null;
  source?: string | null;
}

export interface OpportunityCandidate {
  key: string;
  title: string;
  description: string;
  category: string;
  revenueImpact: number;
  marginImpact: number;
  cashImpact: number;
  timeImpact: number;
  riskReduction: number;
  frequency: number;
  automationFeasibility: number;
  implementationEffort: number;
  evidence: OpportunityEvidence[];
  requiredData?: string[];
}

export interface ScoredOpportunity extends OpportunityCandidate {
  score: number;
  confidence: number;
  evidenceStrength: "weak" | "medium" | "strong";
  rationale: string[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizedSignal(value: number) {
  return clamp(value, 0, 10) / 10;
}

function evidenceWeight(kind: EvidenceKind) {
  switch (kind) {
    case "connected_observation":
    case "financial_ratio":
    case "business_graph_fact":
      return 1;
    case "aggregated_benchmark":
      return 0.8;
    case "external_research":
      return 0.7;
    case "company_declared":
      return 0.65;
    case "pilotzia_pattern":
    default:
      return 0.45;
  }
}

function computeConfidence(evidence: OpportunityEvidence[]) {
  if (evidence.length === 0) return 0.2;
  const weighted = evidence.reduce((sum, item) => {
    return sum + clamp(item.confidence, 0, 1) * evidenceWeight(item.kind);
  }, 0);
  const diversity = new Set(evidence.map((item) => item.kind)).size;
  const diversityBonus = Math.min(0.2, Math.max(0, diversity - 1) * 0.05);
  return clamp(weighted / evidence.length + diversityBonus, 0.2, 0.98);
}

export function scoreOpportunity(candidate: OpportunityCandidate): ScoredOpportunity {
  const impact =
    normalizedSignal(candidate.revenueImpact) * 0.23 +
    normalizedSignal(candidate.marginImpact) * 0.15 +
    normalizedSignal(candidate.cashImpact) * 0.16 +
    normalizedSignal(candidate.timeImpact) * 0.16 +
    normalizedSignal(candidate.riskReduction) * 0.1 +
    normalizedSignal(candidate.frequency) * 0.08 +
    normalizedSignal(candidate.automationFeasibility) * 0.12;

  const effortPenalty = normalizedSignal(candidate.implementationEffort) * 0.2;
  const confidence = computeConfidence(candidate.evidence);
  const score = Math.round(clamp((impact - effortPenalty + 0.2) * confidence * 100));

  const evidenceStrength = confidence >= 0.75 ? "strong" : confidence >= 0.5 ? "medium" : "weak";
  const rationale = [
    candidate.revenueImpact >= 7 ? "impact revenu potentiellement élevé" : null,
    candidate.cashImpact >= 7 ? "impact trésorerie potentiellement élevé" : null,
    candidate.timeImpact >= 7 ? "gain de temps potentiel élevé" : null,
    candidate.automationFeasibility >= 7 ? "automatisation techniquement plausible" : null,
    candidate.implementationEffort >= 7 ? "effort de mise en œuvre important" : null,
    confidence < 0.5 ? "preuves encore insuffisantes : validation requise avant décision" : null,
  ].filter((item): item is string => Boolean(item));

  return { ...candidate, score, confidence, evidenceStrength, rationale };
}

export function rankOpportunities(candidates: OpportunityCandidate[]) {
  return candidates.map(scoreOpportunity).sort((a, b) => b.score - a.score || b.confidence - a.confidence);
}

export function canPresentAsRecommendation(opportunity: ScoredOpportunity) {
  return opportunity.score >= 45 && opportunity.confidence >= 0.5;
}

export function canPresentAsObservedPriority(opportunity: ScoredOpportunity) {
  return opportunity.score >= 60 && opportunity.confidence >= 0.72;
}
