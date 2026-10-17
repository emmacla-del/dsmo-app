# E2E run 2026-10-17 — project/programme + enterprise, survey, SPSS

Local backend (`localhost:3001`) and react-web (`localhost:3000`) against the
shared database. Driven through the real UI in the desktop browser pane.

## Test data created (shared DB)

| What | Value |
| --- | --- |
| Project/programme account | PP26000102 — « Projet E2E Emploi Jeunes 20261017 », e2e.projet.20261017@example.cm, Centre / Mfoundi / Yaoundé 2 |
| Enterprise account | EN26000201 — « Societe E2E Batiment 20261017 », e2e.entreprise.20261017@example.cm, Littoral / Wouri / Douala 1 |
| Test password (both accounts) | `E2eTest#2026x` |
| Project declaration | submission `d644e784-b4db-41e7-b2bd-ab4cc68621a4` (record `95bd1411-…`), Q4 2026, **endorsed** by superadmin |
| Enterprise declaration | not submitted (account approved only) |
| Exports | 2 × SPSS .sav (Employers, Q4 2026, validated only) in the export history |

Both accounts were approved by superadmin@minefop.cm through
Registrations → Review (all items compliant). Another project, « Himo »
(PP26000201), was registered and approved by someone else during the run —
it is not test data from this run.

## What worked

- Both registrations (6 steps), establishment IDs issued, acknowledgement page.
- Approval flow, auto-select of "Approve" once every item is compliant.
- Sign-in with the establishment ID instead of e-mail.
- Project survey: Section 0 and 1 prefilled from registration, quiz opened
  4.1–4.4 only, table totals computed correctly (4.1 = 12 = S1Q15).
- Submit (~20 s on the local backend), receipt, status "Awaiting review",
  coverage dashboard counts it, endorsement → "Eligible".
- .sav export: 1 case, 1 323 variables, product field "CAMLEAP ONEFOP",
  section 2/3/4 values match what was typed, non-applicable variables -98.

## Bugs, most severe first

### B1 — SPSS: PP_S1Q01 and PP_S1Q13 exported as codes the dictionary does not label (high) — fixed 2026-10-17
- Seen: in the .sav, `PP_S1Q01 = "1"` and `PP_S1Q13 = "2"`; the .sps declares
  them A254 with `VALUE LABELS PP_S1Q01 'Projet/ Project' "Projet" …` and
  `PP_S1Q13 'Actif/ Active' "Actif" …`. SPSS applies no label, the analyst
  sees a bare "1"/"2". Meanwhile PP_S1Q05 and PP_S1Q08 are exported as the
  stored strings ("Urbain/ Urban", "Tertiaire/ Tertiary"), which do match
  their labels — four radio questions in one section, two codings.
- Root cause: `CanonicalSchemaAdapterService` resolves `detail.*` variables
  from the relational `projectProgramDetail` row first
  (`src/data-management/canonical-schema-adapter.service.ts` ~433–449). That
  row stores `nature`/`status` as numeric codes (`mapNature`, `mapPPStatus`
  in `flat-key-normalizer.ts`), while rawData holds the option strings
  (`"Projet/ Project"`, `"Actif/ Active"`).
- Same pattern likely affects every coded Section 1 field of the other
  employer types read from a `*Detail` row — not checked in this run.
- Touches an official export → §21 approval needed for the fix.
- Checked since: all 29 `detail.*` variables that carry value labels, across
  all seven entity types. Only Project/Programme is affected, and the real
  cause is one step earlier than the adapter —
  `questionnaires.service.ts:943` writes `nature`, `status` and `stopReason`
  as `String(code)` while every sibling and every other entity writes the
  option string through a `map*` helper. **PP_S1Q14 is affected too**; the
  run missed it only because the test project was *Actif*, so `stopReason`
  was null. `onefop-questionnaire.dto.ts:605` documents the option-string
  convention for all five fields, so this is an implementation gap, not a
  design choice, and `categorical-wording-drift.spec.ts:88` already recorded
  it without noticing the export consequence.
- Fix (approved under §21, 2026-10-17): three label mappers beside the
  existing six (`mapNature`, `mapProjectStatus`, `mapStopReason`), used in
  the create block, plus data-only migration
  `20261023120000_pp_identification_option_strings` for existing rows. The
  dictionary is unchanged — the data moves to meet the labels already
  published. DATASET_SCHEMA_VERSION = 12, analyst note
  `docs/reference/jeu-de-donnees-onefop-version-12.md`. The drift spec now
  round-trips these three fields instead of recording the gap.

### B2 — SPSS: PP Section 2 coded columns have no value labels (medium) — fixed 2026-10-17
- `PP_S2_ACT_nn_TARGET`, `_SUPPORT`, `_SCOPE` carry "1".."6" (A254) and the
  .sps has no VALUE LABELS for them, so "2" cannot be read as "Graduate youth"
  without the questionnaire. §21 applies.
