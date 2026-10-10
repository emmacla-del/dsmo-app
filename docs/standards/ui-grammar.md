# CAM-LEAP UI grammar

**Status:** normative. This is the answer to "which rules apply to this surface?"
**Scope:** the staff console (`react-web/src/app/admin/**`, `react-web/src/components/admin/**`) and the registration wizard (`react-web/src/app/register/**`, `react-web/src/components/auth/**`). The 15 rules G1–G15 below are the staff console's class recipes; G16 governs question, answer and hint text on every respondent form. Both surfaces share §Shared rules. The wizard's own shell is §Respondent composition.
**Reference page:** `src/app/admin/campagnes/page.tsx` — 242 `cam-*` class usages, 0 colour literals, in 1,087 lines. It exercises the four things every admin page is made of: a filtered list, a table, dialogs, and status badges.
**Enforced by:** `npm run check:ui-grammar` and the scoped `no-restricted-syntax` block in `react-web/eslint.config.mjs`. See §Enforcement.

---

## Why this document exists

The design system is already clean. Measured at the start of this work:

| Layer | Token references | Hex literals |
|---|---:|---:|
| `admin-console.css` | 536 | 53 → **0** |
| `globals.css` | 475 | 24 → **0** |
| **CSS layer total** | **1,011** | **77 → 0** |
| Admin TSX | — | **933** |

The mess was never in the design system. It was in page bodies re-implementing it inline. So this is not a style guide proposing a new look — it is a statement of where styling is allowed to live.

It also exists because the console has already lost this discipline once. Commit `66f9eec3` built `admin/dossiers/[id]` on purpose-written `.cam-dossier-*` classes. Commit `339c4a63`, a Figma pixel-match pass, replaced them with inline hex: that one commit took the file from 25 shared-class usages to zero and from 0 hex to 230, and accounts for 52% of all admin hex. Nothing in the repository objected. **A PNG carries no token names**, so an agent asked to match one samples colours and writes hex. The rules below, and the ratchet that enforces them, are the countermeasure.

---

## The 16 rules

### G1 — Colour

No hex literal in TSX. Every colour is `var(--cam-*)` or comes from a class. Status tones map from the stored enum via a module-level `Record<string, string>` of **class names**, never a per-row inline colour.

```tsx
// ✗ the palette, re-entered by hand
<span style={{ background: "#e8f7f3", color: "#007a5e" }}>{label}</span>

// ✓ the enum decides a class; the class decides the colour
const TONE: Record<Status, string> = { APPROVED: "cam-badge-success", PENDING: "cam-badge-warning" };
<span className={`cam-badge ${TONE[status]}`}>{label}</span>
```

Tailwind palette classes (`bg-slate-50`, `text-gray-700`, …) are a second design system and are covered by this rule too.

### G2 — Page chrome

`<div className="cam-admin-page">` is the page's only root. Width, max-width and page padding come from `.cam-admin-main` in `admin/layout.tsx`. **A page never sets its own width or page padding.**

### G3 — Header

`AdminPageHeader` with `breadcrumb={[{hub},{route}]}`, `title` from `adminNav.routes.*`, `subtitle`, and `actions={<AdminHeaderActions/>}`. Never a hand-built `<h1>`.

### G4 — Containers

| Need | Structure |
|---|---|
| Titled block | `.cam-admin-section` › `-head` › `.cam-admin-h2` › `-body` |
| Dashboard panel | `.cam-pilot-panel` › `-head` / `-body` |
| Card in a grid | `.cam-dash-card` › `-head` / `-title` |

Never an inline white box. The mechanical tell is an inline `style` object carrying **both** a `background` and a `border` — that is a card, and it has a class.

### G5 — Buttons

`.cam-button` plus exactly one of `-primary` / `-secondary` / `-danger`; add `-sm` in toolbars and table rows; `.cam-text-button` for an inline text action. **One primary action per view.** Never an inline-styled `<button>`.

### G6 — Tables

Directories and record lists: `.cam-table-wrapper` › `.cam-table`. Numeric dashboard grids: `.cam-dash-table`. Numeric columns carry `.is-num`. Never a bare `<table>`.

