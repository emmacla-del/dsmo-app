# Admin Console — Feature Matrix

> Reconnaissance date: 2026-09-29
> Screens: 10 | Capabilities: 34 | Backend endpoints: 38

---

## Summary of risks

- **Bulk-visa transaction** (`POST /admin/questionnaires/bulk-visa`): the certified-checkbox flow + server-side preflight is safety-critical; losing the certification step or audit log (`AUDIT_BULK_VISA_GRANTED`) would break legal compliance.
- **Anomaly resolution** (`PATCH /admin/questionnaires/anomalies/:id/resolve`): three resolution types + evidence URL + minimum-length justification must be preserved; "LEGAL_DEROGATION" is Central-only by policy even if the backend does not yet gate it by sub-role.
- **3-Axis dossier diagnostic** (`GET /admin/questionnaires/:id/diagnostic`): Axis 1 (visa status), Axis 2 (blocking/warning anomalies), Axis 3 (eligibility) are the canonical truth for "is this dossier ready to export"; losing any axis would corrupt the diffusion pipeline.
- **Territory isolation** (`territoryFromUser`): every admin endpoint scopes queries by the calling user's region/department; the frontend must not pass a broader scope than the server enforces.
- **SPSS / Excel export** (`POST /data-management/export/submissions/spss/sav`, `/excel`): official statistical dissemination — loss of filter parameters (region, department, entityType, statuses, year) would silently change the scope of exported data.
- **Campaign lifecycle** (`POST /campaigns/:id/activate|pause|close`): activating a campaign opens SubmissionRounds that control whether the declaration wizard accepts submissions; changes here affect the whole declaration system.
- **User management actions** (approve, role-change, suspend, delete via `/auth/users/*`): role changes are a privilege-escalation vector; delete is hard and irreversible (backend returns 409 if linked data exists, which the frontend surfaces).
- **Diffusion KPI tiles** on `/admin/diffusion` show hardcoded "—" values; the backend endpoint for real counts is not yet wired (`GET /data-management/stats` exists but is unused by this page).
- **Export history table** on `/admin/diffusion` is entirely mocked with hardcoded rows — no endpoint is called.
- **Dossier detail "Rejeter" and "Valider et Archiver" buttons** are rendered but have no `onClick` wired to the backend (`PATCH /admin/questionnaires/:id/reject` and `PATCH /admin/questionnaires/:id/approve` exist but are unused from this page).
- **Unused backend endpoints** on `AdminQuestionnairesController`: `GET /admin/questionnaires/pending`, `GET /admin/questionnaires/correction-requested`, `GET /admin/questionnaires/:id` (single-dossier GET) are all exposed but have no frontend caller.

---

## Screen inventory

---

### Admin Layout — `/admin/*` (shared chrome)

**Sidebar section:** N/A (wraps all admin screens)
**Role gate:** SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, CENTRAL, REGIONAL, DIVISIONAL, DATA_MANAGER, CAMPAIGN_MANAGER, ANALYST, AUDITOR (via `useAdminScreenGuard(ADMIN_ROLES)`)
**Classification:** KEEP

#### Tables
None directly in layout.

#### Filters / search
None.

#### Actions
| Label | What it does | Backend endpoint | Endpoint roles |
|---|---|---|---|
| Mobile menu toggle | Opens/closes off-canvas sidebar drawer | — | — |

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| GET | /admin/questionnaires/pilotage/queues | `AdminQuestionnairesController.getQueues` | CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP | Yes (`admin-questionnaires.controller.spec.ts`) |

The layout fetches `getPilotageQueues` every 30 s to drive the "Dossiers en instance" badge on the sidebar.

#### Test coverage
- Frontend: No test file for layout.
- Backend: `src/questionnaires/admin-questionnaires.controller.spec.ts` exists.

---

### Tableau de bord — `/admin/pilotage`

**Sidebar section:** SUPERVISION
**Role gate:** All admin roles (inherited from layout)
**Classification:** CHANGE (several data gaps documented in inline TODO comments)

#### Tables
| Column | Sortable | Notes |
|---|---|---|
| Couverture Régionale: Région | No | 10 Cameroon regions, sorted by submission count desc |
| Couverture Régionale: Soumissions | No | Count from `queues.regionCounts` |
| Activité Récente: timestamp / company name / status / region | No | Timeline list, up to 8 most-recent submissions |

#### Filters / search
None.

