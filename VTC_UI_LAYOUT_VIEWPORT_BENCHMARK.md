# VTC UI Layout, Viewport and Form-Control Benchmark

## UI decision

The VTC portal should use a **responsive document-style form workspace**, not a fixed-height application canvas. A declaration is long by nature. The correct design is to let the content scroll vertically, maintain a compact and predictable service frame, and keep only essential actions visible without covering the active field.

The strongest current visual ingredients are worth retaining: the institutional header, a visible current section, restrained green success states, compact input borders, a readable single-column mobile stack, and a guided/tableur *view preference*. The main controls to replace or materially redesign are the Yes/No switches, dense bilingual label construction, duplicate completion signals, permanent small-screen rail, and wide table behaviour.

This benchmark is intentionally about interface mechanics and layout. It does not propose implementation changes.

## Visual findings from the supplied VTC screens

### What is already working

| Current treatment | Assessment | Keep / adapt |
|---|---|---|
| Institutional masthead and clear service name | Builds trust and tells the respondent which official return they are completing. | Keep, but make it shorter on small screens and show one primary service identity. |
| Desktop left rail with named sections and completion marks | Gives desktop users a useful map of a long declaration. | Retain only at wide desktop sizes, as a secondary navigation aid rather than the sole progress mechanism. |
| Mobile single-column field stack | The phone screen puts labels above fields and avoids side-by-side inputs. This is the correct direction. | Keep as the mobile baseline. |
| Section number plus plain-language title | Gives respondents both reference and context. | Keep; make the official code visually secondary to the human-readable title. |
| Modest input border and visible focus state | Inputs are recognisable without excessive decoration. | Keep, but standardise focus contrast and error presentation. |
| Green completed marks and saved state | Success is visible and generally calm. | Keep green exclusively for genuine saved/complete states; always add text, not colour alone. |
| Guided / Tableur selector | A view-setting can be useful when it selects an interaction method, not an answer. | Retain as a labelled segmented control on suitable screens; preserve the chosen mode. |

### UI treatments that currently create friction

| Treatment | Why it is weak | UI decision |
|---|---|---|
| `OUI` pill switches for required Yes/No facts | A switch is normally a setting with immediate on/off effect. It makes unselected, No and sometimes false-like states visually ambiguous, especially without a clear second option. | Replace with a labelled Yes/No radio group. Use a third explicit option only when policy allows it. |
| Bilingual text inside nearly every desktop label | Example: a French label followed by an English parenthetical creates long scan lines, uneven columns and visual noise. | Render the active locale only. Provide language switching at service level; use bilingual terminology only in a glossary or where legally required. |
| Section percentage, section checkmarks, block progress bars and row counts together | Several competing progress metaphors make it hard to understand the actual state. | Use one declaration-level task status model plus one current-task statement. Table counts belong inside the table only. |
| Full-height desktop rail assumed to fit the viewport | At shorter desktop heights, rail content and its completion footer compete for space. | Let the rail scroll independently on desktop; avoid fixed footer overlap; collapse it before tablet. |
| Large nested cards around every group, record and choice | Nested outlines weaken hierarchy and make ordinary questions look equally important. | Use one main section surface; use headings and whitespace to group standard questions. Reserve cards for a table, status message or repeating record. |
| Wide desktop grid rendered by horizontal scrolling alone | A respondent loses row/column context, particularly in roster-like tables. | Use a dedicated wide-grid workspace with frozen identifying context; never use this as the normal phone interaction. |
| Bottom navigation treated as ordinary end-of-page content | Long tables make respondents scroll a long distance to Save/continue. | Use a responsive sticky action bar with reserved page-bottom space; it must move above the virtual keyboard and never obscure errors/fields. |
| Disabled Continue as the primary validation signal | A disabled button gives no reason, is difficult for keyboard users to discover, and looks like a system fault. | Keep the action enabled; explain and focus errors after activation. |

## Benchmark principles for a government declaration UI

Official public-service patterns consistently favour visible labels, grouped controls, vertical form stacks, clear choice semantics, accessible focus and descriptive error recovery.[^1][^2][^3]

