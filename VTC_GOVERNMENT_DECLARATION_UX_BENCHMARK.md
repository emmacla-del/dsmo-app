# Government-Grade UX for the VTC Annual Declaration

## Executive assessment

The VTC Annual Census has useful foundations: a structured schema, conditional visibility, draft persistence, bilingual content, PDF review and both guided and grid-oriented table components. It is **not yet at the usability or data-quality standard expected of a modern national government declaration service**.

The main weakness is not visual styling. The current experience asks a respondent to navigate a long, table-heavy statistical return through a desktop-first wizard whose completion signals are inconsistent, whose mobile shell is structurally unsuitable, and whose row and Boolean interactions can blur important statistical states. The respondent may be able to finish, but cannot always tell what remains, why progression is blocked, or whether a table record is truly complete.

The recommended direction is a **hybrid task-list service**. It should retain focused, step-by-step question pages within a section, but make a declaration-level task list—not a permanent wizard sidebar—the respondent's primary orientation and return point. Tables should be a deliberately selected entry method: guided rows by default, a keyboard-first spreadsheet workspace for desktop bulk entry, and stacked row cards on phone and most tablet layouts. This is consistent with official UK, US, Canadian, Australian and Census patterns for complex public-service forms and data collection.[^1][^2][^3][^4][^5]

The design objective is clear:

> A respondent must always know what this declaration is for, what to prepare, where they are, what is saved, what remains, why an answer needs correction, and what action will submit the official return.

## Scope and assessment method

This report benchmarks official government design systems and statistical-reporting services, then compares their established patterns with the VTC implementation. It is a UX recommendation only; it proposes no code changes.

The implementation review covered the wizard shell, section sequencing, field rendering, table widgets, progress calculation, validation, draft persistence and preview/submission flow, principally in:

- `lib/screens/onefop/wizard/vt_wizard_shell.dart`
- `lib/screens/onefop/wizard/vt_wizard_section_screen.dart`
- `lib/screens/onefop/wizard/vt_wizard_spreadsheet_grid.dart`
- `lib/screens/onefop/wizard/vt_wizard_table_guided_entry.dart`
- `lib/screens/onefop/wizard/vt_wizard_progress.dart`
- `lib/core/focus/utils/field_validator.dart`
- `lib/screens/onefop/onefop_form_controller.dart`

The recommendations assume an annual institutional statistical declaration, typically completed by a centre manager, administrator or delegated staff member using records held elsewhere. That differs from a short consumer application: pausing, hand-off, source-record lookup, correction and high-volume data entry are normal rather than exceptional.

## Benchmark findings

### Long government transactions are organised as tasks, not as a decorative sequence of screens

GOV.UK recommends a task list for a service with a clear end-to-end journey because it tells people what tasks exist, their order and whether they are complete. It advises against ordinary service navigation for that situation.[^1] Its multiple-tasks pattern has explicit statuses and reserves a red status for a genuine problem.[^2] Australia’s government design guidance similarly breaks large forms into smaller multi-page steps to reduce cognitive load.[^6]

This supports a declaration home/task list with meaningful sections, short preparation notes and honest states: **Not started**, **In progress**, **Needs attention**, **Complete**, and where appropriate **Not applicable**. A task list is a working checklist, not merely a row of navigation links.

### Focused questions and progressive disclosure reduce burden, but must not hide the route to correction

GOV.UK starts from one question per page, with a visible back link, a clear heading and a Continue action; only use a total-question progress count when it can be calculated reliably.[^7] USWDS likewise recommends preparatory information, plain language and progressive disclosure for complex forms.[^8]

For VTC, this does not mean a literal page for every data point. It means one coherent question group at a time: a short identification group, a single decision group, or one table row. Conditional follow-up questions should appear only after the answer that makes them relevant, without unexpectedly moving the respondent away from the current context.

### Mature statistical services make save-and-return explicit and credible

Statistics Canada lets online respondents save with a password and resume later.[^9] ONS describes saved responses after every question, return up to the deadline and explicit support for desktop, tablet and phone.[^10] The US Census Respondent Portal supports help, instructions, secure exchange and file transfer for completing surveys.[^11]

