# E2E run 2026-10-18 — the enterprise journey

The gap left open by [the 2026-10-17 run](e2e-2026-10-17-project-enterprise.md),
which registered an enterprise but never filed for it. Local backend
(`localhost:3001`) and react-web (`localhost:3000`) against the shared
database, driven through the real UI in the desktop browser pane.

**The journey did not complete on the first pass.** The wizard reported the
declaration complete and let the respondent confirm, and the server then
refused it for 46 cells the respondent was never shown.

**Fixed the same day** (commit `64f499a1`): C1, C2 and C3 below. The same
declaration now submits — 201, reference
`3466bc96-d95b-4d60-bfdf-99bfbdaf1325`, submitted 18/10/2026 09:53, Q4 2026,
status « Awaiting review by ONEFOP ». The cause was vocabulary, not scope:
the completeness check asked for cell names in a language neither the wizard
nor the persistence layer uses, so correcting the check changed nothing
stored, normalized or exported. The third fix stops a free-text slot being
treated as in use because of the zeros the table opens with.

Still not reached: the administrative review and endorsement, and the SPSS
export of an enterprise record. C4 to C7 are untouched.

## What was declared

Account EN26000201, « Societe E2E Batiment 20261017 », Q4 2026.

| Step | What was entered |
| --- | --- |
| Section 0 | Prefilled from registration (Aline Mbarga, HR Director) |
| Section 1 | Prefilled; « Quartier / village / localité » corrected from the street address the old prefill left (see B9 of the previous run) to « Bonanjo » |
| Quiz | Applications Yes (Executives, <25) · Recruitment Yes (Permanent, Field workers, 25–34, BEPC/CAP; disabilities No, vulnerable No) · First-time seekers No · First-time entrants No · Departures Yes (Resignation) · Interns Yes (Academic) · Priority skills Yes · Continuing training No |
| 2.1 Job applications | Executives 6 M / 3 F = 9 |
| 2.2 Recruitments | Field workers 4 M / 1 F = 5; by diploma BEPC 4 M / 1 F = 5 |
| 3 Departures | Field workers, resignation, 2 M |
| 4 Interns | Academic 3 M / 2 F = 5 |
| 4 Skills | Slot 1 « Maconnerie », 2 M |

Totals and grand totals computed correctly on every table. The rail reached
« 5 of 5 sections completed » and the review screen showed a green tick
against all five sections, with no issue listed.

## Bugs, most severe first

### C1 — The wizard and the server disagree about which cells a REPORTED table needs (high, blocking)

- Seen: « Confirm & Submit » → 400, « The form contains tables declared
  "reported" with missing or invalid cells (46 cell(s)… ». The wizard shows
  nothing to correct: every section still carries its tick.
- `enforceReportedMatrixCompleteness`
  (`src/questionnaires/questionnaires.service.ts` ~2256) requires every key
  `getExpectedMatrixCellKeys` returns for a table whose `_RESPONSE_STATUS` is
  REPORTED. For **s3q01** (~2602) that builder returns the whole matrix — 3
  categories × 6 reasons × 2 sexes = **36 cells** — and never reads
  `_scopeConfig`. The quiz said « resignation » only, for two categories, so
  the wizard rendered 4 cells and the other 32 cannot be filled from the UI
  at all. **s4q01** (~2653) does the same with all four internship types = 8
  cells where the quiz picked one.
- The s21q01 branch immediately above (~2389) *does* honour
  `scopeConfig.application_csp` / `application_age`, which is why Section 2
  passes and Sections 3 and 4 do not. The scope rule exists; two tables were
  never given it.

### C2 — The interns figure is written under a key the server does not read (high)

- The wizard's cells are `s4q01_academic_male` / `_female`; the server expects
  `s4q01_academique_male` / `_female` (French), and `findCellValue` (~2304)
  aliases only slot descriptions, nothing for this. So the 3 M / 2 F typed on
  screen are invisible to validation — the server reports them among the
  missing — and nothing else in the submit path looks for the English key.
- This one is not merely a blocked submission: a figure the respondent
  entered does not reach the record under the name everything downstream
  uses.

### C3 — Pre-filled zeros make the server demand descriptions for unused skill slots (high)

- `s4q02_slot2_desc` and `s4q02_slot3_desc` are reported missing although the
  respondent filled only slot 1. The skills table opens with every count cell
  already reading `0`, so slots 2 and 3 look used, and the expected-key
  builder then requires their description. The respondent sees three rows,
  two of them apparently already answered with zeros, and no indication that
  naming them is now compulsory.

### C4 — Applicable tables open already answered with 0 (medium, §9)

- Every table the quiz *opens* arrives with its cells pre-filled `0`:
  Section 2 recruitments, Section 3 departures, Section 4 interns and
  skills. The section is counted complete and ticked before the respondent
  types anything — Section 2 read « 2 statistical tables • 1 completed » with
  the recruitments table ticked while it was untouched.
- This is not the zero-filling of §10: the modal states separately that « 8
  table(s) [are] certified as null (0) according to your preliminary
  questionnaire responses », which is the legitimate mechanism for tables the
  quiz closes. These are the tables it opens.
- §9: an unanswered value must not be presented as an answer. It also hides
  C1 and C3, since a respondent cannot see which cells they have really
  answered.

### C5 — A refused submission says nothing the respondent can act on (medium)

- The 400 appears as a single line of text naming three cell keys and « +43 ».
  Those keys are internal (`s3q01_cadres_licenciement_male`), §8 keeps such
  codes off a respondent's screen, and the review screen continues to show
  every section complete. There is no link to the offending table and no way
  to reach the cells, because the wizard does not render them.

### C6 — A stale database connection surfaces as « Internal server error » (low)

- The first « Confirm & Submit » returned 500. The backend log shows Prisma
  `P1017 Server has closed the connection` in `submitQuestionnaire` at
  `establishment.findMany` — the pooled connection had gone stale (see the
  session-mode pool note in the project memory). The retry got past it.
- Nothing distinguishes this from a genuine fault for the respondent, and a
  submission is exactly where a retry matters.

### C7 — The review screen's action bar has four unnamed buttons (low)

- `read_page` reports four buttons with no accessible name where the screen
  shows « Previous », « Official PDF preview », « Edit » and « Review &
  Submit ». A screen-reader user hears four unlabelled buttons on the screen
  that files the declaration. « Review & Submit » is also odd wording on the
  review screen itself, and it sits beside five per-section « Edit » links
  plus a sixth bare « Edit ».

## Not reached

Administrative review and endorsement, and the SPSS export of an enterprise
record — both blocked by C1. The official PDF of an enterprise declaration
was not downloaded either.

## State left behind

EN26000201 holds a complete draft (the figures above) and **no submission**:
every attempt was refused. Nothing was written to the shared database by this
run beyond the draft.