1. **Choose controls by data meaning, not visual fashion.** Radio buttons mean one choice; checkboxes mean multiple independent choices; a switch is for an immediate on/off setting; a segmented control is suitable for choosing an interface view.
2. **Default to vertical flow.** Long forms are documents. Vertical scrolling is expected and safer than squeezing or paginating every visible question.
3. **Use width breakpoints for reflow; use height only to protect actions and focus.** A 390px phone can be 640px or 900px tall; the form hierarchy should not change because of that difference.
4. **Labels sit close above text/select fields and beside radio/checkbox controls.** They must remain visible and associated with their inputs.[^4]
5. **Use whitespace and headings before containers.** A card must communicate a meaningful boundary, not merely provide decoration.
6. **Do not use colour as the only state signal.** Every complete, error, required or selected status requires clear text and a non-colour cue.
7. **Preserve a visible current location.** A task name, section name and current group statement are more useful than a dense universal stepper.

## Viewport policy

### The rule for short and tall screens

**Do not force a declaration to fit the viewport.** The page body should vertically scroll in every form-heavy state. Only these elements may be fixed or sticky:

- compact service header;
- a compact current-location/progress strip;
- the primary action area when it is not covered by the keyboard;
- desktop table header/identifier columns, only inside a dedicated grid.

When an action bar is sticky, the scrollable content needs bottom padding at least equal to its height plus the safe-area inset. On focus or error jump, the target label, help and control must be visible above the sticky bar—not only the control itself. This is particularly important at 200% zoom and with the virtual keyboard open. WCAG 2.2 adds requirements around focus not being obscured and minimum target size.[^5]

### Recommended layout matrix

| Viewport | Shell | Form layout | Navigation | Tables | Actions | Height-specific behaviour |
|---|---|---|---|---|---|---|
| 320–359px width | 56px compact header; no persistent side rail | One field per row, 16px page gutter, no two-column layout | `Task list` link opens a full-screen list | Row cards only | Full-width bottom actions stacked: Save and continue, Save and exit | Scroll body; when keyboard is open, action bar moves above it or collapses to one action. |
| 360–479px width | Same compact shell | Single column; related number pair may be two columns only if each remains at least 140px wide | Current section + task-list control | Row cards/editor; no spreadsheet grid | Full-width primary; secondary action is text/outlined below | No requirement that a whole question group fit. Long option groups scroll naturally. |
| 480–767px width | Compact header with task-list drawer | One main column, max readable width; pairs can sit side-by-side | Drawer only when invoked | Cards; optionally a small fixed matrix if all headers/cells remain visible | Inline actions can sit in a row only when they remain 44px high and do not wrap ambiguously | Landscape phones still use mobile navigation; do not promote a rail solely because the screen is wide. |
| 768–1023px width | Tablet header; task-list drawer or collapsible left panel | One main column; two columns only for short related fields | Collapsible task panel | Guided cards default; dedicated grid only when tested with an external keyboard | Sticky action row: Back, Save and continue, Save and exit | Treat a short tablet viewport like a scrollable document; do not rely on a fixed panel fitting vertically. |
| 1024–1279px width | Optional compact 240px rail | Main form column 680–800px | Rail may be collapsed/expanded | Wide tables get their own full-width work area | Back left; primary Save and continue right | Rail and main content scroll separately if needed. |
| 1280px and wider | Full institutional header and 280px contextual rail | Normal form content constrained to 760–880px; table workspace may extend to 1200px | Persistent rail is acceptable | Guided default; Fast desktop grid available for suitable high-volume tables | Sticky action bar aligned to form/table workspace, not the full browser width | A short 768px-tall desktop still scrolls; never fix both header, rail footer and action bar without reserved space. |

### Layout dimensions to standardise

These are design targets to test, not a substitute for accessibility testing.

| Element | Phone | Tablet/Desktop |
|---|---:|---:|
| Page gutter | 16px | 24–40px |
| Form maximum width | Full available width | 760–880px |
| Table workspace maximum width | Full available width | 1,120–1,200px |
| Standard field height | 48px minimum | 48px minimum |
| Primary action height | 48px minimum | 48px minimum |
| Small interactive target | 24px absolute minimum; 44px preferred | 24px absolute minimum; 44px preferred |
| Gap: label to control | 6–8px | 6–8px |
| Gap: question groups | 24–32px | 24–32px |
| Sticky action bar body offset | action height + safe area + 16px | action height + 24px |

## Page and card hierarchy

### Recommended section workspace

```text
Service header
Current declaration / saved status / task-list control

Section number and human title
One-sentence purpose or preparation note

Optional: “Section 5 of 9 · 2 required groups remaining”

Question group heading
Short hint when it changes how a respondent answers
Controls

Question group heading
Controls

Sticky action area
Back | Save and exit | Save and continue
```

Use a single neutral page background and one main content surface only where it adds legibility. Standard simple fields need no enclosing card. Use a bordered surface for:

