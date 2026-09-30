# UI wiring to-do

Elements of UI-only screen shells that render "—" or a disabled control
because the data or capability does not exist yet. One row per element.
These shells add no backend endpoint and no schema change.

Type: ENDPOINT = needs a new or extended endpoint; SCHEMA = needs a column
or table; DECISION = needs a product / domain / permission ruling first;
UI = needs a frontend change on a page outside this pass.

| Date | Screen | Element | Type | What is missing | Shown today |
|---|---|---|---|---|---|
| 2026-09-30 | /admin/etablissement-detail/approbation | Any pending establishment to decide on | DECISION | `register-company` creates COMPANY accounts ACTIVE; a review step is an auth-flow change | Decision controls disabled: "Ce compte n'est pas en attente d'approbation" |
| 2026-09-30 | /admin/etablissement-detail/approbation | "Demander des compléments" | DECISION | No complements workflow; `UserStatus.COMPLEMENTS_REQUESTED` (B1) has no writer and login gating ignores it | Disabled radio |
| 2026-09-30 | /admin/etablissement-detail/approbation | "Motif ou commentaire" persisted | ENDPOINT | `PATCH /auth/reject-user/:id` accepts `reason` but the service drops it; `users.approvalComment` (B1) has no writer | Sent, with a note that the server does not store it |
| 2026-09-30 | /admin/etablissement-detail/approbation | "Cette action génère une entrée d'audit ACCOUNT_VALIDATION" | ENDPOINT | approve-user / reject-user write no audit row | Not claimed on the page |
| 2026-09-30 | /admin/etablissement-detail/approbation | Documents fournis with per-document state | ENDPOINT | `registration_documents` (B1) has no read endpoint; required documents per type need a ruling | "—" |
| 2026-09-30 | /admin/etablissement-detail/approbation | Créé par (Auto-inscription) | ENDPOINT | `users.registrationMethod` (B1) has no writer | "—" |
| 2026-09-30 | /admin/etablissement-detail/approbation | Decision for SUPER_ADMIN_ONEFOP / REGIONAL / DIVISIONAL (D3) | DECISION | `assertCanApproveRegistration` limits every role but SUPER_ADMIN to ONEFOP staff targets | Disabled with reason |
| 2026-09-30 | /admin/etablissement-detail/approbation | "ASFOP" type pill | DECISION | Not an `OnefopEntityType` | Existing type label |
| 2026-09-30 | /admin/etablissement-detail/approbation | Modal presentation over the detail page | UI | The frame is a modal on `/admin/etablissement-detail`; this pass ships it as its own route | Full page, back arrow to the detail |
