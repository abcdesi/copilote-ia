import type { Metadata } from "next";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { getCompanyKnowledgeCoverage } from "@/lib/companies/knowledge-coverage";
import { getUsageStatus } from "@/lib/billing/usage-policy";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { CompanySwitcher } from "@/components/dashboard/CompanySwitcher";
import { CopilotBar } from "@/components/dashboard/CopilotBar";
import { UsageAlert } from "@/components/billing/UsageAlert";
import { TimezoneBootstrap } from "@/components/company/TimezoneBootstrap";
import { ProfileCompletionGuide, type ProfileGuideStep } from "@/components/company/ProfileCompletionGuide";
import { prisma } from "@/lib/db/client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentCompanyAccess();
  const company = access.company;
  const admin = isPilotziaAdmin(access.session.user.email);
  const canSetTimezone = hasCompanyPermission(access.role, "edit_company");
  const canEditCompany = hasCompanyPermission(access.role, "edit_company");
  const [knowledge, usage, guideDismissal] = await Promise.all([
    getCompanyKnowledgeCoverage(company.id).catch((error) => {
      console.error("Knowledge coverage unavailable in dashboard layout", error);
      return null;
    }),
    getUsageStatus(company.id).catch((error) => {
      console.error("Usage status unavailable in dashboard layout", error);
      return null;
    }),
    prisma.event
      .findFirst({
        where: {
          companyId: company.id,
          userId: access.session.user.id,
          type: "COMPANY_PROFILE_GUIDE_DISMISSED",
        },
        select: { id: true },
      })
      .catch((error) => {
        console.error("Profile guide dismissal unavailable in dashboard layout", error);
        return null;
      }),
  ]);

  const hasDomainContext = Boolean(
    company.financeContext ||
    company.accountingContext ||
    company.salesContext ||
    company.marketingContext ||
    company.hrContext ||
    company.operationsContext
  );
  const profileGuideSteps: ProfileGuideStep[] = [
    {
      id: "activity",
      label: "Activité & territoire",
      description: "Secteur d'activité et territoire principal.",
      href: "/app/company#activity",
      done: Boolean(company.industry && company.country),
    },
    {
      id: "legal",
      label: "Coordonnées de l'entreprise",
      description: "SIRET, adresse et téléphone professionnel.",
      href: "/app/company#company-details",
      done: Boolean(company.siret && company.address && company.phone),
    },
    {
      id: "team",
      label: "Taille & organisation",
      description: "Effectif ou tranche de taille de l'équipe.",
      href: "/app/company#team",
      done: Boolean(company.employeeCount || company.sizeRange),
    },
    {
      id: "model",
      label: "Modèle économique & clients",
      description: "Comment l'entreprise gagne de l'argent et qui elle sert.",
      href: "/app/company#activity",
      done: Boolean(company.businessModel && company.customerProfile),
    },
    {
      id: "priorities",
      label: "Objectifs & irritants",
      description: "Ce que vous cherchez à améliorer et ce qui vous ralentit.",
      href: "/app/company#objectives",
      done: Boolean(company.objectives && company.painPoints),
    },
    {
      id: "context",
      label: "Contexte métier & outils",
      description: "Au moins un domaine métier et une application réellement utilisée.",
      href: !hasDomainContext ? "/app/company#business-context" : "/app/tools",
      done: Boolean(hasDomainContext && company.tools.length > 0),
    },
  ];

  return (
    <div className="flex min-h-screen">
      <TimezoneBootstrap currentTimezone={company.timezone} canSet={canSetTimezone} />
      <Sidebar companyName={company.name} knowledgeScore={knowledge?.overall} isAdmin={admin} />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileNav isAdmin={admin} />
        <CompanySwitcher currentCompanyId={company.id} choices={access.companyChoices} />
        <CopilotBar />
        {usage && <UsageAlert usage={usage} />}
        <main className="flex-1 bg-background">{children}</main>
        {canEditCompany && !guideDismissal && <ProfileCompletionGuide steps={profileGuideSteps} />}
      </div>
    </div>
  );
}