#### Actions
| Label | What it does | Backend endpoint | Endpoint roles |
|---|---|---|---|
| "Voir les détails de la campagne →" | Links to `/admin/campagnes` | — | — |
| KpiTile "Inscriptions en attente" | Planned — value is `null` today | None (TODO) | — |
| KpiTile "Déclarations à examiner" | Links to `/admin/files-attente?tab=visas` | — | — |
| KpiTile "Retours à corriger" | Links to `/admin/files-attente?tab=corrections` | — | — |
| KpiTile "Alertes qualité" | Links to `/admin/files-attente?tab=anomalies` | — | — |
| "Voir tous les dossiers →" | Links to `/admin/dossiers` | — | — |

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| GET | /admin/questionnaires/pilotage/queues | `getQueues` | CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP | Yes |
| GET | /admin/questionnaires?limit=8&offset=0 | `getAll` | Same | Yes |
| GET | /campaigns (active campaign) | `CampaignController.findAll` | SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, CENTRAL, REGIONAL | Yes (`campaign-period.helper.spec.ts` — service spec, not controller) |

#### Test coverage
- Frontend: None.
- Backend: `admin-questionnaires.controller.spec.ts`, `eligibility-engine.service.spec.ts`.

**Missing data per inline TODOs:**
- `inscriptionsPending` is always `null` — no `/admin/inscriptions/count` endpoint.
- `RegionalCoverage` is missing completion %, QC rate, anomaly rate.
- `DataQuality` shows only `eligibilityPct`; no Complétude, Cohérence or Anomalies rates.
- `RecentActivity` "Voir tout le journal" links to `/admin/journal-audit` which does not exist.
- Pipeline "Inscriptions" stage has no data source.

---

### Dossiers en instance — `/admin/files-attente`

**Sidebar section:** SUPERVISION
**Role gate:** All admin roles (inherited from layout)
**Classification:** KEEP

#### Tables
| Column | Sortable | Notes |
|---|---|---|
| Règle (ruleCode + ruleFamily) | No | Anomalies registry |
| Établissement (name + region + submissionId) | No | |
| Description | No | |
| Observé / attendu (observedValue, expectedValue, deltaValue) | No | |
| Action | No | "Résoudre" button |

Anomalies tab only — Visas tab and Corrections tab redirect to `/admin/dossiers` with a status filter.

#### Filters / search
- Tab switch: Anomalies bloquantes / Visas en instance / Corrections demandées
- Deep-link support: `?tab=visas|corrections` from dashboard

#### Actions
| Label | What it does | Backend endpoint | Endpoint roles |
|---|---|---|---|
| "Résoudre" (per anomaly row) | Opens resolution modal | PATCH /admin/questionnaires/anomalies/:id/resolve | CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP |
| "Confirmer la résolution" (modal submit) | Submits resolution with type, note, optional evidence URL | Same | Same |
| "Instruire les dossiers en attente de visa →" | Links to `/admin/dossiers?status=PENDING_REVIEW` | — | — |
| "Voir les dossiers en correction →" | Links to `/admin/dossiers?status=CORRECTION_REQUESTED` | — | — |

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| GET | /admin/questionnaires/pilotage/queues | `getQueues` | CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP | Yes |
| GET | /admin/questionnaires/anomalies/registry?status=OPEN&isBlocking=true | `listAnomalies` | Same | Yes |
| PATCH | /admin/questionnaires/anomalies/:id/resolve | `resolveAnomaly` | Same | Yes |

#### Test coverage
- Frontend: None.
- Backend: `admin-questionnaires.controller.spec.ts`, `eligibility-engine.service.spec.ts`.

---

### Instruction et visas (Dossier list) — `/admin/dossiers`

**Sidebar section:** CONTRÔLE QUALITÉ
**Role gate:** All admin roles (inherited from layout)
**Classification:** CHANGE (bulk reject and CSV/Excel export are disabled "ROUND 2")

#### Tables
| Column | Sortable | Notes |
|---|---|---|
| Checkbox | — | Per-row and select-all |
| ID Fiche (submissionId) | No | Links to `/admin/dossiers/[id]` |
| Répondant | No | |
| Structure (companyName) | No | Multi-table name resolution (enterprise/cooperative/ong/administration/project/vt/rawData) |
| Type | No | Via `entityTypeLabel` |
| Région + Département | No | |
| Visa administratif (adminStatus badge) | No | PENDING_REVIEW / APPROVED / CORRECTION_REQUESTED / REJECTED |
| Qualité données (blocking/warning anomaly count badge) | No | |
| Éligibilité (APPROVED + no blocking = Diffusable) | No | |
| Reçu le | No | |

Pagination: 10 per page, server-side.

