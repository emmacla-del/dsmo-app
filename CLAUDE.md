# CAM-LEAP Engineering Constitution

## 1. PROJECT IDENTITY

CAM-LEAP is the Cameroon Labour Market Information System and
Employment Observatory Platform developed for ONEFOP/MINEFOP.

The current platform digitizes two principal reporting streams:

1. ONEFOP statistical questionnaires
2. DSMO manpower declarations

CAM-LEAP is a statistical information system, not merely a generic
CRUD application.

Every engineering decision must therefore preserve:

- statistical integrity
- data traceability
- administrative accountability
- geographic data isolation
- questionnaire semantics
- reliable exports
- official reporting workflows

---

# 2. REPOSITORY ARCHITECTURE

This repository contains three principal application layers.

## Backend

NestJS + TypeScript + Prisma + PostgreSQL.

Primary location:

`src/`

Important domains:

- auth
- questionnaires
- onefop
- dsmo
- analytics
- data-management
- pdf
- campaign
- email
- onefop-schema-validation

Database:

`prisma/schema.prisma`

---

## Modern Web Frontend

Next.js 16 + React 19 + TypeScript.

Location:

`react-web/`

This is the primary modern web frontend and the migration target
from the legacy Flutter Web interface.

---

## Flutter Client

Flutter/Dart application.

Location:

`lib/`

The Flutter application remains important because it contains
the canonical ONEFOP AST/schema compiler.

---

# 3. CANONICAL QUESTIONNAIRE SOURCE

The canonical questionnaire/schema source is:

`lib/core/focus/compiler/onefop_ast.dart`

The generated schema artifacts are:

`assets/schemas/onefop.schema.json`

and

`react-web/public/schemas/onefop.schema.json`

NEVER manually edit the generated JSON schema artifacts.

If questionnaire structure or statistical semantics must change,
inspect and modify the canonical AST source first.

After changing the canonical source, regenerate the schema using
the established project tooling.

---

# 4. LMIS VS OBSERVATORY

CAM-LEAP must preserve the distinction between:

## LMIS

The Labour Market Information System is primarily responsible for:

- data collection
- validation
- storage
- administrative processing
- data preparation
- export

## Observatory

The Observatory operates above the LMIS.

It is responsible for:

- statistical analysis
- indicators
- trends
- forecasting
- labour-market intelligence
- public statistical dissemination

Do not collapse the LMIS and Observatory into one conceptual layer.

---

# 5. STATISTICAL INTEGRITY

Statistical variables are more important than UI convenience.

A developer must NEVER:

- remove a statistical variable merely because its UI is difficult
- change the meaning of a variable without domain review
- alter category definitions casually
- change table dimensions without understanding downstream effects
- replace normalized statistical data with arbitrary JSON storage
- silently change calculation formulas
- change export semantics merely to simplify frontend implementation

When a UI problem conflicts with the questionnaire model:

PREFER improving the UI.

Do not alter statistical semantics unless explicitly authorized.

---

# 6. DATABASE INTEGRITY

ONEFOP statistical tables must remain relationally structured.

Do not introduce generic JSON storage as a replacement for
normalized statistical tables simply because it is easier to implement.

Before modifying Prisma models, inspect:

- questionnaire submission logic
- exports
- PDF generation
- analytics
- existing migrations
- administrative review
- existing tests

Database migrations require explicit architectural review.

---

# 7. COHERENCE RULES

Arithmetic coherence checks are advisory by default.

`onefop-coherence.ts`

and related backend coherence checks must NOT become
submission-blocking merely because an AI agent believes
the data should be mathematically perfect.

Real establishments may have legitimate statistical exceptions.

Coherence warnings should remain distinguishable from
structural validation errors.

A check MAY block when a human owner decides it should, because
it compares breakdowns of the same population that cannot
legitimately disagree. Each such decision is recorded below,
with its date and scope. A check comparing different populations
or reference periods stays advisory until domain review.

Blocking checks currently in force:

