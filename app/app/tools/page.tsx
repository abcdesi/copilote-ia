import { X } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { addToolAction, removeToolAction } from "@/lib/companies/actions";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { APP_NAME } from "@/lib/config";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function ToolsPage() {
  const company = await getCurrentCompany();
  const currentNames = new Set(company.tools.map((t) => t.name));
  const suggestions = KNOWN_TOOLS.filter((t) => !currentNames.has(t));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outils</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indiquez vos outils : {APP_NAME} choisit ensuite la meilleure façon d&apos;automatiser, sans que vous ayez
          à connaître la technique.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold mb-3">Vos outils</h2>
        {company.tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun outil ajouté pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {company.tools.map((tool) => (
              <li key={tool.id} className="flex items-center justify-between rounded-xl bg-muted px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{tool.name}</span>
                  {tool.detected && <Badge tone="accent">Détecté</Badge>}
                </div>
                <form action={removeToolAction}>
                  <input type="hidden" name="toolId" value={tool.id} />
                  <button type="submit" className="text-muted-foreground hover:text-danger">
                    <X size={16} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-3">Ajouter un outil</h2>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((tool) => (
              <form action={addToolAction} key={tool}>
                <input type="hidden" name="name" value={tool} />
                <Button type="submit" variant="outline" size="sm">
                  + {tool}
                </Button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
