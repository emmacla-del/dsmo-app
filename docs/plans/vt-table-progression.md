# VT wizard — one table per screen in Sections 4 and 8

**Date:** 2026-10-11
**Status:** approved 2026-10-11, with the recommended option for D1–D4
(see "Decisions (resolved)"). Phase 1 next.
**Source:** VT wizard audit, finding R8 and §D1 (`docs/ui-ux/VT_WIZARD_AUDIT.md`).

## Goal

Replace the table tabs in Section 4 (Trainees, 4.1–4.11) and Section 8
(Trainers, 8.1–8.8) with a progression: one table per screen, and
Previous / Next moving table by table, then on to the next section.

## Why

- 11 tabs wrap to 2 rows on desktop and 7 on a phone; the first table
  starts below the fold (audit S4).
- Next validates the whole section, so it jumps to whichever tab holds the
  first problem. In testing, Next opened 4.3, then 4.4, then 4.5, then 4.6,
  one at a time, without saying why.
- Tabs expose no state: not which one is open (no `aria-selected`), not
  which are done (audit S4, P1).
- One long page is not the answer: 4.7 alone has 96 cells.

## What stays the same

- **Data.** The same fields, the same `FormData` keys, the same draft.
  No schema, AST, export or PDF change.
- **Validation rules**, including the blocking cross-table checks recorded
  in constitution §7. Only *when* they are shown changes.
- **The preliminary questionnaire** decides which tables apply, as now.
- **Section-level gating.** A section is complete when all its tables are;
  the rail locks later sections exactly as today.
- **Tableau / Guidé**, one choice for the whole declaration.
- **Sections 1–3, 5–7 and 9** keep their current single page (see D2).

## Design

### The step

A step is one of the groups the section screen already builds
(`vtWizardGroupFields`), the same unit each tab shows today. 8.5's six
fields are one group, so 8.5 is one step.

### Next, on a table

1. Validate **that table only**: the issues whose field belongs to this
   step (`fieldOwnsIssue`, already used to pick a tab).
2. If there are issues, stay; show them and focus the first, as now.
3. Otherwise go to the next applicable table, or to the next section after
   the last one.

Cross-table checks are reported on the later table of each pair
(`vt-cross-table.ts` puts each issue on the *checked* table: 4.2, 4.5, 4.6,
8.2, 8.3, 8.5). So the respondent sees "4.5 counts 12 men; 4.2 counts 10"
on 4.5, where both numbers are fresh, and that screen's Next is blocked,
as §7 requires.

An issue that belongs to no table of the section is attached to the
section's last table, so it can never be skipped.

### Previous

Goes to the previous applicable table. From the first table it goes to the
previous section; from Section 5 back into Section 4 it lands on **4.11**,
not 4.1.

### Tables the questionnaire switched off

Skipped by Next and Previous (see D3). They still count as complete for
the section, as now.

### Progress on the page

Under the section title: **"Table 3 of 11"**, then the table's own heading
(one heading per table: the audit's duplicate-heading finding S4 is fixed
at the same time). How a respondent jumps to another table is decision D1.

### Position and focus

- The saved wizard position gains a table index, so a reload returns to the
  same table (`wizard-position.ts`). An old position without one opens the
  section's first table.
- Each table change moves focus to its heading and announces
  "Trainees — table 3 of 11" through the existing live region
  (`useStepFocus`, `WizardStepDescriptor`).

### Links that open a problem

The review screen and the shell's "go to the first problem" open the
table that owns the issue, then focus the cell (`showIssue` already does
this for tabs; it now selects a step instead).

## Decisions (resolved 2026-10-11, owner: recommended options)

D1 (a) a list on the page; D2 Sections 4 and 8; D3 skip switched-off
tables; D4 jumping ahead stays allowed. The options as they were put:

**D1. How does a respondent jump to another table of the section?**

- **(a) A list on the page (recommended).** A collapsed "Tables in this
  section" list above the table, each line with ✓ / ! / ○ and a link. The
  sidebar keeps sections only, as your uncommitted sidebar change sets it
  ("never a section's subsections: the list stays short enough to sit
  pinned beside the form").
- **(b) Sub-steps in the sidebar**, under the current section, as the audit
  drew it (§D1). This reverses your sidebar change and makes the rail
  scroll on smaller screens for Sections 4 and 8.
- **(c) No jump list.** Previous / Next only. Simplest, but going back to
  4.2 from 4.9 takes seven clicks.

**D2. Which sections?** 4 and 8 (recommended). The audit also lists
Section 5 (four stacked blocks); it scrolls acceptably today, so I would
leave it for a later step.

**D3. Switched-off tables.** Skip them (recommended), or show a screen
saying "Not applicable: you answered No in the preliminary questionnaire"
with a link to change it. Today's tab shows that sentence. A skipped table
still appears in the D1 list, marked "not applicable".

**D4. Jumping forward.** Today any tab can be opened in any order. Keep
that (recommended): a respondent may fill 4.7 before 4.3. Only Next
validates.

## Phases

Each phase is one commit, with `npx tsc --noEmit`, `npm test`,
`npm run check:ui-grammar` and `npx next build` passing, and a stop for
your diff review.

**Phase 0 — your sidebar work first.** `WizardShell.tsx`,
`VtWizardSidebar.tsx` and `app/onefop/preview/page.tsx` have uncommitted
changes of yours. Phases 2–4 edit the first two, so they need to be
committed first; I will not touch them until then.

**Phase 1 — the step model (pure logic, no UI change).**
New `src/lib/vt-table-steps.ts`: the ordered steps of a section, each with
its applicability (from `vtTableStatus`) and its issues; the next and
previous applicable step; the step that owns an issue. Unit tests,
including the cross-table checks landing on the checked table and an
unowned issue landing on the last step.

**Phase 2 — the section screen shows one step.**
`VtWizardSectionScreen.tsx`: the active step comes from the shell instead
of the internal tab state; the tab bar goes for Sections 4 and 8; "Table
3 of 11" and one heading per table. `showIssue` selects a step. Other
sections unchanged.

**Phase 3 — the shell walks the steps.**
`WizardShell.tsx`: Next / Previous per step as above; validation per step
for Sections 4 and 8; Previous from Section 5 lands on 4.11; step change
moves focus and announces. `wizard-position.ts`: store the step; read old
positions.

**Phase 4 — the jump list (per D1).**
For (a): the collapsible list in the section screen. For (b): sub-steps in
`VtWizardSidebar.tsx`.

**Phase 5 — QA.** End-to-end on a test draft: fill Sections 4 and 8 table
by table in both modes; the §7 mismatches block on the right screen; reload
returns to the same table; the review screen's links open the right table;
keyboard and screen-reader pass; phone width (no tab bar, no nested
scroll).

## Risks

- **Shared navigation code.** `WizardShell.tsx` also serves the other
  wizards; the step logic applies only when `isVt` and the section is 4 or
  8, and the other paths keep their tests.
- **A hidden blocking issue.** If an issue were owned by no step and not
  attached to the last one, Next could leave the section with it. Phase 1
  tests this case explicitly, and section completion (unchanged) would
  still lock the next sections.
- **Stored positions.** Old positions have no step; they must open the
  section's first table, not fail. Tested in Phase 3.

## Out of scope

The error summary at the top of a step (audit R4), "Fill empty cells
with 0" (R23), the review screen redesign (R9), and Section 5.
