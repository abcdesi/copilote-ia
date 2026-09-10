"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const schema = z.object({ plan: z.enum(["free", "starter", "pro", "business"]) });

export async function changePlanAction(formData: FormData) {
  const session = await requireSession();
  const parsed = schema.safeParse({ plan: formData.get("plan") });
  if (!parsed.success) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id }, include: { subscriptions: true } });
  if (!company) return;

  const sub = company.subscriptions[0];
  if (sub) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { plan: parsed.data.plan } });
  } else {
    await prisma.subscription.create({ data: { companyId: company.id, plan: parsed.data.plan, status: "active" } });
  }

  await track(parsed.data.plan === "free" ? EVENTS.SUBSCRIPTION_CANCELLED : EVENTS.SUBSCRIPTION_STARTED, {
    companyId: company.id,
    metadata: { plan: parsed.data.plan },
  });

  revalidatePath("/app/settings");
}