- a repeated record editor;
- a numeric matrix/table;
- an error summary or warning;
- a legal declaration/attestation;
- an imported-file status and error list.

### Cards: when they help and when they harm

| Use a card | Do not use a card |
|---|---|
| A repeating trainer record, because it has an identity, summary and actions. | Each ordinary text input or radio group. |
| A table workspace with its table-level status and instructions. | A group whose only boundary is a short heading. |
| A “No records to report” or warning state that changes respondent action. | Every option in a five-option radio group. |
| A review summary for one task. | Nested cards inside a card with no added meaning. |

## Labels, hints and text juxtaposition

### Label placement

| Control | Visible arrangement | Why |
|---|---|---|
| Text, number, select, textarea | Label directly above; hint directly below label; error directly below hint | Keeps label, instructions and input in the same magnified viewport. |
| Radio group | Question/legend above; options vertical with the radio left of label | Makes the question and single-choice rule explicit. |
| Checkbox group | Question/legend above; “Select all that apply” hint when needed; options vertical | Prevents respondents treating a multi-select as a one-choice question. |
| Single acknowledgement checkbox | Checkbox left of positive sentence | The sentence tells the user what checking means. |
| Table cell | Visual column header plus row header; accessible name combines both | Preserves context in dense input. |
| Button | Verb + object: `Save and continue`, `Add trainer`, `Review declaration` | Reduces ambiguity and supports speech/assistive interaction. |

Visible labels should not be replaced by placeholder text. Placeholders disappear once typing begins and do not reliably explain a field. W3C recommends labels that are associated with controls and notes that labels above text fields reduce horizontal scrolling for mobile and magnified users.[^4]

### Bilingual layout

The screens currently show long French labels with English parenthetical text in the same line. This increases width pressure and makes labels difficult to scan, particularly in a two-column desktop form.

Adopt one active interface language per session:

- Show `Nom du CFP` in French mode and `Name of VTC` in English mode.
- Keep legal bilingual content only where required; put the second language below in a clearly separated legal notice, not inside every control label.
- Keep paper/question codes small and secondary: `1.2` before the label is enough. Do not make the code compete with the question.
- If a technical term needs explanation, use a short hint: `Use the name shown on your accreditation certificate.`

### Required and optional state

Choose one service-wide convention and state it at the first task. For a mixed mandatory/optional declaration, the clearest is explicit text:

- `Nom du CFP (obligatoire)` / `Name of VTC (required)`
- `Commentaire (facultatif)` / `Comment (optional)`

The text must remain in the accessible name; an asterisk can supplement it but cannot be the only cue. Requiredness and error state must not rely only on a green/red border.

## Control benchmark: retain, replace or restrict

### Yes/No and other single-choice questions

| Current/UI candidate | Appropriate use | Decision for VTC |
|---|---|---|
| Standard radio buttons | One mutually exclusive data response: Yes/No, institution type, rural/urban | **Default.** Clearly show both choices; no preselection. |
| Two-button segmented control | Low-risk view/filter preference, e.g. Guided / Fast desktop entry | **Allowed for UI preference only.** Must expose selected state and have a visible label. |
| Toggle/switch | Immediate, reversible setting such as enabling table display options | **Do not use for required statistical facts.** A switch implies an instant setting and masks an unanswered state. |
| Dropdown | Long single-select taxonomy, normally more than 6–8 options or searchable list | Use only where the list is genuinely long. Do not hide a 2–5 option policy choice in a dropdown. |

GOV.UK specifically recommends radio controls for one choice and warns against preselecting them; it also advises a valid “none”/“do not know” choice where applicable.[^6] This directly supports replacing the current `OUI` switch treatment for reporting answers.

**Recommended Yes/No presentation**

```text
Do you provide study guides to trainees? (required)
Select one option.

( ) Yes
( ) No

If Yes: Number of study guides available [      ]
```

This is clearer than a green pill that says only `OUI`. It exposes the choice, supports keyboard use, does not conflate blank with No, and gives conditional inputs an unambiguous anchor.

### Checkboxes

Use checkboxes only when every selected option can coexist with the others:

- communication channels used;
- services available;
- declaration/consent acknowledgement;
- multiple specialities where multiple answers are valid.

Never use a checkbox for Yes/No or one-of-many institution types. In those cases use radios. The clickable label must be part of the hit area; all options should be vertically listed, with a group label/legend and short selection instruction where required.[^7]

### Current controls that are appropriate with refinement

