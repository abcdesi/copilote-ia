"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Bot, Loader2 } from "lucide-react";

function compactPreview(value: string) {
  const cleaned = value
    .replace(/\*\*/g, "")
    .replace(/[`#>_*~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= 180) return cleaned;
  return cleaned.slice(0, 177).trimEnd() + "…";
}

export function CopilotBar() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (pathname === "/app/copilot" || pathname.startsWith("/app/copilot/")) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || loading) return;

    setLoading(true);
    setReply(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as { reply?: unknown };
      setReply(
        response.ok
          ? compactPreview(String(data.reply ?? ""))
          : "Le Copilote n'a pas pu répondre ici."
      );
    } catch {
      setReply("Le Copilote n'a pas pu répondre ici.");
    } finally {
      setPrompt("");
      setLoading(false);
    }
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
          disabled={loading || !prompt.trim()}
          aria-label="Envoyer au Copilote"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent-soft disabled:opacity-35"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
        </button>
      </form>

      {reply && (
        <div className="mx-auto mt-2 max-w-5xl px-1">
          <p className="line-clamp-2 text-sm leading-5 text-foreground/85">
            <span>{reply}</span>{" "}
            <Link
              href="/app/copilot"
              className="font-semibold text-accent hover:underline"
            >
              Continuer à lire dans Copilote
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