#### Filters / search
- Type de questionnaire (7 types + all)
- Région (10 regions + all)
- Statut (4 statuses + all)
- Période (7d / 30d / 3m / 12m / all)
- Recherche libre (debounced 300 ms, searches ID + respondent + structure)
- Reset all filters button
- Deep-link: `?status=PENDING_REVIEW|CORRECTION_REQUESTED` from files-attente

#### Actions
| Label | What it does | Backend endpoint | Endpoint roles |
|---|---|---|---|
| "Viser la sélection" | Opens bulk visa modal for selected PENDING_REVIEW rows with no blocking anomaly | POST /admin/questionnaires/bulk-visa | CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP |
| "Rejeter la sélection" | Disabled (ROUND 2 — no backend) | None | — |
| "Exporter (CSV/Excel)" | Disabled (ROUND 2 — no backend) | None | — |
| "Confirmer N visas" (modal) | Executes bulk visa with certified checkbox | Same as above | Same |

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| GET | /admin/questionnaires?status=…&formType=…&period=…&region=…&search=…&limit=10&offset=N | `getAll` | CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP | Yes |
| POST | /admin/questionnaires/bulk-visa | `bulkVisa` | Same | Yes |

#### Test coverage
- Frontend: None.
- Backend: `admin-questionnaires.controller.spec.ts`, `eligibility-engine.service.spec.ts`.

---

### Détail du dossier — `/admin/dossiers/[id]`

**Sidebar section:** CONTRÔLE QUALITÉ (breadcrumb: Contrôle qualité › Visas & décisions › Détail du dossier)
**Role gate:** All admin roles (inherited from layout)
**Classification:** CHANGE (Rejeter and Valider buttons have no onClick wired; no individual approve/reject/request-correction actions implemented in UI)

#### Tables
None — diagnostic panels and anomaly lists.

#### Filters / search
None.

#### Actions
| Label | What it does | Backend endpoint | Endpoint roles |
|---|---|---|---|
| "← Retour aux dossiers" | Navigates back | — | — |
| "Rejeter la Fiche" | Button rendered but no onClick — not wired | PATCH /admin/questionnaires/:id/reject (exists, unused here) | CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP |
| "Valider et Archiver" | Button rendered but no onClick — not wired | PATCH /admin/questionnaires/:id/approve (exists, unused here) | Same |

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| GET | /admin/questionnaires/:id/diagnostic | `getDiagnostic` | CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP | Yes |

Shows 3-axis diagnostic: Axis 1 = visa status, Axis 2 = blocking/warning anomaly counts, Axis 3 = READY/PENDING eligibility + exclusion reason. Lists all blocking anomalies (ruleCode, description, observed/expected), then warning anomalies.

#### Test coverage
- Frontend: None.
- Backend: `admin-questionnaires.controller.spec.ts`, `eligibility-engine.service.spec.ts`.

---

### Gestion des campagnes — `/admin/campagnes`

**Sidebar section:** COLLECTE
**Role gate:** SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, CENTRAL, REGIONAL, CAMPAIGN_MANAGER (own `useAdminScreenGuard` call, stricter than layout)
**Classification:** KEEP

#### Tables
| Column | Sortable | Notes |
|---|---|---|
| Nom de la campagne + description | No | |
| Code | No | |
| Type (collectionType / type) | No | |
| Ouverture | No | |
| Clôture (extendedDeadline ?? deadline) | No | Extension indicator if prorogued |
| Statut (DRAFT/ACTIVE/PAUSED/CLOSED/ARCHIVED) | No | |
| Actions | No | Activate or Rappel button per row |

#### Filters / search
None — full history, no filter.

#### Actions
| Label | What it does | Backend endpoint | Endpoint roles |
|---|---|---|---|
| "Envoyer un rappel" (banner or row) | Opens reminder modal | POST /campaigns/:id/remind | SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, CENTRAL |
| "Mettre en pause" | Pauses the active campaign | POST /campaigns/:id/pause | Same |
| "Clôturer" (banner) | window.confirm then closes campaign | POST /campaigns/:id/close | Same |
| "Activer" (table row) | Activates a DRAFT/PAUSED campaign | POST /campaigns/:id/activate | Same |
| "Rappel" (table row) | Opens reminder modal for that campaign | POST /campaigns/:id/remind | Same |

