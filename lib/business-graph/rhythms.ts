import { prisma } from "@/lib/db/client";

export type BusinessRhythmDomain = "finance" | "accounting" | "sales" | "marketing" | "hr" | "operations";
export type BusinessRhythmCadence = "weekly" | "monthly" | "quarterly" | "annual" | "seasonal";

export interface BusinessRhythmCompanyInput {
  id?: string;
  financeContext?: string | null;
  accountingContext?: string | null;
  salesContext?: string | null;
  marketingContext?: string | null;
  hrContext?: string | null;
  operationsContext?: string | null;
  localContext?: string | null;
  objectives?: string | null;
  painPoints?: string | null;
}

export interface BusinessRhythm {
  key: string;
  domain: BusinessRhythmDomain;
  title: string;
  cadence: BusinessRhythmCadence;
  months: number[];
  nextExpectedAt: string;
  leadDays: number;
  confidence: number;
  sourceField: string;
  summary: string;
}

const MONTHS: Array<{ month: number; aliases: string[]; short: string }> = [
  { month: 1, aliases: ["janvier", "janv"], short: "janv." },
  { month: 2, aliases: ["fevrier", "fevr"], short: "févr." },
  { month: 3, aliases: ["mars"], short: "mars" },
  { month: 4, aliases: ["avril", "avr"], short: "avr." },
  { month: 5, aliases: ["mai"], short: "mai" },
  { month: 6, aliases: ["juin"], short: "juin" },
  { month: 7, aliases: ["juillet", "juil"], short: "juil." },
  { month: 8, aliases: ["aout"], short: "août" },
  { month: 9, aliases: ["septembre", "sept"], short: "sept." },
  { month: 10, aliases: ["octobre", "oct"], short: "oct." },
  { month: 11, aliases: ["novembre", "nov"], short: "nov." },
  { month: 12, aliases: ["decembre", "dec"], short: "déc." },
];

const RHYTHM_RULES: Array<{
  key: string;
  domain: BusinessRhythmDomain;
  title: string;
  patterns: RegExp[];
  defaultCadence: BusinessRhythmCadence;
  leadDays: number;
  fields: Array<keyof BusinessRhythmCompanyInput>;
}> = [
  {
    key: "annual_accounts",
    domain: "accounting",
    title: "Bilan / clôture annuelle",
    patterns: [/\bbilan\b/i, /cloture annuelle/i, /comptes annuels/i],
    defaultCadence: "annual",
    leadDays: 35,
    fields: ["accountingContext", "financeContext"],
  },
  {
    key: "monthly_close",
    domain: "accounting",
    title: "Clôture comptable",
    patterns: [/cloture mensuelle/i, /arrete mensuel/i, /closing mensuel/i],
    defaultCadence: "monthly",
    leadDays: 7,
    fields: ["accountingContext"],
  },
  {
    key: "budget_cycle",
    domain: "finance",
    title: "Budget / prévisions",
    patterns: [/\bbudget\b/i, /prevision/i, /forecast/i, /atterrissage/i],
    defaultCadence: "annual",
    leadDays: 30,
    fields: ["financeContext", "accountingContext", "objectives"],
  },
  {
    key: "recruitment_period",
    domain: "hr",
    title: "Période de recrutement",
    patterns: [/recrut/i, /embauch/i, /campagne de recrutement/i],
    defaultCadence: "seasonal",
    leadDays: 45,
    fields: ["hrContext", "objectives", "painPoints"],
  },
  {
    key: "annual_reviews",
    domain: "hr",
    title: "Entretiens / revue RH",
    patterns: [/entretien annuel/i, /entretiens annuels/i, /revue salariale/i, /people review/i],
    defaultCadence: "annual",
    leadDays: 30,
    fields: ["hrContext"],
  },
  {
    key: "marketing_campaign",
    domain: "marketing",
    title: "Campagne marketing récurrente",
    patterns: [/campagne/i, /salon/i, /newsletter mensuelle/i, /temps fort commercial/i],
    defaultCadence: "seasonal",
    leadDays: 30,
    fields: ["marketingContext", "salesContext", "localContext"],
  },
  {
    key: "commercial_review",
    domain: "sales",
    title: "Revue commerciale",
    patterns: [/revue commerciale/i, /revue de pipeline/i, /pipeline mensuel/i, /forecast commercial/i],
    defaultCadence: "monthly",
    leadDays: 5,
    fields: ["salesContext"],
  },
  {
    key: "inventory_audit",
    domain: "operations",
    title: "Inventaire / audit opérationnel",
    patterns: [/inventaire/i, /audit operation/i, /maintenance preventive/i, /controle periodique/i],
    defaultCadence: "annual",
    leadDays: 21,
    fields: ["operationsContext", "accountingContext"],
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function monthsInText(value: string) {
  const text = normalize(value);
  return MONTHS.filter((entry) => entry.aliases.some((alias) => new RegExp(`\\b${alias}\\b`, "i").test(text))).map((entry) => entry.month);
}

function cadenceInText(value: string, fallback: BusinessRhythmCadence, hasMonths: boolean): BusinessRhythmCadence {
  const text = normalize(value);
  if (/chaque semaine|hebdo|hebdomadaire/.test(text)) return "weekly";
  if (/chaque mois|mensuel|mensuelle|tous les mois/.test(text)) return "monthly";
  if (/trimestr|chaque trimestre/.test(text)) return "quarterly";
  if (/annuel|annuelle|chaque an|tous les ans|une fois par an/.test(text)) return "annual";
  if (/saison|periode|pic|haute saison/.test(text) || (fallback === "seasonal" && hasMonths)) return "seasonal";
  return fallback;
}

function nextForCadence(cadence: BusinessRhythmCadence, months: number[], now: Date) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const today = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate()));

  if (months.length) {
    for (const month of [...months].sort((a, b) => a - b)) {
      const candidate = new Date(Date.UTC(y, month - 1, 1));
      if (candidate >= today) return candidate;
    }
    return new Date(Date.UTC(y + 1, Math.min(...months) - 1, 1));
  }

  if (cadence === "weekly") {
    const next = new Date(today);
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  if (cadence === "monthly") return new Date(Date.UTC(y + (m === 12 ? 1 : 0), m % 12, 1));
  if (cadence === "quarterly") {
    const nextQuarterMonth = Math.floor((m - 1) / 3) * 3 + 3;
    return new Date(Date.UTC(y + (nextQuarterMonth >= 12 ? 1 : 0), nextQuarterMonth % 12, 1));
  }
  return new Date(Date.UTC(y + 1, 0, 1));
}

