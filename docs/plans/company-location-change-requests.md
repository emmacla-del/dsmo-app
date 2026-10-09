# Company Location Change Requests — Implementation Plan

**Goal:** An ACTIVE company can file a "Signaler un changement d'adresse"
request (new region / department / subdivision, optional address, reason).
Nothing changes until an authorised reviewer approves; on approval the
Company record and its denormalised copies change in one transaction with an
immutable audit entry. Past submissions keep their stamped geography.
Rejections carry a reason. The respondent sees the status and reason.

**Scope:** 5 phases, ~4.5 days, one commit each — P0 close the existing
self-service loophole, P1 backend model + API, P2 reviewer UI, P3
respondent UI, P4 in-app notifications. Backend (`src/`, `prisma/`) and
React (`react-web/`) only; no `lib/**` (Flutter) change, and Flutter must
keep working.

**Why:** a company's geography is the security boundary for reviewer scope
(CLAUDE.md §14). The React wizard shows Section 1 geography read-only
(d6b74c23) and tells respondents to report errors to their delegation
(4056f088), but there is no in-app way to get a wrong or outdated location
corrected, and a self-service edit would let a company move itself between
jurisdictions without either side agreeing.

**Status at time of writing (2026-10-09, verified):**

1. **A self-service territory loophole already exists — closed first (P0).**
   `POST /dsmo/company` (`src/dsmo/dsmo.controller.ts:38-42`,
   `@Roles('COMPANY')`) → `DsmoService.saveCompanyProfile`
   (`src/dsmo/dsmo.service.ts:295-352`) writes the client-sent territory
   (and `name`, `taxNumber`, **`entityType`**) into the existing Company via
   `upsert.update` (`:337-342`). `POST /dsmo/declaration` →
   `createOrUpdateCompany` (`:356+`) does the same from `dto.company`.
   - Territory: an ACTIVE company can move jurisdictions today.
   - `entityType`: a company can change its own instrument type, which
     undoes the D9 check on ONEFOP submit (submitted entityType must match
     `company.entityType`). Added to P0 by review.
   - Callers: React `NewDeclarationDialog.tsx:172` (resends own values);
     Flutter `lib/screens/home_screen.dart:611` (region/department, no
     subdivision — likely already failing with `requireSubdivision`);
     Flutter `lib/screens/settings_screen.dart:90` (name/phone/address only —
     already fails DTO validation; pre-existing, out of scope).
2. **Registration resubmit loop is not reusable.** `resubmitRegistration`
   (`src/auth/auth.service.ts:1299-1451`) only runs in
   `COMPLEMENTS_REQUESTED`, flips the account to `PENDING_APPROVAL`
   (locking it out of `ActiveCompanyGuard` routes), re-runs identity
   verification on re-approval (`:1688-1700`) and **creates a new principal
   Establishment** (`:1722-1739`) — a duplicate for an approved company. It
   stays the path for not-yet-approved companies.
3. **Geography columns.** `Company` has name strings
   (`prisma/schema.prisma:249-251`) and nullable FKs `regionId /
   departmentId / subdivisionId` (`:265-267`); both are written. The company
   `User` row carries `region` / `department` (`auth.service.ts:705-706`).
   `Establishment` (`schema.prisma:339-381`) carries FKs + names; the
   principal one is copied from Company at approval.
4. **Other tables carrying geography:**

   | Table | On approval | Why |
   |---|---|---|
   | `companies` | **update** | the authority |
   | `users` (company account) | **update** `region`, `department` | denormalised copy |
   | `establishments` (principal) | **update** | campaign targeting reads it (`src/campaign/campaign.service.ts:924-934`) |
   | `establishments` (other sites) | untouched | different physical sites |
   | `onefop_submissions` | untouched | stamped at submit (`questionnaires.service.ts:767-773`) — historical |
   | `declarations` (DSMO) | untouched | stamped at submit — historical |
   | `campaign_submissions` | follows company via relation | DECISION 7 |
   | `campaign_quotas`, `onefop_anomalies` | untouched | targets / follow submission |

   `Company.establishmentId` and the principal `Establishment.code` embed
   the old subdivision code and are permanent public identifiers
   (DECISION 6).