### G7 — Dialogs

`AdminDialog` only. It is a native `<dialog>`, so focus trap, Escape, inert background and focus return come for free. Props: `eyebrow` / `title` / `footer` / `wide`. **Never a `position: "fixed"` overlay** — a hand-rolled overlay re-implements four accessibility behaviours and gets at least one of them wrong.

### G8 — Fields

`.cam-field` wrapper, `.cam-admin-label` label, `.cam-input` / `.cam-select` / `.cam-admin-textarea` control. Filter bars use `.cam-admin-filters`. Control height is `--cam-form-field-height` (40px) — never a local 34 or 38.

### G9 — Notices

`.cam-admin-notice` plus `--success` / `--warn` / `--error` / `--info`, with `.cam-admin-notice-close` when dismissible. Mutation failures render through `formatApiError`.

### G10 — States

`DataState` / `DataStateRow`, driven by `resolveDataState`, with `resource` plus page-level `emptyTitle` / `hint`. Loading, empty, error, forbidden, unavailable and notFound are **six distinct renders** and are never conflated — conflating them is how an API failure ends up looking like "there are no records".

A KPI never shows `"…"` as a value, and a failed screen guard never `return null`.

### G11 — Badges

`.cam-badge` plus `-success` / `-warning` / `-info` / `-error` / `-neutral`, mapped from the stored enum code.

### G12 — Numbers and dates

`count`, `percent`, `stamp`, `shortStamp`, `elapsedSince` from `lib/admin-data-state.ts`. `elapsedSince` in lists, `stamp` on detail. **No local `toLocaleString` / `toLocaleDateString`** — one locale decision, in one module.

### G13 — Typography

Size and weight come from the class. **A page sets no `fontSize`.** Where a one-off is genuinely unavoidable it is a `--cam-font-size-*` token:

| Token | Size | Token | Size |
|---|---:|---|---:|
| `4xs` | 9px | `base` | 15px |
| `3xs` | 11px | `lg` | 18px |
| `2xs` | 12px | `xl` | 24px |
| `xs` | 13px | `2xl` | 25px |
| `sm` | 14px | `3xl` | 32px |

The ladder is monotonic by name. `3xs` was called `2xs` until the 12px step was added: 12px is the most-used raw font size in the app, and a token called `2xs` that rendered *smaller* than one called `3xs` would misread at every call site.

`4xs` exists for the star in the flag circle, deliberately below the body floor. It also served the admin rail's uppercase brand sub-label until 2026-10-10, when that became 12px sentence case. It is a record of an existing intent, not an invitation: nothing new should reach for it.

### G14 — Spacing

**Inline `style` carries layout only** — `display`, `grid*`, `flex*`, `gap`, `justify*`, `align*` — and every length in it is `var(--cam-space-*)` (1=4, 2=8, 3=12, 4=16, 5=24, 6=32, 7=48). No colour, no border, no radius, no background, no padding literal.

**G14 is the load-bearing rule.** It is the one-sentence form of the measurement above: *inline style positions things, classes paint them.* A page obeying G14 cannot break G1, G4, G5, G11 or G13.

### G15 — URL state

List filters, view switches and pagination live in the query string via `hrefWith` in `lib/admin-url.ts`, so a reload keeps the view.

### G16 — Question, answer, hint

Every respondent form (registration, Modern Jobs, VT) draws its three kinds of text from one set of tokens in `tokens.css`, so **changing a value there changes every form at once** (owner, 2026-10-10):

| Text | Class | Tokens | Today |
|---|---|---|---|
| Question | `.cam-question` | `--cam-question-size`, `--cam-question-weight`, `--cam-question-line-height` | 15px bold, 1.3 |
| Answer: typed value, option text, Oui/Non | `.cam-answer` | `--cam-answer-size` | 14px regular |
| Hint: helper line, option caption, note | `.cam-hint` | `--cam-microcopy-size`, `--cam-microcopy-color` | 12px muted |

