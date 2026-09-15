export interface FinancialStatementInput {
  periodLabel: string;
  revenue?: number | null;
  grossProfit?: number | null;
  operatingProfit?: number | null;
  netIncome?: number | null;
  cash?: number | null;
  accountsReceivable?: number | null;
  accountsPayable?: number | null;
  inventory?: number | null;
  currentAssets?: number | null;
  currentLiabilities?: number | null;
  totalDebt?: number | null;
  equity?: number | null;
  payrollExpense?: number | null;
  operatingExpenses?: number | null;
}

export interface FinancialRatio {
  key: string;
  label: string;
  value: number;
  unit: "percent" | "days" | "ratio";
  interpretation: string;
}

export interface FinancialAuditResult {
  periodLabel: string;
  ratios: FinancialRatio[];
  alerts: string[];
  questions: string[];
  missingData: string[];
}

function safeDivide(numerator?: number | null, denominator?: number | null) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

function percent(value: number | null) {
  return value == null ? null : value * 100;
}

export function auditFinancialStatement(input: FinancialStatementInput): FinancialAuditResult {
  const ratios: FinancialRatio[] = [];
  const alerts: string[] = [];
  const questions: string[] = [];
  const missingData: string[] = [];

  const grossMargin = percent(safeDivide(input.grossProfit, input.revenue));
  if (grossMargin != null) {
    ratios.push({
      key: "gross_margin",
      label: "Marge brute",
      value: grossMargin,
      unit: "percent",
      interpretation: "Part du chiffre d'affaires restant après les coûts directs.",
    });
  } else missingData.push("chiffre d'affaires et marge brute");

  const operatingMargin = percent(safeDivide(input.operatingProfit, input.revenue));
  if (operatingMargin != null) {
    ratios.push({
      key: "operating_margin",
      label: "Marge opérationnelle",
      value: operatingMargin,
      unit: "percent",
      interpretation: "Rentabilité des opérations avant éléments financiers et exceptionnels.",
    });
  }

  const netMargin = percent(safeDivide(input.netIncome, input.revenue));
  if (netMargin != null) {
    ratios.push({
      key: "net_margin",
      label: "Marge nette",
      value: netMargin,
      unit: "percent",
      interpretation: "Part du chiffre d'affaires transformée en résultat net.",
    });
  }

  const currentRatio = safeDivide(input.currentAssets, input.currentLiabilities);
  if (currentRatio != null) {
    ratios.push({
      key: "current_ratio",
      label: "Ratio de liquidité générale",
      value: currentRatio,
      unit: "ratio",
      interpretation: "Capacité à couvrir les dettes à court terme avec les actifs à court terme.",
    });
    if (currentRatio < 1) {
      alerts.push("La liquidité court terme paraît tendue : les passifs courants dépassent les actifs courants.");
      questions.push("Quelles sorties de trésorerie importantes sont prévues dans les 90 prochains jours ?");
    }
  }

  const receivableDays = input.revenue ? safeDivide((input.accountsReceivable ?? null) * 365, input.revenue) : null;
  if (receivableDays != null) {
    ratios.push({
      key: "receivable_days",
      label: "Délai clients estimé",
      value: receivableDays,
      unit: "days",
      interpretation: "Nombre de jours de chiffre d'affaires immobilisé en créances clients.",
    });
    if (receivableDays > 60) {
      alerts.push("Le délai clients estimé dépasse 60 jours, ce qui peut peser fortement sur la trésorerie.");
      questions.push("Les relances de factures sont-elles manuelles, irrégulières ou réparties entre plusieurs personnes ?");
    }
  } else missingData.push("créances clients et chiffre d'affaires");

  const payableDays = input.revenue ? safeDivide((input.accountsPayable ?? null) * 365, input.revenue) : null;
  if (payableDays != null) {
    ratios.push({
      key: "payable_days_proxy",
      label: "Délai fournisseurs indicatif",
      value: payableDays,
      unit: "days",
      interpretation: "Proxy faute d'achats détaillés ; à confirmer avec le volume réel d'achats.",
    });
  }

  const payrollRatio = percent(safeDivide(input.payrollExpense, input.revenue));
  if (payrollRatio != null) {
    ratios.push({
      key: "payroll_ratio",
      label: "Poids de la masse salariale",
      value: payrollRatio,
      unit: "percent",
      interpretation: "Part du chiffre d'affaires absorbée par la masse salariale.",
    });
    if (payrollRatio > 50) {
      questions.push("Quelles tâches à faible valeur mobilisent aujourd'hui le plus de temps salarié ?");
    }
  }

  const debtToEquity = safeDivide(input.totalDebt, input.equity);
  if (debtToEquity != null) {
    ratios.push({
      key: "debt_to_equity",
      label: "Dette / fonds propres",
      value: debtToEquity,
      unit: "ratio",
      interpretation: "Niveau d'endettement rapporté aux fonds propres.",
    });
  }

  if ((input.cash ?? 0) <= 0) {
    alerts.push("La trésorerie disponible est nulle ou non renseignée : impossible d'évaluer correctement le risque de liquidité.");
  }

  if (questions.length === 0) {
    questions.push("Quel indicateur financier s'est le plus dégradé par rapport à la période précédente ?");
  }

  return { periodLabel: input.periodLabel, ratios, alerts, questions, missingData };
}
