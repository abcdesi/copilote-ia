"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { Bot, History, Loader2, Send, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ChatViewMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "Combien mes automatisations m'ont-elles fait économiser ce mois-ci ?",
  "Qu'est-ce que je pourrais automatiser ensuite ?",
  "Quels sont mes problèmes aujourd'hui ?",
  "Quel est mon Automation Score ?",
];

export function ChatView({ initialMessages, companyName }: { initialMessages: ChatViewMessage[]; companyName: string }) {
  const [messages, setMessages] = useState<ChatViewMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: ChatViewMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: res.ok ? data.reply : "Une erreur est survenue." },
      ]);
    } catch {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Une erreur est survenue." }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-104px)] max-w-3xl flex-col px-4 sm:px-6 lg:h-[calc(100vh-48px)]">
      <div className="flex items-center justify-between border-b border-border py-3">
        <p className="text-sm font-medium text-muted-foreground">Conversation d&apos;aujourd&apos;hui</p>
        <Link
          href="/app/copilot/history"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors"
        >
          <History size={14} /> Historique
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 space-y-5">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bot size={22} />
            </div>
            <p className="mt-3 font-semibold">Votre copilote pour {companyName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Posez une question sur vos automatisations, vos résultats ou ce que vous pourriez automatiser ensuite.
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground hover:border-accent/40 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex items-start gap-3", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                m.role === "user" ? "bg-muted text-foreground" : "bg-accent-soft text-accent"
              )}
            >
              {m.role === "user" ? <User size={15} /> : <Bot size={15} />}
            </div>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user" ? "bg-accent text-accent-foreground" : "bg-card border border-border"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pl-11">
            <Loader2 size={14} className="animate-spin" /> Le copilote réfléchit…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border py-4">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Que voulez-vous faire ?"
            className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex shrink-0 items-center justify-center rounded-full bg-accent p-2 text-accent-foreground disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
