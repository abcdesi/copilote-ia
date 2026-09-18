"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function RunNowButton({ automationId, canRun }: { automationId: string; canRun: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settingsHref, setSettingsHref] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMessage(null);
    setSettingsHref(null);
    try {
      const res = await fetch(`/api/automations/${automationId}/run-now`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "L'exécution a échoué.");
        if (data.href) setSettingsHref(data.href);
        return;
      }
      const count = data.result?.relancedCount ?? data.result?.processedCount ?? 0;
      const errors = data.result?.errorCount ?? 0;
      const parts = [];
      if (count > 0) parts.push(`${count} élément${count > 1 ? "s" : ""} traité${count > 1 ? "s" : ""}`);
      if (errors > 0) parts.push(`${errors} échec${errors > 1 ? "s" : ""}`);
      setMessage(parts.length > 0 ? `${parts.join(", ")}.` : "Aucun élément à traiter pour le moment.");
      router.refresh();
    } catch {
      setMessage("Impossible de joindre le moteur d'exécution. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent-soft p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent">⚡ Exécution réelle</p>
          <p className="mt-1 text-sm text-foreground/80">
            Cette automatisation peut s'exécuter automatiquement. Vous pouvez aussi la lancer maintenant ; Pilotzia applique les permissions et la capacité incluses dans votre offre.
          </p>
        </div>
        {canRun ? <Button size="sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          Lancer maintenant
        </Button> : <span className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">Votre rôle ne permet pas cette exécution</span>}
      </div>
      {message && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium text-accent">{message}</p>
          {settingsHref && (
            <Button href={settingsHref} size="sm" variant="outline">
              Voir mon offre <ArrowRight size={14} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
