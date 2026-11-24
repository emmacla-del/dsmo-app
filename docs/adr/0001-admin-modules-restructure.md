# ADR-0001: Admin modules restructure

## Context

## A.1 Purpose of the two modules

This section records the original 2026-10-27 design. The registration portion
was amended on 2026-11-09 below; the declarations design is unchanged.

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

## A.3 Amendment — registration list and establishment register (2026-11-09)

The owner replaced the registration portion of D2 after reviewing the overlap
between Registered organisations and the establishment register:

- There are two primary registration destinations: `/admin/inscriptions` and
  `/admin/etablissements`.
- `/admin/inscriptions` is one registration-record list. Pending review is its
  default operational mode; complements requested, rejected and all records
  are status filters, not separate navigation destinations.
- `/admin/etablissements` contains approved registrations only
  (`User.status=ACTIVE`), including active and suspended accounts
  (`User.isActive=true|false`). Rejected applications are not establishments.
- The `vue=organisations` UI and navigation are removed. Existing URLs redirect
  to the approved register or registrations list according to their filters.
- Archive remains the existing orthogonal, reversible soft-removal flag. It is
  shown only through an explicit include-archived filter and does not replace
  rejection, suspension or an establishment lifecycle status.
- The API's `view=organisations` count/archive contract remains temporarily as
  an internal compatibility path for registration-list requests; it is no
  longer a user-facing view.

## A.4 Amendment — survey submission records (2026-11-09)

The owner applied the same consolidation to survey submissions after auditing
the review queue and completed records:

- `/admin/dossiers` has one submission-record list. Pending/correction work,
  completed decisions, individual statuses and all records are status filters
  of that list.
- The separate `vue=completed` navigation destination is removed. Existing
  completed URLs migrate to `vue=submissions&submissionsStatus=...` and retain
  their completed filters and archive choice.
- Claim ownership, waiting time and bulk decisions remain available only for
  claimable statuses. Approved/rejected/replaced selections retain the decision
  columns, archive/restore, audit and reopen actions where allowed.
- Archive remains orthogonal and is explicit for every status selection. The
  unified list therefore also provides a restore surface for archived pending
  or correction-requested records.
- Follow-up remains separate because it lists registered establishments with
  no received campaign submission, not submission records. The quality centre
  remains separate because it lists anomaly records.
- Backend `view=queue|completed` count/archive behavior remains an internal API
  compatibility contract; status/statuses select the actual list population.

This and §A.3 supersede D2's user-facing registration and completed-view split.
D1, D3, D4 and D5 remain in force. No schema change is introduced.


## Consequences

## A.5 What changed vs earlier assumptions (record in the doc)

- Permission model: module separation already exists at controller guards
  (staff-scope.ts role sets). No grant model is built.
- Decision history: GET /audit/reports already supports resource-ID
  filtering (src/report/audit.controller.ts:31). Surfacing it is [MODIFY],
  not [BACKEND-DEP].
- Reopen: PATCH /admin/questionnaires/:id/reopen-for-correction already
  exists and is audited (src/questionnaires/admin-questionnaires.controller.ts:387,
  AUDIT_REOPEN at :383). Surfacing it under completed status filters is [MODIFY].
- Assignment: assigneeId already exists on registration
  (prisma/schema.prisma:221). Assignment is [MODIFY], not a schema change.
- Deactivate/reactivate: PATCH /auth/users/:id/suspend and /activate exist
  (src/auth/auth.controller.ts:564, :571) as USER-account operations. They
  use USER_LIFECYCLE_ROLES and enforce territorial authority in the service.
- Export from completed status filters: export endpoint exists
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
