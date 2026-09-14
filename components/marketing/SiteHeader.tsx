import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { Button } from "@/components/ui/Button";

export function SiteHeader() {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/#tarifs" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">Tarifs</Link>
          <Link href="/faq" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">FAQ</Link>
          <Button href="/login" variant="ghost" size="sm">Connexion</Button>
          <Button href="/signup" variant="secondary" size="sm">Créer mon espace</Button>
        </nav>
      </div>
    </header>
  );
}