Note: campaign creation is done from the Flutter console, not from this screen.

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| GET | /campaigns | `CampaignController.findAll` | SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, CENTRAL, REGIONAL | No controller spec (helper spec exists) |
| POST | /campaigns/:id/activate | `CampaignController.activate` | SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, CENTRAL | No controller spec |
| POST | /campaigns/:id/pause | `CampaignController.pause` | Same | No controller spec |
| POST | /campaigns/:id/close | `CampaignController.close` | Same | No controller spec |
| POST | /campaigns/:id/remind | `CampaignController.sendReminder` | Same | No controller spec |

#### Test coverage
- Frontend: None.
- Backend: `campaign-period.helper.spec.ts` (period helper only, not the controller).

---

### Paramètres — `/admin/parametres`

**Sidebar section:** ADMINISTRATION
**Role gate:** SUPER_ADMIN, SUPER_ADMIN_ONEFOP, SUPER_ADMIN_DSMO (own guard, most restrictive of all screens)
**Classification:** KEEP (read-only reference display, no mutations)

#### Tables
None — key-value display only.

#### Filters / search
None — tab bar: Plateforme / Sécurité / Notifications / Intégration.

#### Actions
None. All content is read-only static display.

#### Backend endpoints
None — no API calls. All content is hardcoded or derived from runtime values.

#### Test coverage
None.

---

### Agents ONEFOP — `/admin/utilisateurs`

**Sidebar section:** ADMINISTRATION
**Role gate:** SUPER_ADMIN, SUPER_ADMIN_ONEFOP (own guard, plus the server limits SUPER_ADMIN_ONEFOP to ONEFOP personnel via `staff-scope.ts`)
**Classification:** KEEP
**Figma frame:** `docs/figma/declarants/utilisateurs.png` — header "Administration > Utilisateurs ONEFOP" (the ONEFOP agent roster, despite the `declarants/` folder)

#### Tables
Uses `UsersDirectory` component (paginated, 20 per page):
| Column | Sortable | Notes |
|---|---|---|
| Name | No | |
| Role | No | Badge with role colour |
| Region / Department | No | |
| Status | No | active/suspended/pending badge |
| Actions | No | Approve / Reject / Change role / Suspend or Activate / Delete |

Also shows 3 KPI tiles (Agents Actifs, Agents Inactifs, Nouvelles Inscriptions) and a warning for departments with no active Divisional agent.

#### Filters / search
- Search (debounced 300 ms)
- Role scope: Régionaux et divisionnaires / Tous les rôles ONEFOP / per-role
- Status: pending / all / active / suspended
- Region filter (when showRegionFilter=true)

#### Actions
| Label | What it does | Backend endpoint | Endpoint roles |
|---|---|---|---|
| Approve | Approves pending user | PATCH /auth/approve-user/:id | SUPER_ADMIN, SUPER_ADMIN_ONEFOP |
| Reject | Rejects pending user | PATCH /auth/reject-user/:id | Same |
| Change role | Updates user role | PATCH /auth/users/:id/role | Same |
| Suspend | Suspends active user | PATCH /auth/users/:id/suspend | Same |
| Activate | Reactivates suspended user | PATCH /auth/users/:id/activate | Same |
| Delete | Hard-delete (email confirmation required) | DELETE /auth/users/:id | Same |
| Reassign (Figma "Réassigner") | Changes an agent's role + region/department. Not yet wired in React Web | PATCH /auth/users/:id/territory | SUPER_ADMIN only |
| "Ajouter Agent" (toolbar) | Disabled — creation in Flutter | — | — |

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| GET | /auth/users?roles=…&isActive=…&page=…&pageSize=… | `AuthController.listUsers` | SUPER_ADMIN, SUPER_ADMIN_ONEFOP | `auth/user-list-filter.spec.ts` |
| PATCH | /auth/approve-user/:id | `AuthController.approveUser` | Same | No |
| PATCH | /auth/reject-user/:id | `AuthController.rejectUser` | Same | No |
| PATCH | /auth/users/:id/role | `AuthController.updateUserRole` | Same | No |
| PATCH | /auth/users/:id/suspend | `AuthController.suspendUser` | Same | No |
| PATCH | /auth/users/:id/activate | `AuthController.activateUser` | Same | No |
| DELETE | /auth/users/:id | `AuthController.deleteUser` | Same | No |
| PATCH | /auth/users/:id/territory | `AuthController.updateUserTerritory` | SUPER_ADMIN only (narrower than the page gate) | No (`auth/territory.spec.ts` covers the territory helpers, not this endpoint) |

#### Test coverage
- Frontend: None.
- Backend: `auth/user-list-filter.spec.ts` (filter logic), `auth/staff-scope.spec.ts` (scope guard), `auth/territory.spec.ts`.

---

