export function isPilotziaAdmin(email?: string | null) {
  if (!email) return false;
  const allowed = (process.env.PILOTZIA_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export function minimumBenchmarkCohortSize() {
  const parsed = Number(process.env.PILOTZIA_BENCHMARK_MIN_COHORT || "5");
  return Number.isFinite(parsed) ? Math.max(3, Math.round(parsed)) : 5;
}
