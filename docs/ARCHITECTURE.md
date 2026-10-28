# Architecture technique

## Principes de conception

1. **Multi-tenant natif** : chaque table métier porte un `companyId`. Toutes les routes filtrent automatiquement par l'entreprise de l'utilisateur connecté (sauf le Super Admin, qui voit tout). Cela permet d'héberger plusieurs quincailleries clientes sur une seule instance du logiciel.
2. **Un fichier de routes par module** (`backend/src/routes/*.routes.ts`) — facile à localiser et à faire évoluer indépendamment.
3. **Validation systématique** avec Zod sur chaque endpoint qui reçoit des données.
4. **Transactions Prisma (`$transaction`)** pour toute opération touchant plusieurs tables en même temps (vente → stock + dette client ; achat → stock + dette fournisseur ; transfert → stock source + stock destination), garantissant la cohérence des données même en cas d'erreur.
5. **Frontend en couches** : `pages/` (une page = un module), `components/ui` (primitives réutilisables façon shadcn), `components/common` (patterns composés : PageHeader, EmptyState, StatCard, ConfirmDialog), `components/layout` (structure de l'application).
6. **État serveur géré par React Query**, état client léger (auth, thème) par Zustand — pas de Redux, volontairement simple.

## Modèle de données (extraits clés)

- `Company` → `Store[]` (dépôts) → `Stock[]` (quantité par produit et par dépôt)
- `Product` → prix multiples (achat, vente, grossiste, revendeur, promo), `Batch[]` (lots), `ProductVariant[]`, `ProductImage[]`
- `Sale` → `SaleItem[]` + `CustomerPayment[]` ; une vente décrémente le stock et peut créer une dette client si le montant payé est inférieur au total
- `Purchase` → `PurchaseItem[]` + `SupplierPayment[]` ; symétrique côté fournisseur
- `StockMovement` : journal complet de tous les mouvements (entrée, sortie, vente, achat, transfert, inventaire, dommage) pour traçabilité totale
- `AuditLog` et `Notification` : infrastructure prête pour la journalisation complète et les alertes temps réel

## Bordereau de livraison et reçu magasinier

À la validation d'une vente (`POST /api/sales`), la caisse obtient deux documents :

1. **Bordereau de livraison** : copie du client, avec les prix. Son numéro (`Sale.deliveryNumber`) est séquentiel par entreprise (compteur `Company.deliveryCounter`, incrémenté en base dans la transaction de la vente : deux ventes simultanées ne peuvent pas avoir le même numéro). La numérotation démarre à 1.
2. **Reçu magasinier** : sans aucun prix, avec un QR code (`QP1:` + code) et le code en clair, à présenter au magasinier.

**Code secret.** 16 caractères d'un alphabet de 32 symboles (80 bits d'aléa, `crypto.randomInt`), sans date d'expiration. Il n'est **jamais stocké** : la base ne contient que son empreinte SHA-256 (`Sale.pickupCodeHash`, unique), et l'API ne la renvoie jamais. Le code n'est renvoyé qu'une fois, dans la réponse de création de la vente, pour l'impression. Un reçu perdu se remplace avec `POST /api/sales/:id/pickup-code` : un nouveau code est généré et l'ancien cesse immédiatement de fonctionner.

**Remises (`/api/deliveries`).** Réservées au propriétaire, au gérant et au magasinier. `POST /lookup` et `POST /deliver` exigent le code (limite de 30 essais par minute et par IP) et ne renvoient jamais de prix. Une remise peut être partielle : `SaleItem.deliveredQty` cumule ce qui est parti, `Sale.deliveryStatus` passe de `EN_ATTENTE` à `PARTIELLE` puis `SERVIE`, et chaque remise est tracée (`Delivery` / `DeliveryLine` : qui, quand, quoi). Les mises à jour sont conditionnelles en base : deux magasiniers ne peuvent pas remettre deux fois la même quantité.

**Stock réservé.** À la vente, la quantité passe de `Stock.quantity` (disponible) à `Stock.reserved` : elle ne peut plus être vendue mais est encore physiquement au magasin. À chaque remise validée, la réservation est levée et un mouvement `LIVRAISON` enregistre la sortie physique. Une vente peut être annulée tant que rien n'a été remis (la réservation revient au disponible). Un inventaire compte disponible + réservé. Les ventes antérieures à cette fonction (`deliveryNumber` nul, statut `SERVIE`) gardent l'ancien comportement.

**QR code.** Généré côté navigateur par `frontend/src/lib/qr.ts` (SVG vectoriel, sans dépendance). La lecture se fait avec une douchette USB (le code est saisi suivi d'« Entrée »), la caméra (API `BarcodeDetector`, Chrome/Edge/Android) ou à la main.

## Pourquoi SQLite + Prisma ?

- **SQLite** : zéro administration, un seul fichier à sauvegarder, largement suffisant en performance pour une quincaillerie (même avec plusieurs caisses simultanées grâce au mode WAL de SQLite).
- **Prisma** : migrations versionnées, client TypeScript généré automatiquement (sécurité de type de bout en bout entre le schéma et le code), et migration facilitée vers PostgreSQL si l'entreprise grandit (changement de `provider` uniquement, code métier inchangé).

## Sécurité

- Mots de passe hachés avec bcrypt (10 rounds)
- JWT signé côté serveur, vérifié sur chaque route protégée (`requireAuth`)
- Permissions par rôle vérifiées côté serveur (`requireRole(...)`), jamais seulement côté interface
- Isolation stricte des données entre entreprises (`requireCompany` + filtrage automatique par `companyId`)
- Rate limiting sur l'API (1000 req / 15 min / IP par défaut, ajustable)
- Helmet pour les en-têtes HTTP de sécurité

## Limites connues de cette livraison

- Les notifications sont en polling (rafraîchissement toutes les 30s), pas en temps réel — Socket.IO n'a pas été jugé nécessaire pour le volume d'une quincaillerie type, mais peut être ajouté sur `notification.routes.ts` sans changement de schéma.
- L'export PDF utilise l'impression navigateur (Ctrl+P → Enregistrer en PDF) plutôt qu'une génération serveur — fonctionnel mais moins raffiné qu'un PDF généré sur mesure.
- L'export Excel génère un CSV (compatible Excel/Google Sheets) plutôt qu'un `.xlsx` natif avec mise en forme.