5. `relocationLocality` (`schema.prisma:1193`) is a VT questionnaire answer
   (VT3_6, emergencies) — unrelated, untouched.
6. **Scope enforcement.** `src/auth/territory.ts`: `territoryWhere` (read;
   CENTRAL_AGENT national) and `assertTerritorialAuthority` (write;
   national = SUPER_ADMIN, ADMIN_ONEFOP only, so CENTRAL_AGENT is refused).
   `src/auth/staff-scope.ts`: `TERRITORIAL_APPROVER_ROLES`,
   `USER_ADMIN_ROLES`, `READ_ONLY_NATIONAL_ROLES`. The CENTRAL_AGENT
   read-only contract is enforced by `src/auth/central-agent-read-only.spec.ts`.
7. **Audit.** `AuditLog` (`schema.prisma:583-607`), written inline with
   `tx.auditLog.create`, append-only by convention. UI labels in
   `react-web/src/lib/audit-log.ts`.
8. **Notifications.** `UserNotification` (`schema.prisma:564-581`, free-text
   `kind` — no migration); `NotificationsService.create`
   (`src/notifications/notifications.service.ts:34`); inbox
   `/auth/me/notifications`. React has a bell on the admin side only.
9. **No upload mechanism** exists in `src/` (no multer / `FileInterceptor`).
10. **React.** `/home/[slug]` is a placeholder; the COMPANY nav has a
    `settings` item with no route (`react-web/src/lib/role-navigation.ts:78`).
    Admin review pattern: `react-web/src/app/admin/inscriptions/page.tsx`.
11. **Migrations** are applied on every Render deploy from `master`
    (`build.sh:11`). Partial unique indexes are hand-written SQL (precedent:
    `prisma/migrations/20260909100000_add_onefop_submission_duplicate_guard`).

---

## Constraints

1. **P1's migration and the RBAC matrix need explicit owner approval
   (CLAUDE.md §21) before commit.** Once pushed to `master`, Render applies
   it; rollback is a new forward migration.
2. No `lib/**` changes. `POST /dsmo/company`, `POST /dsmo/declaration` and
   `GET /dsmo/company` keep their request/response shapes and keep returning
   2xx where they do today.
3. Every new thrown message gets a `{ fr, en }` entry in
   `src/common/i18n/error-messages.ts` (enforced by its spec).
4. All authorization is server-side; React only reads a server-computed
   `canDecide`.
5. Never raise a baseline in `react-web/scripts/ui-grammar-baseline.json`.
6. React role lists only from `react-web/src/lib/roles.ts`.
7. Each phase ends with `npx tsc --noEmit` (root and `react-web/`),
   backend `npx jest --runInBand`, `npx next build` and
   `npm run check:ui-grammar` in `react-web/`.
8. No email dependency (SMTP/Resend unreliable in this deployment).

## Data model (P1 — needs owner approval)