| Widget pattern | UI verdict | Required refinement |
|---|---|---|
| Text input | Good default for names and identifiers | Use visible label and optional short format hint; do not use placeholder as label. |
| Numeric field | Good for counts | Show unit, permit explicit zero, maintain blank separately, use numeric keyboard. |
| Select/dropdown | Good for long controlled vocabularies | Use `Select…` placeholder, search/typeahead for long lists, avoid for short policy choices. |
| Guided/Tableur segmented selector | Good for interaction-mode preference | Label group “Entry method”; preserve selection; do not place on mobile when only Guided is viable. |
| Green completion marker | Good secondary status cue | Pair with text `Complete`; do not use it as the only progress language. |
| Edit/Delete record actions | Correct for saved repeating records | Use full labels on narrow screens; use icon plus accessible text only where row identity is included. |
| Plus/minus stepper | Acceptable convenience for small nearby counts | Keep direct typed entry; use 44px targets; do not require repeated tapping for large counts. |

## Scrolling and sticky behaviour

### Vertical scrolling: always permitted for content

Long content should scroll vertically. The following must **not** be constrained to “fit” a viewport:

- a long radio group such as VTC type;
- a table with many category rows;
- a repeating-record list;
- an error summary plus error fields;
- a review screen;
- a screen at 200% zoom;
- any form while a software keyboard is open.

Use an in-page scroll only for the page body. Avoid nested vertical scroll areas inside a section card; they cause touch and keyboard traps. A desktop rail may have its own scroll because it is separate navigation, but the form should have only one vertical scroll context.

### Horizontal scrolling: exceptional and bounded

It is acceptable only for a numerical table when all are true:

1. The table has more than two data columns and converting it to cards would harm comparison.
2. The row identifier and column headers remain available—ideally frozen on desktop.
3. A caption explains what the table contains.
4. A visible cue says `Scroll horizontally to see all columns`.
5. The region can receive keyboard focus and has a non-touch path to the hidden columns.
6. The grid has an equivalent row editor/card view on small screens.

USWDS makes the same distinction: dense numeric tables may scroll horizontally, while record-like tables are more readable as stacked rows; it also requires a focusable scrollable table region and appropriate header semantics.[^8]

### Sticky actions

Recommended action order:

| Screen | Primary | Secondary | Placement |
|---|---|---|---|
| Ordinary task | Save and continue | Save and exit; Back | Sticky bottom bar, primary right on desktop; stacked/full width on mobile. |
| Repeating-record editor | Save row | Cancel | Inside the editor; not global page footer. |
| Error state | Save and continue | Back | Same actions; error summary above content after activation. |
| Review | Submit annual declaration | Save and exit; Download review copy | Submit appears only after full review and attestation. |
| Confirmation | Download receipt | Return to declaration home | Not a sticky bar unless content is long. |

On a short screen, reduce visual height before removing the primary action: compact header first, hide nonessential header metadata second, then make the action bar one-row. Never cover the focused control with a fixed bar.

## Desktop layout benchmark

### Recommended wide-screen composition

