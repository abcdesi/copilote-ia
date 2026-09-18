import { createHash } from "node:crypto";

export const MESSAGE_VARIABLES = [
  { key: "name", label: "Nom du destinataire", scope: "contact" },
  { key: "email", label: "Email du destinataire", scope: "contact" },
  { key: "company_name", label: "Nom de la société", scope: "company" },
  { key: "siret", label: "SIRET", scope: "company" },
  { key: "address", label: "Adresse", scope: "company" },
  { key: "phone", label: "Téléphone", scope: "company" },
] as const;

export type MessageVariableKey = (typeof MESSAGE_VARIABLES)[number]["key"];
export type ApprovalMode = "always_review" | "first_then_auto";

const VARIABLE_KEYS = new Set<string>(MESSAGE_VARIABLES.map((variable) => variable.key));
const VARIABLE_RE = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function extractMessageVariables(text: string) {
  const variables = new Set<string>();
  for (const match of text.matchAll(VARIABLE_RE)) variables.add(match[1]);
  return [...variables];
}

export function validateMessageTemplate(subject: string, body: string) {
  const variables = [...new Set([...extractMessageVariables(subject), ...extractMessageVariables(body)])];
  const unknown = variables.filter((key) => !VARIABLE_KEYS.has(key));
  return { valid: unknown.length === 0, variables, unknown };
}

export function renderMessageTemplate(text: string, values: Partial<Record<MessageVariableKey, string | null | undefined>>) {
  const missing = new Set<string>();
  const rendered = text.replace(VARIABLE_RE, (_full, rawKey: string) => {
    const key = rawKey as MessageVariableKey;
    if (!VARIABLE_KEYS.has(key)) {
      missing.add(rawKey);
      return `{{${rawKey}}}`;
    }
    const value = values[key]?.trim();
    if (!value) {
      missing.add(key);
      return `{{${key}}}`;
    }
    return value;
  });
  return { rendered, missing: [...missing] };
}

export function automationConfigHash(input: {
  templateId: string | null;
  messageSubject: string;
  messageBody: string;
  approvalMode: string;
  cadenceDays: number | null;
  maxSendsPerContact: number | null;
  scheduleStartHour: number;
  scheduleEndHour: number;
  scheduleDays: string;
  replyToEmail: string | null;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        templateId: input.templateId,
        messageSubject: input.messageSubject,
        messageBody: input.messageBody,
        approvalMode: input.approvalMode,
        cadenceDays: input.cadenceDays,
        maxSendsPerContact: input.maxSendsPerContact,
        scheduleStartHour: input.scheduleStartHour,
        scheduleEndHour: input.scheduleEndHour,
        scheduleDays: input.scheduleDays,
        replyToEmail: input.replyToEmail,
      })
    )
    .digest("hex");
}

export function approvalModeLabel(mode: string) {
  return mode === "always_review" ? "Valider chaque exécution" : "Autonome après la première validation";
}
