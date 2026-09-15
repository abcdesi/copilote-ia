export const INTELLIGENCE_SOURCE_HIERARCHY = [
  {
    priority: 1,
    id: "company_private",
    label: "Données privées de l'entreprise",
    rule: "Source prioritaire pour les faits propres à l'entreprise : outils connectés, documents, données financières, opérations, déclarations et Business Graph.",
  },
  {
    priority: 2,
    id: "external_research",
    label: "Données externes pertinentes",
    rule: "Utiliser des sources externes seulement quand elles sont utiles au besoin : réglementation, marché, ratios publics, documentation produit ou contexte sectoriel. Toujours conserver la provenance et la date.",
  },
  {
    priority: 3,
    id: "aggregated_peers",
    label: "Benchmarks agrégés d'entreprises comparables",
    rule: "Utiliser uniquement des agrégats suffisamment anonymisés. Ne jamais exposer ni réutiliser le contenu brut d'un autre client.",
  },
  {
    priority: 4,
    id: "pilotzia_patterns",
    label: "Intelligence générique Pilotzia",
    rule: "Ontologies, workflows, patterns métier et règles de décision réutilisables. Ce niveau guide les hypothèses quand les preuves spécifiques manquent.",
  },
] as const;

export const INTELLIGENCE_GUARDRAILS = [
  "Une donnée spécifique client a toujours priorité sur un benchmark ou un pattern générique.",
  "Une estimation doit être étiquetée comme estimation et ne doit jamais devenir un fait.",
  "Un benchmark agrégé ne doit être présenté que si la cohorte est suffisamment large pour éviter toute ré-identification.",
  "Une recommandation importante doit citer les preuves utilisées, les hypothèses et le niveau de confiance.",
  "Les systèmes sources restent l'autorité ; Pilotzia conserve provenance, fraîcheur et confiance.",
] as const;

export function intelligenceSourceInstruction() {
  return `HIÉRARCHIE DES SOURCES\n${INTELLIGENCE_SOURCE_HIERARCHY.map(
    (source) => `${source.priority}. ${source.label}: ${source.rule}`
  ).join("\n")}\n\nGARDE-FOUS\n${INTELLIGENCE_GUARDRAILS.map((rule) => `- ${rule}`).join("\n")}`;
}