```prisma
enum LocationChangeStatus { PENDING APPROVED REJECTED CANCELLED }
enum LocationChangeLevel  { DEPARTMENT REGION NATIONAL }  // who must decide; frozen at creation

model CompanyLocationChangeRequest {
  id                String               @id @default(uuid())
  companyId         String
  requestedBy       String               // company User.id
  status            LocationChangeStatus @default(PENDING)
  requiredLevel     LocationChangeLevel
  // Snapshot of the location when requested (historical; no FK)
  fromRegion        String
  fromDepartment    String
  fromSubdivision   String
  fromRegionId      String?
  fromDepartmentId  String?
  fromSubdivisionId String?
  fromAddress       String
  // Requested location, resolved server-side against the canonical tables
  toRegionId        String
  toDepartmentId    String
  toSubdivisionId   String
  toRegion          String
  toDepartment      String
  toSubdivision     String
  toAddress         String?              // null = keep current address
  reason            String               @db.Text
  decidedBy         String?
  decidedAt         DateTime?
  decisionComment   String?              @db.Text  // required on REJECTED
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  company          Company     @relation(fields: [companyId], references: [id], onDelete: Restrict)
  requester        User        @relation("LocationChangeRequestedBy", fields: [requestedBy], references: [id], onDelete: Restrict)
  decider          User?       @relation("LocationChangeDecidedBy", fields: [decidedBy], references: [id], onDelete: Restrict)
  toRegionRef      Region      @relation(fields: [toRegionId], references: [id], onDelete: Restrict)
  toDepartmentRef  Department  @relation(fields: [toDepartmentId], references: [id], onDelete: Restrict)
  toSubdivisionRef Subdivision @relation(fields: [toSubdivisionId], references: [id], onDelete: Restrict)

  @@index([companyId])
  @@index([status, createdAt])
  @@index([requestedBy])
  @@index([decidedBy])
  @@map("company_location_change_requests")
}
```

Back-relations on `Company`, `User` (two), `Region`, `Department`,
`Subdivision`. Migration is additive only, plus a hand-appended partial
unique index for "one open request per company":

```sql
CREATE UNIQUE INDEX "company_location_change_requests_one_pending"
  ON "company_location_change_requests"("companyId") WHERE "status" = 'PENDING';
```

Columns rather than JSON (CLAUDE.md §6), so both sides can be scoped,
filtered and audited.

## Authorization matrix (needs owner approval)

Required level, computed at creation from the company's current location
(ids, falling back to case-insensitive names): same department →
**DEPARTMENT**; other department, same region → **REGION**; other region →
**NATIONAL**.

| Action | COMPANY | DIVISIONAL | REGIONAL | ADMIN_ONEFOP / SUPER_ADMIN | CENTRAL_AGENT |
|---|---|---|---|---|---|
| Create request | own company, ACTIVE | — | — | — | — |
| View own / cancel own PENDING | yes | — | — | — | — |
| List / view requests | — | company currently in own department | company currently in own region | national | national, read-only |
| Decide, level DEPARTMENT | — | yes (current dept) | yes (current region) | yes | no |
| Decide, level REGION | — | read-only ("Décision régionale requise") | yes (current region) | yes | no |
| Decide, level NATIONAL | — | — | read-only | yes | no |

The **target jurisdiction sees nothing while a request is pending**: list
scope is `territoryWhere` on the company's *current* columns, which do not
change until approval. Decision routes run `assertTerritorialAuthority`
plus a new `assertCanDecideLevel(role, requiredLevel)`; GET routes alone
carry `READ_ONLY_NATIONAL_ROLES`.

## API (new module `src/company-location/`)