VTC already has autosave and drafts. The service must expose that capability in the respondent's language: a visible **Saved** timestamp, a deliberate **Save and exit** action, a return location and a clear deadline. A transient “saved just now” notification alone is not a complete save-and-return model.

### Government data collection distinguishes data states before validating numbers

Official statistical collection uses collection status and data checks rather than treating a blank as zero. ONS describes electronic-questionnaire checks for totals, year-on-year changes and partially completed returns.[^12] Census AIES supports a controlled download/upload spreadsheet workflow, then sends respondents back to an online spreadsheet to review the uploaded data.[^13]

For the VTC declaration, these states must remain separate everywhere—in storage, UI, validation, review and export:

| State | Meaning | Permitted display |
|---|---|---|
| Not answered | Respondent has not made a response | `Not answered` / blank state; never `No` |
| No / none to report | An explicit negative or zero-record statement | `No` or `No records to report` |
| Not applicable | Question does not apply to this institution | `Not applicable` with reason only if needed |
| Zero | Confirmed numeric value of 0 | `0` |
| Incomplete row | A new record was started but lacks required cells | `Incomplete — 2 fields remaining` |
| Complete row | All row-level requirements and rules pass | `Complete` |

### Error recovery is an interaction pattern, not a disabled button

GOV.UK requires an error summary whenever there is a validation error, focus on that summary, links to each faulty answer, and the same plain-language message next to the field.[^14][^15] Australia’s accessible validation pattern independently makes the same recommendation: validate on Save and continue, retain input, focus an error summary where there are multiple errors, and focus the individual invalid field where there is one.[^16] USWDS warns that disabled form controls are confusing and inaccessible unless their reason is clearly communicated.[^17]

The operational rule for VTC is: **never leave a respondent with “Suivant” disabled and no explanation**. Continue may remain enabled; on activation it either saves and moves forward or presents a short actionable error summary and moves focus to it.

### Review is a distinct phase before submission

GOV.UK says a check-answers page reduces error rates and increases confidence; very large transactions may have review at each section as well as a final review.[^18] Australia’s review-and-submit pattern uses read-only grouped summaries, Change actions that return to the relevant part, and a clearly separate Submit action.[^19]

Exporting a PDF is useful, but it is not submission. A button labelled “Submit my questionnaire” should not first perform a differently labelled preview action. The service should present **Review declaration** before final submission, then a final **Submit annual declaration** confirmation step, followed by an official receipt.

### Responsive behaviour changes the interaction model, not only the width

USWDS says a table with more than two columns should use either a scrollable or stacked small-screen variant, minimise columns, include headers and use correct table semantics.[^20] It further requires a scrollable table region to be keyboard focusable.[^20] Government form guidance favours simple vertical form layouts because they are easier to scan, especially with low vision and magnification.[^17]

Therefore a desktop spreadsheet cannot simply be compressed into a phone viewport. Mobile must use row cards or a row editor with one labelled field per line. Horizontal scrolling is appropriate only for a bounded, clearly labelled numeric grid and never as the sole path for entering an extended multi-column roster.

### Accessibility is a product requirement

WCAG 2.2 requires descriptive text for identified errors and labels/instructions for inputs; it includes minimum pointer target size, visible focus and error-prevention requirements for data submissions.[^21][^22][^23] The Canadian Government design system sets the practical expectation: visible focus, keyboard operation, labels/instructions, actionable errors, colour plus non-colour cues, responsive components and assistive-technology testing.[^24] USWDS requires fieldsets and legends for related controls, visual alignment of validation with fields, source-order consistency and a visible indication of required/optional state.[^17]

## Current VTC gap analysis

