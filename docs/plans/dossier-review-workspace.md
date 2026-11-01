# Dossier review workspace — design orientation and phased plan

Brief for whoever picks this up. Written 2026-11-01.

The ONEFOP review queue (`react-web/src/app/admin/dossiers/page.tsx`) and the
review workspace (`react-web/src/app/admin/dossiers/[id]/page.tsx`) must carry
a national campaign: hundreds of files per round, several reviewers, several
territories. This plan records the orientation the owner adopted on
2026-11-01 after a read-only audit of the current implementation, and the
phases that follow from it.

The principle: make the reviewer's work faster without weakening the
reviewer's responsibility. Fewer clicks, never fewer checks.

## What stays as it is

These are not up for change in any phase of this plan. A phase that seems to
need one of them changed stops and asks the owner.

- The six statuses: DRAFT, PENDING_REVIEW, CORRECTION_REQUESTED, APPROVED,
  REJECTED, SUPERSEDED. A corrected file is a NEW submission; the old one
  becomes SUPERSEDED (CLAUDE.md §21, 2026-10-16).
- Submitted answers are read-only in the workspace. Editing a respondent's
  answers is a separate business requirement, not part of this plan.
- Every decision is enforced server-side: active claim held by the actor,
  allowed status, `expectedRevision` matching, no open blocking anomaly,
  a justification when warnings remain open, certification on reject,
  correction and reopen, bulk preflight. The UI may hide or disable an action;
  it is never the control.
- The three diagnostic axes (administrative status, data quality,
  statistical eligibility) stay a diagnostic. Eligibility stays derived and is
  never written. No mandatory per-axis checklist without a separate decision.
- Anomaly severity and the blocking/advisory split (CLAUDE.md §7). A visual
  redesign never changes which check blocks.
- Territorial scoping (§14) and the read-only observer role (CENTRAL_AGENT).
- UX rules: one primary green action per screen (§11), no decorative
  containers (§8), tokens and `docs/standards/ui-grammar.md` (§12),
  `npm run check:ui-grammar` after any admin change (§18).

## What the audit established (2026-11-01)

Verified against the code, not taken from the audit's wording:

- Assignment is self-claim only: `assignSubmission` refuses to assign anyone
  but the caller (committed at `89b82b10`). CLAUDE.md §21, entry 2026-10-27,
  still describes the route as "claim, reassign or release". The record and
  the code disagree; Phase 0 settles it.
- Claim expiry (12 h, `ONEFOP_REVIEW_CLAIM_INACTIVITY_HOURS`) and revision
  locking depend on `claimActivityAt` and `revision`, added by migration
  `20261030120000_claim_activity_and_revision`. On 2026-11-01 that migration
  and the service/controller code using it were UNCOMMITTED. A claim with no
  activity timestamp (legacy) never expires, by design.
- The queue fetches 10 rows a page (`PAGE_SIZE`), offset paging, server cap
  100 (`LIST_MAX_LIMIT`). Each row carries answer data, which is heavy.
- The queue's « Valider » opens the preview drawer, whose confirmation calls
  the same `approve` endpoint as the workspace; « Valider et suivant » endorses
  and moves to the next row of the loaded page only (« Valider et passer au
  suivant »). The same action is
  labelled « Valider » in the queue and « Viser » in the workspace.
- A resubmitted file is an ordinary PENDING_REVIEW row. Its predecessor is
  reachable only through the reverse relation `supersedes`
  (`OnefopSubmission.supersededById` on the old row). The list does not
  return it, so the queue cannot tell a resubmission from a first submission.
- The correction modal's section choice is concatenated into the free-text
  `rejectionReason` (`[Section] Constat : …`). It is not a field.
- Anomaly rows carry rule code, family, severity, observed and expected
  values, but no questionnaire section or field.
- There is no "supervisor" role.

## Phases

Each phase ends in a commit the owner reviews before the next starts
(phase-gated, files staged explicitly, the owner commits).

### Phase 0 — Settle the ground

Not UI work; a precondition.

1. Commit the claim-activity / revision work and its migration, after
   review. Phase 1 edits the same files; building on an uncommitted tree
   risks mixing two changes in one commit.
2. Resolve the reassignment contradiction: either update the 2026-10-27
   §21 entry to say self-claim only (and why), or restore reassignment as
   approved. Owner's call.

### Phase 1 — Queue optimisation

Detailed brief below.

### Phase 1.5 — Sticky decision toolbar

A toolbar in the workspace that stays visible while scrolling, holding the
decisions the current user may take on this file. One primary action. Same
eligibility rules as today (`dossier-axes.ts`, `dossier-review-state.ts`);
server checks unchanged. Frontend only.

### Phase 2 — Continuous review

Previous / Next across the reviewer's current queue, not just the loaded page.

- Server: a "next after (submissionDate, id)" query under the same filters
  and territory as the list (keyset, not offset — a decided file leaves the
  queue and would shift every offset after it). The sort already breaks ties
  on id.
