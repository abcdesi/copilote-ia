"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";

type Sentiment = "great" | "good" | "meh" | "bad";

const OPTIONS: { value: Sentiment; emoji: string; label: string }[] = [
  { value: "great", emoji: "😊", label: "Oui beaucoup" },
  { value: "good", emoji: "🙂", label: "Oui un peu" },
  { value: "meh", emoji: "😐", label: "Pas vraiment" },
  { value: "bad", emoji: "😕", label: "Non" },
];

export function FeedbackWidget({ automationId }: { automationId: string }) {
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [timeSaved, setTimeSaved] = useState("");
  const [valueObserved, setValueObserved] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(value: Sentiment, includeOutcome = false) {
    setSending(true);
    try {
      await fetch(`/api/automations/${automationId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sentiment: value,
          ...(includeOutcome && timeSaved ? { timeSavedPerWeek: Number(timeSaved) } : {}),
          ...(includeOutcome && valueObserved ? { valueObservedEur30d: Number(valueObserved) } : {}),
          ...(includeOutcome && note.trim() ? { outcomeNote: note.trim() } : {}),
        }),
      });
      setDone(true);
    } finally {
      setSending(false);
    }
  }

  function selectSentiment(value: Sentiment) {
    setSentiment(value);
    if (value === "meh" || value === "bad") void submit(value);
  }

  if (done) {
    return (
      <div>
        <p className="text-sm font-medium">Merci — le retour est enregistré.</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Les chiffres saisis restent identifiés comme résultats déclarés par un utilisateur, distincts des métriques observées automatiquement par les fournisseurs.
        </p>
      </div>
    );
  }

  if (sentiment === "great" || sentiment === "good") {
    return (
      <div>
        <p className="text-sm font-medium">Quel résultat avez-vous réellement constaté ?</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Facultatif. Ne renseignez que ce que vous pouvez raisonnablement estimer ou mesurer ; Pilotzia conservera la provenance “déclaré par l'utilisateur”.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Temps gagné / semaine</label>
            <Input
              type="number"
              min={0}
              max={80}
              step="0.25"
              value={timeSaved}
              onChange={(event) => setTimeSaved(event.target.value)}
              placeholder="Ex. 3,5 heures"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Impact € observé sur 30 jours</label>
            <Input
              type="number"
              min={0}
              max={1000000}
              step="1"
              value={valueObserved}
              onChange={(event) => setValueObserved(event.target.value)}
              placeholder="Ex. 1200"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Contexte / preuve disponible</label>
          <Textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex. 4 rendez-vous obtenus, mesure issue du CRM, comparaison avec les 30 jours précédents…"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={sending} onClick={() => void submit(sentiment, true)}>
            {sending ? "Enregistrement…" : "Enregistrer le résultat"}
          </Button>
          <Button size="sm" variant="outline" disabled={sending} onClick={() => void submit(sentiment, false)}>
            Passer les chiffres
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium">Cette automatisation vous fait-elle réellement gagner du temps ou produire un meilleur résultat ?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => selectSentiment(option.value)}
            className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm transition-colors hover:border-accent/40 hover:bg-muted"
          >
            <span>{option.emoji}</span> {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
