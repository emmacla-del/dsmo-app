# Deferred items

Items that are code-complete or code-pending but not yet verified live,
or that are known issues deferred to a future session. Distinct from
`docs/pending-work.md`, which is auto-generated from `TODO(...)`
comments in the codebase.

Check items off as they're verified or resolved. Add new items at the
top with a date.

---

## Decision — campaign progress is ONEFOP-only (2026-09-30)

B2 (PR #17) implemented the campaign progress fix for ONEFOP
questionnaire submissions only. DSMO is intentionally out of scope.

B3 (DSMO write path) is cancelled. The DSMO progression is not
tracked in CampaignSubmission and will not be. Reminders, progress
and reports will reflect ONEFOP submissions only.

Consequence: if a campaign targets DSMO entities, its progress
counts will not move on DSMO submissions. If that ever becomes
desired, it is a new decision, not a resumption of B3.

B4 (review transitions) is scoped to ONEFOP only:
  - approve  -> CampaignSubmission VALIDATED
  - reject / request-correction -> CampaignSubmission PENDING

The Declaration.campaignId column added in B1 stays in the schema.
It is unused and harmless. Removing it is not worth a migration.

---

## Phase B2a — permission model: held items and findings (2026-09-30)

Branch `admin/b2a-permissions`. D1 and D3 shipped. D7 shipped later,
export-only (PR #12, see below).

**RESOLVED: `RolesGuard` ignored class-level `@Roles`.**
`src/auth/roles.guard.ts` read `reflector.get('roles', context.getHandler())`
only. When `@Roles` sat on the controller class, the lookup returned
`undefined` and the guard let **any authenticated user** through.
Fixed in `337dede` (PR #9): the guard now reads
`reflector.getAllAndOverride('roles', [handler, class])`, so handler-level
`@Roles` wins and the class list is the fallback. Covered by
`src/auth/roles.guard.spec.ts`.
- [x] `src/system-settings/system-settings.controller.ts`: `GET`/`PATCH
      /system-settings`, now SUPER_ADMIN only.
- [x] `src/landing-config/admin-landing-config.controller.ts`: moot, the
      feature was removed in `3c438173`.
- [x] `src/analytics/onefop-analytics.controller.ts`: class list enforced.
- [x] `src/questionnaires/admin-questionnaires.controller.ts`: class list
      enforced (territory scoping still applies on top).

Post-fix audit (2026-09-30). No handler-level `@Roles` exists on any of
these controllers, so the class list decides every route. Before #9, all
11 `UserRole` values reached every route.

| Controller | Routes | Class `@Roles` (allowed now) | Cut by #9 |
|---|---|---|---|
| `system-settings` | `GET /`, `PATCH /` | SUPER_ADMIN | the other 10 roles |
| `onefop-analytics` | all 44 GET routes | CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP | COMPANY, SUPER_ADMIN_DSMO, DATA_MANAGER, CAMPAIGN_MANAGER, ANALYST, AUDITOR |
| `admin/questionnaires` | 15 routes (queues, bulk-visa, bulk-reject, anomaly registry/resolve, list, pending, correction-requested, export, `:id`, diagnostic, approve, reject, request-correction) | same 5 | same 6 |

Note: `onefop-analytics` has no territory scoping, so before #9 every
role, COMPANY included, read national ONEFOP analytics.

- [ ] **Decision needed: ANALYST, DATA_MANAGER and SUPER_ADMIN_DSMO on
      `onefop-analytics`.** D7 calls these roles analytical with a
      national mandate, but #9 cut them from every ONEFOP analytics
      endpoint. If they should read analytics, that is a `@Roles` change
      on `OnefopAnalyticsController` (read-only routes, no territory
      scoping) and needs review. The same three roles are also cut from
      `GET admin/questionnaires/export`; D7 does not need that route (its
      exports are the data-management endpoints).

- [x] **D7 (national scope for SUPER_ADMIN_DSMO / DATA_MANAGER / ANALYST)**
      shipped export-only in `ed588791` (PR #12): a separate
      `EXPORT_NATIONAL_ROLES` list in `src/auth/territory.ts`, used only
      by `territoryWhereForExport` in the two data-management export
      where-builders. `NATIONAL_ROLES` and `assertTerritorialAuthority`
      are unchanged, so the three roles gained no national write scope
      (the risk this item originally warned about).

Findings on the D3 / D1 endpoints (not changed — outside this run):
- [ ] D3 lets REGIONAL/DIVISIONAL approve **any** pending ONEFOP staff
      role in their territory, including CENTRAL, DATA_MANAGER, ANALYST,
      AUDITOR, CAMPAIGN_MANAGER and REGIONAL (for a DIVISIONAL, if the
      target carries a matching department). DATA_MANAGER / ANALYST become
      national under D7. Decide whether DR approvers should be limited to
      field roles (e.g. REGIONAL → DIVISIONAL only).
- [ ] D3 covers **staff** registrations only: `approveUser` answers 400
      for COMPANY accounts ("Les entreprises sont automatiquement
      approuvées"). Company inscriptions (Figma /admin/inscriptions) have no
      approval step today.
- [ ] `PATCH /auth/reject-user/:id` receives `reason` but never passes it to
      the service; `rejectionReason` is not written.
- [ ] `approveUser` / `rejectUser` write no audit row and do not set the B1
      `approvedAt` column.
- [ ] `src/auth/public-user.spec.ts` fails on master since B1: the ten new
      User columns are not classified in `PUBLIC_USER_SELECT` /
      `SECRET_USER_FIELDS` (`src/auth/public-user.ts`). `tokenVersion` at
      least belongs in the secret list.

---

## Phase B1 — user & registration schema (2026-09-30)

Schema only (branch `admin/schema-user-registration`). Migrations
`20260930120000_add_user_status_registration_values` and
`20260930120100_add_user_registration_fields`, **not applied** — a human
runs `npx prisma migrate deploy`. Nothing in the application reads or
writes these yet.

**Phase column:** B2–B7 are not defined in the repo docs (only B2 is
mentioned, as the territory-model work in role-decisions.md D7). Each item
is mapped to its decision and screen; assign it to a phase when the plan
exists.

| Item | Table | Consumer (screen / decision) | Phase |
|---|---|---|---|
| `lastLoginAt` | users | utilisateurs "Dernier accès"; établissement detail "Dernière connexion". Needs the login path to write it (auth — review) | unassigned |
| `approvedAt` | users | inscriptions KPI "Approuvées ce trimestre"; approve action writes it (D3) | unassigned |
| `createdBy` (→ users, SET NULL) | users | annuaire / établissement "Créé par"; admin-created agents (D1). D4: no admin-created establishments | unassigned |
| `registrationMethod` | users | établissement detail "Méthode"; annuaire "Créé par" (auto-inscription) | unassigned |
| `tokenVersion` (default 0) | users | établissement detail "Réinitialiser la session". Enforcing it changes JWT validation — auth review required, not scheduled | unassigned |
| `registrationNumber` (unique) | users | inscriptions "N° Inscription"; needs a generator | unassigned |
| `assigneeId` (→ users, SET NULL) | users | inscriptions "Assigné à" (D3 — DR review in territory) | unassigned |
| `lastReminderAt` | users | inscriptions "Relancer" | unassigned |
| `approvalComment` | users | validation du compte "Motif ou commentaire" for complements / approval (D3); keeps rejectionReason for rejections | unassigned |
| `perAgentTarget` | users | utilisateurs "Taux de complétion" per agent — needs a domain definition of the target | unassigned |
| `UserStatus.DRAFT` | enum | utilisateurs "Brouillon" | unassigned |
| `UserStatus.UNDER_REVIEW` | enum | inscriptions "En vérification" (D3) | unassigned |
| `UserStatus.COMPLEMENTS_REQUESTED` | enum | inscriptions / validation du compte "Compléments demandés" (D3) | unassigned |
| `UserStatus.DOCUMENTS_INCOMPLETE` | enum | inscriptions "Documents incomplets" (D3). The documents concept behind it was retired 2026-10-06 (see `registration_documents` below); the enum value stays — removing it is its own schema decision | unassigned |
| ~~`registration_documents` table~~ | new | SUPERSEDED 2026-10-06: the registration-documents feature is retired (no upload path existed; endpoints and UI removed). The model and table remain until a separate, reviewed drop task — see `docs/audit/documents-removal-plan-2026-10-06.md` §5.2 | superseded |

Follow-ups:
- [ ] `registrationMethod` is free text: turn it into an enum once the
      values are stable (candidates: SELF_REGISTRATION, ADMIN_CREATED).
- [x] ~~`registration_documents.kind` and `.state` are free text for the same
      reason (state candidates: PENDING, VERIFIED, REJECTED, MISSING); the
      required documents per entity type need a ruling.~~ SUPERSEDED
      2026-10-06: the feature is retired; the table is pending a separate
      drop task (`docs/audit/documents-removal-plan-2026-10-06.md` §5.2).
- [ ] Any code that sets or filters on the four new `UserStatus` values must
      handle them everywhere status is interpreted (login gating, approve /
      reject, directory filters and badges) — none do today.
- [ ] `prisma validate` cannot run in the cloud sandbox: the datasource
      needs `DATABASE_URL` / `DIRECT_URL` even on master. The schema was
      checked with `prisma generate` instead.

---

## /admin/journal-audit — Figma elements not built (2026-09-30)

Built on branch `admin/journal-audit`. `GET /audit/reports` was extended
additively (filters + `paginate=true` envelope). Not built:

- [ ] **"Exporter le journal"** (header primary action). Needs a
      server-side export that writes its own audit entry (as
      `AUDIT_LIST_EXPORT` does for dossiers). The screen's allowed backend
      scope was filters + pagination only, and a client-side export of the
      audit log would leave no trace.
- [ ] **Header "Toutes les dates" dropdown** — duplicates the Période
      filter; only the filter-bar control is built.
- [ ] **Acteur as a user dropdown** — built as a name/e-mail text search.
      A dropdown needs a list of actors; `GET /auth/users` is closed to
      AUDITOR and a distinct-actors endpoint was out of scope.
- [ ] **"Rechercher par ID ou nom"** — search is by `resourceId` only.
      Object names are not stored on `AuditLog`; resolving them needs a
      per-resourceType join.
- [ ] **Human-readable object labels** (e.g. "SABC S.A. (ETB-001847)")
      — the Objet column shows type + raw ID for the same reason.
- [ ] **Numbered pagination** — Précédent / Suivant, as on the dossier
      list.
- [ ] **Row background tinting per outcome** — replaced by a coloured
      action badge (CLAUDE.md §8, no decorative fills).
- [ ] **Action filter list is static** (`AUDIT_ACTIONS` in
      `react-web/src/lib/audit-log.ts`, from a grep of the backend's
      audit writes). A new backend action string lists and renders under
      its raw code but can't be picked in the filter until it is added.
- [ ] **Figma events not written today**: "Anomalie détectée",
      "Contrôle automatique", "Inscription approuvée", "Compte suspendu",
      "Coordonnées modifiées" (as a diff), "Campagne modifiée". The screen
      shows whatever `AuditLog` holds; those backend paths do not write
      audit rows yet.

Found while building (not fixed — outside this screen):

- [x] **`AUDIT_LIST_EXPORT` audit row was written with a null
      resourceId.** Fixed in `6bb79de9`: `resourceId` is now
      `` `EXPORT_${Date.now()}` ``, matching the bulk-visa
      `BULK_<timestamp>` convention, and the surrounding catch now
      logs at error level with the stack and rethrows instead of
      swallowing.
- [ ] **Pilotage "Voir tout le journal"** (`RecentActivity`, TODO in
      `react-web/src/app/admin/pilotage/page.tsx`) can now link to
      `/admin/journal-audit`, but only for SUPER_ADMIN, SUPER_ADMIN_ONEFOP
      and AUDITOR.

## Dossier detail rebuild — Figma elements not built (2026-09-30)

`/admin/dossiers/[id]` was rebuilt against
`react-web/docs/figma/supervision/dossiers/_id.png` and
`.../_id/retour-correction.png`. These Figma elements need backend or
frontend work that does not exist yet:

- [ ] **Sections 2–4 content** (Emploi, Départs, Formation accordions).
      `GET /admin/questionnaires/:id` returns the data, but no read-only
      renderer for the statistical tables exists in react-web. Needs a
      schema-driven viewer built on `onefop.schema.json`, not hand-coded
      tables. Page shows a one-line notice instead of empty accordions.
- [ ] **"Superviseur: …" in the header subtitle and reviewer names in the
      history.** `reviewedBy` is a bare user id; no name is returned.
- [ ] **"Fiche d'enquête initialisée" history step.** Draft creation is not
      recorded separately from submission (`createdAt` = `submissionDate`).
      A full history needs an audit-log read endpoint (none exists).
- [ ] **Retour pour correction: section concernée, axe affecté, délai de
      correction, documents justificatifs.** `request-correction` accepts
      only `comments` + `certified`. Adding these is a schema + API change.
- [ ] **Single-dossier approve writes no audit record.** Bulk visa writes
      `AUDIT_BULK_VISA_GRANTED`, reject and correction write `AUDIT_REJECT`
      / `AUDIT_CORRECTION`, but `QuestionnairesService.approve` writes
      nothing. The old approve dialog claimed it did; the claim was removed.
      Single approve also has no certification step, unlike bulk visa.
- [ ] **Payload size.** The page calls `GET /admin/questionnaires/:id`,
      which includes ~30 relations to render ~20 fields. Fine per request;
      a slimmer admin-summary endpoint would help on slow connections.

---

## /admin/parametres — Figma editable settings not wirable (2026-09-30)

The supervision Figma (`react-web/docs/figma/administration/parametres.png`)
shows editable forms. The rebuild (branch `admin/parametres`) renders them
read-only because nothing can persist them without a schema change, and the
feature matrix lists no write capability for this screen.

The only settings store is the `SystemSettings` singleton
(`passwordMinLength`, `require2FAForStaff`, `maintenanceMode`,
`maintenanceMessage`), served by `GET/PATCH /system-settings`
(`@Roles('SUPER_ADMIN')`). None of its columns match a Figma field.

Needs new columns (schema review required) before any of these can be saved:
- [ ] Nom de l'observatoire
- [ ] Pays
- [ ] Langue par défaut
- [ ] Fuseau horaire
- [ ] Campagne active par défaut (campaign activation already lives on
      `/admin/campagnes`; confirm a separate "default" is wanted)
- [ ] Nombre maximum de fiches par superviseur
- [ ] Délai de soumission (jours) (overlaps campaign deadlines — needs
      domain review)
- [ ] Soumission hors-ligne autorisée (toggle)
- [ ] Validation automatique des fiches conformes (toggle — affects the
      visa workflow; needs domain review)

Not built, by guardrail:
- [ ] "Ajouter un Rôle" / "Éditer" on Rôles & Permissions — roles are a
      fixed enum; editing them is an RBAC change. Screen shows a read-only
      role/scope reference and links to `/admin/utilisateurs`.
- [x] "Voir le journal complet →" — `/admin/journal-audit` now exists
      (`admin/journal-audit` branch, `dc55e3a0` + `9771c52b`). The
      parametres section could link to it instead of only showing the
      recent-5 panel; not done in this pass.
- [x] Feature matrix is wrong on one point: it says no audit-log endpoint
      exists; `GET /audit/reports` (`src/report/audit.controller.ts`,
      SUPER_ADMIN / SUPER_ADMIN_ONEFOP / AUDITOR) returns the latest
      `AuditLog` rows of every type. Corrected in `0b5ee606`.
      SUPER_ADMIN_DSMO can open the page but not this endpoint, so the
      section shows a notice for that role.
- [ ] Page role gate (SUPER_ADMIN*, 3 roles) is wider than
      `/system-settings` (SUPER_ADMIN only) — reconcile if the settings
      endpoint is ever wired here.

---

## CORRECTION_REQUESTED structural gaps — deferred (2026-09-30)

Three structural issues identified during CORRECTION_REQUESTED discovery.
None block the current workflow but affect statistics and admin UX.

**1. Resubmission creates an unlinked new row**
When a respondent resubmits after a correction request, the submission
engine creates a new row (`status: PENDING_REVIEW`, new `formId`). The
old row stays in the database with `status: CORRECTION_REQUESTED`. There
is no foreign key or `originalSubmissionId` linking them.

Impact:
- An admin reviewing the new PENDING_REVIEW row has no visible link to
  the previous CORRECTION_REQUESTED row or its admin comments.
- Statistical exports see both rows for the same company/quarter; the
  CORRECTION_REQUESTED row is excluded by status filters but the
  relationship is not explicit.
- Deduplication logic relies on status exclusion, not on explicit linkage.

Fix direction: add `previousSubmissionId` nullable FK on
`OnefopSubmission`; set it on resubmit when a CORRECTION_REQUESTED row
for the same company + quarter exists. Requires migration review.

**2. `rejectionReason` field overloaded**
`service.reject()` and `service.requestCorrection()` both write to
`rejectionReason`. Once a corrected dossier is resubmitted and later
approved, the old CORRECTION_REQUESTED row's `rejectionReason` remains
readable by respondents through the dashboard and submissions viewer.

Fix direction: add a dedicated `correctionComments` column, or rename
`rejectionReason` to `adminNotes` / `reviewNotes` and update all
references. Requires schema migration and API/Flutter client update.

**3. No admin UI to see "which PENDING_REVIEW is a correction of which row"**
Even if (1) is fixed with a FK, the dossiers list and detail page show
no visual indication that a dossier is a resubmission of a prior
CORRECTION_REQUESTED row. Admins must manually correlate by company name
and quarter.

Fix direction: add a "Resoumission suite à correction" badge on the
dossier list and detail page, with a link to the prior row.

---

## Email infrastructure — deferred (2026-09-30)

**Status:** Render free tier blocks outbound SMTP (ports 25, 465, 587)
as of Sept 26, 2025. No SMTP provider works on the free tier. Fix
requires an HTTP email API (Resend, Brevo, Mailtrap, or similar) or a
paid Render plan.

**Blocked by this:**
- [ ] 2FA challenge emails — enabling 2FA locks the account out
- [ ] Password reset emails — users can't self-recover
- [ ] Email verification (if used in the signup flow)

**Interim:**
- Password resets via SUPER_ADMIN (`PATCH /auth/admin/reset-password`)
- **Do not enable 2FA** on any account until this is fixed

**When resuming:**
- Replace nodemailer with an HTTP-API email provider in
  `NotificationService`
- Fix the `challengeToken` ordering in `initiateTwoFactorChallenge`
  (currently signs the token AFTER the email send, so a send failure
  locks login entirely)
- Full plan in the session notes / deferred prompt

---

## Security — pending live verification

- [ ] **2FA challenge token rejected as Bearer.** `GET /api/auth/me`
      with a `challengeToken` → expect 401.
      Code shipped (`1e07a7cf`). Unit-verified by `jwt.strategy.spec.ts`.
      Live test blocked by the email infrastructure issue above.

- [ ] **Suspended account → next request → 401.**
      Code shipped (`95b1d71f`). Reloads user state from DB in
      `JwtStrategy.validate()`. Not yet tested live.

---

## Test suite — pre-existing failures

- [ ] `src/data-management/spss/export-filters.spec.ts` —
      "filters rows by entity type, place and year" fails on master.
      Confirmed pre-existing, unrelated to any recent change.
      Investigate and fix. (Full suite: 521 pass, 1 fail.)

---

## Round 2a — dossiers pagination

- [x] `/admin/dossiers` pagination flips, footer shows real N
      Footer verified live: "Affichage de 1–1 sur 1 soumission".
      Button-flip behavior not exercised — REGIONAL Centre account
      sees only 1 row. Needs SUPER_ADMIN or CENTRAL to verify >1 page.
- [x] REGIONAL + foreign region filter → empty list (security property)
      Verified live: Régional Centre + Région Adamaoua → "Aucun dossier".
- [x] Search debounces at ~300ms
      Verified live: one request fired after typing stops, not one
      per keystroke.
- [x] Selection clears on page change
      Verified live during earlier testing.

---

## Round 2b-1 — type and period filters

- [x] Type and Période filters narrow the list; footer N follows
      Verified live during restyle checks.
- [ ] Single DRAFT row absent under "Tous les statuts" (was 14, now 13)
      Not testable from REGIONAL Centre — only 1 row visible.
      Needs SUPER_ADMIN to see across regions.

---

## Round 2b-2 — bulk reject

- [ ] Live test on `/admin/dossiers` after deploy:
      - "Rejeter la sélection" enables with count badge when rows selected
      - Dialog opens with certification checkbox + reason textarea
      - Reason < 10 chars blocked with inline hint
      - Valid submit succeeds, rejectedItems listed
      - Rejected row's status updates after refresh

---

## Known issues — code shipped, not fixed

These are real but non-blocking. Tracked here so they don't get lost.

- [ ] `?token=` / `?access_token=` JWT extraction — tokens in URLs
      leak to server logs, proxies, browser history, Referer headers
- [ ] `failedLoginAttempts` / `lockedUntil` in `PUBLIC_USER_SELECT` —
      leaks account state (not secrets, but fingerprinting)
- [ ] `transform: false` global ValidationPipe in `main.ts:65` —
      query params arrive as strings; `limit`/`offset` parsing is
      now manual but a project-wide fix is pending
- [ ] Dossier search performance at scale — cross-relation `contains`
      with `mode: 'insensitive'` across ~8 columns. Fine at 12k rows,
      slow at 100k without full-text indexes
- [ ] Dossier naming inconsistency — `/admin/dossiers` is
      "Visas & décisions" in the sidebar, "Instruction et visas" in
      the header, and "dossiers" in the route; "Dossiers en instance"
      points at `/admin/files-attente`
- [x] Admin path to change region/department:
      `PATCH /auth/users/:id/territory`, SUPER_ADMIN only.
      (Shipped as `7d36ee0d`.)
- [x] Dossier detail "Rejeter la Fiche" / "Valider et Archiver" buttons
      render but have no onClick — wired in `012b01de`.
- [ ] `/admin/diffusion` KPI tiles show hardcoded "—" — backend endpoint
      (`GET /data-management/stats`) exists but isn't wired.
- [ ] `/admin/diffusion` export history table is fully mocked — no
      endpoint called.
- [ ] Unused AdminQuestionnairesController endpoints with no frontend
      caller: `GET /pending`, `GET /correction-requested` (`GET /:id` is
      now used by the dossier detail page)
- [ ] Correction resubmission creates a new row with no link to the
      original. For a statistical portal this corrupts response rate,
      coverage, and non-response analysis — one respondent counts as
      two submissions and the corrected version can't be traced to
      its predecessor. Policy decision needed: add `originalSubmissionId`
      FK, mark the original as superseded, or switch to in-place edit.
      Not blocking; blocking for anyone reading response-rate numbers.
- [ ] `rejectionReason` field is overloaded — stores both rejection
      motives and correction comments. Respondent detail screen shows
      the correction comment as "rejection reason" even after the
      correction cycle ends.
- [ ] Dossiers export uses fetch+blob on the frontend, not a native
      download. Works but buffers the whole file in browser memory.
      Switch to `<a download href="/admin/questionnaires/export?...">`
      when convenient.

---

## Admin replacement — discovery

- [x] Feature matrix: `docs/admin-replacement/feature-matrix.md`.
      10 screens, 34 capabilities, 38 endpoints inventoried. Risk
      summary at top.
- [x] Schema-gap classification: matrix now has READY / PARTIAL /
      BLOCKED per screen. Shipped as `0b5ee606`.
- [x] Screens rebuilt: `/admin/parametres` (`84dbf903`),
      `/admin/dossiers/[id]` (`66f9eec3`), `/admin/journal-audit`
      (`ad889022` backend, `1d479741` frontend).
- [ ] Remaining PARTIAL screens: utilisateurs, campagnes, diffusion,
      annuaire/etablissements, inscriptions, centre qualité.
- [ ] BLOCKED: établissement detail (multi-user relations, company
      roles), questionnaires (canonical AST).
## Deferred — align Flutter dashboard analytics to Figma

The Flutter dashboard's analytics widgets should match the Figma
frame at <path/TBD>. /onefop-analytics/* currently serves the
dashboard; the data it returns must be shaped to match what the
frame displays.

- Backend: keep /onefop-analytics/*. Reshape responses as needed.
- Flutter: dashboard widgets render against the frame.
- Standalone /analytics route and OnefopDashboardScreen are out of
  the product — remove them as part of this work, not before.
- Not scoped: which endpoints need reshaping, which fields are
  missing, whether the Flutter widgets need rebuilding.

Separate workstream from the React admin rebuild.

## Deferred — territory leak on /data-management/export/submissions

GET and POST /data-management/export/submissions call
exportSubmissions(filters) with no territory argument. Scoping is
driven by the request's region parameter, so a REGIONAL account can
pass any region — or omit it — and get national DSMO declaration
data. This is a live territory leak, independent of D7.

Fix: derive the region from the caller's territory and refuse (or
override) a request-supplied region that differs.

## Deferred — duplicate NATIONAL_ROLES in notification.service.ts

src/notifications/notification.service.ts defines its own local
NATIONAL_ROLES twice. It already includes SUPER_ADMIN_DSMO, so it
behaves consistently today, but it is a second source of truth and
exactly what the D7 note warned against. Consolidate with
territory.ts when notifications are next touched.

## Deferred — react-web lockfile also out of sync

react-web/package-lock.json is out of sync with package.json, same
pattern as the backend. Cloud sessions install with --no-save to
avoid dirtying the diff. Any `npm ci` in react-web will fail until
the lockfile is regenerated.

Fix both lockfiles in one pass. Backend: npm install --package-lock-only
in root. Frontend: same in react-web/. Only the two lockfiles change;
no package.json edits, no version bumps.

## Deferred — /admin/utilisateurs Figma elements without backend support (2026-09-30)

The "Utilisateurs ONEFOP" frame (react-web/docs/figma/declarants/utilisateurs.png)
shows elements the backend cannot serve today. The rebuild leaves them out
rather than showing invented or empty data:

- "Enquêtes/Fiches assignées" column: there is no agent-to-questionnaire or
  agent-to-establishment assignment model.
- "Fiches soumises" and "Taux de complétion" columns: no endpoint attributes
  submissions or completion to an agent.
- "Dernier accès" column: User.lastLoginAt exists (B1) but nothing writes it
  at login, and it is classified secret in src/auth/public-user.ts. Needs a
  write path and a deliberate public classification.
- "Profil" row link: there is no agent profile page and no GET /auth/users/:id.
- "Brouillon" account status pill: no such account status exists.
- KPI "Nouvelles inscriptions (mois)": GET /auth/users has no creation-date
  filter. The tile shows all pending accounts, labelled "Inscriptions en
  attente".
- KPI "Agents inactifs — En attente d'affectation": there is no "awaiting
  assignment" state. The tile counts suspended (isActive=false) accounts,
  labelled "Comptes suspendus".
- "Ajouter Agent" for non-field roles: POST /auth/admin/create-minefop-user
  accepts CENTRAL, REGIONAL and DIVISIONAL only, so DATA_MANAGER,
  CAMPAIGN_MANAGER, ANALYST and AUDITOR accounts cannot be created here.
- Page title "Utilisateurs ONEFOP" with the primary action in the header:
  the admin layout renders this route's header from PAGE_TITLES ("Agents
  ONEFOP"). Matching the frame means removing that entry and rendering the
  page's own AdminPageHeader, which is a layout change.

Also stale: docs/admin-replacement/feature-matrix.md still lists Réassigner as
"SUPER_ADMIN only / not wired" and Ajouter Agent as disabled. Both are wired
now and open to SUPER_ADMIN_ONEFOP per D1.


## Deferred - CampaignSubmission is never updated (investigation 2026-09-30)

STATUS (2026-09-30): superseded by the "Decision — campaign progress
is ONEFOP-only" section above. B2 merged (PR #17). B3 cancelled.
B4 is ONEFOP-only. The historical plan below is kept for context only.

CampaignSubmission has one writer: createMany at campaign
activation. Nothing ever updates it. It is read by:
  - GET /campaigns/:id/progress and GET /campaigns (progress tile)
  - reminders (_getPendingCompanies filters status NOT IN
    [SUBMITTED, VALIDATED])
  - company dashboards (mySubmission in active/current)
  - report.service.ts (completion rate, regional breakdown)

Consequences: reminders go to every targeted establishment,
including those who already submitted. Company dashboards show the
campaign as not started. Every report completion rate is 0.

Root cause: neither OnefopSubmission nor Declaration records the
campaign. The only indirect link is SubmissionRound.quarterCode
(ONEFOP) or "the round open at submit time" (DSMO).

Fix in phases:
  B1 DONE (PR #16): campaignId nullable FK on both submission
    models, migration additive.
  B2: ONEFOP write path - set campaignId at submit, update
    CampaignSubmission for (campaignId, companyId).
  B3: DSMO write path - same, via the active DSMO round.
  B4: review transitions - approve -> VALIDATED, reject/correction
    -> PENDING.
  No backfill (decided): historical submissions keep NULL
  campaignId. Only new submissions are tracked.

Note: campaign_submissions was created by prisma db push, not a
migration. A database built from migrations alone would not have
it. Same drift class as landing_config.
## Deferred — /admin/campagnes Figma elements without backend support (2026-09-30)

The "Campagnes de Collecte" frame (react-web/docs/figma/collecte/campagnes.png)
shows elements the backend cannot serve today. The rebuild leaves them out, or
shows "—" with a reason, rather than displaying invented numbers:

- **Campaign submission tracking is never updated (backend bug).**
  CampaignService._initializeCampaignSubmissions creates one CampaignSubmission
  row per targeted establishment with status NOT_STARTED at activation.
  Nothing in src/ (and no database trigger in prisma/migrations) ever updates
  those rows when an establishment submits. So `progress.submitted` and
  `progress.completionRate` from GET /campaigns and GET /campaigns/:id/progress
  are always 0. This blocks the frame's "Soumissions collectées 10 128 / 12 847
  attendus", "Avancement global 78.8%", and the history table's "Soumissions"
  and "Taux complétion" columns. The rebuild shows `progress.total` as
  "Établissements ciblés" (accurate) and "—" for collected submissions. Fix:
  update the CampaignSubmission row when a declaration or questionnaire is
  submitted for the campaign's round, or compute progress from the
  submissions themselves. Either is a backend change touching statistics
  (§5), so it needs review.
  UPDATE (2026-09-30): the ONEFOP path is fixed by B2 (PR #17).
  DSMO remains intentionally out of scope — see the ONEFOP-only
  decision section. "Soumissions collectées" / "Taux complétion"
  will now populate for ONEFOP campaigns only.
- "Agents actifs 342 / 380": there is no agent-to-campaign link. Needs a schema
  change.
- "Exporter l'historique" link and the per-row download icon: no export
  endpoint for campaigns.
- "Questionnaires assignés" section counts ("4 sections d'enquête"): section
  counts live in the canonical AST / generated schema, not in any campaign
  endpoint. The panel lists the campaign's module and targetEntityTypes only.
- "Échéancier" third step "Clôture & validation": no date field for it
  (DataCampaign.endDate exists but nothing in the campaign service sets or
  reads it). The panel shows Lancement (startDate) and the effective deadline
  (extendedDeadline ?? deadline).
- History "Période" column ("Oct - Déc 2025"): the covered period is computed
  server-side for notifications but is not returned by GET /campaigns. The
  table shows the campaign name, code and opening/closing dates instead.
- Page title "Campagnes de Collecte": the admin layout renders this route's
  header from PAGE_TITLES ("Gestion des campagnes"). Changing it is a layout
  change.
- Role wording: the task brief described SUPER_ADMIN_DSMO as read-only here,
  but POST /campaigns/:id/activate|pause|close|remind all include
  SUPER_ADMIN_DSMO in @Roles. The page follows the backend (only REGIONAL is
  read-only). If DSMO administrators should not mutate ONEFOP campaigns, that
  is a backend @Roles change, and D2 should be reworded at the same time.

---

## /admin/parametres editable rebuild — not resolved (2026-09-30)

Branch `admin/parametres-rebuild`. The Général identity form is wired
(four new nullable columns, migration
`20260930170000_add_system_settings_identity_fields`, **not applied** —
a human runs `npx prisma migrate deploy`). Still open from the section
"/admin/parametres — Figma editable settings not wirable" above:

- [ ] Campagne active par défaut — campaign activation lives on
      /admin/campagnes; a second "default" needs a product decision.
- [ ] Nombre maximum de fiches par superviseur — no agent/fiche assignment
      model exists, so a stored value would enforce nothing.
- [ ] Délai de soumission (jours) — overlaps campaign deadlines (domain review).
- [ ] Soumission hors-ligne autorisée — no consumer; would need the Flutter
      offline path to read it.
- [ ] Validation automatique des fiches conformes — changes the visa
      workflow (§21, domain review).
- [ ] The identity values are stored and shown only: next-intl's default
      locale and date formatting do not read `defaultLanguage` / `timezone`.
- [ ] SUPER_ADMIN_ONEFOP / SUPER_ADMIN_DSMO can open the page but not
      /system-settings (SUPER_ADMIN only), so they keep the read-only
      display. Widening @Roles is a permission change — not done.

## Schema note — `Subdivision.code` nullability (2026-10-06)

Low priority. Phase 6 candidate, not the establishmentId phase.

- [ ] Consider making `Subdivision.code` NOT NULL (`prisma/schema.prisma`,
      currently `String? @unique`). All 360 subdivisions are coded today, and
      the establishment ID suffix depends on it, so registration needs no
      fallback or rejection path for a missing code. The column constraint
      would keep it that way for subdivisions added later. Schema change —
      needs review per CLAUDE.md §21.

## Assisted registration page — French-only (2026-10-06)

- [ ] The assisted registration page (`react-web/src/app/admin/inscriptions/nouvelle/page.tsx`)
      is French-only; the new email hint and availability line come from
      shared messages (`registerPage.*`), so an admin on the English
      interface sees them in English among French labels. Translating the
      whole page is a ~300-string i18n pass. Deferred — French is the pilot
      language. Revisit if the English interface becomes a real requirement.

## Email handling follow-ups (2026-10-06)

- [ ] Staff account emails keep their typed case. `AuthService.register` and
      `adminCreateMinefopUser` save the email as typed, and their duplicate
      checks are exact-match. Company emails are normalised since 7ff84145;
      lookups are case-insensitive, so staff login is unaffected. Small
      follow-up, low priority.
- [ ] react-web has no unit tests for hooks (its `npm test` runs node tests
      over plain modules). The new `useEmailAvailability`
      (`react-web/src/lib/use-email-availability.ts`) is untested.
      Project-wide limitation, not specific to that change.
- Flutter needs no change for 7ff84145: the `/auth/check-email` response
  shape (`{ available: { available } }`) was kept; only React's reading of
  it was fixed.

## Pre-existing drift: schema.prisma vs the migration history (found 2026-10-06)

- [ ] `prisma migrate diff --from-migrations prisma/migrations
      --to-schema-datamodel prisma/schema.prisma` is not empty (40 lines):
      `establishments` region/department/subdivision foreign keys and the
      `id` default, `submission_drafts` primary key / `id` column, an
      `updatedAt` default, and the `campaign_submissions_campaignId_companyId_key`
      index. Identical with and without 20261011120000, so it predates the
      establishment-serial migration; that migration adds no drift
      (`migrate status` up to date; history -> applied DB diff empty, even
      with sequences created at runtime by establishment_serial_ensure()).
      Found while verifying 20261011120000 on a scratch Postgres 18. Not
      fixed: reconciling it is a schema change and needs review (§21).

## Inscriptions review verification — accepted behaviour (2026-10-06)

Decisions recorded with the review-dialog redesign (e8b5fd2c, 4294b44e,
c75a7ad5, 703ecb89). Not open work; logged so they are not re-raised as gaps.

- A pre-Track B file with an empty required value cannot be approved. The
  panel disables ✓; the API refuses ("Impossible d'approuver : le N° CNPS
  est vide. Demandez une correction."). No legacy files exist today. If one
  appears, it needs a correction first.
- The verification audit snapshot (`details.verification.attested` on
  COMPANY_REGISTRATION_APPROVED) reflects the database values at approve
  time, not the values shown in the dialog. A correction submitted
  mid-review could differ. Acceptable — the approve action commits to the
  database state.
- The legacy Flutter approve (`lib/screens/admin/users_directory_screen.dart`,
  `lib/data/api_client.dart`) sends no body and is refused for every company
  file. Accepted: React is the review surface.
- Auto-approved ADMINISTRATION registrations (COMPANY_REGISTRATION_AUTO_APPROVED)
  bypass the review dialog and carry no verification flags.