- Fix (approved under §21, 2026-10-17): the values stay coded — only the
  dictionary gains entries. The label maps already existed in the backend for
  the PDF legend (`pdf-data-mapper.service.ts`); they move to
  `src/common/pp-activity-options.ts` and are attached to those three columns
  in the adapter, so there is one copy, not a new one. Registry re-frozen
  with `spss:registry --write --accept-value-labels`; names, widths, values
  and order unchanged.
- Caveat worth keeping: this table is the one `AstFieldType.repeatingTable`
  the schema compiler never emits, so its options live only in
  `lib/core/focus/renderers/activities_table.dart` and are mirrored by hand
  in `react-web/src/lib/onefop-activities.ts` and now the server module. A
  change to the Dart list has to be carried to both. Emitting them into the
  schema artifact is an AST change and a separate decision.

### B3 — Admin file view: project files shown with enterprise sections (high)
- `/admin/dossiers/[id]` for a PROJECT_PROGRAM file lists « Section 2.
  Employment and labour », « Section 3. Departures », « Section 4. Internship
  and training » (enterprise titles), all empty; « Year of creation » and
  « Legal status » shown as "—" though the project questionnaire never asks
  them; « Nature » shows the raw code « 1 » (same cause as B1).
- The correction-request dialog offers the same enterprise sections for a
  project file (`page.tsx` ~997: only VT gets its own list). A reviewer would
  send a project respondent a correction about « Section 3. Departures »,
  which does not exist in their questionnaire.
