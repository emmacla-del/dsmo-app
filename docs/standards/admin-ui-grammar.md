# CAM-LEAP administrative UI grammar

**Status:** normative. This is the answer to "does this page match the rest of the console?"
**Scope:** `react-web/src/app/admin/**` and `react-web/src/components/admin/**`. The respondent surface follows the same colour and token rules (G1, G13, G14) but has its own class namespace and density — see §Respondent surface.
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

## The 15 rules

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

Directories and record lists: `.cam-table-wrapper` › `.cam-table`. Numeric dashboard grids: `.cam-dash-table`. Dashboard panel tables: `.cam-pilot-table`. Numeric columns carry `.is-num`. Never a bare `<table>`.

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

`4xs` exists for two pieces of sidebar micro-copy that are deliberately below the body floor — the uppercase, letter-spaced brand sub-label and the star in the flag circle. It is a record of an existing intent, not an invitation: nothing new should reach for it. There is no 10px step, so the sidebar's one 10.5px label rounds up to `3xs`.

### G14 — Spacing

**Inline `style` carries layout only** — `display`, `grid*`, `flex*`, `gap`, `justify*`, `align*` — and every length in it is `var(--cam-space-*)` (1=4, 2=8, 3=12, 4=16, 5=24, 6=32, 7=48). No colour, no border, no radius, no background, no padding literal.

**G14 is the load-bearing rule.** It is the one-sentence form of the measurement above: *inline style positions things, classes paint them.* A page obeying G14 cannot break G1, G4, G5, G11 or G13.

### G15 — URL state

List filters, view switches and pagination live in the query string via `hrefWith` in `lib/admin-url.ts`, so a reload keeps the view.

---

## Tokens

`react-web/src/app/tokens.css` is the only place a colour value may be written. `globals.css` imports `tokens.css` and `admin-console.css`, so every `cam-*` class and `--cam-*` token is available on every surface — admin and respondent alike. **No CSS plumbing is ever required to use one.**

Two things that look like rule-breaking and are not:

- **A local contract variable.** `--cam-kpi-tone` is set by `.cam-kpi-tile--{tone}` and read by `.cam-kpi-tile`. It is a parameter, not a palette entry, and it lives next to the class that defines it.
- **`#000` in a `mask`.** A mask reads only the opacity channel, so its opaque stop has to be a fully opaque literal. A palette token there would be wrong. `.cam-pilot-donut` is the one such case, and the check allowlists `mask` / `-webkit-mask`.

A `var(--cam-*)` that resolves to nothing is **not** a style preference. The declaration is dropped, so the element renders transparent or unstyled. Four such references existed and were shipping two visible bugs — a transparent dialog card on `questionnaires`, a transparent highlight in `LiveTablePreview`. The phantom-token check therefore blocks immediately and has no baseline.

A redundant fallback (`var(--cam-border, #d8ddd3)`) is worse than no fallback: it never fires while the token exists, and it goes stale silently. `var(--cam-surface-subtle, #f3f5f1)` had been naming a colour the token no longer was.

---

## Respondent surface

The registration wizard is the ceiling for discipline in this codebase — 0 hex and 18 inline style blocks across 1,944 lines, because its appearance lives in `globals.css` as semantic classes. **0.9 inline-style blocks per 100 lines is the number admin pages should approach.**

It is not the admin reference, and must not be copied as one: its class namespace is unprefixed and separate (`input-row`, not `cam-field`), its container is `--cam-container-wizard` 600px — a reading measure, against admin's 1360px — its density is respondent-scale, and it contains none of the four admin building blocks. G1, G13 and G14 apply to it. G2–G12 and G15 do not.

---

## Enforcement

### What runs

```bash
npm run check:ui-grammar              # the ratchet
npm run check:ui-grammar -- --update  # re-record baselines (deliberate, reviewable)
npm run lint                          # the AST-shaped rules
```

Run `check:ui-grammar` after any change under `app/admin/**` or `components/admin/**`.

### The split

| Where | Rules | Why there |
|---|---|---|
| `eslint.config.mjs`, scoped `no-restricted-syntax` | G7 `position:"fixed"`, G12 `toLocale*`, G13 literal `fontSize`, G1 Tailwind palette classes | AST-shaped. Reported in the editor, on the exact node. |
| `scripts/check-admin-ui-grammar.mjs` | hex in TSX, hex in the shared CSS layer, phantom tokens, G6 bare tables, G14 off-scale spacing, G4 card proxy, G10 `DataState` adoption | Text-shaped, cross-file, or needing a per-file count. |

G12 and G13 appear in both: ESLint shows them at the node, the script ratchets the count so they cannot grow while the backlog is still being worked off.

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

The three advisory rules never block. Off-scale spacing has real exceptions (`42%`, a `2px` hairline); a card is not mechanically distinguishable from a `<div>`, so `card-proxy` checks a proxy and says so; and `DataState` has legitimate non-adopters (`annuaire` and `sectors` are thin wrappers). The ratchet still stops all three growing.

**Why the rules arrive now rather than after.** The current state is what "after" produces: `dossiers/[id]` *was* tidy, in `66f9eec3`, and nothing prevented the next styling commit from undoing it. Rules that arrive after a tidy protect nothing during the tidy — which is precisely when eleven pages are being rewritten. Under the ratchet, `339c4a63` fails at its first hex, in a file whose baseline was zero.

---

## Working from Figma

Port code → Figma, not Figma → pixels. A frame is authority for *structure* — what sections exist, in what order, at what hierarchy — and not for colour values, font sizes or spacing, all of which have tokens the frame cannot name.

When a frame and a token disagree, **the token wins** and the difference is recorded rather than matched. Sampling a PNG is how 482 hex literals entered this console in one commit.