### Référentiel des secteurs — `/admin/sectors`

**Sidebar section:** None in sidebar (accessible via URL but not linked from nav; no group assigned in layout PAGE_TITLES either — subtitle shows but no breadcrumb group)
**Role gate:** SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, DATA_MANAGER, CAMPAIGN_MANAGER, ANALYST, AUDITOR, CENTRAL, REGIONAL, DIVISIONAL
**Classification:** KEEP (read-only reference; the backend `/sectors` endpoint is public but access is gated to staff roles on the frontend)

#### Tables
| Column | Sortable | Notes |
|---|---|---|
| Nom (French name) | No | |
| Nom (English name) | No | |
| Catégorie (badge) | No | Used as filter |
| Code | No | |

#### Filters / search
- Category filter dropdown (derived from loaded data)

#### Actions
None — read-only.

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| GET | /sectors | `SectorsController.findAll` | Public (no @Roles guard in sectors controller) | No |

#### Test coverage
None.

---

### Données et exports — `/admin/diffusion`

**Sidebar section:** DONNÉES
**Role gate:** All admin roles (inherited from layout — no extra `useAdminScreenGuard` call in this page)
**Classification:** CHANGE (KPI tiles and export history table are mocked; sections-to-include checkboxes are UI-only and not sent to backend; codebook download buttons are not wired)

#### Tables
Export history table: Date / Utilisateur / Format / Périmètre / Taille / Statut / Action — **hardcoded mock data**, no backend call.

#### Filters / search
- Format radio: .sav / .sps / .xlsx
- Include codebook checkbox (UI only, not sent to backend)
- Scope mode radio: "Données officielles" vs "Choisir les statuts" (with per-status checkboxes)
- Advanced filters (collapsible): entity type, year, region, department

#### Actions
| Label | What it does | Backend endpoint | Endpoint roles |
|---|---|---|---|
| "Lancer l'export .sav" | Downloads SPSS .sav binary | POST /data-management/export/submissions/spss/sav | SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, CENTRAL, DATA_MANAGER, ANALYST, REGIONAL |
| "Lancer l'export .sps" | Downloads SPSS syntax via manifest | POST /data-management/export/submissions/spss/manifest | Same |
| "Lancer l'export .xlsx" | Downloads Excel workbook | POST /data-management/export/submissions/excel | Same |
| Codebook download buttons | Not wired — no onClick | — | — |
| Export history "re-download" button | Not wired | — | — |

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| POST | /data-management/export/submissions/spss/manifest | `DataManagementController.getSpssManifest` (POST) | SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, CENTRAL, DATA_MANAGER, ANALYST, REGIONAL | `data-management.service.spec.ts`, `spss/*.spec.ts` |
| POST | /data-management/export/submissions/spss/sav | `DataManagementController.downloadSav` (POST) | Same | Same |
| POST | /data-management/export/submissions/excel | `DataManagementController.downloadExcel` (POST) | Same | `data-management.service.spec.ts` |

#### Test coverage
- Frontend: None.
- Backend: `data-management.service.spec.ts`, `spss/export-filters.spec.ts`, `spss/sav-export.roundtrip.spec.ts`, `spss/sav-writer.spec.ts`.

---

### Annuaire / Établissements — `/home/annuaire`

**Sidebar section:** DÉCLARANTS (linked as "Établissements" in sidebar)
**Role gate:** SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP
**Classification:** KEEP

Two tabs (SUPER_ADMIN only sees both; other roles see companies tab only):
- **Établissements** (CompaniesDirectory component)
- **Utilisateurs** (UsersDirectory component, SUPER_ADMIN only)

#### Tables (CompaniesDirectory)
| Column | Sortable | Notes |
|---|---|---|
| Nom | Yes (client-side) | |
| Type | Yes | |
| NIU | Yes | |
| ID Établissement | Yes | |
| Région | Yes | |
| Département | Yes | |
| Date d'inscription | Yes | |
| Contact | Yes | |
| Statut | Yes | active/inactive badge |

Pagination: 20 per page, server-side. Sort is client-side on the loaded page.

#### Filters / search
- Search (debounced 300 ms)
- Status toggle: Tous / Actifs / Inactifs

#### Actions
None in the companies tab (read-only roster in current implementation).

UsersDirectory actions (Utilisateurs tab, SUPER_ADMIN only): same as `/admin/utilisateurs`.

