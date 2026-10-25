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

Considered for blocking and deliberately left advisory:

- 2026-10-19 — the employer "of which" subsets: recruitment of people with a
  disability and of vulnerable people against the permanent and temporary
  recruitment totals — project 4.5 / 4.6 against 4.3 / 4.4
  (`pp_s4q0{5,6}_total_<status>_<sex>`), and their equivalents on the
  enterprise, cooperative, CTD and NGO forms (S22Q04 / S22Q05 against
  S22Q01 / S22Q02), in `react-web/src/lib/onefop-coherence.ts` and
  `QuestionnairesService.checkCoherence`. They are the class this section
  allows to block — a part of a count cannot exceed the count it belongs to,
  the same logic as the VT subsets above. They stay ADVISORY on purpose: the
  check has been advisory on the four employer forms since before the project
  form had any check at all, and blocking it for projects alone would stop a
  project over an error that waves an enterprise through. Whether the family
  should block is one decision for all five forms; until it is taken, nobody
  should raise one form on its own. Owner's decision in chat, 2026-10-19, on
  adding the project rules. The project's 4.1-versus-S1Q15 check added the
  same day is advisory for the other reason this section gives: it compares
  two reference moments (the permanents counted over the period, and the
  headcount as it stands), so it awaits domain review in any case.

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
- 2026-10-17 — .sav producer field says CAMLEAP
  (`src/data-management/spss/sav-writer.ts`). Issue: the 60-byte product
  field of every .sav header read "CAM-LEAP"; the platform name is CAMLEAP.
  Fix: "@(#) SPSS DATA FILE CAMLEAP ONEFOP". File metadata only: variables,
  values, labels, order and DATASET_SCHEMA_VERSION unchanged; the golden-digest
  test proves no other byte moved. Approved by the owner in chat, 2026-10-17.
- 2026-10-17 — official PDF footer and registration e-mails say CAMLEAP
  (`src/pdf/onefop-puppeteer.service.ts`, `src/services/pdf-data-mapper.service.ts`,
  the seven `src/pdf/templates/dynamic/*.hbs` fallbacks,
  `src/dsmo/notification.service.ts`). Issue: the footer read « … via la
  plateforme CAM-LEAP » / "… via the CAM-LEAP platform", and the three
  registration e-mails used "CAM-LEAP" in body and subject. Fix: CAMLEAP;
  wording, layout and every other PDF field unchanged.
  `src/common/brand-name.spec.ts` keeps the old spelling out. Approved by the
  owner in chat, 2026-10-17.
- 2026-10-17 — dataset v12 (a): Project/Programme nature, status and
  stopReason stored as the option string (E2E defect B1;
  `QuestionnairesService.mapNature`, `mapProjectStatus`, `mapStopReason`,
  migration `20261023120000_pp_identification_option_strings`). Issue:
  PP_S1Q01, PP_S1Q13 and PP_S1Q14 were persisted as `String(code)` — "1",
  "2" — while the .sps declares their VALUE LABELS on the option strings, so
  SPSS applied none and the analyst read a bare code; their siblings
  PP_S1Q05 and PP_S1Q08 held the option string, two codings in one section.
  `onefop-questionnaire.dto.ts` documented the option-string convention for
  all five; three were never given a mapper, as
  `categorical-wording-drift.spec.ts` recorded. Fix: three label mappers
  beside the existing six, used in the create block, plus a data-only
  migration converting existing rows (no column added, dropped or retyped;
  re-running it changes nothing). Values change for three variables; names,
  widths, order and the dictionary are unchanged, so
  DATASET_SCHEMA_VERSION = 12. The Excel « Motif d'arrêt » column shows the
  label. The questionnaire, the normalizer and the DTO contract are
  unchanged. Analyst note:
  `docs/reference/jeu-de-donnees-onefop-version-12.md`. Approved by the owner
  in chat, 2026-10-17.
