"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, Circle, X } from "lucide-react";

export interface ProfileGuideStep {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

export function ProfileCompletionGuide({ steps }: { steps: ProfileGuideStep[] }) {
  const [hidden, setHidden] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const completed = steps.filter((step) => step.done).length;
  if (hidden || completed === steps.length) return null;

  async function dismissPermanently() {
    setDismissing(true);
    try {
      const response = await fetch("/api/company/profile-guide/dismiss", { method: "POST" });
      if (!response.ok) throw new Error("dismiss_failed");
      setHidden(true);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <aside className="fixed bottom-20 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-accent/20 bg-card p-4 shadow-xl sm:bottom-5 sm:right-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Profil entreprise · {completed}/{steps.length}</p>
          <p className="mt-1 text-sm font-semibold">Complétez le contexte pour rendre Pilotzia plus précis</p>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Fermer pour cette session"
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((completed / steps.length) * 100)}%` }} />
      </div>

      <ul className="mt-4 space-y-1.5">
        {steps.map((step) => (
          <li key={step.id}>
            {step.done ? (
              <div className="flex items-start gap-2 rounded-xl px-2 py-2 text-muted-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check size={12} />
                </span>
                <div>
                  <p className="text-xs font-medium line-through">{step.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4">Terminé</p>
                </div>
              </div>
            ) : (
              <Link
                href={step.href}
                className="group flex items-start gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-muted"
              >
                <Circle size={18} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{step.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{step.description}</p>
                </div>
                <ChevronRight size={14} className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          disabled={dismissing}
          onClick={() => void dismissPermanently()}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {dismissing ? "Enregistrement…" : "Ne plus afficher ce parcours"}
        </button>
      </div>
    </aside>
  );
}
