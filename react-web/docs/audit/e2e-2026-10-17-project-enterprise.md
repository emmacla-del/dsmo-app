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

### B3 — Admin file view: project files shown with enterprise sections (high) — fixed 2026-10-17
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
- Root cause: the page carried one hardcoded section list — the enterprise
  family's `SECTION1_TITLE_FR` / `SECTION_TITLE_FR` plus the matching
  `adminDossierPage.section1.*` / `section2..4` messages — and used it for
  every entity type except VT, which alone was read from the schema. The
  identity disclosure printed « Year of creation » and « Legal status »
  unconditionally, and the structure card printed the detail row as stored.
- Fix: the file's own questionnaire drives the screen
  (`src/lib/dossier-sections.ts`, new, with
  `src/lib/dossier-sections.test.ts`). `dossierEntity` maps the file's
  `formType` to the generated schema's entity, `dossierSections` gives that
  entity's sections (Section 0 excluded — the respondent's identity has its
  own card), and the page uses that one list for both the headings and the
  correction-request options, VT included; the two per-type lists and their
  message keys are gone. Section titles are the AST's own, sentence-cased —
  `sentenceCaseTitle` (`dossier-vt-answers.ts`) gained CTD/ONG/RLA/NGO and
  now keeps an acronym behind an elision ("L'ONG" → "l'ONG"), so the French
  titles the correction comment stores are the same text as before for the
  enterprise family, except « coopérative » and « caractéristique », which
  now read as the AST prints them, unaccented.
- « Year of creation » and « Legal status » appear only when this
  questionnaire asks them (`questionnaireAsks`) or the record carries a value
  anyway — an enterprise keeps its registered founding year
  (`Company.yearOfCreation`); a project file shows neither row.
- « Nature »: `detailAnswerValue` resolves a detail-row value against the
  AST's option list for that question — the option as stored passes through,
  a 1-based code becomes the option at that position, the rule the official
  PDF already follows (§21, 2026-10-15); anything else is shown as stored.
  Display only: nothing stored or exported changes, and the SPSS adapter is
  untouched. It reads the same whether the row holds "1" or the option string
  B1's fix will write. The same resolution now covers the other types' coded
  Section 1 columns (enterprise size, cooperative and CTD type, sector) — the
  identical defect — though no file of those types exists to check it on.
- Not done: the project's Section 2–4 figures are still not rendered. VT's
  reviewer view is built from `VtTableMeta`, which the schema carries for VT
  tables only; the classic templates (`csp_gender_age_table`,
  `repeating_table`) would need the wizard's table machinery, and mapping
  them onto a reviewer view is the domain decision the page's comment already
  names. Each section past the first still says its figures are not shown
  here, now naming its own backing tables (`projectProgramActivities` for PP
  Section 2, not the enterprise family's).
- Verified live as superadmin on the endorsed project file
  (submission `d644e784-…`, local backend, both languages): Section 1 reads
  « Section 1. Identification de la structure » and Sections 2–4 the project
  questionnaire's own titles, no « Année de création » or « Régime/statut
  juridique » row, and « Nature » reads « Projet » / "Project" instead of
  « 1 » (`docs/audit/screenshots/b3-fixed-project-sections-2026-10-17.jpg`).
  The correction dialog was opened on the one PENDING_REVIEW file in the
  database, a VT one, and still offers that file's nine VT sections with
  their French values; no enterprise-family or project file is awaiting
  review, so the dialog could not be opened on a project file without
  reopening the endorsed one, which would have taken it out of the validated
  exports. The project list it would offer is covered by unit tests instead,
  against the real schema, as is the enterprise family's (same titles as the
  comments already stored).
- Gates: `npm test` 867/867 pass (10 new), `npx tsc --noEmit` clean,
  `npm run check:ui-grammar` passes with no baseline change. The five lint
  errors in `page.tsx` are pre-existing `any`s in the approve mutation, on
  lines this change does not touch.

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

### B6 — Respondent home: wrong figures in the header (medium) — fixed 2026-10-17
- « 0 declared employees » after declaring 12 permanent workers: the header
  reads `company.totalEmployees` (a DSMO-era column ONEFOP never updates).
- « Tax ID: NA-6ff0ebd0-4f9f-… » — an internal placeholder NIU is shown to a
  project respondent (§8: no technical codes to respondents).
