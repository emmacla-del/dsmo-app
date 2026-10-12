# VT Form Wizard — UI/UX Audit

**Date:** 2026-10-11 · **Scope:** the vocational-training (VT) ONEFOP declaration wizard in `react-web/`
**Method:** a full walk through the running app (local dev: Next.js `:3000` → NestJS `:3001`) with a test COMPANY account (VT centre), plus a source trace.
**Status:** audit and recommendations only. No application source was changed.

Screenshots are in [`vt-wizard-audit/`](vt-wizard-audit/) and cited as `[S##]`. None shows credentials or the account email.

---

## 0. What was inspected

**Route.** `/home` → "Start a declaration" → "ONEFOP Questionnaire" → `/onefop/preview?entity=vocationalTraining`
(`react-web/src/app/onefop/preview/page.tsx`). Entry chain on that page:

1. Logo splash (no text) while the schema, company, quarter and draft load (about 7 s locally).
2. **Confidentiality notice** (`OnefopLegalAcknowledgment`). A checkbox enables "Begin". Remembered per session.
3. **Wizard** (`WizardShell` → `VtWizardSectionScreen` / `VtScopeQuiz` / `VtValidationScreen`):

| # | Step (rail label) | Content | Entry patterns used |
|---|---|---|---|
| 1 | Identification | 1.1–1.16, 3 blocks, ~20 inputs | text, read-only text, radio, chip suggestions, phone |
| ? | Preliminary questionnaire | 6 Yes/No + 1 follow-up; decides which tables apply | radio |
| 2 | General information | 2.1.1–2.2.20, 14 blocks, ~50 inputs incl. follow-ups | radio, checkbox, stepper, text, 2-/3-column rows |
| 3 | Emergencies | 3.1–3.12, 4 blocks, ~30 inputs | radio, checkbox, stepper, textarea |
| 4 | Trainees | 11 tables 4.1–4.11 in tabs | **grid** (4.1 only), **guided select-and-add** (4.2, 4.7–4.9, 4.11), **guided free-row** (4.3–4.6, 4.10) |
| 5 | Guides and infrastructure | 5.1–5.4, stacked (no tabs) | radio + inline number, **guided boolean row** (5.2), guided select-and-add |
| 6 | Orientation | 6.1–6.3 | radio, guided free-row |
| 7 | Cross-cutting themes | 7.1–7.7 | radio |
| 8 | Trainers | 8 tables 8.1–8.8 in tabs | guided select-and-add, guided free-row, **six loose steppers** (8.5), **roster form** (8.8) |
| 9 | Difficulties | 9.1–9.2 + a signature panel | radio, checkbox, textarea, static stamp boxes |
| 10 | Review and submission | Section summary cards, PDF, Save Draft, Review & Submit | modal with embedded 13-page PDF |

All steps were reached and exercised at 1440 px. Sections 2 and 4 were also checked at 768 px and 375 px, and Section 2 in French.

**Test data.** Fictitious values only. Edits went to this browser's IndexedDB draft. No server draft was written: "Save Draft" was deliberately not pressed, and the network log shows only `GET /onefop/draft`. **No submission was made.** The review modal was opened and closed without pressing "Confirm & Submit".

---

## A. Executive summary

The VT wizard has a sound skeleton: a step rail with completion ticks, gated Next with focus moved to the first invalid field, a correct ARIA radio pattern with keyboard support, an accessible sections drawer, position and data restored after a reload, and clear, actionable messages for the **blocking cross-table checks** (§7 of the constitution). The 4.1 grid shows what good statistical entry looks like here: real `<table>` semantics, Tab/Enter/arrow movement and live totals.

The respondent experience is let down by four systemic problems:

1. **It can mislead respondents about the state of their declaration (P0).** The pre-submission screen is headed **"Thank you for your participation"** [S25]. The masthead says **"Saved at 04:43"**, but that save goes only to the browser's IndexedDB. Nothing reaches the server during the nine sections; the only server save is a "Save Draft" button on the final screen, and it gives no feedback. A respondent can reasonably believe they have finished, or that their work is safe on the server, when neither is true.
2. **Tables are hard to fill and use five different interaction models.** Only 4.1 uses the grid. Other fixed-row tables need one select→type→Add cycle per row, **58 cycles in Section 4 alone** (4.7: 24 age groups) on a 1440 px screen. 8.1 has exactly the same shape as 4.1 but uses the slow model. The cause is a field-id-specific dispatch labelled "Section 4.1 Pilot" that was never generalised.
3. **Validation messages don't help people recover.** Inline errors repeat the whole question ("Has your training institution signed an agreement with the Government?: Required field") [S06]. Section 2 can show 32 at once with no summary. Table messages say "Enter 0 where nothing occurred" even for name and Yes/No tables, and never say which cell is missing [S18]. Cross-table mismatches appear one per press of Next.
4. **Visual and terminological inconsistency.** There are two radio implementations and three placeholder styles, "Male/Man/Men", "centre/center/school/institution", French strings in the English UI ("exemple@domaine.cm", "(FI)", "Homme"), a "Block 2" placeholder heading [S19], the content column changing width between sections, and the shell's bottom bar hard-codes colours instead of using tokens.

**Recommended direction.** Keep the current structure (rail, sections, quiz, review), which is right for a statistical declaration. Fix the state messaging first (P0). Then put **every fixed-row VT table on the adaptive engine with both Guided and Table modes and a visible switch** (Table by default from 768 px, Guided below). True rosters keep their own form. Split validation messages into a short inline message plus a GOV.UK-style error summary. Finally, consolidate the controls onto the shared tokens. None of this requires changing a statistical variable, an AST definition, or the API.

