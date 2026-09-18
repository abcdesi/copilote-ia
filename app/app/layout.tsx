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

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentCompanyAccess();
  const company = access.company;
  const admin = isPilotziaAdmin(access.session.user.email);
  const canSetTimezone = hasCompanyPermission(access.role, "edit_company");
  const [knowledge, usage] = await Promise.all([
    getCompanyKnowledgeCoverage(company.id).catch((error) => {
      console.error("Knowledge coverage unavailable in dashboard layout", error);
      return null;
    }),
    getUsageStatus(company.id).catch((error) => {
      console.error("Usage status unavailable in dashboard layout", error);
      return null;
    }),
  ]);

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
      </div>
    </div>
  );
}
