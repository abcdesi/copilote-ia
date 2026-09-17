// Construit le workflow n8n réel pour les automatisations "liste de contacts + email".
// n8n orchestre uniquement le déclenchement. Pilotzia reste la source de vérité pour
// l'éligibilité, le rendu du message, l'envoi fournisseur, l'idempotence et la preuve.

import { randomUUID } from "crypto";

const PILOTZIA_URL = "https://pilotzia.com";

function contactListWorkflowCode() {
  return `
const input = $input.first().json.body || $input.first().json;
const companyId = input.companyId;
const automationId = input.automationId;
const runId = input.runId || null;
const templateId = input.templateId || "relance-prospects";
if (!companyId || !automationId) {
  throw new Error("companyId ou automationId manquant dans la requête.");
}

const PILOTZIA_URL = "${PILOTZIA_URL}";
const CALLBACK_SECRET = "${process.env.N8N_CALLBACK_SECRET}";

const { prospects } = await this.helpers.httpRequest({
  method: "GET",
  url: \`\${PILOTZIA_URL}/api/automation-engine/prospects\`,
  qs: { companyId, automationId, templateId },
  headers: { Authorization: \`Bearer \${CALLBACK_SECRET}\` },
  json: true,
});

const results = [];
for (const p of prospects || []) {
  try {
    const sent = await this.helpers.httpRequest({
      method: "POST",
      url: \`\${PILOTZIA_URL}/api/automation-engine/prospects/\${p.id}/send\`,
      headers: {
        Authorization: \`Bearer \${CALLBACK_SECRET}\`,
        "Content-Type": "application/json",
      },
      body: { automationId, runId },
      json: true,
    });

    results.push({
      prospectId: p.id,
      email: p.email,
      sent: Boolean(sent?.ok),
      providerMessageId: sent?.providerMessageId || null,
      messageVersion: sent?.messageVersion || p.messageVersion || null,
    });
  } catch (err) {
    results.push({ prospectId: p.id, email: p.email, sent: false, error: err.message || String(err) });
  }
}

const relancedCount = results.filter((r) => r.sent).length;
const errorCount = results.filter((r) => !r.sent).length;
return [{ json: { companyId, automationId, templateId, runId, relancedCount, errorCount, results } }];
`.trim();
}

export function webhookPathForCompany(companyId: string, templateId: string = "relance-prospects") {
  return `${templateId}-${companyId}`;
}

export function buildContactListWorkflow(companyId: string, templateId: string) {
  return {
    name: `${templateId} — ${companyId}`,
    nodes: [
      {
        id: "webhook",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [0, 0],
        webhookId: randomUUID(),
        parameters: {
          httpMethod: "POST",
          path: webhookPathForCompany(companyId, templateId),
          responseMode: "lastNode",
        },
      },
      {
        id: "run",
        name: "Exécuter",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [300, 0],
        parameters: {
          mode: "runOnceForAllItems",
          jsCode: contactListWorkflowCode(),
        },
      },
    ],
    connections: {
      Webhook: { main: [[{ node: "Exécuter", type: "main", index: 0 }]] },
    },
  };
}