> **Identity note.** The audit brief asks for "warm off-white backgrounds and gold accents". The owner's recorded decisions of 2026-10-10 (commit `f0d607fb`, "pure white, pure black, neutral greys"; minimal UI, no decorative accents) supersede that. This audit follows the recorded decisions and does **not** recommend reintroducing gold or off-white.

---

## B. Step-by-step findings

Severity uses the backlog scale in §E. **Observed** means seen in the browser. **Code** means established from source. **Suspected** means not confirmed.

### Entry (splash and confidentiality notice)

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| Entry | Splash is a logo only, with no text or `aria-busy`, for about 7 s | Observed: page text empty during load | P3 | Screen-reader users hear nothing and slow connections look frozen | Show "Loading your declaration…" text in a `role="status"` region under the logo |
| Entry | Notice has two exits ("×" and "Go Back") and centred paragraph text | Observed | P3 | Redundant controls, harder reading | Keep one "Go back" link; left-align the notice text |
| Entry | The notice cites **Law 2020/010**, the review screen cites **Law 91/023 of 1991** | Observed (notice vs [S25]) | P2 | Inconsistent legal basis on an official form | **Domain/legal review.** Pick the correct citation(s), use the same text in both places |

### Section 1 — Identification

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| S1 | Read-only fields (1.1 structure code, 1.4–1.6 geography) look exactly like editable inputs: same white fill, same `#555` border | Observed + DOM: `readOnly` with identical styles [S02] | P2 | People click and try to type; "Not to be filled in" reads as a contradiction | Render locked values as plain text (label + value, summary-list style), not inputs, with the existing "comes from your registration record" note. No grey fill (§8) |
| S1 | 1.7 Municipality: the chip list is captioned "Communes (Fotokol)" but lists every commune of the **department**; it isn't a real control | Observed [S03] | P2 | Misleading caption; chip-or-type is ambiguous | Caption "Communes of Logone-et-Chari"; or, if the list is authoritative, make it a single-choice radio/select (needs domain confirmation that free text is not intended) |
| S1 | 1.15 has "E.g." hints above the inputs; 1.16, the same kind of fields, has none and uses an in-field placeholder instead, which is **French** in the EN UI ("exemple@domaine.cm") | Observed | P2 | Inconsistent guidance; placeholder disappears on typing; wrong language | One pattern: hint text above the input, translated. No placeholders as hints |
| S1 | Errors list one at a time in view; four errors had no summary | Observed: focus moved to 1.7, three more errors further down | P1 | Respondent doesn't know how much is left to fix | Error summary at the top of the section (see §D) |

### Preliminary questionnaire

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| Quiz | "Answer each question for the **4th quarter of 2026**" on an **annual census**, beside "last year" and "during the year" wording | Observed [S04] | P2 | Respondents pick the wrong reference period, which affects the statistics | **Domain review** of the reference-period wording; then one consistent period phrase from `campaign-period.ts` |
| Quiz | Error wording differs from the sections ("Answer this question." vs "Label: Required field") | Observed [S05] | P2 | Inconsistent voice | One message style everywhere (see §C3) |
| Quiz | Shown in the rail with a "?" marker that reads as "help", and not counted in "x of 9 sections" | Observed | P3 | Unclear status | Use a plain unnumbered marker, e.g. "Scope" with a tick when complete |

Works well: keyboard Space/Tab operation, an indented conditional follow-up, and a live "7 of 7 answered" counter.

### Section 2 — General information

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| S2 | Inline error = full question + ": Required field", e.g. "Does your school share infrastructure with another school?: Required field" | Observed [S06]; code `labelled()` `src/lib/onefop-validation.ts:166` | P1 | Long, repetitive red text under every question; unreadable when 32 appear | Inline: short and actionable ("Select Yes or No", "Enter the number of sites"). Keep "Label: message" only for the summary/review list. Needs a separate `inlineMessage` on `ValidationIssue` |
| S2 | 32 errors at once with no top summary; the long page (~50 inputs, 14 blocks) gives no overview | Observed | P1 | Cognitive overload | Error summary listing each problem with an anchor link; block status chips ("3 to fix") already exist and can drive it |
| S2 | Follow-up 2.1.5 appears **in the same row** as its parent 2.1.4 (the row reflows from 2 to 3 columns, label truncated), while 2.1.2 and 2.1.7 are indented below their parents | Observed [S07] | P2 | Layout jumps; relationship unclear | All follow-ups render indented directly under their parent, full width, never in a row grid |
| S2 | Newly revealed follow-ups show red errors immediately, because the "attempted advance" flag persists | Observed [S07] | P2 | Punishes the respondent for answering Yes | Clear `attemptedAdvance` for fields that appear after the attempt; re-validate on the next Next |
| S2 | 3-up row (2.1.10/2.1.10/2.1.11): "(optional)" wraps on one label only, so inputs sit at different heights | Observed | P3 | Ragged alignment | Single column at ≤760 px measure, or align inputs to the row bottom |
| S2 | "of which female" = 5 with total = 2 is accepted; the block still says "Complete" | Observed [S08] | P2 | A clear keying error goes into the statistics unnoticed | **Advisory** inline warning (non-blocking, per §7). Making it blocking needs an owner decision recorded in §7 |
| S2 | Accreditation order date is free text: accepts "not a date", no format hint; "01/02/2020" is ambiguous | Observed; DOM `type=text`, no hint | P2 | Unparseable or ambiguous dates in exports | Day/Month/Year inputs (GOV.UK date pattern) or `type=date`, with a format hint. Check the export format with the domain owner first |
| S2 | Number stepper: 180 px box holds 162 px of children, leaving an 18 px gap that reads as a double right border; dark-green border unlike every other input | DOM measure | P3 | Looks broken | Fix the stepper container width; use the standard input border token |
| S2 | Checkbox ids contain spaces and bilingual text ("VT2_2-Stage académique/ academic internship") | DOM | P3 | Invalid id syntax; fragile label association and tests | Generate ids from a slug of the option value |
| S2 | Copy issues in the AST: duplicate numbers (2.1.10 ×2, 2.1.15 ×2, 2.1.16 ×2), "fonctional", "Web site", "PO.Box", centre/center/school/institution | Observed | P2 | Looks unofficial; numbering clashes with the paper form | **Domain review list** (§E, D-items). Source: `onefop_ast.dart`, then regenerate |

