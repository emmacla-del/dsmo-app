# E2E run 2026-10-19 — project/programme table 4.6, the nature of the vulnerability

The journey left open by the [2026-10-17 run](e2e-2026-10-17-project-enterprise.md),
whose quiz opened 4.1–4.4 only and never reached 4.6. Local backend
(`localhost:3001`) and react-web (`localhost:3000`) against the shared
database, driven through the real UI in the desktop browser pane.

**The journey completed on the first pass.** 4.6 opened from the quiz, filled
in both entry modes, submitted (201), stored as the three natures, printed,
endorsed and exported at dataset version 13 — with no refusal and no CSP
residue anywhere. The defect class that refused the enterprise submission in
the 2026-10-18 C1–C3 audit — the wizard writing cells the server does not ask
for — does not occur here: the schema matrix, the wizard's input ids and
`getExpectedMatrixCellKeys` all name `pp_s4q06_<nature>_<status>_<sex>`.

Two incidental findings are worth acting on (D1, D3). Neither is in the 4.6
change; D1 is a build-artifact trap that silently serves a stale official PDF,
D3 is a pre-existing display rule that hid table 4.5's question from the
respondent. **D3 was fixed on the owner's word the same day** (`934ba5c8`);
see "Fixed, and not fixed".

## Test data created (shared DB)

| What | Value |
| --- | --- |
| Account | PP26000102 — « Projet E2E Emploi Jeunes 20261017 », e2e.projet.20261017@example.cm, Centre / Mfoundi / Yaoundé 2 |
| Declaration | submission `172ef1ec-ab1e-4bc3-a966-11077747185b` (record `81ff4bbd-…`), Q4 2026, submitted 19/10/2026 06:23, **endorsed** by superadmin |
| Superseded | the 2026-10-17 file `d644e784-…` (record `95bd1411-…`) → `SUPERSEDED`, `supersededById = 81ff4bbd-…` |
| Exports | 1 × .sav, 1 × .csv, 1 × .sps manifest (Q4 2026), in the export history |

