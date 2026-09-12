# Pilotzia

Pilotzia est le copilote opérationnel de l'entreprise : il comprend le contexte, observe les opérations, recommande les prochaines actions, automatise ce qui doit l'être, mesure les résultats et garde une mémoire durable de l'entreprise.

## Développement local

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:3000`.

## Base de données

Le projet utilise PostgreSQL + Prisma.

```bash
npm run db:migrate
npm run db:status
npm run db:seed
```

En production, exécuter `npm run db:migrate` avant de déployer une version qui dépend d'un nouveau schéma.

## Variables d'environnement

Copier `.env.example` vers `.env.local` et renseigner uniquement les services réellement activés.

Variables indispensables pour l'application :

- `APP_URL`
- `DATABASE_URL`
- `AUTH_SECRET`

Pour les connexions OAuth réelles :

- `ENCRYPTION_KEY` — 32 octets en base64, utilisée pour chiffrer les tokens au repos
- `OAUTH_STATE_SECRET` — recommandé pour signer les états OAuth

Pour le copilote IA réel :

- `ANTHROPIC_API_KEY`

Pour Gmail + Google Calendar :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Le callback OAuth à déclarer dans Google Cloud est :

```text
${APP_URL}/api/integrations/google/callback
```

### Scopes Google actuels

Pilotzia demande uniquement les scopes nécessaires au MVP opérationnel : identité du compte, lecture Gmail, création de brouillons Gmail, lecture Calendar et création/modification d'événements Calendar.

La possession d'un scope API ne signifie pas que Pilotzia exécute librement une action. Les actions modifiantes doivent rester soumises à la politique de confirmation du produit.

## Automatisations réelles

Pilotzia peut déléguer l'orchestration technique à n8n. Variables :

- `N8N_API_URL`
- `N8N_API_KEY`
- `N8N_CALLBACK_SECRET`
- `CRON_SECRET`
- `RESEND_API_KEY` pour les emails transactionnels/exécutés par certains workflows

L'utilisateur ne voit jamais n8n : Pilotzia reste propriétaire de l'expérience, du contexte, des permissions, des recommandations, de la mesure et du monitoring.

## Paiement

Le schéma est prêt à stocker les identifiants Stripe réels. Variables prévues :

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_BUSINESS`

Ne jamais présenter un achat comme payé tant que le webhook du fournisseur de paiement ne l'a pas confirmé.

## Principes de sécurité produit

- Aucun token OAuth en clair en base.
- Les outils simplement renseignés sont distincts des connexions API réelles.
- Pas de contenu d'email stocké dans les snapshots opérationnels par défaut.
- Suppression, envoi, paiement, désactivation de service et changements importants exigent une confirmation forte.
- Les métriques de valeur et de temps sont des estimations lorsqu'elles ne viennent pas de mesures directes.
- Les événements analytics ne doivent pas contenir de PII brute.

## Déploiement

Le projet est conçu pour Vercel + PostgreSQL. Avant mise en production :

```bash
npm ci
npm run lint
npm run build
npm run db:migrate
```

Puis vérifier : authentification, diagnostic, Copilote, connexion Google, synchronisation, automatisations, callbacks n8n, cron et webhooks de paiement activés.