### Section 3 — Emergencies

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| S3 | Sex-split follow-ups are labelled "If yes, of which male" / "of which female" with no total to be "of", stacked as two full-width steppers | Observed [S10] | P2 | Confusing wording; twice the vertical space | Presentational only: render the pair side by side under a generated caption ("Number trained — Men / Women"). Label text changes need domain review |
| S3 | "3.10 Securing trainee records?" / "3.10 Securing textbooks?" are fragments whose stem is missing; several questions lack "?" | Observed [S09] | P2 | Ambiguous questions | **Domain review**: restore the stem ("Has the centre taken these security measures?") as the group label |
| S3 | Block containers differ: one card wrapping four blocks in S2, one card per block in S3 | DOM + [S09] | P3 | Inconsistent rhythm; extra borders (§8) | No cards. Block heading plus spacing and a hairline divider, the same in every section |

### Section 4 — Trainees (11 tables)

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| S4 | **Only 4.1 uses the grid.** Every other fixed-row table uses guided select→type→Add: 13 adds for 4.2, 24 for 4.7, 8 for 4.8, 11 for 4.9, 2 for 4.11 (**58 cycles**), each needing a choice in the dropdown | Observed [S11, S13]; code `VtWizardSectionScreen.tsx:471-583` (hard-coded `field.id === "VT4_1"`, "Section 4.1 Pilot") | **P1** | Very slow on desktop; high error risk; zeros must be entered one row at a time | Route every **fixed-row** VT table through `AdaptiveStatisticalTable` (grid ≥768 px, guided cards below). Keep guided free-row entry only for variable-length lists (specialties) and the roster |
| S4 | No way to mark remaining empty cells as zero, although the message says "Enter 0 where nothing occurred" | Code: no zero-fill helper | P2 | Hundreds of keystrokes of "0" | A per-table "Fill empty cells with 0" action with an undo, shown only once at least one cell is filled, so "not answered" is never silently zeroed (§9) |
| S4 | Table error never identifies cells: "22 cell(s) still to fill" with no cell marked [S12] | Observed | P1 | The respondent hunts for the blank cell | Mark empty cells `aria-invalid` with a visible outline after an attempt; the summary links to the first one |
| S4 | Guided entry: the `<select>` has **no accessible name** (no label, id or aria-label) | DOM | P1 | Screen-reader users hear "combobox, Select…" | Associate the visible caption ("Diploma") as a `<label>` |
| S4 | After **Add**, focus drops to `<body>` | DOM `document.activeElement` | P1 | Keyboard users restart from the top of the page | Return focus to the select (or the first input) and announce "CAP added" in a polite live region |
| S4 | **Edit** loads the row into the form far above with no scroll, no focus move, the select still showing "Select…" and the button still "Add" | Observed [S15] | P2 | Looks like nothing happened; edit state unclear | Scroll/focus to the form, show "Editing: CAP", button reads "Save changes" (as the 8.8 roster already does) plus a Cancel |
| S4 | "1 of 12 rows filled in" on free-row tables reads as "12 required"; 1 row passes | Observed | P2 | Respondents invent rows or think they're incomplete | "1 specialty entered (up to 12)" |
| S4 | Stray micro-label under "Step-by-step entry": "diplomas", "rows", "infrastructure types" | Observed; code `VtWizardGuidedEntry.tsx:367` (`progressNoun`) | P3 | Looks like a bug | Remove it; the noun belongs only in the progress sentence |
| S4 | Second full-width green button (Add / Save row) on the same screen as Next | Observed [S13, S14] | P2 | Breaks "one primary action" (§11) | Secondary style for row actions; Next stays the only primary |
| S4 | Triple heading per table: tab title, "4.1 Number of trainees…", "4.1 Distribution of trainees…" plus caption | Observed [S11] | P2 | Duplicated headings (§8) | One heading per table (the paper title); the caption stays for AT only |
| S4 | Table tabs are buttons with selection shown only by colour/weight; no `aria-selected`/`aria-current`; no per-tab completion or error state | DOM | P1 | AT users can't tell which table is open; nobody can see which tables are done | Either a real ARIA tablist with status in each tab name ("4.2 Professional diploma — complete"), or (preferred, §D) a sub-step list in the rail |
| S4 | Cross-table blocking checks surface **one mismatch per Next press** (4.1↔4.2, then 4.5↔4.2, then 4.6↔4.5) | Observed [S16] | P1 | Trial and error; frustration | Evaluate all §7 checks at once and list every mismatch in the summary, each linking to both tables |
| S4 | Message says "table 4.5 (**FI**) counts 1 **women**" in English | Observed | P2 | Mixed language; grammar | "IT" in EN; plural-aware ICU messages |
| S4 | 4.3 sub-title "**Not-working-age** trainees by specialty" contradicts the heading "…learners **of working age**"; the French is "Apprenants non occupés" | Observed; source `lib/core/focus/renderers/vt_table_defs.dart:990` | P1 | Respondent may report the wrong population | **Domain review** (Flutter canonical source): "Trainees not in work, by specialty"; then regenerate |
| S4 | "IT"/"CT" abbreviations in field labels ("IT — Men") | Observed | P3 | "IT" reads as information technology | "Initial training — Men" or a column-group header in the grid |
| S4 | Tab bar wraps to 2 rows (desktop), 3 (tablet), **7** (mobile) | Observed [S11, S28, S29] | P2 | The first table starts below the fold on mobile | See §D: the table list moves into the rail/drawer as sub-steps |

