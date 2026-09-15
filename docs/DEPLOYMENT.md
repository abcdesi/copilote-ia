# Déploiement Pilotzia

## Migrations Prisma

Les déploiements Vercel exécutent automatiquement `npm run db:migrate` avant `npm run build` via `vercel.json`.

Cela garantit que la base ciblée par `DATABASE_URL` reçoit les migrations Prisma présentes dans `prisma/migrations` avant que la nouvelle version de l'application soit servie.

### Règles

- Ne pas utiliser `prisma db push` en production.
- Toute modification du schéma doit être livrée avec une migration Prisma versionnée.
- Vérifier que `DATABASE_URL` de chaque environnement Vercel pointe vers la base attendue.
- En cas d'échec de migration, le build doit échouer : il vaut mieux ne pas promouvoir une version incompatible avec la base.

### Commandes manuelles utiles

```bash
npm run db:status
npm run db:migrate
```
