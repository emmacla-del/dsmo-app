# UI wiring to-do

Elements of UI-only screen shells that render "—" or a disabled control
because the data or capability does not exist yet. One row per element.
These shells add no backend endpoint and no schema change.

Type: ENDPOINT = needs a new or extended endpoint; SCHEMA = needs a column
or table; DECISION = needs a product / domain / permission ruling first.

| Date | Screen | Element | Type | What is missing | Shown today |
|---|---|---|---|---|---|
| 2026-09-30 | /admin/centre-qualite | KPI Complétude | DECISION | No definition of the completeness rate and no stored measure (computation over the canonical schema or a new column) | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | KPI Cohérence | DECISION | Coherence checks are advisory and client-side (§7); `OnefopSubmission.flags` is not an aggregate. Rate definition needed | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | KPI Taux d'anomalies / Avertissements | ENDPOINT | No aggregate over `onefop_anomalies` per declaration (blocking vs warning) | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | KPI Éligibilité statistique | ENDPOINT | The eligibility engine answers per dossier (`/diagnostic`); no rate endpoint | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | Anomalies par type (occurrences, % du total, tendance) | ENDPOINT | `GET /admin/questionnaires/anomalies/registry` lists; no group-by `ruleCode` / `ruleFamily`, no trend window | Panel with reason |
| 2026-09-30 | /admin/centre-qualite | Anomalies par région (déclarations, anomalies, taux) | ENDPOINT | No per-region aggregate | Panel with reason |
| 2026-09-30 | /admin/centre-qualite | Region Statut bands (Critique / Élevé / Modéré / Acceptable / Bon) | DECISION | Thresholds are undefined; storing them is a config table that needs a domain ruling | Not shown |
| 2026-09-30 | /admin/centre-qualite | Contrôles récents: "Contrôle automatique terminé — Lot #847" entries | SCHEMA | No control-run table; the feed shows the latest anomalies only | Latest 5 anomalies (wired) |
| 2026-09-30 | /admin/centre-qualite | Règles de validation list with Actif / Désactivé | DECISION | No rules table; toggling a rule changes validation semantics (§21). D6 only settles who (SUPER_ADMIN*) | Panel with reason |
| 2026-09-30 | /admin/centre-qualite | "Gérer les règles de validation →" | DECISION | Same as above | Disabled |
| 2026-09-30 | /admin/centre-qualite | Recent feed for roles outside AdminQuestionnairesController @Roles (e.g. DATA_MANAGER, ANALYST, AUDITOR) | DECISION | Registry is SUPER_ADMIN / SUPER_ADMIN_ONEFOP / CENTRAL / REGIONAL / DIVISIONAL | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | Sidebar entries "Anomalies" / "Qualité" | DECISION | `_routes.ts` has `href: null`; out of bounds for this pass | Page reachable by URL only |
| 2026-09-30 | /admin/inscriptions | Whole queue for roles other than SUPER_ADMIN | DECISION | GET /auth/users lists COMPANY accounts for SUPER_ADMIN only; SUPER_ADMIN_ONEFOP is limited to ONEFOP staff and REGIONAL / DIVISIONAL cannot list (D3 grants them approve/reject only). Whether they review establishment registrations is a permission change | Info notice, empty table |
| 2026-09-30 | /admin/inscriptions | Rows at all | DECISION | POST /auth/register-company creates COMPANY accounts ACTIVE, so none is ever PENDING_APPROVAL; a registration review step is an auth-flow change | "Aucune inscription en attente" |
| 2026-09-30 | /admin/inscriptions | N° Inscription column | ENDPOINT | `users.registrationNumber` (B1) has no generator and is not returned by /auth/users | "—" |
| 2026-09-30 | /admin/inscriptions | Organisation and Type columns | ENDPOINT | /auth/users does not return the linked Company (name, entityType) | "—" (account e-mail shown under it) |
| 2026-09-30 | /admin/inscriptions | ~~Documents column, "Documents fournis" in the review dialog~~ | ENDPOINT | Won't do — feature retired (2026-10-06; see `docs/audit/documents-removal-plan-2026-10-06.md`) | Removed |
| 2026-09-30 | /admin/inscriptions | Assigné à column | ENDPOINT | `users.assigneeId` (B1) has no writer and is not returned | "—" |
| 2026-09-30 | /admin/inscriptions | Vérification states other than En attente (En vérification, Documents incomplets, Compléments demandés) | DECISION | B1 enum values exist, but no workflow sets them and login gating does not interpret them | Always "En attente"; statut filter disabled |
| 2026-09-30 | /admin/inscriptions | KPI Compléments demandés | DECISION | Depends on the complements workflow above | "—" |
| 2026-09-30 | /admin/inscriptions | KPI Approuvées / Rejetées ce trimestre | ENDPOINT | `users.approvedAt` has no writer; /auth/users has no date filter | "—" |
| 2026-09-30 | /admin/inscriptions | Type d'établissement and Date de soumission filters | ENDPOINT | /auth/users has no entity-type or created-date filter | Disabled |
| 2026-09-30 | /admin/inscriptions | "Relancer" and "Activer" row actions | ENDPOINT | No reminder endpoint (`lastReminderAt` has no writer); "Activer" duplicates approve | Not rendered; "Examiner" opens approve / reject |
| 2026-09-30 | /admin/inscriptions | Sidebar entry "Inscriptions" | DECISION | `_routes.ts` has `href: null`; wiring the link is a one-line change to a file this pass may not touch | Page reachable by URL only |
or table; DECISION = needs a product / domain / permission ruling first;
UI = needs a frontend change on a page outside this pass.

