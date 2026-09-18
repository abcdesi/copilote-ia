"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

const PLACEHOLDERS = [
  "Que voulez-vous faire ? (ex : « Automatise mes relances »)",
  "Qu'est-ce qui mérite mon attention aujourd'hui ?",
  "Trouve ce qui me fait perdre du temps",
  "Que sais-tu déjà de mon entreprise ?",
  "Quels outils devrais-je connecter en priorité ?",
];

const COPILOT_DRAFT_KEY = "pilotzia:copilot-draft";

export function CopilotBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(id);
  }, []);

  if (pathname === "/app/copilot") return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;

    // Le texte reste dans la session du navigateur : pas de question métier dans l'URL,
    // pas d'appel IA depuis une page qui n'est pas le Copilote.
    window.sessionStorage.setItem(COPILOT_DRAFT_KEY, prompt);
    setInput("");
    router.push("/app/copilot");
  }

  return (
    <div className="border-b border-border bg-card/60 px-4 py-3 sm:px-6">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
        <Sparkles size={16} className="ml-2 shrink-0 text-accent" />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          aria-label="Préparer une question pour le Copilote"
          className="flex-1 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Ouvrir dans le Copilote"
          className="flex shrink-0 items-center justify-center rounded-full bg-accent p-1.5 text-accent-foreground disabled:opacity-40"
        >
          <ArrowRight size={14} />
        </button>
      </form>
      <p className="mx-auto mt-1.5 max-w-3xl px-3 text-[11px] text-muted-foreground">
        La réponse s'ouvre dans le Copilote pour conserver le contexte et les prochaines actions au même endroit.
      </p>
    </div>
  );
}