| Method & path | Roles | Body | Errors |
|---|---|---|---|
| `GET /company-location-requests/mine` | COMPANY | — | 404 no company profile |
| `POST /company-location-requests` | COMPANY | `{ regionId, departmentId, subdivisionId (UUID); address? ≤300; reason 10..1000 }` | 400 identical location / reason; territory-resolver errors; 409 already pending |
| `PATCH /company-location-requests/:id/cancel` | COMPANY (own) | — | 404 (also for others' ids); 409 processed |
| `GET /company-location-requests` | USER_ADMIN, TERRITORIAL_APPROVER, READ_ONLY_NATIONAL | `status?` (default PENDING), paging, `search?` | — |
| `GET /company-location-requests/:id` | same | — | 404 out of scope (no existence leak) |
| `PATCH /company-location-requests/:id/approve` | USER_ADMIN, TERRITORIAL_APPROVER | `{ comment? }` | 404; 403 level; 409 processed; 409 stale location |
| `PATCH /company-location-requests/:id/reject` | same | `{ reason }` (required) | 400; 404; 403; 409 |

**Approval transaction:** conditional `updateMany({ id, status: PENDING })`
(0 rows → 409); re-read company and compare with `from*` (differs → 409
stale); re-run `resolveAndValidateTerritory`; update company, company user,
principal establishment; write `COMPANY_LOCATION_CHANGE_APPROVED` audit row
(before/after, reason, comment, request id). Never touches
`onefop_submissions`, `declarations` or `campaign_submissions`. Other
transitions write `_REQUESTED`, `_REJECTED`, `_CANCELLED` audit rows in the
same transaction.

## Phases

### Phase 0 — Lock territory and entity type on existing company write paths (security fix; no migration)

**Why:** without it the review is meaningless — a company could bypass it
through `POST /dsmo/company` or a DSMO declaration, and could change its own
`entityType` to submit a different ONEFOP instrument.

**Estimate:** half a day. **Files:** `src/dsmo/dsmo.service.ts`, new
`src/dsmo/company-territory-lock.spec.ts`.

1. `lockedTerritoryOr(existing, resolved)`: when the existing Company has
   all three ids (the same "all three levels" condition as the ONEFOP
   override, `questionnaires.service.ts:745`), keep the stored six fields
   and ignore the sent ones; otherwise accept the resolved territory so
   legacy companies can still complete their profile.
2. Apply it in the `update` branch of `saveCompanyProfile` and
   `createOrUpdateCompany`; `create` unchanged.
3. `entityType`: on `update`, ignore a value that differs from a non-null
   stored `entityType` (DECISION 14).
4. When a differing value is ignored, write an audit row
   `COMPANY_TERRITORY_CHANGE_IGNORED` / `COMPANY_ENTITY_TYPE_CHANGE_IGNORED`
   with `{ sent, kept }`.
5. Validation still runs (garbage territory still 400s).

**Tests:** complete company + different territory → kept + audited; same
territory → no audit row; incomplete company → filled; DSMO declaration path
→ kept; stamped `Declaration.region` equals stored region; entityType change
ignored + audited; first-time entityType set still works.

### Phase 1 — Model, API, service, tests (MIGRATION — owner approval first)

**Estimate:** 1.5 days. **Files:** `prisma/schema.prisma`, new migration,
`src/company-location/**`, `src/auth/staff-scope.ts`
(`requiredLevelFor`, `assertCanDecideLevel`), `src/app.module.ts`,
`src/common/i18n/error-messages.ts`, `src/auth/central-agent-read-only.spec.ts`.

`prisma migrate dev --create-only`, hand-append the partial index, **stop
for owner approval before committing.**

**Tests:** level computation (3 cases + name fallback); identical location
400; second pending 409 (pre-check and P2002); scope — target-department
DIVISIONAL lists 0 rows, origin DIVISIONAL sees a REGION-level row with
`canDecide=false`, other-region REGIONAL gets 404; approve matrix per role ×
level, CENTRAL_AGENT blocked; approval writes company + user + principal
establishment + one audit row and never calls submission/declaration
writes; stale and concurrent approval 409; reject without reason 400;
cancelling another company's request 404.

### Phase 2 — Reviewer UI

**Estimate:** 1 day. **Files:** new
`react-web/src/app/admin/changements-adresse/page.tsx`,
`react-web/src/app/admin/_routes.ts` (hub "Déclarants", `DIRECTORY_READ_ROLES`),
`react-web/src/lib/api-client.ts`, `react-web/src/lib/audit-log.ts`,
`react-web/messages/{fr,en}.json`.

Built on the reference page grammar (`admin/campagnes/page.tsx`) and the
inscriptions pattern: header, status filter (default "En attente"),
`.cam-table` (établissement + ID, from → to, niveau requis, date, statut),
`AdminDialog` for approve (optional comment) and reject (required reason).
Actions only when `row.canDecide`; otherwise a muted "Décision régionale /
centrale requise". Server errors shown as returned (localized).

### Phase 3 — Respondent UI

**Estimate:** 1 day. **Files:** new `react-web/src/app/home/settings/page.tsx`,
`react-web/src/lib/role-navigation.ts` (route for the COMPANY `settings`
item), new `react-web/src/components/company/LocationChangeSection.tsx`,
`CameroonGeographySelector.tsx`, `VtWizardFields.tsx`, messages, api-client.

"Mon établissement": read-only identity and current location; a
"Localisation" section with the latest request's status and reason, "Annuler
la demande" while pending, and "Signaler un changement d'adresse" (disabled
while pending) opening an inline form (editable `CameroonGeographySelector`,
address, reason). Respondent-surface grammar: one primary action, no cards.
The wizard's Section 1 note gains a link to `/home/settings#localisation`
(COMPANY only); the wizard autosaves drafts, so in-tab navigation is safe —
confirm before choosing between same tab and new tab.

