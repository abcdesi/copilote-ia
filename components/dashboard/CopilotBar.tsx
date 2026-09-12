"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

const PLACEHOLDERS = [
  "Que voulez-vous faire ? (ex : « Automatise mes relances »)",
  "Trouve ce qui me fait perdre du temps",
  "Quels emails attendent une réponse ?",
  "Analyse mes outils",
];

export function CopilotBar() {
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(id);
  }, []);

  if (pathname === "/app/copilot") return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    setReply(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      setReply(res.ok ? data.reply : "Une erreur est survenue, réessayez.");
    } catch {
      setReply("Une erreur est survenue, réessayez.");
    } finally {
      setInput("");
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-border bg-card/60 px-4 py-3 sm:px-6">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent">
        <Sparkles size={16} className="ml-2 shrink-0 text-accent" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          className="flex-1 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex shrink-0 items-center justify-center rounded-full bg-accent p-1.5 text-accent-foreground disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
        </button>
      </form>

      {reply && (
        <div className="mx-auto mt-2 max-w-3xl rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-foreground">
          {reply}{" "}
          <Link href="/app/copilot" className="font-medium text-accent whitespace-nowrap">
            Ouvrir le copilote →
          </Link>
        </div>
      )}
    </div>
  );
}
