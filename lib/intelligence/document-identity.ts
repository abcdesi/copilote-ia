export type DocumentIdentityStatus = "matched" | "mismatch" | "review_required" | "unknown";

export interface DocumentIdentityInput {
  companyName: string;
  companySiret?: string | null;
  extractedCompanyName?: string | null;
  extractedCompanySiret?: string | null;
  confidence?: number | null;
}

function normalizeSiret(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function normalizeName(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(sas|sasu|sarl|eurl|sa|sci|scop|societe|entreprise|groupe)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function namesCompatible(a?: string | null, b?: string | null) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return null;
  if (left === right) return true;
  if (left.length >= 5 && right.length >= 5 && (left.includes(right) || right.includes(left))) return true;
  return false;
}

export function assessDocumentIdentity(input: DocumentIdentityInput) {
  const expectedSiret = normalizeSiret(input.companySiret);
  const detectedSiret = normalizeSiret(input.extractedCompanySiret);
  const confidence = Math.max(0, Math.min(1, Number(input.confidence ?? 0)));

  if (expectedSiret && detectedSiret) {
    if (expectedSiret === detectedSiret) {
      return { status: "matched" as const, reason: "siret_match", expectedSiret, detectedSiret };
    }
    return { status: "mismatch" as const, reason: "siret_mismatch", expectedSiret, detectedSiret };
  }

  const nameCompatible = namesCompatible(input.companyName, input.extractedCompanyName);
  if (nameCompatible === true) {
    return { status: "matched" as const, reason: "name_match", expectedSiret, detectedSiret };
  }

  if (nameCompatible === false && confidence >= 0.85) {
    return { status: "review_required" as const, reason: "name_mismatch_high_confidence", expectedSiret, detectedSiret };
  }

  return { status: "unknown" as const, reason: "identity_insufficient", expectedSiret, detectedSiret };
}
