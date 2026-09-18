export type CompanySizeRange = "1-5" | "6-20" | "21-50" | "51-200" | "200+";

export function companySizeRangeFromEmployeeCount(employeeCount?: number | null): CompanySizeRange | null {
  if (!employeeCount || employeeCount < 1) return null;
  if (employeeCount <= 5) return "1-5";
  if (employeeCount <= 20) return "6-20";
  if (employeeCount <= 50) return "21-50";
  if (employeeCount <= 200) return "51-200";
  return "200+";
}

export function normalizeCompanySize(input: {
  employeeCount?: number | null;
  sizeRange?: string | null;
}) {
  return companySizeRangeFromEmployeeCount(input.employeeCount) ?? input.sizeRange ?? null;
}
