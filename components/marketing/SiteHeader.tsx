import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { Button } from "@/components/ui/Button";

export function SiteHeader() {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-3">
          <Button href="/login" variant="ghost" size="sm">
            Connexion
          </Button>
          <Button href="/signup" variant="secondary" size="sm">
            Créer mon espace
          </Button>
        </nav>
      </div>
    </header>
  );
}
