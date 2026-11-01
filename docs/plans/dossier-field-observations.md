# Reviewer observations on individual answers — proposal

Proposal for the owner's approval. Written 2026-11-01.

Status, 2026-11-01: Part A built (uncommitted), warnings only. Decision 2
was revised while building it: the Quality Centre describes FIELD_INSPECTION
as an on-site check by a sworn agent, so « Expliquée » is stored under a new
resolution type, REVIEWER_EXPLANATION (migration
`20261101120000_anomaly_reviewer_explanation`), refused by the server on a
blocking anomaly. Recorded in CLAUDE.md §21, 2026-11-01. Part B not started.
It answers objective 5 of the review-workspace brief (« record observations
and annotations against specific fields ») and the item the review-desk plan
deferred: « Reviewer flags on individual answers, each with a note, feeding
the correction request: a new record type, so a schema change (§21) »
(`docs/plans/dossier-review-workspace.md`, Phase 3).

It has two parts. Part A needs no schema change, but it changes what a
reviewer may do with an automated finding, so it needs a decision too.
Part B is the schema change.

## What exists today (verified in the code, 2026-11-01)

- **Review notes are file-level audit events.** `POST
  /admin/questionnaires/:id/review-progress` (`saveReviewProgress`) takes a
  10–2,000-character note and the file's `expectedRevision`, requires the
  active claim, extends the claim's activity, and stores the note as an
  audit row. A note cannot name a question, a table or a cell.
- **An automated finding can already be closed on the server, but not from
  the workspace.** `OnefopAnomaly` carries `status` (OPEN, RESOLVED, WAIVED),
  `resolutionType` (DECLARANT_CORRECTION, FIELD_INSPECTION,
  LEGAL_DEROGATION), `resolutionNote`, `resolvedById`, `resolvedAt` and
  `evidenceUrl`. `EligibilityEngineService.resolveAnomaly` enforces the
  territory, the file's revision and the active claim, and limits
  LEGAL_DEROGATION (→ WAIVED) to SUPER_ADMIN and ADMIN_ONEFOP. Only
  `/admin/centre-qualite` calls it; the dossier workspace does not.
- **There is no "confirmed error" state.** An open finding is either still
  open or closed (RESOLVED/WAIVED). Nothing records « the reviewer looked and
  agrees this is wrong ».
- **The correction request is free text.** The modal's section choice is
  joined into `rejectionReason` (`[Section] Constat : …`). The respondent
  reads that text; nothing structured goes with it.
- **The page already gives each answer an anchor** (`dossier-field-<fieldId>`,
  `finding-targets.ts`, in the uncommitted work), which an observation can
  point at. Individual cells have no anchor.

## Part A — assess automated findings in the workspace (no schema change)

Proposal: show, on each finding in « À vérifier », the existing resolve
action, with the existing guards. The reviewer picks a resolution type and
writes a note; the finding then reads « Résolue » or « Dispense » with who,
when and why, and leaves the open count.

Why it needs a decision even without a migration:

1. **It changes what endorsement asks for.** Today an open warning makes the
   reviewer write a justification at endorsement (§7, plan « What stays as
   it is »). A warning resolved beforehand no longer counts as open, so the
   justification moves from the endorsement dialog to the finding. The
   record is better (it is attached to the finding), but it is a change to
   the decision flow.
2. **The resolution types do not fit a reviewer at a desk.**
   DECLARANT_CORRECTION assumes the respondent corrected the file, but a
   correction is a NEW submission (§21, 2026-10-16), so on the file under
   review the data has not changed. FIELD_INSPECTION fits a visit, not a
   reading. What a reviewer actually concludes is « explained — the figures
   are right » or « confirmed — the figures are wrong ». The first is
   closest to FIELD_INSPECTION; the second has no type at all.
3. **Blocking findings.** The server lets a claim holder resolve a blocking
   finding, which then no longer blocks endorsement. Whether a reviewer
   should be offered that in the workspace, or only for warnings, is the
   owner's call (§7: which check blocks is a human decision).

Recommendation: offer it for **warnings only** at first, with one
resolution offered in the UI (« Expliquée », mapped to FIELD_INSPECTION,
note required), and keep LEGAL_DEROGATION where it is today (Quality Centre,
national roles). A confirmed error is not a resolution: it becomes an
observation (Part B) and goes into the correction request.

## Part B — observations on answers (schema change)

### The record