- After a decision, move to the next file, re-read it, re-check status and
  claim. A claim that expired or a revision that moved is reported, not
  overridden.
- No migration.

### Phase 3 — Workspace optimisation

- Persistent section index over the read-only answers.
- Findings panel: blocking and advisory visibly distinct, observed/expected
  values, resolution status.
- Grouping by questionnaire section and jumping to a field ONLY once a
  rule → section/field mapping exists and the ONEFOP domain agent has
  reviewed it. Until then, group by rule family. A wrong anchor misleads a
  reviewer; no anchor is better.
- Unify the endorse wording (« Valider » vs « Viser ») — one action, one name.

### Phase 4 — Workflow changes (each needs owner approval under §21)

None of these starts without its own approval in chat, recorded in CLAUDE.md.

- Supervisor assignment / reassignment: who is a supervisor (the délégué
  model of 2026-10-26 is the natural starting point), within which
  territory, audited as DOSSIER_ASSIGNED with the previous holder. RBAC.
- Correction ownership: whether a resubmission goes back to the previous
  reviewer. If so, assigning must set `claimActivityAt`, or an absent
  reviewer strands the file until expiry.
- Structured progress saving / autosave: today a note is an audit event
  (10–2,000 characters). Autosave would flood the audit log; it needs a
  draft field — a schema change.

### Phase 5 — Performance and analytics

- Trim the list payload (answer data out of list rows) BEFORE offering
  larger page sizes or page-size controls; benchmark against a realistic
  round.
- Team workload: per-reviewer active claims, overdue, follow-ups. Showing
  individual review times or ranking reviewers is a staff-monitoring policy
  question for the owner, not a dashboard default.
- These are administrative (LMIS) metrics, not Observatory statistics (§4).

## Phase 1 brief — queue optimisation

Goal: a reviewer opens the queue and sees at once what is theirs, what is
free, and what came back corrected — and the row offers the one action that
fits.

### Views

The views REPLACE today's status quick filters and assignment quick filter;
they do not stack above them. The advanced filter panel stays.

| View | Query (existing filters) |
|---|---|
| Ma file | PENDING_REVIEW, assignment=me |
| Non attribués | PENDING_REVIEW, assignment=unassigned |
| Tous en attente | PENDING_REVIEW |
| Corrections demandées | CORRECTION_REQUESTED — waiting on the respondent |
| Traités | the existing completed view |

Resubmissions are PENDING_REVIEW and appear in the first three views,
marked as such (see below). They are not a separate status and must never
be shown as one.

Each view shows its count. Default view: « Ma file » when the reviewer holds
claims, else « Non attribués ». Read-only roles see « Tous en attente »,
« Corrections demandées » and « Traités » only.

Open question for the owner before building: whether a CORRECTION_REQUESTED
file should stay claimable (the reviewer can only reject it while it waits).
Phase 1 keeps today's behaviour either way.

### Resubmission marker (backend, no migration)

The list returns, per row, the id and submission reference of the file it
supersedes, from the existing `supersedes` relation. The queue shows
« Correction reçue » with a link to the previous file. Covered by a spec in
`src/questionnaires/`.

### Columns

Keep the information that is there today; tidy the hierarchy, drop nothing
important:

Selection · Entité / répondant · Type / territoire · Statut et contrôles ·
Ancienneté · Agent · Actions.

### Row actions

One primary action per row; the rest in the row menu.

| Situation | Primary action |
|---|---|
| Pending, unclaimed | Réclamer |
| Claimed by me, open checks or no validation data | Examiner les anomalies |
| Claimed by me, clean | Valider (opens the confirmation; endorsement is server-checked) |
| Claimed by someone else | Voir |
| Correction requested | Voir l'historique |
| Completed | Voir |

### Not in Phase 1

Supervisor assignment, correction ownership, Previous/Next beyond the page,
page-size changes, per-reviewer metrics.

### Done means

- Backend spec for the supersedes projection; existing list/claim specs
  green (`node node_modules/jest/bin/jest.js --runInBand` on the touched
  specs).
- react-web unit tests for view → query mapping and row-action selection,
  beside `dossier-axes.test.ts` and `dossier-review-state.test.ts`.
- `npx tsc --noEmit`, `npm run lint`, `npm run check:ui-grammar` in `react-web/`;
  no baseline raised.
- Checked in the browser for a reviewer, a regional admin and CENTRAL_AGENT,
  or stated plainly that it could not be (no staging backend).

## Acceptance criteria for the whole plan

The owner sets the figures; until then these are placeholders, not targets.

1. A reviewer reaches their own claimed files in one click from the queue.
2. A resubmission is distinguishable from a first submission in the queue.
3. Every row offers exactly one primary action that matches its state.
4. A reviewer can move file to file without returning to the queue (Phase 2).
5. Blocking and advisory findings are visibly distinct.
6. Every existing decision guard still refuses what it refused before —
   proven by the existing specs passing unchanged.
7. Every claim, release, assignment and decision is in the audit log.
8. Queue response time at [N] files per round stays under [X] (to be set).
