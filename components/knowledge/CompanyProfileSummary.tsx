import Link from "next/link";
import { FileText, PencilLine } from "lucide-react";
import type { CompanyProfileSummaryItem } from "@/lib/companies/profile-summary";
import type { KnowledgeSection } from "@/lib/companies/knowledge-model";

export function CompanyProfileSummary({
  items,
  sections,
  updatedAt,
}: {
  items: CompanyProfileSummaryItem[];
  sections: KnowledgeSection[];
  updatedAt: Date;
}) {
  const scores = new Map(sections.map((section) => [section.key, section.score]));
  const updatedLabel = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(updatedAt);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <FileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Dossier entreprise enregistré</p>
          <h2 className="mt-1 text-lg font-semibold">Ce que Pilotzia a retenu</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            Voici l'aperçu des informations que vous avez enregistrées. Elles restent modifiables à tout moment. Votre dossier entreprise
            sert de source déclarative au copilote ; le Business Graph en dérive ensuite des faits avec provenance, sans confondre vos déclarations
            avec les données réellement connectées.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Dernière mise à jour du dossier : {updatedLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const score = scores.get(item.key) ?? 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group rounded-xl border border-border/80 p-4 transition hover:border-accent/40 hover:bg-accent-soft/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Couverture : {score}%</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                  <PencilLine size={13} /> Modifier
                </span>
              </div>
              <p className="mt-3 line-clamp-4 text-sm leading-5 text-foreground/80">
                {item.filled ? item.summary : "Aucune information enregistrée pour cette rubrique."}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
