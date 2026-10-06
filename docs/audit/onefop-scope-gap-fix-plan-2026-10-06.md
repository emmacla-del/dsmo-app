# ONEFOP territory-scope gaps: fix plan

Date: 2026-10-06. Read-only survey of `src/`, `prisma/schema.prisma`, `react-web/src` and the legacy Flutter client (`lib/`). No code changed and no tests run. This document builds on `docs/audit/documents-endpoint-scope-2026-10-06.md` and plans the fix for each endpoint. It contains no code.

> **Update 2026-10-06 — Family 1 is moot.** The registration-documents feature was retired: both `/auth/users/:id/documents` routes and their service methods were removed, closing the territory gap by deletion rather than by scoping. Summary rows 1a and 1b, the Family 1 section and its tests, D2, D3, the 403-for-the-verify-write half of D1, and order-of-work step 4 no longer apply. The 404-for-reads recommendation in D1 still applies to Families 3 and 4; D4 and D5 are unaffected. See `docs/audit/documents-removal-plan-2026-10-06.md`.

Scope: ONEFOP only. The DSMO surface is listed under "Deferred — DSMO" at the end. The brief numbers its families 1, 3 and 4; no Family 2 was specified, and the DSMO declaration routes it presumably covered are deferred.

## Summary

| # | Endpoint | Gate today | Scope today | Proposed rule (one line) |
|---|---|---|---|---|
| 1a | `GET /auth/users/:id/documents` | SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN, DIVISIONAL_ADMIN | none | Target must be a COMPANY user whose company passes `assertTerritorialAuthority(actor, company)`; otherwise not found. |
| 1b | `PATCH /auth/users/:id/documents/:kind/verify` | same | none | Same target rule as 1a, plus a whitelisted `state` and `kind`, and an audit row. |
| 3a | `GET /onefop/submissions/:id` | the four staff roles and COMPANY | COMPANY ownership only | Staff: `findFirst({ id, ...territoryWhere(territoryFromUser(user)) })`, not found otherwise. COMPANY ownership is unchanged. |
| 3b | `GET /onefop/submissions/:id/pdf` | same | same | Same as 3a, applied before the signed URL is issued. |
| 3c | `GET /onefop/submissions` (list) | same | hand-rolled; fails open; department name only | Replace the role branches with `territoryWhere`; COMPANY ownership is unchanged. |
| 4a | `GET /campaigns/:id` | SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN | none | REGIONAL sees the campaign only if the list would show it to them; embedded submissions are filtered to the region. |
| 4b | `GET /campaigns/:id/progress` | same | none | REGIONAL counts only the campaign's submissions in their region (or national aggregates, if ruled acceptable — see decision D4). |
| 4c | `GET /campaigns/:id/submissions` | same | none | REGIONAL receives only rows whose company is in their region. |
| X | `/onefop-analytics/*` (≈45 routes) | the four staff roles | none: region and department are caller-supplied filters | Needs a domain ruling first (D5): the submission list must be territory-scoped; aggregates may be national by design. |

Routes that are already scoped correctly, for contrast:
- The `/admin/questionnaires` family: list, `pending`, `correction-requested`, `export`, `:id`, `:id/diagnostic`, `:id/approve|reject|request-correction`, `anomalies/registry`, `anomalies/:id/resolve`, `quality/summary`, `pilotage/queues`.
- `bulk-visa` and `bulk-reject`, which call `assertTerritorialAuthority` on each candidate, at `src/questionnaires/eligibility-engine.service.ts:593` and `:728`.

## Decisions needed before implementation

These are product or domain questions. The code cannot answer them.

- **D1. Out-of-territory response: 404 or 403.**
  - `/admin/questionnaires/:id` returns not-found and does not reveal that the row exists (`questionnaires.service.ts:3199-3205`).
  - `approve-user` returns 403 with a stable message that is written to audit logs (`territory.ts`, `assertTerritorialAuthority`).
  - Recommendation: 404 for reads (Families 1a, 3, 4); 403 for the verify write, so that it matches approval.