#### Backend endpoints
| Method | Path | Controller method | Roles | Spec exists? |
|---|---|---|---|---|
| GET | /dsmo/companies?search=…&page=…&pageSize=… | `DsmoController.listCompanies` | SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP | `dsmo/dsmo.service.spec.ts` |
| GET | /auth/users?… | (same as utilisateurs page, SUPER_ADMIN tab only) | SUPER_ADMIN, SUPER_ADMIN_ONEFOP | Same |

#### Test coverage
- Frontend: None.
- Backend: `dsmo/dsmo.service.spec.ts`.

---

## Null-href sidebar entries (planned, not implemented)

| Section | Label | Figma reference |
|---|---|---|
| SUPERVISION | Activité & alertes | No matching Figma frame found in `docs/figma/` |
| COLLECTE | Questionnaires | `docs/figma/collecte/questionnaires.png` — shows a questionnaire management screen |
| DÉCLARANTS | Inscriptions | `docs/figma/declarants/inscriptions.png` — shows a registration approval queue with company details |
| DÉCLARANTS | Utilisateurs | No matching Figma frame. `docs/figma/declarants/utilisateurs.png` is **not** this screen: its header reads "Administration > Utilisateurs ONEFOP", so it is the frame for `/admin/utilisateurs` |
| CONTRÔLE QUALITÉ | Contrôle régional | No matching Figma frame |
| CONTRÔLE QUALITÉ | Contrôle national | No matching Figma frame |
| CONTRÔLE QUALITÉ | Anomalies | `docs/figma/qualite/centre.png` — shows a quality control centre with anomaly registers |
| DONNÉES | Jeux de données | No matching Figma frame |
| DONNÉES | Qualité | `docs/figma/qualite/centre.png` (same as Anomalies above) |
| ADMINISTRATION | Rôles & permissions | No matching Figma frame |
| ADMINISTRATION | Journal d'audit | `docs/figma/administration/journal-audit.png` — shows a full audit log table |

Notes on Figma frames found that map to null-href entries:
- **inscriptions.png** shows a queue of establishment registrations pending approval — the concept exists in the backend (`POST /auth/register-company`, `PATCH /auth/approve-user/:id`) but no admin list-registrations endpoint is wired to a frontend screen.
- **questionnaires.png** shows a questionnaire version / schema management screen.
- **qualite/centre.png** is the target for both "Anomalies" and "Qualité" sidebar items; the files-attente page handles anomaly resolution but the quality centre screen (with charts, breakdown by rule family, trend lines) is not built.
- **journal-audit.png** is a full audit log — referenced in a TODO comment in `pilotage/page.tsx` ("Voir tout le journal" needs `/admin/journal-audit`). The backend endpoint exists: `GET /audit/reports?limit=N` (`AuditController.getAuditLog`, `src/report/audit.controller.ts`; roles SUPER_ADMIN, SUPER_ADMIN_ONEFOP, AUDITOR) returns the latest `AuditLog` rows of every type with the acting user. It now also accepts `period`, `actor`, `action`, `resourceType`, `resourceId` and, with `paginate=true`, returns `{ items, total, limit, offset }`; without `paginate=true` it still returns the plain array. There is still no export. `/admin/journal-audit` uses it.
- The three Figma frames for `declarants/etablissements/_id.png` and `_id/approbation.png` show an establishment detail + approval flow that is not implemented in the React Web frontend.

---

## Backend endpoints without a frontend consumer

The following `@Roles`-decorated endpoints in admin/related controllers are not called by any file under `react-web/src/app/admin/` or `react-web/src/app/home/annuaire/`:

