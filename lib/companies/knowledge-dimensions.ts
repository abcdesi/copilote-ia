export type KnowledgeDimensionSectionKey =
  | "activity"
  | "team"
  | "objectives"
  | "painPoints"
  | "applications"
  | "local"
  | "finance"
  | "accounting"
  | "sales"
  | "marketing"
  | "hr"
  | "operations";

export interface KnowledgeDimensionSpec {
  key: string;
  label: string;
  question: string;
  keywords: string[];
  weight?: number;
}

export interface DeclaredKnowledgeAssessment {
  score: number;
  coveredKeys: string[];
  specificity: number;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%€$]+/g, " ")
    .trim();
}

export function dimensionTextMatches(text: string, keyword: string) {
  const normalizedText = normalize(text);
  const normalizedKeyword = normalize(keyword);
  if (!normalizedText || !normalizedKeyword) return false;

  if (normalizedKeyword.includes(" ")) {
    return ` ${normalizedText} `.includes(` ${normalizedKeyword} `);
  }

  const tokens = normalizedText.split(/\s+/).filter(Boolean);
  if (normalizedKeyword.length <= 3) return tokens.includes(normalizedKeyword);
  return tokens.some((token) => token === normalizedKeyword || token.startsWith(normalizedKeyword));
}

export const KNOWLEDGE_DIMENSIONS: Record<KnowledgeDimensionSectionKey, KnowledgeDimensionSpec[]> = {
  activity: [
    { key: "offer", label: "Offre / activité", question: "Que vendez-vous concrètement et à quels clients ?", keywords: ["offre", "service", "produit", "prestation", "vente", "activite"] },
    { key: "business_model", label: "Modèle économique", question: "Comment l'entreprise gagne-t-elle de l'argent : abonnement, prestation, marge, commission… ?", keywords: ["abonnement", "prestation", "commission", "marge", "licence", "forfait", "facturation", "business model", "modele economique"] },
    { key: "customer_segment", label: "Segments clients", question: "Quels sont vos principaux types de clients ?", keywords: ["client", "pme", "eti", "grand compte", "b2b", "b2c", "particulier", "professionnel", "segment"] },
    { key: "decision_maker", label: "Décideur / acheteur", question: "Qui décide généralement de l'achat chez vos clients ?", keywords: ["decideur", "acheteur", "dirigeant", "daf", "drh", "direction", "responsable"] },
    { key: "economics", label: "Économie unitaire", question: "Quel est l'ordre de grandeur du panier, contrat ou revenu récurrent ?", keywords: ["panier", "contrat", "prix", "tarif", "revenu recurrent", "mrr", "arr", "valeur moyenne"] },
  ],
  team: [
    { key: "size", label: "Effectif", question: "Combien de personnes travaillent dans l'entreprise aujourd'hui ?", keywords: ["salarie", "employe", "personne", "effectif", "equipe"] },
    { key: "roles", label: "Rôles clés", question: "Comment se répartissent les principaux rôles ?", keywords: ["commercial", "finance", "rh", "marketing", "support", "production", "operation", "direction", "manager", "role"] },
    { key: "management", label: "Organisation / management", question: "Comment l'équipe est-elle organisée et qui arbitre quoi ?", keywords: ["manager", "management", "responsable", "direction", "pole", "service", "equipe", "organisation"] },
    { key: "capacity", label: "Capacité / charge", question: "Où l'équipe est-elle actuellement en surcharge ou sous-capacité ?", keywords: ["charge", "surcharge", "capacite", "temps", "deborde", "ressource", "disponibilite"] },
  ],
  objectives: [
    { key: "outcome", label: "Résultat attendu", question: "Quel résultat business voulez-vous obtenir ?", keywords: ["augment", "redu", "amelior", "develop", "stabilis", "acceler", "objectif", "priorite"] },
    { key: "metric", label: "Indicateur", question: "Quel indicateur permettra de savoir que l'objectif est atteint ?", keywords: ["ca", "marge", "tresorer", "conversion", "delai", "temps", "cout", "churn", "satisfaction", "qualite", "roi"] },
    { key: "target", label: "Cible chiffrée", question: "Quelle cible chiffrée souhaitez-vous atteindre ?", keywords: ["%", "euro", "€", "heure", "jour", "semaine", "mois", "x2", "fois"] },
    { key: "horizon", label: "Horizon", question: "À quelle échéance cet objectif compte-t-il ?", keywords: ["30 jours", "60 jours", "90 jours", "trimestre", "semestre", "annee", "mois", "semaine", "d'ici", "avant"] },
  ],
  painPoints: [
    { key: "process", label: "Processus concerné", question: "Quel processus ou quelle tâche pose problème ?", keywords: ["relance", "reporting", "devis", "facture", "reunion", "support", "recrut", "onboarding", "process", "tache", "workflow"] },
    { key: "frequency", label: "Fréquence", question: "À quelle fréquence le problème se produit-il ?", keywords: ["chaque jour", "quotidien", "semaine", "hebdo", "mois", "mensuel", "souvent", "recurrent", "fois"] },
    { key: "effort", label: "Temps / coût consommé", question: "Combien de temps ou d'argent ce problème consomme-t-il ?", keywords: ["heure", "jour", "temps", "cout", "€", "euro", "budget"] },
    { key: "impact", label: "Impact business", question: "Quel impact cela a-t-il sur le CA, la marge, le cash, la qualité ou le risque ?", keywords: ["ca", "marge", "cash", "tresorer", "retard", "perte", "risque", "client", "qualite", "conversion"] },
    { key: "owner", label: "Équipe concernée", question: "Qui subit ou traite principalement ce problème ?", keywords: ["commercial", "compta", "finance", "rh", "marketing", "support", "direction", "operation", "equipe"] },
  ],
  applications: [
    { key: "declared", label: "Outils recensés", question: "Quelles applications utilisez-vous réellement au quotidien ?", keywords: ["crm", "erp", "gmail", "outlook", "slack", "teams", "notion", "excel", "sheets", "hubspot", "salesforce", "pennylane", "sage", "logiciel", "outil"] },
    { key: "connected", label: "Sources connectées", question: "Quelles sources Pilotzia peut-il lire directement ?", keywords: ["connect", "synchron", "api", "oauth"] },
  ],
  local: [
    { key: "market", label: "Marché / zone", question: "Sur quelle zone géographique vendez-vous principalement ?", keywords: ["france", "martinique", "guadeloupe", "europe", "local", "international", "region", "zone", "marche"] },
    { key: "seasonality", label: "Saisonnalité", question: "Votre activité varie-t-elle fortement selon les périodes ?", keywords: ["saison", "haute saison", "basse saison", "ete", "hiver", "vacance", "periode"] },
    { key: "regulation", label: "Contraintes réglementaires", question: "Y a-t-il une réglementation ou contrainte locale importante ?", keywords: ["reglement", "norme", "obligation", "conform", "legal", "fiscal", "droit"] },
    { key: "language", label: "Langue / usages", question: "Y a-t-il des particularités de langue, fuseau ou usages locaux ?", keywords: ["langue", "francais", "anglais", "creole", "fuseau", "horaire", "usage"] },
  ],
  finance: [
    { key: "revenue", label: "CA / revenus", question: "Quel est votre CA et son évolution récente ?", keywords: ["ca", "chiffre d affaires", "revenu", "ventes", "mrr", "arr"] },
    { key: "margin", label: "Marge / rentabilité", question: "Quelle marge suivez-vous et comment évolue-t-elle ?", keywords: ["marge", "rentabil", "ebit", "ebitda", "ebe", "resultat"] },
    { key: "cash", label: "Trésorerie", question: "Quel est votre niveau de trésorerie et votre tension de cash ?", keywords: ["tresorer", "cash", "banque", "liquidite", "encaissement"] },
    { key: "receivables", label: "Créances clients", question: "Quel montant de créances ou d'impayés avez-vous et depuis combien de temps ?", keywords: ["creance", "impaye", "dso", "client.*retard", "facture impay"] },
    { key: "debt", label: "Dettes / fournisseurs", question: "Quelles dettes ou échéances fournisseurs pèsent sur le cash ?", keywords: ["dette", "fournisseur", "emprunt", "credit", "echeance"] },
    { key: "costs", label: "Structure de coûts", question: "Quels sont vos principaux postes de coûts et leur poids ?", keywords: ["cout", "charge", "masse salariale", "loyer", "achat", "depense"] },
    { key: "forecast", label: "Prévision / saisonnalité", question: "Avez-vous une prévision de trésorerie ou une saisonnalité marquée ?", keywords: ["prevision", "forecast", "budget", "saison", "atterrissage"] },
  ],
  accounting: [
    { key: "software", label: "Outil comptable", question: "Quel outil ou cabinet tient votre comptabilité ?", keywords: ["pennylane", "sage", "quickbooks", "xero", "expert comptable", "outil comptable", "logiciel comptable"] },
    { key: "invoicing", label: "Facturation", question: "Comment émettez-vous et suivez-vous les factures ?", keywords: ["factur", "invoice", "devis", "avoir"] },
    { key: "close", label: "Clôture", question: "À quel rythme faites-vous vos clôtures et avec quel délai ?", keywords: ["cloture", "mensuel", "trimestr", "annuel", "arrete"] },
    { key: "reconciliation", label: "Rapprochements", question: "Comment sont faits les rapprochements bancaires et contrôles ?", keywords: ["rapproch", "banque", "lettrage", "controle"] },
    { key: "collections", label: "Relances / impayés", question: "Comment gérez-vous les relances et impayés ?", keywords: ["relance", "impaye", "retard", "recouvrement"] },
    { key: "reporting", label: "Reporting", question: "Quels reportings comptables recevez-vous et à quelle fréquence ?", keywords: ["reporting", "tableau de bord", "balance", "grand livre", "journal", "mensuel"] },
  ],
  sales: [
    { key: "lead_volume", label: "Volume de leads", question: "Combien de nouveaux leads entrez-vous dans le pipe sur une période normale ?", keywords: ["lead", "prospect", "opportunite", "demande entrante"] },
    { key: "pipeline", label: "Pipeline", question: "Quelles sont vos étapes de pipeline et leur valeur actuelle ?", keywords: ["pipeline", "pipe", "etape", "opportunite", "forecast"] },
    { key: "conversion", label: "Conversion / réponse", question: "Quels taux de réponse et de conversion suivez-vous ?", keywords: ["conversion", "taux de reponse", "reponse", "win rate", "signature", "gagne"] },
    { key: "quote", label: "Devis / proposition", question: "Comment sont produits et suivis les devis ou propositions ?", keywords: ["devis", "proposition", "offre commerciale"] },
    { key: "cycle", label: "Cycle de vente", question: "Combien de temps dure votre cycle de vente moyen ?", keywords: ["cycle", "delai de vente", "jours", "semaines", "mois"] },
    { key: "followup", label: "Relances", question: "Comment décidez-vous quand et qui relancer ?", keywords: ["relance", "follow up", "suivi", "rappel"] },
    { key: "crm", label: "CRM / source", question: "Où le pipeline et les interactions commerciales sont-ils suivis ?", keywords: ["crm", "hubspot", "pipedrive", "salesforce", "excel", "sheets"] },
  ],
  marketing: [
    { key: "channels", label: "Canaux", question: "Quels canaux génèrent réellement vos prospects ?", keywords: ["seo", "google", "meta", "linkedin", "email", "newsletter", "salon", "partenaire", "canal"] },
    { key: "budget", label: "Budget", question: "Quel budget marketing dépensez-vous par canal ?", keywords: ["budget", "depense", "cout", "ads", "publicite"] },
    { key: "lead_cost", label: "Coût d'acquisition", question: "Suivez-vous le coût par lead ou le coût d'acquisition client ?", keywords: ["cpl", "cac", "cout par lead", "cout acquisition", "acquisition"] },
    { key: "campaigns", label: "Campagnes / contenu", question: "Quelles campagnes ou contenus tournent actuellement ?", keywords: ["campagne", "contenu", "publication", "ads", "newsletter"] },
    { key: "conversion", label: "Conversion", question: "Quel taux de conversion obtenez-vous entre audience, lead et vente ?", keywords: ["conversion", "taux", "lead", "vente"] },
    { key: "attribution", label: "Attribution", question: "Savez-vous quels canaux contribuent réellement aux ventes ?", keywords: ["attribution", "source", "utm", "tracking", "origine"] },
    { key: "audience", label: "Audience / cible", question: "Quelle cible marketing essayez-vous de toucher en priorité ?", keywords: ["cible", "audience", "persona", "segment", "client ideal"] },
  ],
  hr: [
    { key: "organisation", label: "Organisation / rôles", question: "Comment l'équipe est-elle structurée et quels rôles sont critiques ?", keywords: ["organisation", "equipe", "role", "manager", "responsable", "service", "pole"] },
    { key: "hiring", label: "Recrutement", question: "Combien de recrutements réalisez-vous et où le processus bloque-t-il ?", keywords: ["recrut", "candidat", "embauche", "poste", "entretien"] },
    { key: "onboarding", label: "Onboarding / départs", question: "Comment se passent l'arrivée et le départ d'un collaborateur ?", keywords: ["onboarding", "integration", "arrivee", "offboarding", "depart"] },
    { key: "capacity", label: "Charge / capacité", question: "Quelles équipes sont en surcharge ou manquent de capacité ?", keywords: ["charge", "surcharge", "capacite", "temps", "deborde", "heures"] },
    { key: "processes", label: "Processus RH récurrents", question: "Quels processus RH reviennent chaque mois ou trimestre ?", keywords: ["conge", "absence", "entretien annuel", "paie", "formation", "planning", "process"] },
    { key: "tools", label: "Outils RH", question: "Quels outils utilisez-vous pour suivre les collaborateurs et processus RH ?", keywords: ["lucca", "factorial", "bamboo", "silae", "excel", "notion", "outil rh", "sirh"] },
    { key: "metrics", label: "Indicateurs agrégés", question: "Quels indicateurs RH agrégés suivez-vous ?", keywords: ["turnover", "absenteisme", "anciennete", "delai recrutement", "taux", "indicateur"] },
    { key: "frictions", label: "Friction / objectif RH", question: "Quel problème RH vous coûte aujourd'hui le plus de temps ou de capacité ?", keywords: ["probleme", "blocage", "retard", "manuel", "perte de temps", "objectif", "priorite"] },
  ],
  operations: [
    { key: "core_process", label: "Processus critiques", question: "Quels processus font réellement tourner l'activité ?", keywords: ["process", "workflow", "production", "livraison", "prestation", "operation"] },
    { key: "volumes", label: "Volumes", question: "Quels volumes traitez-vous par jour, semaine ou mois ?", keywords: ["volume", "commande", "ticket", "dossier", "client", "par jour", "par semaine", "par mois"] },
    { key: "support", label: "Support / demandes", question: "Comment arrivent et sont traitées les demandes clients ou internes ?", keywords: ["support", "ticket", "demande", "sav", "client"] },
    { key: "meetings", label: "Réunions / coordination", question: "Quelles réunions ou coordinations consomment le plus de temps ?", keywords: ["reunion", "meeting", "point", "coordination", "compte rendu"] },
    { key: "delays", label: "Délais / SLA", question: "Quels délais sont critiques et lesquels dérapent ?", keywords: ["delai", "sla", "retard", "temps de traitement", "attente"] },
    { key: "quality", label: "Contrôles / qualité", question: "Quels contrôles ou erreurs récurrentes ralentissent l'exécution ?", keywords: ["controle", "qualite", "erreur", "verification", "reprise"] },
    { key: "bottlenecks", label: "Goulots / blocages", question: "Où le travail s'accumule-t-il ou dépend-il d'une seule personne ?", keywords: ["blocage", "goulot", "attente", "depend", "validation", "surcharge"] },
    { key: "handoffs", label: "Outils / passages de relais", question: "Entre quels outils ou équipes l'information se perd-elle ?", keywords: ["outil", "excel", "notion", "slack", "teams", "email", "transfert", "passage"] },
  ],
};

