export const BUSINESS_TERRITORY_GROUPS = [
  {
    label: "France",
    options: ["France métropolitaine"],
  },
  {
    label: "Antilles & Guyane",
    options: ["Martinique", "Guadeloupe", "Guyane", "Saint-Martin", "Saint-Barthélemy"],
  },
  {
    label: "Océan Indien",
    options: ["La Réunion", "Mayotte"],
  },
  {
    label: "Autres territoires français",
    options: ["Saint-Pierre-et-Miquelon", "Polynésie française", "Nouvelle-Calédonie", "Wallis-et-Futuna"],
  },
  {
    label: "Hors zone de lancement",
    options: ["Autre territoire / pays"],
  },
] as const;

export const BUSINESS_TERRITORIES = BUSINESS_TERRITORY_GROUPS.flatMap((group) => group.options);

export function isKnownBusinessTerritory(value?: string | null) {
  return Boolean(value && (BUSINESS_TERRITORIES as readonly string[]).includes(value));
}