| Method | Path | Controller | Notes |
|---|---|---|---|
| GET | /admin/questionnaires/pending | `AdminQuestionnairesController.getPending` | Legacy; superseded by `getAll` with `status=PENDING_REVIEW` |
| GET | /admin/questionnaires/correction-requested | `AdminQuestionnairesController.getCorrectionRequested` | Legacy; superseded by `getAll` with `status=CORRECTION_REQUESTED` |
| GET | /admin/questionnaires/:id | `AdminQuestionnairesController.getOne` | Single-dossier fetch (not the diagnostic); unused — dossier detail page uses `/diagnostic` |
| PATCH | /admin/questionnaires/:id/approve | `AdminQuestionnairesController.approve` | Single-dossier approve button exists in detail page UI but onClick is not wired |
| PATCH | /admin/questionnaires/:id/reject | `AdminQuestionnairesController.reject` | Same — button is rendered but has no onClick |
| PATCH | /admin/questionnaires/:id/request-correction | `AdminQuestionnairesController.requestCorrection` | No UI entry point |
| GET | /data-management/stats | `DataManagementController.getStats` | Would power the diffusion KPI tiles but is not called |
| GET | /data-management/export/submissions (GET variant) | `DataManagementController` | POST variant is used; GET variant is not |
| GET | /data-management/export/submissions/spss/manifest (GET variant) | Same | POST variant is used |
| GET | /data-management/export/submissions/spss/csv | Same | CSV export function exists in api-client.ts (`downloadSpssCsvBlob`) but diffusion page does not expose it |
| GET | /data-management/export/submissions/excel (GET variant) | Same | POST variant is used |
| GET | /campaigns/active/current | `CampaignController.getActiveCurrent` | Used by `AdminHeaderActions` via `useActiveCampaign` hook |
| GET | /campaigns/conflicts | `CampaignController.getConflicts` | Not used by any frontend page |
| GET | /campaigns/:id/progress | `CampaignController.getProgress` | Not used |
| GET | /campaigns/:id/submissions | `CampaignController.getSubmissions` | Not used |
| POST | /campaigns/:id/extend | `CampaignController.extendDeadline` | Not used (deadline extension not in React Web UI) |
| DELETE | /campaigns/:id | `CampaignController.delete` | Not used in React Web UI |
| POST | /auth/admin/create-minefop-user | `AuthController.createMinefopUser` | "Ajouter Agent" button on utilisateurs page is disabled; creation still via Flutter |
| GET | /auth/pending-minefop | `AuthController.getPendingMinefop` | Not used; legacy approval queue |
| PATCH | /auth/users/:id/territory | `AuthController.updateUserTerritory` | SUPER_ADMIN only. Target for the Figma "Réassigner" action on `/admin/utilisateurs`; no React Web caller yet |
| PATCH | /data-management/regions/:id | `DataManagementController.updateRegion` | Not used |
| DELETE | /data-management/regions/:id | Same | Not used |
| PATCH | /data-management/sectors/:id | Same | Not used |
| DELETE | /data-management/sectors/:id | Same | Not used |

---

## Screens needing schema changes

> Discovery date: 2026-09-30. Source: the 10 Figma frames under
> `react-web/docs/figma/` checked against `prisma/schema.prisma` and the
> controllers. Values the frames show that can be computed from existing
> columns (counts, rates, trends, timeline dates, relation-derived names)
> are not listed. No migrations have been run; every schema change below
> needs explicit review (CLAUDE.md §6, §21).

**Status definitions**

- **READY**: no schema change needed; any endpoint additions are additive only; no domain ruling needed. A rebuild can run next.
- **PARTIAL**: some schema changes needed, but a meaningful subset of the screen can be rebuilt now (with retained widgets and explicit empty states for the missing parts).
- **BLOCKED**: needs a domain ruling (§7, §21) or a restructuring migration (RBAC, entity-type enums) before a rebuild is meaningful. Do not run.

**Resolved**

- RESOLVED — `audit_logs.userId` NOT NULL (blocked "Système" as an audit actor). Being made nullable in a separate change; not an open gap for any screen below.

### Batch 0 — no schema change

| Screen | Status | Required schema changes | Required endpoint additions | Domain rulings needed |
|---|---|---|---|---|
| Journal d'audit — `administration/journal-audit.png` | READY — built (`/admin/journal-audit`) | None | Filters + pagination: done. Remaining: a self-auditing server-side export | None |

### Batch 1 — cheap foundation (new nullable columns or one standalone table)

| Screen | Status | Required schema changes | Required endpoint additions | Domain rulings needed |
|---|---|---|---|---|
| Établissements (annuaire) — `declarants/etablissements.png` | PARTIAL | `createdBy` + registration method (self-registration vs admin) on `Company` or `User`; optionally an explicit city field (today only `subdivision` / `area`) | Admin create-establishment endpoint (only self-service `POST /dsmo/company` and `/auth/register-company` exist); list export; region/type/sector filters on `GET /dsmo/companies` if missing | Definition of account status "Incomplet"; mapping of Figma type "ASFOP" (not in `OnefopEntityType`) — display only here, render existing types meanwhile |
| Données et exports (diffusion) — `donnees/exports.png` | PARTIAL | New export-job table (user, format, scope, size, status, stored file key) for export history, size, status and re-download | Wire `GET /data-management/stats` for the KPI tiles (exists); campaign (`quarterCode`) filter on the export endpoints; export-history list endpoint | "Sections à inclure" would change the content of official exports (§21); codebook versioning ("Codebook Principal v2.4") |

### Batch 2 — relations