- 2026-10-09 — VT cross-table totals (`react-web/src/lib/vt-cross-table.ts`):
  4.1 = 4.2 = 4.5 (learners), 4.5 FI = 4.6, and 8.1 = 8.2 = 8.3 = 8.5
  (trainers), by sex, once both tables are complete. They block
  Suivant and submission in the wizard. The server's 4.2/4.7, 4.2/4.8
  and 4.7/4.10 checks are NOT in this list: they await domain review.
  Since 2026-10-16 the respondent sees them as amber, non-blocking lines
  under those tables (`react-web/src/lib/vt-advisory-coherence.ts`).
  Server-side, coherence flags are stored as non-blocking warnings
  (`src/questionnaires/coherence-anomaly.ts`).
- 2026-10-11 — VT table 5.3 (`react-web/src/lib/vt-infrastructure-check.ts`):
  on each row, "Nombre total de locaux" = Définitif bon état + Définitif
  mauvais état + Provisoire, once all four cells are filled. Basis: the
  official ASFOP 2025-2026 form puts the three columns under one heading,
  "Nombre de locaux selon les matériaux de construction et l'état", and
  its instructions give every room a construction type and every
  permanent room a condition. Blocks Suivant and submission in the
  wizard. The "Espaces temporaires" row follows the same rule only;
  whether it must be counted entirely as Provisoire awaits MINEFOP.
- 2026-10-16 — VT "of which" subsets (`vtSubsetIssues` in
  `react-web/src/lib/onefop-validation.ts`, `checkVtSubsetViolations` in
  `src/questionnaires/questionnaires.service.ts`): 2.1.7 women ≤ total
  specialised trainers (VT2_8 ≤ VT2_7), 2.1.16 lower + upper secondary ≤
  2.1.15 total trainees (VT2_21 + VT2_22 ≤ VT2_19), 2.2.15 women ≤ total
  ICT-trained trainers (VT2_48 ≤ VT2_47). Basis: a part of a count cannot
  exceed the count it belongs to, a hard logical edit, not a comparison of
  two populations. Warned on entry, blocks submission in the wizard and on
  the server. Confirmed by the owner in chat, 2026-10-16.
