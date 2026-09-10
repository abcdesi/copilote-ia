import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Lightbulb } from "lucide-react";

export default async function OpportunitiesPage() {
  const company = await getCurrentCompany();

  const opportunities = await prisma.opportunity.findMany({
    where: { companyId: company.id, status: { in: ["detected", "viewed"] } },
    orderBy: { estimatedValueEur: "desc" },
  });

  const highPriority = opportunities.filter((o) => o.impactLevel === "high");
  const rest = opportunities.filter((o) => o.impactLevel !== "high");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunités</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Classées par impact, complexité et valeur estimée pour {company.name}.
        </p>
      </div>

      {opportunities.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Aucune opportunité en attente"
          description="Vous avez traité toutes les opportunités détectées. Parlez à votre copilote d'un nouveau besoin pour en générer de nouvelles."
        />
      ) : (
        <>
          {highPriority.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">🔥 Haute priorité</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {highPriority.map((o) => (
                  <OpportunityCard key={o.id} opportunity={o} highlight />
                ))}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Autres opportunités</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {rest.map((o) => (
                  <OpportunityCard key={o.id} opportunity={o} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
