import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { auth } from "@/lib/auth";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { prisma } from "@/lib/db/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function badgeTone(priority: string) {
  return priority === "high" ? "warning" as const : priority === "normal" ? "accent" as const : "neutral" as const;
}

export default async function AdminSupportPage() {
  const session = await auth();
  if (!isPilotziaAdmin(session?.user?.email)) notFound();

  const tickets = await prisma.supportRequest.findMany({
    include: { company: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const open = tickets.filter((ticket) => ticket.status !== "resolved").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><LifeBuoy size={20} /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Pilotzia Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Assistance clients</h1>
            <p className="mt-1 text-sm text-muted-foreground">Une file unique, avec le contexte d'abonnement déjà joint au ticket.</p>
          </div>
        </div>
        <Badge tone={open > 0 ? "accent" : "success"}>{open} ticket{open > 1 ? "s" : ""} à traiter</Badge>
      </div>

      <div className="space-y-4">
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Aucune demande d'assistance.</div>
        ) : tickets.map((ticket) => {
          let context: Record<string, unknown> = {};
          try { context = ticket.contextJson ? JSON.parse(ticket.contextJson) : {}; } catch { context = {}; }
          return (
            <article key={ticket.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{ticket.subject}</h2>
                    <Badge tone={badgeTone(ticket.priority)}>{ticket.priority}</Badge>
                    <Badge tone={ticket.status === "resolved" ? "success" : "neutral"}>{ticket.status === "resolved" ? "Résolu" : "Ouvert"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{ticket.company.name} · {ticket.requesterEmail} · {ticket.category} · {formatDate(ticket.createdAt)}</p>
                </div>
                {ticket.status !== "resolved" && (
                  <form method="post" action={`/api/admin/support/${ticket.id}/resolve`}>
                    <Button type="submit" size="sm" variant="outline">Marquer résolu</Button>
                  </form>
                )}
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{ticket.message}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                <span>Plan : {String(context.planLabel ?? context.plan ?? "—")}</span>
                <span>Crédits : {String(context.creditsUsed ?? "—")} / {String(context.creditsLimit ?? "—")}</span>
                <span>Niveau : {String(context.alertLevel ?? "—")}</span>
                <span>Fin période : {context.periodEndsAt ? String(context.periodEndsAt).slice(0, 10) : "—"}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
