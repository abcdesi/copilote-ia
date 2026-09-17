import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { triggerAutomation } from "@/lib/n8n/execution";
import { runDataRetentionMaintenance } from "@/lib/maintenance/retention";

function hasValidCronSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actualBuffer = Buffer.from(auth);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const automations = await prisma.automation.findMany({
    where: { n8nWorkflowId: { not: null }, status: "active" },
    select: { id: true, companyId: true, templateId: true, n8nWorkflowId: true, errorCount: true },
  });

  const results = [];
  for (const automation of automations) {
    const outcome = await triggerAutomation(automation, "scheduled");
    results.push({
      automationId: automation.id,
      ok: outcome.ok,
      reason: outcome.ok ? undefined : "execution_blocked_or_failed",
    });
  }

  const retention = await runDataRetentionMaintenance().catch((error) => {
    console.error("Data retention maintenance failed", error);
    return null;
  });

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    count: results.length,
    results,
    retention: retention ? { ok: true } : { ok: false },
  });
}