Use the class, or the token inline where the element already has an inline style. **Never a ladder step (`--cam-font-size-base`, `-sm`, `-2xs`) or a number for these three.** A ladder step would still render the right size today, and silently stop following the setting tomorrow.

- The gap under a question is `--cam-field-stack-gap` (6px).
- Phones raise a typed control to `--cam-font-size-input-ios` (16px) so iOS does not zoom. That rule stays; the answer token is the desktop size.
- A selected option may change its weight to show the selection. The size stays the answer token.
- Out of scope: statistical tables (`--cam-table-fs`, `check:tables`), screen and section headings, buttons that are not answers, error text, and the staff console's compact `.cam-admin-label` (13px).
- The Modern Jobs event quiz (`EventQuestion.tsx`) follows it too: the question is `.cam-question` on every screen, and a follow-up screen's topic label above it is an 18px heading. The scope quiz's part headings are headings, not questions.

Enforced by `form-text-size` in `check:ui-grammar`: a `<label>` or `<legend>` under `src/app/register`, `src/components/auth`, `src/components/onefop` or `src/components/modern-jobs` whose inline `fontSize` is not one of the three tokens fails. It has no baseline: it was at zero when it arrived.

---

## Tokens

`react-web/src/app/tokens.css` is the only place a colour value may be written. `globals.css` imports `tokens.css` and `admin-console.css`, so every `cam-*` class and `--cam-*` token is available on every surface — admin and respondent alike. **No CSS plumbing is ever required to use one.**

Two things that look like rule-breaking and are not:

- **A local contract variable.** `--cam-status-dot` is set by `.cam-admin-status-badge--{status}` and read by the badge's `::before` dot. It is a parameter, not a palette entry, and it lives next to the class that defines it.
- **`#000` in a `mask`.** A mask reads only the opacity channel, so its opaque stop has to be a fully opaque literal. A palette token there would be wrong. The check allowlists `mask` / `-webkit-mask` for that reason. `.cam-pilot-donut`, the one such case, was removed with the other unused dashboard classes on 2026-10-10.

A `var(--cam-*)` that resolves to nothing is **not** a style preference. The declaration is dropped, so the element renders transparent or unstyled. Four such references existed and were shipping two visible bugs — a transparent dialog card on `questionnaires`, a transparent highlight in `LiveTablePreview`. The phantom-token check therefore blocks immediately and has no baseline.

A redundant fallback (`var(--cam-border, #d8ddd3)`) is worse than no fallback: it never fires while the token exists, and it goes stale silently. `var(--cam-surface-subtle, #f3f5f1)` had been naming a colour the token no longer was.

---

## Respondent surface

The registration wizard is measured by the same ratchet as the staff console. Its baselines sit on the shared rule names — `hex-in-tsx`, `font-size-literal`, `bare-table`, `spacing-off-scale`, `rgba-literal`, `font-metric-literal` — in `react-web/scripts/ui-grammar-baseline.json`. An old count of 0 hex and 18 inline style blocks is not evidence that the wizard is clean.

Before Phase 1 (commit `a34d0462`), `src/app/register/page.tsx` was already inside the respondent scan. The parent of that commit still defines `respondent-font-size-literal`, and Phase 1's message records that the page's `respondent-font-size-literal` (5) and `respondent-spacing-off-scale` (6) moved onto the shared names when `src/app/register` and `src/components/auth` joined `ADMIN_DIRS`. The four `respondent-*` rules still cover every other file under `src/app` and `src/components` outside those directories. The wizard was not unguarded. Phase 1 consolidated a scan that already ran.

It is not the admin reference, and must not be copied as one. Its classes are unprefixed (`.input-row`, not `.cam-field`). Its frame is `--cam-container-wizard` (600px), against `.cam-admin-main`'s `max-width: 1360px`. It does not use the four staff-console building blocks (filtered list, `.cam-table`, `AdminDialog`, status badges). Its review table is `.table-official`. G2–G6, G8–G11 and G15 are staff-console recipes. On the wizard globs, ESLint errors on a literal `fontSize`, on `position: "fixed"`, on `toLocale*`, and on a Tailwind palette class. The grammar script blocks a new hex, a new `fontSize`, a bare `<table>` other than `.table-official`, an `rgba()`, and a raw `fontWeight`, `lineHeight`, or `letterSpacing`. `spacing-off-scale` and `card-proxy` stay advisory. `datastate-adoption` does not scan these globs. The shell those rules sit on is §Respondent composition.

