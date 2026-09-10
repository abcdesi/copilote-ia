export function formatHours(hours: number) {
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)} h`;
}

export function formatEur(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const IMPACT_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

export const IMPACT_LABELS: Record<string, string> = {
  low: "Impact modéré",
  medium: "Impact moyen",
  high: "Impact élevé",
};

export const COMPLEXITY_LABELS: Record<string, string> = {
  low: "Mise en place rapide",
  medium: "Complexité moyenne",
  high: "Mise en place avancée",
};

export const COMPLEXITY_SHORT_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Élevée",
};

export const AUTOMATION_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  warning: "Nécessite votre attention",
  error: "Problème détecté",
  inactive: "Désactivée",
};

export const HEALTH_EMOJI: Record<string, string> = {
  green: "🟢",
  orange: "🟠",
  red: "🔴",
};

export function relativeTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `il y a ${diffD} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}