The 2026-10-17 file was APPROVED, so it was **reopened for correction** by
superadmin@minefop.cm (owner's choice in chat) and refiled. That path is
itself a first: see "Verified in passing".

## What was declared

Quiz Part 3 extended from 4.3/4.4 to also open **4.5** (disability) and
**4.6** (vulnerable). 4.1 was made to total 12, matching S1Q15.

| Table | What was entered |
| --- | --- |
| 4.1 permanent headcount | 4 M 15–24 cadres, 3 M 25–34 foremen, 2 F 15–24 cadres, 3 F 35+ workers = **12** = S1Q15 |
| 4.2 / 4.3 / 4.4 | zero-filled, except 4.3 cadres M 25–34 = 2 |
| 4.5 handicap (by CSP) | Cadres 1 M / 1 F, Agents de maîtrise 2 M, permanent |
| **4.6 vulnerable (by nature)** | Déplacés internes 3 M / 2 F perm, 1 M / 1 F temp · Réfugiés 2 M / 1 F perm, 0 M / 1 F temp · Orphelins 1 M / 0 F perm, 2 M / 1 F temp |

4.6 grand total computed as 6 M / 3 F = 9 permanent, 3 M / 3 F = 6 temporary,
**15** overall — correct on screen, in the PDF, in the database and in the export.

## What worked

- **Quiz (step 2).** The 4.6 option's own description already reads
  « Déplacés internes, réfugiés, orphelins ou populations vulnérables », which
  is what the table now asks. Ticking the whole option label works (§9).
  Selecting it flips the configuration panel to « 4.6 Recrut. vulnérables :
  À remplir ».
- **Tableau mode (step 3).** Row stub « Nature de la vulnérabilité »; rows
  Déplacés internes / Réfugiés / Orphelins; column groups Permanent /
  Temporaire / Total each with M / F / T. Cells arrive **empty**, not
  pre-filled with 0 — 4.6 does not reproduce C4 of the 2026-10-18 run.
  Row, column and grand totals recompute on every keystroke.
- **Guidé mode (step 3).** « Combien de déplacés internes avez-vous recruté en
  tant que permanents ? », then « Parmi eux, combien de femmes ? » — the
  prompt names the group itself, never « de la catégorie … ». The review list
  reads « Déplacés internes · Permanent · 5 personnes (3 hommes, 2 femmes) ».
- **The reference period is named, not dated.** Every Section 4 question reads
  « au cours du trimestre » — 4.6's full label is « Combien de personnes
  vulnérables avez-vous recruté selon le statut et la nature de la
  vulnérabilité au cours du trimestre? ». The exact bounds appear once, on the
  wizard masthead (« Campagne du 4e trimestre 2026 (01/10/2026 – 31/12/2026) »),
  exactly as the 2026-10-18 decision specifies.
- **Submit (step 4), the one that mattered.** `POST /api/onefop/submit` → **201
  Created**, `{"success":true,"submissionId":"172ef1ec-…"}`. No 400, no missing
  cells. Before reaching it the wizard correctly refused to submit while 4.1–4.4
  were empty, naming each table and the number of cells left — the respondent is
  stopped by the wizard, not by the server, which is the behaviour C1/C5 lacked.
- **Stored data (step 5).** 34 rows in `onefop_vulnerable_data`, types
  `DEPLACES_INTERNES`, `REFUGIES`, `ORPHELINS` and `TOTAL_VULN` only. No
  `CADRES_VULN` / `FOREMEN_VULN` / `WORKERS_VULN`. Values match what was typed.
  Zero-valued cells are not stored (`buildVulnerableNamedRows`'s `value !== 0`
  guard) and are re-filled as 0 by the export, so nothing is lost.
- **Official PDF (step 6).** Freshly generated 4-page PDF: 4.6 prints under the
  stub « Nature de vulnérabilité » with Déplacés internes 3·2·5 / 1·1·2,
  Réfugiés 2·1·3 / 0·1·1, Orphelins 1·0·1 / 2·1·3, TOTAL 6·3·9 / 3·3·6 / 15.
  4.5 still prints « CSP » with Cadres / Agents de maîtrise / Ouvriers.
  (Only after D1 below was corrected.)
- **Endorsement and export (step 7).** « Viser » → « Visé ». The .sav carries
  all 27 `pp_s4q06_<nature>_*` variables and **no** retired
  `pp_s4q06_{cadres,foremen,workers}_*`; the .csv carries all 36 columns with
  the typed values; `X-Dataset-Schema-Version: 13` on the .sav and .csv; the
  .sps header reads « Version du schéma du jeu de données : 13. » and
  « Généré par CAMLEAP ». The export contains exactly 1 case — the superseded
  2026-10-17 file is correctly excluded.

## Verified in passing

- **The reopen flow (defect 13, 2026-10-16) ran live for the first time.**
  `PATCH /api/admin/questionnaires/:id/reopen-for-correction` → 200; the file
  moved APPROVED → « Correction demandée », the respondent's home switched to
  « Correction requise » with a « Corriger mon enquête » action, and the
  wizard reopened. Reason and attestation are both enforced client-side
  (Confirm stays disabled without them).
- **The SUPERSEDED flow (2026-10-16) ran live for the first time.** On
  resubmission the old record became `SUPERSEDED` with `supersededById` set,
  and it is absent from the validated export. The project memory records this
  as never having been tested on a backend that includes it; it works.

## Defects, most severe first

### D1 — A built backend can serve a three-week-old official PDF (medium, build)

- Seen: the first render of 4.6 printed « CSP » as its row stub instead of
  « Nature de vulnérabilité », although `projectProgram.hbs` passes
  `headerLabel=(t "common.table.nature_of_vulnerability")` and the partial
  honours it.
- Cause: not the code. `dist/pdf/templates/dynamic/projectProgram.hbs` was
  dated **2026-09-29** while `dist/` had been rebuilt the same day, and
  `getTemplatePath` resolves `path.join(__dirname, 'templates', …)`
  (`src/pdf/onefop-puppeteer.service.ts:229`) — i.e. out of `dist/`. The
  template copy lives only in the `build` script's trailing
  `node -e "cpSync('src/pdf/templates','dist/pdf/templates',…)"`
  (`package.json`), so `nest build` alone, and `nest start --watch`
  (`start:dev`), leave the old templates in place. The compiled mapper was
  current, so 4.6's *rows* were the new natures while its *stub* came from the
  September template — a half-updated official document, with nothing to
  signal it.
- After running the copy step by hand the stub rendered correctly and the
  submitted file's PDF is right. Worth a guard: have `start:dev` copy the
  assets too, or fail the render when the template predates the build.

### D2 — Re-enabling a table in the quiz leaves the zeros it was given when disabled (medium)

- Seen: 4.5 opened with its cells already reading 0 after being switched from
  « Aucun » to « À remplir » in the quiz, so the table presents itself as
  answered before the respondent types. 4.6, never previously disabled on this
  file, opened empty.
- Cause: `ProjectProgramScopeQuiz.tsx:349` calls `zeroTableCells("S4Q05")` when
  the status becomes `NONE` (line 354 does the same for S4Q06), and nothing
  clears those zeros when the status becomes `REPORTED` again. The prefix map (`ScopeDataManagement.ts:30-33`) is
  row-key agnostic, so this is about lifecycle, not about 4.6's new rows.
- §9: an unanswered value must not be presented as an answer. This is the
  same family as C4 of the 2026-10-18 run, reached by a different route.

### D3 — Table 4.5 never shows the respondent what it is asking (medium) — fixed 2026-10-19 (`934ba5c8`)

- Seen: in Section 4, 4.1–4.4 and 4.6 each display their question, and 4.5
  displays only « Répartition selon le statut d'emploi (Permanent,
  Temporaire) et le sexe ». The word « handicap » appears nowhere on the
  screen; the respondent is asked to count people by CSP with no statement of
  which population.
