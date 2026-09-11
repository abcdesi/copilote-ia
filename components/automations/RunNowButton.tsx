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
      setMessage(count > 0 ? `${count} prospect${count > 1 ? "s" : ""} relancé${count > 1 ? "s" : ""} par email.` : "Aucun prospect à relancer pour le moment.");
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
          <p className="text-sm font-semibold text-accent">⚡ Exécution réelle disponible</p>
          <p className="mt-1 text-sm text-foreground/80">
            Lancez une relance maintenant pour tester en conditions réelles — un vrai email sera envoyé aux prospects concernés.
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
