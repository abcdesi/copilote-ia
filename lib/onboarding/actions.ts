"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { runMockDiagnostic } from "@/lib/ai/mock-engine";
import { getDiagnosticSessionToken, clearDiagnosticSessionToken } from "@/lib/session";
import { materializeOpportunities } from "@/lib/companies/opportunities";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(120).optional(),
  country: z.string().trim().max(80).optional(),
  sizeRange: z.string().trim().max(20).optional(),
  employeeCount: z.coerce.number().int().positive().optional(),
  painPoints: z.string().trim().max(2000).optional(),
  objectives: z.string().trim().max(2000).optional(),
  diagnosticId: z.string().optional(),
});

export async function completeOnboardingAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tools = Array.from(new Set(formData.getAll("tools").map(String).map((tool) => tool.trim()).filter(Boolean))).slice(0, 30);
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
  if (!parsed.success) redirect("/onboarding?error=invalid");

  const { name, industry, country, sizeRange, employeeCount, painPoints, objectives, diagnosticId } = parsed.data;
  const userId = session.user.id;

  let company;
  try {
    company = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        const [existingMembership, existingOwnedCompany] = await Promise.all([
          tx.companyMembership.findFirst({ where: { userId, status: "active" }, select: { companyId: true } }),
          tx.company.findFirst({ where: { userId }, select: { id: true } }),
        ]);
        if (existingMembership || existingOwnedCompany) throw new Error("ALREADY_ONBOARDED");

        const created = await tx.company.create({
          data: {
            userId,
            name,
            industry,
            country,
            sizeRange,
            employeeCount,
            painPoints,
            objectives,
            memberships: { create: { userId, role: "owner", status: "active" } },
          },
        });
        if (tools.length) {
          await tx.companyTool.createMany({
            data: tools.map((tool) => ({ companyId: created.id, name: tool.slice(0, 120), detected: true })),
            skipDuplicates: true,
          });
        }
        await tx.subscription.create({ data: { companyId: created.id, plan: "free", status: "active" } });
        return created;
      },
      { timeout: 10_000 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_ONBOARDED") redirect("/app");
    throw error;
  }

  const sessionToken = await getDiagnosticSessionToken();
  const diagnostic = diagnosticId && sessionToken
    ? await prisma.diagnostic.findFirst({ where: { id: diagnosticId, sessionToken, companyId: null } })
    : null;

  if (diagnostic) {
    const result = JSON.parse(diagnostic.resultJson);
    await materializeOpportunities(company.id, result, diagnostic.id);
    await prisma.$transaction([
      prisma.diagnostic.update({ where: { id: diagnostic.id }, data: { companyId: company.id, claimedAt: new Date() } }),
      prisma.company.update({ where: { id: company.id }, data: { automationScore: result.automationScore } }),
    ]);
  } else {
    const combined = [painPoints, objectives].filter(Boolean).join(". ") || name;
    // L'onboarding n'effectue pas d'appel LLM gratuit hors Cost Engine. Il génère une
    // première structure déterministe; le véritable essai IA démarre au premier usage
    // Copilot/Finance, où les crédits et le plafond de coût sont réservés atomiquement.
    const result = runMockDiagnostic(combined, tools);
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
    await prisma.company.update({ where: { id: company.id }, data: { automationScore: result.automationScore } });
  }

  await clearDiagnosticSessionToken();
  await track(EVENTS.COMPANY_CREATED, { userId, companyId: company.id });
  redirect("/app");
}
