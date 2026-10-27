# Admin modules Phase 1 contract

## C.1 Registrations endpoint changes

Endpoint: GET /auth/company-registrations
  Controller src/auth/auth.controller.ts:434-454
  Service    src/auth/auth.service.ts:1582 (list), :1605 (territory),
             :1672-1678 (status), :1724-1744 (query projection; select begins at :1730), :1773/:2006 (counts)

Query param `statuses` (comma-separated set of UserStatus values):
  - Mutually exclusive with `status` -> 400 if both supplied.
  - Unknown value -> 400 naming the invalid value.
  - Empty set -> 400.
  - "OVERDUE" is not a stored status -> 400 with a message pointing to
    overdue=true.
  - status=ALL behaviour is UNCHANGED.
  - Query and total MUST come from the same filtered query; no client-side
    merge, no two calls.
  - territoryWhere(actor) (auth.service.ts:1605) must still apply.

Response field additions per list item (from User at schema.prisma:200,
projection at auth.service.ts:1724-1744):
  - approvedAt: string | null
  - approvedBy: string | null
  - rejectedAt: string | null
  - rejectedBy: string | null

  Historic rejections return null for rejectedBy; the view displays “not recorded”.

  Null when not applicable; do NOT omit keys.

## C.1b Schema addition

- User gains any of approvedAt, approvedBy, rejectedAt, rejectedBy that are not already present. The precondition check found approvedAt, approvedBy, and rejectedAt present; rejectedBy is missing, so only rejectedBy is added as a nullable field with a self-reference to User.
- No index or constraint is added beyond that self-reference. The existing approvedBy index (schema.prisma:259) is preserved unchanged; no index changes are in scope.
- The reject handler, rejectUser (auth.service.ts:1284-1358), sets rejectedBy and rejectedAt in the same update that sets status=REJECTED in both branches (company update :1309-1317; staff update :1340-1348). The supplied auth.service.ts:2504-2579 reference does not point to this handler in the current checkout.
- The registration projection (auth.service.ts:1724-1744; select begins at :1730) includes rejectedBy.

Counts: companyRegistrationCounts (auth.service.ts:1773, :2006) accepts
  `view`:
    view=queue         -> {PENDING_APPROVAL, COMPLEMENTS_REQUESTED} (+derived overdue)
    view=organisations -> {ACTIVE, REJECTED}
    view=all           -> current behaviour (default)
  Counts remain territory-scoped and independent of search/type/date filters
  (intentional). Response exposes countsView so the UI can detect mismatch.

Acceptance tests (R-series):
  R-1  statuses=ACTIVE,REJECTED as REGIONAL_ADMIN territory A -> only A,
       total matches across pages.
  R-2  same as ADMIN_ONEFOP_REGISTRATIONS -> national set.
  R-3  same as CENTRAL_AGENT -> allowed (read).
  R-4  statuses=PENDING_APPROVAL as REGIONAL_ADMIN -> only A; no terminal leak.
  R-5  status=ALL -> identical to pre-change (regression).
  R-6  statuses=OVERDUE -> 400 pointing to overdue=true.
  R-7  statuses=ACTIVE&status=REJECTED -> 400 (mutually exclusive).
  R-8  statuses=ACTIVE,BOGUS -> 400 naming BOGUS.
  R-9  view=organisations counts == statuses=ACTIVE,REJECTED total.
  R-10 view=queue counts == statuses=PENDING_APPROVAL,COMPLEMENTS_REQUESTED
       total with overdue=false.
  R-11 ACTIVE items: approvedAt/approvedBy populated; rejected* null.
  R-12 REJECTED items: rejectedAt populated; rejectedBy populated for
       rejections after this migration; null for pre-migration rejections
       (documented behaviour).

## C.2 Dossiers endpoint changes

Endpoint: GET /admin/questionnaires
  Controller src/questionnaires/admin-questionnaires.controller.ts:217-224,
             territory at :249
  Service    src/questionnaires/questionnaires.service.ts:3563 (list),
             :3579 (fields)
  Filter     src/questionnaires/admin-list-filter.ts:67-85 (territory,
             overdue, SUPERSEDED exclusion at :69)

