export const BUSINESS_TERRITORY_GROUPS = [
  {
    label: "France métropolitaine",
    options: ["France métropolitaine"],
  },
  {
    label: "Outre-mer — Antilles & Guyane",
    options: ["Martinique", "Guadeloupe", "Guyane", "Saint-Martin", "Saint-Barthélemy"],
  },
  {
    label: "Outre-mer — Océan Indien",
    options: ["La Réunion", "Mayotte"],
  },
  {
    label: "Outre-mer — Pacifique & Saint-Pierre-et-Miquelon",
    options: ["Saint-Pierre-et-Miquelon", "Polynésie française", "Nouvelle-Calédonie", "Wallis-et-Futuna"],
  },
  {
    label: "Autre pays / territoire",
    options: ["Autre territoire / pays"],
  },
] as const;

export const BUSINESS_TERRITORIES = BUSINESS_TERRITORY_GROUPS.flatMap((group) => group.options);

export function isKnownBusinessTerritory(value?: string | null) {
  return Boolean(value && (BUSINESS_TERRITORIES as readonly string[]).includes(value));
}
