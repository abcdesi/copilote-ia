// Client pour l'instance n8n qui exécute réellement les automatisations —
// invisible pour l'utilisateur final, appelé uniquement depuis notre backend.

const N8N_API_URL = process.env.N8N_API_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

export function isN8nConfigured() {
  return Boolean(N8N_API_URL && N8N_API_KEY);
}

async function n8nFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!N8N_API_URL || !N8N_API_KEY) {
    throw new Error("N8N_API_URL / N8N_API_KEY non configurés.");
  }
  const res = await fetch(`${N8N_API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "X-N8N-API-KEY": N8N_API_KEY,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`n8n API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: unknown[];
  connections: unknown;
}

export async function listWorkflows() {
  return n8nFetch<{ data: N8nWorkflow[] }>("/workflows");
}

export async function createWorkflow(input: { name: string; nodes: unknown[]; connections: unknown; settings?: Record<string, unknown> }) {
  return n8nFetch<N8nWorkflow>("/workflows", {
    method: "POST",
    body: JSON.stringify({ ...input, settings: input.settings ?? {} }),
  });
}

export async function activateWorkflow(id: string) {
  return n8nFetch<N8nWorkflow>(`/workflows/${id}/activate`, { method: "POST" });
}

export async function deactivateWorkflow(id: string) {
  return n8nFetch<N8nWorkflow>(`/workflows/${id}/deactivate`, { method: "POST" });
}

export async function deleteWorkflow(id: string) {
  return n8nFetch<void>(`/workflows/${id}`, { method: "DELETE" });
}

export interface N8nExecution {
  id: string;
  finished: boolean;
  status: string; // "success" | "error" | "waiting" | ...
  startedAt: string;
  stoppedAt: string | null;
}

export async function getWorkflowExecutions(workflowId: string, limit = 20) {
  return n8nFetch<{ data: N8nExecution[] }>(`/executions?workflowId=${workflowId}&limit=${limit}`);
}
