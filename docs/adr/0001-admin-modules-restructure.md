# ADR-0001: Admin modules restructure

## Context

## A.1 Purpose of the two modules

Two back-office modules, each with three views, implemented as `vue`
query-param values on the EXISTING routes (not new routes):

REGISTRATIONS (currently /admin/inscriptions)
  vue=queue         -> Registration queue (today: vue=file)
  vue=organisations -> Registered organisations (NEW, read-only over ACTIVE+REJECTED)
  vue=coverage      -> Registration coverage (today: vue=couverture)
  /admin/etablissements stays a SEPARATE route (third header tab today)

DECLARATIONS & SURVEYS (currently /admin/dossiers)
  vue=submissions   -> Submission queue (today: vue=dossiers)
  vue=completed     -> Completed records (NEW, read-only over APPROVED+REJECTED+SUPERSEDED)
  vue=coverage      -> Survey coverage (today: vue=couverture)

Why two modules: Registrations answers "Who may use CAMLEAP?"; Declarations
& Surveys answers "Who has reported?". They share the organisation record
but never share a status or a decision action.


## Decision

## A.2 Locked decisions (recorded, not open)

D1. Decision history is surfaced by LINKING to the existing
    GET /audit/reports?resourceId=... endpoint. No inline decision-history
    projection is built in Phase 1.
D2. `vue` values are renamed in ONE coherent change during Phase 3:
    registrations file->queue, dossiers->submissions, and the new values
    organisations and completed are added. Parsers, header tabs, link
    helpers, and labels are updated together.
D3. Registrations filters are URL-persisted to full parity with dossiers
    (using the dossiers setUrlFilter pattern) during Phase 3.
D4. Archive is an ORTHOGONAL FLAG (archivedAt, archivedBy, archiveReason)
    on OnefopSubmission and User, applied in Phase 4. It is NOT an
    ARCHIVED status added to OnefopStatus or UserStatus.
D5. Module separation is enforced at the EXISTING controller-guard level
    (staff-scope.ts role sets). Do NOT introduce a capability/grant model.
    ADMIN_ONEFOP_REGISTRATIONS and ADMIN_ONEFOP_SUBMISSIONS are NATIONAL
    roles (not territory-scoped); REGIONAL_ADMIN and DIVISIONAL_ADMIN are
    territorial. CENTRAL_AGENT is read-only national and is excluded from
    survey mutations and survey export.


## Consequences

## A.4 What changed vs earlier assumptions (record in the doc)

- Permission model: module separation already exists at controller guards
  (staff-scope.ts role sets). No grant model is built.
- Decision history: GET /audit/reports already supports resource-ID
  filtering (src/report/audit.controller.ts:31). Surfacing it is [MODIFY],
  not [BACKEND-DEP].
- Reopen: PATCH /admin/questionnaires/:id/reopen-for-correction already
  exists and is audited (src/questionnaires/admin-questionnaires.controller.ts:387,
  AUDIT_REOPEN at :383). Surfacing it in the completed view is [MODIFY].
- Assignment: assigneeId already exists on registration
  (prisma/schema.prisma:221). Assignment is [MODIFY], not a schema change.
- Deactivate/reactivate: PATCH /auth/users/:id/suspend and /activate exist
  (src/auth/auth.controller.ts:564, :571) as USER-account operations. They
  use USER_LIFECYCLE_ROLES and enforce territorial authority in the service.
- Export from completed view: export endpoint exists
  (src/questionnaires/admin-questionnaires.controller.ts:288) and accepts
  one status; extending it to a status set is [MODIFY].
- Search: backend accepts `search` covering company name, tax number, CNPS
  and user email (src/auth/auth.service.ts:1711); the UI currently sends
  only `organisation` (inscriptions/page.tsx:250, :343). Wiring the UI is
  [MODIFY].
- National roles: ADMIN_ONEFOP_REGISTRATIONS and ADMIN_ONEFOP_SUBMISSIONS
  are national, not territorial. Only REGIONAL_ADMIN and DIVISIONAL_ADMIN
  are territory-scoped.


- Decision actor fields on User are extended in Phase 1 as a single additive group: approvedAt, approvedBy, rejectedAt, rejectedBy — all nullable. No index is added or changed; the existing approvedBy index is retained. The group has no constraints beyond its self-reference to User. This does not touch the OnefopSubmission partial unique index that is the actual schema risk in this project. Only fields that are missing today are added; existing ones are reused. Historic rejected records will have rejectedBy = null; the view displays “not recorded” for them. Backfilling from AuditLog is out of scope; the audit trail remains authoritative for historic decisions.

- Regional admins (REGIONAL_ADMIN, DIVISIONAL_ADMIN) have both registration and declaration admin capabilities, scoped to their territory. They may suspend or activate users within their territory via USER_LIFECYCLE_ROLES, a narrower set than USER_ADMIN_ROLES. Role assignment and user deletion remain national via USER_ADMIN_ROLES. User search visibility for territorial admins remains an open product question. Cross-territory suspend/activate is refused by assertTerritorialAuthority.

No capability/grant model is introduced. Phase 1 must meet the contract in [the Phase 1 contract](../plans/admin-modules-phase1-contract.md) before frontend work proceeds.

## Status

Accepted — 2026-10-27.

## Supersedes

None.
