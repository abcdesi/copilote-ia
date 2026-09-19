import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Bot, ShieldCheck, User } from "lucide-react";
import { getDashboardShellAccess } from "@/lib/companies/access";
import { safeRead } from "@/lib/runtime/safe-read";
import { getConversationForCompany } from "@/lib/companies/conversations";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function ArchivedConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getDashboardShellAccess();
  const conversation = await safeRead(
    "copilot.archived-conversation",
    () => getConversationForCompany(id, access.company.id, access.session.user.id),
    null
  );
  if (!conversation) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Conversation personnelle archivée — lecture seule</p>
          <h1 className="text-xl font-semibold tracking-tight capitalize">{DATE_FORMAT.format(conversation.createdAt)}</h1>
        </div>
        <Button href="/app/copilot/history" variant="outline" size="sm">
          Retour à l&apos;historique
        </Button>
      </div>

      <div className="space-y-5">
        {conversation.messages.map((m) => (
          <div key={m.id} className={cn("flex items-start gap-3", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                m.role === "user" ? "bg-muted text-foreground" : "bg-accent-soft text-accent"
              )}
            >
              {m.role === "user" ? <User size={15} /> : <Bot size={15} />}
            </div>
            <div className="max-w-[80%] space-y-2">
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user" ? "bg-accent text-accent-foreground" : "bg-card border border-border"
                )}
              >
                {m.content}
              </div>
              {m.role === "assistant" && parseActions(m.actionsJson).map((action, index) => (
                <div key={action.href + "-" + index} className="rounded-xl border border-accent/20 bg-accent-soft p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                    <ShieldCheck size={14} /> Recommandation
                  </div>
                  <Link href={action.href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                    {action.label} <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function parseActions(value: string | null): Array<{ label: string; href: string }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is { label: string; href: string } =>
        Boolean(item) && typeof item.label === "string" && typeof item.href === "string"
    );
  } catch {
    return [];
  }
}
