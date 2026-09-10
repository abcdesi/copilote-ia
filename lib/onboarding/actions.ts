"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { runDiagnostic } from "@/lib/ai";
import { getDiagnosticSessionToken, clearDiagnosticSessionToken } from "@/lib/session";
import { materializeOpportunities } from "@/lib/companies/opportunities";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const schema = z.object({
  name: z.string().min(1).max(120),
  industry: z.string().max(120).optional(),
  country: z.string().max(80).optional(),
  sizeRange: z.string().max(20).optional(),
  employeeCount: z.coerce.number().int().positive().optional(),
  painPoints: z.string().max(2000).optional(),
  objectives: z.string().max(2000).optional(),
  diagnosticId: z.string().optional(),
});

export async function completeOnboardingAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tools = formData.getAll("tools").map(String).filter(Boolean);

  const parsed = schema.safeParse({
    name: formData.get("name"),
    industry: formData.get("industry") || undefined,
    country: formData.get("country") || undefined,
    sizeRange: formData.get("sizeRange") || undefined,
    employeeCount: formData.get("employeeCount") || undefined,
    painPoints: formData.get("painPoints") || undefined,
    objectives: formData.get("objectives") || undefined,
    diagnosticId: formData.get("diagnosticId") || undefined,
  });

  if (!parsed.success) {
    redirect("/onboarding?error=invalid");
  }

  const { name, industry, country, sizeRange, employeeCount, painPoints, objectives, diagnosticId } = parsed.data;
  const userId = session!.user.id;

  const company = await prisma.company.create({
    data: {
      userId,
      name,
      industry,
      country,
      sizeRange,
      employeeCount,
      painPoints,
      objectives,
    },
  });

  if (tools.length) {
    await prisma.companyTool.createMany({
      data: tools.map((t) => ({ companyId: company.id, name: t, detected: true })),
    });
  }

  await prisma.subscription.create({
    data: { companyId: company.id, plan: "free", status: "active" },
  });

  const sessionToken = await getDiagnosticSessionToken();
  let diagnostic = null;
  if (diagnosticId && sessionToken) {
    diagnostic = await prisma.diagnostic.findFirst({
      where: { id: diagnosticId, sessionToken, companyId: null },
    });
  }

  if (diagnostic) {
    const result = JSON.parse(diagnostic.resultJson);
    await materializeOpportunities(company.id, result, diagnostic.id);
    await prisma.diagnostic.update({
      where: { id: diagnostic.id },
      data: { companyId: company.id, claimedAt: new Date() },
    });
    await prisma.company.update({
      where: { id: company.id },
      data: { automationScore: result.automationScore },
    });
  } else {
    const combined = [painPoints, objectives].filter(Boolean).join(". ") || name;
    const result = await runDiagnostic(combined, tools);
    const newDiagnostic = await prisma.diagnostic.create({
      data: {
        companyId: company.id,
        rawInput: combined,
        detectedTools: JSON.stringify(result.detectedTools),
        automationScore: result.automationScore,
        resultJson: JSON.stringify(result),
        claimedAt: new Date(),
      },
    });
    await materializeOpportunities(company.id, result, newDiagnostic.id);
    await prisma.company.update({
      where: { id: company.id },
      data: { automationScore: result.automationScore },
    });
  }

  await clearDiagnosticSessionToken();
  await track(EVENTS.COMPANY_CREATED, { userId, companyId: company.id });

  redirect("/app");
}