| UX area | Current VTC portal | Mature government pattern | Gap | Recommendation | Priority |
|---|---|---|---|---|---|
| Declaration architecture | Nine-section wizard with a permanent sidebar and internal block sequencer. | Declaration-level task list with meaningful status and resumable tasks. | The section list acts as navigation, not as the respondent’s work plan. | Make the task list the declaration home; enter and leave sections from it. | Critical |
| Desktop/mobile shell | Wizard always uses a horizontal row with a fixed-width sidebar and generous content padding. | Layout changes by breakpoint; mobile starts with a compact header and task-list entry point. | The shell does not have a narrow-layout branch. | Remove permanent sidebar below desktop breakpoint; use task-list route/drawer and compact progress header. | Critical |
| Progress | Sidebar percentage counts filled non-table fields; its bar uses completed sections. Table fields are excluded from the percentage. | One authoritative, comprehensible completion model. | Number, bar and actual validity can disagree. | Use task statuses plus exact remaining work; do not show a percentage unless it includes every required response reliably. | Critical |
| Table validity | A reported table is valid when any qualifying numeric value exists; it does not establish complete rows or complete required cells. | Table, row and cross-field rules are explicit; partial rows are identified. | Statistical completeness can be overstated. | Add table/row validation contracts and distinct statuses for blank, partial, complete, none-to-report and not-applicable. | Critical |
| Guided Boolean state | The guided toggle renders `null` and `false` identically as “NON”. | A binary response is deliberate; unanswered remains visibly unanswered. | `null != false` is lost in the interaction. | Use labelled radio buttons or a three-state explicit control; require Yes/No only where required. | Critical |
| Missing vs zero | Guided summaries and totals commonly substitute missing numeric cells with `0`. | Missing data and zero remain distinct in UI and export. | Data-quality meaning is lost in summaries. | Display `Not provided` for missing values; total only values permitted by the table rule; preserve entered zero. | Critical |
| Guided row entry | Add actions can permit partial data; some no-op when a mandatory label is blank. A “filled” row may be any populated cell. | Save/add is valid only when minimum row requirements pass, with direct feedback. | Respondents can believe a row was captured when it was not complete. | Use a draft-row state, inline errors and “Save row” only when valid; retain draft data. | Critical |
| Spreadsheet mode | Natural-width grid falls back to horizontal scrolling, without frozen context columns or a visible scroll instruction. | Bounded scrollable data grids, sticky header/identifier context, or cards on small screens. | Roster and multi-column work can be misaligned or unreadable. | Freeze row label/header on supported desktop grid; show scroll cue; use row cards on phone/tablet. | High |
| Navigation | Sidebar allows direct jumps to later sections; internal blocks can collapse/hide context; automatic advance occurs when a block becomes complete. | Controlled task navigation plus predictable user-initiated progression. | Easy to lose orientation; automatic change can surprise. | Permit task-list jumps but label incomplete work; make section Continue explicit and remove auto-advance except after tested low-risk microtasks. | High |
| Blocked progress | Internal Continue is disabled if a block is incomplete. | Submit/continue attempt triggers clear recovery guidance; controls are not silently disabled. | Dead-end state, including for keyboard and screen-reader users. | Keep Continue actionable; show number of missing items, summary links and field errors. | High |
| Requiredness | Standard wizard labels do not visibly identify required fields. | Declare required/optional convention and apply it to labels/legends. | Respondent cannot prepare or understand why a field blocks completion. | Use a single bilingual convention, for example “(obligatoire)” / “(required)” for required fields or explicitly mark optional fields consistently. | High |
| Form content | Little contextual help is attached to reporting concepts, source records, dates or units. | Short hint explains purpose, source and format at point of need. | Institutional terminology may require offline interpretation or support contact. | Add field/table-level hints: reporting period, unit, source record, definition and how to report none. | High |
| Save model | Three-second autosave and a transient saved toast; drafts are available. | Explicit Saved status/time, Save and exit and predictable resume. | The durable save state and route back are not clear enough. | Show “Saved at 14:32”; include Save and exit; resume at last unfinished task; warn only on an unsaved failure. | High |
| Review/submission | “Export PDF” and “Submit my questionnaire” both enter PDF preview; final submission is hidden in the viewer. | Review, confirmation and submission have different labels and consequences. | The primary action does not do what its label says. | Rename current action “Review declaration”; put final submit after declaration/review acknowledgement; show receipt. | High |
| Review detail | Validation view has a nine-section status grid, but not a structured answer summary with targeted Change actions. | Review uses grouped answer summaries and accessible Change links. | It is difficult to verify collected values, including table statuses. | Provide review by task with summary values, table totals/status and “Change [section]” links. | High |
| Accessibility semantics | Spreadsheet fields and custom interactive controls do not provide a clear cell-level accessible name; custom toggle uses gesture treatment. | Semantic form controls, group legends, table header relationships, named buttons and announced state changes. | Screen-reader and keyboard context is incomplete. | Build semantic labels such as “Doctorat/PhD — Hommes”; use native radio/checkbox semantics or equivalent; add captions/header associations. | High |
| Visual hierarchy | Cards, pills, dense borders and a left rail compete with data-entry content. | Conservative public-service hierarchy: one heading, short explanation, form stack, sparse status colour. | The experience reads more like an app dashboard than a formal declaration. | Use a restrained service shell, single-column question stack and status colour only for status. | Medium |
| Mode selection | Guided/Tableur selection resets when a section widget is recreated. | Users retain chosen working method within a return. | Repeated mode switching wastes time. | Persist preference per declaration/device; recommend mode based on table shape and screen size. | Medium |
| Submission receipt | The flow submits/queues after PDF confirmation, but the reportable receipt model is not the dominant end state. | Confirmation page states success, reference, time, declaration period and next steps. | Respondent confidence and audit trail are weaker than they should be. | Add a durable confirmation/receipt view and downloadable acknowledgement; distinguish queued from received. | Medium |

