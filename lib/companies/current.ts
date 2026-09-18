import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentCompanyAccess } from "@/lib/companies/access";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function getCurrentCompany() {
  const access = await getCurrentCompanyAccess();
  return access.company;
}
