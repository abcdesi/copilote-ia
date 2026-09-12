import { CheckCircle2, Clock3, ShieldAlert, XCircle } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { Badge } from "@/components/ui/Badge";

const STATUS_LABELS: Record<string, string> = {
  pending: "À valider",
  approved: "Validée",
  executed: "Exécutée",
  rejected: "Refusée",
  failed: "Échec",
  expired: "Expirée",
};

export default async function ActionsPage() {
  const company = await getCurrentCompany();
  const actions = await prisma.pendingAction.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const pending = actions.filter((action) => action.status === "pending");
  const history = actions.filter((action) => action.status !== "pending");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Contrôle opérationnel</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Actions à valider</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pilotzia peut préparer une action, mais ne l'exécute pas silencieusement. Vérifiez ce qui va changer, puis
          validez ou refusez. Les actions critiques conservent cette étape de confirmation.
        </p>
      </div>

      <section className="space-y-3">
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Aucune action n'attend votre validation.
          </div>
        ) : (
          pending.map((action) => <PendingActionCard key={action.id} action={action} />)
        )}
      </section>

      {history.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Historique récent</h2>
          <div className="mt-4 divide-y divide-border">
            {history.map((action) => (
              <div key={action.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{action.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {action.provider} · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(action.createdAt)}
                  </p>
                </div>
                <Badge tone={action.status === "executed" ? "success" : "neutral"}>{STATUS_LABELS[action.status] ?? action.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PendingActionCard({
  action,
}: {
  action: {
    id: string;
    provider: string;
    kind: string;
    title: string;
    description: string;
    riskLevel: string;
    createdAt: Date;
    expiresAt: Date | null;
  };
}) {
  const highRisk = action.riskLevel === "high" || action.riskLevel === "critical";
  return (
    <article className={`rounded-2xl border bg-card p-6 ${highRisk ? "border-danger/30" : "border-accent/20"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${highRisk ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent"}`}>
          <ShieldAlert size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{action.title}</h2>
            <Badge tone={highRisk ? "neutral" : "accent"}>{highRisk ? "Risque élevé" : "Confirmation requise"}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground/80">{action.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{action.provider}</span>
            <span>{action.kind}</span>
            <span className="inline-flex items-center gap-1"><Clock3 size={12} /> préparée {new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(action.createdAt)}</span>
            {action.expiresAt && <span>expire {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(action.expiresAt)}</span>}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <form method="post" action={`/api/actions/${action.id}/execute`}>
              <button className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
                <CheckCircle2 size={15} /> Confirmer et exécuter
              </button>
            </form>
            <form method="post" action={`/api/actions/${action.id}/reject`}>
              <button className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-danger">
                <XCircle size={15} /> Refuser
              </button>
            </form>
          </div>
        </div>
      </div>
    </article>
  );
}