## Recommended information architecture

### Proposed respondent journey

```text
Declaration home
  ├─ annual census purpose, deadline, privacy, help and preparation checklist
  ├─ status: draft / submitted / deadline / saved time
  └─ task list
       ├─ Institution and respondent details
       ├─ Learners and enrolment
       ├─ Training offer and curriculum
       ├─ Facilities and equipment
       ├─ Employment/insertion and follow-up
       ├─ Partnerships and governance
       ├─ Staff and trainers
       ├─ Declaration and attestations
       └─ Review and submit

Task workspace
  ├─ section heading, purpose, estimated preparation/source records
  ├─ focused question groups or a table workspace
  ├─ Back to task list / Save and exit / Save and continue
  └─ section review when task is complete

Review declaration
  ├─ outstanding errors / incomplete tasks
  ├─ grouped answers and table summaries
  └─ Change links

Submit declaration
  ├─ final declaration/attestation
  ├─ submit action
  └─ official confirmation receipt
```

### Task-list rules

Each task must expose one status, based on the same validation engine that protects submission:

| Status | Meaning | Action label |
|---|---|---|
| Not started | No relevant answer or explicit table disposition | Start |
| In progress | Some valid data, but required answers/rows remain | Continue |
| Needs attention | Saved data fails a rule or changed answer invalidated a dependency | Fix issue |
| Complete | All required current conditions pass | Review or Change |
| Not applicable | Explicitly declared out of scope, where policy permits | Review |

Use a sentence such as “6 of 9 sections complete; 2 need attention; 1 not started.” It is materially more useful than “Completed 10%.” A percentage may be added only if its numerator is all completed required fields/rows and its denominator is stable under conditional logic; otherwise it invites false precision.

## Recommended navigation model

### Decision

Adopt **Option D: hybrid task list plus focused section navigation**.

| Option | Assessment for VTC |
|---|---|
| A. Permanent desktop sidebar | Useful as a supplementary desktop orientation control, but poor as the primary model and unsuitable on phone. |
| B. Task list only | Strong declaration-level orientation, but too coarse for large table and multi-question tasks. |
| C. Pure step-by-step wizard | Good for focused question entry, but fragile for long pauses, delegation and return-to-fix work. |
| D. Hybrid task list + section navigation | **Recommended.** Combines clear work planning with focused entry and direct correction. |
| E. Spreadsheet-only | Efficient for specialist bulk reporting but excludes mobile, novice and assistive-technology users. |

