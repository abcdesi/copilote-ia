# Pilotzia — Operating Company Core

## North Star

Pilotzia reste en façade **le copilote opérationnel de l'entreprise**. En profondeur, il devient une couche d'orchestration capable d'observer l'activité, structurer les faits, détecter les exceptions, préparer ou exécuter des actions autorisées, demander les décisions sensibles et mesurer le résultat.

Flux cible :

`Sources → événements métier → Business Graph vivant → intelligence → décision → automatisation/agent → action → mesure → apprentissage → brief dirigeant`

## Principe du brief dirigeant

Le brief ne doit jamais être un texte inventé par un modèle. Les compteurs (« devis envoyés », « factures payées », etc.) proviennent d'événements persistés avec une source. Le modèle peut expliquer et prioriser, mais il ne fabrique pas les métriques.

Le noyau `lib/operating-company` fournit :

- une taxonomie minimale d'événements opérationnels ;
- une ingestion normalisée et sourcée ;
- un brief 24 h traçable ;
- des décisions issues de `PendingAction` ;
- des politiques initiales d'agents spécialisés et une validation humaine par défaut.

## APIs / connecteurs

Il n'existe pas une API unique capable de faire fonctionner toutes les entreprises. Pilotzia doit connecter les systèmes qui font autorité chez chaque client.

Socle actuel / prioritaire :

1. **Anthropic** — raisonnement et synthèse. Une clé serveur `ANTHROPIC_API_KEY`; le LLM n'est jamais la source des compteurs opérationnels.
2. **Google Workspace** — Gmail + Calendar via OAuth. Lecture pour observer ; scopes d'action séparés pour préparer des brouillons/événements, avec confirmation selon la politique.
3. **n8n** — exécution/orchestration des workflows quand une intégration métier n'est pas native.
4. **Stripe** — facturation Pilotzia, pas source universelle de comptabilité client.
5. **Connecteurs métier progressifs** — CRM, devis/facturation/comptabilité, planning, support, ERP. Ils alimentent la même taxonomie d'événements au lieu de contaminer le cœur avec des formats fournisseur.

## Règles d'autonomie

- `observe` : lecture et détection uniquement ;
- `prepare` : prépare une action et crée une validation ;
- `execute_low_risk` : réservé aux actions explicitement autorisées et réversibles ;
- tout engagement financier, contractuel, message externe sensible, remise, remboursement ou changement important reste soumis à validation explicite par défaut ;
- toutes les actions doivent être journalisées et reliées à leur source.

## Premier wedge

Le premier agent spécialisé est **Commercial** : demandes entrantes → qualification → réponse/relance préparée → devis/opportunité → décision humaine si nécessaire → mesure du taux de progression. L'architecture reste générique afin d'ajouter ensuite accueil, recouvrement, support et opérations sans reconstruire le cœur.

## Étapes suivantes

- brancher les événements réels Gmail/Calendar au nouveau bus opérationnel ;
- ajouter un adaptateur CRM/devis afin de produire `DEMAND_RECEIVED`, `QUOTE_SENT`, `QUOTE_ACCEPTED` ;
- ajouter un adaptateur facturation/comptabilité pour `INVOICE_PAID` ;
- exposer le brief dans le dashboard sans changer le positionnement public ;
- ajouter salience, fraîcheur, contradiction et supersession aux faits du Business Graph ;
- mesurer avant/après et ROI réalisé.