- 2026-10-17 — dataset v12 (b): value labels for the Section 2 activity
  columns (E2E defect B2; `src/common/pp-activity-options.ts`,
  `PP_ACTIVITY_VALUE_LABELS` in `canonical-schema-adapter.service.ts`).
  Issue: `PP_S2_ACT_nn_TARGET`, `_SUPPORT` and `_SCOPE` carry codes
  ("1".."6", A254) and the .sps declared no VALUE LABELS for them, so a "2"
  was unreadable without the questionnaire. Fix: the label maps the PDF
  already used move to a shared module and are attached to those three
  columns; registry re-frozen with
  `spss:registry --write --accept-value-labels`. Dictionary only: values,
  names, widths and order unchanged. Caveat: this table is the one
  `AstFieldType.repeatingTable` the compiler never emits, so its options
  exist only in `lib/core/focus/renderers/activities_table.dart` and are
  mirrored by hand in `react-web/src/lib/onefop-activities.ts` and the new
  server module; a change to the Dart list must be carried to both. Approved
  by the owner in chat, 2026-10-17.
- 2026-10-18 — .sps header says how to read a blank text cell (E2E defect
  B11.5; `CanonicalSchemaAdapterService.buildSpssSyntax`). Issue: the run
  reported enterprise companion variables (S4Q02_SLOT*_DESC,
  S4Q02_DOMAIN_*_TEXT, S4Q03_*) exported as "" for a project file « instead
  of the not-applicable code ». Investigation: not a defect in the data. The
  scoping is right (those variables list enterprise/cooperative/CTD/NGO, not
  projectProgram), the blank is the documented v5 convention, and it cannot
  be otherwise — SPSS declares a user-missing value only on a text of at
  most 8 characters, and of the 479 text variables the narrowest is A10
  (widths A10…A2000); `sav-writer.ts` carries missing values for numeric
  variables only. Writing a sentinel such as "-98" would be ordinary data in
  371 columns of a project file: a category in every frequency table, and a
  break for any syntax testing `= ""`. Decision: no value changes. The header
  instead states that a blank text cell does not distinguish « non posée »
  from « sans réponse », says why, and gives the formType recipe
  (`TEMPORARY. / SELECT IF formType = '…'.`), printed only when formType is
  in the file. Dictionary wording only, like defect 21: variable names,
  values, widths, order and DATASET_SCHEMA_VERSION (12) unchanged. Approved
  by the owner in chat, 2026-10-18.
- 2026-10-18 — the reference period is named, not printed as dates
  (`react-web/src/lib/campaign-period.ts`, `inPeriodPhrase`;
  `referencePeriodKind` in `onefop-period-label.ts`). Issue: the AST carries
  « du 1er Janvier 2026 à ce jour » as a placeholder and the React wizard
  replaced it with the round's date range, so some thirty question labels
  read « du 01/10/2026 au 31/12/2026 ». Decision: the placeholder becomes the
  round NAMED — « au cours du trimestre » / "during the quarter", the wording
  the official PDF already uses for the project outcomes column
  (`src/pdf/i18n/{fr,en}.json` projectProgram.outcomes.current) — for every
  form type, with the kind of period read from the round's own code
  (quarter / semester / year) and the date range kept as the fallback when
  that code names no kind. The exact bounds were printed once, on the wizard
  masthead, until 2026-10-22: the owner then dropped them as repeating the
  round's name, and the masthead reads one sentence, « Recensement emplois
  modernes des Entreprises pour le 4e trimestre 2026 »
  (`ModernJobsHeader.tsx`). The wizard no longer prints the bounds anywhere. The project KPI column follows (« Réalisations au cours du
  trimestre »); its two outlook columns still name no year, which is still
  ONEFOP's to answer. The admin file view rewrites from the file's own round
  code, so a reviewer reads the question the respondent answered. No
  statistical semantics, cell key, variable or dataset version change.
  Approved by the owner in chat, 2026-10-18.
