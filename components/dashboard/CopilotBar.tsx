"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

export function CopilotBar() {
  const pathname = usePathname();
  if (pathname === "/app/copilot" || pathname.startsWith("/app/copilot/")) return null;

  return (
    <div className="border-b border-border bg-card/60 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Sparkles size={15} className="shrink-0 text-accent" />
          <span className="truncate">Besoin d'analyser, décider ou automatiser quelque chose ?</span>
        </div>
        <Link
          href="/app/copilot"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          Ouvrir le Copilote <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
