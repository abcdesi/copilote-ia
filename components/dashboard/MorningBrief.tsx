import Link from "next/link";
import { Sun } from "lucide-react";

export interface MorningBriefItem {
  tone: "danger" | "accent" | "success";
  text: string;
  href: string;
}

export function MorningBrief({ firstName, items }: { firstName: string; items: MorningBriefItem[] }) {
  return (
    <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Sun size={18} className="text-accent" />
        <p className="text-sm font-semibold text-accent">Votre brief du jour</p>
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
        Bonjour, {firstName} — voici ce qui mérite votre attention aujourd&apos;hui.
      </h1>

      <ul className="mt-4 space-y-2">
        {items.map((item, i) => (
          <li key={i}>
            <Link
              href={item.href}
              className="flex items-center gap-2 text-sm text-foreground hover:text-accent transition-colors"
            >
              <ToneDot tone={item.tone} />
              {item.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToneDot({ tone }: { tone: MorningBriefItem["tone"] }) {
  const cls = tone === "danger" ? "bg-danger" : tone === "success" ? "bg-success" : "bg-accent";
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}