- 2026-10-16 — VT 6.3 placed leavers ≤ 4.10 leavers (rule 5 of
  `vtSubsetIssues` in `react-web/src/lib/onefop-validation.ts`, rule 5 of
  `checkVtSubsetViolations` in `src/questionnaires/questionnaires.service.ts`):
  for a specialty named in both tables, 6.3 men ≤ 4.10 men and 6.3 women
  ≤ 4.10 women; and the 6.3 total ≤ the 4.10 total. Basis: 6.3 counts the
  leavers of 4.10 who found work, for the same prior year (both labels read
  « pour l'année antérieure »), so it is an "of which" subset of 4.10, not
  a second population. A specialty named in 6.3 but not in 4.10 is not
  compared row by row. Warned on entry, blocks Suivant and submission in
  the wizard and on the server. Confirmed by the owner in chat, 2026-10-16.

---

# 8. UX PRINCIPLES

CAM-LEAP should feel like a modern government statistical
declaration portal.

Priorities:

1. clarity
2. simplicity
3. low cognitive load
4. accessibility
5. responsiveness
6. statistical usability

Avoid:

- unnecessary cards
- decorative containers
- excessive borders
- unnecessary grey field fills
- excessive visual decoration
- boxed radio/checkbox options
- nested scrollbars
- unnecessarily long instructions
- duplicated headings
- technical codes exposed to respondents

---

# 9. FORM CONTROL RULES

Use:

- radio buttons for exactly one choice
- checkboxes for multiple choices
- entire option labels should be clickable

Do not visually enclose radio/checkbox options in unnecessary
cards or decorative containers.

"Not answered" must be distinguishable from:

- Yes
- No

Do not silently interpret an unanswered value as "No".

---

# 10. PROGRESSIVE DISCLOSURE

Respondents should not be confronted with irrelevant
statistical tables.

Gateway questions and the EventFactInterview mechanism
are intentional parts of the questionnaire UX.

Do not remove gateway logic without understanding its
effect on table applicability and zero-filling.

---

# 11. WIZARD NAVIGATION

The declaration wizard should maintain:

- clear section hierarchy
- visible progress
- one primary action
- predictable previous/next navigation
- appropriate responsive behaviour

There should normally be one primary green action per wizard screen.

---

# 12. DESIGN TOKENS

In React Web, visual values should use the established
CAM-LEAP design-token system.

Primary location:

`react-web/src/app/tokens.css`

How to use those tokens on an administrative screen - the class
vocabulary, the colour, typography and spacing rules, and the
reference page - is specified in:

`docs/standards/ui-grammar.md`

Do not introduce arbitrary colors, spacing systems, typography,
or competing design systems without architectural review.

---

# 13. RESPONSIVE DESIGN

CAM-LEAP must work across:

- desktop
- laptop
- tablet
- mobile

Wide statistical tables may use horizontal scrolling.

Do not create nested scrolling structures unnecessarily.

The sidebar must not create competing internal scroll systems.

---

# 14. AUTHORIZATION

Administrative geographic boundaries are security boundaries.

The following hierarchy is fundamental:

DIVISIONAL
â†’ Department

REGIONAL
â†’ Region

CENTRAL
â†’ National

SUPER ADMIN
â†’ Platform-wide

Never assume that frontend hiding of information is sufficient
for authorization.

Authorization must be enforced server-side.

---

# 15. SECURITY

Current JWT storage in browser storage is recognized as
a security concern.

Do not spontaneously redesign authentication.

Any authentication architecture change must first be reviewed
by the CTO/architecture and security agents.

Potential future direction:

secure httpOnly SameSite cookies with appropriate CSRF protection.

---

# 16. TESTING

Production functionality must be tested.

The React Web application currently has a major testing gap.

Priority areas include:

- onefop-validation.ts
- onefop-coherence.ts
- gateway logic
- AdaptiveStatisticalTable
- draft persistence
- declaration submission
- authentication
- administrative authorization

Do not consider a feature complete merely because it compiles.

---

# 17. GENERATED ARTIFACTS

Before editing any generated artifact, identify its source.

Never manually modify generated files when a canonical source
exists elsewhere.

---

# 18. AI AGENT BEHAVIOUR

AI agents must:

1. inspect before modifying
2. understand dependencies before changing shared code
3. prefer minimal changes
4. avoid unrelated refactoring
5. preserve existing behaviour unless change is intentional
6. explain risky changes
7. run appropriate tests
8. report failures honestly
9. never fabricate successful test results
10. stop and request architectural review when a change crosses
   specialist boundaries
11. run `npm run check:ui-grammar` in `react-web/` after any change
   under `app/admin/**` or `components/admin/**`, and never raise a
   baseline in `scripts/ui-grammar-baseline.json` to make a change
   pass

---

# 19. SPECIALIST DELEGATION

Use the following specialist boundaries.

## ONEFOP Domain Agent

Questionnaire semantics, AST, statistical variables,
coherence, SPSS, statistical exports.

## UX Agent

User experience, information architecture, interaction design,
accessibility, form usability.

## Frontend Agent

Next.js/React implementation.

## Backend Agent

NestJS/API/business logic.

## QA Agent

Testing and regression detection.

## Security Agent

Authentication, authorization, geographic isolation,
security auditing.

## CTO

Architecture, cross-domain decisions, delegation,
integration and final review.

---

# 20. CHANGE DISCIPLINE

Do not make large unrelated changes in a single task.

For every meaningful change:

1. identify affected modules
2. identify risks
3. define the smallest viable change
4. implement
5. test
6. review
7. report

Prefer small, reversible changes.

---

# 21. HUMAN APPROVAL REQUIRED

The following require explicit human review before implementation
or merging:

- database schema changes
- authentication architecture changes
- RBAC changes
- changes to statistical definitions
- changes to questionnaire structure
- changes to canonical AST semantics
- changes affecting official exports
- changes affecting official PDF output
- major infrastructure changes
- deletion of production functionality

These rules exist to protect correctness, not to leave real
defects unfixed. When a rule in this constitution stands in the
way of resolving a genuine issue:

1. name the rule and the issue, and trace the issue to its root;
2. propose the smallest fix and its consequences;
3. proceed once the human owner approves it explicitly in chat;
4. record the decision in the section concerned (as §7 does),
   so later agents do not undo it.

An approval covers the change it was given for. It is not a
standing waiver of the rule.

Approved changes on record:

- 2026-10-15 — official VT PDF ticks radio/checkbox answers
  (`src/services/pdf-data-mapper.service.ts`, `vtChoiceKeys`).
  Issue: answers are stored as the schema option value (the bilingual
  label), but the PDF compared them with short keys, so 1.10, 1.11, 1.13,
  2.1.2, 2.1.14, 2.2.1, 2.2.2, 2.2.8, 2.2.12, 2.2.13, 3.2, 6.1.1, 6.1.3,
  6.2.1 and 9.1 never ticked. Fix: map a stored answer to the PDF option
  at the same position in the schema's option list, the rule the SPSS
  export already uses; an answer matching no option stays unticked. The
  PDF lists must follow the schema order (`pdf-flow.spec.ts` checks it).
  Template and statistical semantics are unchanged.
- 2026-10-15 — dataset v10: 9.1 and 9.2 write-in lines as separate
  variables (`src/data-management/canonical-schema-adapter.service.ts`,
  `LIST_TEXT_SLOTS`). Issue: the five lines of 9.1 « Autre » (VT9_3) and
  9.2 « Perspectives » (VT9_4) were exported as one comma-joined string,
  which analysts could not split. Fix: one A2000 variable per line,
  VT9_3_1..VT9_3_5 and VT9_4_1..VT9_4_5; VT9_3 and VT9_4 are retired in
  the frozen registry (names reserved, never reused);
  DATASET_SCHEMA_VERSION = 10. The questionnaire is unchanged. Analyst
  note: `docs/reference/jeu-de-donnees-onefop-version-10.md`.
- 2026-10-15 — 8.8 named staff list export
  (`src/data-management/spss/vt-roster-export.ts`,
  `POST /data-management/export/vt-roster/{sav,csv,manifest}`).
  Issue: ONEFOP analysts need the staff roster, which the anonymous
  statistical dataset excludes as personal data (`canonical-exclusions.ts`).
  Decision: a separate file, one row per person, joined to the main dataset
  by `submissionId`, with the main export's selection rules (territory,
  eligibility, filters). Access: SUPER_ADMIN and ADMIN_ONEFOP only,
  enforced server-side; regional and divisional roles never receive names.
  Every download is recorded in the export history. The data-protection
  review required by design note §9 was signed off by the owner in chat.
  The anonymous dataset still excludes 8.8.
