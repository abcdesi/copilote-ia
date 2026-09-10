"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { formatEur } from "@/lib/format";

export function InstallDialog({
  opportunityId,
  title,
  priceEur,
}: {
  opportunityId: string;
  title: string;
  priceEur: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [automationId, setAutomationId] = useState<string | null>(null);

  async function confirmInstall() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/install`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAutomationId(data.automationId);
      setStatus("done");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setStatus("idle");
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">Installer cette automatisation</Button>
      </DialogTrigger>
      <DialogContent title={status === "done" ? "Automatisation installée" : "Confirmer l'installation"}>
        {status === "done" ? (
          <div className="text-center py-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 size={24} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              « {title} » est maintenant active. Nous surveillons son bon fonctionnement pour vous.
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
            <p className="text-sm text-muted-foreground">
              « {title} » sera installée, testée et surveillée automatiquement. Facturation simulée pour cette
              version de démonstration — aucun paiement réel n&apos;est effectué.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-sm font-medium">Montant</span>
              <span className="text-sm font-semibold">{formatEur(priceEur)}</span>
            </div>
            {status === "error" && (
              <p className="mt-3 text-sm text-danger">Une erreur est survenue, réessayez.</p>
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
