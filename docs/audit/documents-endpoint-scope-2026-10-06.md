# Registration-documents endpoints: missing territory scope

Date: 2026-10-06. Scope: read-only survey of `src/` (NestJS) and `prisma/schema.prisma`. No code changed, no tests run. This report describes what the code does; it does not propose fixes.

## The gap

`GET /auth/users/:id/documents` and `PATCH /auth/users/:id/documents/:kind/verify` are open to REGIONAL_ADMIN and DIVISIONAL_ADMIN (`src/auth/auth.controller.ts:310-327`), but neither the controller nor the service looks at who is calling. The controller does not pass `req.user.role` or `territoryFromUser(req.user)` to the service (`auth.controller.ts:314`, `:326`), and `AuthService.getUserDocuments` / `verifyUserDocument` (`src/auth/auth.service.ts:1246-1333`) load the target user by id and act on it. They do not check the target's region or department, the target's role, or the target's status. The approval routes on the same population of reviewers (`approve-user`, `reject-user`, `request-complements`) do check territory and target role. So a territorial admin can read and change document-verification state for any user on the platform if they have that user's UUID.

## Step 1: the endpoints as they are

The real routes match the frontend (`react-web/src/lib/user-directory.ts:116-121`, used from `react-web/src/app/admin/inscriptions/page.tsx:197,203`).

| Route | Controller | Guard | Service |
|---|---|---|---|
| `GET /auth/users/:id/documents` | `auth.controller.ts:310-315` | `JwtAuthGuard, RolesGuard, ActiveCompanyGuard`; `@Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)` | `auth.service.ts:1246-1297` |
| `PATCH /auth/users/:id/documents/:kind/verify` | `auth.controller.ts:317-327` | same | `auth.service.ts:1299-1333` |

The roles resolve to SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN and DIVISIONAL_ADMIN (`src/auth/staff-scope.ts:30`, `:67`). `RolesGuard` checks role membership only (`src/auth/roles.guard.ts:28-33`).

Controller (verbatim):

```ts
@Get('users/:id/documents')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
@Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)
async getUserDocuments(@Param('id') id: string) {
  return this.authService.getUserDocuments(id);
}

@Patch('users/:id/documents/:kind/verify')
@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
@Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)
async verifyUserDocument(@Param('id') id, @Param('kind') kind, @Body('state') state, @Request() req) {
  return this.authService.verifyUserDocument(id, kind, state, req.user.id);
}
```

Service behaviour:

- `getUserDocuments(userId)` (`auth.service.ts:1246`) runs `prisma.user.findUnique({ where: { id: userId }, include: { company: true, registrationDocuments: { include: { verifier } } } })` and throws only when the user does not exist (`:1266`). It returns `userId`, `companyName`, and four items (RCCM, NIU, CNI, ATTESTATION), each with state, uploadedAt, verifiedAt and the verifier's name (or the verifier's email when the name is empty) (`:1276-1296`). It does not check the actor's authority at all.
- `verifyUserDocument(userId, kindOrId, state, verifierId)` (`auth.service.ts:1299`) loads the user, still with no authority check (`:1300-1301`). It then:
  - turns any `state` outside `PENDING|VERIFIED|REJECTED|MISSING` into `VERIFIED` (`:1303-1304`);
  - updates the existing `RegistrationDocument` matched by id or kind (`:1306-1321`), or creates a new row with `kind` set to the raw path segment (`:1324-1332`); `kind` is free text in the schema (`prisma/schema.prisma:220`);
  - writes no audit log, and returns the raw Prisma row, including `fileRef` (`schema.prisma:223`).

Answer to "what authority does it check": none. It accepts any id from any caller that passes the four-role guard. It checks neither the target's region/department nor the target's role.

## Step 2: what the approval endpoints check

Controller: `approve-user/:id` (`auth.controller.ts:274-288`), `reject-user/:id` (`:290-295`) and `request-complements/:id` (`:297-308`) have the same `@Roles` gate as the documents routes. They differ in that each passes `req.user.role` and `territoryFromUser(req.user)` to the service.

