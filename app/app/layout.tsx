import type { Metadata } from "next";
import { getCurrentCompany } from "@/lib/companies/current";
import { getCompanyKnowledgeCoverage } from "@/lib/companies/knowledge-coverage";
import { getUsageStatus } from "@/lib/billing/usage-policy";
import { auth } from "@/lib/auth";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { CopilotBar } from "@/components/dashboard/CopilotBar";
import { UsageAlert } from "@/components/billing/UsageAlert";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [company, session] = await Promise.all([getCurrentCompany(), auth()]);
  const admin = isPilotziaAdmin(session?.user?.email);
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
      <Sidebar companyName={company.name} knowledgeScore={knowledge?.overall} isAdmin={admin} />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileNav isAdmin={admin} />
        <CopilotBar />
        {usage && <UsageAlert usage={usage} />}
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
