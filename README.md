# Quincaillerie Pro

Logiciel de gestion commerciale complet pour quincailleries — catalogue, stock multi-dépôts, ventes, achats, finance, comptabilité, équipe, et console Super Admin multi-entreprises (SaaS).

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui (Radix) |
| Backend | Node.js + Express + TypeScript |
| Base de données | SQLite + Prisma ORM |
| Authentification | JWT (JSON Web Token) |
| API | REST |

## Structure du projet

```
quincaillerie-pro/
├── backend/          API REST (Express + Prisma + SQLite)
│   ├── prisma/        schema.prisma, seed.ts
│   └── src/
│       ├── routes/     un fichier de routes par module métier
│       ├── middleware/ auth (JWT + rôles), gestion d'erreurs
│       ├── lib/         prisma client, jwt, notifications
│       └── utils/       fabrique CRUD générique
├── frontend/         Application React (Vite)
│   └── src/
│       ├── components/ ui/ (primitives shadcn), layout/, common/
│       ├── pages/       une page par module
│       ├── store/        zustand (auth, thème)
│       ├── lib/          axios, utilitaires
│       └── types/        types partagés
├── shared/           (réservé aux types partagés futurs backend/frontend)
└── docs/             documentation technique et de déploiement
```

## Démarrage rapide (développement local)

Prérequis : Node.js 18+, npm.

### 1. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed        # crée des données de démonstration + comptes de test
npm run dev          # démarre l'API sur http://localhost:4000
```

> **Important** : `npx prisma generate` et `npx prisma migrate dev` téléchargent les moteurs binaires de Prisma depuis internet (`binaries.prisma.sh`). Assurez-vous d'avoir un accès internet normal (pas de pare-feu bloquant ce domaine) lors du premier `npm install`.

Comptes créés par le script de seed :

| Rôle | Email | Mot de passe |
|---|---|---|
| Super Admin | superadmin@authentique-studio.com | SuperAdmin@2026 |
| Propriétaire | proprietaire@quincaillerie.demo | Proprietaire@2026 |
| Caissier | caissier@quincaillerie.demo | Caissier@2026 |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # démarre l'interface sur http://localhost:5173
```

Le frontend proxifie automatiquement `/api` vers `http://localhost:4000` (voir `vite.config.ts`).

Ouvrez http://localhost:5173, connectez-vous avec un des comptes ci-dessus, ou créez votre propre entreprise via "Créer un compte".

## Modules livrés (Phase 1 — fonctionnels de bout en bout)

- **Authentification** : connexion JWT, inscription libre-service d'une nouvelle entreprise (multi-tenant), rôles et permissions
- **Dashboard** : chiffre d'affaires, bénéfice, ventes du jour/mois, alertes de stock, dettes clients/fournisseurs, top produits, graphique des ventes
- **Produits** : fiche complète (SKU, code-barres, prix multiples, TVA, stock min/max, catégorie/sous-catégorie/marque/fournisseur, lots)
- **Catégories, sous-catégories, marques**
- **Fournisseurs & Clients** : historique, dettes, paiements
- **Dépôts** : magasin principal + dépôts secondaires, stock indépendant par dépôt
- **Stock** : niveaux par dépôt, mouvements manuels (entrée/sortie/correction/dommage), historique complet
- **Transferts** entre dépôts
- **Inventaires** : comptage physique et ajustement automatique des écarts
- **Ventes** : vente rapide (POS), devis, reçu imprimable, annulation avec restitution de stock, paiement espèces/mobile money/carte/virement/mixte
- **Achats** : réception de marchandises avec mise à jour automatique du stock et des dettes fournisseurs
- **Commandes** clients et fournisseurs avec suivi de statut
- **Dépenses** : salaires, transport, électricité, internet, loyer, impôts, divers
- **Comptabilité** : recettes/dépenses/bénéfices, export CSV (compatible Excel), export PDF (impression)
- **Employés** et **Utilisateurs** (comptes de connexion + rôles : Propriétaire, Gérant, Caissier, Magasinier, Comptable, Livreur)
- **Notifications** internes (nouvelle vente, achat, retour, stock faible...)
- **Paramètres** entreprise (nom, logo, devise, téléphone)
- **Console Super Admin** (Authentique-Studio) : gestion des entreprises clientes, utilisateurs globaux, réinitialisation de mots de passe, connexions, journaux d'audit, statistiques globales
- **Mode clair / sombre**, interface 100% responsive

## Roadmap (Phase 2 — non incluse dans cette livraison)

Le schéma de base de données est déjà prêt pour ces fonctionnalités (modèles Prisma existants) ; il reste à câbler les écrans/endpoints avancés :

- Variantes produits et numéros de série en interface (le backend les supporte déjà)
- Notifications temps réel via Socket.IO (actuellement en polling REST)
- Génération réelle de QR codes / codes-barres et scan caméra
- Export PDF natif (actuellement via impression navigateur) et Excel natif (.xlsx, actuellement CSV)
- Tableaux comparatifs multi-magasins avancés sur le dashboard
- Journal d'audit détaillé par action (structure déjà en base)

## Sécurité

- Mots de passe hachés avec bcrypt
- Authentification JWT avec expiration configurable
- Permissions par rôle vérifiées côté serveur sur chaque route sensible
- Toutes les requêtes sont automatiquement filtrées par entreprise (isolation multi-tenant)
- Validation stricte des données d'entrée avec Zod sur chaque endpoint

## Documentation complémentaire

Voir le dossier [`docs/`](./docs) :
- [`docs/DEPLOIEMENT.md`](./docs/DEPLOIEMENT.md) — déployer en production simplement
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — détails techniques et choix de conception