| Screen | Status | Required schema changes | Required endpoint additions | Domain rulings needed |
|---|---|---|---|---|
| Agents ONEFOP — `/admin/utilisateurs` (`declarants/utilisateurs.png`) | PARTIAL | Agent ↔ entity-type assignment ("Enquêtes/Fiches assignées", "En attente d'affectation"); `User.lastLoginAt`; per-agent target/quota; `UserStatus` value for "Brouillon" | Per-agent stats (forms, completion); "Réassigner" can use `PATCH /auth/users/:id/territory` (exists, SUPER_ADMIN only); "Ajouter Agent" can use `POST /auth/admin/create-minefop-user` (exists) | What "Fiches soumises" means per agent (`OnefopSubmission.reviewedBy` records the reviewer, not a collector); whether per-agent quotas exist at all |
| Campagnes — `collecte/campagnes.png` | PARTIAL | Agent ↔ campaign link (for "Agents actifs 342 / 380") | Wire `GET /campaigns/:id/progress` (exists, unused); campaign-history export; section counts come from the canonical schema, not the DB | Mapping of Figma type "ASFOP" in "Questionnaires assignés" (render `targetEntityTypes` meanwhile) |
| Détail établissement — `declarants/etablissements/_id.png` (+ account modal) | BLOCKED | Several user accounts per establishment (`Company.userId` is `@unique` — one-to-one restructuring); company-side roles Administrateur / Responsable / Comptable / Lecteur (new `UserRole` values — RBAC); `User.lastLoginAt`; login-history table (or LOGIN events in `AuditLog`); session reset (e.g. token version); `updatedBy`; `createdBy` + creation method; verification status; full creation date (today `yearOfCreation` string) | Admin company edit; account unlock (`lockedUntil` exists, no endpoint); per-establishment audit timeline (filter `AuditLog` by `resourceId`); session reset | RBAC change for company roles (§21); ownership model for multi-user establishments |

### Batch 3 — documents

| Screen | Status | Required schema changes | Required endpoint additions | Domain rulings needed |
|---|---|---|---|---|
| Inscriptions — `declarants/inscriptions.png` | PARTIAL | Registration number (INS-YYYY-NNNN); registration-documents table; `UserStatus` values EN VÉRIFICATION / COMPLÉMENTS DEMANDÉS / DOCUMENTS INCOMPLETS; assignee; `User.approvedAt`; last-reminder timestamp | Registration queue list (company users by status, with filters) — `GET /auth/users` may cover part; "Relancer" reminder; approve/reject exist (`PATCH /auth/approve-user/:id`, `/auth/reject-user/:id`) | Which documents are required per entity type |
| Validation du compte — `declarants/etablissements/_id/approbation.png` | PARTIAL | Documents table with per-document verification state (shared with Inscriptions); "Demander des compléments" status value; dedicated comment column (`rejectionReason` is already overloaded — see deferred.md) | Request-complements endpoint; approve/reject with reason exist | Complements workflow and who may request them. Host the dialog on Inscriptions until the establishment detail screen is unblocked |

### Batch 4 — quality

| Screen | Status | Required schema changes | Required endpoint additions | Domain rulings needed |
|---|---|---|---|---|
| Centre de contrôle qualité — `qualite/centre.png` (Anomalies + Qualité) | PARTIAL | Completeness storage (or a computation over the schema); persisted coherence results (today `OnefopSubmission.flags` Json + client-side checks); automated control-run table ("Lot #847"); region status thresholds (config); validation-rules table with active/inactive state | Anomaly aggregates by type and by region (`GET /admin/questionnaires/anomalies/registry` lists, does not aggregate); recent-controls feed; eligibility rate (from the diagnostic engine) | Coherence must stay advisory (§7); enabling/disabling validation rules changes validation semantics (§21); definition of the Complétude and Cohérence rates |

### Not batchable — canonical AST

| Screen | Status | Required schema changes | Required endpoint additions | Domain rulings needed |
|---|---|---|---|---|
| Questionnaires — `collecte/questionnaires.png` | BLOCKED | Questionnaire status and "Nouveau Questionnaire" belong to the canonical AST (`lib/core/focus/compiler/onefop_ast.dart`), not DB columns; "ASFOP (Recensement)" needs a new `OnefopEntityType` value | Per-type submission totals and completion (derivable from `formType`); schema preview from `onefop.schema.json` | Questionnaire structure and entity-type changes (§21) |

`/admin/parametres` is not listed: it is rebuilt read-only on branch `admin/parametres` (draft PR emmacla-del/dsmo-app#1), which logs its unsaveable Figma fields in `docs/deferred.md`.