---

## Shared rules

Both compositions read `react-web/src/app/tokens.css`. The catalogue, including which call site may use a token, is `docs/standards/tokens.md`. A page does not invent a colour, a size, or a spacing step.

**Token vocabulary.** Colour lives in the brand, surface, text, and state tokens (`--cam-green` `#1e6b3a`, `--cam-text` `#000000`, `--cam-bg` `#ffffff`, `--cam-border` `#d9d9d9`, and the rest of that file; every grey is neutral, owner 2026-10-10). Type: the font-size ladder in G13 (no 10, 16, or 20 step), weights `--cam-font-weight-regular` through `-bold` (400/500/600/700), line-heights tight 1.2, title 1.25, label 1.3, ui 1.4, copy 1.45, base 1.5. Spacing is G14: 4/8/12/16/24/32/48. Radii on the ladder are 2/4/6/10 and pill (`--cam-radius-sm` through `--cam-radius-full`). `--cam-field-radius` (8px) and `--cam-section-radius` (12px) are purpose values, not new ladder steps. `--cam-font-size-input-ios` (16px) is the phone control size and is not a ladder step.

**Field slot.** The staff console's slot is G8: `.cam-field`, `.cam-admin-label`, and `.cam-input` / `.cam-select` / `.cam-admin-textarea`, at `--cam-form-field-height`. The wizard's slot is `FormRow` (`src/components/auth/FormRow.tsx`). It renders `.field` with the label as a sibling of the control. The wizard is one column at every width: the label stacks above the input (`globals.css`, `.cam-form-flow .field>label`, `margin-bottom: var(--cam-field-stack-gap)`), and the hint (`.field-hint`) sits directly under the control. There is no side-by-side layout, no label column and no container query; the former `@container cam-form (min-width: 560px)` grid and its `--cam-field-label-col` / `--cam-field-label-gap` tokens were removed by the owner's decision of 2026-10-10. Do not reintroduce them. `size` is `full`, `medium`, or `short` (`FormRow.tsx`). `full` adds no class. `medium` adds `.field--medium` and `short` adds `.field--short`. Those two rules cap every child of the row except the label (the control, its hint, its status line) at `var(--cam-field-width-medium)` (280px) and `var(--cam-field-width-short)` (220px) (`globals.css`).

**Buttons.** The staff console uses G5: `.cam-button` plus one of `-primary`, `-secondary`, `-danger`, with `-sm` in a toolbar and `.cam-text-button` for a text action. The auth card uses `.btn-primary`, which is `width: 100%` (`.cam-auth-page .btn-primary`). A button at the end of the wizard review uses `.btn-primary--inline`, which sets `width: auto`. The submit adds `.btn-primary--submit` (`min-width: 160px`). The two modifiers are separate because the confirmations do not have that floor.

**Notices.** There is no `.cam-notice`. The staff console uses `.cam-admin-notice` plus `--success`, `--warn`, `--error`, or `--info` (G9). The wizard uses three different classes: `.section-notice` (a left rule under a section heading), `.flow-missing-notice` (an error summary at the top of the section, each missing field a link to its control), and `.auth-error-box` for a submit failure. A single field's error text is `.field-error`.

**Code.** There is no `.cam-code`. A staff-console identifier uses `.cam-admin-code` (`font-family: var(--cam-font-mono)`, `--cam-font-size-xs`). The wizard's establishment id uses `.receipt-id`: monospace, bold, on `--cam-green-wash-soft`. The questionnaire's variable code is `.cam-qcode`. Do not invent a fourth class to cover all three.

