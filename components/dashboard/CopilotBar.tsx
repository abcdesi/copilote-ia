"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Bot, Sparkles } from "lucide-react";

export function CopilotBar() {
  const pathname = usePathname();

  if (pathname === "/app/copilot" || pathname.startsWith("/app/copilot/")) return null;

  return (
    <div className="border-b border-border bg-card/60 px-4 py-3 sm:px-6">
      <Link
        href="/app/copilot"
        className="mx-auto flex max-w-5xl items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-accent/40 hover:bg-accent-soft/30"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Bot size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-accent" />
            <p className="text-sm font-semibold">Besoin d'analyser, décider ou automatiser ?</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Ouvrez le Copilote pour poursuivre la conversation sans remplir cette page de réponses.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent">
          Ouvrir le Copilote <ArrowRight size={14} />
        </span>
      </Link>
    </div>
  );
}