### Section 5 — Guides and infrastructure

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| S5 | 5.2 boolean-row entry accepts a row with "Yes" but without the dependent "Is it approved?"; the section then blocks with "**1 cell(s) still to fill. Enter 0 where nothing occurred.**", impossible advice for a Yes/No | Observed [S18]; code `onefop-validation.ts:370` | P1 | Dead end unless the respondent guesses to reopen the row | Validate the row on Add (disable or flag the missing dependent answer); table message chosen by cell kind ("Answer 'Is it approved?' for Test specialty A") |
| S5 | 5.2 uses **native 13 px radios with 14 px labels**; elsewhere custom 20 px radios with 16 px labels | DOM | P2 | Two visual languages; small target | Use `form/Radio.tsx` everywhere |
| S5 | 5.1 follow-up "Number: [ ]" is an inline label with a tiny input, yet another field style | Observed [S18] | P3 | Inconsistent | Standard label-above field |
| S5 | Tables stacked vertically here but tabbed in S4/S8 | Observed [S17] | P2 | Navigation model changes mid-form | One model for multi-table sections (see §D) |
| S5 | "Total 0 rows added" (5.2) vs "0 of 9 … filled in" (5.3) | Observed | P3 | Inconsistent progress language | One progress sentence |

### Sections 6, 7 — Orientation, Cross-cutting themes

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| S6, S7, S9 | Placeholder headings "**Block 2**", "**Block 4**" shown to respondents | Observed [S19, S20]; code `VtWizardSectionScreen.tsx:991` (`blockFallbackLabel`) | P2 | Looks unfinished | An untitled group renders **without** a heading and joins the previous titled block visually |
| S7 | Block "GBV & Discipline" contains HIV/AIDS rules questions | Observed [S20] | P2 | Misleading grouping | **Domain review** of block titles |
| S6 | "minefop" in lower case in a heading | Observed | P3 | Unprofessional | AST copy fix (domain list) |

### Section 8 — Trainers

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| S8 | 8.1 has the same shape as 4.1 but uses guided entry | Observed | P1 | Same as the S4 grid finding | Same fix |
| S8 | 8.5 renders as **six loose steppers**, each repeating the "8.5" chip; the code path meant to make it a grid (`field.id === "VT8_5"`) isn't reached | Observed [S22]; code `VtWizardSectionScreen.tsx` | P2 | Fifth pattern; hard to scan as a table | 3×2 grid (status × sex) via `AdaptiveStatisticalTable` |
| S8 | Roster: First name is required by validation but unmarked, while "Last name **\***" uses the only asterisk in the wizard, contradicting "required unless marked optional"; the failure message says "**Enter 0**" | Observed: first name fixed it | P1 | Invisible requirement; wrong advice | Mark optional fields only (drop the asterisk); message "Enter the first name of Testeur" |
| S8 | Saved trainer shows "**Homme** · Permanent" in the EN UI; "1 trainers of 14" | Observed [S23] | P2 | Mixed language; grammar | Display the localized option label, not the stored value; ICU plural |
| S8 | Sex options "Man/Woman" here, "Male/Female" in S1, "Men/Women" in tables | Observed | P2 | Terminology drift | One term set in the message catalogue |
| S8 | Table title "Census of teaching and administrative staff of **public schools or contract private schools**" on a VT form | Observed [S21] | P2 | Respondent unsure it applies | **Domain review** of the title |
| S8 | "Add at least one row" for a trainer list | Observed | P3 | Generic wording | "Add at least one trainer" |

### Section 9 — Difficulties

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| S9 | "SIGNATURES & APPROVALS" panel with stamp boxes for the Director, the Delegate and the Regional Technical Secretary, which nobody can complete online; four levels of nested boxes | Observed [S24] | P2 | Respondent wonders whether they must sign or print; decorative clutter | Remove it from the web wizard (it belongs to the PDF). If a statement is needed, one line before submission: "The official PDF includes the signature block." **Check the PDF/official output is unaffected (§21).** |
| S9 | "List the 5 main outlooks": one textarea for five items | Observed | P3 | Unstructured answer | Keep the variable (AST); optionally a hint "One per line". Five fields only after domain review |
| S9 | "If yes, which of them? (Tick boxes, please)" plus "Select all that apply" | Observed | P3 | Duplicate instruction | Drop the paper instruction from the web label (domain list) |

### Step 10 — Review and submission