### Phase 4 — In-app notifications

**Estimate:** half a day. Fire-and-forget after commit (`.catch(log)`).
- On create → `LOCATION_CHANGE_REQUEST` to the deciding level for the
  company's current location (ACTIVE users, case-insensitive name match);
  escalate one level if nobody matches.
- On decision → `LOCATION_CHANGE_DECISION` to the requester.
- On approval → `LOCATION_CHANGE_INCOMING` (informational) to the new
  department's DIVISIONAL users (and REGIONAL if the region changed) —
  DECISION 3.

**Tests:** recipient resolution (match, escalation, inactive excluded);
notification failure never fails the decision.

## Risks

- **P0 is a silent behaviour change**: a client that moved territory via
  `POST /dsmo/company` gets 2xx with territory unchanged. Mitigated by the
  audit row and a release note.
- `campaign_submissions` scoped through the company move with it mid-campaign
  (DECISION 7).
- In-flight PENDING_REVIEW submissions keep their old stamp and stay in the
  old reviewers' queue (DECISION 8).
- Notification recipients are matched by name (User has no territory ids);
  escalation and the list page mitigate a misspelt assignment.
- The migration is irreversible once on `master` (additive — low risk).

## Decisions for the owner (recommended default in bold)

1. **Routing:** **the lowest level covering both current and requested
   location decides** — no jurisdiction gains or loses a company unless
   someone responsible for both sides agrees; reuses
   `assertTerritorialAuthority` unchanged.
2. **Cross-region moves: one national decision** (ADMIN_ONEFOP / SUPER_ADMIN)
   rather than dual regional consent (which needs a second decision state).
3. **Notify the receiving jurisdiction after approval: yes**, informational.
4. **Consult the receiving jurisdiction before approval: no** — it would
   grant pre-approval visibility, the leak this design avoids.
5. **Update the principal Establishment with the Company: yes** — campaign
   targeting reads it.
6. **Keep `establishmentId` / `Establishment.code`** (old subdivision
   digits): permanent public identifier printed on the attestation.
7. **Open-campaign `campaign_submissions` move with the company: accept and
   document** (freezing needs a geography column there).
8. **In-flight PENDING_REVIEW submissions stay with the old reviewers: yes.**
9. **P0 ignores (2xx + audit) rather than refuses (409)** a differing
   territory — a 409 could block legally binding DSMO declarations and
   Flutter flows.
10. **No supporting document in v1** — no upload pipeline exists; the
    reason field carries the justification.
11. **A lower level may not reject a request that needs a higher decision**
    — otherwise an origin department could veto a move away from it.
12. **A company may cancel its own pending request: yes.**
13. **Approve the migration and the RBAC matrix (§21)** — required before
    P1 is committed.
14. **`entityType` on existing companies: ignore changes through
    `/dsmo/company` and DSMO declarations (2xx + audit)** — a company's
    instrument type is set at registration/approval; changing it would let
    it submit a different ONEFOP questionnaire. Any legitimate correction
    goes through staff.

## What this does not do

- No Flutter UI (Flutter keeps working; an entry point there is separate).
- No self-service edit of any other Company identity field; corrections
  before approval still use the resubmit loop.
- No re-stamping of past submissions, declarations or anomalies.
- No change to quotas, targets or non-principal establishments.
- No document upload, email, sidebar badge or company-side bell.
- No change to staff invitation/approval rules.
- `relocationLocality` (VT questionnaire answer) untouched.