- Root cause, the NIU: registration asks for one from enterprises,
  cooperatives, CTDs, NGOs and training centres only — an administration and a
  project/programme do not declare a taxpayer number (`ENTITY_CONFIGS`,
  `register-constants.ts`). `Company.taxNumber` is NOT NULL and unique all
  the same, so `AuthService` writes a synthetic `NA-<uuid>`. Every admin
  screen already hides it through `hasRealNiu`; the respondent's own two
  screens were the ones that printed it.
- Root cause, the headcount: `Company.totalEmployees` is the DSMO company
  profile's figure (`CreateCompanyDto.totalEmployees`). The ONEFOP
  registration payload has no such field, so the row is created at 0, and no
  ONEFOP path ever writes it — the column is NOT NULL, so a stored 0 cannot
  be told apart from "never asked". §9 forbids showing an unanswered value as
  an answer, and here it read as a declaration that had been lost.
- Fix: two rules in `src/lib/respondent-identity.ts`, used by both respondent
  screens. `respondentNiu` returns the number only when the account declared
  one (`hasRealNiu`, the rule the console already applies);
  `declaredWorkforce` returns the figure only when someone entered it — above
  zero, and never for a training centre, which declares trainees and
  trainers, not employees. `isTrainingCentre` moved there from
  `home/page.tsx` so both screens share it.
- The same two fields are on « Mon établissement »
  (`src/app/home/etablissement/page.tsx`), which printed the placeholder as
  the NIU and « 0 » as the headcount; they now follow the same rules. Its
  « Numéro CNPS » row read "—" for the two types that are never asked for one
  (the same five types declare the CNPS as the NIU), so it is shown only when
  there is a number — the home header already did this.
- Not done: showing the respondent the headcount they actually declared. That
  figure is in the file (S1Q10, PP_S1Q15, …, by entity type), not on the
  company row: `GET /onefop/submissions` returns a summary without `rawData`,
  so the home would need the submission detail and the schema for one meta
  item, and a headcount without its reference period is a different claim
  from the one the file makes. Left for the owner to call.
- Verified live on the local backend, in French, on both test accounts: the
  project (PP26000102) home reads « Projet ou programme · Yaoundé 2,
  Mfoundi, Centre » — no NIU, no employee count
  (`docs/audit/screenshots/b6-fixed-project-home-2026-10-17.jpg`) — and its
  establishment record shows name, type and main activity with no NIU, CNPS
  or headcount row; the enterprise (EN26000201) still shows « NIU :
  M102617000001X · CNPS : 2610170001 » on both screens, with the false « 0 »
  gone.
- Gates: `npm test` 883/883 pass (3 new), `npx tsc --noEmit` clean,
  `npm run check:ui-grammar` passes with no baseline change. The two lint
  warnings in `home/page.tsx` are pre-existing unused imports
  (`getMyDeclarations`, `getMyOnefopSubmissions`) this change does not touch.

### B7 — Technical question codes shown to respondents (medium, §8) — fixed 2026-10-17
- Every question in the employer wizard is prefixed with its code: « S0Q01
  Respondent's full name », « S1Q02 Name »… and « S0Q03 » is repeated on
  three different questions (Tel 1, Tel 2, e-mail).
- `paperCode` is two different things: the training-centre form numbers its
  questions « 1.1 », « 4.10 », « 2.1.7 », which is printed on the paper the
  respondent is copying from; every employer form carries an internal id
  instead (S0Q01, S21Q01, PP_S4Q02), which appears nowhere they can see and
  is not even unique — S0Q03 is Tel 1, Tel 2 *and* the e-mail, S1Q04 covers
  four address questions.
- Fix: `isDisplayableQuestionCode` (`src/lib/question-code.ts`) — a code is
  shown only when it is a form number (digits and dots). `QuestionCode`
  renders nothing for anything else, which covers every caller at once
  (FieldRenderer, TableRenderer, ActivitiesTableRenderer, VtTableRenderer,
  VtWizardFields, VtWizardGuidedEntry, VtWizardSectionScreen,
  AdaptiveStatisticalTable, NominalRosterRenderer). `questionCodeText`
  follows the same rule, so a screen reader is not read the id either. The
  code is still split off the label text in every case, so a label that
  embeds it is not left with it inside the question.
- VT is untouched: all 187 of its paper codes are form numbers and still
  show.

### B8 — Review summary numbers off by one (low) — fixed 2026-10-17
- On "Declaration summary and submission", Section 2 carries the badge « 3 »
  and Section 3 the badge « 4 » (index + 1), while the rail numbers them 2
  and 3.