function hasQuantifiedSignal(text: string) {
  const normalized = normalize(text);
  return /\b\d+(?:[.,]\d+)?\b/.test(normalized) || /%|€|\$/.test(text);
}

function hasFrequencySignal(text: string) {
  const normalized = normalize(text);
  return /\b(par jour|par semaine|par mois|quotidien|hebdo|mensuel|trimestre|90 jours|30 jours|60 jours)\b/.test(normalized);
}

function hasNamedSystemSignal(text: string) {
  const normalized = normalize(text);
  return /\b(hubspot|salesforce|pipedrive|pennylane|sage|quickbooks|xero|lucca|factorial|notion|slack|teams|gmail|outlook|excel|sheets)\b/.test(normalized);
}

export function assessDeclaredKnowledge(sectionKey: KnowledgeDimensionSectionKey, text: string | null | undefined): DeclaredKnowledgeAssessment {
  const value = text?.trim() ?? "";
  if (!value) return { score: 0, coveredKeys: [], specificity: 0 };

  const dimensions = KNOWLEDGE_DIMENSIONS[sectionKey];
  const covered = dimensions.filter((dimension) => dimension.keywords.some((keyword) => dimensionTextMatches(value, keyword)));
  const totalWeight = dimensions.reduce((sum, dimension) => sum + (dimension.weight ?? 1), 0);
  const coveredWeight = covered.reduce((sum, dimension) => sum + (dimension.weight ?? 1), 0);
  const coverageRatio = totalWeight > 0 ? coveredWeight / totalWeight : 0;

  let specificity = 0;
  if (hasQuantifiedSignal(value)) specificity += 6;
  if (hasFrequencySignal(value)) specificity += 4;
  if (hasNamedSystemSignal(value)) specificity += 2;

  return {
    score: Math.max(0, Math.min(100, Math.round(coverageRatio * 88 + Math.min(12, specificity)))),
    coveredKeys: covered.map((dimension) => dimension.key),
    specificity: Math.min(12, specificity),
  };
}