- 2026-10-18 — dataset v13: project table 4.6 collects the nature of the
  vulnerability (`lib/core/focus/compiler/onefop_ast.dart`, `ppS4Q06`;
  `QuestionnairesService.buildVulnerableNamedRows`;
  `canonical-schema-adapter.service.ts`; `pdf-data-mapper.service.ts`;
  `react-web/src/components/onefop/tables/resolveGuidedScope.ts`). Issue: the
  printed project form contradicts itself — its row stub reads « Nature de
  vulnérabilité » and its French question asks « selon le statut et la nature
  de la vulnérabilité », but the three rows printed under them are 4.5's CSP
  and its English question is 4.5's line pasted again. The enterprise form's
  identical question (S22Q05), same French wording, prints Déplacés internes
  / Réfugiés / Orphelins, which is what the platform collects for enterprise,
  cooperative, CTD and NGO (FIX-9). Collected by CSP the indicator was
  comparable with no other questionnaire, and the nature of the vulnerability
  — the variable itself — was never collected for projects. Decision: 4.6
  becomes a `vulnerable_named_rows_table` with those three rows; the question
  label is unchanged, since it already asked for this. Cell keys become
  `pp_s4q06_<nature>_<status>_<sex>`; the 18 `pp_s4q06_{cadres,foremen,
  workers}_*` variables are retired in the frozen registry (names reserved,
  never reused) and DATASET_SCHEMA_VERSION = 13. No Prisma migration:
  `VulnerableType` already held DEPLACES_INTERNES, REFUGIES and ORPHELINS,
  and its CSP members stay for rows already stored. A file submitted before
  v13 keeps its answers under the retired names and is blank in the new
  columns: the two are not the same variable, so nothing is converted. 4.5
  (handicap) stays by CSP. The submit-time completeness check asks for the
  cells the wizard writes, the mismatch that refused the enterprise
  submission in C1–C3. Approved by the owner in chat, 2026-10-18. Analyst
  note: `docs/reference/jeu-de-donnees-onefop-version-13.md`.
- 2026-10-19 — project Section 3 is checked, and its two forecast columns are
  not (`missingOutcomeCells` / `validateOutcomesTable` in
  `react-web/src/lib/onefop-validation.ts`). Issue: the outcomes grid
  (`kpi_period_table`, `s3kpi_*`) carries no `_RESPONSE_STATUS` — the paper
  form prints no selector for it — so `isReported` was never true in the
  wizard, and the server's completeness check, which walks the tables marked
  REPORTED, never saw it either. A project could tick an outcome in the
  preliminary questionnaire and file the section blank, refused by nothing.
  Decision: the « Réalisations » figure of every outcome the quiz opened is
  required, and blocks Suivant and submission in the wizard; a row the quiz
  did not open already holds the 0 the quiz wrote for it, and « aucun
  bénéficiaire » zeroes all four, so neither is asked for anything. The two
  outlook columns (`outlook_dec`, `outlook_june`) are NOT required, because
  which December and which June they name is still ONEFOP's to answer (E2E
  2026-10-19): a column whose reference period is undecided cannot be demanded
  of a respondent. They are still checked for a whole, non-negative count when
  one is given. When ONEFOP names those periods, this entry is what to
  revisit. The preliminary questionnaire also reads an outcome from any of its
  three columns, not the realised one alone, so a file carrying only a
  forecast is no longer read as « aucun bénéficiaire » and zeroed (§9).
  Server-side enforcement is deliberately NOT added: that check is driven by
  the REPORTED statuses, and giving this table a synthetic status would put a
  key in the submitted data that the canonical form has no question for — that
  half needs a decision of its own. No schema, cell key, variable or dataset
  version change. Approved by the owner in chat, 2026-10-19.
