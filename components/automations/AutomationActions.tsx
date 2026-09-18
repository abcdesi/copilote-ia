"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function AutomationActions({
  automationId,
  status,
  exportData,
  canToggle,
}: {
  automationId: string;
  status: string;
  exportData: Record<string, unknown>;
  canToggle: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isInactive = status === "inactive";

  async function toggle() {
    setLoading(true);
    await fetch(`/api/automations/${automationId}/toggle`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportData.name ?? "automatisation"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={exportJson}>
        <Download size={14} /> Exporter
      </Button>
      {canToggle && <Button variant={isInactive ? "primary" : "outline"} size="sm" onClick={toggle} disabled={loading}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
        {isInactive ? "Réactiver" : "Désactiver"}
      </Button>}
    </div>
  );
}
