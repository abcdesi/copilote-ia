import type { FinancialAuditResult, FinancialStatementInput } from "@/lib/intelligence/financial-audit";

export interface FinancialPriority {
  key: string;
  title: string;
  rationale: string;
  businessImpact: "cash" | "margin" | "growth" | "risk" | "productivity";
  priority: "high" | "medium" | "low";
  automationTemplateId?: string;
  nextEvidence: string;
}

function ratio(audit: FinancialAuditResult, key: string) {
  return audit.ratios.find((item) => item.key === key)?.value ?? null;
}

export function deriveFinancialPriorities(
  statement: FinancialStatementInput,
  audit: FinancialAuditResult
): FinancialPriority[] {
  const priorities: FinancialPriority[] = [];
  const receivableDays = ratio(audit, "receivable_days");
  const currentRatio = ratio(audit, "current_ratio");
  const operatingMargin = ratio(audit, "operating_margin");
  const payrollRatio = ratio(audit, "payroll_ratio");
  const opexRatio = ratio(audit, "operating_expense_ratio");

  if (receivableDays != null && receivableDays > 45) {
    priorities.push({
      key: "accelerate_cash_collection",
      title: "Réduire le délai d'encaissement avant d'optimiser des tâches secondaires",
      rationale: `Le délai clients estimé est d'environ ${Math.round(receivableDays)} jours. Une baisse même partielle peut libérer de la trésorerie sans chercher de nouveau chiffre d'affaires.`,
      businessImpact: "cash",
      priority: receivableDays > 60 ? "high" : "medium",
      automationTemplateId: "relance-factures",
      nextEvidence: "Comparer les factures échues, les délais contractuels, les relances actuelles et les causes de retard sur les 90 derniers jours.",
    });
  }

  if (currentRatio != null && currentRatio < 1.1) {
    priorities.push({
      key: "protect_short_term_liquidity",
      title: "Sécuriser la liquidité des 90 prochains jours",
      rationale: `Le ratio de liquidité générale est d'environ ${currentRatio.toFixed(2)}. Pilotzia doit relier encaissements attendus, échéances fournisseurs et sorties prévisibles avant de recommander des dépenses ou automatisations non prioritaires.`,
      businessImpact: "risk",
      priority: currentRatio < 1 ? "high" : "medium",
      nextEvidence: "Importer ou connecter l'échéancier clients/fournisseurs et les principales sorties de trésorerie à venir.",
    });
  }

  if (payrollRatio != null && payrollRatio > 45) {
    priorities.push({
      key: "labor_productivity_audit",
      title: "Auditer les heures salariées absorbées par les tâches répétitives",
      rationale: `La masse salariale représente environ ${payrollRatio.toFixed(1)} % du chiffre d'affaires de la période. Avant de chercher à réduire l'effectif, il faut identifier les heures à faible valeur qui peuvent être supprimées, standardisées ou automatisées.`,
      businessImpact: "productivity",
      priority: payrollRatio > 55 ? "high" : "medium",
      nextEvidence: "Mesurer pendant 2 à 4 semaines les tâches répétitives par équipe, leur fréquence, leur durée et leur impact client.",
    });
  }

  if (operatingMargin != null && operatingMargin < 10) {
    priorities.push({
      key: "margin_root_cause",
      title: "Expliquer la marge opérationnelle avant de lancer de nouvelles automatisations",
      rationale: `La marge opérationnelle ressort autour de ${operatingMargin.toFixed(1)} %. Le meilleur levier dépend de la cause : prix, coûts directs, sous-utilisation, temps non facturé, charges fixes ou inefficacité opérationnelle.`,
      businessImpact: "margin",
      priority: operatingMargin < 5 ? "high" : "medium",
      nextEvidence: "Décomposer la marge par offre, client ou équipe et comparer la période aux 12 mois précédents.",
    });
  }

  if (opexRatio != null && opexRatio > 70) {
    priorities.push({
      key: "opex_review",
      title: "Prioriser les charges opérationnelles qui progressent plus vite que l'activité",
      rationale: `Les charges opérationnelles représentent environ ${opexRatio.toFixed(1)} % du chiffre d'affaires de la période. Pilotzia doit distinguer les charges nécessaires à la croissance des coûts devenus structurellement inefficients.`,
      businessImpact: "margin",
      priority: "medium",
      nextEvidence: "Comparer les principales catégories de charges aux périodes précédentes et au niveau d'activité associé.",
    });
  }

  if (statement.revenue != null && statement.revenue > 0 && priorities.length === 0) {
    priorities.push({
      key: "deepen_financial_context",
      title: "Comparer les périodes avant de conclure qu'aucun levier financier n'est prioritaire",
      rationale: "Aucun signal isolé de cette période ne suffit à justifier une action prioritaire. La tendance et les écarts par rapport aux périodes précédentes sont plus instructifs qu'un instantané.",
      businessImpact: "risk",
      priority: "low",
      nextEvidence: "Ajouter au moins une période comparative et relier les chiffres aux volumes opérationnels qui les expliquent.",
    });
  }

  return priorities.slice(0, 5);
}
