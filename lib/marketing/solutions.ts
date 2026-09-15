export interface MarketingSolution {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  problem: string;
  outcome: string;
  signals: string[];
  approach: string[];
  proofNote: string;
}

export const MARKETING_SOLUTIONS: MarketingSolution[] = [
  {
    slug: "relance-prospects",
    eyebrow: "Ventes",
    title: "Relancer les prospects sans réponse sans transformer vos commerciaux en robots",
    description:
      "Pilotzia aide à détecter les prospects silencieux, qualifier la prochaine action et préparer des relances contextualisées avec validation avant envoi.",
    problem:
      "Les opportunités commerciales se perdent rarement parce qu'une équipe ne sait pas vendre. Elles se perdent souvent parce que le suivi est irrégulier, dispersé entre plusieurs outils ou impossible à prioriser.",
    outcome:
      "Un pipeline mieux suivi, moins de relances oubliées et du temps commercial consacré aux conversations qui comptent réellement.",
    signals: ["prospects sans réponse", "relances manuelles", "pipeline incomplet", "temps commercial dispersé"],
    approach: [
      "Identifier les prospects réellement à relancer à partir du contexte disponible.",
      "Prioriser selon ancienneté, stade, valeur et signaux de risque.",
      "Préparer une relance adaptée et demander confirmation avant toute action sensible.",
      "Mesurer réponses, rendez-vous obtenus et temps économisé pour améliorer la stratégie.",
    ],
    proofNote: "Les gains sont calculés à partir de vos volumes réels lorsque les sources nécessaires sont connectées.",
  },
  {
    slug: "recouvrement-factures",
    eyebrow: "Finance",
    title: "Réduire les factures en retard et protéger la trésorerie avec un suivi intelligent",
    description:
      "Pilotzia relie signaux financiers et processus de relance pour aider à prioriser les créances, préparer les actions et mesurer l'effet sur le délai de paiement.",
    problem:
      "Une relance tardive ou irrégulière immobilise de la trésorerie et consomme du temps administratif. Le problème devient critique quand personne ne sait quelles factures traiter en premier.",
    outcome:
      "Une vision claire des créances à risque, un processus de relance cohérent et des décisions de trésorerie mieux informées.",
    signals: ["créances clients élevées", "factures échues", "relances irrégulières", "tension de trésorerie"],
    approach: [
      "Structurer les échéances et les statuts réellement disponibles.",
      "Calculer les alertes utiles et distinguer urgence, montant et ancienneté.",
      "Préparer la relance adaptée au dossier et au niveau de risque.",
      "Suivre les encaissements et l'évolution du délai clients au lieu de compter uniquement les emails envoyés.",
    ],
    proofNote: "Pilotzia distingue les calculs issus de vos données des hypothèses et benchmarks génériques.",
  },
  {
    slug: "onboarding-client",
    eyebrow: "Opérations",
    title: "Industrialiser l'onboarding client sans perdre la qualité de service",
    description:
      "Pilotzia aide à transformer les étapes répétitives d'un onboarding client en processus observable, contrôlé et progressivement automatisable.",
    problem:
      "Quand chaque nouveau client dépend d'une checklist mentale, les oublis, délais et tâches administratives augmentent avec la croissance.",
    outcome:
      "Des démarrages plus réguliers, moins de coordination manuelle et une équipe qui garde son énergie pour l'accompagnement à forte valeur.",
    signals: ["checklists manuelles", "multiples copier-coller", "retards de démarrage", "informations dispersées"],
    approach: [
      "Cartographier les étapes, responsables, outils et dépendances du parcours actuel.",
      "Identifier les points où une automatisation réduit réellement le risque ou le temps perdu.",
      "Préparer les actions répétitives tout en conservant les validations importantes.",
      "Mesurer délai de mise en route, incidents et temps mobilisé par client.",
    ],
    proofNote: "L'objectif n'est pas d'automatiser tout le parcours, mais d'automatiser ce qui améliore réellement l'expérience et la marge.",
  },
  {
    slug: "pilotage-financier",
    eyebrow: "Direction",
    title: "Transformer bilan, compte de résultat et données opérationnelles en décisions de direction",
    description:
      "Pilotzia construit une couche d'intelligence financière qui relie ratios, alertes, questions d'audit et processus opérationnels pour faire émerger les priorités.",
    problem:
      "Un bilan ou un compte de résultat décrit ce qui s'est passé. Le dirigeant a surtout besoin de comprendre pourquoi, ce qui mérite une investigation et quelles actions peuvent améliorer marge, trésorerie ou productivité.",
    outcome:
      "Un audit plus structuré, des questions de clarification pertinentes et un plan d'action relié aux causes opérationnelles plutôt qu'une simple lecture des chiffres.",
    signals: ["baisse de marge", "délai clients", "charges en hausse", "trésorerie tendue", "productivité difficile à expliquer"],
    approach: [
      "Normaliser les données financières et conserver leur provenance.",
      "Calculer ratios et alertes sans inventer les informations manquantes.",
      "Poser les questions qui permettent d'expliquer les écarts et les tendances.",
      "Relier le diagnostic aux processus, outils et opportunités d'amélioration réellement observés.",
    ],
    proofNote: "Les recommandations financières doivent être traçables et ne remplacent pas un expert-comptable ou un conseil réglementé lorsque celui-ci est requis.",
  },
];

export function getMarketingSolution(slug: string) {
  return MARKETING_SOLUTIONS.find((solution) => solution.slug === slug);
}
