# Territorial Admin Monitoring — Implementation Plan

**Goal:** Give central admins and super admins visibility into territorial
admin activity — field registrations, processing throughput, coverage
against targets — plus a way to nudge stalled admins.

**Scope:** Four phases, ~3–4 days of work. Each phase is independently
verifiable and should be committed separately. Phase 3 ships as a "lite"
version (bell + page + nudge delivery); the broader notification wiring is
deferred to Phase 3-full.

**Status at time of writing:** None of the four phases exist. Three
Prisma columns are populated by nothing. No in-app notification system
exists. Admin-assisted company registration is a genuine gap.

**Reference:** Fact-finding report (2026-10-04) established the baseline.
All four DECISION markers have been resolved — see the "Decisions"
section at the end of this file for the rationale.

---

## Constraints and rules

1. No file outside the paths listed per phase.
2. No Prisma migrations unless a phase explicitly requires one.
   Phase 3 introduces one new table — that is the only migration.
3. Do not touch `lib/**` (Flutter) or `assets/**`. A parallel agent
   works there.
4. Do not touch `react-web/src/app/register/**` or
   `react-web/src/components/auth/**`. Register agent's territory.
5. Commit after each phase. The commit message must name the phase.
6. All DECISION markers are resolved below. Do NOT stop to ask — implement
   the resolved value. If you believe a resolved decision is wrong, stop
   and report why instead of silently overriding.
7. Every phase ends with: `npx tsc --noEmit` clean in both repo root
   and `react-web/`, plus `npx next build` clean in `react-web/`.
8. Do not introduce new local role arrays in the frontend. Every role
   list comes from `react-web/src/lib/roles.ts`.
9. Do not remove the two orphaned Flutter callers of
   `/dsmo/notifications/*` in `lib/data/api_client.dart`. They stay
   until the Flutter side is separately cleaned up.
10. Start Phase 1 only from a clean tree. If `feat/register-step1-simplify`
    has uncommitted work in progress, either wait or branch from `master`.

---

## Phase 1 — Populate the three inert attribution columns

**Why:** `registrationMethod`, `createdBy`, and `assigneeId` on `users`
are migrated, indexed, FK-constrained, listed as secrets, covered by test
fixtures — and written by nothing. They exist because someone intended
this feature. Populate them.

**Estimate:** Half a day.

