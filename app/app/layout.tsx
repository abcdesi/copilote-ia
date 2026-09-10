import { getCurrentCompany } from "@/lib/companies/current";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { CopilotBar } from "@/components/dashboard/CopilotBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const company = await getCurrentCompany();

  return (
    <div className="flex min-h-screen">
      <Sidebar companyName={company.name} />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileNav />
        <CopilotBar />
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
