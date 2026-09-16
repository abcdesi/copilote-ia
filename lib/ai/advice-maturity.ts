import type { ChatContext } from "./types";

export type AdviceMaturity = "initial" | "contextual" | "observed" | "operational";

export interface AdviceMaturityAssessment {
  level: AdviceMaturity;
  score: number;
  knownSignals: string[];
  missingSignals: string[];
}

export function assessAdviceMaturity(context: ChatContext): AdviceMaturityAssessment {
  const knownSignals: string[] = [];
  const missingSignals: string[] = [];

  if (context.knowledgeCoverage) {
    for (const section of context.knowledgeCoverage.sections) {
      if (section.score >= 60) knownSignals.push(section.label.toLowerCase());
      else if (section.score < 40) missingSignals.push(section.label.toLowerCase());
    }

    const activeConnections = context.connections.filter(
      (connection) => connection.status === "connected" || connection.status === "active"
    );
    if (activeConnections.length > 0) knownSignals.push("sources connectées");
    else missingSignals.push("données réelles connectées");

    if (context.observations) knownSignals.push("observations opérationnelles");
    if (context.businessGraph && context.businessGraph.factCount > 0) knownSignals.push("faits métier structurés");

    const evidenceBonus = Math.min(
      10,
      (context.observations ? 4 : 0) +
        (context.businessGraph && context.businessGraph.factCount >= 5 ? 3 : 0) +
        (context.businessGraph && context.businessGraph.freshSourceCount > 0 ? 3 : 0)
    );
    const bounded = Math.max(0, Math.min(100, Math.round(context.knowledgeCoverage.overall * 0.9 + evidenceBonus)));
    const level: AdviceMaturity = bounded >= 78 ? "operational" : bounded >= 55 ? "observed" : bounded >= 30 ? "contextual" : "initial";
    return { level, score: bounded, knownSignals, missingSignals };
  }

  let score = 0;
  if (context.industry) { score += 10; knownSignals.push("secteur"); } else missingSignals.push("secteur");
  if (context.sizeRange) { score += 10; knownSignals.push("taille"); } else missingSignals.push("taille");
  if (context.objectives) { score += 15; knownSignals.push("objectifs"); } else missingSignals.push("objectifs business");
  if (context.painPoints) { score += 15; knownSignals.push("irritants"); } else missingSignals.push("irritants prioritaires");
  if (context.tools.length > 0) { score += Math.min(10, context.tools.length * 3); knownSignals.push("outils déclarés"); } else missingSignals.push("outils");

  const activeConnections = context.connections.filter((connection) => connection.status === "connected" || connection.status === "active");
  if (activeConnections.length > 0) { score += Math.min(15, activeConnections.length * 7); knownSignals.push("sources connectées"); }
  else missingSignals.push("données réelles connectées");

  if (context.observations) { score += 10; knownSignals.push("observations opérationnelles"); } else missingSignals.push("activité observée");
  if (context.businessGraph && context.businessGraph.factCount > 0) { score += Math.min(15, Math.max(5, context.businessGraph.readinessScore / 7)); knownSignals.push("graphe métier"); }
  else missingSignals.push("faits métier structurés");

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  const level: AdviceMaturity = bounded >= 75 ? "operational" : bounded >= 50 ? "observed" : bounded >= 25 ? "contextual" : "initial";
  return { level, score: bounded, knownSignals, missingSignals };
}

export function maturityInstruction(assessment: AdviceMaturityAssessment) {
  switch (assessment.level) {
    case "operational":
      return "Le contexte est riche. Réponds comme un directeur opérationnel expérimenté : tranche, priorise, chiffre quand les données le permettent, relie chaque recommandation à des faits observés et signale les risques/exceptions.";
    case "observed":
      return "Le contexte est déjà utile mais incomplet. Donne une recommandation priorisée et personnalisée, en séparant clairement les faits observés des hypothèses. Indique la donnée manquante qui augmenterait le plus la précision.";
    case "contextual":
      return "Le contexte est principalement déclaratif. Donne des pistes adaptées au profil connu, mais présente-les comme des hypothèses à valider. Ne transforme jamais une estimation ou une intuition en fait.";
    default:
      return "Le contexte est faible. Agis comme un consultant senior en phase de découverte : apporte tout de même de la valeur avec 2 ou 3 hypothèses plausibles, explique pourquoi elles sont plausibles, puis pose une seule question à fort rendement informationnel. N'invente aucune situation propre à l'entreprise.";
  }
}
