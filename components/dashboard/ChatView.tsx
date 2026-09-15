"use client";

import { FormEvent, ReactNode, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, History, Loader2, Send, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ChatViewMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: CopilotAction | null;
}

interface CopilotAction {
  kind: "navigate";
  label: string;
  href: string;
  description?: string;
  requiresConfirmation?: boolean;
}

const STARTERS = [
  "Qu'est-ce qui mérite mon attention aujourd'hui ?",
  "Où puis-je gagner du temps ou du chiffre d'affaires ?",
  "Quelle serait ma priorité si tu dirigeais l'entreprise avec moi ?",
  "Que sais-tu déjà de mon entreprise et qu'est-ce qui te manque ?",
];

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${index}-${part}`} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return <span key={`${index}-${part}`}>{part}</span>;
  });
}

function RichMessage({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const numbered = lines.length > 1 && lines.every((line) => /^\d+[.)]\s/.test(line));

        if (numbered) {
          return (
            <ol key={blockIndex} className="space-y-2 pl-5 list-decimal">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="pl-1">
                  {renderInlineMarkdown(line.replace(/^\d+[.)]\s*/, ""))}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-line">
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {renderInlineMarkdown(line)}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

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
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: res.ok ? data.reply : "Une erreur est survenue.",
          action: res.ok ? data.action ?? null : null,
        },
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
        <div>
          <p className="text-sm font-medium">Conseil opérationnel Pilotzia</p>
          <p className="text-xs text-muted-foreground">Plus Pilotzia connaît {companyName}, plus ses recommandations deviennent précises et vérifiables.</p>
        </div>
        <Link
          href="/app/copilot/history"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-accent"
        >
          <History size={14} /> Historique
        </Link>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Bot size={22} />
            </div>
            <p className="mt-3 font-semibold">Quelle décision voulez-vous mieux prendre pour {companyName} ?</p>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              Au début, Pilotzia raisonne comme un consultant en découverte. Avec votre contexte et vos sources connectées, il devient progressivement plus précis, plus exigeant et plus opérationnel.
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
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
            <div className="max-w-[82%] space-y-2">
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-6",
                  m.role === "user" ? "bg-accent text-accent-foreground" : "border border-border bg-card"
                )}
              >
                {m.role === "assistant" ? <RichMessage content={m.content} /> : m.content}
              </div>

              {m.role === "assistant" && m.action && (
                <div className="rounded-2xl border border-accent/20 bg-accent-soft p-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-accent">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Prochaine étape utile</p>
                      {m.action.description && (
                        <p className="mt-1 text-sm leading-5 text-foreground/75">{m.action.description}</p>
                      )}
                      {m.action.requiresConfirmation && (
                        <p className="mt-2 text-xs text-muted-foreground">Aucune activation n'est effectuée sans votre validation.</p>
                      )}
                      <Link
                        href={m.action.href}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
                      >
                        {m.action.label} <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 pl-11 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Pilotzia confronte la question au contexte disponible…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border py-4">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez une question de direction, d'opérations ou de croissance…"
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
