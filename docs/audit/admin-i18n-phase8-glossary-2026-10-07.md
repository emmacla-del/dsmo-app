# Bilingualism — Phase 8 survey and glossary (ONEFOP declaration wizard)

Date: 2026-10-07
Scope: everything `/onefop/preview` renders — 79 source files (~30,000 lines)
reached by import from `src/app/onefop/preview/page.tsx`: the modern-jobs
wizard, the vocational-training (VT) wizard, the table renderers, the
project-programme scope quiz, submission and PDF preview, and the libraries
they call (`onefop-validation`, `onefop-units`, `onefop-schema`,
`onefop-coherence`, `register-options`, `onefop-autofill`).

Questionnaire wording — section titles, questions, field labels, options,
table titles — comes from the canonical AST
(`lib/core/focus/compiler/onefop_ast.dart` → `onefop.schema.json`), which
already carries French and English. None of it is translated by hand in this
phase; the work below is interface text and the code paths that print the
AST's text in both languages at once.

---

## A. Survey method and result

1. Extracted every string literal, template and JSX text node from the 79
   files with the TypeScript parser (368 French-looking candidates).
2. Removed values that already sit in a French/English pair (`fr:`/`en:`,
   `labelFr`/`labelEn`, `…Fr`/`…En`) and strings under a locale ternary
   (`isEn ? … : …`, `locale === "en" ? … : …`) → 202 candidates.
3. Classified the rest by reading each in context, then listed every JSX text
   node outside a locale ternary (catches unaccented French such as
   « 4.2 Temporaires »).

| Area | Finding |
|---|---|
| Submission success screen, PDF preview modal, table renderers, guided entry, header, navigation, sidebars (modern jobs) | already bilingual (locale ternaries or message keys) |
| `vt-wizard-section-utils.ts` (113 candidates) | French group titles used as lookup keys, translated through `VT_GROUP_TITLE_EN` at render; checked: 23/23 titles have an English entry |
| `register-options.ts` (24) | stored option `value`s — must not change; visible labels already `{fr, en}` |
| `onefop-autofill.ts` (24) | maps company data onto the AST's stored option values — data, not display |
| `onefop-validation.ts` (16) | already bilingual — but prints « French/ English » when a caller passes no locale (gap G5) |
| `api-client.ts` (7) | done in Phase 7 (the extractor's ternary filter missed a bare `en` variable) |
| « féminin », « année », « Fermée », « recruté(e)(s) », age-band formatter | matching logic or the French branch of an existing pair — not displayed text |
| « ONEFOP · DSMO », « NIU: », « SHA256: », « FR » / « EN », « Tab », « N » | brand marks, codes, key names |

## B. Gaps (interface text)

| # | Where | French | Proposed English |
|---|---|---|---|
| G1 | `ProjectProgramScopeQuiz.tsx:1111-1147` — "statistical tables configuration" summary | Section 3 : · 4.1 Permanents : · 4.2 Temporaires : · 4.3 Recrut. permanents : · 4.4 Recrut. temporaires : · 4.5 Recrut. handicapés : · 4.6 Recrut. vulnérables : | Section 3: · 4.1 Permanent workers: · 4.2 Temporary workers: · 4.3 Permanent recruits: · 4.4 Temporary recruits: · 4.5 Recruits with a disability: · 4.6 Vulnerable recruits: (aligned with the AST's S4Q01–S4Q06 English) |
| G2 | `VtWizardSidebar.tsx:107` | SOMMAIRE | CONTENTS |
| G2 | `VtWizardSidebar.tsx:113` | {n} sur {m} sections | {n} of {m} sections |
| G2 | `VtWizardSidebar.tsx:345` | Ministère de l'Emploi et de la Formation Professionnelle | Ministry of Employment and Vocational Training |
| G2 | `VtWizardSidebar.tsx:335` | MINFOP | **D2** |
| G3 | `WizardShell.tsx:184` (PDF preview tab title) | Aperçu PDF... | PDF preview... (the tab body is already bilingual) |
| G3 | `WizardShell.tsx:215` | Période active non disponible — rechargez la page. | Active period not available — reload the page. |
| G4 | `WizardShell.tsx:928` | section title printed with `bilingual()` (« Français/ English ») | the AST title in the selected language — the step list on the same screen (`:482`, `:639`) already does this |
| G4 | `onefop-units.ts:56, 66, 88` → shown at `WizardShell.tsx:990` | unit and table titles via `bilingual()`, plus « {section} - Partie {n} » | the AST title in the selected language; « Partie {n} » → "Part {n}" |
| G5 | `WizardShell.tsx:297`, `VtValidationScreen.tsx:46` | `validateSectionData(section, data)` without a locale → messages read « … : Champ obligatoire/ Required field » | pass the wizard's locale (the messages already exist in both languages) |

About 15 strings and three code paths. No new terms beyond the confirmed
glossary.

## C. Decisions

- **D1 Quiz summary labels (G1).** These abbreviate the AST's Section 4 table titles. Recommend the English above, which follows the AST's own English for S4Q01–S4Q06; the French stays as it is.
- **D2 « MINFOP » in the VT sidebar.** The ministry is MINEFOP (Ministère de l'Emploi et de la Formation Professionnelle — the line under it). Recommend correcting it to « MINEFOP »; it is an acronym, the same in both languages.
- **D3 Combined-language section and unit titles (G4).** `onefop-schema.ts` documents `bilingual()` as the official paper-form presentation. On screen the respondent has chosen a language and the rest of the wizard follows it; recommend the selected language for the section heading and unit titles. The PDF keeps its own presentation (generated server-side, out of scope).
- **D4 No questionnaire wording is translated here.** Every statistical label still comes from the AST.
