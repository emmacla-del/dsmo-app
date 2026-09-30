# Deferred items

Items that are code-complete or code-pending but not yet verified live,
or that are known issues deferred to a future session. Distinct from
`docs/pending-work.md`, which is auto-generated from `TODO(...)`
comments in the codebase.

Check items off as they're verified or resolved. Add new items at the
top with a date.

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
- [ ] No admin path to change a user's region or department — requires
      direct SQL
- [ ] Dossier detail "Rejeter la Fiche" / "Valider et Archiver" buttons
      render but have no onClick — endpoints exist
      (PATCH /:id/reject, /:id/approve) but aren't called. Dead UI.
- [ ] /admin/diffusion KPI tiles show hardcoded "—" — backend endpoint
      (GET /data-management/stats) exists but isn't wired.
- [ ] /admin/diffusion export history table is fully mocked — no
      endpoint called.
- [ ] Unused AdminQuestionnairesController endpoints with no frontend
      caller: GET /pending, GET /correction-requested, GET /:id

---

## Admin replacement — discovery

- [x] Feature matrix: `docs/admin-replacement/feature-matrix.md`.
      10 screens, 34 capabilities, 38 endpoints inventoried. Risk
      summary at top.