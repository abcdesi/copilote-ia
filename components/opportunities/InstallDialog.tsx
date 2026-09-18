"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

export function InstallDialog({
  opportunityId,
  title,
}: {
  opportunityId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [automationId, setAutomationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function confirmInstall() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/install`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Installation impossible.");
      setAutomationId(data.automationId);
      setStatus("done");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Installation impossible.");
      setStatus("error");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setStatus("idle");
          setErrorMessage(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">Installer dans Pilotzia</Button>
      </DialogTrigger>
      <DialogContent title={status === "done" ? "Automatisation installée" : "Installer puis vérifier la configuration réelle"}>
        {status === "done" ? (
          <div className="py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 size={24} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              « {title} » est installée. Aucune exécution ne partira avant votre validation de la configuration, du message, de la cadence et des destinataires.
            </p>
            <Button
              className="mt-5 w-full"
              onClick={() => automationId && router.push(`/app/automations/${automationId}`)}
            >
              Voir l'automatisation
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-sm leading-6 text-muted-foreground">
                L'installation réelle est incluse dans votre offre Action ou Scale. Pilotzia crée le workflow, conserve vos règles de contrôle et ne facture pas cette automatisation séparément.
              </p>
            </div>
            {status === "error" && errorMessage && (
              <p className="mt-3 text-sm leading-6 text-danger">{errorMessage}</p>
            )}
            <Button className="mt-5 w-full" onClick={confirmInstall} disabled={status === "loading"}>
              {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : "Confirmer l'installation"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
