import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getDiagnosticSessionToken } from "@/lib/session";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const existingCompany = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (existingCompany) redirect("/app");

  const sessionToken = await getDiagnosticSessionToken();
  const diagnostic = sessionToken
    ? await prisma.diagnostic.findFirst({
        where: { sessionToken, companyId: null },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const prefill = diagnostic
    ? {
        diagnosticId: diagnostic.id,
        detectedTools: JSON.parse(diagnostic.detectedTools) as string[],
        rawInput: diagnostic.rawInput,
      }
    : null;

  return <OnboardingWizard prefill={prefill} userName={session.user.name ?? undefined} />;
}