**Alpha.** A translucent colour is a `color-mix` of a named solid, defined in `tokens.css`, and named for its job: `--cam-focus-shadow`, `--cam-focus-shadow-error`, `--cam-focus-shadow-gold`, `--cam-scrim`, `--cam-green-wash`, `--cam-green-wash-hover`, `--cam-green-wash-soft`. The one `rgba()` in `tokens.css` is `--cam-shadow-sm`: `rgba(20, 30, 20, 0.04)`. `rgb(20, 30, 20)` is not a token. A second exception means that shadow-base colour needs a name. The wizard ratchet blocks a new `rgba()` in `src/app/register/**` and `src/components/auth/**`. The convention is not yet true of every stylesheet: `admin-console.css` still writes `rgba()`, and so do `@keyframes onefopPulse` and `.sovereign-text-input.has-error:focus` in `globals.css`.

### `.cam-target-year`

`.cam-target-year` (`admin-console.css`) is a stacked label on the targets toolbar. `CoveragePanel.tsx` uses it around the year input. `admin/cibles/page.tsx` also uses it around campaign `<select>`s. It is not a general field wrapper. A new field uses `.cam-field` and `.cam-admin-label`. Do not reuse `.cam-target-year` as one, and do not treat the class as year-only: two of its three call sites are campaign selects.

### Phantom-token audit

Recorded 2026-10-07. A search of `react-web/src` finds no `--cam-surface-card`, `--cam-font-display`, `--cam-highlight-bg`, or `--cam-space-8`. Those four names were never in the code. The grammar script's phantom-token pass has no baseline and fails on a `var(--cam-*)` with no definition and no fallback. `npm run check:ui-grammar` passed on this date, which includes the wizard sources. No undefined `var(--cam-*)` was reported.

---

## Respondent composition

The registration route adds this shell on top of the shared tokens. Login, forgot-password, and verify-email share `.cam-auth-page` and do not add `--wizard`.

**Shell.** The wizard root is `<main className="cam-auth-page cam-auth-page--wizard">` (`src/app/register/page.tsx`). `.cam-auth-page--wizard .seal`, `.seal-note`, and `.brand-name` are `display: none`. The receipt after a successful registration renders `.cam-auth-page` without `--wizard`, so the seal and `.receipt-*` classes apply there.

