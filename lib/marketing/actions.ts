"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireCompanyPermission } from "@/lib/companies/access";
import { MARKETING_KPI_EVENT } from "@/lib/marketing/kpis";
import {
  saveGoogleMarketingSettings,
  syncGoogleMarketingSnapshot,
} from "@/lib/integrations/google-marketing";

const snapshotSchema = z.object({
  spendEur: z.coerce.number().finite().min(0).max(100_000_000),
  leads: z.coerce.number().int().min(0).max(100_000_000),
  conversions: z.coerce.number().int().min(0).max(100_000_000),
  customers: z.coerce.number().int().min(0).max(100_000_000),
  revenueEur: z.coerce.number().finite().min(0).max(1_000_000_000),
});

const googleSettingsSchema = z.object({
  ga4PropertyId: z.string().trim().regex(/^\d{4,30}$/).optional().or(z.literal("")),
  googleAdsCustomerId: z.string().trim().regex(/^[\d-]{6,20}$/).optional().or(z.literal("")),
  googleAdsLoginCustomerId: z.string().trim().regex(/^[\d-]{6,20}$/).optional().or(z.literal("")),
});

export async function saveMarketingKpiSnapshotAction(formData: FormData) {
  const access = await requireCompanyPermission("edit_company").catch((error) => {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") return null;
    throw error;
  });
  if (!access) return;

  const parsed = snapshotSchema.safeParse({
    spendEur: formData.get("spendEur"),
    leads: formData.get("leads"),
    conversions: formData.get("conversions"),
    customers: formData.get("customers"),
    revenueEur: formData.get("revenueEur"),
  });
  if (!parsed.success) return;

  const observedAt = new Date();
  await prisma.event.create({
    data: {
      companyId: access.company.id,
      userId: access.session.user.id,
      type: MARKETING_KPI_EVENT,
      metadata: JSON.stringify({
        source: "manual",
        observedAt: observedAt.toISOString(),
        periodDays: 30,
        ...parsed.data,
        attributedRevenueEur: parsed.data.revenueEur,
        sessions: null,
        users: null,
        clicks: null,
        impressions: null,
        currencyCode: "EUR",
        providers: ["manual"],
        actorRole: access.role,
      }),
    },
  });

  revalidatePath("/app");
  revalidatePath("/app/marketing");
  revalidatePath("/app/copilot");
}

export async function saveGoogleMarketingSettingsAction(formData: FormData) {
  const access = await requireCompanyPermission("manage_integrations").catch((error) => {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") return null;
    throw error;
  });
  if (!access) redirect("/app/marketing?google=permission-denied");

  const parsed = googleSettingsSchema.safeParse({
    ga4PropertyId: String(formData.get("ga4PropertyId") ?? "").trim(),
    googleAdsCustomerId: String(formData.get("googleAdsCustomerId") ?? "").trim(),
    googleAdsLoginCustomerId: String(formData.get("googleAdsLoginCustomerId") ?? "").trim(),
  });
  if (!parsed.success) redirect("/app/marketing?google=settings-invalid");

  await saveGoogleMarketingSettings(access.company.id, parsed.data);

  const tools: string[] = [];
  if (parsed.data.ga4PropertyId) tools.push("Google Analytics 4");
  if (parsed.data.googleAdsCustomerId) tools.push("Google Ads");
  if (tools.length) {
    await prisma.$transaction(
      tools.map((name) =>
        prisma.companyTool.upsert({
          where: { companyId_name: { companyId: access.company.id, name } },
          create: { companyId: access.company.id, name, detected: false },
          update: {},
        })
      )
    );
  }

  revalidatePath("/app");
  revalidatePath("/app/marketing");
  revalidatePath("/app/tools");
  revalidatePath("/app/copilot");
  redirect("/app/marketing?google=settings-saved");
}

export async function syncGoogleMarketingAction() {
  const access = await requireCompanyPermission("sync_integrations").catch((error) => {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") return null;
    throw error;
  });
  if (!access) redirect("/app/marketing?google=permission-denied");

  try {
    await syncGoogleMarketingSnapshot(access.company.id, access.session.user.id, "manual");
  } catch (error) {
    console.error("Google marketing sync failed", error);
    redirect("/app/marketing?google=sync-error");
  }

  revalidatePath("/app");
  revalidatePath("/app/marketing");
  revalidatePath("/app/copilot");
  redirect("/app/marketing?google=synced");
}
