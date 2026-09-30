# UI wiring to-do

Elements of UI-only screen shells that render "—" or a disabled control
because the data or capability does not exist yet. One row per element.
These shells add no backend endpoint and no schema change.

Type: ENDPOINT = needs a new or extended endpoint; SCHEMA = needs a column
or table; DECISION = needs a product / domain / permission ruling first.

| Date | Screen | Element | Type | What is missing | Shown today |
|---|---|---|---|---|---|
| 2026-09-30 | /admin/inscriptions | Whole queue for roles other than SUPER_ADMIN | DECISION | GET /auth/users lists COMPANY accounts for SUPER_ADMIN only; SUPER_ADMIN_ONEFOP is limited to ONEFOP staff and REGIONAL / DIVISIONAL cannot list (D3 grants them approve/reject only). Whether they review establishment registrations is a permission change | Info notice, empty table |
| 2026-09-30 | /admin/inscriptions | Rows at all | DECISION | POST /auth/register-company creates COMPANY accounts ACTIVE, so none is ever PENDING_APPROVAL; a registration review step is an auth-flow change | "Aucune inscription en attente" |
| 2026-09-30 | /admin/inscriptions | N° Inscription column | ENDPOINT | `users.registrationNumber` (B1) has no generator and is not returned by /auth/users | "—" |
| 2026-09-30 | /admin/inscriptions | Organisation and Type columns | ENDPOINT | /auth/users does not return the linked Company (name, entityType) | "—" (account e-mail shown under it) |
| 2026-09-30 | /admin/inscriptions | Documents column, "Documents fournis" in the review dialog | ENDPOINT | `registration_documents` (B1) has no read endpoint and no upload path; required documents per entity type need a ruling | "—" |
| 2026-09-30 | /admin/inscriptions | Assigné à column | ENDPOINT | `users.assigneeId` (B1) has no writer and is not returned | "—" |
| 2026-09-30 | /admin/inscriptions | Vérification states other than En attente (En vérification, Documents incomplets, Compléments demandés) | DECISION | B1 enum values exist, but no workflow sets them and login gating does not interpret them | Always "En attente"; statut filter disabled |
| 2026-09-30 | /admin/inscriptions | KPI Compléments demandés | DECISION | Depends on the complements workflow above | "—" |
| 2026-09-30 | /admin/inscriptions | KPI Approuvées / Rejetées ce trimestre | ENDPOINT | `users.approvedAt` has no writer; /auth/users has no date filter | "—" |
| 2026-09-30 | /admin/inscriptions | Type d'établissement and Date de soumission filters | ENDPOINT | /auth/users has no entity-type or created-date filter | Disabled |
| 2026-09-30 | /admin/inscriptions | "Relancer" and "Activer" row actions | ENDPOINT | No reminder endpoint (`lastReminderAt` has no writer); "Activer" duplicates approve | Not rendered; "Examiner" opens approve / reject |
| 2026-09-30 | /admin/inscriptions | Sidebar entry "Inscriptions" | DECISION | `_routes.ts` has `href: null`; wiring the link is a one-line change to a file this pass may not touch | Page reachable by URL only |