```text
┌──────────────────────────────── official service header ────────────────────────────────┐
│ MINEFOP Collect             Annual declaration 2025–2026          Saved at 14:32         │
├──────── task rail ────────┬──────────────────── section workspace ───────────────────────┤
│ Declaration tasks          │ Section 5  Materials and facilities                          │
│ ✓ Identification           │ Tell us about the materials used during the reporting period │
│ ● Materials (in progress)  │                                                              │
│ ! Trainers (needs attention│ 5.1 Study guides                                             │
│ ○ Declaration              │ [question and choices]                                       │
│                            │                                                              │
│ 6 of 9 complete            │ 5.2 Training curricula                                       │
│                            │ [table workspace]                                            │
├────────────────────────────┴─────────────────────────────────────────────────────────────┤
│ Back                         Save and exit                         Save and continue      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- Use the rail at 1,280px+ only; cap it at approximately 280px.
- Keep normal questions within a readable 760–880px column. Do not stretch fields across an empty 1,100px-wide page merely because space exists.
- Let a data table intentionally use a wider workspace than normal questions.
- Use a two-column form only for compact, genuinely paired fields. The current identification layout is reasonable for adjacent geographic/identity fields on wide screens; it should return to one column once either label wraps or available field width drops below about 280px.
- Keep lengthy multi-option choices in one vertical column even on desktop. A wide page is not a reason to create a hard-to-track horizontal radio strip.

## Mobile and tablet layout benchmark

### Phone

```text
┌────────────────────────────────────┐
│ MINEFOP Collect         [Task list] │
│ Section 5 of 9 · Materials           │
├────────────────────────────────────┤
│ Study guides                         │
│ Do you provide study guides to       │
│ trainees? (required)                 │
│ Select one option                    │
│                                      │
│ ( ) Yes                              │
│ ( ) No                               │
│                                      │
│ Number of guides                     │
│ [                                      ] │
│                                      │
│ Training curricula                   │
│ 2 complete · 1 incomplete            │
│ [ Add curriculum ]                   │
│ [ Electricity · Complete     Edit ]  │
├────────────────────────────────────┤
│ Save and exit                        │
│ Save and continue                    │
└────────────────────────────────────┘
```

- Remove the desktop rail completely. A task-list button opens the list as a dedicated route/sheet, not a narrow squeezed overlay beside the form.
- Present only one page heading and one current-location line; do not duplicate section title in header, card and progress component.
- Buttons become full width when two actions cannot sit side-by-side with 44px targets and clear labels.
- Lists of saved rows show status in text. Tap a record to edit it; do not make tiny icon-only Edit/Delete targets the main path.
- A bottom sheet row editor must be scrollable above the keyboard and have a clear `Save row` action, not an ambiguous `Terminé` alone.

### Tablet

Tablet is not a small desktop by default. At 768px, retain the single form column and mobile table card/editor behaviour. Introduce the desktop rail only after testing the actual content at large text sizes. A task drawer is usually enough.

## UI state model

Every visible state should have a consistent visual and textual expression.

| State | Visual treatment | Text treatment | Do not do |
|---|---|---|---|
| Unanswered | Neutral input/control, no success tint | `Not answered` in review only; no label needed in an empty field | Render it as No, 0 or complete. |
| Selected | Native control selected plus visible focus/selection styling | Selected option label remains visible | Indicate selection only by green fill. |
| Complete | Green icon/tag plus neutral row surface | `Complete` / `Completed` | Show a checkmark with no label. |
| In progress | Neutral/blue-grey status, optional count | `2 required answers remaining` | A percentage that ignores tables. |
| Needs attention | Error border/tag plus error summary link | `Fix 2 answers` | Disable navigation with no reason. |
| No records | Explicit neutral response tile or review row | `No records to report` | Leave an empty table and infer the answer. |
| Not applicable | Explicit neutral response tile | `Not applicable` | Treat as a zero or missing value. |
| Saved | Small persistent status in header | `Saved at 14:32` | Rely only on a disappearing toast. |

## UI acceptance criteria

Before implementation is approved, prototype and test these statements.

1. At 360px and 390px, no horizontal page scroll occurs in ordinary form tasks.
2. At 200% zoom, labels, errors and focused controls remain visible and usable.
3. A respondent can identify every input’s label, required/optional state and unit without relying on placeholder text.
4. A respondent can answer Yes/No without mistaking an unanswered question for No.
5. A respondent can enter `0`, leave a value unanswered, say `No records to report`, and say `Not applicable`; each appears differently in review.
6. A partially completed row visibly remains incomplete and cannot be counted as complete.
7. A short-height desktop and an on-screen keyboard do not obscure the current field or primary action.
8. A wide data grid has an obvious scroll affordance, retained headers/context and a workable phone alternative.
9. Keyboard-only use reaches every control, exposes visible focus, and never becomes trapped in a row/card/table.
10. The UI exposes one authoritative declaration status rather than several contradictory percentages and bars.

## Sources

[^1]: W3C Web Accessibility Initiative. “[Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/).” Updated March 2026.
[^2]: W3C Web Accessibility Initiative. “[Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/).” Accessed September 2026.
[^3]: U.S. Web Design System. “[Form](https://designsystem.digital.gov/components/form/).” Accessed September 2026.
[^4]: W3C Web Accessibility Initiative. “[Labeling Controls: visual position and mobile fields](https://www.w3.org/WAI/tutorials/forms/labels/).” Accessed September 2026.
[^5]: W3C Web Accessibility Initiative. “[What’s New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).” Accessed September 2026.
[^6]: GOV.UK Design System. “[Radios](https://design-system.service.gov.uk/components/radios/).” Accessed September 2026.
[^7]: U.S. Web Design System. “[Checkbox](https://designsystem.digital.gov/components/checkbox/).” Accessed September 2026.
[^8]: U.S. Web Design System. “[Table](https://designsystem.digital.gov/components/table/).” Accessed September 2026.
