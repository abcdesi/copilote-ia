import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { APP_NAME } from "@/lib/config";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass size={22} />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Le lien est peut-être incorrect ou la page a été déplacée. Retournez à l&apos;accueil de {APP_NAME}.
      </p>
      <Button href="/" className="mt-6">
        Retour à l&apos;accueil
      </Button>
    </div>
  );
}
