"use client";

import { FormEvent, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Bot } from "lucide-react";

export function CopilotBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  if (pathname === "/app/copilot" || pathname.startsWith("/app/copilot/")) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();

    if (message) {
      window.sessionStorage.setItem("pilotzia:copilot-draft", message);
    }

    router.push("/app/copilot");
  }

  return (
    <div className="border-b border-border bg-card/60 px-4 py-3 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-5xl items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-colors focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/20"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Bot size={17} />
        </div>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          aria-label="Poser une question au Copilote"
          placeholder="Demandez à Pilotzia ce qui mérite votre attention…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
        >
          Ouvrir dans Copilote <ArrowRight size={14} />
        </button>
      </form>
      <p className="mx-auto mt-1.5 max-w-5xl px-1 text-[11px] text-muted-foreground">
        La réponse complète s'affiche uniquement dans Copilote afin de garder vos autres pages lisibles.
      </p>
    </div>
  );
}
