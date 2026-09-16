import { NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { isPilotziaAdmin } from "@/lib/admin/access";

function configuredModel(mode: "fast" | "smart") {
  if (mode === "fast") {
    return process.env.ANTHROPIC_MODEL_FAST || process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  }
  return process.env.ANTHROPIC_MODEL_SMART || process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

async function checkModel(apiKey: string, model: string) {
  const response = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      model,
    };
  }

  const data = (await response.json()) as {
    id?: string;
    display_name?: string;
    max_input_tokens?: number | null;
    max_tokens?: number | null;
  };

  return {
    ok: true,
    status: response.status,
    model: data.id ?? model,
    displayName: data.display_name ?? null,
    maxInputTokens: data.max_input_tokens ?? null,
    maxOutputTokens: data.max_tokens ?? null,
  };
}

export async function GET() {
  const session = await requireSession();
  if (!isPilotziaAdmin(session.user.email)) {
    return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      provider: "anthropic",
      configured: false,
      available: false,
      reason: "ANTHROPIC_API_KEY absente",
    });
  }

  const fastModel = configuredModel("fast");
  const smartModel = configuredModel("smart");

  try {
    const [fast, smart] = await Promise.all([
      checkModel(apiKey, fastModel),
      fastModel === smartModel ? Promise.resolve(null) : checkModel(apiKey, smartModel),
    ]);

    const smartResult = smart ?? fast;
    return NextResponse.json({
      provider: "anthropic",
      configured: true,
      available: fast.ok && smartResult.ok,
      fast,
      smart: smartResult,
    });
  } catch (error) {
    return NextResponse.json({
      provider: "anthropic",
      configured: true,
      available: false,
      reason: error instanceof Error ? error.message : "Erreur réseau inconnue",
    });
  }
}
