"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

const PLACEHOLDERS = [
  "Qu'est-ce qui mérite mon attention aujourd'hui ?",
  "Où est-ce que je perds du temps ?",
  "Quelle priorité dois-je traiter maintenant ?",
  "Que sais-tu déjà de mon entreprise ?",
  "Quelle automatisation aurait le plus d'impact ?",
];

function compactPreview(value: string) {
  const cleaned = value
    .replace(/\*\*/g, "")
    .replace(/[\x60#>_*~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 220) return cleaned;
  return cleaned.slice(0, 217).trimEnd() + "…";
}

export function CopilotBar() {
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setPlaceholderIndex((index) => (index + 1) % PLACEHOLDERS.length),
      3500
    );
    return () => window.clearInterval(id);
  }, []);

  if (pathname === "/app/copilot" || pathname.startsWith("/app/copilot/")) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setLoading(true);
    setReply(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      setReply(
        response.ok
          ? compactPreview(String(data.reply ?? ""))
          : "Le Copilote n'a pas pu répondre. Ouvrez la conversation pour réessayer."
      );
    } catch {
      setReply("Le Copilote n'a pas pu répondre. Ouvrez la conversation pour réessayer.");
    } finally {
      setInput("");
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-border bg-card/60 px-4 py-3 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-5xl items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30"
      >
        <Sparkles size={16} className="ml-2 shrink-0 text-accent" />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          aria-label="Question rapide au Copilote"
          className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Envoyer au Copilote"
          className="flex shrink-0 items-center justify-center rounded-full bg-accent p-2 text-accent-foreground disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
        </button>
      </form>

      {reply && (
        <div className="mx-auto mt-2 flex max-w-5xl items-center gap-3 rounded-xl bg-accent-soft px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate text-sm text-foreground" title={reply}>
            {reply}
          </p>
          <Link
            href="/app/copilot"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-accent"
          >
            Continuer à lire sur Copilote <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}
