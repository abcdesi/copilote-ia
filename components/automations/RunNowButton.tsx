"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function RunNowButton({ automationId }: { automationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/automations/${automationId}/run-now`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const count = data.result?.relancedCount ?? 0;
      const errors = data.result?.errorCount ?? 0;
      const parts = [];
      if (count > 0) parts.push(`${count} email${count > 1 ? "s" : ""} envoyé${count > 1 ? "s" : ""}`);
      if (errors > 0) parts.push(`${errors} échec${errors > 1 ? "s" : ""}`);
      setMessage(parts.length > 0 ? `${parts.join(", ")}.` : "Aucun contact à traiter pour le moment.");
      router.refresh();
    } catch {
      setMessage("L'exécution a échoué. Réessayez dans un instant.");
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
            Cette automatisation s&apos;exécute automatiquement chaque jour. Vous pouvez aussi la lancer maintenant
            pour tester en conditions réelles — un vrai email sera envoyé aux contacts concernés.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          Lancer maintenant
        </Button>
      </div>
      {message && <p className="mt-3 text-sm font-medium text-accent">{message}</p>}
    </div>
  );
}