- 2026-10-15 — VT 7.1.2 asked only when 7.1 = Oui
  (`lib/core/focus/compiler/onefop_ast.dart`, VT7_6).
  Issue: 7.1.2 asks about breaching "ces aspects", the 7.1.1 directives,
  yet was required when 7.1 = Non, when there are no directives. The
  ASFOP 2025-2026 form (p.14) prints no "Si oui" before 7.1.2, but 7.1.1
  and 7.1.3 around it already depend on 7.1 = Oui. Fix: VT7_6 depends on
  VT7_1 = "Oui/ Yes"; when skipped it is unanswered (blank in the export),
  never "Non". Earlier submissions keep the answer they gave.
- 2026-10-16 — official VT PDF 8.8 sex code mapping & empty row rendering (Defect 1)
  (`src/services/pdf-data-mapper.service.ts`, `vtSexKey`, and
  `src/pdf/templates/dynamic/vocationalTraining.hbs`).
  Issue: stored codes "1" (Male) and "2" (Female) were not recognized by
  vtSexKey, and the template defaulted blank/unknown sex to 2, causing empty
  roster rows to print "2 / 2" and men to print as women (sex 2). Fix:
  vtSexKey accepts stored codes "1" and "2", and the template renders blank
  when sex or administrative role is not present. §21 approval granted and
  confirmed on 2026-10-16.
