"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
  const [done, setDone] = useState(false);

  async function submit(value: Sentiment, withTime?: number) {
    await fetch(`/api/automations/${automationId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sentiment: value, timeSavedPerWeek: withTime }),
    });
  }

  function selectSentiment(value: Sentiment) {
    setSentiment(value);
    if (value === "meh" || value === "bad") {
      submit(value);
      setDone(true);
    }
  }

  if (done || (sentiment && (sentiment === "meh" || sentiment === "bad"))) {
    return <p className="text-sm text-muted-foreground">Merci pour votre retour — c&apos;est pris en compte. 🙏</p>;
  }

  if (sentiment === "great" || sentiment === "good") {
    return (
      <div>
        <p className="text-sm font-medium">Combien de temps estimez-vous gagner chaque semaine ?</p>
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={80}
            value={timeSaved}
            onChange={(e) => setTimeSaved(e.target.value)}
            placeholder="Heures / semaine"
            className="max-w-[160px]"
          />
          <Button
            size="sm"
            onClick={async () => {
              await submit(sentiment, timeSaved ? Number(timeSaved) : undefined);
              setDone(true);
            }}
          >
            Envoyer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium">Cette automatisation vous fait-elle réellement gagner du temps ?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => selectSentiment(o.value)}
            className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm hover:border-accent/40 hover:bg-muted transition-colors"
          >
            <span>{o.emoji}</span> {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
