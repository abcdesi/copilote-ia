"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { formatEur } from "@/lib/format";
import { AUTOMATION_PURCHASE_TERMS_VERSION } from "@/lib/billing/purchase-terms";

export function InstallDialog({
  opportunityId,
  title,
  priceEur,
  purchased,
}: {
  opportunityId: string;
  title: string;
  priceEur: number;
  purchased: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [automationId, setAutomationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptedDigitalTerms, setAcceptedDigitalTerms] = useState(false);

  async function install() {
    const res = await fetch(`/api/opportunities/${opportunityId}/install`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Installation impossible.");
    setAutomationId(data.automationId);
    setStatus("done");
    router.refresh();
  }

  async function purchaseAndInstall() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      if (!purchased) {
        if (!acceptedDigitalTerms) {
          throw new Error("Confirmez les conditions de l'achat numérique avant de continuer.");
        }
        const res = await fetch(`/api/opportunities/${opportunityId}/purchase`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            acceptDigitalTerms: true,
            termsVersion: AUTOMATION_PURCHASE_TERMS_VERSION,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Paiement impossible.");

        if (!data.paid) {
          if (data.paymentUrl) {
            window.location.assign(data.paymentUrl);
            return;
          }
          throw new Error("Le paiement est en cours de confirmation. Réessayez dans quelques instants.");
        }
      }

      await install();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Opération impossible.");
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
          setAcceptedDigitalTerms(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">{purchased ? "Installer dans Pilotzia" : `Acheter · ${formatEur(priceEur)} HT`}</Button>
      </DialogTrigger>

      <DialogContent title={status === "done" ? "Automatisation installée" : purchased ? "Installer l'automatisation" : "Acheter puis installer"}>
        {status === "done" ? (
          <div className="py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 size={24} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              « {title} » est installée. Aucune exécution ne partira avant votre validation de la configuration, du message, de la cadence et des destinataires.
            </p>
            <Button className="mt-5 w-full" onClick={() => automationId && router.push(`/app/automations/${automationId}`)}>
              Voir l'automatisation
            </Button>
          </div>
        ) : (
          <div>
            {!purchased ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3">
                  <CreditCard size={18} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-sm font-semibold">{formatEur(priceEur)} HT · achat unique</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Pilotzia utilise le moyen de paiement déjà associé à l'abonnement de l'entreprise. Vous n'avez pas à ressaisir votre carte à chaque automatisation.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Si votre banque exige une authentification supplémentaire, Stripe ouvrira une page de confirmation sécurisée. L'automatisation ne sera installée qu'après confirmation du paiement.
                  </p>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3">
                  <input
                    type="checkbox"
                    checked={acceptedDigitalTerms}
                    onChange={(event) => setAcceptedDigitalTerms(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span className="text-xs leading-5 text-foreground/80">
                    Je confirme cet achat professionnel de produit numérique et demande sa livraison / exécution immédiate après paiement. Une fois livré, installé, activé ou utilisé, l&apos;achat est ferme et non remboursable, sous réserve des droits impératifs applicables et des cas de non-fourniture, défaut, erreur de facturation ou opération non autorisée. J&apos;accepte les{" "}
                    <Link href="/cgv" target="_blank" className="font-semibold text-accent hover:underline">
                      CGV Pilotzia
                    </Link>.
                  </span>
                </label>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
                <p className="text-sm leading-6 text-muted-foreground">
                  Cette automatisation est déjà payée. L'installation crée le workflow mais aucune exécution ne part avant validation de sa configuration.
                </p>
              </div>
            )}

            {status === "error" && errorMessage && <p className="mt-3 text-sm leading-6 text-danger">{errorMessage}</p>}

            <Button
              className="mt-5 w-full"
              onClick={purchaseAndInstall}
              disabled={status === "loading" || (!purchased && !acceptedDigitalTerms)}
            >
              {status === "loading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : purchased ? (
                "Confirmer l'installation"
              ) : (
                `Payer ${formatEur(priceEur)} HT et installer`
              )}
            </Button>
            <p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">
              Core, Action ou Scale donne accès au moteur d'exécution pour les automatisations achetées. Core permet jusqu'à 2 nouvelles automatisations par mois ; l'usage courant consomme ensuite les crédits de votre plan.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
