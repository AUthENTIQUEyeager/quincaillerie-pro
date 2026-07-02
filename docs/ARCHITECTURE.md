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