### Behaviour by device

| Viewport | Navigation and entry behaviour |
|---|---|
| 360px phone | Compact government header; “Task list” link; no permanent rail. One column. Bottom action area contains Back, Save and continue. Tables are row cards/editor. |
| 390px phone | Same as 360px, with full-width action buttons and no paired fields unless the data pair is extremely short and tested. |
| 768px tablet | Task-list drawer or top-level route; one-column form stack; two-column layout only for strongly related short numeric pairs. Guided rows/cards remain default. |
| Desktop | Task list may remain visible as a secondary rail when there is enough space. Section workspace is constrained for prose/forms; data grid gets a wider dedicated workspace. |

There should always be a visible Back link at the top of a task, as well as Back and Save/Continue actions at the end. Browser back should preserve entered state. Direct access to an incomplete task is allowed; it should never falsely show as complete.

## Recommended form design

### Question and field rules

- Begin each task with a plain-language title and a short “What you need” line: the source document, reporting period, unit and estimate of effort where defensible.
- Use one clear question or tightly related group at a time. Do not show internal paper codes as the primary label.
- Use vertical layout by default. Put two short fields side-by-side only when users understand them as one concept, such as Hommes/Femmes counts.
- Mark requiredness consistently in the active language. Avoid relying on colour or an asterisk alone. Explain the convention once near the start.
- Mark genuine optional questions as “(optional)” / “(facultatif)”; do not make respondents infer this from absence of a marker.
- Add short hint text under labels for definitions, units and source records. Put long definitions behind a labelled “Help with this question” disclosure, not in a tooltip that fails on touch.
- Use radio buttons—not an on/off switch—when respondents must choose between mutually exclusive Yes and No answers. Show a third response only where policy recognises it, for example “I do not know” or “Not applicable.”
- Preserve existing entered values when conditions change, but clearly say when a dependent answer is no longer included in the declaration.
- Do not auto-advance on a completed group. Completion feedback is useful; movement should remain respondent initiated.

### Numeric input rules

- Make the unit explicit in the label or adjacent text: “Number of trainees (whole number).”
- Treat an empty field as empty, never zero. Permit literal `0` where it is meaningful.
- Use a number keyboard on mobile, permit safe paste, and avoid spinner controls as the only efficient path for large counts.
- Validate numeric range, integer/decimal policy, arithmetic reconciliation and meaningful cross-field relationships at Continue/Save row. Avoid scolding errors while a number is being typed.

## Recommended table strategy

### Entry modes

Keep both Guided and Spreadsheet modes, but make their purpose distinct.

| Context | Default | Alternative | Design requirements |
|---|---|---|---|
| Small fixed matrix, e.g. diploma by sex | Guided fixed-row entry | Desktop grid | Display each category, two labelled values and computed total; incomplete status per category. |
| Repeating specialist/programme record | Guided row entry | Desktop grid if 8+ records expected | Draft row with field-level validation; saved-row summary with Edit/Delete. |
| Named trainer roster | Guided row cards | Keyboard-first desktop spreadsheet; controlled file import for high-volume cases | Require complete identity/required classifications before a row is complete. |
| Large multi-column administrative extract | Download/upload template plus online review | Spreadsheet workspace | Offer import only with a versioned template, column rules, preflight errors and row-by-row review, as in Census AIES.[^13] |
| Phone | Row cards/editor only | None for a wide grid | One row at a time, explicit Save row, list of row statuses. |

Guided mode should be the default whenever accuracy, explanation and intermittent completion matter more than speed. Spreadsheet mode should appear as **Fast desktop entry** and be offered when the table is structurally suitable and the respondent has a wide viewport and likely keyboard. It must not be framed as the “advanced” or “correct” way to report.

### Table workspace requirements

