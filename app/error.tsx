"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={22} />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Une erreur est survenue</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Quelque chose s&apos;est mal passé de notre côté. Réessayez, ou revenez un peu plus tard.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" href="/">
          Retour à l&apos;accueil
        </Button>
        <Button onClick={() => reset()}>Réessayer</Button>
      </div>
    </div>
  );
}