| Date | Screen | Element | Type | What is missing | Shown today |
|---|---|---|---|---|---|
| 2026-09-30 | /admin/questionnaires | "Aperçu" — canonical AST viewer | DECISION | No viewer exists; what it shows (sections, questions, tables, gateways) and whether it reads onefop.schema.json or the AST needs a model decision | Disabled button + placeholder panel |
| 2026-09-30 | /admin/questionnaires | "+ Nouveau questionnaire" | DECISION | Questionnaire structure belongs to `onefop_ast.dart` (§3, §21), not to the console | Disabled |
| 2026-09-30 | /admin/questionnaires | "Actif" status pill | DECISION | Questionnaire status is not modelled anywhere (AST or DB) | "Statut —" |
| 2026-09-30 | /admin/questionnaires | Taux de complétion | DECISION | No definition of completion per questionnaire type, and no data | "—" |
| 2026-09-30 | /admin/questionnaires | ASFOP (Recensement) card | DECISION | Not an `OnefopEntityType` value; adding one is a questionnaire-structure change (§21) | Not rendered; the seven existing types are shown |
| 2026-09-30 | /admin/questionnaires | "Voir soumissions" filtered by type | UI | `/admin/dossiers` reads only `?status=` from the URL, not `?formType=`; that page is out of scope for this pass | Links to the unfiltered `/admin/dossiers` |
| 2026-09-30 | /admin/questionnaires | Total soumissions for roles outside AdminQuestionnairesController @Roles | DECISION | GET /admin/questionnaires is SUPER_ADMIN / SUPER_ADMIN_ONEFOP / CENTRAL / REGIONAL / DIVISIONAL | "—" |
| 2026-09-30 | /admin/questionnaires | Sidebar entry "Questionnaires" | DECISION | `_routes.ts` has `href: null`; out of bounds for this pass | Page reachable by URL only |
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
| 2026-09-30 | /admin/etablissement-detail/approbation | Any pending establishment to decide on | DECISION | `register-company` creates COMPANY accounts ACTIVE; a review step is an auth-flow change | Decision controls disabled: "Ce compte n'est pas en attente d'approbation" |
| 2026-09-30 | /admin/etablissement-detail/approbation | "Demander des compléments" | DECISION | No complements workflow; `UserStatus.COMPLEMENTS_REQUESTED` (B1) has no writer and login gating ignores it | Disabled radio |
| 2026-09-30 | /admin/etablissement-detail/approbation | "Motif ou commentaire" persisted | ENDPOINT | `PATCH /auth/reject-user/:id` accepts `reason` but the service drops it; `users.approvalComment` (B1) has no writer | Sent, with a note that the server does not store it |
| 2026-09-30 | /admin/etablissement-detail/approbation | "Cette action génère une entrée d'audit ACCOUNT_VALIDATION" | ENDPOINT | approve-user / reject-user write no audit row | Not claimed on the page |
| 2026-09-30 | /admin/etablissement-detail/approbation | ~~Documents fournis with per-document state~~ | ENDPOINT | Won't do — feature retired (2026-10-06; see `docs/audit/documents-removal-plan-2026-10-06.md`). The page itself is retired | Removed |
| 2026-09-30 | /admin/etablissement-detail/approbation | Créé par (Auto-inscription) | ENDPOINT | `users.registrationMethod` (B1) has no writer | "—" |
| 2026-09-30 | /admin/etablissement-detail/approbation | Decision for SUPER_ADMIN_ONEFOP / REGIONAL / DIVISIONAL (D3) | DECISION | `assertCanApproveRegistration` limits every role but SUPER_ADMIN to ONEFOP staff targets | Disabled with reason |
| 2026-09-30 | /admin/etablissement-detail/approbation | "ASFOP" type pill | DECISION | Not an `OnefopEntityType` | Existing type label |
| 2026-09-30 | /admin/etablissement-detail/approbation | Modal presentation over the detail page | UI | The frame is a modal on `/admin/etablissement-detail`; this pass ships it as its own route | Full page, back arrow to the detail |
