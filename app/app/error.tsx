"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={22} />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Cette vue n&apos;a pas pu être chargée</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        La navigation Pilotzia reste disponible. Réessayez cette vue ou revenez au tableau de bord.
      </p>
      {error.digest && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
          Référence : {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="outline" href="/app/support">Assistance</Button>
        <Button variant="outline" href="/app">Tableau de bord</Button>
        <Button onClick={() => reset()}>Réessayer</Button>
      </div>
    </div>
  );
}