1. State the table purpose, reporting period, unit and what “none to report” means above the table.
2. Ask first: **Do you have records to report for this table?** Present explicit options: `Yes, enter records`; `No records to report`; `Not applicable` only if legitimate. This is a table-level response, not an empty grid.
3. Maintain every row as `Not started`, `Draft/incomplete`, `Complete` or `Removed`. A partial row must never increase the completed-row count.
4. Guided Save row validates required cells, explains remaining errors and retains entered values. It cannot silently discard or no-op.
5. Show computed totals as read-only reconciliation information, but label whether a total excludes incomplete rows. If totals must reconcile, state the required relationship and explain any mismatch.
6. Grid mode uses short column labels, a caption, frozen header and identifying column where practical, keyboard navigation, visible focus and horizontal-scroll affordance. Keep column count down; use a detail editor for rare fields rather than a 12-column grid.
7. Mobile presents a row card whose heading is the identifying value/category, followed by labelled values—not a shrunken grid.
8. Review shows table disposition, counts of complete/incomplete rows and values/totals. It must show `No records to report` and `Not applicable` as explicit answers.

## Recommended validation and error model

### When validation happens

- Validate individual formats while editing only when a helpful, stable response is possible; do not interrupt typing.
- Validate requiredness, row completeness and cross-field rules on **Save row**, **Save and continue**, **Review section** and **Submit declaration**.
- Run the same rules in client and server layers. Client rules improve recovery; server rules protect data integrity.

### What happens when validation fails

1. Retain every entered value.
2. Put an error summary after the page/section heading: “There is a problem. Correct 3 answers to continue.”
3. Move keyboard focus to the summary; each item identifies the task/row/field and links to it.
4. Mark the relevant field/group with the same specific text error and non-colour visual treatment.
5. Scroll to the destination while preserving enough label/legend context above the focused input.
6. Keep the primary action enabled for a retry. Do not communicate unmet requirements only by disabled state.

Examples:

- “Enter the number of female trainees for Licence, or enter 0.”
- “Complete the trainer’s status before saving this trainer.”
- “The total number of rooms must equal or exceed the rooms in good and poor condition combined.”
- “Choose whether there are records to report for this table.”

## Save, review and submission model

### Saving

Autosave can remain, but must be observable and recoverable.

- Header status: `Saving…`, `Saved at 14:32`, or `Could not save — retry`.
- Every task action includes `Save and continue`; add a clear `Save and exit` action.
- Returning to a draft lands on the first incomplete or attention-needed task, with a calm message such as “Your draft was saved on 11 September at 14:32.”
- Do not call an offline queued submission “submitted.” State `Submission queued — we will confirm once it is received` and retain a receipt/status route.

### Review and submission

1. **Review declaration** task appears only when every mandatory task has a valid disposition.
2. It lists every task, its outcome and a specific Change link. Tables show response status, complete-record count, incomplete-record count and critical totals.
3. The respondent reads the declaration/attestation and confirms it deliberately.
4. **Submit annual declaration** is the only control that sends the declaration.
5. PDF download is an optional “Download review copy,” never a disguised submit action.
6. Confirmation gives a receipt/reference, institution, reporting period, received time, submitted-by identity, downloadable confirmation and next steps/help.

## Accessibility minimum requirements

- Target WCAG 2.2 AA and test at 200% zoom, keyboard-only, screen reader and 360px viewport.
- Use real labels associated with text fields. Group radio/checkbox sets in semantic fieldsets with legends.
- Use native radio/checkbox semantics or custom controls with complete name, role, value, keyboard operation and announced changes.
- Every spreadsheet cell has an accessible name combining table caption, row header, column header, unit and state; headers are programmatically associated with cells.
- Provide a visible, high-contrast focus indicator that is not obscured by sticky content. Meet at least the WCAG 2.2 24px minimum target size; aim for 44px for primary touch actions.[^21]
- Required, error, complete and warning states use text/icon/state in addition to colour.
- Error summaries have programmatic focus and links that land on the correct field with enough visible context.
- Do not rely on a swipe-only table. Horizontal-scroll regions must be keyboard focusable; provide a card/editor alternative.
- Screen-reader text for Edit/Delete must identify the record: “Edit trainer Marie Ndzi” rather than only “Edit.”
- Test bilingual content, French accents, long translations and user-entered names; do not use brittle character restrictions for ordinary names.

