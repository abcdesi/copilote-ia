import { CheckCircle2, LockKeyhole, Plus, ShieldCheck, X } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { addToolAction, removeToolAction } from "@/lib/companies/actions";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { APP_NAME } from "@/lib/config";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function ToolsPage() {
  const company = await getCurrentCompany();
  const currentNames = new Set(company.tools.map((t) => t.name));
  const suggestions = KNOWN_TOOLS.filter((t) => !currentNames.has(t));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Contexte opérationnel</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Outils & connexions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Renseignez les applications utilisées par votre entreprise. {APP_NAME} s'en sert pour personnaliser ses
          recommandations. Une application renseignée n'est pas considérée comme connectée tant qu'une intégration
          réelle n'a pas été autorisée.
        </p>
      </div>

      <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-accent">
            <ShieldCheck size={17} />
          </div>
          <div>
            <p className="font-semibold">Pilotzia ne prétend pas être connecté quand il ne l'est pas</p>
            <p className="mt-1 text-sm leading-6 text-foreground/75">
              Les connexions API seront affichées séparément avec leur niveau d'autorisation et leur dernière
              synchronisation. Les actions sensibles devront toujours respecter les permissions choisies.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Applications connues de Pilotzia</h2>
            <p className="mt-1 text-xs text-muted-foreground">Contexte déclaré, pas encore connexion API.</p>
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
              return (
                <li key={tool.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{tool.name}</span>
                        {tool.detected && <Badge tone="accent">Détecté</Badge>}
                        {definition.mvpPriority === "now" && <Badge tone="success">MVP prioritaire</Badge>}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 size={13} className="text-success" />
                        Connu du copilote
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <LockKeyhole size={13} />
                        {definition.permissionLabel}
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-muted-foreground">Connexion API : non activée</p>
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
