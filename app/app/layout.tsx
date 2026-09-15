import type { Metadata } from "next";
import { getCurrentCompany } from "@/lib/companies/current";
import { auth } from "@/lib/auth";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { CopilotBar } from "@/components/dashboard/CopilotBar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [company, session] = await Promise.all([getCurrentCompany(), auth()]);
  const admin = isPilotziaAdmin(session?.user?.email);

  return (
    <div className="flex min-h-screen">
      <Sidebar companyName={company.name} isAdmin={admin} />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileNav isAdmin={admin} />
        <CopilotBar />
        <main className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
