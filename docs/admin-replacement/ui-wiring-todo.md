# UI wiring to-do

Elements of UI-only screen shells that render "—" or a disabled control
because the data or capability does not exist yet. One row per element.
These shells add no backend endpoint and no schema change.

Type: ENDPOINT = needs a new or extended endpoint; SCHEMA = needs a column
or table; DECISION = needs a product / domain / permission ruling first;
UI = needs a frontend change on a page outside this pass.

| Date | Screen | Element | Type | What is missing | Shown today |
|---|---|---|---|---|---|
| 2026-09-30 | /admin/etablissement-detail | "Comptes utilisateurs rattachés" — several accounts per establishment, "+ Ajouter un utilisateur" | DECISION | `Company.userId` is one-to-one; D5 rules out company-side roles and admin user creation. A multi-user model needs a decision | The single account + placeholder line; button disabled |
| 2026-09-30 | /admin/etablissement-detail | "Modifier le rôle" (Administrateur / Responsable / Comptable / Lecteur) in the account dialog | DECISION | D5: no company-side RBAC | Not rendered |
| 2026-09-30 | /admin/etablissement-detail | Addressing an establishment | ENDPOINT | No GET-by-id for companies; the page resolves `?id=<establishmentId>` through `GET /dsmo/companies?search=` with an exact match | Works for establishmentId only; lookup field when absent |
| 2026-09-30 | /admin/etablissement-detail | Entry point from the registry | UI | `/home/annuaire` rows do not link here; that page is out of scope for this pass | Reachable by URL / lookup field |
| 2026-09-30 | /admin/etablissement-detail | "Modifier" | ENDPOINT | No admin company-edit endpoint | Disabled |
| 2026-09-30 | /admin/etablissement-detail | Historique des soumissions (campagne, statut) | ENDPOINT | No endpoint lists one establishment's submissions (the dossier list search is fuzzy on the name) | Panel with reason |
| 2026-09-30 | /admin/etablissement-detail | Dernière connexion | ENDPOINT | `users.lastLoginAt` (B1) is not written at login and is classified secret | "—" |
| 2026-09-30 | /admin/etablissement-detail | Créé par / Méthode | ENDPOINT | `users.createdBy` / `registrationMethod` (B1) have no writer | "—" |
| 2026-09-30 | /admin/etablissement-detail | Dernière modification | SCHEMA | No `updatedBy` on Company | "—" |
| 2026-09-30 | /admin/etablissement-detail | Statut de vérification | DECISION | Depends on the registration-documents workflow | "—" |
| 2026-09-30 | /admin/etablissement-detail | Réinitialiser le mot de passe | ENDPOINT | `POST /auth/admin/reset-password` exists but the service throws "temporairement indisponible" | Disabled |
| 2026-09-30 | /admin/etablissement-detail | Déverrouiller le compte | ENDPOINT | `lockedUntil` exists, no unlock endpoint | Disabled |
| 2026-09-30 | /admin/etablissement-detail | Renvoyer l'e-mail de vérification | ENDPOINT | `/auth/resend-verification` is self-service only | Disabled |
| 2026-09-30 | /admin/etablissement-detail | Réinitialiser la session | DECISION | `tokenVersion` (B1) is not enforced; enforcing it changes JWT validation (auth review) | Disabled |
| 2026-09-30 | /admin/etablissement-detail | Historique des connexions récentes | SCHEMA | No login-history table or LOGIN audit events | "—" |
| 2026-09-30 | /admin/etablissement-detail | Désactiver / Supprimer for SUPER_ADMIN_ONEFOP / SUPER_ADMIN_DSMO | DECISION | `/auth/users/:id/*` on a COMPANY account is SUPER_ADMIN only (staff-scope.ts) | Disabled with reason |
| 2026-09-30 | /admin/etablissement-detail | Journal d'audit scoped to the establishment | ENDPOINT | Only rows whose `resourceId` is the account id are found; rows about the Company record itself are not linked | Latest 4 by account id (wired) |
| 2026-09-30 | /admin/etablissement-detail | Sidebar / breadcrumb context | DECISION | No `_routes.ts` entry for this route; out of bounds for this pass | Breadcrumb links back to /home/annuaire |
