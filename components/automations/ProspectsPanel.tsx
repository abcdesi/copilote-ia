import { X } from "lucide-react";
import { addProspectAction, deleteProspectAction } from "@/lib/companies/prospect-actions";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { relativeTime } from "@/lib/format";

export interface ProspectData {
  id: string;
  name: string;
  email: string;
  lastContactedAt: Date | null;
}

export function ProspectsPanel({ prospects }: { prospects: ProspectData[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-semibold">Vos prospects</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cette automatisation relance automatiquement les prospects sans réponse depuis plusieurs jours.
      </p>

      {prospects.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Aucun prospect pour l&apos;instant.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {prospects.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-xl bg-muted px-4 py-2.5">
              <div>
                <p className="text-sm font-medium">
                  {p.name} <span className="text-muted-foreground">— {p.email}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.lastContactedAt ? `Relancé ${relativeTime(p.lastContactedAt)}` : "Jamais relancé"}
                </p>
              </div>
              <form action={deleteProspectAction}>
                <input type="hidden" name="prospectId" value={p.id} />
                <button type="submit" className="text-muted-foreground hover:text-danger">
                  <X size={16} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addProspectAction} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="prospect-name">Nom</Label>
          <Input id="prospect-name" name="name" required placeholder="Camille Dupont" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="prospect-email">Email</Label>
          <Input id="prospect-email" name="email" type="email" required placeholder="camille@exemple.com" />
        </div>
        <Button type="submit" size="sm">
          Ajouter
        </Button>
      </form>
    </div>
  );
}