| Step | UI/UX deficiency | Evidence | Sev. | User impact | Recommended solution |
|---|---|---|---|---|---|
| Review | Heading "**Thank you for your participation**" **before** submission | Observed [S25]; `messages/en.json:711`, `VtValidationScreen.tsx:154` | **P0** | Respondent leaves believing they've finished; declaration never submitted | "Check your answers before submitting" here; "Thank you" only on the success screen |
| Review | Summary is counts only, and wrong for tables: "Section 4 — **0 / 0 fields** — Completed" after 11 tables | Observed [S25]; code counts non-table fields | P1 | No real way to check answers; "0/0" undermines trust | Section summary lists each question/table with its answer or totals and a "Change" link (GOV.UK check-answers) |
| Review | The only full read-back is a 13-page PDF in an iframe inside a modal (a nested scroll area) that takes about 10 s to generate | Observed [S27] | P1 | Slow; poor on mobile; not accessible | Keep the PDF as an optional download; the review page is HTML |
| Review | Loading text "**Official Handlebars & Puppeteer layout rendering**" | Observed [S27]; `OnefopPdfPreviewModal.tsx:407-408` | P2 | Implementation jargon shown to respondents | "Preparing the official document…" |
| Review | Five actions on three centred rows: Back, "Open review copy (PDF)" (duplicates the masthead's "PDF Preview"), an ambiguous "**Edit**" (jumps to Section 1), "Save Draft", "Review & Submit" | Observed [S26]; code `VtValidationScreen.tsx:553-567` | P2 | Decision clutter | One primary "Submit declaration"; secondary "Save and come back later"; the PDF link once; remove "Edit" (the Change links replace it) |
| Review | "Save Draft" calls `onSaveNow()` with no success or failure feedback | Code `WizardShell.tsx:846` (not clicked, see §0) | P1 | Unknown whether work reached the server | Show "Saved to your account at 14:32" / an error with retry |
| Review | Rail loses "Preliminary questionnaire" on this screen; no sections drawer below 1024 px | Observed [S25]; code `WizardShell.tsx:772-781` (no `quiz` prop), mobile list not rendered | P2 | Inconsistent navigation | Pass `quiz`; render the drawer on the review stage too |
| Review | Uppercase labels ("SUMMARY OF THE 9 SECTIONS", "SECTION 1"), a bordered card plus full progress bar per section, a green left-rule heading | Observed | P3 | Decoration (§8; owner's no-shouty-caps rule) | Plain summary list |

---

## C. Cross-cutting issues

**C1. Save state is ambiguous (P0).** `useOnefopDraft` autosaves every 600 ms to **IndexedDB only** (`src/lib/use-onefop-draft.ts:167`). The masthead turns that into "Saved at HH:MM" or "Draft saved". The server draft (`saveDraftToBackend`) runs only from the review screen's "Save Draft". The section-level "Save & exit" exists in `VtWizardSectionScreen` but is hidden (`showBottomBar={false}`). During ~15 minutes of editing the network log showed **no draft write**. VT is a long, multi-session form (the notice says 20–30 min; real completion with 19 tables is longer), so device changes or cleared storage lose work while the UI says "Saved".

**C2. Five table-entry models, per-id dispatch, and no visible mode switch (P1).** `AdaptiveStatisticalTable` was built to offer both Guided and Table modes with a respondent override, but the switch is never rendered (`handleSetMode` and `canToggle` are unused), so even 4.1 is locked to one mode. Grid (4.1), guided select-and-add, guided free-row, guided boolean-row (5.2), loose steppers (8.5), roster form (8.8). Button labels vary too: Add / Save row / Save trainer / Save changes. Root cause: `VtWizardTableField` branches on hard-coded ids (`VT4_1`, `VT8_5`) instead of on table shape. The `AdaptiveStatisticalTable` engine already does grid on desktop and guided cards on mobile.

**C3. Validation messages (P1).** One string (`labelled()`) serves the inline error, the summary and the review list. Table messages are generic ("cell(s)… Enter 0") whatever the cell kind. Four voices coexist: "Required field", "Answer this question.", "Add at least one row", and the good cross-table sentences. There's no section-level error summary, and the cross-table checks are reported one at a time.

**C4. Language and terminology (P2).** French leaks into the EN UI: the placeholder "exemple@domaine.cm", "(FI)", "Homme". Hard-coded `isEn ? … : …` strings bypass the message catalogue (`VtWizardSectionScreen.tsx:499-528`, `VtValidationScreen.tsx:546,567`). Plurals are missing ("1 women", "1 trainers"). Terms drift: Male/Man/Men; centre/center/school/institution/structure; rail "Contents" vs drawer "Task list". French errors too: "INFORMATIONS GÉNÉRALE", "l'Etat". There's no language switch inside the wizard.

**C5. Visual consistency and tokens (P2/P3).**
- Two radio and two checkbox renderings. The unselected ring/box is a hard-coded `#d1d6d3` (`form/Radio.tsx:154`, `form/Checkbox.tsx:76`), **≈1.4:1 against white, failing WCAG 1.4.11** (3:1).
- The shell's bottom bar hard-codes `#0e4d29`, `#cbd5e1`, `#334155`, 13 px type and a drop shadow (`WizardShell.tsx:985-1062`). The mobile sheet uses `#ffffff`, an 18 px radius and a shadow.
- The content column changes between 760 px and 1100 px by section, so headings jump horizontally (x≈262 vs x≈178 at 1440 px) [S09 vs S11].
- Decorative containers: block cards, tinted table-title bars [S13] vs untinted [S14], green left rules [S21, S25], nested boxes [S24].
- A page-scrollbar layout shift (masthead and Next move about 9 px when a short page loses its scrollbar).

**C6. Accessibility.**
- Good: radiogroup ARIA, roving tabindex, step announcements, focus to the first error, drawer focus handling, table caption and scoped headers, named grid cells.
- Gaps: the unnamed guided select; focus lost after Add; tab state not exposed; 20×20 px info buttons (below the 24 px minimum of WCAG 2.5.8) whose whole help text is the button name, with inclusion rules hidden in tooltips; Edit/Delete buttons 28 px tall; "☰" in the drawer button's name; the text-less splash; no `<h1>` on the wizard page (the section title is an `h2`).

**C7. Mobile (375 px).** The sticky masthead is **198 px** (status, PDF Preview and Exit stack on three lines) and the sticky bottom bar about 80 px, so a third of the screen never scrolls. The 4.1 grid overflows its wrapper by 30 px with no scroll cue, half-hiding Σ Total. Column headers scroll under the masthead [S29, S30]. Single-column forms stack correctly; there's no page-level horizontal scroll.

**C8. Performance (observed, local dev).** About 7 s from the ONEFOP click to the notice; on load `GET /dsmo/company` fires ×7, `/auth/me` ×3 and `/onefop/draft` ×2; PDF preview about 10 s. No console errors. Dev-mode timings exaggerate, but the duplicate requests are real (query keys or `enabled` flags not shared). Worth a separate look; not a UX redesign item.

**C9. Statistical-integrity gaps the UI could surface (advisory only, domain review).** Intra-question "of which" exceeding its total (2.1.7) goes unchecked. 2.1.15 says 5 trainers while Section 8 tables say 0 and the roster lists 1, with no signal. Per §7 these may only become **advisory** warnings without an owner decision.

---

## D. Recommended improved design

The structure stays: rail, sections, preliminary quiz, review. The changes are in feedback, table entry and consistency.

### D1. Page structure (desktop ≥1024 px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ONEFOP · Waltz (VT26000103) · Annual VT census 2026     Saved to your    │  ← one line, 56px
│                                                         account 14:32 ✓  │     status + Exit
├───────────────┬──────────────────────────────────────────────────────────┤
│ Your progress │  Section 4 of 9                                          │  ← h1 = section
│ 3 of 9 done   │  Trainees                                                │
│ ✓ Identific.  │  ┌ There are 2 problems ──────────────────────────────┐  │  ← error summary
│ ✓ Scope       │  │ • 4.2: CAP counts 4 men; 4.1 counts 3 — fix one    │  │    (only after
│ ✓ General     │  │ • 4.7: 3 cells empty — go to first empty cell      │  │     an attempt)
│ ✓ Emergencies │  └────────────────────────────────────────────────────┘  │
│ ● Trainees    │                                                          │
│   ✓ 4.1 Acad. │  4.2 Trainees by vocational diploma                      │
│   ! 4.2 Prof. │  ┌────────────────────┬───────┬───────┬───────┐           │  ← grid for every
│   ○ 4.3 …     │  │ Diploma            │  Men  │ Women │ Total │           │    fixed-row table
│   …           │  │ DIPLEG/DIPES II    │  [ ]  │  [ ]  │   0   │           │
│ ○ Guides      │  │ …                  │       │       │       │           │
│ ○ …           │  └────────────────────┴───────┴───────┴───────┘           │
│ ○ Review      │  Fill empty cells with 0 (secondary link)                │
├───────────────┴──────────────────────────────────────────────────────────┤
│ ← Previous                          Save and come back later   Next →    │  ← sticky, tokens only
└──────────────────────────────────────────────────────────────────────────┘
```

- **Progress:** the rail lists sections, and for multi-table sections nests the tables as sub-steps with ✓ / ! / ○. That replaces the wrapping tab bar and exposes per-table status to everyone (`aria-current="step"`). Number the quiz-free sections 1–9; give "Scope" and "Review" no number, so "of 9" stays true.
- **One table per screen** in Sections 4, 5 and 8. Next moves to the next table, then the next section. That shortens pages and makes "Next" predictable (§11). Sections 1–3, 6, 7 and 9 stay as one scrolling page of blocks.
- **Content width:** one 760 px reading measure for questions. Tables can run wider *inside* that column's left edge, so headings never jump.
- **Blocks:** heading plus divider, no cards. Untitled groups get no heading.

### D2. Field grouping and controls

- Labels above inputs; hints above inputs; no placeholders as hints; "(optional)" is the only requirement marker.
- Locked registration values are a definition list, not inputs.
- Follow-ups are always indented under their parent, full width.
- Sex pairs render side by side ("Men | Women") with a caption, in forms and tables alike.
- One radio component, one checkbox component, one stepper (or none: plain numeric inputs are faster for statistical entry; keep steppers only where counts are small).
- Dates use the day/month/year pattern.

### D3. Validation feedback

1. On Next: compute every issue in the step, including **all** §7 cross-table checks.
2. Show an **error summary** at the top (`role="alert"`, focused) listing each issue as a link.
3. Inline: a short instruction next to the field or cell ("Enter a number, or 0"). Empty cells get an outline.
4. Advisory coherence items appear in a separate, non-blocking "Please check" list (§7 distinction kept), never in red.
5. Row-level validation on Add, Save row and Save trainer.

### D4. Save state

- The masthead shows the **server** state: "Saved to your account 14:32", "Saving…", or "Not saved — retry". Local IndexedDB stays as an offline buffer but isn't presented as "Saved".
- A debounced server save on step change (Next/Previous/rail jump) and on "Save and come back later", within the existing `saveDraftToBackend` API contract. **No schema or API change**, but more draft writes reach the server, so check server load and the pool ceiling (see memory: session-mode pool of 15) with the backend owner.

### D5. Review and correction

- Heading "Check your answers before submitting".
- Per section: a summary list of questions/answers (tables as totals: "4.2 — 3 men, 2 women · Change").
- Coherence advisories are listed with Change links.
- Actions: **Submit declaration** (primary), "Save and come back later", "Download the official PDF". The submit confirmation dialog stays (legal copy), with the PDF optional rather than the only read-back.
- "Thank you" and the receipt appear only after a successful submit.

### D6. Mobile and tablet (<1024 px)

- Masthead collapses to one 48 px line: establishment name (truncated), a save-state icon with text for AT, and a menu button holding PDF / Exit / language.
- Rail → drawer (already accessible), including table sub-steps; a progress line "Section 4 of 9 · Table 2 of 11" under the h1.
- Tables: both modes are always available through the Guided ⇄ Table switch (R3a). The default is Guided below 768 px and Table from 768 px; on 768–1023 px the grid gets a sticky first column and a visible scroll shadow.
- Bottom bar: Previous (text button) | Next (primary); "Save and come back later" moves into the menu.

---

## E. Prioritised remediation backlog

Scope: S ≤ 1 day, M ≤ 1 week, L > 1 week. **Dep.** = approvals or ordering needed (constitution §19/§21).

| ID | Pri | Recommendation | Scope | Dependencies |
|---|---|---|---|---|
| R1 | **P0** | Replace the pre-submit "Thank you for your participation" with "Check your answers before submitting" (FR/EN) | S | none |
| R2 | **P0** | Make the masthead save state truthful: label IndexedDB as local, add server save on step change plus visible success/failure; feedback for "Save Draft" | M | Backend owner: draft write frequency and pool ceiling; UX sign-off on wording |
| R3 | P1 | Route every fixed-row VT table (4.2, 4.7, 4.8, 4.9, 4.11, 5.3, 5.4, 8.1, 8.2, 8.3, 8.5, 8.6) through `AdaptiveStatisticalTable`, dispatching on table shape rather than field id, **and render its existing Guided / Table switch** (see R3a) | L | QA: draft-shape regression (same cell ids, same `FormData` keys, so no payload change); ONEFOP domain confirms row sets |
| R3a | P1 | Show the **Guided ⇄ Table mode switch** on every table where both modes are suitable. The strategy already honours `userOverride`/`allowUserToggle`, but `handleSetMode` and `canToggle` (`AdaptiveStatisticalTable.tsx:176, 262`) are never rendered, so no respondent can switch today. Default: Table at ≥768 px, Guided below; remember the choice for the whole declaration (session storage keyed like the wizard position); both modes write the same cells, so switching never loses data | M | UX review of the switch placement (one segmented control in the table header, not a second green button); R3 for tables not yet on the adaptive engine |
| R4 | P1 | Split validation messages: short inline text plus a summary/review form; section error summary component | M | `ValidationIssue` gains an optional `inlineMessage`; tests in `onefop-validation` |
| R5 | P1 | Evaluate and list all §7 cross-table mismatches at once; link to both tables | S–M | Must keep exactly the recorded blocking set (§7) |
| R6 | P1 | Table messages by cell kind; mark empty or invalid cells; validate rows on Add/Save (5.2 dependent answer, 8.8 first name) | M | R4 |
| R7 | P1 | Guided entry accessibility: label the select, return focus after Add/Edit/Delete, live announcements | S | none |
| R8 | P1 | Table tabs → rail sub-steps with status (or ARIA tablist as an interim) | M | UX review (navigation model) |
| R9 | P1 | Review screen as check-your-answers (HTML answers, Change links, fix the table counts); PDF optional | L | Official PDF untouched (§21) |
| R10 | P1 | Required-marker consistency: remove the "Last name *" asterisk; show requiredness from validation rules | S | none |
| R11 | P1 | Mobile masthead collapse; table horizontal-scroll affordance | M | none |
| R12 | P2 | Read-only registration fields as text | S | none |
| R13 | P2 | Follow-ups always indented under the parent; clear attempted state for newly revealed fields | S | none |
| R14 | P2 | Untitled groups render without a "Block N" heading | S | none |
| R15 | P2 | One radio/checkbox implementation; fix the `#d1d6d3` contrast via a token; fix stepper width | S | Design-token check (§12) |
| R16 | P2 | Localisation sweep: move hard-coded `isEn` strings to messages, ICU plurals, localized option labels (roster "Homme"), translated placeholders, "IT" not "FI", unify Male/Men/Man and centre spellings in UI strings | M | Catalogue test for new keys (bilingual-errors convention) |
| R17 | P2 | Edit-mode cues in guided entry; secondary style for row actions (one primary per screen) | S | R3 (fewer guided tables remain) |
| R18 | P2 | Accreditation date as day/month/year with validation | S | Domain: confirm the stored date format and export parsing |
| R19 | P2 | Remove the signature/stamp panel from the web wizard; drop "(Tick boxes, please)" | S | §21: confirm the PDF output is unaffected; domain OK |
| R20 | P2 | Replace "Handlebars & Puppeteer" text; one PDF entry point | S | none |
| R21 | P2 | Rail on the review stage: keep the quiz item; drawer below 1024 px | S | none |
| R22 | P2 | Advisory (non-blocking) "Please check" for "of which > total" inside one question | S–M | §7: advisory only; any blocking needs an owner decision recorded in §7 |
| R23 | P2 | "Fill empty cells with 0" per table (explicit, undoable, only after the first entry) | S | §9 "not answered ≠ 0"; domain OK |
| R24 | P2 | Single content measure; no cards/tinted bars/left rules; plain review list | M | UX review; owner's minimal-UI rules |
| R25 | P3 | Bottom bar and mobile sheet on tokens (no hex, no shadows); `scrollbar-gutter: stable`; splash text; "☰" out of the name; an `h1` per step; info buttons ≥24 px with help shown inline where it carries inclusion rules | S–M | none |
| R26 | P3 | Deduplicate load requests (`/dsmo/company` ×7, `/auth/me` ×3) | S | Frontend; query-key audit |

**Domain/legal review list** (canonical sources, not UI work, needs approval under §21). Each change goes to `onefop_ast.dart` / `vt_table_defs.dart`, then the schema is regenerated:

- D1 4.3 English sub-title "Not-working-age" → "not in work".
- D2 Reference-period wording: quiz "4th quarter of 2026", "last year", "during the year", "current year", campaign label on an annual census.
- D3 Duplicate paper numbers (2.1.10, 2.1.15, 2.1.16, 3.10).
- D4 Copy fixes: "fonctional", "Web site", "PO.Box", "minefop", missing "?", 3.10 stem, "(Tick boxes, please)", "INFORMATIONS GÉNÉRALE", "l'Etat".
- D5 Block titles ("GBV & Discipline") and the 8.8 table title.
- D6 Legal citation (Law 2020/010 vs Law 91/023).
- D7 Whether cross-population checks (2.1.15 vs Section 8, roster vs 8.1) should become advisory warnings.

---

## F. Verification plan

General rule for every item: `npm test` in `react-web/`, browser walk-through at 1440 / 768 / 375 px in EN and FR, keyboard-only pass, no console errors. Never submit against shared data; test the submission path only in an isolated environment.

| Item | How to verify |
|---|---|
| R1 | Review screen heading reads "Check your answers…" in EN/FR; "Thank you" appears only in `OnefopSubmissionSuccess` (component test) |
| R2 | Edit a field → status "Saving…" → "Saved to your account HH:MM" after a confirmed `PUT/POST /onefop/draft`; block the network → "Not saved — retry" appears and retry succeeds; open the draft on a second browser profile → data present; unit-test the status derivation in `use-onefop-draft` |
| R3 | For each converted table: the grid at ≥768 px, guided cards at <768 px; the produced `FormData` keys are **identical** before and after (snapshot test on a filled draft); the §7 cross-table checks still fire with the same values; totals compute; Tab/Enter/arrow movement works; PDF preview unchanged for the same draft |
| R4–R6 | Empty Section 2 → the summary lists N items, each link focuses its field; inline text is short; 5.2 with "Yes" and no "approved" can't be added (or is flagged on the row); a 4.1↔4.2 and a 4.5↔4.2 mismatch are both listed on one Next; the "Enter 0" text never appears for text/boolean cells |
| R7 | Screen reader (NVDA) announces "Diploma, combobox"; after Add, focus is on the select and "CAP added" is announced |
| R8 | Rail shows table sub-steps with ✓/!; `aria-current` on the active one; jumping keeps data |
| R9 | Review lists every answered question; table totals match the grid; "Change" returns to the exact field and back to Review |
| R10, R12–R14 | Visual regression screenshots of S1, S2, S6; no "Block N" text anywhere (unit test on the section renderer) |
| R15 | Computed contrast of unselected radio/checkbox borders ≥3:1; only one radio component in the VT tree (grep) |
| R16 | Catalogue completeness test (FR/EN keys); no French strings in the EN DOM of a filled wizard (scripted text scan for known French tokens); plural forms at 1 and 2 |
| R18 | Invalid dates rejected with a specific message; valid dates stored in the agreed format; export and PDF show the date correctly |
| R19 | PDF still contains the signature block (byte- or visual-compare against a baseline PDF for the same draft) |
| R22 | Advisory shown, Next **not** blocked, warning listed separately from errors on Review |
| Regression (all) | Gateway/quiz applicability (answer "No" to a quiz question → table note "nothing to report"); closed centre (1.12 = Closed → no quiz, Sections 2–9 optional); reload restores position and data; legal notice once per session; non-COMPANY role redirected |

---

## G. Not verified

- **Final submission, the success screen, duplicate-submission protection.** Not attempted (shared data). `formId` idempotency exists in code (`use-onefop-draft`).
- **"Save Draft" (server) feedback and failure path.** Not clicked, to avoid overwriting this account's server draft; the conclusion comes from code.
- **PDF content.** The embedded viewer chrome loaded (13 pages) but the page content didn't render in the test browser.
- **Alternative branches.** A non-functional/closed centre (1.12) and quiz answers of "No" (the table "nothing to report" path) were read in code only.
- **Real screen-reader output, 200 % browser zoom, offline and session expiry.** Only ARIA/DOM inspection and the 768/375 px viewports were used.
- **French** was spot-checked on Section 2 only.
- Timings come from a local dev server and are indicative only.

## H. Recommended implementation order

1. **R1** (copy) and the **R2** design spike → P0 out first; R2 needs the backend owner's view on draft write frequency.
2. **R7, R10, R12–R15, R20, R21**: small and independent; each goes with tests in one commit.
3. **R4 → R5 → R6**: validation messaging, in that order (each builds on the issue model).
4. **R3a** (render the existing Guided ⇄ Table switch on 4.1), then **R3** (move the other fixed-row tables onto the same engine) behind a snapshot test of `FormData` keys, then **R17/R23**.
5. **R8 + R24 + R11**: navigation and layout consolidation (UX review first).
6. **R9**: check-your-answers review.
7. **R16, R18, R19, R22, R25, R26** as capacity allows; the **D-list** goes to the ONEFOP domain owner in parallel.

Each phase: one commit, diff review before the next (owner's phase-gate practice).
