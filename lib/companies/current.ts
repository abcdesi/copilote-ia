import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function getCurrentCompany() {
  const session = await requireSession();
  const company = await prisma.company.findFirst({
    where: { userId: session.user.id },
    include: { tools: true, subscriptions: true },
    orderBy: { createdAt: "desc" },
  });
  if (!company) redirect("/onboarding");
  return company;
}