Service:

- `approveUser` (`auth.service.ts:1114-1135`). For a COMPANY target it calls `approveCompanyRegistration` (`:1646`), which loads the company (`requireCompanyForReview`, `:1754-1758`) and calls `assertTerritorialAuthority({ ...actorTerritory, role: actorRole }, company)` (`:1654`). For staff targets it calls `assertCanApproveRegistration` (`:1127`). Both run before any status check or write.
- `rejectUser` (`auth.service.ts:1137-1205`). COMPANY: `assertTerritorialAuthority` against the company (`:1150-1151`). Staff: `assertCanApproveRegistration` (`:1180`), plus a rule that territorial actors may reject only `PENDING_APPROVAL` accounts (`:1183-1185`).
- `requestComplements` (`auth.service.ts:1207-1244`). COMPANY only (`:1219`), then `assertTerritorialAuthority` against the company (`:1222-1223`).

The helpers:

- `assertCanApproveRegistration` (`src/auth/staff-scope.ts:80-98`). For REGIONAL_ADMIN/DIVISIONAL_ADMIN actors, the target must be in `ONEFOP_STAFF_ROLES` (`:91`) and pass `assertTerritorialAuthority` (`:94`). For other actors it applies `assertCanManageRole`: SUPER_ADMIN is unrestricted, ADMIN_ONEFOP is limited to ONEFOP staff roles, and anyone else is refused (`:54-59`).
- `assertTerritorialAuthority` (`src/auth/territory.ts:174-212`). National roles pass. REGIONAL_ADMIN must match the target's region by id or name, case-insensitively (`:191-197`). DIVISIONAL_ADMIN must match by departmentId, or by both region and department names (`:200-208`). A missing role, or any other role, is refused. A target without territory fails closed.

Approval checks these things; the documents endpoints check none of them:

1. Territory: the target company's region (REGIONAL) or region and department (DIVISIONAL) must match the actor's.
2. Target role: a territorial actor can act on COMPANY targets in its territory and on ONEFOP-staff targets in its territory, and on nothing else. ADMIN_ONEFOP cannot act on SUPER_ADMIN or ADMIN_ONEFOP staff accounts.
3. Target status: the account must be `PENDING_APPROVAL` or `COMPLEMENTS_REQUESTED` (`:1128`, `:1152`, `:1183`, `:1224`, `:1655`).
4. Audit: every decision writes an `auditLog` row (`:1164`, `:1195`, `:1231`, `:1719`). Document verification writes none.

## Step 3: exposure

Who can call the endpoints today: SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN and DIVISIONAL_ADMIN. AUDITOR and COMPANY are refused by `RolesGuard`.

- A REGIONAL_ADMIN in Littoral can read and change the document state of every user in the database: companies in all ten regions, staff accounts in other regions, and ADMIN_ONEFOP and SUPER_ADMIN accounts. The only limit is knowing the target's UUID (`schema.prisma:123`). Several other unscoped endpoints return `company.userId` for out-of-territory companies (see the dsmo and onefop entries below), so knowing a UUID is not a meaningful barrier.
- A DIVISIONAL_ADMIN has the same reach, nationally. Its department assignment is never consulted.
- ADMIN_ONEFOP can reach SUPER_ADMIN and ADMIN_ONEFOP accounts. That is outside the `manageableRolesFor` scope it gets on every other `/auth/users/:id/*` route (`staff-scope.ts:48-52`). The data on those accounts is near-empty, so the practical impact is small.

