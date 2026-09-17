"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/companies/access";

export async function switchActiveCompanyAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const companyId = String(formData.get("companyId") ?? "").trim();
  if (!companyId) redirect("/app");

  const membership = await prisma.companyMembership.findFirst({
    where: { companyId, userId: session.user.id, status: "active" },
    select: { companyId: true, role: true },
  });
  if (!membership) redirect("/app");

  const store = await cookies();
  const previousCompanyId = store.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
  store.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  if (previousCompanyId !== companyId) {
    await prisma.event.create({
      data: {
        companyId,
        userId: session.user.id,
        type: "ACTIVE_COMPANY_CHANGED",
        metadata: JSON.stringify({ previousCompanyId, nextCompanyId: companyId, actorRole: membership.role }),
      },
    }).catch(() => undefined);
  }
  redirect("/app");
}