- **D2. Can a document be verified on a file that is no longer pending?**
  - The Inscriptions dialog opens for any status (ACTIVE, REJECTED, …), and the verify toggle works on all of them.
  - Approval decisions are limited to `PENDING_APPROVAL` and `COMPLEMENTS_REQUESTED`.
  - Choose whether verify follows the same status rule, or stays open after a decision.
- **D3. Staff-account targets for documents.** No UI reviews documents on staff accounts: the Inscriptions queue lists company registrations only. Choose:
  - refuse non-COMPANY targets outright (smallest surface), or
  - apply `assertCanApproveRegistration` to them as approval does.
- **D4. Campaign progress for REGIONAL.**
  - Today `/:id/progress` gives national counts.
  - These are aggregates, not records, so national counts may be acceptable.
  - Rule on whether a REGIONAL admin may see national campaign progress.
- **D5. ONEFOP analytics for territorial admins.**
  - CLAUDE.md §4 separates the LMIS from the Observatory.
  - Rule on whether REGIONAL and DIVISIONAL admins may see national aggregate indicators. The record-level `GET /onefop-analytics/submissions` is a separate case and must be scoped either way: it returns respondent personal data.

---

## Family 1 — `/auth/users/:id/documents`

> Moot (2026-10-06): the routes were removed. Kept for the record.

### 1a. `GET /auth/users/:id/documents`

**Controller** (`src/auth/auth.controller.ts:310-315`)

```ts
@Get('users/:id/documents')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
@Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)
async getUserDocuments(@Param('id') id: string) {
  return this.authService.getUserDocuments(id);
}
```

**Service** (`src/auth/auth.service.ts:1246-1297`)
- Runs `prisma.user.findUnique({ where: { id }, include: { company: true, registrationDocuments: { include: { verifier: { select: { id, firstName, lastName, email, role } } } } } })`.
- Throws `BadRequestException('Utilisateur non trouvé')` when the user is missing.
- Then maps a fixed list of four expected kinds against the stored rows.

**Gate.** SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN and DIVISIONAL_ADMIN (`staff-scope.ts:30`, `:67`).

**Scope today.** None. The caller is never passed to the service.