- 2026-10-19 — a project's type of entity is asked at registration, and the
  project form names that body (schema change; migration
  `20261024120000_company_project_nature`). Issue: PP_S1Q01 read « Nature de
  la structure » though only one of its four answers is a structure, and
  registration offered « Projet ou programme », which a supervised structure
  could not recognise itself in. Decision: the registration option reads
  « Projet, programme ou structure sous-tutelle » and asks « Type d'entité »
  (required for PROJECT_PROGRAM, server-side `@IsIn` on PP_S1Q01's four option
  strings); `Company.projectNature` (nullable) stores that string, and the
  wizard pre-fills PP_S1Q01 from it (`onefop-autofill.ts`), as `ctdType` does
  CTD_S1Q01; the respondent's answer still wins. PP_S1Q01's AST label becomes
  « Type d'entité » / "Type of entity"; id, path, options and stored values are
  unchanged. Once PP_S1Q01 is answered, Sections 0 and 1 name that body
  (`react-web/src/lib/pp-nature-wording.ts`): S0Q02, the Section 0 intro and
  examples, PP_S1Q02 « Nom du programme », PP_S1Q13, the Section 1 heading
  and rail, and the Section 2 rail entry (the identity card under that heading
  reads « Désignation et tutelle », so it does not repeat it); unanswered or « Autres », they
  say « du projet ou du programme ». NOT changed: the official PDF (its
  S1Q01/S1Q02 wording), the Excel « Nature de la structure » column, and
  PP_S1Q01's .sps variable label, held at « Nature de la structure » by
  `EXPORT_LABEL_OVERRIDES` (`src/data-management/spss/export-labels.ts`, E12)
  — « Type d'entité » is formType's label, and sharing it would make the E10
  pass relabel formType in every export. Registrations made before this have
  no value and are asked PP_S1Q01 as before. Approved by the owner in chat,
  2026-10-19. Committed 2026-10-20 on the owner's instruction, after being
  told that the .sps VARIABLE LABELS are read from the AST
  (`labelFr: field.label.fr`), so the same pass's other AST wording edits DO
  change the dictionary: « Milieu de résidence » → « Milieu d'implantation »
  (S1Q03, COOP/CTD/ONG_S1Q04, ADMIN_S1Q03, PP_S1Q05; "Area" → "Area of
  operation"), « Nombre d'employé(s) permanent(s) » / « de poste(s)
  vacant(s) » made plural (CTD_S1Q09–10, ONG_S1Q10–11, PP_S1Q15–16),
  PP_S1Q02 « Nom du projet / programme », PP_S1Q04, PP_S1Q12 « Ministère /
  organisme de tutelle », PP_S1Q13 « Statut du projet / programme ». Variable
  names, values, value labels and DATASET_SCHEMA_VERSION are unchanged
  (`spss:registry` reports no change).
- 2026-10-20 — employer table 2.2.3 (S22Q03, recruitment by diploma) reaches
  the SPSS/CSV dataset (`CanonicalSchemaAdapterService.s22q03Cell`,
  `S22Q03_DIPLOMA_BY_SLUG` in `canonical-schema-adapter.service.ts`). Issue:
  every s22q03_* variable was blank for every employer file (E2E 2026-10-20,
  submission b6bd2eaa). The wizard stores the table by staff category
  (`s22q03_<csp>_<diploma>_<sex>_<age>`, OnefopDiplomaData.cspCategory), the
  dataset carries diploma × sex × age only (`s22q03_bac__gce-al_male_25_34`),
  and the resolver matched neither the category, the diploma code (BAC vs
  bac__gce-al) nor the age band (AGE_25_34 vs 25_34). Fix: a dataset cell is
  the SUM over staff categories of the stored rows for its diploma, sex and
  age band; a total the file did not store is summed from its detail cells; a
  REPORTED table counts an absent cell as 0, a NONE table stays blank (as
  2.2.1 does). Variable names, labels, order, the frozen registry and
  DATASET_SCHEMA_VERSION (13) are unchanged; only values that were wrongly
  blank are filled. The per-category breakdown stays out of the dataset — adding
  it would be a new dataset version and a decision of its own. The official PDF
  and the Excel export already read this table correctly and are unchanged.
  Approved by the owner in chat, 2026-10-20.
- 2026-10-22 — project Section 2 (activities, `PP_S2_ACTIVITIES`) needs at
  least one complete line (`missingActivitiesCells` / `validateActivitiesTable`
  in `react-web/src/lib/onefop-validation.ts`). Issue: the table carries
  `required: false` and no `_RESPONSE_STATUS`, and only a started line was
  checked, so a project could file Section 2 empty. Owner's rule, in chat
  2026-10-22: no table or question of the ONEFOP wizard is optional; the quiz
  hides only the tables it gates, and a table it does not gate is always shown
  and must be answered. Fix: an empty table owes its whole first line; it
  blocks Suivant and submission in the wizard. On the server, a final project
  submission without one line whose six cells are all filled is refused with
  the usual 400 « Informations obligatoires manquantes … / Missing required
  information … », `missingFields: ['projectProgram.activities']`
  (`hasCompleteProjectActivity`, `enforceFinalRequiredFields` in
  `src/questionnaires/questionnaires.service.ts`); drafts are not checked.
  Server enforcement approved by the owner in chat, 2026-10-22. NOT done: a
  quiz question letting a project declare « aucune activité » (written, then
  withdrawn the same day — it needed a status key the canonical form has no
  question for, see the 2026-10-19 entry); the AST's `required` flag. Contact and
  write-in slots (second phones, PO box, website, « Autre (à préciser) »,
  domain/reason lines 2–3) remain optional pending the owner's ruling.

- 2026-10-25 — registration coverage measures the year, not the register
  (`coverageRate` in `src/pilotage/pilotage-coverage.ts`, its three call sites
  in `pilotage.service.ts`). Issue: the rate divided the cumulative
  `registered` stock — every establishment ever registered and still active —
  by the sum of that year's registration-campaign quotas
  (`onefopCampaignIds`, purpose = REGISTRATION). That is a stock over a flow:
  from the second year on, the ratio passed 100 % on registrations the year's
  quota never asked for, every territory settled in the top band whatever it
  had done, and the six attainment bands stopped discriminating. Fix: the
  numerator becomes `registeredInYear`, which the response already carried and
  displayed in its own column. Consequences, stated to the owner before
  approval: every rate on the screen changes, usually downwards; a past year
  re-reads with its own registrations only; and the ranking's band
  distribution moves with it. Nothing is removed — the cumulative stock stays
  in the grid's « Inscrits » column beside the rate, so both readings remain
  available. The quotas themselves, the campaigns folded, the variables, the
  exports and the dataset version are untouched; this is the coverage view's
  ratio alone, and no SPSS, Excel or PDF output reads it. The same numerator
  is used by the `totals` row added in the same pass, so the headline and the
  territory rows cannot disagree. Approved by the owner in chat, 2026-10-25,
  after the trade-off was put to them twice. NOT decided here: whether a
  registration quota is meant as a target for the register's size rather than
  for the year's new registrations — if ONEFOP says it is the former, this
  entry is what to revisit, and the fix would be to change the denominator,
  not to put the stock back in the numerator.

- 2026-10-25 — registration quotas gain an entity-type dimension, at region ×
  type (schema change; migration `20261025140000_campaign_quota_entity_type`).
  Issue: `CampaignQuota` was scoped by territory alone (TERRITORIAL with a
  region and optional department, or the ADMINISTRATION cohort), so the
  coverage view's « Par type d'entité » tab could carry no quota and no rate —
  there was nowhere to store one — and ONEFOP could not state how many
  establishments of a given type a region was expected to register. Decision:
  `entityType OnefopEntityType?` on CampaignQuota, nullable, null meaning a
  quota covering every type, which is what every row written before today is.
  Additive migration (`ADD COLUMN IF NOT EXISTS`), no row rewritten, no figure
  moved. GRAIN: region × type, chosen by the owner in chat over department ×
  type (≈464 cells a quarter) and a national per-type scope; a row carrying
  both a departmentId and an entityType is refused by `parseTargetBody`, not
  by a CHECK, so the grain can widen later without a constraint to drop.
  CONFLICT RULE: a region may be quotaed in exactly one of three ways — one
  all-types region row (REGION), one row per type (the new ENTITY_TYPE mode),
  or department rows (DEPARTMENT). Any two together are MIXED with no target,
  the rule that has always governed the region/department pair, extended to
  the new axis by the same reasoning: the figures measure overlapping
  populations, so a sum would count the same registrations twice. Per-type
  rows DO sum, because the types partition the register — a company has
  exactly one entityType. ADMINISTRATION keeps its cohort row as its quota,
  since classifyBucket counts those respondents in `central` and never in a
  territory; a type nobody quotaed states null, never a target of zero.
  `replaceScoped` now matches stored rows on (department, type) rather than
  department alone — on the old key it would have deleted every per-type row
  but one as unwanted. No statistical variable, export, PDF or dataset version
  changes: this is the quota model and the coverage view's denominator.
  Approved by the owner in chat, 2026-10-25, with the grain chosen explicitly.
  Delivered in three commits the same day: the data layer (c11a14fd), the
  targets editor's third mode, « Par type d'entité », with one input per type
  and a live regional sum (34fb82da), and the coverage type tab's Quota, Écart
  and Taux columns (0ce19047). Two traps the phases turned up, both fixed and
  pinned by tests: `replaceScoped` matched stored rows on departmentId alone,
  which would have deleted every per-type row but one; and the editor's
  `sameEntries` compared on (department, value), so moving a quota from one
  type to another — same total, different split — read as « no change » and
  was dropped on save. Switching a region INTO per-type does NOT spread its
  region total across the types: that split is the writer's judgement, and a
  guessed one would be stored as though they had made it. STILL OPEN: the
  ranking above the grid lists territories only, so a type behind its quota is
  not ranked anywhere; and `entityTypeQuotaNote` (renamed from
  entityTypeNoQuotaNote, which asserted the absence of what the tab now shows)
  is what to revisit if the grain ever widens to department × type.

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