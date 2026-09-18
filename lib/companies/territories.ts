export const BUSINESS_TERRITORY_GROUPS = [
  {
    label: "France",
    options: ["France métropolitaine"],
  },
  {
    label: "Outre-mer français",
    options: [
      "Martinique",
      "Guadeloupe",
      "Guyane",
      "La Réunion",
      "Mayotte",
      "Saint-Martin",
      "Saint-Barthélemy",
      "Saint-Pierre-et-Miquelon",
      "Polynésie française",
      "Nouvelle-Calédonie",
      "Wallis-et-Futuna",
    ],
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
