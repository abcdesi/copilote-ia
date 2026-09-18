import { AlertCircle, CheckCircle2, Cloud, LockKeyhole, Plus, RefreshCcw, ShieldCheck, Unplug, X } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { addToolAction, removeToolAction } from "@/lib/companies/actions";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { getGoogleConfigurationStatus } from "@/lib/integrations/google";
import { prisma } from "@/lib/db/client";
import { APP_NAME } from "@/lib/config";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function formatSync(date: Date | null) {
  if (!date) return "Jamais synchronisé";
  return `Dernière synchronisation : ${new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)}`;
}

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const company = await getCurrentCompany();
  const params = await searchParams;
  const googleConfiguration = getGoogleConfigurationStatus();
  const connections = await prisma.integrationConnection.findMany({ where: { companyId: company.id } });
  const google = connections.find((connection) => connection.provider === "google");
  const googleConnected = google?.status === "connected";
  const currentNames = new Set(company.tools.map((t) => t.name));
  const suggestions = KNOWN_TOOLS.filter((t) => !currentNames.has(t));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Contexte opérationnel</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Outils & connexions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Renseignez les applications utilisées par votre entreprise puis connectez uniquement celles dont {APP_NAME}
          a besoin pour observer ou agir. Les permissions sont explicites et les actions sensibles restent soumises à validation.
        </p>
      </div>

      <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-accent">
            <ShieldCheck size={17} />
          </div>
          <div>
            <p className="font-semibold">Une application renseignée n'est jamais présentée comme connectée</p>
            <p className="mt-1 text-sm leading-6 text-foreground/75">
              Les connexions réelles affichent le compte autorisé, le niveau de permission et la dernière synchronisation.
              Pilotzia ne revendique aucune lecture ou action sans autorisation API effective.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cloud size={18} className="text-accent" />
              <h2 className="font-semibold">Google Workspace</h2>
              {googleConnected ? <Badge tone="success">Connecté</Badge> : googleConfiguration.configured ? <Badge tone="accent">Disponible</Badge> : <Badge tone="neutral">Configuration requise</Badge>}
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Gmail et Google Calendar constituent la première connexion réelle Pilotzia. Lecture du contexte, préparation
              d'actions et exécution uniquement après confirmation lorsque l'action modifie vos données.
            </p>
            {!googleConfiguration.configured && (
              <div className="mt-3 flex gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-xs leading-5 text-danger">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>La connexion Google n'est pas encore complètement configurée côté serveur. Aucun accès Google n'a été accordé.</span>
              </div>
            )}
            {(params.google === "config-error" || params.google === "start-error") && (
              <div className="mt-3 flex gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-xs leading-5 text-danger">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{params.google === "config-error" ? "Configuration Google incomplète côté Pilotzia." : "Impossible de démarrer la connexion Google. La tentative a été bloquée avant toute autorisation."}</span>
              </div>
            )}
            {google && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>Compte : {google.accountLabel ?? "Compte Google"}</p>
                <p>{formatSync(google.lastSyncedAt)}</p>
                {google.status === "needs_reauth" && <p className="text-danger">Reconnexion nécessaire.</p>}
              </div>
            )}
          </div>

          {googleConnected ? (
            <form method="post" action="/api/integrations/google/disconnect">
              <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-danger">
                <Unplug size={15} /> Déconnecter
              </button>
            </form>
          ) : googleConfiguration.configured ? (
            <a
              href="/api/integrations/google/connect"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              <RefreshCcw size={15} /> Connecter Google
            </a>
          ) : (
            <span className="rounded-xl border border-border px-3.5 py-2 text-xs text-muted-foreground">Configuration serveur requise</span>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ConnectionCapability title="Gmail" body="Lire le contexte utile et préparer des brouillons. L'envoi n'est jamais implicite." connected={googleConnected} />
          <ConnectionCapability title="Google Calendar" body="Lire les rendez-vous et préparer créations ou modifications avec confirmation." connected={googleConnected} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Applications connues de Pilotzia</h2>
            <p className="mt-1 text-xs text-muted-foreground">Contexte déclaré séparé des connexions API.</p>
          </div>
          <Badge tone="accent">{company.tools.length} renseignée{company.tools.length > 1 ? "s" : ""}</Badge>
        </div>

        {company.tools.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            Aucun outil renseigné. Ajoutez ceux que vous utilisez pour améliorer le diagnostic et les recommandations.
          </div>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {company.tools.map((tool) => {
              const definition = getIntegrationDefinition(tool.name);
              const isGoogleTool = tool.name === "Gmail" || tool.name === "Google Calendar";
              const isReallyConnected = isGoogleTool && googleConnected;
              return (
                <li key={tool.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{tool.name}</span>
                        {tool.detected && <Badge tone="accent">Détecté</Badge>}
                        {isReallyConnected && <Badge tone="success">API active</Badge>}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 size={13} className="text-success" /> Connu du copilote
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <LockKeyhole size={13} /> {definition.permissionLabel}
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                        Connexion API : {isReallyConnected ? "active" : "non activée"}
                      </p>
                    </div>
                    <form action={removeToolAction}>
                      <input type="hidden" name="toolId" value={tool.id} />
                      <button
                        type="submit"
                        aria-label={`Retirer ${tool.name}`}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                      >
                        <X size={15} />
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Ajouter une application à votre contexte</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cette étape indique simplement à {APP_NAME} que votre entreprise utilise cet outil.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((tool) => (
              <form action={addToolAction} key={tool}>
                <input type="hidden" name="name" value={tool} />
                <Button type="submit" variant="outline" size="sm">
                  <Plus size={14} /> {tool}
                </Button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ConnectionCapability({ title, body, connected }: { title: string; body: string; connected: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-muted-foreground/30"}`} />
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}
