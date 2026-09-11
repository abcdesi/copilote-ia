// Construit le workflow n8n réel pour "Relance automatique des prospects", pour une
// entreprise donnée. Un seul nœud Code orchestre tout (récupérer les prospects à
// relancer, envoyer via Resend, marquer comme relancé) — plus simple et plus fiable
// à générer par API qu'une longue chaîne de nœuds HTTP Request séparés.

const PILOTZIA_URL = "https://pilotzia.com";

function relanceProspectsCode() {
  return `
const companyId = $input.first().json.body?.companyId || $input.first().json.companyId;
if (!companyId) {
  throw new Error("companyId manquant dans la requête.");
}

const PILOTZIA_URL = "${PILOTZIA_URL}";
const CALLBACK_SECRET = "${process.env.N8N_CALLBACK_SECRET}";
const RESEND_KEY = "${process.env.RESEND_API_KEY}";

const { prospects } = await this.helpers.httpRequest({
  method: "GET",
  url: \`\${PILOTZIA_URL}/api/automation-engine/prospects\`,
  qs: { companyId },
  headers: { Authorization: \`Bearer \${CALLBACK_SECRET}\` },
  json: true,
});

const results = [];
for (const p of prospects || []) {
  await this.helpers.httpRequest({
    method: "POST",
    url: "https://api.resend.com/emails",
    headers: { Authorization: \`Bearer \${RESEND_KEY}\`, "Content-Type": "application/json" },
    body: {
      from: "Pilotzia <relances@pilotzia.com>",
      to: [p.email],
      subject: \`\${p.name}, un petit rappel de notre part\`,
      html: \`<p>Bonjour \${p.name},</p><p>Nous voulions simplement prendre de vos nouvelles suite à notre dernier échange. N'hésitez pas à nous répondre si vous avez des questions.</p><p>Cordialement</p>\`,
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

return [{ json: { companyId, relancedCount: results.length, results } }];
`.trim();
}

export function webhookPathForCompany(companyId: string) {
  return `relance-prospects-${companyId}`;
}

export function buildRelanceProspectsWorkflow(companyId: string) {
  return {
    name: `Relance prospects — ${companyId}`,
    nodes: [
      {
        id: "webhook",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [0, 0],
        parameters: {
          httpMethod: "POST",
          path: webhookPathForCompany(companyId),
          responseMode: "lastNode",
        },
      },
      {
        id: "run",
        name: "Relancer les prospects",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [300, 0],
        parameters: {
          mode: "runOnceForAllItems",
          jsCode: relanceProspectsCode(),
        },
      },
    ],
    connections: {
      Webhook: { main: [[{ node: "Relancer les prospects", type: "main", index: 0 }]] },
    },
  };
}