**Returns** `{ userId, companyName, items[4] }`. Each item has:
- `id` (the stored row id, or the kind when no row exists)
- `kind`, `label`
- `state` (`PENDING` when no row exists)
- `uploadedAt`
- `verifiedAt`
- `verifiedBy` (the verifier's full name, or their email when the name is empty)

`uploadedAt` falls back to `user.createdAt` when no row exists (`:1284`). The response therefore reports an upload date for documents that were never uploaded.

**UI caller.** `react-web/src/app/admin/inscriptions/page.tsx:194-198`, the review dialog of the Inscriptions queue (moved there in commit `c7cca05b`).
- Actor: the reviewing admin. The page is gated to `APPROVAL_ROLES`.
- What the actor reviews: the self-registration file of a company account (`reviewing.id` is the user id).
- The queue itself is territory-scoped: `listCompanyRegistrations` applies `territoryWhere(actor)` (`auth.service.ts:1490`). A territorial admin therefore only opens dialogs for in-territory files through the UI.
- The legacy Flutter client does not call this endpoint.

**Who legitimately needs it:**
- SUPER_ADMIN and ADMIN_ONEFOP, for any company registrant.
- REGIONAL_ADMIN, for company registrants whose company is in their region.
- DIVISIONAL_ADMIN, for company registrants whose company is in their department.
- No role needs it for staff accounts today (D3).

**What approval checks that this does not:**

| Check | Approval | Documents |
|---|---|---|
| Territory: `assertTerritorialAuthority(actor, company)` | yes (`:1151`, `:1223`, `:1654`) | no |
| Target role: COMPANY, or ONEFOP staff via `assertCanApproveRegistration` | yes (`:1127`, `:1180`) | no |
| Target status: `PENDING_APPROVAL` or `COMPLEMENTS_REQUESTED` | yes | no |
| Audit row | yes (`:1164`, `:1195`, `:1231`, `:1719`) | no (a read; none expected) |

**Tests.** Confirmed: none. No spec references `getUserDocuments`, `registrationDocument` or the route.

**Proposed rule.** Load the target with its company. Return not-found unless:
- the target role is COMPANY, and
- the company passes `assertTerritorialAuthority({ ...territoryFromUser(caller), role }, company)`.

National roles pass the territory check.

**Tests to add (unit, AuthService):**
- REGIONAL in region A reads a company user in A → OK.
- REGIONAL in A reads a company user in B → not found.
- DIVISIONAL with matching region and department → OK.
- DIVISIONAL with the same department name in another region → not found.
- DIVISIONAL without an assignment → not found (fails closed).
- ADMIN_ONEFOP reads any company user → OK.
- Any caller targets a staff or admin account → not found (D3).
- Unknown id → not found.

Add a route-metadata assertion that the controller passes `req.user` to the service.

**UI pages affected.** `/admin/inscriptions` (review dialog). There is no change for in-territory use. An out-of-territory id can only be reached by crafting a request.

**Regression risk: low.**
- The queue and the check use the same territory semantics. `assertTerritorialAuthority` matches by id or by name, which is a superset of `territoryWhere`.
- Edge case: a company with blank region or department fails closed. It would appear in a national admin's queue but never in a territorial one's.
- The service signature changes, but no spec calls it.

### 1b. `PATCH /auth/users/:id/documents/:kind/verify`

**Controller** (`auth.controller.ts:317-327`)

```ts
@Patch('users/:id/documents/:kind/verify')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
@Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)
async verifyUserDocument(@Param('id') id, @Param('kind') kind, @Body('state') state, @Request() req) {
  return this.authService.verifyUserDocument(id, kind, state, req.user.id);
}
```

**Service** (`auth.service.ts:1299-1333`):
1. Loads the user by id. It throws when the user is missing and checks nothing about the actor.
2. Sets `targetState = validStates.includes(state) ? state : 'VERIFIED'`, where `validStates = ['PENDING','VERIFIED','REJECTED','MISSING']`.
3. Finds the row `{ userId, OR: [{ id: kindOrId }, { kind: kindOrId }] }`. If found, it updates `state`, `verifiedAt` and `verifiedBy`. Otherwise it creates a row with `kind: kindOrId`.
4. Returns the raw Prisma row.

**Gate and scope today.** Same gate as 1a. Scope: none. Only `req.user.id` is passed to the service, as the verifier.

**Returns** the raw `RegistrationDocument` row: `id`, `userId`, `kind`, `fileRef`, `state`, `uploadedAt`, `verifiedAt`, `verifiedBy`.

**UI caller.** Same dialog (`inscriptions/page.tsx:201-208`). It sends `VERIFIED` or `PENDING` only. The frontend type allows `REJECTED` but never sends it.

**Who legitimately needs it.** The same as 1a. For write status, see D2.

**What approval checks that this does not.** Every item in the 1a table, including the audit row: a write should write one.

**Tests.** Confirmed: none.

**The three points raised by the prior survey, confirmed:**

- **Unknown state defaults to VERIFIED.** Confirmed at `auth.service.ts:1303-1304`.
  - The schema does not constrain the value: `state String @default("PENDING")` (`prisma/schema.prisma:225`), with the comment "PENDING | VERIFIED | REJECTED | MISSING — free text until the workflow settles".
  - A missing or misspelled `state` in the body therefore records a verification.
- **`:kind` is free text.** `kind String`, commented "free text until the list per entity type is ruled" (`schema.prisma:219-220`).
  - The only kinds the application uses are the four hard-coded in `getUserDocuments` (`auth.service.ts:1268-1273`): `RCCM`, `NIU`, `CNI`, `ATTESTATION`.
  - Nothing else in `src/`, the seeds or the scripts creates `RegistrationDocument` rows. This endpoint is the only writer.
  - The path segment is also matched against the row `id` (`OR: [{ id }, { kind }]`).
  - There is no upload endpoint. `fileRef` is never written, so every "document" a reviewer verifies is a checklist tick against a file the system never received. This is reported, not proposed for change here.
- **No audit log on verify.** Confirmed: the method makes no `auditLog` call.
  - Rows it creates also block `DELETE /auth/users/:id`, because of `onDelete: Restrict` (`schema.prisma:229-231`).

**Proposed rule.**
- Apply the same target rule as 1a; for the out-of-territory response, see D1.
- Then:
  - reject a `state` outside `VERIFIED | PENDING | REJECTED` with a 400 (`MISSING` is a system state, not a reviewer verdict);
  - reject a `kind` outside the four known kinds with a 400, and match by kind only, not by row id;
  - optionally apply the D2 status rule;
  - write an audit row with actor, target, kind, the previous state and the new state.

**Tests to add:**
- All of the 1a territory cases, applied to the write.
- Unknown `state` → 400, with no row written.
- Unknown `kind` → 400, with no row created.
- Verify writes exactly one audit row.
- Verify → pending clears `verifiedAt` and `verifiedBy`.
- A territorial refusal happens before any write (mirroring `staff-scope.spec.ts:315-335`).

**UI pages affected.** `/admin/inscriptions`. The dialog only sends valid states and the four known kinds, so the whitelist does not affect it. Under D2, if verify is limited to pending files, the toggle must be disabled on decided files, which is a small UI change.

**Regression risk: low to medium.**
- Low for the territory rule, for the same reasons as 1a.
- Medium for the whitelists, but only if an unknown external client relies on the VERIFIED default or on custom kinds. None was found in react-web or Flutter.
- Existing rows created with odd kinds stay in the table. They are harmless to reads, because reads only show the four expected kinds.

---

## Family 3 — ONEFOP submissions

### 3a. `GET /onefop/submissions/:id`

**Controller** (`src/onefop/onefop.controller.ts:46-50`). The class-level guards are `JwtAuthGuard, RolesGuard, ActiveCompanyGuard` (`:23`).

```ts
@Get('submissions/:id')
@Roles('DIVISIONAL_ADMIN', 'REGIONAL_ADMIN', 'ADMIN_ONEFOP', 'SUPER_ADMIN', 'COMPANY')
async getSubmissionDetail(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
  return this.onefopService.getSubmissionDetail(req.user, id);
}
```

**Service** (`src/onefop/onefop.service.ts:224-237`, `:253-263`)
- `findFirst({ where: { id }, include: { company: true } })`, then not-found if missing, then `assertCanAccessSubmission(user, submission.companyId)`.
- That helper returns immediately for any role other than COMPANY. Its comment (`:253-256`) says staff are "trusted reviewer roles with no scoping today".

**Gate.** DIVISIONAL_ADMIN, REGIONAL_ADMIN, ADMIN_ONEFOP, SUPER_ADMIN and COMPANY. AUDITOR is refused.

**Scope today.** COMPANY: must own the submission (by company id). Staff: none.

**Returns.**
- The whole `OnefopSubmission` row.
- Its full `Company` row (`include: { company: true }`), with no `select`. That includes:
  - taxpayer, CNPS and registration numbers
  - phone and address
  - respondent name, function and phone
  - `userId`
  - `attestationUrl`
  - every other company column

Confirmed: a regional or divisional admin receives this for any submission nationally.

**UI caller.**
- react-web does not call it. The admin dossier screen uses `/admin/questionnaires/:id`, which is scoped. The respondent side only calls the list (`react-web/src/lib/api-client.ts:484`).
- The legacy Flutter client calls it (`lib/data/api_client.dart:1533`) from `SubmissionsViewerScreen` (`lib/screens/onefop/submissions_viewer_screen.dart:1958`). That screen opens from the home screen for the DIVISIONAL, REGIONAL, CENTRAL and SUPER_ADMIN_ONEFOP role branches (`lib/screens/home_screen.dart:203-276`).

**Who legitimately needs it:**
- COMPANY, for its own submissions (unchanged).
- SUPER_ADMIN and ADMIN_ONEFOP, nationally.
- REGIONAL_ADMIN, for submissions in its region.
- DIVISIONAL_ADMIN, for submissions in its department.

This is the same population as `/admin/questionnaires/:id`.

**Proposed rule.**
- For staff: `findFirst({ where: { id, ...territoryWhere(territoryFromUser(user)) } })`, and not-found otherwise. This is the pattern of `questionnaires.service.ts:3199-3205`.
- COMPANY ownership is unchanged.
- Separately, consider replacing `include: { company: true }` with the fields the viewer actually renders.

**Tests.** None exist. `onefop.service.ts` has no spec. `src/auth/roles.guard.spec.ts:77` covers role metadata on an analytics route only.

**Tests to add (unit, OnefopService):**
- REGIONAL in region A reads a submission in A → OK; one in B → not found.
- DIVISIONAL with matching departmentId, or with matching region and department names → OK.
- DIVISIONAL with the same department name in a different region → not found.
- A territorial account without an assignment → not found.
- ADMIN_ONEFOP → any submission.
- COMPANY reads its own → OK; another company's → 403 (unchanged).

**UI pages affected.** The Flutter `SubmissionsViewerScreen` detail view only.

**Regression risk: low to medium.**
- The viewer opens detail from the list, so in-territory rows keep working.
- Risk 1. `territoryWhere` prefers ids when the actor has them (`regionId` / `departmentId`). Submissions written without those ids (`OnefopSubmission.regionId` and `departmentId` are nullable, `schema.prisma:855-856`) would then not match for an id-bearing actor.
  - `/admin/questionnaires/:id` already behaves this way, so the two screens become consistent.
  - Measure how many live rows lack ids before shipping.
- Risk 2. Rows that the unscoped list showed to a divisional admin for a same-named department in another region will now 404. That is the intended fix.

### 3b. `GET /onefop/submissions/:id/pdf`

**Controller** (`onefop.controller.ts:52-57`). Same `@Roles` as 3a. It redirects to `onefopService.getSubmissionPdfUrl(id, req.user)`.

**Service** (`onefop.service.ts:239-251`). `findFirst({ where: { id } })`, then `assertCanAccessSubmission`, then `pdfService.getSignedUrl(submission)`.

**Gate and scope today.** The same as 3a.

**Returns.** A 302 to a signed storage URL for the full declaration PDF.

**UI caller.**
- Flutter `SubmissionsViewerScreen` (`submissions_viewer_screen.dart:134`).
- Flutter `company_declarations_screen.dart:280`, as COMPANY.
- react-web does not call it.

**Who legitimately needs it, and the proposed rule.** The same as 3a. The territory check must run before the signed URL is generated: a signed URL cannot be withdrawn once issued.

**Tests.** None. Add the 3a matrix, plus: no signed URL is requested when access is refused.

**UI pages affected.** The Flutter submissions viewer and the company declarations screen. The COMPANY path is unchanged.

**Regression risk: low.** Same notes as 3a.

### 3c. `GET /onefop/submissions` (list) — the fail-open path

**Controller** (`onefop.controller.ts:27-44`). Same `@Roles`. It accepts `status`, `entityType`, `region`, `establishmentId` and `quarterCode`.

**Service** (`onefop.service.ts:171-222`). The role filter is at `:186-195`:

```ts
if (user.role === 'DIVISIONAL_ADMIN' && user.department) {
    where.department = user.department;
} else if (user.role === 'REGIONAL_ADMIN' && user.region) {
    where.region = user.region;
} else if (user.role === 'COMPANY') { … where.companyId = company.id; }
```

**Exact behaviour, confirmed:**
- **DIVISIONAL_ADMIN with a department.**
  - Filters on `department` alone, by exact case-sensitive equality on the submission's name column.
  - It does not check the region. Department names repeat across regions (`territory.ts:81-83`), so a divisional admin also sees same-named departments elsewhere.
- **DIVISIONAL_ADMIN without a department.**
  - The first condition is false. The second needs role REGIONAL_ADMIN and the third needs COMPANY, so both are false too.
  - **No filter is applied, and the query returns every submission nationally.**
- **REGIONAL_ADMIN without a region.** Same outcome: no filter, national results.
- **SUPER_ADMIN and ADMIN_ONEFOP.** No filter, which is correct.
- **The `region` query parameter is accepted but never applied.** `filters.region` is unused, so a client-side region filter silently does nothing.
- **Payload.** id, submissionId, establishmentId, establishment name, quarter, status, entity type, submittedAt, the company's region and department, and the flag count. No personal data, but `establishmentId` is enough to enumerate establishments.

**UI callers.**
- react-web `/home/declarations`, as COMPANY (`api-client.ts:484`).
- Flutter `SubmissionsViewerScreen` (`api_client.dart:1495`), as staff.

**Who legitimately needs it.** The same as 3a.

**Proposed rule.**
- For staff roles: `where = { ...filters, ...territoryWhere(territoryFromUser(user)) }`. It fails closed and matches region and department case-insensitively, or by id.
- COMPANY ownership is unchanged.
- Either apply the `region` filter inside the territory, or remove the parameter.

**Tests.** None. Add:
- A territorial account without an assignment → empty list.
- DIVISIONAL, same department name in another region → excluded.
- Case difference (`WOURI` vs `Wouri`) → included.
- REGIONAL → own region only.
- National → all.
- COMPANY → own only.

**UI pages affected.** The Flutter submissions viewer list, and react-web `/home/declarations` (COMPANY, unchanged).

**Regression risk: low.**
- Misconfigured territorial accounts go from "sees everything" to "sees nothing". That is intended, but an operator would notice it. Report the affected accounts first: staff with REGIONAL or DIVISIONAL role and a blank region or department.
- Matching becomes case-insensitive, which slightly widens results within the correct territory.

---

## Family 4 — Campaign detail routes

**Module coverage.** These routes serve every campaign, not only ONEFOP ones.
- `DataCampaign.collectionType` is `ONEFOP | DSMO` (`schema.prisma:634`), and `purpose` is `COLLECTION | REGISTRATION` (`:631`).
- The plan below scopes the routes as a whole. That covers the ONEFOP campaigns and, incidentally, the DSMO ones; no part needs a DSMO-specific rule.
- DIVISIONAL_ADMIN is not in the gate of any route below.

The list route, for reference (`src/campaign/campaign.service.ts:196-258`):
- It narrows REGIONAL to campaigns with an empty `targetRegions` or one containing `user.region`.
- When `user.region` is blank, the `if` at `:207` is false and the list is national. That is the same fail-open pattern as 3c.

### 4a. `GET /campaigns/:id`

**Controller** (`src/campaign/campaign.controller.ts:52-56`). `@Roles(SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN)`, and calls `getCampaign(id)`. The caller is not passed.

**Service** (`campaign.service.ts:260-272`). `findUnique({ where: { id }, include: { creator, submissions: { take: 20, orderBy: { submittedAt: 'desc' } }, reminders: { take: 10 } } })`, then `toCampaignWire`.

**Scope today.** None.
- A REGIONAL admin can read a campaign that targets other regions only, which the list hides from them.
- The response embeds the 20 latest `CampaignSubmission` rows nationally (company id, establishment id, status, dates).

**UI caller.** react-web `/admin/campagnes`, `DetailsDialog` (`react-web/src/app/admin/campagnes/page.tsx:726`). REGIONAL reaches this page read-only (`CAMPAIGN_ROLES`).

**Proposed rule.**
- REGIONAL may read the campaign only if the list rule admits it (empty `targetRegions`, or one containing their region); an unassigned REGIONAL is refused.
- Filter the embedded submissions to companies in the region, or omit them for REGIONAL.

**Tests.** `src/campaign/campaign.service.spec.ts:549-565` covers the wire format only, with no actor. Add:
- REGIONAL reads a campaign targeting their region → OK.
- REGIONAL reads a campaign targeting other regions only → not found.
- REGIONAL with no region → not found.
- The embedded submissions contain no out-of-region row.

**UI pages affected.** `/admin/campagnes` details dialog.

**Regression risk: low.**
- The dialog opens only from campaigns already in the REGIONAL user's list.
- The dialog's use of the embedded submissions needs checking before they are dropped.

### 4b. `GET /campaigns/:id/progress`

**Controller** (`campaign.controller.ts:100-104`). Same gate, and calls `getCampaignProgress(id)`.

**Service** (`campaign.service.ts:523-530`). `campaignSubmission.groupBy({ by: ['status'], where: { campaignId } })`, then `_buildProgress`.

**Scope today.** None. It returns national counts by status.

**UI caller.** Flutter `campaign_detail_screen.dart:66` only. react-web does not call it.

**Proposed rule.** D4 decides between two options:
- (a) keep national aggregates, adding only the 4a campaign-visibility check;
- (b) count only submissions whose company is in the caller's region.

**Tests.** None. Add the 4a visibility cases, plus (b)'s count filtering if that option is chosen.

**UI pages affected.** The Flutter campaign detail screen.

**Regression risk: low.** Under (b), regional figures stop matching the national totals shown elsewhere. That needs labelling.

### 4c. `GET /campaigns/:id/submissions`

**Controller** (`campaign.controller.ts:106-110`). Same gate. It calls `getCampaignSubmissions(id, { status })`. The service signature also has `region`, but the controller never passes it.

**Service** (`campaign.service.ts:532-565`).
- `campaignSubmission.findMany({ where: { campaignId, status? } })`, with no take limit.
- Then a company lookup by `establishmentId` that adds `companyName`, `region` and `department`.

**Scope today.** None. Confirmed: the route returns every submission of the campaign nationally, with company name, region and department.

**Not verified, to check during the fix.** `CampaignSubmission.establishmentId` is a foreign key to the `Establishment` model (`schema.prisma:663`, `:667`), but the lookup matches it against `Company.establishmentId`. If the two identifiers differ, the enrichment returns nulls. A scope filter must not rely on that join. `CampaignSubmission.companyId` (nullable) is the direct link.

**UI caller.** Flutter `campaign_detail_screen.dart:78` only.

**Proposed rule.** For REGIONAL, return only rows whose `company` relation is in the region (`company: territoryWhere(actor)`), after the 4a visibility check. Rows with a null `companyId` are excluded for territorial callers.

**Tests.** None. Add:
- REGIONAL receives only in-region rows.
- Rows with a null `companyId` are excluded for REGIONAL and included for national roles.
- The 4a visibility cases.

**UI pages affected.** The Flutter campaign detail screen.

**Regression risk: low to medium.** If many `CampaignSubmission` rows lack a `companyId`, regional admins would see far fewer rows. Measure that before shipping.

---

## Cross-cutting

### C1. Division scoping by department name alone

`territory.ts:81-83` is the comment that explains why department names are not unique. `territoryWhere` and `assertTerritorialAuthority` both honour it, using region and department, or `departmentId`.

ONEFOP routes that scope a division by name alone:
- `GET /onefop/submissions`: `onefop.service.ts:187-188` (see 3c). It is also case-sensitive.

No other ONEFOP list route does this. The `/admin/questionnaires` family, the eligibility engine and pilotage all go through `territoryWhere`.

The `/onefop-analytics/*` `department` filter is caller-supplied, not a scope; see C3.

Corrected scope: `territoryWhere(territoryFromUser(user))`.

DSMO equivalents exist (`dsmo.service.ts:698`, `:756`) and are deferred.

### C2. The ONEFOP list route fails open

Confirmed in 3c:
- A DIVISIONAL_ADMIN with no department, or a REGIONAL_ADMIN with no region, falls through every branch at `onefop.service.ts:187-195` and receives the unfiltered national list.
- The same pattern exists at `campaign.service.ts:207` for REGIONAL.

Fail-closed rule: any acting user with role REGIONAL_ADMIN or DIVISIONAL_ADMIN and no usable assignment matches no rows. This is what `territoryWhere` already does (`NO_ROWS`).

### C3. Other ONEFOP endpoints returning more than the caller's territory

Method: every controller in `src/onefop`, `src/questionnaires` and `src/analytics/onefop-analytics.controller.ts` was checked for whether the caller's territory reaches the service through `territoryWhere`, `assertTerritorialAuthority`, `territoryFromUser` or a per-row check.

**`/onefop-analytics/*`** (`src/analytics/onefop-analytics.controller.ts`; facade `OnefopAnalyticsFacade`; service `onefop-analytics.service.ts`)
- Gate: ADMIN_ONEFOP, REGIONAL_ADMIN, DIVISIONAL_ADMIN and SUPER_ADMIN, set at class level (`:33`).
- None of the roughly 45 handlers reads `req.user`.
- `region`, `department` and `subdivision` come from the query string. They are applied as `contains` matches (`onefop-analytics.service.ts:59-60`), not as a scope.
- A territorial admin therefore gets national figures by omitting the filter, and any region's figures by naming it.
- Two cases:
  - **Record-level.** `GET /onefop-analytics/submissions` (`controller :786`, service `:745-758`) returns up to 50 submissions per page with the `respondent` row (name, function, phones, email) and the entity detail rows. **This exposes respondent personal data nationally to REGIONAL and DIVISIONAL admins, and must be scoped** with `territoryWhere`, the same as 3c.
  - **Aggregate.** The other routes return counts and distributions. Whether territorial admins may see national aggregates is decision D5. If not, inject `territoryWhere` into `buildSubmissionWhere` and into the id resolver used by `getDashboard`.
- Callers: the legacy Flutter client only (`lib/data/api_client.dart:1795`, `:1829`, `:1864`, …). react-web does not call these routes (the Observatory is postponed).
- Tests: none for scope.
- Regression risk: low for the submission list. For aggregates, it depends on D5: scoping them changes what regional dashboards show.

**Checked and found scoped:**
- `admin/questionnaires` list, `pending`, `correction-requested` and `export`: `territoryWhere` and `territoryWhereForExport`.
- `admin/questionnaires` `:id`, `:id/diagnostic`, `approve`, `reject` and `request-correction`.
- `anomalies/registry` (`eligibility-engine.service.ts:896`) and `anomalies/:id/resolve` (`:506`).
- `quality/summary` and `pilotage/queues` (`:249`, `:337`).
- `bulk-visa` and `bulk-reject` (`:593`, `:728`).

**Checked, not applicable:**
- `POST /onefop/preview` (`questionnaires.controller.ts:65`) has no `@Roles`, but it renders the posted body and reads no other entity's data.
- `POST /onefop/submit` is COMPANY-only and keyed to the caller.
- `GET /onefop/active-quarter` returns calendar data only.
- `/onefop/draft*` is COMPANY-only and keyed to the caller's own company.
- `GET /admin/questionnaires/rules` returns static rule metadata.

---

## Suggested order of work

Each step is independent and can be its own commit.

1. **3c, the list fail-open and name-only scoping.** One line of logic and the widest current exposure. Report the unassigned territorial accounts first.
2. **3a and 3b, submission detail and PDF.** Full company rows and signed PDFs, nationally.
3. **`/onefop-analytics/submissions`.** Respondent personal data.
4. ~~**1b, then 1a, documents.** A write without audit, then the read. 1b needs D1–D3.~~ Moot: the routes were removed (2026-10-06).
5. **4c, 4a, 4b, campaigns.** 4b needs D4.
6. **The analytics aggregates**, after D5.

A shared fixture would cut test cost across all six: actors in two regions, two same-named departments in different regions, an unassigned territorial actor, and a national actor. The closest existing pattern is `src/auth/staff-scope.spec.ts:315-335`.

## Deferred — DSMO

The DSMO surface has the same class of gap. It is out of scope here and should be triaged when DSMO is back in scope:
- `GET /dsmo/declarations/:id` and `GET /dsmo/declarations/:id/pdf/:copy` have no `@Roles`. Any authenticated non-company account, including AUDITOR, reads any declaration nationally, with the employees' personal data.
- On `PATCH /dsmo/declarations/:id/validate`, approve has no territory check and reject has no access check at all.
- `GET /dsmo/declarations` has no `@Roles` and returns everything to AUDITOR.
- `GET /dsmo/notifications/:id` and `/:id/stats` are unscoped, although the list is scoped.
- `GET /dsmo/stats/summary` trusts caller-supplied region and department.
- The DSMO list routes scope divisions by department name alone (`dsmo.service.ts:698`, `:756`).

Details and file references are in `docs/audit/documents-endpoint-scope-2026-10-06.md`.
