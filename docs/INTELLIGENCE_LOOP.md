# Pilotzia Intelligence Loop

Pilotzia ne doit pas fonctionner comme un catalogue d'automatisations. La cible produit est un système de conseil opérationnel qui transforme plusieurs couches de données en décisions traçables, puis mesure si ces décisions ont réellement créé de la valeur.

## Flux cible

Données de l'entreprise + meilleures données externes/IA pertinentes au besoin + données agrégées d'entreprises comparables
→ faits structurés
→ ratios / alertes
→ audit
→ questions de clarification
→ diagnostic
→ opportunités
→ plan d'action
→ automatisations
→ mesure du résultat
→ apprentissage.

## Hiérarchie des sources

1. Données privées de l'entreprise : systèmes connectés, documents, chiffres financiers, déclarations, Business Graph.
2. Données externes pertinentes : réglementation, marché, documentation, ratios publics, données sectorielles vérifiables.
3. Benchmarks agrégés de pairs : uniquement des cohortes anonymisées et suffisamment larges.
4. Intelligence générique Pilotzia : ontologies, patterns métier, workflows et règles de décision réutilisables.

Une donnée spécifique à l'entreprise prime toujours sur un benchmark ou un pattern générique. Les données privées d'un client ne deviennent jamais la matière brute d'un autre client.

## Opportunity Engine

Une opportunité sérieuse ne doit plus naître d'un simple mot-clé. Elle doit être justifiée par des preuves et scorée selon :

- impact revenu
- impact marge
- impact trésorerie
- temps économisable
- réduction du risque
- fréquence du problème
- faisabilité d'automatisation
- effort de mise en œuvre
- qualité/diversité des preuves
- niveau de confiance.

Chaque opportunité doit pouvoir expliquer : pourquoi elle existe, sur quelles données elle repose, ce qui est encore supposé, quelles données manquent, et quel résultat devra être mesuré après mise en œuvre.

## Intelligence financière — cible Scale

Le niveau Scale doit évoluer vers une fonction d'audit de direction. Pilotzia doit pouvoir ingérer un bilan, un compte de résultat et à terme des exports comptables structurés ; normaliser les postes ; calculer des ratios ; détecter des anomalies ; poser des questions de clarification ; croiser ces signaux avec les opérations ; puis recommander des actions de direction ou des automatisations.

Première fondation logicielle : `lib/intelligence/financial-audit.ts` calcule déjà des ratios déterministes à partir de données financières normalisées. L'ingestion PDF/XLS/CSV et la normalisation comptable restent une étape ultérieure : ne pas faire croire qu'elles sont déjà disponibles.

## Admin Intelligence Center

L'objectif admin n'est pas d'espionner les clients. Il est d'apprendre des tendances agrégées : besoins fréquents, secteurs les plus exposés, gains moyens, opportunités acceptées, automatisations réellement utiles, besoins non couverts, zones de marché intéressantes.

La première API est `/api/admin/intelligence`, protégée par `PILOTZIA_ADMIN_EMAILS`. Elle renvoie des agrégats par secteur, pays et taille, ainsi que les besoins les plus fréquents. Aucune donnée brute de conversation, document ou contenu privé ne doit apparaître dans ces agrégats.

À terme, toute cohorte trop petite devra être masquée (k-anonymat/minimum de population) avant affichage ou calcul de benchmark.

## Règle de vérité

Une recommandation de direction doit toujours permettre de distinguer :

- fait observé
- donnée déclarée
- calcul
- estimation
- hypothèse
- benchmark agrégé
- source externe
- niveau de confiance.

C'est cette traçabilité qui transforme Pilotzia d'un chatbot en logiciel de direction.