Query param `statuses` (comma-separated set of OnefopStatus values):
  - Mutually exclusive with `status` -> 400 if both.
  - Unknown value -> 400; empty set -> 400.
  - SUPERSEDED inclusion rule (CRITICAL):
      * If SUPERSEDED is explicitly present in `statuses`, it IS included
        (mirrors admin-list-filter.ts:69 explicit-request behaviour).
      * If SUPERSEDED is NOT in `statuses`, it remains EXCLUDED â€” exactly
        as the default list does today.
      * This must be deliberate and tested; it must NOT be incidental.
  - "OVERDUE" is not a stored status -> 400 pointing to overdue=true.

Response field additions per list item (projection at
questionnaires.service.ts:3579):
  - campaignName: string | null (currently only campaignId/quarterCode;
    schema.prisma:891, :897)
  - reviewedBy / reviewedAt / rejectionReason: confirm they are projected;
    add if not (schema.prisma:874).
  Do NOT add inline decision history â€” that stays behind the audit link.

Counts: getPilotageQueues (eligibility-engine.service.ts:273-276) accepts
  `view`:
    view=queue     -> current behaviour (SUPERSEDED excluded)
    view=completed -> {APPROVED, REJECTED, SUPERSEDED} (SUPERSEDED included)
    view=all       -> current behaviour (default)
  Counts are territory-scoped and global to the base set for that view
  (do not follow type/region/period/search filters). Response exposes
  countsView.

Export: GET /admin/questionnaires/export
  (admin-questionnaires.controller.ts:288) accepts the same `statuses` set
  parameter with the same SUPERSEDED inclusion rule. CENTRAL_AGENT remains
  excluded from export (class guard :120).

Acceptance tests (D-series):
  D-1  statuses=APPROVED,REJECTED,SUPERSEDED as REGIONAL_ADMIN territory A
       -> only A, total matches.
  D-2  same as ADMIN_ONEFOP_SUBMISSIONS -> national.
  D-3  statuses=APPROVED,REJECTED (no SUPERSEDED) -> SUPERSEDED excluded
       (regression against silent inclusion).
  D-4  statuses=SUPERSEDED explicitly -> only superseded; drafts excluded.
  D-5  default call (no status/statuses) -> SUPERSEDED excluded (regression).
  D-6  statuses=OVERDUE -> 400 pointing to overdue=true.
  D-7  status + statuses -> 400.
  D-8  statuses=BOGUS -> 400 naming BOGUS.
  D-9  view=completed counts == statuses=APPROVED,REJECTED,SUPERSEDED total.
  D-10 view=queue counts == default list total (both exclude SUPERSEDED).
  D-11 statuses=APPROVED,REJECTED,SUPERSEDED as CENTRAL_AGENT -> allowed.
  D-12 export with statuses=APPROVED,REJECTED,SUPERSEDED as CENTRAL_AGENT
       -> 403 (existing exclusion preserved).
  D-13 items include campaignName; null where no campaign.
  D-14 DIVISIONAL_ADMIN territory B with statuses -> only B's records.

## C.3 Phase 1 exit criteria (nine gates, all must pass)

1. All acceptance tests R-1..R-12 and D-1..D-14 pass.
2. Territory scope proven for both new `statuses` paths (cross-territory
   access returns empty/refused).
3. SUPERSEDED inclusion proven deliberate: D-3 (exclude), D-4 (include),
   D-5 (default exclude) all pass.
4. Counts == list total for each `view` value on both modules.
5. Backward compatibility: single-status and default calls identical to
   pre-change (regression suite).
6. OVERDUE guard: statuses=OVERDUE returns 400 on both (R-6, D-6).
7. Mutual exclusivity: status + statuses returns 400 (R-7, D-7).
8. CENTRAL_AGENT export exclusion preserved (D-12).
9. Schema changes in this phase are limited to additive nullable columns on User (the decision actor group). No changes to OnefopSubmission, no index changes, no constraint changes.

=====================================================================