- Fix: the badge is the section's own index (`ModernJobsWizard.tsx` ~995),
  the number `ModernJobsSidebar` already shows as `marker: idx` — Modern
  Jobs numbers its sections from 0, as the paper form does.

### B9 — PP S1Q15 prefilled with 0 (medium, §9) — fixed 2026-10-17
- « Number of permanent workers » opened with 0 though registration never
  asked for it — an unanswered value presented as a zero answer. Also
  « Locality / village / quarter » is prefilled with the office street
  address.
- Both are wider than Project/Programme. The headcount prefill
  (`comp.totalEmployees`) was on five entity types — S1Q10, COOP_S1Q11,
  CTD_S1Q09, ONG_S1Q10, PP_S1Q15 — and `RegisterCompanyPayload` has no such
  field, so `auth.service.ts` stores `?? 0` for every ONEFOP account; the
  column is DSMO-era and no ONEFOP path writes it. On a DSMO-era company it
  holds a headcount from another reference period and definition, which is
  not an answer to this question either. The locality prefill
  (`comp.address`) was on all six employer types **and on the training
  centre's 1.8 « Village-Quartier »**, which the run did not look at;
  registration asks that field as « Adresse du siège » / « Adresse du CFP »,
  a street address, and collects no village or quarter.
- Fix: both prefills are gone (`src/lib/onefop-autofill.ts`), with the rule
  written at the top of the file — a field is prefilled only from something
  registration actually asked for, and only where the two questions mean the
  same thing. `address` still fills the « Siège social » questions (S1Q09,
  ONG_S1Q02, PP_S1Q11, COOP_S1Q02), which is what it is. Every question
  concerned is required, so the respondent is asked for it.
- Verified by `src/lib/onefop-autofill.test.ts`, which walks every entity
  type and every « Quartier/Village/Localité » question in the schema, and
  checks the identification fields registration *does* ask for are still
  prefilled. The locality case was confirmed to fail before the fix.
- Not fixed, and worth knowing: a draft started before this change keeps the
  values the old prefill wrote. A saved answer wins over registration by
  design (`mergeWithAutofill`), and that is checked here — EN26000201's draft
  still holds `S1Q04_LOCALITY = "Rue Joss, Bonanjo"` and `S1Q10 = "8"`,
  locally and on the server. Only a draft started after the change opens
  empty.

### B10 — Registration review shows the sector in French in the English UI (low) — fixed 2026-10-18
- Picker shows « Public administration and defence », review shows
  « Administration publique et défense »: `register-summary.ts:133` prints
  `state.sectorName` (the French DB name) instead of `sectorLabel(…)`.
- Fix: the registration state carries the sector's English name beside the
  French one (`sectorNameEn`, set when the sector is picked and kept in the
  saved draft), and the review prints `sectorLabel(…)` in the reader's
  language, as the picker already did. A sector is a select answer, so this
  follows the rule the module's own header states: select answers are shown
  with their own label, never as the stored wire value. A draft saved before
  this change has no English name and falls back to the French one.

### B11 — Smaller items (low) — five of six fixed 2026-10-18
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

Fixes, in the order above:

1. **E-mail check** — the failure was reported, but as a muted footnote that
   reads as a hint. It is now a warning (`field-status is-warn`, the amber
   `--cam-warning` token) and says what it means for the respondent: they may
   continue, and an address already in use is refused at submit. Blocking was
   considered and rejected: the server enforces uniqueness anyway, and
   stopping a legitimate registration because the API was briefly unreachable
   would be the worse failure.
2. **Queue row** — `applyRegistrationDecision` takes the status the list was
   filtered by, read from each cached page's own query key, and drops a file
   the decision moves out of that view instead of restyling it in place. The
   unfiltered list still only restyles; the overdue view drops it, since no
   decided file is overdue. The refetch still has the last word.
3. **Counts** — `GET /admin/questionnaires` accepts `limit=0`, a count-only
   request: the row query is not made at all, and the page asks for its seven
   totals that way. Each one used to return a whole declaration, rawData and
   every detail relation included, to read `total`.
4. **Subtitle** — says ONEFOP; the page lists the seven ONEFOP questionnaires
   and no DSMO form.
5. **SPSS companion variables** — not fixed. It changes what an official
   export writes, so it needs §21 approval first.
6. **Logout** — the button's own navigation stands. The route guard used to
   win the race and add `/login?returnTo=<the page just left>`, and that
   returnTo outlived the session. `logout({ intentional: true })` marks the
   user's own sign-out so the guard stays out of the way; a 401 still sends
   them to /login with a returnTo, which is what it is for.

