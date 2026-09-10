import { Zap } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { AutomationCard } from "@/components/automations/AutomationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default async function AutomationsPage() {
  const company = await getCurrentCompany();

  const automations = await prisma.automation.findMany({
    where: { companyId: company.id },
    orderBy: { installedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Automatisations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Toutes vos automatisations actives, surveillées en continu.</p>
      </div>

      {automations.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Aucune automatisation installée pour l'instant"
          description="Installez votre première opportunité pour commencer à gagner du temps chaque mois."
          action={<Button href="/app/opportunities">Voir mes opportunités</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {automations.map((a) => (
            <AutomationCard key={a.id} automation={a} />
          ))}
        </div>
      )}
    </div>
  );
}
