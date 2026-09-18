import { ShieldCheck, Users } from "lucide-react";
import {
  approveAutomationConfigurationAction,
  updateAutomationGovernanceAction,
} from "@/lib/companies/automation-governance-actions";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

const MODE_LABELS: Record<string, string> = {
  always_review: "Validation avant chaque exécution",
  first_then_auto: "Autonome après la première validation",
};

export function AutomationGovernancePanel({
  automationId,
  approvalMode,
  cadenceDays,
  maxSendsPerContact,
  replyToEmail,
  riskLevel,
  approved,
  lastApprovedAt,
  messageVersion,
  eligibleCount,
  blockedCount,
  allowedApprovalModes,
  canConfigure,
  canApprove,
  unresolvedVariables,
  preview,
}: {
  automationId: string;
  approvalMode: string;
  cadenceDays: number | null;
  maxSendsPerContact: number;
  replyToEmail: string | null;
  riskLevel: string;
  approved: boolean;
  lastApprovedAt: Date | null;
  messageVersion: number;
  eligibleCount: number;
  blockedCount: number;
  allowedApprovalModes: readonly string[];
  canConfigure: boolean;
  canApprove: boolean;
  unresolvedVariables: string[];
  preview?: {
    name: string;
    email: string;
    subject: string;
    body: string;
  } | null;
}) {
  const date = lastApprovedAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(lastApprovedAt)
    : null;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" />
            <h2 className="font-semibold">Autorisation & cadence</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pilotzia n'exécute cette automatisation que selon cette règle. Toute modification du message,
            de la cadence, du périmètre ou de ces permissions invalide automatiquement l'autorisation précédente.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${approved ? "bg-success-soft text-success" : "bg-warning/10 text-warning"}`}>
          {approved ? "Configuration validée" : "Validation requise"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Info label="Mode" value={MODE_LABELS[approvalMode] ?? approvalMode} />
        <Info label="Cadence" value={cadenceDays ? `Tous les ${cadenceDays} jours` : "Selon le déclencheur"} />
        <Info label="Maximum / contact" value={`${maxSendsPerContact} envoi${maxSendsPerContact > 1 ? "s" : ""}`} />
        <Info label="Risque" value={riskLevel} />
      </div>

      {canConfigure ? (
        <form action={updateAutomationGovernanceAction} className="mt-5 grid gap-4 rounded-xl bg-muted/40 p-4 sm:grid-cols-2">
          <input type="hidden" name="automationId" value={automationId} />
          <div className="space-y-1.5">
            <Label htmlFor="approvalMode">Autorisation</Label>
            <select
              id="approvalMode"
              name="approvalMode"
              defaultValue={approvalMode}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              {allowedApprovalModes.includes("first_then_auto") && (
                <option value="first_then_auto">Autonome après la première validation</option>
              )}
              {allowedApprovalModes.includes("always_review") && (
                <option value="always_review">Me demander avant chaque exécution</option>
              )}
            </select>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Le mode autonome reste limité à cette configuration exacte ; un changement redemande une validation.
              Les passages automatiques commencent à partir de 06:00 dans le fuseau horaire de l’entreprise, du lundi au samedi. Une seule exécution planifiée aboutie est autorisée par jour local ; les échecs techniques peuvent être retentés dans la journée.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cadenceDays">Fréquence de relance (jours)</Label>
            <Input id="cadenceDays" name="cadenceDays" type="number" min={1} max={180} defaultValue={cadenceDays ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxSendsPerContact">Nombre maximal de relances par contact</Label>
            <Input id="maxSendsPerContact" name="maxSendsPerContact" type="number" min={1} max={20} defaultValue={maxSendsPerContact} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="replyToEmail">Adresse de réponse</Label>
            <Input id="replyToEmail" name="replyToEmail" type="email" defaultValue={replyToEmail ?? ""} placeholder="contact@entreprise.fr" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" variant="outline">Enregistrer les règles</Button>
          </div>
        </form>
      ) : (
        <p className="mt-5 rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
          Votre rôle permet de consulter ces règles, mais pas de les modifier.
        </p>
      )}

      <div className="mt-5 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-accent" />
            <div>
              <p className="text-sm font-semibold">Portée au prochain passage</p>
              <p className="text-xs text-muted-foreground">
                {eligibleCount} contact{eligibleCount > 1 ? "s" : ""} éligible{eligibleCount > 1 ? "s" : ""} maintenant · {blockedCount} temporairement ou explicitement exclu{blockedCount > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Version du message : {messageVersion}</span>
        </div>

        {preview && (
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs leading-5">
            <p className="font-semibold">Aperçu pour {preview.name} · {preview.email}</p>
            <p className="mt-2"><strong>Objet :</strong> {preview.subject}</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{preview.body}</p>
          </div>
        )}

        {unresolvedVariables.length > 0 && (
          <p className="mt-3 rounded-lg bg-danger/5 p-3 text-xs font-medium text-danger">
            Variables non résolues : {unresolvedVariables.map((item) => `{{${item}}}`).join(", ")}. Complétez les informations avant validation.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {canApprove ? (
            <form action={approveAutomationConfigurationAction}>
              <input type="hidden" name="automationId" value={automationId} />
              <Button type="submit" size="sm" disabled={unresolvedVariables.length > 0}>
                {approved ? "Revalider cette configuration" : "Valider cette configuration"}
              </Button>
            </form>
          ) : (
            <span className="text-xs text-muted-foreground">
              Votre rôle ne permet pas de valider cette configuration ou ce niveau de risque.
            </span>
          )}
          {date && <span className="text-xs text-muted-foreground">Dernière validation : {date}</span>}
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
