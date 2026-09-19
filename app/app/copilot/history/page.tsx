import Link from "next/link";
import { ArchiveX, Trash2 } from "lucide-react";
import { getDashboardShellAccess } from "@/lib/companies/access";
import { safeRead } from "@/lib/runtime/safe-read";
import { listArchivedConversations } from "@/lib/companies/conversations";
import { deleteConversationAction } from "@/lib/companies/conversation-actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function CopilotHistoryPage() {
  const access = await getDashboardShellAccess();
  const conversations = await safeRead(
    "copilot.archived-conversations",
    () => listArchivedConversations(access.company.id, access.session.user.id),
    []
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mon historique Copilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vos conversations sont privées par défaut. Pilotzia utilise néanmoins la mémoire entreprise partagée pour vous répondre avec le même contexte opérationnel.
          </p>
        </div>
        <Button href="/app/copilot" variant="outline" size="sm">
          Conversation du jour
        </Button>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={ArchiveX}
          title="Aucune conversation archivée pour l'instant"
          description="Vos conversations des jours précédents apparaîtront ici."
        />
      ) : (
        <ul className="space-y-3">
          {conversations.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/app/copilot/history/${c.id}`} className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize">{DATE_FORMAT.format(c.createdAt)}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{c.messages[0]?.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{c._count.messages} message{c._count.messages > 1 ? "s" : ""}</p>
                </Link>
                <form action={deleteConversationAction}>
                  <input type="hidden" name="conversationId" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-danger-soft hover:text-danger transition-colors"
                    aria-label="Supprimer cette conversation"
                  >
                    <Trash2 size={16} />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