- Cause: both heading render sites use
  `definition.caption ? … : localized(definition.title)`
  (`AdaptiveStatisticalTable.tsx:439` and `:460`) — the caption *replaces* the
  title. The 4.5/S22Q04 builder defines a `caption`
  (`modernJobsTableDefinitions.ts:792`), so its `title` — the AST label
  « Combien de personnes en situation de handicap avez-vous recruté selon la
  catégorie socio professionnelle, le sexe … » — is never rendered.
- The codebase already knows this and already has the remedy: the comment at
  `modernJobsTableDefinitions.ts:261` says « No caption: the heading shows a
  caption in place of the title » and omits the caption for exactly that
  reason. Dropping `caption` from the 4.5/S22Q04 builder would make it show
  its own question, which is what commit `17e96868` set out to achieve for
  Section 4 ("each of the six now asks what its label asks"); 4.5 was the one
  it did not reach.
- **Fixed** the same day, on the owner's word in chat (`934ba5c8`), and
  extended to the other four captioned tables — interns (S4Q01), departures
  (S3Q01), diplomas (S22Q03), first-time entrants (S23Q02) — which hid their
  questions the same way. The fix is at the heading, not in the builders: both
  sites now call a named seam `tableHeadingText`, which returns the title. The
  `caption` fields are **kept** rather than deleted, because
  `StatisticalGridRenderer:332` renders a caption as the table's sr-only
  `<caption>`; deleting them would have shown the question but silently
  removed the accessible caption. One test per captioned table asserts the
  heading is the title and not the caption, in both locales; each was checked
  red against the old expression first. react-web 905/905.

### D4 — The Section 4 heading is misspelt in French (low)

- Seen everywhere the section is named — rail, section header, review screen,
  admin file view: « SECTION 4. DETAILS SUR LES **RESENCEMENTS** ET
  RECRUTEMENTS CONCERNANT L'**ACTIVITE** … ». It should be « RECENSEMENTS »,
  and « DÉTAILS » / « ACTIVITÉ » carry no accents.
