import { X, Upload } from "lucide-react";
import { addProspectAction, deleteProspectAction, importProspectsAction } from "@/lib/companies/prospect-actions";
import { updateMessageTemplateAction } from "@/lib/companies/automation-message-actions";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { relativeTime } from "@/lib/format";
import type { RealExecutionConfig } from "@/lib/n8n/real-execution-config";

export interface ProspectData {
  id: string;
  name: string;
  email: string;
  lastContactedAt: Date | null;
}

export function ProspectsPanel({
  automationId,
  templateId,
  config,
  prospects,
  messageSubject,
  messageBody,
}: {
  automationId: string;
  templateId: string;
  config: RealExecutionConfig;
  prospects: ProspectData[];
  messageSubject: string | null;
  messageBody: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">{config.contactListTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{config.contactListDescription}</p>

        {prospects.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{config.emptyLabel}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {prospects.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl bg-muted px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {p.name} <span className="text-muted-foreground">— {p.email}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.lastContactedAt ? `Contacté ${relativeTime(p.lastContactedAt)}` : "Jamais contacté"}
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
          <input type="hidden" name="templateId" value={templateId} />
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

        <form
          action={importProspectsAction}
          className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="templateId" value={templateId} />
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="prospect-file">Importer une liste (CSV ou JSON)</Label>
            <input
              id="prospect-file"
              name="file"
              type="file"
              accept=".csv,.json,text/csv,application/json"
              required
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Colonnes attendues : <code>name</code>, <code>email</code> — ou un tableau JSON
              <code> [{"{ name, email }"}]</code>.
            </p>
          </div>
          <Button type="submit" size="sm" variant="secondary">
            <Upload size={14} /> Importer
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Message envoyé</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Personnalisez le message. Utilisez <code>{"{{name}}"}</code> pour insérer automatiquement le nom du
          contact.
        </p>
        <form action={updateMessageTemplateAction} className="mt-4 space-y-3">
          <input type="hidden" name="automationId" value={automationId} />
          <div className="space-y-1.5">
            <Label htmlFor="message-subject">Objet</Label>
            <Input
              id="message-subject"
              name="subject"
              defaultValue={messageSubject ?? config.defaultSubject}
              placeholder={config.defaultSubject}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message-body">Message</Label>
            <Textarea
              id="message-body"
              name="body"
              rows={5}
              defaultValue={messageBody ?? config.defaultBody}
              placeholder={config.defaultBody}
            />
          </div>
          <Button type="submit" size="sm">
            Enregistrer le message
          </Button>
        </form>
      </div>
    </div>
  );
}
