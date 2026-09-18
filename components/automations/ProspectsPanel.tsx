import { Upload } from "lucide-react";
import { addProspectAction, importProspectsAction } from "@/lib/companies/prospect-actions";
import { updateMessageTemplateAction } from "@/lib/companies/automation-message-actions";
import { setProspectStatusAction } from "@/lib/companies/automation-governance-actions";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { relativeTime } from "@/lib/format";
import type { RealExecutionConfig } from "@/lib/n8n/real-execution-config";

export interface ProspectData {
  id: string;
  name: string;
  email: string;
  status: string;
  lastOutcome: string | null;
  contactCount: number;
  lastContactedAt: Date | null;
  nextEligibleAt: Date | null;
  eligible: boolean;
}

function eligibilityLabel(prospect: ProspectData, maxSendsPerContact: number) {
  if (prospect.status !== "active") return { label: "Exclu", tone: "neutral" as const };
  if (prospect.contactCount >= maxSendsPerContact) return { label: "Limite atteinte", tone: "neutral" as const };
  if (prospect.eligible) return { label: "Sera relancé", tone: "success" as const };
  return { label: "En attente", tone: "accent" as const };
}

export function ProspectsPanel({
  automationId,
  templateId,
  config,
  prospects,
  messageSubject,
  messageBody,
  cadenceDays,
  maxSendsPerContact,
  canManageContacts,
  canConfigureMessage,
}: {
  automationId: string;
  templateId: string;
  config: RealExecutionConfig;
  prospects: ProspectData[];
  messageSubject: string | null;
  messageBody: string | null;
  cadenceDays: number | null;
  maxSendsPerContact: number;
  canManageContacts: boolean;
  canConfigureMessage: boolean;
}) {
  const eligibleCount = prospects.filter((prospect) => prospect.eligible).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{config.contactListTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{config.contactListDescription}</p>
          </div>
          <Badge tone="accent">
            {eligibleCount} à relancer maintenant / {prospects.length} mémorisé{prospects.length > 1 ? "s" : ""}
          </Badge>
        </div>

        {prospects.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{config.emptyLabel}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {prospects.map((prospect) => {
              const state = eligibilityLabel(prospect, maxSendsPerContact);
              return (
                <li key={prospect.id} className="rounded-xl border border-border bg-background px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {prospect.name} <span className="text-muted-foreground">— {prospect.email}</span>
                        </p>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        <p>
                          {prospect.contactCount} envoi{prospect.contactCount > 1 ? "s" : ""} réalisé{prospect.contactCount > 1 ? "s" : ""}
                          {" "}sur {maxSendsPerContact} maximum.
                        </p>
                        <p>
                          {prospect.lastContactedAt
                            ? `Dernier contact : ${relativeTime(prospect.lastContactedAt)}`
                            : "Jamais contacté."}
                          {prospect.nextEligibleAt && prospect.status === "active" && !prospect.eligible
                            ? ` Prochaine éligibilité : ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(prospect.nextEligibleAt)}.`
                            : ""}
                        </p>
                        {prospect.lastOutcome && <p>Dernier résultat mémorisé : {prospect.lastOutcome}</p>}
                      </div>
                    </div>
                    {canManageContacts && (
                      <form action={setProspectStatusAction}>
                        <input type="hidden" name="prospectId" value={prospect.id} />
                        <input type="hidden" name="status" value={prospect.status === "active" ? "excluded" : "active"} />
                        <Button type="submit" size="sm" variant="outline">
                          {prospect.status === "active" ? "Exclure" : "Réactiver"}
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Cadence actuelle : {cadenceDays ? `tous les ${cadenceDays} jours` : "selon le déclencheur"}.
          Une exclusion reste mémorisée et n'est jamais annulée silencieusement par un nouvel import.
        </p>

        {canManageContacts ? (
          <>
            <form action={addProspectAction} className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
              <input type="hidden" name="templateId" value={templateId} />
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="prospect-name">Nom</Label>
                <Input id="prospect-name" name="name" required placeholder="Camille Dupont" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="prospect-email">Email</Label>
                <Input id="prospect-email" name="email" type="email" required placeholder="camille@exemple.com" />
              </div>
              <Button type="submit" size="sm">Ajouter</Button>
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
                  Colonnes attendues : <code>name</code>, <code>email</code>. Maximum 500 lignes par import.
                </p>
              </div>
              <Button type="submit" size="sm" variant="secondary">
                <Upload size={14} /> Importer
              </Button>
            </form>
          </>
        ) : (
          <p className="mt-4 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            Votre rôle permet de consulter les destinataires et leur historique, mais pas de modifier la liste.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Message professionnel</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Variables disponibles : <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{company_name}}"}</code>,
          {" "}<code>{"{{siret}}"}</code>, <code>{"{{address}}"}</code> et <code>{"{{phone}}"}</code>.
          Vous pouvez ajouter ou retirer ces variables librement ; une variable inconnue bloque la validation.
        </p>
        {canConfigureMessage ? (
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
                rows={7}
                defaultValue={messageBody ?? config.defaultBody}
                placeholder={config.defaultBody}
              />
            </div>
            <Button type="submit" size="sm">Enregistrer le message</Button>
          </form>
        ) : (
          <div className="mt-4 rounded-xl bg-muted/40 p-4 text-sm">
            <p className="font-medium">{messageSubject ?? config.defaultSubject}</p>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{messageBody ?? config.defaultBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}
