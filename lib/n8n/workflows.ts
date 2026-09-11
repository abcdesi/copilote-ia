// Construit le workflow n8n réel pour les automatisations "liste de contacts + email"
// (relance de prospects, onboarding clients, suivi de satisfaction...), pour une
// entreprise donnée. Un seul nœud Code orchestre tout (récupérer les contacts et le
// message à envoyer, envoyer via Resend, marquer comme contacté) — plus simple et plus
// fiable à générer par API qu'une longue chaîne de nœuds HTTP Request séparés. Le
// message envoyé (sujet/corps) est récupéré à chaque exécution depuis l'API plutôt que
// figé dans le code du workflow, pour qu'une personnalisation faite par le client soit
// prise en compte sans avoir à recréer le workflow.

import { randomUUID } from "crypto";

const PILOTZIA_URL = "https://pilotzia.com";

function contactListWorkflowCode() {
  return `
const input = $input.first().json.body || $input.first().json;
const companyId = input.companyId;
const templateId = input.templateId || "relance-prospects";
if (!companyId) {
  throw new Error("companyId manquant dans la requête.");
}

const PILOTZIA_URL = "${PILOTZIA_URL}";
const CALLBACK_SECRET = "${process.env.N8N_CALLBACK_SECRET}";
const RESEND_KEY = "${process.env.RESEND_API_KEY}";

const { prospects, message } = await this.helpers.httpRequest({
  method: "GET",
  url: \`\${PILOTZIA_URL}/api/automation-engine/prospects\`,
  qs: { companyId, templateId },
  headers: { Authorization: \`Bearer \${CALLBACK_SECRET}\` },
  json: true,
});

const results = [];
for (const p of prospects || []) {
  const subject = String(message?.subject || "").split("{{name}}").join(p.name);
  const bodyText = String(message?.body || "").split("{{name}}").join(p.name);
  const html = bodyText
    .split("\\n")
    .filter((line) => line.length > 0)
    .map((line) => \`<p>\${line}</p>\`)
    .join("");

  await this.helpers.httpRequest({
    method: "POST",
    url: "https://api.resend.com/emails",
    headers: { Authorization: \`Bearer \${RESEND_KEY}\`, "Content-Type": "application/json" },
    body: {
      from: "Pilotzia <relances@pilotzia.com>",
      to: [p.email],
      subject,
      html,
    },
    json: true,
  });

  await this.helpers.httpRequest({
    method: "POST",
    url: \`\${PILOTZIA_URL}/api/automation-engine/prospects/\${p.id}/mark-contacted\`,
    headers: { Authorization: \`Bearer \${CALLBACK_SECRET}\` },
    json: true,
  });

  results.push({ prospectId: p.id, email: p.email, sent: true });
}

return [{ json: { companyId, templateId, relancedCount: results.length, results } }];
`.trim();
}

// Le paramètre templateId a une valeur par défaut pour rester compatible avec le tout
// premier workflow créé (relance-prospects), dont l'URL webhook ne l'incluait pas.
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
        // n8n n'enregistre pas la route de production si ce champ est absent à la
        // création par API (contrairement à une création depuis l'éditeur, qui le
        // génère automatiquement) — sans lui, le webhook répond 404 silencieusement.
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