function compactMonths(months: number[]) {
  if (!months.length) return "";
  return months
    .slice()
    .sort((a, b) => a - b)
    .map((month) => MONTHS.find((entry) => entry.month === month)?.short ?? String(month))
    .join("–");
}

function cadenceLabel(cadence: BusinessRhythmCadence) {
  if (cadence === "weekly") return "hebdomadaire";
  if (cadence === "monthly") return "mensuel";
  if (cadence === "quarterly") return "trimestriel";
  if (cadence === "annual") return "annuel";
  return "saisonnier";
}

export function extractBusinessRhythms(company: BusinessRhythmCompanyInput, now = new Date()): BusinessRhythm[] {
  const rhythms: BusinessRhythm[] = [];

  for (const rule of RHYTHM_RULES) {
    for (const field of rule.fields) {
      const raw = company[field];
      if (typeof raw !== "string" || !raw.trim()) continue;

      const sentences = splitSentences(raw);
      const matching = sentences.find((sentence) => rule.patterns.some((pattern) => pattern.test(normalize(sentence))));
      if (!matching) continue;

      const months = monthsInText(matching);
      const cadence = cadenceInText(matching, rule.defaultCadence, months.length > 0);
      const next = nextForCadence(cadence, months, now);
      const explicitCadence = /(hebdo|mensuel|trimestr|annuel|chaque|tous les|saison|periode)/i.test(normalize(matching));
      const confidence = Math.min(0.92, 0.66 + (explicitCadence ? 0.1 : 0) + (months.length ? 0.1 : 0));
      const period = compactMonths(months);

      rhythms.push({
        key: rule.key,
        domain: rule.domain,
        title: rule.title,
        cadence,
        months,
        nextExpectedAt: next.toISOString(),
        leadDays: rule.leadDays,
        confidence,
        sourceField: String(field),
        summary: `${rule.title} · ${period || cadenceLabel(cadence)}`,
      });
      break;
    }
  }

  return rhythms;
}

export function getBusinessRhythmReminders(company: BusinessRhythmCompanyInput, now = new Date()) {
  return extractBusinessRhythms(company, now)
    .map((rhythm) => {
      const daysUntil = Math.ceil((new Date(rhythm.nextExpectedAt).getTime() - now.getTime()) / 86_400_000);
      return { ...rhythm, daysUntil };
    })
    .filter((rhythm) => rhythm.confidence >= 0.7 && rhythm.daysUntil >= 0 && rhythm.daysUntil <= rhythm.leadDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || b.confidence - a.confidence)
    .slice(0, 3);
}

export async function syncBusinessRhythms(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return [];

  const subject = await prisma.businessEntity.findFirst({ where: { companyId, type: "company", canonicalKey: companyId } });
  if (!subject) return [];

  const rhythms = extractBusinessRhythms(company);
  await prisma.businessFact.deleteMany({ where: { companyId, sourceProvider: "pilotzia-memory", predicate: "business_rhythm" } });

  if (!rhythms.length) return [];

  await prisma.businessFact.createMany({
    data: rhythms.map((rhythm) => ({
      companyId,
      subjectEntityId: subject.id,
      predicate: "business_rhythm",
      valueJson: JSON.stringify({
        k: rhythm.key,
        d: rhythm.domain,
        t: rhythm.title,
        c: rhythm.cadence,
        m: rhythm.months,
        n: rhythm.nextExpectedAt,
        l: rhythm.leadDays,
      }),
      sourceProvider: "pilotzia-memory",
      sourceRef: `memory:rhythm:${rhythm.key}`,
      confidence: rhythm.confidence,
      observedAt: new Date(),
      provenanceJson: JSON.stringify({ method: "normalized_recurrence", field: rhythm.sourceField, rawStored: false }),
    })),
  });

  return rhythms;
}