What the caller can do with that reach:
- Read: company name, document states, timestamps, and verifier identity (a name, or the verifier's email when the name is empty).
- Write: set any document to VERIFIED, REJECTED, PENDING or MISSING. An unknown state also becomes VERIFIED. The caller can also create `RegistrationDocument` rows of any `kind` on any user. Any such row puts a foreign key on the user with `onDelete: Restrict` (`schema.prisma:231`), so a later `DELETE /auth/users/:id` on that user answers 409 (`auth.service.ts:2164-2168`). None of this is audited.

Mitigating factor: approval does not depend on document state today. `approveCompanyRegistration` (`auth.service.ts:1646-1752`) never reads `registrationDocuments`. A falsified VERIFIED therefore does not by itself grant an approval. It does mislead the reviewer who owns the file.

### Other endpoints with the same pattern (user- or company-scoped by id, no territory check)

| Endpoint | Location | Roles | What it checks | What it doesn't |
|---|---|---|---|---|
| `GET /dsmo/declarations/:id` | `src/dsmo/dsmo.controller.ts:130-133` → `dsmo.service.ts:854-870` | any authenticated user (no `@Roles`) | COMPANY must own it (`:866`) | Territory for staff. Returns company, the employees list (names, age, nationality, salary category), movements and qualitative answers nationally to REGIONAL, DIVISIONAL and AUDITOR |
| `GET /dsmo/declarations/:id/pdf/:copy` | `dsmo.controller.ts:184-193` → `dsmo.service.ts:771-787` | any authenticated user | same as above, via `getDeclarationWithAccess` | Territory. Can also trigger PDF regeneration (`:780-784`) |
| `PATCH /dsmo/declarations/:id/validate` | `dsmo.controller.ts:103-112` → `dsmo.service.ts:709-742` | DIVISIONAL, REGIONAL, ADMIN_ONEFOP, SUPER_ADMIN | approve: role picks the next status (`:720-724`) | Territory on approve (`getDeclarationWithAccess` only checks COMPANY). Reject (`:732-742`) has no access check at all: a DIVISIONAL in Wouri can reject a Centre declaration. No current-status check on either |
| `GET /dsmo/notifications/:id` and `/:id/stats` | `dsmo.controller.ts:170-180` → `src/dsmo/notification.service.ts:385-395`, `:400` | DIVISIONAL, REGIONAL, ADMIN_ONEFOP, SUPER_ADMIN | nothing | Territory. The list route is scoped (`notification.service.ts:359-368`); the by-id routes return any notification with its recipient company names |
| `GET /dsmo/stats/summary` | `dsmo.controller.ts:135-143` → `dsmo.service.ts:872-885` | same four | nothing | Uses caller-supplied `region`/`department`, ignores the caller's territory (aggregate counts only) |
| `GET /onefop/submissions/:id` | `src/onefop/onefop.controller.ts:46-50` → `src/onefop/onefop.service.ts:224-237` | DIVISIONAL, REGIONAL, ADMIN_ONEFOP, SUPER_ADMIN, COMPANY | COMPANY ownership only (`:257-263`; the comment at `:253-256` says staff are "trusted reviewer roles with no scoping today") | Territory for REGIONAL/DIVISIONAL: they read any submission with its full company row nationally |
| `GET /onefop/submissions/:id/pdf` | `onefop.controller.ts:52-57` → `onefop.service.ts:239-251` | same | same | same |
| `GET /campaigns/:id`, `/:id/progress`, `/:id/submissions` | `src/campaign/campaign.controller.ts:52-56`, `:100-110` → `campaign.service.ts:260`, `:523`, `:532-562` | SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN | nothing | Territory. The list is region-filtered (`campaign.service.ts:207-215`), but `/:id/submissions` returns every submission nationally with company name, region and department |

Adjacent weaknesses in list routes:
- `dsmo.service.ts:698`, `:756`, and `onefop.service.ts:187-188` scope DIVISIONAL by department name alone, without region. `territory.ts:81-83` notes that department names repeat across regions.
- `onefop.service.ts:187-190` applies no filter when a REGIONAL/DIVISIONAL account has no region or department, so the query is unscoped; `territoryWhere` fails closed in that case.
- `GET /dsmo/declarations` (`dsmo.controller.ts:114`, no `@Roles`) returns all declarations to an AUDITOR (`dsmo.service.ts:747-768`).

Remaining `/auth/users/:id/*` routes (`role`, `territory`, `suspend`, `activate`, `DELETE`, `two-factor`) are restricted to USER_ADMIN_ROLES or SUPER_ADMIN, which are national, and each applies `assertCanManageRole` (`auth.service.ts:2013-2014`, `:2055-2056`, `:2100`, `:2159`). Territory does not apply to them, and their role scope is enforced. `data-management` (`regions/:id`, `sectors/:id`), `locations`, `sectors` and `minefop-services` are reference data, not user- or company-scoped.

### Endpoints that do check scope, for contrast

- `PATCH /auth/approve-user/:id`, `reject-user/:id`, `request-complements/:id`: `auth.service.ts:1127`, `:1151`, `:1180`, `:1223`, `:1654`.
- `GET /auth/company-registrations`: `territoryWhere` plus `assertTerritorialAuthority` on the region filter (`auth.service.ts:1490-1508`).
- `POST /auth/admin/register-company`: `assertTerritorialAuthority` on the resolved territory (`auth.service.ts:871`).
- `GET /companies`, `GET /companies/stats`: `territoryFromUser` (`src/companies/companies.controller.ts:32`, `:46`).
- `/admin/questionnaires/:id`, `:id/approve`, `:id/reject`, `:id/request-correction`: `getById` uses `findFirst({ id, ...territoryWhere })`, and out-of-territory rows come back as not found (`src/questionnaires/questionnaires.service.ts:3199-3205`, `:3267`, `:3300`, `:3328`). `:id/diagnostic` is scoped the same way (`eligibility-engine.service.ts:36-45`).
- `PATCH /admin/questionnaires/anomalies/:id/resolve`: `assertTerritorialAuthority` (`eligibility-engine.service.ts:506`).
- `/admin/pilotage/campaigns/:id/quotas|returns`: territory passed into `loadGrid` (`src/pilotage/pilotage.service.ts:278-327`).

## Step 4: tests

No spec references `getUserDocuments`, `verifyUserDocument`, `registrationDocument` or the `/documents` routes. Searches covered `src/**/*.spec.ts`, `test/`, and react-web. Both endpoints are entirely untested, for authorization and for behaviour.

The approval scope is tested:
- `src/auth/staff-scope.spec.ts:138-196` covers `assertCanApproveRegistration`, including wrong-region and wrong-department refusals.
- `src/auth/staff-scope.spec.ts:315-335` covers that a REGIONAL admin cannot approve or reject outside its region, that requests without territory fail closed, and that the refusal comes before any write.
- `src/auth/territory.spec.ts:70-150` covers `assertTerritorialAuthority`.
- `src/auth/auth.registration-approval.spec.ts:349-499` covers role boundaries: national approval by ADMIN_ONEFOP, AUDITOR refused. It has no test that a wrong-region REGIONAL admin is refused on a COMPANY approval. That path relies only on the generic `territory.spec.ts` coverage.

The other gap endpoints in the table above (`getDeclarationWithAccess`, `validateDeclaration`, `getPdfPath`, `getSubmissionDetail`, `getSubmissionPdfUrl`, `getNotificationDetails`, `getCampaignSubmissions`) also have no spec.

Would a territory check break an existing test? No. Nothing calls the documents service methods or routes. The route-metadata spec (`src/auth/active-company.completeness.spec.ts:89-160`) asserts guard/marker presence only, and a service-level check would not change that. Existing specs build `AuthService` directly, but none of them call these two methods, so a change to their signature would not break any spec.

## Severity

High for the verify (write) endpoint, medium for the read. It is a confirmed horizontal privilege escalation across the geographic security boundary that CLAUDE.md §14 defines. Any REGIONAL or DIVISIONAL account can, nationally and without an audit trail, falsify the verification state of another territory's registration documents, and it can plant rows that block account deletion. The impact is limited for now because approval does not consume document state, and the read returns metadata only: no file references or signed URLs. Both limits end as soon as document uploads or document-gated approval are built. The same pattern is more serious on `/dsmo/declarations/:id` (employee personal data, any authenticated staff role), on `PATCH /dsmo/declarations/:id/validate` (cross-territory rejection, with no access check on the reject branch), and on `/onefop/submissions/:id`. Those should be triaged with the documents endpoints.