## Visual design direction

The portal should look formal, calm and operational rather than decorative. It should be recognisably national-government service quality without copying GOV.UK or USWDS branding.

- **Typography:** one highly legible sans serif, robust size scale, 16px or larger body text, strong but restrained headings. Use tabular numerals for dense financial/count columns.
- **Layout:** a readable constrained width for questions/review; a dedicated wider table workspace when needed. Default to a single vertical form column.
- **Spacing:** regular vertical rhythm between question groups; more space between tasks. Avoid dense stacks of bordered cards for normal questions.
- **Colour:** institutional primary colour for identity and primary action; neutral surfaces; green only for a confirmed complete/success state; red only for actionable errors; amber for warnings. Never encode status in colour alone.
- **Components:** visible labels, short hints, standard radios/checkboxes, buttons with action verbs, unobtrusive dividers and simple status tags. Avoid decorative toggles for required binary answers.
- **Terminology:** prefer action and state language: `Start`, `Continue`, `Save and exit`, `Fix issue`, `Review declaration`, `Submit annual declaration`, `Download receipt`. Avoid ambiguous `Suivant` when the actual outcome is validation, saving or submission.

## Implementation roadmap

### Critical — protect respondent comprehension and statistical integrity

1. Establish and enforce the six data states: unanswered, no/none, not applicable, zero, incomplete row, complete row.
2. Correct guided Boolean interaction so unanswered is not displayed or stored as No.
3. Replace table “any value” validity with table-level disposition, row-completeness and cell/cross-row validation rules.
4. Stop summaries/totals from converting missing values to zero.
5. Remove the mobile-breaking permanent wizard shell below the desktop breakpoint; provide card/row entry instead of wide grids.
6. Replace silent/disabled progression with accessible error recovery.

### High — make the declaration predictable and finishable

1. Introduce declaration home/task list and truthful task statuses.
2. Replace incompatible progress measures with one authoritative status model.
3. Add visible required/optional convention, table definitions and point-of-need hints.
4. Make save state, Save and exit and draft resume explicit.
5. Separate Review declaration, PDF download, final submit and confirmation receipt.
6. Add accessible semantic form/table controls, error summary focus and keyboard tests.
7. Make Guided/Fast desktop entry a persistent, intentional table choice.

### Medium — improve efficiency and confidence

1. Add sticky/frozen context and scroll cues to viable desktop grids.
2. Add complete/incomplete record counters and reconciliation summaries.
3. Provide official spreadsheet template download/upload only for true high-volume data sources, with preflight/import review.
4. Add section review points for tasks likely to be delegated or source-record intensive.
5. Add confirmation receipt retrieval and clear queued-offline status.

### Polish — reinforce government-service quality

1. Simplify card/pill visual density and standardise button labels.
2. Refine bilingual microcopy, including table-specific help and errors.
3. Add preparation checklist, deadline visibility and contextual support contact.
4. Instrument abandonment, validation failures, time per task, return rate and support contacts; use findings to prioritise iteration.

## Decisions to validate with respondents before implementation

The recommendations are strong patterns, but the exact section grouping and table defaults should be tested with VTC respondents and the officers who review the declaration.

1. Ask 5–8 centres of different size to complete representative tasks from paper/source records on desktop and 390px phone.
2. Test whether staff work alone or hand off tasks; if hand-off is common, add task-level ownership/activity details rather than forcing a linear wizard.
3. Test the exact French terminology for `No records to report`, `Not applicable`, `Not answered`, `Draft row` and `Complete row`.
4. Test diploma, facilities and trainer-roster tables with real but anonymised records; measure wrong-column errors, incomplete rows and correction time.
5. Test keyboard-only and screen-reader completion of a required Yes/No question, a conditional follow-up, an incomplete table row and final review.
6. Test the proposed task list without a percentage first. Add numerical progress only if respondents use it correctly and it can remain truthful under conditional questions.

## Sources