**Frame.** `.flow-frame` is the one bordered element (`max-width: var(--cam-container-wizard)`, `overflow: clip`). It is not a container query and not a scroller. The document is the only scroll container on the route: a long section makes the page longer, and nothing inside the frame scrolls (owner's decision, 2026-10-10; CLAUDE.md §13). The section sits in `.flow-frame-content`. The snackbar and the missing-fields summary sit at the top of `.flow-frame-content`. The footer (Retour / Continuer / Soumettre) is `.flow-frame-dock`, the frame's last row, in normal flow after the last field. It is **not** sticky (owner's decision, 2026-10-10, government-form convention): a pinned bar covered the focused field (WCAG 2.2, 2.4.11) and sat on the phone keyboard. Do not make it sticky again. On a wide screen the dossier panel (`.flow-panel`) is `position: sticky; top: 0`, one viewport tall, and never scrolls on its own. Do not reintroduce a fixed-height frame with an inner scroll region.

**Rail (phone).** `RegistrationProgress` (`src/components/auth/RegistrationProgress.tsx`) renders `.registration-progress` and `.progress-rail` in `.flow-header`. It is a row of the page's flex column, not a `position: sticky` bar, so it scrolls away with the page on a long section. Its circles are the shared `.cam-step-marker` (see §Wizard rail).

### Wizard rail

Registration, Modern Jobs and VT share one side navigation (owner, 2026-10-10). Each wizard decides the state of a step from its own data; everything else comes from one source:

| What | Where |
|---|---|
| Width, circle size, bar height | `--cam-side-rail-width` (280px), `--cam-step-marker-size` (30px), `--cam-wizard-rail-bar-height` (6px) in `tokens.css` |
| Look of the frame, steps and states | `.cam-wizard-rail*` and `.cam-step*` in `globals.css` (§"Wizard rail") |
| Structure | `WizardRail` and `WizardStepList` in `src/components/wizard/` |
| Words | `wizardRail.*` in `messages/{fr,en}.json` |

- **States.** `done` green circle with a check; `current` gold ring; `currentComplete` gold ring on a green fill; `inProgress` dashed gold ring; `todo` grey ring; `error` red ring and "!"; `locked` grey fill. Gold means "you are here", green means "answered". A finished step that can be reopened shows "Modifier".
- **Breakpoint.** The rail from 1024px, in all three wizards. Below it, registration shows its horizontal phone rail (same circles) and the questionnaires a sections drawer that renders the same rail with `sheet`.
- **Under a sticky header** the rail pins at `--cam-wizard-rail-top`, which `ModernJobsHeader` publishes from its own height.
- **Numbering** follows each paper form: Modern Jobs from 0, VT and registration from 1.
- **The staff console's rail** (`.cam-admin-rail`) is site navigation, not form progress, so it keeps its dark green and its own classes. It shares everything else: `--cam-side-rail-width`, the 24/16/16 padding and 24px gap, 46px rows (a `--cam-step-marker-size` icon box), and 14px semibold items, bold when current.

Do not draw a step list, a step circle or a progress bar for a wizard any other way.

**Fields.** `FormRow`, as in §Shared rules. Sections 2–5 put those rows in `.cam-form-flow` > `.form-single-column`. Section 1's entity choice is `.entity-type-list`, a fieldset of `.entity-type-option` rows, not a `.field`.

**Buttons.** `.btn-primary--inline` on the in-flow actions. The submit also carries `.btn-primary--submit`.

**Table.** `.table-official` is the receipt table and the review table (`register/page.tsx`, `RegistrationReview.tsx`). `bare-table` exempts that class on the wizard globs only. An admin `<table>` still has to be `.cam-table` or `.cam-dash-table`.

**State model.** `register/page.tsx` calls `useQuery` for regions, departments, subdivisions, and sectors. No file under `src/components/auth` calls `useQuery` or `useMutation`, and neither tree imports `DataState`. `selectStatusLabel` turns `isFetching`, `isError`, and an empty list into different empty-option text. The subdivision list keeps a fourth state, `idle`, for a department that has not been chosen yet. A submit failure renders `.auth-error-box`. This is why `datastate-adoption` skips `src/app/register/**` and `src/components/auth/**` (`check-admin-ui-grammar.mjs`, `isWizardPath`).

### Known visible changes

Phase 2 moved literals onto tokens. Three of those moves change pixels:

- `.cam-auth-page .seal` went from `10px` to `--cam-font-size-3xs` (11px), in `f71f2a2a`. The wizard shell hides `.seal`, so the change shows on the auth screens that render it, including the receipt.
- `.stay-signed-in input` went from `15px` to `--cam-choice-size` (18px), in the same commit. That is the login checkbox.
- The entity-type radio went from an inline `17px` to `--cam-choice-size` (18px), in `a00df83d`.

The certify checkbox was already `18px`. Only the literal moved onto `--cam-choice-size`.

---

## Enforcement

### What runs

```bash
npm run check:ui-grammar              # the ratchet
npm run check:ui-grammar -- --update  # re-record baselines (deliberate, reviewable)
npm run lint                          # the AST-shaped rules
```

Run `check:ui-grammar` after any change under `app/admin/**`, `components/admin/**`, `app/register/**`, or `components/auth/**`.

### The split

| Where | Rules | Why there |
|---|---|---|
| `eslint.config.mjs`, scoped `no-restricted-syntax` | G7 `position:"fixed"`, G12 `toLocale*`, G13 literal `fontSize`, G1 Tailwind palette classes | AST-shaped. Reported in the editor, on the exact node. |
| `scripts/check-admin-ui-grammar.mjs` | hex in TSX, hex in the shared CSS layer, phantom tokens, G6 bare tables, G14 off-scale spacing, G4 card proxy, G10 `DataState` adoption, G16 question/answer/hint size | Text-shaped, cross-file, or needing a per-file count. |

G12 and G13 appear in both: ESLint shows them at the node, the script ratchets the count so they cannot grow while the backlog is still being worked off.

On the wizard globs the same script blocks `rgba-literal` and `font-metric-literal`, and `bare-table` exempts a line that is both under those globs and marked `.table-official`. `datastate-adoption` still skips the wizard.

Two mechanics worth knowing before editing either file:

- **ESLint flat config replaces, it does not merge.** A second config object setting `no-restricted-syntax` for the same `files` glob discards the first array — including the administrative data-integrity guard. Add selectors to the existing admin block, never in a new block for those globs.
- **esquery's regex attribute matcher only tests strings.** `[value.value=/…/]` silently skips every numeric literal, so `fontSize: 13` needs its own `[value.value=type(number)]` selector. A selector that matches nothing looks exactly like a rule with no violations.

**Not a pre-commit hook.** There is no `.husky` directory; adding one changes every contributor's commit workflow to enforce a styling rule, and a hook that is slow or noisy gets bypassed with `--no-verify`, which teaches people to bypass hooks.

**Not CI.** There is no `.github/workflows` directory at all. Proposing CI here is proposing CI infrastructure for this project — a separate decision with its own cost, which should not arrive attached to a tidy. If CI is adopted later, these same two commands are what it would run; nothing is wasted.

### The ratchet

A rule that blocks on day one blocks **1,621 existing violations**. Every rule would have to ship switched off, and *a rule that ships switched off never gets switched on.*

`scripts/ui-grammar-baseline.json` records the current per-file count for each rule. **The check fails only when a file's count rises above its baseline, or when a file with no entry — a baseline of zero — gains one.** Each step of the tidy lowers the baselines it touched; `--update` is the only thing that rewrites the file, so a lowering is a visible line in the diff and never a side effect of a passing run.

Never raise a baseline to make a commit pass.

The baseline at the end of Step 0:

| Rule | Violations | Files | Blocks |
|---|---:|---:|---|
| `hex-in-shared-css` | **0** | 0 | yes — locked at zero |
| `phantom-token` | **0** | 0 | yes — no baseline, ever |
| `hex-in-tsx` | 722 | 16 | on increase |
| `font-size-literal` | 410 | 17 | on increase |
| `locale-format` | 9 | 6 | on increase |
| `bare-table` | 5 | 5 | on increase |
| `spacing-off-scale` | 321 | 19 | advisory |
| `card-proxy` | 140 | 16 | advisory |
| `datastate-adoption` | 14 | 14 | advisory |

The three advisory rules never block. Off-scale spacing has real exceptions (`42%`, a `2px` hairline); a card is not mechanically distinguishable from a `<div>`, so `card-proxy` checks a proxy and says so; and `DataState` has legitimate non-adopters. Since Step 4 of the tidy the only `datastate-adoption` entries are `AdminHeaderActions`, `AdminPageHeader` and `admin/layout`: chrome, which queries for badges and campaign names but never stands in for a page's data. The ratchet still stops all three rules growing.

**The respondent surface is ratcheted too.** Four rules — `respondent-hex-in-tsx`, `respondent-font-size-literal`, `respondent-locale-format` and `respondent-spacing-off-scale` (advisory) — cover everything under `src/app` and `src/components` outside `ADMIN_DIRS`. The registration wizard is inside `ADMIN_DIRS`, so it is not on those four names. Its counts sit on the shared rules. See §Respondent surface. A `var(--cam-*)` on the respondent side carries no hex fallback: every token it uses is defined in `tokens.css`, so a fallback could only ever be dead or, on an undefined name, the real colour in disguise.

**Why the rules arrive now rather than after.** The current state is what "after" produces: `dossiers/[id]` *was* tidy, in `66f9eec3`, and nothing prevented the next styling commit from undoing it. Rules that arrive after a tidy protect nothing during the tidy — which is precisely when eleven pages are being rewritten. Under the ratchet, `339c4a63` fails at its first hex, in a file whose baseline was zero.

---

## Working from Figma

Port code → Figma, not Figma → pixels. A frame is authority for *structure* — what sections exist, in what order, at what hierarchy — and not for colour values, font sizes or spacing, all of which have tokens the frame cannot name.

When a frame and a token disagree, **the token wins** and the difference is recorded rather than matched. Sampling a PNG is how 482 hex literals entered this console in one commit.