**Files touched:**
- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/public-user.ts`

### 1a. Thread the actor's id into `adminCreateMinefopUser`

**Problem:** The controller passes only `req.user.role` to the service
(`src/auth/auth.controller.ts:186`). The admin's id is available at the
controller (`req.user.id`) but never forwarded. So `createdBy` cannot be
set.

**Change:**

- `src/auth/auth.controller.ts` — change the call at :186 to pass
  `req.user.id` as a second parameter.
- `src/auth/auth.service.ts:472` — change
  `adminCreateMinefopUser(dto, actorRole)` signature to
  `adminCreateMinefopUser(dto, actorRole, actorId)`.
- Inside the method, at the `user.create` call (:502), set:
  ```ts
  createdBy: actorId,
  registrationMethod: 'ADMIN_CREATED',
  ```
- Update any test that calls this method to include the new parameter.

### 1b. Set `registrationMethod` on the two public paths

- `src/auth/auth.service.ts:419` (`register`) — set
  `registrationMethod: 'SELF_REGISTRATION'` in the `user.create` data.
- `src/auth/auth.service.ts:644` (`registerCompany`) — same value.

`createdBy` stays `null` on both paths — there is no creating admin,
which is correct.

### 1c. Expose `registrationMethod` and `createdBy` on the public user shape

Currently both are in `SECRET_USER_FIELDS` in `src/auth/public-user.ts`,
which is why no client can see them. Move both to the allowlist
(likely `PUBLIC_USER_SELECT`). Keep `assigneeId` secret until Phase 4.

### Verify

- Register a company via the public form. Query the DB:
  ```sql
  SELECT email, "registrationMethod", "createdBy" FROM users
  WHERE email = '<the new account>';
  ```
  Expect `registrationMethod = 'SELF_REGISTRATION'`, `createdBy IS NULL`.
- Log in as superadmin, create a MINEFOP field agent via
  `POST /auth/admin/create-minefop-user`. Query:
  ```sql
  SELECT email, "registrationMethod", "createdBy" FROM users
  WHERE email = '<the new agent>';
  ```
  Expect `registrationMethod = 'ADMIN_CREATED'`, `createdBy` = the
  superadmin's id.

**Commit message:** `feat(auth): populate registrationMethod and createdBy
on all user creation paths`

---

## Phase 2 — Admin-assisted company registration

**Why:** This is the source of "field work" data. Without it, the
dashboard has nothing to count for field activity. It is also the natural
first consumer of `createdBy` and `registrationMethod`.

**Estimate:** 1–2 days.

**Files touched:**
- `src/auth/auth.controller.ts` (new route)
- `src/auth/auth.service.ts` (new method)
- `src/auth/dto/assisted-registration.dto.ts` (new)
- `react-web/src/app/admin/inscriptions/nouvelle/page.tsx` (new)
- `react-web/src/lib/inscriptions.ts` (new client, or add to an existing)
- `react-web/src/app/admin/inscriptions/page.tsx` (add column)
- `react-web/src/app/admin/utilisateurs/page.tsx` (add column)
- `react-web/src/lib/nav-profiles.ts` (add nav entry)

### 2a. Backend endpoint

**New route:** `POST /auth/admin/register-company`

**Auth:** `@UseGuards(JwtAuthGuard, RolesGuard)` with
`@Roles('SUPER_ADMIN', 'ADMIN_ONEFOP', 'REGIONAL_ADMIN',
'DIVISIONAL_ADMIN')`.

**Body:** Same shape as `RegisterCompanyDto` from the public route. Do
NOT add an `assistedMethod` field — the resolved method value is a single
`ASSISTED` (see DECISION 1).

**Behavior:**
- Wraps the existing `registerCompany` logic in
  `AuthService.registerCompany`.
- Sets `createdBy = req.user.id`.
- Sets `registrationMethod = 'ASSISTED'`.
- Sets `assigneeId = req.user.id` — the admin who registered it owns
  the follow-up.
- Sets `status = 'PENDING_APPROVAL'` — assisted registrations queue for
  approval like self-service ones (see DECISION 2).
- Returns the temporary password in the response body, once, like
  `adminCreateMinefopUser` does.

### 2b. Frontend — admin-assisted registration page

**New page:** `react-web/src/app/admin/inscriptions/nouvelle/page.tsx`

**Form:** Same fields as the register wizard's company step, but
single-page (admins aren't respondents — they need speed, not a wizard).
Pre-select the admin's own region/department where possible.

**On submit:**
- Call `POST /auth/admin/register-company`.
- Show the temporary password once, in a modal, with copy-to-clipboard.
- Note on screen: *"Cette inscription sera soumise à validation comme
  une inscription auto-service. Le demandeur pourra se connecter une
  fois approuvé."*
- Offer a "Nouvelle inscription" reset button.

**Role gating:** `DIRECTORY_ROLES`. Add to `nav-profiles.ts` under the
"declarants" hub for those roles.

### 2c. Surface attribution in existing admin pages

- `/admin/inscriptions` — add a "Enregistré par" column showing
  `createdBy` resolved to a display name, and a badge for
  `registrationMethod`.
- `/admin/utilisateurs` — same treatment on the staff table.

### Verify

- Register a company as a REGIONAL_ADMIN via the new page.
- Query the DB: `registrationMethod = 'ASSISTED'`,
  `createdBy = admin.id`, `assigneeId = admin.id`,
  `status = 'PENDING_APPROVAL'`.
- The company appears in `/admin/inscriptions` with the admin's name
  and an "Assisté" badge, in the pending queue.
- After approval, the company can log in with the temp password.

**Commit message:** `feat(auth): admin-assisted company registration
with field attribution`

---

## Phase 3 — In-app notifications (lite)

**Why:** "Relancer" (nudge) has no channel to travel on. The existing
`notifications` table is an outbound-email audit log — per-company, not
per-user, no inbox, no read state. Email is unreliable on this
deployment. We need an in-app notification a user sees when they log in.

**Why lite:** The full version (notify on approval, rejection,
complements, assignments, etc.) is 2–3 days. The lite version — just
enough for the Phase 4 nudge to work — is half a day. Ship lite, expand
later once you've used it.

**Estimate:** Half a day.

**Files touched:**
- `prisma/schema.prisma` (new model) + hand-written migration
- `src/notifications/notifications.service.ts` (new)
- `src/notifications/notifications.controller.ts` (new)
- `src/notifications/notifications.module.ts` (new)
- `src/app.module.ts` (register module)
- `react-web/src/components/admin/NotificationBell.tsx` (new)
- `react-web/src/components/admin/AdminHeaderActions.tsx` (mount bell)
- `react-web/src/app/admin/notifications/page.tsx` (new page)
- `react-web/src/lib/notifications-inbox.ts` (new client)

### 3a. New Prisma model

```prisma
model UserNotification {
  id        String   @id @default(uuid())
  userId    String
  kind      String   // 'NUDGE' | 'ASSIGNMENT' | 'APPROVAL' | ...
  subject   String
  body      String   @db.Text
  linkHref  String?  // optional in-app link target
  readAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@index([userId, createdAt])
  @@map("user_notifications")
}
```

Add the back-relation on `User`:
```prisma
userNotifications UserNotification[]
```

This is the only migration in this plan. Use the hand-written migration
pattern used in this repo (54 existing hand-written timestamped
migrations) — do not use `prisma migrate dev`.

### 3b. Notification service

**New file:** `src/notifications/notifications.service.ts`

Methods:
- `create(userId, kind, subject, body, linkHref?)`
- `listForUser(userId, opts: { unreadOnly?: boolean, limit?: number })`
- `markRead(userId, notificationId)`
- `unreadCount(userId)`

Every write is fire-and-forget at the call site. A failed notification
must never break the primary action.

**For Phase 3-lite, wire `create()` into exactly one place:**

- The Phase 4 nudge endpoint (which doesn't exist yet — leave a
  `TODO(phase-4): call NotificationsService.create here` at
  `src/report/audit.controller.ts` where the nudge route will go).

That's it. Do NOT wire approval/rejection/complements notifications yet.
Those come in Phase 3-full, described at the end of this file.

### 3c. Endpoints

**New controller:** `src/notifications/notifications.controller.ts`

Three routes:

- `GET /auth/me/notifications` — the caller's list. Query param
  `unreadOnly` (boolean) and `limit` (default 50).
- `GET /auth/me/notifications/unread-count` — for the bell badge
  (returns `{ count: number }`).
- `PATCH /auth/me/notifications/:id/read` — marks one as read.

All guarded by `JwtAuthGuard`. No `@Roles` — every authenticated user
can read their own notifications. The service must filter by
`userId = req.user.id` on every call — a user cannot read or mark
another user's notifications.

**Deliberately omitted for v1:** `PATCH /auth/me/notifications/read-all`.
Users mark each notification read by clicking it. Add mark-all-read in
Phase 3-full if it turns out to be needed.

### 3d. Frontend — bell icon + notifications page

**New component:** `react-web/src/components/admin/NotificationBell.tsx`

- Reads `GET /auth/me/notifications/unread-count` on a 30s interval,
  matching `AdminLayout`'s existing polling pattern.
- Renders a bell icon with a small badge showing the unread count
  when > 0. Badge is hidden when count is 0.
- Clicking the bell navigates to `/admin/notifications`. No dropdown.

**New page:** `react-web/src/app/admin/notifications/page.tsx`

- Lists the caller's notifications, newest first.
- Each row shows subject, body, timestamp, and a "Voir" link if
  `linkHref` is set.
- Clicking a row marks it read (`PATCH .../read`) and navigates to
  `linkHref` if present.
- Read notifications render dimmed.
- Empty state: "Aucune notification."
- Route gating: any authenticated user (no `allowedRoles` in
  `_routes.ts` for this entry, or an explicit list of all staff roles).
  Company users should also see it — they'll receive approval
  notifications in Phase 3-full, and having the page exist now saves
  re-plumbing later.

**Mount the bell in** `react-web/src/components/admin/AdminHeaderActions.tsx`,
replacing the dead red dot removed in Commit 5.

### 3e. Drive-by fix — DIVISIONAL_ADMIN scoping bug

`src/dsmo/notification.service.ts:360` matches a DIVISIONAL_ADMIN's
`department` against `regionFilter`. There is a `departmentFilter`
column right next to it. Fix it while you're in the notification area —
one line, prevents a real bug from reaching production.

### Verify

- Insert a notification row manually for the superadmin:
  ```sql
  INSERT INTO user_notifications (id, "userId", kind, subject, body)
  VALUES (gen_random_uuid()::text, '<superadmin-id>', 'NUDGE',
          'Test', 'Ceci est un test.');
  ```
- Log in as superadmin. Bell shows "1".
- Click the bell. Lands on `/admin/notifications`. The row is listed.
- Click the row. Badge count drops to 0.
- Log out and back in. Badge is 0.

**Commit message:** `feat(notifications): in-app notification system
(bell + page)`

---

### Phase 3-full (deferred — do NOT implement now)

This is what Phase 3-lite deliberately leaves out. Ship it as its own
commit once Phase 3-lite is in production and you've used it.

**Additional scope:**

- Wire `NotificationsService.create()` into:
  - `AuthService.approveUser` (:945) — notify the approved user
  - `AuthService.rejectUser` (:967) — notify the rejected user
  - `AuthService.requestComplements` — notify the user
  - `AuthService.approveCompanyRegistration` (:1548) — notify
  - Any dossier assignment (Phase 4 does not currently assign — this
    would be a future feature)
- Add `PATCH /auth/me/notifications/read-all` and the corresponding
  button on the notifications page.
- Optional: replace the click-to-navigate bell with a dropdown panel
  that previews the last 5 notifications inline, if the page navigation
  feels heavy in practice.

**Do not implement Phase 3-full in the same session as Phase 3-lite.**
Commit lite first, verify it works, then schedule full as a separate
piece of work.

---

## Phase 4 — Territorial admin monitoring dashboard

**Why:** This is the whole point. Central admins and super admins need to
see who's stalled, who's productive, and reach the region's targets.

**Estimate:** 1 day (assuming Phase 2 and 3 are done).

**Files touched:**
- `src/report/audit.controller.ts` (new route)
- `src/report/report.service.ts` or new `actor-summary.service.ts`
- `react-web/src/app/admin/equipe/page.tsx` (new)
- `react-web/src/lib/actor-summary.ts` (new client)
- `react-web/src/app/admin/_routes.ts` (route entry)
- `react-web/src/lib/nav-profiles.ts` (nav entry)

### 4a. Backend — actor summary endpoint

**New route:** `GET /audit/actor-summary`

**Query params:** `period` (7d | 30d | 90d | 12m, default 30d),
`role` (filter to REGIONAL_ADMIN / DIVISIONAL_ADMIN / etc.),
`region`, `department`.

**Auth:** `@Roles('SUPER_ADMIN', 'ADMIN_ONEFOP', 'REGIONAL_ADMIN')`.
Regional admins only see their own region's admins.

**Response shape:**
```json
{
  "periodStart": "2026-09-04T00:00:00Z",
  "periodEnd": "2026-10-04T00:00:00Z",
  "actors": [
    {
      "userId": "...",
      "displayName": "Jean Dupont",
      "role": "REGIONAL_ADMIN",
      "region": "Littoral",
      "department": null,

      "lastActionAt": "...",

      "field": {
        "registrationsMade": 34,
        "conversions": 12,
        "conversionRate": 0.35,
        "lastRegistrationAt": "..."
      },

      "coverage": {
        "target": 500,
        "current": 340,
        "percent": 0.68
      },

      "processing": {
        "backlog": 12,
        "stale": 4,
        "decisions": {
          "approved": 87,
          "rejected": 6,
          "corrections": 12
        },
        "medianDaysToDecision": 1.8
      }
    }
  ]
}
```

Note: no `byMethod` breakdown — the resolved method enum has only one
assisted value (`ASSISTED`), so there's nothing to break down. No
`lastLoginAt` field — see DECISION 4.

**Data sources:**
- `field.*` → `users` filtered by `createdBy = actor.id`, joined to
  `onefop_submissions` for conversions.
- `coverage.*` → reuse `PilotageService.getCoverage` logic.
- `processing.*` → `audit_logs` grouped by actor, plus a count of
  dossiers currently assigned to them.

### 4b. Frontend — `/admin/equipe` page

**New page:** `react-web/src/app/admin/equipe/page.tsx`

**Layout:** One row per admin, with three sections:

- **Travail de terrain** — registrations made, conversions, last
  registration
- **Ressort — Cible & Couverture** — target, current, percentage bar
- **Traitement** — backlog, stale count, decisions, median time

Each row ends with three actions:
- **Relancer** — opens a modal to send a notification with context
- **Voir le journal** — navigates to `/admin/journal-audit?actor=<id>`
- **Voir les inscriptions** — navigates to `/admin/inscriptions?createdBy=<id>`

**Filters at top:** period, role, region.

**Sort:** default by "stale count desc" so the worst cases are first.

**Role gating:** `SUPER_ADMIN`, `ADMIN_ONEFOP`, `REGIONAL_ADMIN`. Add
to `nav-profiles.ts` under the "administration" hub for those roles.
Route entry in `_routes.ts` with `allowedRoles`.

### 4c. "Relancer" action

- **New endpoint:** `POST /audit/nudge`
- **Body:** `{ userId, template, customMessage? }`
- **Templates:**
  - `STALE_BACKLOG` — "Vous avez N dossiers en attente depuis plus de 7 jours."
  - `BEHIND_TARGET` — "Votre région est à X% de la cible 2026."
  - `NO_RECENT_ACTIVITY` — "Aucune décision enregistrée sur votre compte depuis N jours."
- **Behavior:** calls `NotificationsService.create()` with the resolved
  message. Returns the created notification's id.
- **Frontend:** modal with template selector + optional free text +
  "Envoyer" button.

### 4d. Coverage from targets — note on empty data

`territory_targets` is currently empty. The `/admin/cibles` page exists
and works — it just has no rows. Nothing to build here. But the
dashboard will show "—" everywhere until targets are set. Flag this to
whoever owns the targets.

### Verify

- Log in as superadmin, open `/admin/equipe`.
- See one row per territorial admin, with whatever data exists.
- Click "Relancer" on a row, pick a template, send.
- The target admin sees the notification in their bell.
- Click "Voir le journal" — lands on the audit log filtered by that
  actor.

**Commit message:** `feat(admin): territorial admin monitoring dashboard
with nudge action`

---

## Rollout sequence

1. **Phase 1** — commit.
2. **Phase 2** — commit.
3. **Phase 3** — commit. Phase 3-lite only. Phase 3-full is a separate
   piece of work, deferred until lite is in use.
4. **Phase 4** — commit.

Do not start Phase N+1 until Phase N is verified and committed. Do not
batch all four into one commit.

---

## What this plan does NOT do

- Does not fix the `getNotifications` DIVISIONAL_ADMIN bug as its own
  commit. It is a one-line drive-by fix in Phase 3e. If you want it
  separated, extract it.
- Does not implement SMS or push notifications. The User columns exist
  (`smsNotificationsEnabled`, `pushNotificationsEnabled`) but nothing
  reads them. Out of scope.
- Does not touch the Flutter admin app. The DSMO notification client
  there is orphaned from React but still used by Flutter. Separate
  cleanup.
- Does not define what "performance" means beyond raw activity. No
  composite scores. No rankings. The dashboard shows numbers; the human
  reads them.
- Does not send emails as a fallback for notifications. In-app only, by
  design. Users see a notification when they next log in.
- Does not auto-approve assisted registrations. They queue like
  self-service ones — see DECISION 2.

---

## Decisions (resolved)

All four DECISION markers have been resolved. The implementing agent
must follow these. If any is believed wrong, stop and report rather
than silently overriding.

### DECISION 1 — `registrationMethod` values

**Resolved:** Ship three values, not five:
```
SELF_REGISTRATION
ADMIN_CREATED
ASSISTED
```

**Rationale:** The column is `text`, so adding values later costs
nothing. `FIELD_ASSISTED` / `PHONE_ASSISTED` / `BULK_IMPORTED` describe
features or channels that have no current consumer and no current code.
Adding them speculatively creates schema rot.

**Revisit if:** after 3 months, the dashboard's field-activity view
would benefit from distinguishing visit vs phone. At that point add
`FIELD_ASSISTED` and `PHONE_ASSISTED` alongside `ASSISTED` — the column
accepts them without migration.

### DECISION 2 — does an assisted registration need approval?

**Resolved:** Queue for approval, do NOT auto-approve, in v1.

**Rationale:** The field error rate is unknown. Assisted registrations
carry the highest data-integrity stakes (the company did not fill in
its own details) and should not be trusted with less oversight than
self-service. Reversing "auto-approve" later would require auditing
already-live historical registrations; reversing "queue" is a config
change.

**Revisit if:** after 2 months, the field rejection rate is below 5%.

### DECISION 3 — notification types in v1

**Resolved:** Phase 3-lite ships `NUDGE` only. Phase 3-full deferred.

**Rationale:** The nudge is the only notification the dashboard
requires. Adding approval / rejection / complements notifications later
is additive — the model has a `kind` column that accepts new values
without migration.

**Revisit if:** after using the dashboard for a month, users ask why
they were not notified of an approval that had already occurred.

### DECISION 4 — does the dashboard show `lastLoginAt`?

**Resolved:** Show `lastActionAt` only. Do NOT surface `lastLoginAt`.

**Rationale:** `lastActionAt` measures output. `lastLoginAt` measures
presence. Showing presence invites "you logged in but did not work"
conversations and creates an incentive to log in without doing
anything. No signal is lost: if an admin has not worked in weeks,
`lastActionAt` shows it.

**Revisit if:** never. This is a design principle, not a fallback.

---

## Preconditions before starting Phase 1

1. **Register agent branch is clean.** `feat/register-step1-simplify`
   must have no uncommitted work, or Phase 1 must start from a fresh
   branch off `master`.
2. **Superadmin account exists** so verification steps can log in.
3. **Backend and frontend dev servers can start** (`npm run start:dev`
   in root, `npm run dev` in `react-web/`).

If any precondition fails, stop and report — do not work around it.

---

## Fast path (optional, if you want value sooner)

Do Phase 1 + a stripped Phase 4 that shows only **processing** and
**coverage** — skip the field section, skip the nudge button. No Phase
2 or Phase 3 required. Result: a working `/admin/equipe` page with one
row per admin, showing:

- Decisions per admin in the period
- Backlog + stale count
- Region coverage vs. target

That is roughly one day of work (Phase 1 half-day, stripped Phase 4
half-day). Phases 2 and 3 are deferred indefinitely.

To use the fast path, drop Phase 4's `field` section and skip the
"Relancer" action and its endpoint. Phase 1 is still required so that
`createdBy` and `registrationMethod` are populated for future use.