[^1]: GOV.UK Design System. “[Navigate a service](https://design-system.service.gov.uk/patterns/navigate-a-service/).” Accessed September 2026.
[^2]: GOV.UK Design System. “[Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/).” Accessed September 2026.
[^3]: U.S. Web Design System. “[Complete a complex form: progress easily](https://designsystem.digital.gov/patterns/complete-a-complex-form/progress-easily/).” Accessed September 2026.
[^4]: Statistics Canada. “[General Social Survey – Well-being and Unpaid Care](https://www.statcan.gc.ca/en/survey/household/4502).” 2026.
[^5]: Australian Government Department of Agriculture, Fisheries and Forestry. “[Review and submit pattern](https://design-system.agriculture.gov.au/patterns/review-and-submit).” Accessed September 2026.
[^6]: Australian Government Department of Agriculture, Fisheries and Forestry. “[Templates](https://design-system.agriculture.gov.au/templates).” Accessed September 2026.
[^7]: GOV.UK Design System. “[Question pages](https://design-system.service.gov.uk/patterns/question-pages/).” Accessed September 2026.
[^8]: U.S. Web Design System. “[Complete a complex form: establish trust](https://designsystem.digital.gov/patterns/complete-a-complex-form/establish-trust/).” Accessed September 2026.
[^9]: Statistics Canada. “[General Social Survey – Well-being and Unpaid Care](https://www.statcan.gc.ca/en/survey/household/4502).” 2026.
[^10]: Office for National Statistics. “[Lifestyle](https://www.ons.gov.uk/surveys/informationforhouseholdsandindividuals/householdandindividualsurveys/opinionsandlifestylesurvey).” Accessed September 2026.
[^11]: U.S. Census Bureau. “[respond.census.gov](https://respond.census.gov/).” Accessed September 2026.
[^12]: Office for National Statistics. “[Business enterprise research and development QMI](https://www.ons.gov.uk/businessindustryandtrade/business/businessinnovation/methodologies/businessenterpriseresearchanddevelopmentqmi).” 2026.
[^13]: U.S. Census Bureau. “[AIES: Verify locations download/upload spreadsheet screen](https://www2.census.gov/programs-surveys/aies/technical-documentation/how-to/step1-verify-locations.pdf).” 2025; and “[detailed data download/upload spreadsheet screen](https://www2.census.gov/programs-surveys/aies/technical-documentation/how-to/step3-detailed-data-download-spreadsheet.pdf).” 2025.
[^14]: GOV.UK Design System. “[Recover from validation errors](https://design-system.service.gov.uk/patterns/validation/).” Accessed September 2026.
[^15]: GOV.UK Design System. “[Error summary](https://design-system.service.gov.uk/components/error-summary/).” Accessed September 2026.
[^16]: Australian Government Department of Agriculture, Fisheries and Forestry. “[Accessible form validation and error recovery](https://design-system.agriculture.gov.au/patterns/accessible-form-validation-and-recovery).” Accessed September 2026.
[^17]: U.S. Web Design System. “[Form](https://designsystem.digital.gov/components/form/).” Accessed September 2026.
[^18]: GOV.UK Design System. “[Check answers](https://design-system.service.gov.uk/patterns/check-answers/).” Accessed September 2026.
[^19]: Australian Government Department of Agriculture, Fisheries and Forestry. “[Review and submit](https://design-system.agriculture.gov.au/patterns/review-and-submit).” Accessed September 2026.
[^20]: U.S. Web Design System. “[Table](https://designsystem.digital.gov/components/table/).” Accessed September 2026.
[^21]: World Wide Web Consortium. “[Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/).” 5 October 2023.
[^22]: W3C Web Accessibility Initiative. “[Understanding Success Criterion 3.3.1: Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification).” Accessed September 2026.
[^23]: W3C Web Accessibility Initiative. “[Understanding Success Criterion 3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html).” Accessed September 2026.
[^24]: Government of Canada. “[Accessibility in GC Design System](https://design-system.canada.ca/en/accessibility/).” Accessed September 2026.
