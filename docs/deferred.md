# Deferred items

Items that are code-complete or code-pending but not yet verified live,
or that are known issues deferred to a future session. Distinct from
`docs/pending-work.md`, which is auto-generated from `TODO(...)`
comments in the codebase.

Check items off as they're verified or resolved. Add new items at the
top with a date.

---

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
      render but have no onClick — wired in 012b01de.
- [ ] /admin/diffusion KPI tiles show hardcoded "—" — backend endpoint
      (GET /data-management/stats) exists but isn't wired.
- [ ] /admin/diffusion export history table is fully mocked — no
      endpoint called.
- [ ] Unused AdminQuestionnairesController endpoints with no frontend
      caller: GET /pending, GET /correction-requested (GET /:id is now
      used by the dossier detail page)

      - [ ] Correction resubmission creates a new row with no link to the
      original. For a statistical portal this corrupts response rate,
      coverage, and non-response analysis — one respondent counts as
      two submissions and the corrected version can't be traced to
      its predecessor. Policy decision needed: add originalSubmissionId
      FK, mark the original as superseded, or switch to in-place edit.
      Not blocking; blocking for anyone reading response-rate numbers.
- [ ] `rejectionReason` field is overloaded — stores both rejection
      motives and correction comments. Respondent detail screen shows
      the correction comment as "rejection reason" even after the
      correction cycle ends.
      - [ ] Dossiers export uses fetch+blob on the frontend, not a native
      download. Works but buffers the whole file in browser memory.
      Switch to <a download href="/admin/questionnaires/export?...">
      when convenient.

---

## Admin replacement — discovery

- [x] Feature matrix: `docs/admin-replacement/feature-matrix.md`.
      10 screens, 34 capabilities, 38 endpoints inventoried. Risk
      summary at top.