A new table, `onefop_review_observations`:

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid | |
| `submissionId` | FK → OnefopSubmission, cascade | the file |
| `fieldId` | text | the AST question id (`S22Q03`, `VT4_2`), validated against the schema for the file's form type |
| `cellKey` | text, nullable | one cell (`s22q03_cadres_bac_male_25_34`) when the observation is about a figure, validated to belong to `fieldId` |
| `anomalyId` | FK → OnefopAnomaly, nullable, set null | when it confirms an automated finding |
| `kind` | enum `QUERY`, `ERROR` | « à clarifier » / « erreur constatée » |
| `body` | text, 10–2,000 characters | the reviewer's words, the same bounds as a review note |
| `status` | enum `OPEN`, `SENT`, `WITHDRAWN` | SENT once included in a correction request |
| `authorId` | FK → User | |
| `createdAt` | timestamp | |
| `closedAt`, `closedById` | nullable | withdrawal or sending |

Rules:

- **Never edited, never deleted.** A wrong observation is WITHDRAWN, with its
  author and time kept; a new one replaces it. The trail is the point.
- **Not statistical data.** It is in no dataset, Excel or SPSS export, no
  PDF, no eligibility rule (§4: an LMIS administrative record). Submitted
  answers stay untouched and read-only.
- **Normalised, not a JSON blob on the submission** (§6).

### Who may do what

- **Write** (create, withdraw): the active claim holder only, on a file in a
  status that accepts review, with the file's `expectedRevision`, inside the
  actor's territory — the guards `saveReviewProgress` already applies, and
  like it, an observation counts as review activity (claim extended,
  revision incremented). Roles: SURVEY_ADMIN_ROLES.
- **Read**: DOSSIER_READ_ROLES, CENTRAL_AGENT included, read-only (§14).
- Withdrawing someone else's observation: not allowed, except by
  SUPER_ADMIN / ADMIN_ONEFOP — to be confirmed (decision 4).

### API (all bilingual errors, `error-messages.ts`)

- `GET /admin/questionnaires/:id/observations`
- `POST /admin/questionnaires/:id/observations` — `{ fieldId, cellKey?, anomalyId?, kind, body, expectedRevision }`
- `PATCH /admin/questionnaires/:id/observations/:observationId/withdraw` — `{ reason, expectedRevision }`
- Each write recorded in the audit log (`AUDIT_OBSERVATION_ADDED`,
  `AUDIT_OBSERVATION_WITHDRAWN`).

### In the workspace

- Each answer gets « Ajouter une observation » (claim holder only); a table
  cell can be chosen inside the read-only grid.
- Observations are listed with the findings under « Contrôles » in the rail,
  and marked on their answer the way findings are, counted in « À vérifier ».
- A confirmed finding offers « Confirmer comme erreur », which creates an
  ERROR observation linked to it.

### The correction request

The correction dialog lists the file's OPEN observations, ticked by default;
the reviewer may untick any. The ticked ones are written into the request
text the respondent already reads (question number and label, cell in
words, the reviewer's text) and become SENT. The free-text reason stays.
The respondent side, the correction flow and the SUPERSEDED rule are
unchanged. Showing the observations to the respondent as structured items
on their own form is later work, not this proposal.

### Migration

Additive: `CREATE TABLE` plus two enums, no change to an existing column, no
backfill. Every file reviewed before it has no observations, which is true.
Covered by a `test:pg` spec (rolled back), like
`campaign-quota-pg.spec.ts`.

### What it does not change

The six statuses, the decision routes and their guards, which checks block
(§7), territorial scoping, the claim model, the answers, every export, the
PDF, the dataset version.

## Decisions needed from the owner

1. **Part A:** may a reviewer close an automated finding from the workspace?
   Warnings only (recommended) or blocking findings too?
2. **Part A:** the resolution offered — « Expliquée » mapped to the existing
   FIELD_INSPECTION (recommended, no change), or a new resolution type (a
   schema change of its own)?
3. **Part B:** approve the `onefop_review_observations` table as described.
4. **Part B:** may a national role withdraw another reviewer's observation?
5. **Part B:** do ticked observations go into the correction request text
   (recommended), or stay internal to reviewers?

## Order of work, once approved

1. Part A in the workspace (frontend only, existing route).
2. Part B data layer: migration, service, routes, guards, unit and pg tests.
3. Part B workspace: add, list, mark, withdraw.
4. Part B correction dialog.

Each a separate commit for the owner's review; the decision is recorded in
CLAUDE.md §21 when approved.
