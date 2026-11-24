# Admin modules refactor plan

## Locked decisions

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

## Phases

### Phase 0 — Scan and classification

  Objective: inventory existing actions and roles, reclassify into
    [EXISTS]/[MODIFY]/[NEW]/[BACKEND-DEP], resolve territory ambiguity.
  Gate: classification locked.

**Status:** DONE.

### Phase 1 — Multi-status contract and view-aware counts

  Objective: make both list endpoints accept a status SET with correct
    territory-scoped totals in one paginated response, make counts
    view-aware, add decision date/actor fields to the registration list,
    add the decision actor columns (approvedAt, approvedBy, rejectedAt,
    rejectedBy) to User as needed and populate rejectedBy in the reject handler,
    add campaign name to the dossier list, and accept a status set on dossier
    export. SUPERSEDED inclusion must be explicit and deliberate.
  Gate: the nine exit criteria in Section C, all acceptance tests pass.

**Status:** NEXT.

### Phase 2 — Policy verification (not a new model)

  Objective: verify module separation, CENTRAL_AGENT read-only, and
    territory predicates on mutations; close the user-suspend/activate
    territory gap at auth.controller.ts:564 and :571; verify audit writes
    for admin reset-password and system settings.
  Gate: API tests prove cross-module and cross-territory calls are refused.

**Status:** PENDING.

### Phase 3 — Frontend views

  Objective: rename `vue` values; add vue=organisations and vue=completed;
    URL-persist Registrations filters; promote dossiers typeFilter and
    periodFilter to URL; visible filter bar with removable chips; clickable
    status totals; reduced table columns (4 per view) with explicit Open;
    plain-language three concepts (Review decision / Data issues /
    Statistical eligibility); eligibility-aware bulk bar; fix the
    "endorsed and archived" wording to "officially endorsed"; fix the
    "Self-registration file" label; wire the search control to the backend
    `search` param; surface decision-history links via GET /audit/reports;
    surface the existing reopen action in the completed view; extend
    completed-view export to accept the completed status set; make coverage
    visually distinct. NO archive buttons in Phase 3.
  Gate: UX review of six views; counts match list totals; copy audit shows
    no "archived" claim; URL persistence verified; cross-module links work;
    decision-history links and reopen work.

**Status:** PENDING.

### Phase 4 — Archive and organisation lifecycle

  Objective: add orthogonal archive flag to OnefopSubmission and User with
    migration (check the partial unique index warning around
    prisma/schema.prisma:849-866); add archive/restore endpoints mirroring
    the campaign archive pattern (src/campaign/campaign.controller.ts:88-91)
    plus restore, writing to AuditLog; add a shared archive predicate to
    EVERY read path (lists, counts, exports, detail, eligibility); add
    archive/restore UI to both completed views with who/when/reason and
    audit display; extend the existing user suspend/activate endpoints to
    organisation records AND add the missing territory guard; add
    organisation edit; add registration export; add communication history
    and bulk reminder.
  Gate: archived records are absent from every operational read and
    present in completed views with an audit trail; lifecycle actions are
    territory- and role-scoped; user-suspend territory gap is closed.

**Status:** PENDING.

### Phase 5 — Team workflow (deferred)

  Objective: assignment/claim (assigneeId already exists on registration
    at prisma/schema.prisma:221 — add endpoint + UI; "my work" filter uses
    assigneeId, not createdBy); bulk request correction; bulk mark-as-seen
    (individual exists); anomaly-type filter; named views; pins; default
    landing view; column preferences; escalation; internal notes and
    attachments; "has this org submitted?" on organisation row;
    organisation status on declaration row; merge duplicates.
  Gate: not a blocker; ship when prioritized.

**Status:** PENDING.

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
  (src/auth/auth.controller.ts:564, :571) but are USER-account level and
  have NO territory check. Extending them to organisations and adding the
  territory guard is [MODIFY] with a security fix.
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

=====================================================================