- The string is the section title in the canonical AST, so correcting it is a
  label-only AST change plus a schema regeneration — the same shape as the
  2026-10-16 « fonctional » → « functional » fix, which needed the owner's
  word in chat (§21). Not touched.

### D5 — A reviewer endorses a project file without seeing any of its figures (low, known gap)

- Seen: on `/admin/dossiers/<id>`, Sections 3 and 4 both render « Données
  chiffrées non affichées ici — les tableaux statistiques de cette section
  (cspGenderAge, disabilityData, vulnerableData) sont enregistrés avec le
  dossier, mais leur restitution dans cet écran n'est pas encore spécifiée par
  le domaine ONEFOP. » So step 8's first half cannot be checked: 4.6's named
  rows are deliberately not displayed, and « Viser » was pressed on a screen
  showing identification and axes only.
- Stated as unspecified rather than broken, so it is a gap, not a regression —
  but it is the screen on which endorsement happens. It also prints internal
  key names (`cspGenderAge`, `disabilityData`, `vulnerableData`) on a staff
  screen (§8).
- Consequence for step 8's second half: with no question labels rendered for a
  project file, the « au cours du trimestre » wording cannot be observed in
  the admin view. It was confirmed instead in the respondent wizard, where
  those labels live, and in the file the reviewer can open (PDF/export).

### D6 — The quiz and dialog checkboxes have no accessible name (low)

- `read_page` reports `checkbox "on"` for the confidentiality notice, the
  reopen attestation and the quiz's option checkboxes — the visible label is
  not the accessible name. Same family as C7 of the 2026-10-18 run.

### D7 — « Aucune campagne de collecte n'est ouverte » is shown while the campaign loads (low)

- Seen on `/home` immediately after sign-in, while the campaign was in fact
  open (`/api/onefop/active-quarter` → `isOpen: true`). It corrects itself a
  moment later.
- Cause: `src/app/home/page.tsx:353` branches on `!quarter?.isOpen`, which is
  true while `quarter` is still `undefined`; the `surveyLoading` state is only
  consulted in the branch below it. Loading is not distinguished from closed.

### D8 — The .sps manifest carries no dataset-version header (low)

- `export/submissions/spss/{sav,csv}` answer with `X-Dataset-Schema-Version: 13`;
  `export/submissions/spss/manifest` does not, though it is the file that
  states the version in its own text. (The manifest route also returns the
  syntax as JSON `{"sps": "…"}` rather than a raw `.sps` body.)

### D9 — The English row label reads « Internal displaced » (low)

- The guided prompt renders « How many internal displaced did you recruit as
  permanent workers? ». The AST row is `"Déplacés internes/ Internal
  displaced"`; the English half is not idiomatic ("Internally displaced
  persons"). The French is correct. Changing it is an AST label change (§21),
  and it is shared with S22Q05 in the other questionnaires.

## Fixed, and not fixed

Nothing in the 4.6 change itself failed, so none of the defects the task
invited fixing (a wrong row label, a missing cell key, a mapper reading the
old rows) exists. **D3 was fixed** after the run, on the owner's word in chat
(`934ba5c8`): it is respondent-facing, it hid a statistical variable's meaning
from the person entering it, and it had a precedent in the file itself.

The rest stand: D1 is a build artifact, not source; D4 and D9 touch the
canonical AST and need §21; D2, D5, D6, D7 and D8 are real but outside this
series, and §20 asks for no unrelated changes in one task. Each is written
above with its file and line so any of them can be picked up directly. D1 is
proposed as its own session.

## State left behind

PP26000102 holds one endorsed declaration for Q4 2026
(`172ef1ec-ab1e-4bc3-a966-11077747185b`) carrying the 4.6 figures above, and
its previous file `d644e784-…` is SUPERSEDED. Three exports are in the export
history. `dist/pdf/templates` and `dist/pdf/i18n` were refreshed from `src/`
by hand (build artifacts only; no source file was modified).