- 2026-10-16 — dataset v11: VT contact details moved to a restricted
  contact file (Defect 3) (`src/data-management/canonical-exclusions.ts`,
  `src/data-management/spss/vt-contact-export.ts`,
  `POST /data-management/export/vt-contact/{sav,csv,manifest}`).
  Issue: the anonymous statistical dataset carried the names, phones and
  emails of 1.15, 1.16 and 2.1.12. Fix: nine variables (VT1_15_NAME,
  VT1_15_TEL1, VT1_15_TEL2, VT1_15_EMAIL, VT1_16_NAME, VT1_16_TEL1,
  VT1_16_TEL2, VT1_16_EMAIL, VT2_12) are excluded from it and retired in
  the frozen registry (names reserved, never reused);
  DATASET_SCHEMA_VERSION = 11. They are exported in a separate file, one
  row per submission, joined by `submissionId`, with the main export's
  selection rules. Access: SUPER_ADMIN and ADMIN_ONEFOP only, enforced
  server-side; every download is recorded. VT1_15_FUNCTION and the sex
  variables stay in the anonymous dataset. Approved by the owner in chat,
  2026-10-16. The questionnaire is unchanged. Analyst note:
  `docs/reference/jeu-de-donnees-onefop-version-11.md`.
- 2026-10-16 — reopen an endorsed file for correction (defect 13)
  (`PATCH /admin/questionnaires/:id/reopen-for-correction`,
  `QuestionnairesService.reopenForCorrection`). Issue: an APPROVED file could
  never be returned, and the respondent's next submit for the period was
  refused with 409. Decision: SUPER_ADMIN and ADMIN_ONEFOP only, enforced
  server-side (route and service); APPROVED files only; a written reason
  (10+ characters) and the reviewer's attestation; refused once the file's
  period is closed. The file becomes CORRECTION_REQUESTED and follows the
  existing correction flow; every reopening is recorded as AUDIT_REOPEN.
  While reopened, the file is out of the validated exports. No schema
  change. Confirmed by the owner in chat, 2026-10-16.
- 2026-10-16 — .sps dictionary wording (defect 21)
  (`src/data-management/canonical-schema-adapter.service.ts`,
  `REGION_NAMES`). Issue: region VALUE LABELS were keyed by codes
  ("LITTORAL") that no record holds, so SPSS applied none; table labels
  carried cell keys ("s4q3_row1"); the header said DSMO. Fix: region labels
  keyed by the stored region names (frozen registry updated with
  `spss:registry --write --accept-value-labels`), unnamed rows and columns
  labelled "Ligne n" / "Colonne n", header "Généré par CAMLEAP". Variable
  names, values, order and DATASET_SCHEMA_VERSION (11) unchanged. Analyst
  note: `docs/reference/jeu-de-donnees-onefop-version-11.md`. Confirmed by
  the owner in chat, 2026-10-16.
- 2026-10-16 — VT 2.2.7 English label (`lib/core/focus/compiler/onefop_ast.dart`):
  "fonctional" corrected to "functional"; both schema artifacts regenerated
  with `flutter test test/tools/export_onefop_schema_test.dart`. Label only:
  id, path and options unchanged. Confirmed by the owner in chat, 2026-10-16.
- 2026-10-16 — SUPERSEDED: a correction request answered by a newer file
  is closed (schema change; migrations `20261022120000_onefop_superseded_status`
  and `20261022120100_onefop_superseded_backfill`). Issue: a resubmission
  after a correction request or a reopening lands as a new file, and the old
  one stayed CORRECTION_REQUESTED forever, in the reviewers' queue, the
  pilotage counts and the respondent's home. Decision: `OnefopStatus`
  gains SUPERSEDED and `OnefopSubmission.supersededById` names the
  replacing file; a final submission closes the period's open correction
  requests (`QuestionnairesService.supersedeCorrections`, AUDIT_SUPERSEDED);
  the backfill closes existing ones. A replaced file is in no list unless
  filtered on, no count, no export (asking for it is refused), never
  statistically eligible (EXCL_SUPERSEDED), and offers no decision. REJECTED
  files are final and untouched; the live-submission index is unchanged.
  Approved by the owner in chat, 2026-10-16.
