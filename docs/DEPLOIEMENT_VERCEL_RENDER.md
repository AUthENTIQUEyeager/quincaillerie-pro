# Déployer sur Vercel (frontend) + Render (backend) + Supabase (base de données)

En local vous continuez à utiliser SQLite normalement (`npm run dev`, rien ne change). En production, la base devient **PostgreSQL hébergée sur Supabase**, et le backend Express tourne sur **Render**.

Fichiers déjà préparés dans le projet pour ça :
- `backend/prisma/schema.production.prisma` → identique à `schema.prisma`, mais en PostgreSQL, avec `url` (connexion poolée) et `directUrl` (connexion directe, requise par Supabase pour les migrations)
- `render.yaml` → Blueprint Render (le service web uniquement ; la base n'est plus gérée par Render)
- `frontend/vercel.json` → routage SPA pour Vercel

---

## Étape 1 — Créer le projet Supabase

1. https://supabase.com/dashboard → **New Project**
2. Choisissez un nom, un mot de passe de base de données (notez-le), et une région proche de vos utilisateurs (ex : Europe si vous êtes en Afrique de l'Ouest francophone, la latence reste correcte).
3. Attendez ~2 minutes que le projet soit prêt.
4. Allez dans **Project Settings → Database**. Vous avez besoin de **deux** chaînes de connexion :

   - **Connection pooling** (mode *Transaction*, port `6543`) → à utiliser pour `DATABASE_URL` :
     ```
     postgresql://postgres.xxxxxxxxxxxx:[VOTRE-MOT-DE-PASSE]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
     ```
   - **Connection string directe** (port `5432`) → à utiliser pour `DIRECT_URL` :
     ```
     postgresql://postgres.xxxxxxxxxxxx:[VOTRE-MOT-DE-PASSE]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
     ```

   Remplacez `[VOTRE-MOT-DE-PASSE]` par le mot de passe choisi à la création. Gardez `?pgbouncer=true&connection_limit=1` sur `DATABASE_URL` uniquement — c'est ce qui permet à Prisma de fonctionner correctement avec le pooler de Supabase.

---

## Étape 2 — Déployer le backend sur Render

### Méthode Blueprint (recommandée)

1. Poussez le projet sur GitHub.
2. https://dashboard.render.com/blueprints → **New Blueprint Instance** → connectez votre repo (Render lit `render.yaml` à la racine).
3. Render crée le service `quincaillerie-pro-api` et vous demande de remplir les variables marquées `sync: false` :
   - `DATABASE_URL` → collez la chaîne **poolée** (port 6543) de Supabase
   - `DIRECT_URL` → collez la chaîne **directe** (port 5432) de Supabase
4. Laissez `CORS_ORIGIN` telle quelle pour l'instant, vous la corrigerez à l'étape 4.
5. Cliquez **Apply**. Render exécute `npm run render:build` (installe, génère le client Prisma, pousse le schéma vers Supabase avec `prisma db push`, compile TypeScript) puis démarre avec `npm run start`.
6. Notez l'URL générée, ex : `https://quincaillerie-pro-api.onrender.com`.

### Méthode manuelle (alternative)

Render Dashboard → **New** → **Web Service** → connectez le repo :
- **Root Directory** : `backend`
- **Build Command** : `npm run render:build`
- **Start Command** : `npm run start`
- **Environment Variables** :

| Clé | Valeur |
|---|---|
| `DATABASE_URL` | chaîne poolée Supabase (port 6543, avec `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | chaîne directe Supabase (port 5432) |
| `JWT_SECRET` | chaîne aléatoire longue (`openssl rand -base64 32`) |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | URL Vercel (à mettre à jour après l'étape 3) |
| `PORT` | `4000` |

### Charger les données de démonstration (optionnel)
Render Dashboard → votre service → **Shell** :
```bash
npm run render:seed
```

---

## Étape 3 — Déployer le frontend sur Vercel

1. https://vercel.com/new → importez le même repo GitHub.
2. **Root Directory** : `frontend` (Framework "Vite" détecté automatiquement, `vercel.json` gère déjà le build/output).
3. **Environment Variables** :

| Clé | Valeur |
|---|---|
| `VITE_API_URL` | `https://quincaillerie-pro-api.onrender.com/api` (votre URL Render + `/api`) |

4. **Deploy**. Notez l'URL Vercel, ex : `https://quincaillerie-pro.vercel.app`.

---

## Étape 4 — Reconnecter CORS

Retournez sur Render → votre service → **Environment** → mettez à jour `CORS_ORIGIN` avec l'URL Vercel exacte (sans slash final) → **Save, rebuild and deploy**.

---

## Vérification

1. Ouvrez l'URL Vercel, créez une entreprise ou connectez-vous avec un compte de démo (si seedé).
2. Vérifiez dans Supabase → **Table Editor** que les tables (`Company`, `User`, `Product`, etc.) sont bien créées.
3. Erreur CORS dans la console ? → `CORS_ORIGIN` sur Render ne correspond pas exactement à l'URL Vercel.
4. L'API ne répond pas immédiatement ? → le plan gratuit Render met le service en veille après 15 min d'inactivité (redémarrage en ~30-50s au premier appel).

## Notes importantes

- **Pourquoi deux URLs (`DATABASE_URL` / `DIRECT_URL`) ?** Le pooler Supabase (pgbouncer) ne supporte pas certaines commandes DDL utilisées par Prisma pour créer/modifier les tables. `directUrl` contourne le pooler uniquement pour ces opérations ; `url` (poolée) reste utilisée pour toutes les requêtes normales de l'application, ce qui évite d'épuiser les connexions PostgreSQL de Supabase.
- **Plan gratuit Supabase** : le projet est mis en pause après 7 jours d'inactivité totale (se réactive automatiquement au premier accès, avec un délai). Pour un usage commercial réel, passez au plan Pro (~25$/mois) pour éviter toute pause.
- **Sauvegardes** : Supabase Pro inclut des sauvegardes automatiques quotidiennes. En plan gratuit, exportez régulièrement via **Database → Backups** ou `pg_dump`.
- **Migrations futures** : `render:build` utilise `prisma db push` (synchronisation directe, pratique au départ). Pour un vrai flux de migrations versionnées sans perte de données : lancez `npx prisma migrate dev --schema=./prisma/schema.production.prisma` en local contre une base Supabase de test, committez le dossier `prisma/migrations`, puis remplacez `db push` par `prisma migrate deploy` dans `render:build`.
