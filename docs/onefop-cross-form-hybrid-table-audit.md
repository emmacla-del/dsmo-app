# ONEFOP — Cross-form hybrid statistical table audit

**Status:** audit only — no code, AST, schema, database or test was changed.
**Date:** 2026-09-28
**Evidence:**

| Source | Location |
|---|---|
| Official paper forms (PDF) | `C:\Users\win\Desktop\CAMLEAP documentation\pdf forms\` (text + table grids extracted with pdfplumber) |
| Canonical AST | `lib/core/focus/compiler/onefop_ast.dart` (`tableSpec` maps) |
| Generated schema | `react-web/public/schemas/onefop.schema.json` (matrix cell ids, labels) |
| React renderers / definitions | `react-web/src/components/onefop/tables/*`, `definitions/modernJobsTableDefinitions.ts` |
| Persistence | `prisma/schema.prisma`, `src/common/normalizers/flat-key-normalizer.ts` |
| Export | `src/data-management/*` (canonical registry → SAV/CSV/SPS, Excel sheets) |

Paper extraction caveat: rotated labels (e.g. the vertical "Permanent / Temporaire" band in S23Q02 and
"SFP/CSS" in Administration) come out as scrambled characters; their meaning was read from the table
layout around them. Nothing below depends on a guessed label.

---

## A. Forms audited

| Form | Paper file | Pages | Digital entity |
|---|---|---|---|
| Entreprises | `Questionnaire_ENTREPRISES.pdf` | 4 | `enterprise` |
| Coopérative | `Questionnaire_Cooprative.pdf` | 4 | `cooperative` |
| CTD / RLA | `Questionnaire_CTD.pdf` | 4 | `ctd` |
| ONG | `Questionnaire_ONG.pdf` | 4 | `ong` |
| Administration | `Questionnaire_Administration.pdf` (+ `…_MINFOPRA.pdf`, wording-only variant) | 3 | `administration` |
| Projet / Programmes | `Questionnaire_Projet_et_Programmes.pdf` | 4 | `projectProgram` |
| ASFOP (formation professionnelle) | `QUESTIONNAIRE ASFOP 2025_2026 sam 12.pdf` | 20 | `vocationalTraining` |

`… - Copy.pdf` files are byte-identical duplicates and were not audited separately. Coopérative, CTD and
ONG differ from Entreprises in Sections 2–4 **only** in S22Q05's row labels and minor English wording
(diffed line-by-line).

## B. Tables audited

Sections 2–4 of the six demand-side forms (every statistical table), and the ASFOP tables whose paper
heading or structure is inconsistent. VT tables otherwise follow their own `vt` metadata architecture and
are out of this audit's recruitment focus.

---

## C. Table-by-table structure matrix

Legend — **Shape**: *flat* (one row dim × one column dim), *grouped* (column dims nested under a group
header), *nested* (row dims nested), *hybrid* (a dimension held outside the grid as a selector/slice or
fixed context). **Agree?**: paper FR / paper EN / table structure / digital schema.

### C.1 Entreprises, Coopérative, CTD, ONG (identical unless noted)

| ID | Population | Rows | Columns | Totals | Shape | Agree? | Digital (AST template → keys) | Remediation |
|---|---|---|---|---|---|---|---|---|
| S21Q01 | Demandes d'emploi | CSP (3) | Sexe (M/F/T) › Âge (3 + Total) | row + col | grouped | ✅ | `csp_gender_age_table` → `s21q01_{csp}_{sex}_{age}` | wording year only |
| S22Q01 | Recrutements permanents | CSP | Sexe › Âge | row + col | grouped | ✅ | same template | wording year only |
| S22Q02 | Recrutements temporaires | CSP | Sexe › Âge | row + col | grouped | ✅ | same template | wording year only |
| S22Q03 | Recrutements par diplôme | Diplôme (12) | Sexe › Âge | row + col | hybrid (CSP slice) | **Approved** | `diploma_gender_age_table` + `csps` → React `s22q03_{csp}_{diploma}_{sex}_{age}` | **Preserve (§E)** |
| S22Q04 | Recrutés en situation de handicap | CSP | Statut (Perm/Temp) › Sexe (M/F/T), + Total | row + col | grouped | ✅ | `csp_status_gender_table` → `s22q04_{csp}_{status}_{sex}` | wording year only |
| S22Q05 (Entreprises) | Recrutés vulnérables | **Nature** (Déplacés, Réfugiés, Orphelins) | Statut › Sexe, + Total | row + col | grouped | ❌ paper EN says "per CSP, gender, status" | `vulnerable_named_rows_table`, prefix `s22q05_ent` → `{nature}_{status}_{sex}` | **Yes → Nature × CSP × Statut × Sexe** |
| S22Q05 (Coop/CTD/ONG) | Recrutés vulnérables | **CSP** (paper) | Statut › Sexe, + Total | row + col | grouped | ❌ header "Nature de vulnérabilité" but rows are CSP; digital uses **Nature** rows | `vulnerable_named_rows_table`, prefix `s22q05_oth` (Nature rows) | **Yes → Nature × CSP × Statut × Sexe** |
| S23Q01 | Primo-demandeurs | CSP | Sexe › Âge | row + col | grouped | ✅ | `csp_gender_age_table` | none |
| S23Q02 | Primo-recrutés | Statut (Perm/Temp) › CSP, subtotal per status | Sexe › Âge | subtotal + grand total | **nested rows** + grouped cols | ❌ paper FR omits *sexe* and *statut*; digital FR/EN fixed | `first_time_workers_table` → `s23q02_{status}_{csp}_{sex}_{age}`; subtotal keys differ (§H) | keys only |
| S3Q01 | Départs | CSP | Motif (Licenc., Démission, Retraite, Autres, Ensemble) › Sexe | row + col | grouped | ⚠ wording names no dimension (both langs) | `departure_table` → `{csp}_{type}_{sex}` | optional wording |
| S3Q02 | Motifs de licenciement | 3 free-text slots | Sexe (M/F/Total) | col | flat list | ✅ | `reasons_table` (3 slots) | none |
| S3Q03 | Licenciés / chômage technique | CSP | Type (Licenciement, Chômage technique) › Sexe, + Total | row + col | grouped | ❌ paper EN mislabelled "S3Q02 … dismissed", omits technical unemployment; digital EN fixed | `dismissal_unemployment_table` | none (digital correct) |
| S4Q01 | Stagiaires | Nature du stage (4) | Sexe (M/F), Total | row + col | flat | ⚠ paper "recrutés/recruit", digital "accueillis/host" | `internship_table` | none (wording choice) |
| S4Q02 / S4Q03 | Besoins compétences / formation | 3 free-text slots | Sexe | col | flat list | ✅ | `skills_table` / `training_table` | none |

### C.2 Administration (civil-service categories replace CSP)

| ID (paper) | Population | Rows | Columns | Shape | Agree? | Digital | Remediation |
|---|---|---|---|---|---|---|---|
| S21Q01 (1st) | **Effectifs recensés** | SFP: Fonctionnaire, Décisionnaire, Contractuelle | Sexe › Âge | grouped | ❌ wording "selon les statuts de la FP **par CSP**" — no CSP dimension in the table | `S21Q01`, rows = SFP | wording or dimension decision |
| **S21Q01 (2nd — duplicate code)** | Recrutés | SFP | Sexe › Âge | grouped | ❌ same CSP wording issue; **paper reuses code S21Q01** | mapped to `S22Q01` | code + wording |
| S22Q04 | Recrutés handicap | Paper: "SFP/CSS" label but values **Cadres / Maîtrise / Exécution** | Paper: Sexe only (M/F/Total) | flat | ❌ wording "le sexe **et le statut**" but no statut columns; row taxonomy contradicts label | Digital: **SFP rows × Statut × Sexe** — differs from paper | **Yes — domain decision** |
| S22Q05 | Recrutés vulnérables | Nature (3) | Paper: Sexe only | flat | ❌ wording mentions statut; no statut columns | Digital: `s22q05_oth` Nature × **Statut** × Sexe — differs from paper | **Yes — domain decision** |
| S3Q01 | Départs | SFP | Motif › Sexe | grouped | ⚠ as C.1 | `departure_table`, SFP rows | none |
| S3Q02 | Motifs | 3 slots | Sexe | flat list | ✅ | `reasons_table` | none |
| **S3Q03** | Licenciés / chômage technique | SFP (label only, no row names printed) | Type › Sexe | grouped | ❌ on paper, **absent from AST/schema** | — | **Yes — add or confirm removal** |
| S4Q01 / S4Q02 | Stagiaires / compétences | as C.1 | as C.1 | — | ✅ | present | none (no S4Q03 on paper or digital) |

### C.3 Projet / Programmes

| ID | Population | Rows | Columns | Shape | Agree? | Digital | Remediation |
|---|---|---|---|---|---|---|---|
| S3 (KPI) | Bénéficiaires | 4 indicators (insérés employés, auto-emploi, emplois créés par bénéficiaires employeurs, formés) | *Du 1er janvier 2026 à ce jour*, Perspectives 30/06, Perspectives 31/12 | flat | ⚠ generated PDF heads column 1 "Réalisations **au cours du trimestre**" — paper says cumulative since 1 January | `kpi_period_table`, `s3kpi_{kpi}_{current,outlook_dec,outlook_june}`; no row/column labels in AST | PDF i18n wording |
| S4Q01 / S4Q02 | Permanents / temporaires **recensés** | CSP | Sexe › Âge | grouped | ✅ | `csp_gender_age_table`, prefix `pp_s4q0x` | none |
| S4Q03 / S4Q04 | Permanents / temporaires **recrutés** | CSP | Sexe › Âge | grouped | ✅ | same | none |
| S4Q05 | Recrutés handicap | CSP | Statut › Sexe, + Total | grouped | ✅ | `csp_status_gender_table` | none |
| S4Q06 | Recrutés vulnérables | CSP (paper and digital) | Statut › Sexe, + Total | grouped | ❌ header "Nature de vulnérabilité" + FR "nature de la vulnérabilité" but rows are CSP | `csp_status_gender_table` (CSP rows) | **Yes → Nature × CSP × Statut × Sexe** (domain confirm) |

### C.4 ASFOP — only the inconsistent tables

| Table | Issue | Digital state |
|---|---|---|
| 4.1 / 4.2 | Paper EN "Number of **trainers**" for FR "apprenants" | Digital EN fixed ("trainees") |
| 4.9 | FR "personnes socialement vulnérables", paper EN "type of impairment"; one row list mixes **disability types** (moteur, visuel, auditif, polyhandicap) with **vulnerability types** (réfugiés, orphelins, déplacés, retournés, 3 peuples autochtones) under a "Type d'handicap" header | Digital EN fixed; mixed row taxonomy remains (structural, low priority, separate decision) |

---

## D. Wording / table mismatches (flagged, not corrected)

1. **Reference year in digital labels is inconsistent.** Schema labels say *1er janvier 2025* for S21Q01,
   S22Q01, S22Q02, S22Q04, S22Q05, S3Q01, but *2026* for S22Q03, S23Q02, S3Q03, S4Q01 and all PP tables.
   Every paper form says 2026.
2. **S22Q05 means different things per form** under identical wording: Entreprises = Nature rows;
   Coop/CTD/ONG paper = CSP rows; Coop/CTD/ONG digital = Nature rows; Administration = Nature × Sexe only;
   PP S4Q06 = CSP rows. Paper EN ("per socio-professional category, gender, and status") contradicts FR
   ("statut et nature") on every form.
3. **S23Q02 paper FR** says "selon la CSP et la tranche d'âge" but the table also breaks down by *sexe* and
   *statut* (rows nested Permanent/Temporaire › CSP). Digital wording already corrected.
4. **S3Q03 paper EN** is labelled "S3Q02" and omits technical unemployment. Digital corrected.
5. **Administration**: two different tables both coded **S21Q01** (recensés, recrutés); wording "selon les
   statuts de la FP par CSP" while the tables have a single SFP row dimension; S22Q04 wording mentions
   *statut* without status columns and prints enterprise CSP rows under an "SFP" label; S22Q05 wording
   mentions *statut* without status columns; S3Q03 on paper but not in the AST.
6. **PP S3 column 1**: paper "Du 1er janvier 2026 à ce jour" vs generated PDF "au cours du trimestre".
7. **PP S4Q06**: wording and header say nature of vulnerability; rows are CSP.
8. **ASFOP 4.9**: mixed disability/vulnerability taxonomy (§C.4).

---

## E. Approved changes that must be preserved

| Change | Where | Must not change |
|---|---|---|
| **S22Q03 4-D remediation** (CSP slice × Diplôme × Sexe × Âge) | AST `tableSpec.csps`; React `cspSlices` / `buildRowsForCsp` / horizontal CSP tabs; keys `s22q03_{csp}_{diploma}_{sex}_{age}`; normalizer `buildDiplomaTable` (`has4D`); `OnefopDiplomaData.cspCategory` | keys, wording, relational mapping |
| Quiz-driven NONE + zero semantics | `QuizSemantics.ts`, `onefop-submission.ts` | NONE tables zero both React-definition keys and schema cells |
| Corrected digital wordings (S23Q02, S3Q03, VT 4.1/4.2/4.9 EN) | AST labels | do not revert to paper wording |
| Stored cell-key conventions per template | AST row strings "only feed cell-ID generation" (comment in `s22q03`) | existing keys of existing tables |

---

## F. AST gaps

**What the AST represents today.** `tableSpec` is an untyped `Map<String, dynamic>`: a `template` name, a
key `prefix`, and named value lists (`rows`, `csps`, `statuses`, `genders`, `age_bands`,
`departure_types`, `types`, `rows: 3` for slot lists). The *values* of each dimension are declarative.

**What it cannot represent generically.**

| Capability | Today |
|---|---|
| Which dimensions are rows vs columns vs selector | Implicit in each template's builder (Flutter `TableSpecBuilder`, React `build*TableDefinition`) |
| Column hierarchy (Statut › Sexe, Sexe › Âge) | Template-coded; React supports one `headerGroups` level |
| Row hierarchy (S23Q02 Statut › CSP + subtotals) | Template-coded (`first_time_workers_table`) |
| Selector / slice dimension | Only `csps` on `diploma_gender_age_table` (S22Q03) |
| Dimension labels (FR/EN) | Hard-coded in builders; schema carries only ids (`limitation` note in every schema table) |
| Cell-key order | Template-specific (`{csp}_{diploma}…` vs `{status}_{csp}…` vs `{nature}_{status}…`) |
| Totals / subtotals | Template-coded (`isComputedCspCell`, `recalculate*`) |

**Reusable mechanism from S22Q03.** Yes: an *outer slice dimension* declared in the AST (`csps`),
rendered as horizontal tabs (Tableur) / sequential passes (Guidé), with per-slice rows and recalculation.
It is currently named and typed for CSP only.

**Minimum generic AST change (proposal).** Add one optional, template-independent key to `tableSpec`:

```text
"slice": { "dim": "<dimension name>", "values": [...], "keyPosition": <index in cell key> }
```

and allow any existing template to take a `slice`. `csps` on S22Q03 becomes `slice: {dim: "csp", …}` with
the **same** key position, so S22Q03's stored keys are unchanged. Nothing else is required for the tables
in §J: their inner grids are already expressible by existing templates (`vulnerable_named_rows_table`,
`csp_status_gender_table`). Dimension labels can stay in the builders for now (moving them into the AST is
desirable but not necessary for these remediations).

---

## G. UI / rendering gaps

| Pattern | Existing component | Gap |
|---|---|---|
| Horizontal dimension selector (Tableur) | `AdaptiveStatisticalTable` CSP tabs (`role="tablist"`) | hard-wired to `cspSlices` / `activeCsp` / `buildRowsForCsp` / `recalcForCsp`; generalise names to `slices` + slice label |
| Sequential slices (Guidé) | `handleGuidedAdvance` steps through `cspSlices` | same generalisation |
| Grouped column headers | `headerGroups` (one level) | enough for Statut › Sexe; two-level headers not needed for §J |
| Nested row groups + subtotals | `isSubtotal` rows (S23Q02) | none |
| Automatic totals | `recalc` / `recalcForCsp`, `calculationMode: "materialized"` | slice-aware recalc must also compute cross-slice totals (e.g. S22Q05 total over all natures × CSP) |
| Quiz scoping per slice value | `resolveTableScope` (CSP/age only) | nature-of-vulnerability scoping not modelled; not required |

No new renderer is needed; S22Q05 (4-D) is the S22Q03 pattern with a different slice dimension.

---

## H. Database / export risks

| Area | Risk for the §J changes |
|---|---|
| Existing records | Stored under current keys (`s22q05_ent_*`, `s22q05_oth_*`, `pp_s4q06_*`). New 4-D keys make old submissions structurally different; no automatic back-mapping (old rows lack CSP or nature). **Version the table** (read old shape, write new) rather than rewrite history. |
| Database constraints | `OnefopVulnerableData` is unique on `(submissionId, vulnerableType, status, gender)` — **no CSP**. 4-D S22Q05 needs either a `cspCategory` column + new unique key (migration, **human approval required**) or aggregation over CSP in the normalizer (loses the dimension relationally, as rawData keeps it). `OnefopDisabilityData` (S22Q04) already has `cspCategory`; Administration's SFP rows go into it. PP S4Q06 is stored as CSP rows today. |
| CSV / SAV / Codebook | The canonical registry derives variables from the schema **matrix**. New matrix = new variable names; old declarations export blank there. The codebook changes. **Known gap already present:** React S22Q03 keys (4-D) are not in the schema matrix (3-D), so React-entered S22Q03 values do not reach the SAV; the same would happen to a 4-D S22Q05 unless the matrix and registry are updated together. |
| Excel | Sheet "Personnes vulnérables" has columns `vulnerableType, status, gender` — needs a CSP column. |
| Key divergences to fix alongside | S23Q02 subtotals: React `…_{status}_total_…` vs schema `…_{status}_subtotal_…`; S22Q04/PP S4Q05/S4Q06: React writes per-CSP row totals absent from the schema. |

---

## I. Recommended reusable architecture

1. **One hybrid-table model**: *inner grid* (existing template: rows × grouped columns, totals) + optional
   *outer slice dimension* (AST `slice`), rendered by the existing adaptive table (tabs in Tableur,
   sequential passes in Guidé).
2. **Cell keys** remain template-owned, with the slice value inserted at a declared position — existing keys
   of unchanged tables stay byte-identical.
3. **One source for dimension metadata** consumed by React definitions, the schema matrix, the canonical
   export registry and the normalizer — so the registry/SAV gap in §H cannot recur.
4. **Wording generated from dimensions** is *not* recommended now: wording is official questionnaire text
   and needs domain sign-off per table.

---

## J. Tables requiring remediation

### J1. S22Q05 — Entreprises (`S22Q05_ENTERPRISE`)
- **Current:** Nature (3) × Statut (Perm/Temp) × Sexe (M/F/T) + totals.
- **Intended:** Nature × CSP × Statut × Sexe (as specified).
- **Wording:** FR "…selon la nature de la vulnérabilité, la catégorie socioprofessionnelle, le statut et le
  sexe…"; EN "…per nature of vulnerability, socio-professional category, status and sex…" (final text for
  domain sign-off; year 2026).
- **AST:** add `slice` (dim `csp`, values cadres/foremen/workers) to the existing `vulnerable_named_rows_table`
  spec (or slice by `nature` over `csp_status_gender_table` — one choice, applied to all S22Q05 variants).
- **UI:** generalised slice tabs / Guidé passes; slice-aware totals.
- **Database:** `OnefopVulnerableData` lacks CSP → migration or aggregation decision (human approval).
- **Export:** new registry variables; codebook; Excel CSP column; old records blank in new variables.

### J2. S22Q05 — Coopérative, CTD, ONG (`S22Q05_OTHER`)
- **Current:** paper = CSP × Statut × Sexe; digital = Nature × Statut × Sexe (they disagree).
- **Intended:** Nature × CSP × Statut × Sexe (same as J1).
- **Wording / AST / UI / Database / Export:** as J1 (prefix `s22q05_oth`).

### J3. S22Q05 — Administration (`S22Q05_OTHER`, shared prefix with J2)
- **Current:** paper = Nature × Sexe; digital = Nature × Statut × Sexe.
- **Intended:** **domain decision required** — does Administration use SFP (Fonctionnaire/Décisionnaire/
  Contractuelle) in place of CSP, and does it have a Statut dimension? Do not assume J1's structure.
- **Note:** J2 and J3 share the prefix `s22q05_oth`; if their intended structures differ, Administration
  needs its own prefix (new keys).

### J4. S22Q04 — Administration
- **Current:** paper = enterprise CSP rows under an "SFP" label × Sexe; digital = SFP rows × Statut × Sexe.
- **Intended:** **domain decision** (SFP vs CSP rows; Statut yes/no). Digital shape is plausible.
- **Wording:** remove the duplicated *statut* ("statuts de la fonction publique … et le statut").
- **AST/UI:** none if the digital shape is confirmed. **Database:** none (`cspCategory` holds SFP values).

### J5. S3Q03 — Administration
- **Current:** on paper (SFP rows × Licenciement/Chômage technique × Sexe), absent digitally.
- **Intended:** **domain decision** — add (existing `dismissal_unemployment_table`, rows = SFP) or confirm
  deliberate removal. Adding it = new table, new keys, new export variables; no migration (`OnefopDismissalUnemployment` fits).

### J6. S21Q01 / S22Q01 — Administration (wording and codes)
- **Current:** wording "statuts de la FP par CSP", table has one SFP dimension; paper codes both tables S21Q01.
- **Intended:** keep structure; correct wording to the actual dimension (or add a CSP dimension — not
  evidenced by the table, so not recommended without domain input). Paper code duplication is a form issue.

### J7. S4Q06 — Projet / Programmes
- **Current:** CSP × Statut × Sexe; wording/header say nature of vulnerability.
- **Intended:** Nature × CSP × Statut × Sexe, **if** ONEFOP confirms PP S4Q06 is the same indicator as S22Q05.
- **AST/UI/Database/Export:** as J1 (prefix `pp_s4q06`).

### J8. Wording-only corrections (no structural change)
- Reference year 2025 → 2026 on S21Q01, S22Q01, S22Q02, S22Q04, S22Q05, S3Q01 (all demand forms).
- PP Section 3 PDF heading "au cours du trimestre" → "du 1er janvier … à ce jour" (PDF i18n, not AST).
- Optional: S3Q01 wording naming its dimensions (motif, CSP, sexe).

### J9. Key alignment (no questionnaire change)
- S23Q02 subtotal keys (React `total` vs schema `subtotal`), React-only row totals on S22Q04 / PP S4Q05 / S4Q06,
  and the existing S22Q03 registry gap — align schema matrix, registry and React keys.

---

## Final answers

1. **One generic hybrid-table architecture?** Yes. Every remaining table is an existing inner grid plus, at
   most, one outer slice dimension — exactly the approved S22Q03 pattern generalised from "CSP" to any
   dimension.
2. **Minimum AST change:** one optional `slice` descriptor on `tableSpec` (dimension, values, key position),
   usable by any template; migrate S22Q03's `csps` to it with the same key position.
3. **Reusable UI patterns:** generalised slice selector (Tableur tabs / Guidé passes), existing one-level
   grouped headers, existing subtotal/total rows, slice-aware materialised recalculation.
4. **Tables needing remediation:** S22Q05 (Entreprises, Coop/CTD/ONG, Administration), PP S4Q06, Administration
   S22Q04, S3Q03, S21Q01/S22Q01 wording; plus wording-only year fixes (J8) and key alignment (J9).
5. **Tables that should remain unchanged:** S21Q01, S22Q01, S22Q02, S22Q03 (approved), S22Q04 (non-Administration),
   S23Q01, S23Q02 (structure), S3Q01, S3Q02, S3Q03 (non-Administration), S4Q01–S4Q03, PP S3, PP S4Q01–S4Q05.

**Decisions needed before implementation:** J3, J4, J5 (Administration structure), J7 (is PP S4Q06 the same
indicator as S22Q05?), storage of the CSP dimension for vulnerable recruits (migration vs aggregation), and
final FR/EN wording for every changed table.