## Fixes applied (2026-10-17)

- B4 and B5, in react-web: `src/components/onefop/ModernJobsSidebar.tsx`,
  `src/components/onefop/tables/definitions/modernJobsTableDefinitions.ts`,
  new `src/components/onefop/ModernJobsSidebar.test.tsx`.
- B6, in react-web: `src/lib/respondent-identity.ts` (+ its test),
  `src/app/home/page.tsx`, `src/app/home/etablissement/page.tsx`. Frontend
  only. Gates: `npm test` 883/883, `npx tsc --noEmit` clean,
  `npm run check:ui-grammar` passes with no baseline change.
- B3, in react-web: `src/app/admin/dossiers/[id]/page.tsx`,
  `src/lib/dossier-vt-answers.ts`, `messages/{fr,en}.json`, new
  `src/lib/dossier-sections.ts` and `src/lib/dossier-sections.test.ts`.
  Frontend only; nothing stored or exported changes. Gates: `npm test`
  867/867 pass, `npx tsc --noEmit` clean, `npm run check:ui-grammar` passes
  with no baseline change.
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
- B7 and B8, in react-web: `src/lib/question-code.ts`,
  `src/components/onefop/ui/QuestionCode.tsx`,
  `src/components/onefop/FieldRenderer.tsx`,
  `src/components/onefop/ModernJobsWizard.tsx`, with new tests
  `src/lib/question-code.test.ts`,
  `src/components/onefop/ui/QuestionCode.test.tsx` and one more case in
  `WizardShell.review.test.tsx`. `npm test` 876/876, `npx tsc --noEmit`
  clean. Checked by rendering the real components against the real schema
  rather than in the browser: the pane was signed in as the superadmin of
  the session working on B3 in this same checkout, and signing out from
  under it would have disturbed that run. The B8 test was confirmed to fail
  on the old `sIdx + 1` before being kept.
- B9, in react-web: `src/lib/onefop-autofill.ts`, new
  `src/lib/onefop-autofill.test.ts`. `npm test` 880/880, `npx tsc --noEmit`
  clean. B7 was also checked live in the enterprise wizard — Section 0 now
  reads « Nom et prénom(s) du répondant », not « S0Q01 Nom… ». B9 could not
  be checked live: both test accounts already hold a draft, and a draft wins
  over registration, so only a fresh account would show it.
- B10 and B11, 2026-10-18: `register-summary.ts`, `register-draft.ts`,
  `app/register/page.tsx`, `registration-queue-cache.ts`,
  `app/admin/inscriptions/page.tsx`, `app/admin/questionnaires/page.tsx`,
  `auth-store.ts`, `use-require-auth.ts`, `app/home/layout.tsx`,
  `app/admin/layout.tsx`, `app/admin/sectors/page.tsx`, `globals.css`,
  both message files; backend `admin-questionnaires.controller.ts`,
  `questionnaires.service.ts`, `common/i18n/error-messages.ts`. Gates:
  `npm test` 887/887, `check:ui-grammar` passes with no baseline change,
  `npx jest --runInBand` 1817/1817. `npx tsc --noEmit` reports one error, in
  `FieldRenderer.tsx`, from another session's uncommitted work in this shared
  checkout — not in any file of this change, and left for its author.
  While adding `limit=0` the two paging messages gained their English forms:
  they reach the exception through a parameter, so the catalogue walker never
  saw them ('message' is in its RESOLVED_ELSEWHERE set) and they answered in
  French whatever the reader's locale.
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
- B10 and B11 are untouched.

## Questions for domain review (no change made)

- PP Section 3 columns: « From 01/10/2026 to 31/12/2026 » then « Outlook at
  end of December » — the same date as the period end.
- Dataset `establishmentId` holds the internal UUID
  (`e441d4cf-…`), not the public ID (PP26000102), though labelled « ID
  établissement ».
- Approval of an enterprise verifies CNPS but not the NIU.

## Not covered

- Enterprise survey: opened on 2026-10-17 to verify B5 and B7 — the
  preliminary quiz was answered (applications Yes / executives / under 25,
  everything else No) and Section 2 opened with S21Q01 only. Nothing was
  typed into a table and nothing was submitted, so EN26000201 now holds a
  draft with quiz answers, no figures, and the Section 1 values the old
  prefill wrote (see B9). The rest of the enterprise journey is still
  untested.
- Official PDF content of the project declaration (not downloaded).
- Mobile/tablet layouts.
