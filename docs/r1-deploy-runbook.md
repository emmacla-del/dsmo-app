# R.1 deploy and live-test runbook

Covers the registration-approval work on `feat/registration-approval`
(PR #28). Written against that branch at `47bdad7`, with master at
`841743a9`.

What R.1 changes:

- A new 403 contract: `{ code: 'COMPANY_NOT_ACTIVE', status }`
- `ActiveCompanyGuard` applied to company-facing routes
- `POST /auth/resubmit-registration` accepts a correction payload
- React and Flutter: correction form, 403 → status page, sign-out from
  `/auth/me` on 403 `COMPANY_NOT_ACTIVE`
- Approving an `ADMINISTRATION` company requires a server-side
  confirmation flag
- The registration `rejectionReason` is gone from company-facing
  responses

---

## 0. Read this before anything else

Two things in the brief this runbook was written from turned out not to
match the branch. Both change what you do on the day.

### 0.1 BLOCKER — R.1 **does** contain a migration, and the deploy applies it automatically

The branch carries
`prisma/migrations/20261002160000_unique_company_establishment_id/migration.sql`,
which runs:

```sql
CREATE UNIQUE INDEX "companies_establishmentId_key" ON "companies"("establishmentId");
```

Commit `984e1f5` describes it as "NOT applied", which is true of the
commit — but **not** of the deploy. Both `build.sh` (line 11) and
`start.sh` (line 15) run `npx prisma migrate deploy`, and both begin with
`set -e`. So on the first backend deploy after the merge:

1. `prisma migrate deploy` picks the migration up automatically.
2. The migration's own header warns: *"THIS WILL FAIL IF DUPLICATES
   ALREADY EXIST."*
3. If it fails, `set -e` aborts the script and **the whole backend deploy
   fails** — not just the migration.

Step 1.5 below is therefore mandatory, not optional. Do not merge until
it has been run against production and come back clean.

### 0.2 A REJECTED company never reaches the status screen

The brief expects "REJECTED company: login → status screen shows fixed
message". That is not what R.1 does, and the message is correct but
appears somewhere else.

`AuthService.validateUser` throws `UnauthorizedException` for
`status === 'REJECTED'` (after the password check), so the login attempt
**fails** and the fixed message is rendered on the **login screen**:

> Votre demande d'inscription a été rejetée. Pour plus d'informations,
> contactez votre délégation régionale du MINEFOP ou l'ONEFOP.

Commit `47bdad7` deliberately **deleted** the REJECTED branch of both
status screens, because nothing can arrive there any more. A rejected
account that still holds a token from before the decision is signed out
the moment `/auth/me` returns 403 `COMPANY_NOT_ACTIVE`, landing on the
login screen too.

Step 4.4 is written against the real behaviour. If you see a status
screen for a REJECTED company, that is a bug, not a pass.

---

## 1. Pre-deploy

- [ ] **1.1 — `feat/registration-approval` is rebased onto current master**
  - **Action:** `git fetch origin && git log --oneline origin/master..feat/registration-approval`
  - **Expected:** the branch's commits sit on top of the current
    `origin/master` tip, with no master commits missing beneath them.
  - **If it fails:** rebase and re-run the full verification in step 1.4
    before continuing. A stale branch is the most likely source of a
    guard-metadata regression — see the dry-run note in step 5.4.

- [ ] **1.2 — PR #28 is green and reviewed**
  - **Action:** check PR #28 — CI green on the current head, review
    approved, still a draft until you mark it ready.
  - **Expected:** green, approved, head SHA matches your local branch tip.
  - **If it fails:** do not merge. Per `CLAUDE.md` §21 this change needs
    explicit human review: it touches the registration/authorization
    flow, an RBAC-adjacent approval gate, and a Prisma schema change.

- [ ] **1.3 — Record the rollback reference**
  - **Action:** note the **current master tip before merging**
    (`git rev-parse origin/master`) and the Render deploy IDs currently
    live on all three services (step 2).
  - **Expected:** one pre-merge master SHA and three deploy IDs written
    down somewhere outside this terminal.
  - **If it fails:** stop. Step 7 is unusable without these.

- [ ] **1.4 — Verification re-run on the rebased branch**
  - **Action:**
    ```
    npx tsc --noEmit -p tsconfig.json
    JWT_SECRET=test-only-secret npx jest --ci
    cd react-web && npx next typegen && npx tsc --noEmit && npm test
    flutter analyze
    ```
  - **Expected:** tsc exit 0 both layers; jest 47 suites passed / 1
    skipped, 771 passed / 2 skipped; react-web tests 39/39;
    `flutter analyze` 30 info-level lints and exit 1 (see step 8.2).
  - **If it fails:** fix on the branch, not after merging. Note that
    `npm ci` does not work on this repo (the lockfile is out of sync with
    `package.json` — missing transitive `@emnapi/core` / `@emnapi/runtime`);
    use `npm install`. `react-web` typecheck needs `npx next typegen`
    first in a fresh checkout.

- [ ] **1.5 — MANDATORY: pre-flight the unique-index migration against production**
  - **Action:** run `scripts/sql/find-duplicate-establishment-ids.sql`
    against the production database. It is read-only and writes nothing.
  - **Expected:** query 1 (duplicate establishment IDs) returns **zero
    rows**. Query 2's `duplicate_rows` is **0**. Query 3 lists the ACTIVE
    companies with no establishment ID — expected to be about 29.
  - **If it fails (any row from query 1):** **do not merge.** The
    migration will fail and take the backend deploy down with it. Resolve
    the duplicates first, then re-run. Decide the ordering against
    `scripts/backfill-company-establishment-ids.ts` as well: applying the
    index before the backfill is the safer sequence, since the backfill
    then cannot introduce a collision it would only discover at COMMIT.

- [ ] **1.6 — Know what the migration leaves behind**
  - **Action:** read step 7.4 now, before merging, so the rollback story
    holds no surprises.
  - **Expected:** you understand that the unique index **survives a code
    rollback** and that this is accepted.
  - **If it fails:** raise it before merging, not during an incident.

---

## 2. Deploy

Three Render services are involved, not two. `render.yaml` defines only
two of them; the backend is configured in the Render dashboard.

| Service | What it is | Source of config |
|---|---|---|
| `dsmo-app-2` (backend) | NestJS API at `https://dsmo-app-2.onrender.com/api` | Render dashboard — **not** in `render.yaml` |
| `dsmo-react-web` | Next.js, `rootDir: react-web` | `render.yaml` |
| `dsmo-app-frontend` | Flutter web, static | `render.yaml` |

- [ ] **2.1 — Merge to master**
  - **Action:** mark PR #28 ready, then merge it.
  - **Expected:** master advances; note the merge commit SHA.
  - **If it fails:** resolve conflicts on the branch and return to 1.4.

- [ ] **2.2 — Watch the backend deploy log**
  - **Action:** follow the `dsmo-app-2` deploy log in the Render
    dashboard. Watch specifically for the
    `🚀 Running database migrations...` line and what follows it.
  - **Expected:** `prisma migrate deploy` reports the
    `20261002160000_unique_company_establishment_id` migration applied,
    then the NestJS build completes and the service goes live.
  - **If it fails:** if the failure is the `CREATE UNIQUE INDEX`, you have
    duplicate establishment IDs that step 1.5 should have caught — the
    service is down, so roll the backend back (step 7.1) immediately and
    resolve the duplicates before retrying. `set -e` means nothing after
    line 11 of `build.sh` ran, so the old build is still what you are
    reverting to.

- [ ] **2.3 — Watch the React frontend deploy log**
  - **Action:** follow the `dsmo-react-web` deploy log.
  - **Expected:** `npm install && npm run build` succeeds and the service
    goes live. This service has a `buildFilter` on `react-web/**`; R.1
    changes files there, so it **will** rebuild.
  - **If it fails:** roll back this service only (step 7.3). The backend
    and Flutter builds are independent.

- [ ] **2.4 — Watch the Flutter frontend deploy log**
  - **Action:** follow the `dsmo-app-frontend` deploy log.
  - **Expected:** the Flutter SDK clone and `flutter build web --release`
    succeed.
  - **If it fails:** see caveat 8.3 — Render builds with Flutter
    **3.41.5**, which is not the version R.1 was verified against
    locally. A compile error here is most likely a version difference, not
    a logic error. Roll this service back and reproduce against 3.41.5
    before changing code.

- [ ] **2.5 — All three green before any testing**
  - **Action:** confirm all three services report a live, successful
    deploy.
  - **Expected:** three greens.
  - **If it fails:** do not start step 3. Testing against a half-deployed
    stack produces findings you cannot attribute.

---

## 3. Post-deploy smoke — staff

`ActiveCompanyGuard` returns `true` immediately for any
`user.role !== 'COMPANY'` (`active-company.guard.ts:18-20`). **No staff
role can receive 403 `COMPANY_NOT_ACTIVE` by construction.** This section
confirms that empirically; a single 403 here means the guard's role
short-circuit is broken and is a rollback trigger.

Sixteen controllers carry the guard, most of them staff-facing:
`analytics`, `bilan`, `onefop-analytics`, `auth`, `campaign`,
`data-management`, `dsmo`, `minefop-services`, `onefop`, `pilotage`,
`admin-questionnaires`, `questionnaires`, `audit`, `distribution`,
`report`, `system-settings`.

- [ ] **3.1 — SUPER_ADMIN**
  - **Action:** log in, open `/admin/utilisateurs`.
  - **Expected:** page loads with the user list. (`/admin/utilisateurs` is
    restricted to `SUPER_ADMIN` and `SUPER_ADMIN_ONEFOP` via `rawRoles`;
    other staff roles will not see it in the nav and that is correct.)
  - **If it fails with 403 `COMPANY_NOT_ACTIVE`:** rollback trigger —
    step 7. Any other 403 is a pre-existing RBAC matter, not R.1.

- [ ] **3.2 — REGIONAL**
  - **Action:** log in, open `/admin/dossiers`.
  - **Expected:** page loads, scope label reads
    `Régional (<region>)`.
  - **If it fails with 403 `COMPANY_NOT_ACTIVE`:** rollback trigger.

- [ ] **3.3 — DIVISIONAL**
  - **Action:** log in, open `/admin/pilotage`.
  - **Expected:** page loads, titled `Tableau de Bord Territorial`.
    `PilotageController` admits `REGIONAL` and `DIVISIONAL` among its read
    roles.
  - **If it fails with 403 `COMPANY_NOT_ACTIVE`:** rollback trigger.

- [ ] **3.4 — CENTRAL**
  - **Action:** log in, open `/admin/dossiers` and `/admin/inscriptions`.
  - **Expected:** both load. CENTRAL is in `QUEUE_ROLES` for the
    registration queue and is needed again in step 6.
  - **If it fails with 403 `COMPANY_NOT_ACTIVE`:** rollback trigger.

- [ ] **3.5 — Remaining staff roles touched by the guard**
  - **Action:** for whichever of `SUPER_ADMIN_DSMO`,
    `SUPER_ADMIN_ONEFOP`, `DATA_MANAGER`, `CAMPAIGN_MANAGER`, `ANALYST`
    and `AUDITOR` you hold credentials for, log in and open one page each
    role's nav offers.
  - **Expected:** no 403 `COMPANY_NOT_ACTIVE` for any of them. The
    `UserRole` enum has ten non-COMPANY roles in total.
  - **If it fails:** rollback trigger. Record which role and which route.

---

## 4. Post-deploy smoke — company

Run every case on **both** React (`dsmo-react-web`) and Flutter
(`dsmo-app-frontend`).

Routes: React status page `/home/inscription-en-attente`; Flutter status
screen `/inscription-en-attente`; sign-out target `/login` on both.

- [ ] **4.1 — ACTIVE company**
  - **Action:** log in, let the portal load, start and file a declaration.
  - **Expected:** portal loads, declaration submits. No 403 anywhere.
  - **If it fails:** an ACTIVE company being blocked is the most severe
    possible regression — roll back (step 7) rather than investigate live.

- [ ] **4.2 — PENDING_APPROVAL company**
  - **Action:** log in and watch the network tab.
  - **Expected:** login **succeeds** (a PENDING_APPROVAL *company* is
    allowed through `validateUser`; only non-COMPANY roles are refused at
    that status), the status screen renders the "awaiting validation"
    message, and there is **no redirect loop and no generic error
    banner**.
  - **If it fails with a loop:** the active-quarter query is the known
    cause — R.1 disables it for awaiting-approval users in the React home
    layout precisely because that guarded route 403s on every mount and
    bounces the browser back to the page the layout is already
    redirecting to. A loop means that fix regressed.
  - **If it fails with a generic 403 string in Flutter** ("Accès non
    autorisé…"): the `COMPANY_NOT_ACTIVE` branch in `_handleError` is not
    being hit. The guard's body is `{ code, status }` with **no `message`
    key**, so the code check must come before the generic 403 branch.

- [ ] **4.3 — COMPLEMENTS_REQUESTED company**
  - **Action:** log in; read the reviewer's message; confirm the
    correction form prefills; change one field; resubmit.
  - **Expected:** the form appears **only** in this status, prefilled from
    `GET /dsmo/company`; after resubmit the account status becomes
    `PENDING_APPROVAL` and the form disappears.
  - **Also check:** resubmitting with **nothing** changed still succeeds —
    an empty payload is the status flip alone, for a company asked for a
    document rather than an edit.
  - **If the form does not prefill:** `GET /dsmo/company` is exempted for
    `PENDING_APPROVAL` and `COMPLEMENTS_REQUESTED` at **method** level in
    `dsmo.controller.ts`. A 403 on that call means the exemption was lost.
  - **If resubmit returns 400:** the payload carried a key the DTO does
    not allow. The route validates with `forbidNonWhitelisted`; both
    clients build the body field by field for exactly this reason. Check
    the request body in the network tab against
    `ResubmitRegistrationDto`.
  - **If resubmit returns 409:** expected under a race — the status flip is
    conditional on the file still being in `COMPLEMENTS_REQUESTED`.
    Someone else moved the file. Reload and re-read the status.

- [ ] **4.4 — REJECTED company (corrected expectation — see 0.2)**
  - **Action:** attempt to log in as a REJECTED company.
  - **Expected:** login **fails**. The **login screen** shows exactly:
    *"Votre demande d'inscription a été rejetée. Pour plus
    d'informations, contactez votre délégation régionale du MINEFOP ou
    l'ONEFOP."* No status screen is reached, and **no reviewer reason is
    visible anywhere** — not in the message, not in the login response
    body, not on `/auth/me`.
  - **Also check:** if you have a REJECTED account that still holds a
    token from before the decision, open the app with it. Expected: the
    first `/auth/me` returns 403 `COMPANY_NOT_ACTIVE`, the client signs
    out, and you land on `/login`.
  - **If a reviewer reason is visible:** stop and treat it as a data-leak
    regression. `rejectionReason` is in `SECRET_USER_FIELDS` and must not
    appear in any company-facing response; the reason reaches the company
    only in the decision email.
  - **If a status screen renders instead:** a bug — that branch was
    deleted. Capture the response and raise it.

---

## 5. Guard behaviour tests (live)

- [ ] **5.1 — ACTIVE company with no establishmentId**
  - **Action:** using one of the ~29 companies query 3 of step 1.5 listed,
    log in and load the portal.
  - **Expected:** allowed. The guard checks status and `isActive` only and
    deliberately does **not** check `establishmentId`
    (`active-company.guard.ts:49`).
  - **If it fails:** the guard gained an `establishmentId` check it must
    not have. Rollback trigger — this would lock out every company the
    backfill has not yet covered.

- [ ] **5.2 — An arbitrary existing ACTIVE company**
  - **Action:** pick an established ACTIVE company unrelated to R.1
    testing; log in and load the portal.
  - **Expected:** completely unchanged behaviour.
  - **If it fails:** rollback trigger.

- [ ] **5.3 — Status transitions: TEST ENVIRONMENT ONLY**
  - **Action:** **do not** edit company status directly in the production
    database. To exercise a transition, either drive it through the staff
    review UI (approve / reject / request complements), which is the
    supported path, or use a test environment for direct SQL.
  - **Expected:** on production, every status change in this runbook
    arrives through the review queue, not through SQL.
  - **If you need a state production cannot give you:** reproduce it in a
    test environment. A hand-edited production row can leave a company
    inconsistent in ways no screen is built to show.

- [ ] **5.4 — Exemption set is intact (cheap regression check)**
  - **Action:** `JWT_SECRET=test-only-secret npx jest --ci src/auth/active-company.completeness.spec.ts`
    against the merged master.
  - **Expected:** passes. That spec enumerates every route's exemption and
    asserts the exact set — eight exemptions, including
    `DsmoController.getMyCompany: [PENDING_APPROVAL, COMPLEMENTS_REQUESTED]`.
  - **If it fails:** it names the routes that changed. A newly-appearing
    route means an exemption was widened; a disappearing one means an
    exemption was lost. Either is a merge accident worth reverting.

---

## 6. ADMINISTRATION approval

Needs a company whose `entityType` is `ADMINISTRATION` sitting in
`PENDING_APPROVAL` or `COMPLEMENTS_REQUESTED`.

- [ ] **6.1 — Approve without the confirmation flag → 400**
  - **Action:** as `SUPER_ADMIN` or `CENTRAL`, call
    `PATCH /auth/approve-user/:id` directly with an empty body (or
    `{ "centralStructureConfirmed": false }`). Do this at the API level —
    the UI will not let you, which is the point.
  - **Expected:** **400** with
    *"La confirmation « structure centrale » est obligatoire pour
    approuver une administration."* And, critically: **no establishment
    ID is issued, no audit row is written, and the account stays in
    `PENDING_APPROVAL`** — the check runs before the transaction opens.
  - **If the approval succeeds:** the server-side gate is missing. That is
    the whole point of commit `1265376`; treat it as a rollback trigger
    for the backend.
  - **Also worth checking:** `{ "centralStructureConfirmed": "true" }` (a
    string) must **also** be refused. The server requires the strict
    boolean `true`.

- [ ] **6.2 — Approve with the flag → succeeds**
  - **Action:** in `/admin/inscriptions`, open the ADMINISTRATION file,
    tick **"Structure centrale confirmée"**, choose Approuver, confirm.
  - **Expected:** approval succeeds; the account becomes `ACTIVE`; an
    establishment ID is issued with the **`AD`** prefix, matching
    `AD` + 2-digit year + 4-digit serial + 2-digit subdivision code
    (e.g. `AD26000112`).
  - **If the checkbox is absent:** the queue row's
    `requiresCentralStructureCheck` is not coming back true. That flag is
    a UI hint only — the server gate in 6.1 is the real control — but its
    absence makes the file unapprovable through the UI.
  - **If a non-`AD` prefix is issued:** the entity type is not what you
    think it is. Check the company's `entityType` before raising it.

- [ ] **6.3 — A non-ADMINISTRATION approval is unaffected**
  - **Action:** approve an `ENTREPRISE` file the normal way.
  - **Expected:** no checkbox, no flag needed, approval succeeds, `EN`
    prefix issued.
  - **If it now demands a confirmation:** the gate is not scoped to
    `ADMINISTRATION` and is blocking ordinary approvals. Rollback trigger.

---

## 7. Rollback

- [ ] **7.1 — Backend**
  - **Action:** Render dashboard → `dsmo-app-2` → Deploys → the deploy ID
    recorded in step 1.3 → **Redeploy**/rollback.
  - **Expected:** the previous backend build serves again; the 403
    contract reverts to its pre-R.1 shape.
  - **If it fails:** revert the merge commit on master
    (`git revert -m 1 <merge SHA>`) and let a fresh deploy build. Slower,
    but it also restores the source of truth.

- [ ] **7.2 — Flutter frontend**
  - **Action:** same procedure on `dsmo-app-frontend`.
  - **Expected:** previous Flutter web bundle serves again.

- [ ] **7.3 — React frontend only (partial rollback)**
  - **Action:** same procedure on `dsmo-react-web` alone.
  - **Expected:** previous Next.js build serves again, backend untouched.
  - **When to use this:** the backend is healthy and only a React screen
    is broken. The React client tolerates the old 403 shape (it checks for
    `code === 'COMPANY_NOT_ACTIVE'` and falls through otherwise), so an
    older frontend against the new backend degrades rather than breaks —
    a company under review may see a generic error instead of being
    routed to its status page.

- [ ] **7.4 — The database (corrected — see 0.1)**
  - **Action:** nothing, in the normal case. But understand what persists.
  - **Expected:** the brief's "no DB migrations means no data rollback
    needed" does **not** hold. `20261002160000_unique_company_establishment_id`
    will have been applied by the deploy, and **a code rollback does not
    drop the index.** No data is lost or transformed — it is an index, not
    a column change — and leaving it in place is safe: the column stays
    nullable, Postgres permits repeated NULLs, and the pre-R.1 code
    allocated IDs through the same advisory lock and never relied on
    duplicates being possible.
  - **If you must drop it:**
    `DROP INDEX IF EXISTS "companies_establishmentId_key";` plus a manual
    `prisma migrate resolve --rolled-back` so Prisma's history stays
    consistent. Only do this with a specific reason; dropping it removes
    the only database-level protection against two establishments sharing
    a public identifier.

---

## 8. Known caveats to verify post-deploy

- [ ] **8.1 — `/admin/campagnes` stale "Suivi non disponible" text**
  - **Action:** open `/admin/campagnes` and look at the stat hints.
  - **Expected (to be confirmed):** the string *"Suivi non disponible : le
    serveur ne met pas encore à jour les soumissions de campagne"* is
    still present at `react-web/src/app/admin/campagnes/page.tsx:456`. It
    is believed stale after B2, which now does update campaign
    submissions.
  - **If it still shows:** record it as a follow-up. **Not an R.1 deploy
    blocker** — R.1 does not touch that file or that endpoint. Confirming
    whether B2 made it inaccurate needs someone who knows what B2
    shipped; this runbook cannot settle it.

- [ ] **8.2 — `flutter analyze` info lints**
  - **Action:** none. For reference only.
  - **Expected:** `flutter analyze` reports **30 info-level lints and
    exits 1**, in `employee_list_screen.dart`,
    `vt_wizard_spreadsheet_grid.dart` and `pdf_viewer_screen_mobile.dart`.
    This is the pre-existing baseline on master, not an R.1 regression:
    stashing R.1's `lib/` changes and re-running gives the same 30. The
    five Dart files R.1 changes analyze clean.
  - **Not a deploy blocker.** Be aware that any CI gate treating
    `flutter analyze` exit code as pass/fail is already failing on master.

- [ ] **8.3 — Flutter SDK version gap**
  - **Action:** watch step 2.4 closely.
  - **Expected:** `render.yaml` builds the Flutter web app with SDK
    **3.41.5**. R.1's Dart changes were verified locally against **3.35.5**.
    `flutter analyze` and `gen-l10n` were clean there, but the 3.41.5 web
    build has not been exercised against these changes.
  - **If the build breaks:** suspect the version gap first, especially
    around `DropdownButtonFormField` (the correction form uses
    `initialValue`, whose name has moved between recent Flutter versions).

- [ ] **8.4 — `start.sh` seeds the database**
  - **Action:** check which script the backend service actually runs.
  - **Expected:** `start.sh` line 21 runs `node prisma/seed.js || echo
    "⚠️ Seed skipped"`. If the backend's start command is `start.sh`
    rather than `build.sh` + `npm start`, a seed runs on every deploy.
  - **Not introduced by R.1,** but worth knowing before you read anything
    surprising in the post-deploy data. Confirm which script the dashboard
    is configured with while you are in there for step 2.2.

---

## Appendix — quick reference

**The 403 contract**

```json
{ "code": "COMPANY_NOT_ACTIVE", "status": "<UserStatus>" }
```

Thrown by `ActiveCompanyGuard`. Note there is **no `message` key** — any
client branching on `message` will fall through to a generic string.

**Client behaviour on that 403**

| Source | Behaviour |
|---|---|
| `/auth/me` | Sign out → `/login` |
| Any other route | Go to the status page; no-op if already there |

`/auth/me` is exempt for `PENDING_APPROVAL` and `COMPLEMENTS_REQUESTED`,
so a 403 there can only mean `isActive: false` — a rejected or suspended
account still holding a token.

**The eight exemptions** (pinned by `active-company.completeness.spec.ts`)

| Route | Statuses admitted |
|---|---|
| `AuthController.getMe` | any status (`isActive: true` still required) |
| `AuthController.resubmitRegistration` | `COMPLEMENTS_REQUESTED` |
| `AuthController.changePassword` | `PENDING_APPROVAL`, `COMPLEMENTS_REQUESTED` |
| `AuthController.deleteOwnAccount` | `PENDING_APPROVAL`, `COMPLEMENTS_REQUESTED` |
| `AuthController.updatePreferences` | `PENDING_APPROVAL`, `COMPLEMENTS_REQUESTED` |
| `AuthController.setTwoFactor` | `PENDING_APPROVAL`, `COMPLEMENTS_REQUESTED` |
| `AuthController.resendVerification` | `PENDING_APPROVAL`, `COMPLEMENTS_REQUESTED` |
| `DsmoController.getMyCompany` | `PENDING_APPROVAL`, `COMPLEMENTS_REQUESTED` |

`isActive: false` is denied on all of them, unconditionally.

**Establishment ID prefixes**

`ENTREPRISE` `EN` · `COOPERATIVE` `CO` · `CTD` `CT` · `ONG` `ON` ·
`ADMINISTRATION` `AD` · `PROJECT_PROGRAM` `PP` ·
`VOCATIONAL_TRAINING` `VT`

Format: `{prefix}{2-digit year}{4-digit serial}{2-digit subdivision code}`.