- 2026-10-17 — campaign-progress sync creates its CampaignSubmission row
  instead of silently skipping it (`QuestionnairesService.submitQuestionnaire`,
  `src/questionnaires/questionnaires.service.ts` ~1515). Issue: the
  pilotage dashboard's coverage rate read 0% with 5 real declarations
  submitted. `_initializeCampaignSubmissions` (`campaign.service.ts`)
  snapshots targeted establishments once, at campaign activation; an
  establishment that registers afterwards — the normal case with rolling
  registration — never gets a row, and the submit-time sync used
  `campaignSubmission.updateMany({ where: { campaignId, companyId } })`,
  which matched nothing for it: no error, no log, the submission just
  never counted. Fix: `upsert`, keyed on the existing
  `@@unique([campaignId, establishmentId])` constraint — create the row if
  missing, update it if present. Same statuses, same best-effort
  try/catch. No schema change; the admin-review transitions (approve/
  reject/requestCorrection) still use `updateMany` deliberately, since a
  reviewer only acts on a submission whose row already exists. Approved
  by the owner in chat, 2026-10-17. Caveat: this only takes effect on the
  next submit — it does not retroactively backfill rows for declarations
  already submitted before this fix deployed, so an already-active
  campaign's dashboard stays wrong for its existing submissions until a
  one-off backfill runs or those establishments resubmit.
- 2026-10-17 — campaign rows re-synced for establishments approved after
  activation (`CampaignService.syncCampaignSubmissions`, called in
  `sendReminders` and for each ACTIVE campaign in the daily 06:00
  `CampaignSchedulerService` run). Issue: the upsert above creates a row
  only at submit, so an establishment approved after activation that had
  not submitted was never reminded and was left out of the coverage and
  completion denominators (dashboard, report and report PDF), which
  overstated them. Fix: re-run `_initializeCampaignSubmissions`, which now
  only adds rows for targeted establishments that have none, and seeds each
  from its non-SUPERSEDED file for the campaign (APPROVED → VALIDATED,
  PENDING_REVIEW → SUBMITTED, DRAFT/CORRECTION_REQUESTED → IN_PROGRESS,
  REJECTED → NOT_STARTED; same mapping as `campaign-review-sync.ts`), so a
  pre-upsert submitter is neither reminded nor counted as not started.
  Existing rows are never changed or removed; a failed sync is logged and
  reminders go to the existing rows. Consequence: coverage and completion
  rates fall to their true value; frozen report snapshots are not rewritten.
  This also does the backfill the caveat above asks for, on the first
  daily run after deploy. No schema change. Approved by the owner in chat,
  2026-10-17.
- 2026-10-17 — pilotage readers may list the active collection campaigns
  (RBAC; `GET /admin/pilotage/campaigns/active`,
  `PilotageService.getActiveCollectionCampaigns`). Issue: `/admin/pilotage`
  found the campaign id with `GET /campaigns` (SUPER_ADMIN, ADMIN_ONEFOP,
  REGIONAL_ADMIN), so DIVISIONAL_ADMIN and CENTRAL_AGENT, who may read the
  coverage figures (`campaigns/:id/returns`, PILOTAGE_READ_ROLES), were told
  coverage was not available to them. Decision: a read route for
  PILOTAGE_READ_ROLES answering only id, code, name, collectionType,
  periodicity, startDate, deadline and status of ACTIVE COLLECTION campaigns;
  no counts, nothing territorial or personal, the same answer for every
  reader. `deadline` is the one in force (the extended deadline when set).
  The dashboard uses it for every role. `GET /campaigns` and its roles are
  unchanged; do not widen them to solve this. No schema change. Approved by
  the owner in chat, 2026-10-17.
- 2026-10-17 — restricted exports fail closed
  (`DataManagementService.recordRestrictedExport`, the four
  `vt-roster/{csv,sav}` and `vt-contact/{csv,sav}` routes). Issue: the 8.8
  roster and VT contact files are allowed on condition that every download
  is recorded (entries above), but the record was best-effort: a failed audit
  write was swallowed and the file still went out. Decision: these four
  routes write the DATA_EXPORT row first and await it; if it cannot be
  written, or the request has no user, the download is refused with 503
  « Le téléchargement n'a pas pu être enregistré ; réessayez dans un
  instant. » and nothing is streamed. Every other export keeps best-effort
  `logExport`, which now logs a failed write. The .sps manifests carry no
  personal data and are unchanged. Approved by the owner in chat, 2026-10-17.

---

# 22. DEFAULT OPERATING PRINCIPLE

When uncertain:

DO NOT GUESS.

Inspect the repository.

If the question is statistical, consult the ONEFOP domain rules.

If the question is architectural, consult the CTO.

If the question is UX-related, audit the interface before coding.

If the change affects multiple domains, escalate to the CTO.

CAM-LEAP correctness is more important than coding speed.