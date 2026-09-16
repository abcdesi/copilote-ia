import Link from "next/link";
import { Clock3, FileText, PencilLine } from "lucide-react";
import type { CompanyProfileSummaryItem } from "@/lib/companies/profile-summary";
import type { KnowledgeSection } from "@/lib/companies/knowledge-model";

function freshnessLabel(section: KnowledgeSection) {
  if (section.freshness === "fresh") return "à jour";
  if (section.freshness === "aging") return "à reconfirmer bientôt";
  if (section.freshness === "stale") return "à actualiser";
  return "date à confirmer";
}

export function CompanyProfileSummary({
  items,
  sections,
  updatedAt,
}: {
  items: CompanyProfileSummaryItem[];
  sections: KnowledgeSection[];
  updatedAt: Date;
}) {
  const sectionMap = new Map(sections.map((section) => [section.key, section]));
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
            Pilotzia mesure des informations distinctes et utiles, pas la quantité de texte. Répéter une même idée ne fait donc pas monter le score.
            Chaque rubrique montre ce qui est déjà compris, ce qui manque et ce qui doit être actualisé quand la situation de l'entreprise évolue.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Dernière mise à jour générale du dossier : {updatedLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const section = sectionMap.get(item.key);
          const score = section?.score ?? 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group rounded-xl border border-border/80 p-4 transition hover:border-accent/40 hover:bg-accent-soft/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Couverture : {score}%
                    {section ? ` · ${section.knownDimensions}/${section.totalDimensions} dimensions comprises` : ""}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                  <PencilLine size={13} /> Modifier
                </span>
              </div>

              <p className="mt-3 line-clamp-4 text-sm leading-5 text-foreground/80">
                {item.filled ? item.summary : "Aucune information enregistrée pour cette rubrique."}
              </p>

              {section && (
                <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <Clock3 size={12} /> {freshnessLabel(section)}
                  </p>
                  {section.nextQuestion && (
                    <p className="text-xs leading-5 text-foreground/75">
                      <span className="font-semibold text-foreground">Pour progresser :</span> {section.nextQuestion}
                    </p>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
