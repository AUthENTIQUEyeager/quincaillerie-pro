# Déploiement de Quincaillerie Pro

Le projet est volontairement conçu autour de SQLite pour rester **simple à héberger** : pas de serveur de base de données séparé à gérer, un seul fichier `.db` à sauvegarder.

## Option recommandée : un seul VPS (le plus simple)

Convient à la grande majorité des quincailleries (1 à quelques dizaines d'utilisateurs simultanés).

### Prérequis sur le serveur
- Ubuntu 22.04 ou supérieur
- Node.js 18+
- Nginx (reverse proxy)
- PM2 (gestionnaire de processus Node)

### Étapes

```bash
# 1. Installer Node.js et PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2

# 2. Déployer le backend
cd /var/www/quincaillerie-pro/backend
npm install --production
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 start dist/server.js --name quincaillerie-api
pm2 save
pm2 startup

# 3. Construire le frontend
cd /var/www/quincaillerie-pro/frontend
npm install
npm run build
# Le dossier dist/ contient les fichiers statiques prêts à servir
```

### Configuration Nginx

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Frontend (fichiers statiques)
    root /var/www/quincaillerie-pro/frontend/dist;
    index index.html;
    location / {
        try_files $uri /index.html;
    }

    # API backend
    location /api {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Activez HTTPS gratuitement avec Certbot :
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

## Variables d'environnement en production

Dans `backend/.env` :
```
DATABASE_URL="file:./prod.db"
JWT_SECRET="<générez une chaîne aléatoire longue et unique>"
JWT_EXPIRES_IN="7d"
PORT=4000
CORS_ORIGIN="https://votre-domaine.com"
NODE_ENV=production
```

## Sauvegardes

SQLite étant un fichier unique (`backend/prisma/prod.db`), une sauvegarde régulière suffit :

```bash
# Exemple de cron quotidien
0 2 * * * cp /var/www/quincaillerie-pro/backend/prisma/prod.db /backups/quincaillerie-$(date +\%F).db
```

## Alternative : hébergement mutualisé Node.js

Fonctionne également sur des plateformes gérées type Railway, Render, ou VPS OVH/Contabo avec un panneau type CyberPanel — tant que Node.js 18+ et l'écriture de fichiers (pour SQLite) sont disponibles.

## Alternative future : PostgreSQL

Si votre quincaillerie grandit fortement (plusieurs dizaines de caisses simultanées), Prisma permet de migrer vers PostgreSQL en changeant simplement `provider` et `DATABASE_URL` dans `schema.prisma`, sans réécrire le code métier.
