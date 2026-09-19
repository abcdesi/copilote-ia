import { randomUUID } from "crypto";
import {
  activateWorkflow,
  createWorkflow,
  getWorkflow,
  listWorkflows,
  updateWorkflow,
} from "@/lib/n8n/client";

export type ProviderOutcomeRelayProvider = "hubspot" | "stripe";

const PROVIDER_OUTCOME_RELAY_MARKER = "PILOTZIA_PROVIDER_OUTCOME_RELAY_V1";

function appUrl() {
  return (process.env.APP_URL || "https://pilotzia.com").replace(/\/$/, "");
}

function callbackSecret() {
  const secret = process.env.N8N_CALLBACK_SECRET?.trim();
  if (!secret) throw new Error("N8N_CALLBACK_SECRET manquant pour sécuriser les résultats fournisseur.");
  return secret;
}

function n8nBaseUrl() {
  const value = process.env.N8N_API_URL?.trim();
  if (!value) throw new Error("N8N_API_URL manquante.");
  return value.replace(/\/$/, "");
}

export function providerOutcomeRelayPath(provider: ProviderOutcomeRelayProvider) {
  return `pilotzia-${provider}-outcomes-v1`;
}

function providerOutcomeRelayName(provider: ProviderOutcomeRelayProvider) {
  return `Pilotzia — ${provider === "hubspot" ? "HubSpot" : "Stripe métier"} outcomes`;
}

function relayCode(provider: ProviderOutcomeRelayProvider) {
  const secret = callbackSecret();
  return `
// ${PROVIDER_OUTCOME_RELAY_MARKER}
const request = $input.first().json;
const expectedAuthorization = ${JSON.stringify(`Bearer ${secret}`)};
const authorization = String(request.headers?.authorization || request.headers?.Authorization || "");
if (!authorization || authorization !== expectedAuthorization) {
  throw new Error("Relais Pilotzia non autorisé.");
}

const input = request.body || request;
if (input.provider !== ${JSON.stringify(provider)}) {
  throw new Error("Provider inattendu pour ce workflow.");
}
if (!input.companyId || !input.automationId || !input.providerEventId || !input.kind || !input.observedAt) {
  throw new Error("Payload de résultat fournisseur incomplet.");
}

const result = await this.helpers.httpRequest({
  method: "POST",
  url: ${JSON.stringify(`${appUrl()}/api/automation-engine/outcomes/provider`)},
  headers: {
    Authorization: `Bearer ${${JSON.stringify(secret)}}`,
    "Content-Type": "application/json",
  },
  body: input,
  json: true,
});

return [{ json: result }];
`.trim();
}

export function buildProviderOutcomeRelayWorkflow(provider: ProviderOutcomeRelayProvider) {
  return {
    name: providerOutcomeRelayName(provider),
    nodes: [
      {
        id: "webhook",
        name: "Webhook fournisseur",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [0, 0],
        webhookId: randomUUID(),
        parameters: {
          httpMethod: "POST",
          path: providerOutcomeRelayPath(provider),
          responseMode: "lastNode",
        },
      },
      {
        id: "relay",
        name: "Relayer vers Pilotzia",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [320, 0],
        parameters: {
          mode: "runOnceForAllItems",
          jsCode: relayCode(provider),
        },
      },
    ],
    connections: {
      "Webhook fournisseur": {
        main: [[{ node: "Relayer vers Pilotzia", type: "main", index: 0 }]],
      },
    },
  };
}

function isCurrentRelayWorkflow(workflow: { nodes?: unknown[] }, provider: ProviderOutcomeRelayProvider) {
  const serialized = JSON.stringify(workflow.nodes ?? []);
  return (
    serialized.includes(PROVIDER_OUTCOME_RELAY_MARKER) &&
    serialized.includes(providerOutcomeRelayPath(provider)) &&
    serialized.includes("/api/automation-engine/outcomes/provider")
  );
}

export async function ensureProviderOutcomeRelayWorkflow(provider: ProviderOutcomeRelayProvider) {
  const definition = buildProviderOutcomeRelayWorkflow(provider);
  const workflows = await listWorkflows();
  let workflow = workflows.data.find((candidate) => candidate.name === definition.name) ?? null;

  if (!workflow) {
    workflow = await createWorkflow(definition);
  } else {
    workflow = await updateWorkflow(workflow.id, definition);
  }

  const verified = await getWorkflow(workflow.id);
  if (!isCurrentRelayWorkflow(verified, provider)) {
    throw new Error(`Le workflow n8n ${provider} n'a pas été publié dans sa version attendue.`);
  }
  if (!verified.active) await activateWorkflow(verified.id);
  return verified.id;
}

export interface ProviderOutcomeRelayPayload {
  companyId: string;
  automationId: string;
  prospectId?: string;
  provider: ProviderOutcomeRelayProvider;
  providerEventId: string;
  kind: "deal_won" | "payment_received";
  observedAt: string;
  amountEur?: number;
  externalEntityRef?: string;
  note?: string;
}

export async function triggerProviderOutcomeRelay(
  provider: ProviderOutcomeRelayProvider,
  payload: ProviderOutcomeRelayPayload
) {
  if (payload.provider !== provider) throw new Error("Provider de résultat incohérent.");
  await ensureProviderOutcomeRelayWorkflow(provider);

  const res = await fetch(`${n8nBaseUrl()}/webhook/${providerOutcomeRelayPath(provider)}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${callbackSecret()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Relais n8n ${provider} impossible (${res.status}): ${detail.slice(0, 300)}`);
  }
  return res.json() as Promise<{ ok?: boolean; created?: boolean; outcomeId?: string }>;
}