- The reviewer cannot see any of the project's Section 2–4 figures before
  endorsing (the page's own comment says this awaits a domain mapping).

### B4 — Project wizard: Sections 2 and 3 always count as "not started" (high) — fixed 2026-10-17
- Filled both sections, Continue accepted them, submit succeeded — yet the
  rail, the "n of 5 sections completed" counter and the review summary keep
  showing Sections 2 and 3 as not done, with no explanation. Stays wrong on
  the receipt screen ("3 of 5 sections completed").
- Root cause: `getSectionStatus` (`src/components/onefop/ModernJobsSidebar.tsx`
  ~87–114) treats a non-REPORTED table as answered only if `data[f.id]` is
  set or a key starts with `<field id or paperCode>_`. PP_S2_ACTIVITIES
  stores cells as `s2_row…` and PP_S3_OUTCOMES as `s3kpi_…`, so neither
  ever counts.
- Fix: `hasTableCell` also matches the table id (`f.table.id`), and a table
  with no response-status field counts as answered once a cell holds a value.
  The same pass gives `getSectionStatus` the shared `fieldOwnsIssue`
  (`src/lib/wizard-navigation.ts`) in place of its own id/paperCode prefix
  test, so the rail and Continue now agree on which issues belong to a
  section — before, a partly filled `s2_row…` raised an error on Continue
  that the rail did not show.
- Verified: unit tests against the real schema
  (`src/components/onefop/ModernJobsSidebar.test.tsx`) — not started with no
  data, complete with one full activity row, not complete with a half-filled
  one, and Section 3 complete when its KPI cells are zeros. Not re-checked
  live: the project file is endorsed, so the wizard correctly refuses to
  reopen (« Your declaration has been submitted »), and a fresh run would
  need the file reopened for correction.

### B5 — Project Section 4: all four tables carry the same wrong title (high) — fixed 2026-10-17
- 4.1 permanent headcount, 4.2 temporary headcount, 4.3 permanent recruits
  and 4.4 temporary recruits all read « Distribution of recruitments carried
  out during the quarter ». Two of them are headcounts, not recruitments, and
  the questions ask "since 1 January", not "during the quarter". The
  respondent cannot tell the tables apart.
- Cause: hardcoded `caption` in `buildModernJobs…` (`src/components/onefop/
  tables/definitions/modernJobsTableDefinitions.ts` ~256); the schema labels
  (« How many permanents have you counted… ») are not what is shown.
- Fix: the hardcoded `caption` is removed from
  `buildModernJobsRecruitmentTableDefinition`, so each table is headed by its
  own AST question. The `csp_gender_age_table` template serves 22 tables
  across six entity types (enterprise/cooperative/CTD/NGO S21Q01, S22Q01,
  S22Q02, S23Q01; administration S21Q01–02; projectProgram PP_S4Q01–04), and
  in every one of them the question is the accurate wording — applications,
  headcounts or recruitments, over the period the question itself names.
  Statistical semantics, cell keys and totals are untouched.
- Verified live in the wizard (enterprise EN26000201, Section 2, local
  backend): the table now reads « S21Q01 How many job applications per
  socio-professional category, gender and age group did you register from
  01/10/2026 to 31/12/2026? » instead of « Distribution of recruitments
  carried out during the quarter »
  (`docs/audit/screenshots/b5-fixed-s21q01-heading-2026-10-17.jpg`). Also
  covered by a unit test that the four PP Section 4 titles are distinct and
  equal to their field labels.

### B6 — Respondent home: wrong figures in the header (medium)
- « 0 declared employees » after declaring 12 permanent workers: the header
  reads `company.totalEmployees` (a DSMO-era column ONEFOP never updates).
- « Tax ID: NA-6ff0ebd0-4f9f-… » — an internal placeholder NIU is shown to a
  project respondent (§8: no technical codes to respondents).

### B7 — Technical question codes shown to respondents (medium, §8)
- Every question in the employer wizard is prefixed with its code: « S0Q01
  Respondent's full name », « S1Q02 Name »… and « S0Q03 » is repeated on
  three different questions (Tel 1, Tel 2, e-mail).

### B8 — Review summary numbers off by one (low)
- On "Declaration summary and submission", Section 2 carries the badge « 3 »
  and Section 3 the badge « 4 » (index + 1), while the rail numbers them 2
  and 3.

### B9 — PP S1Q15 prefilled with 0 (medium, §9)
- « Number of permanent workers » opened with 0 though registration never
  asked for it — an unanswered value presented as a zero answer. Also
  « Locality / village / quarter » is prefilled with the office street
  address.

### B10 — Registration review shows the sector in French in the English UI (low)
- Picker shows « Public administration and defence », review shows
  « Administration publique et défense »: `register-summary.ts:133` prints
  `state.sectorName` (the French DB name) instead of `sectorLabel(…)`.

### B11 — Smaller items (low)
- Registration: with the backend down, the e-mail availability check fails
  silently and the respondent continues (only noticed because the backend
  was still booting).
- Registrations queue: after "Approve", the row stays in the "In queue"
  filtered list with status Approved until reload.
- Admin › Questionnaires: "Declarations filed" shows "—" for several seconds
  locally; each count calls `GET /admin/questionnaires?limit=1`, which
  returns a full declaration (~13 KB rawData) just to read `total`.
- Admin › Questionnaires subtitle says « …for DSMO statistical collection ».
- SPSS: enterprise companion variables `S4Q02_SLOT*_DESC`,
  `S4Q02_DOMAIN_*_TEXT`, `S4Q03_…` are exported as "" for a project file
  instead of the not-applicable code.
- Logout from the respondent home lands on `/login?returnTo=/home`, so the
  next person to sign in on that browser is sent to the respondent home.

## Fixes applied (2026-10-17)

- B4 and B5, in react-web: `src/components/onefop/ModernJobsSidebar.tsx`,
  `src/components/onefop/tables/definitions/modernJobsTableDefinitions.ts`,
  new `src/components/onefop/ModernJobsSidebar.test.tsx`.
- B1 and B2, in the backend, under §21 approval given in chat on 2026-10-17
  (both recorded in CLAUDE.md §21): `src/questionnaires/questionnaires.service.ts`,
  `prisma/migrations/20261023120000_pp_identification_option_strings/`,
  `src/data-management/canonical-schema-adapter.service.ts` (DATASET_SCHEMA_VERSION
  = 12), new `src/common/pp-activity-options.ts`,
  `src/services/pdf-data-mapper.service.ts`,
  `src/data-management/spss/variable-registry.frozen.json`,
  `src/data-management/categorical-wording-drift.spec.ts`.
- Gates, react-web: `npm test` 857/857 pass, `npx tsc --noEmit` clean. The
  four lint errors reported in the definitions file are pre-existing `any`s
  on lines this change does not touch. `check:ui-grammar` does not apply
  (nothing under `app/admin/**` or `components/admin/**`).
- Gates, backend: `npx jest --runInBand` 1814/1814 pass. Four assertions
  pinned the previous dataset version: the two that exist to make a bump a
  deliberate act keep their literal (now 12), and the two that only wanted
  the .sps header now read `DATASET_SCHEMA_VERSION` instead of a number, so
  the next bump touches one place.
- The migration applies on deploy, through the Render build step that runs
  `prisma migrate deploy`.
- No §21 approval sought: neither change touches statistical semantics, the
  AST, the database or an official export. B5 removes presentation text that
  contradicted the AST; B4 corrects a progress indicator only.
- B1, B2, B3 and the rest of the list are untouched. B1/B2 touch an official
  export and need §21 approval before a fix.

## Questions for domain review (no change made)

- PP Section 3 columns: « From 01/10/2026 to 31/12/2026 » then « Outlook at
  end of December » — the same date as the period end.
- Dataset `establishmentId` holds the internal UUID
  (`e441d4cf-…`), not the public ID (PP26000102), though labelled « ID
  établissement ».
- Approval of an enterprise verifies CNPS but not the NIU.

## Not covered

- Enterprise survey: opened on 2026-10-17 to verify B5 — the preliminary
  quiz was answered (applications Yes / executives / under 25, everything
  else No) and Section 2 opened with S21Q01 only. Nothing was typed into a
  table and nothing was submitted, so EN26000201 now holds a draft with quiz
  answers and no figures. The rest of the enterprise journey is still
  untested.
- Official PDF content of the project declaration (not downloaded).
- Mobile/tablet layouts.
