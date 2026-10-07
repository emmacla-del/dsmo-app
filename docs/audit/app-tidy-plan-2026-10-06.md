# CAM-LEAP app tidy plan — 2026-10-06

**Status:** read-only proposal. No application files were changed. No new components are proposed.
**Input:** `docs/audit/app-tidy-audit-2026-10-06.md` (the map).
**This document:** the execution plan that turns that map into one product.
**Scope:** visual and semantic harmony. The i18n effort (Phases 1–6 committed, Phase 7 in the working tree) is separate and is treated here only where a copy decision depends on it.

---

## Progress

| Step | Scope | Status | Baseline drop |
|---|---|---|---:|
| 0 | Shared layer + ratchet | ✅ Landed (416d84da, ab6f995e) | — |
| 1 | Dossier pair | ✅ Landed (5c01f157, 4fb5139f) | 694\* |
| 2 | Directory cluster | ✅ Landed (195b59e1, 1f2c6b4e, 4fc133f1, 71f14b52) | 650 |
| 3 | Tailwind island + pilotage | ✅ Landed (3f1d1c04, 8a036846, 909fcb81, 10d95ad0, 2cbf5879, a51731b5, e260c236, d786117e, 0e09b555) | 141 |
| 4a | Residue pages | ✅ Landed (c4f8d9be, 92a10e83, a865cfa8, 000c8223, d93f76a3, a509c59d, 0225267a, 8fd53c42, 516b2a8d) | 69 |
| 4b | Shared admin components | ✅ Landed (ade10594, a0f2cc08, 0972edb9, a6750b4e, 48d056e7, ed04c76d, 72b3002a, 92f2bcc1, dc7dafc0, aad8f3c9, 9f658d52, f10b4369) | 61 |
| 4c | Respondent side (plan §2.3) | ✅ Landed (6b265905, a83ae482, fa9768e2, 565f4662, da2976f4, 9b2672d6) | — † |
| 4d | Copy pass (Part 4) | ✅ Landed (eb76f5e0, 5017a56f, a678f5f0; rule 601be9ae). Every string old → new: `docs/audit/app-tidy-copy-glossary-2026-10-07.md` | — |

The ratchet baseline (`scripts/ui-grammar-baseline.json`, summed across all rules) went from 1,618 after Step 0 to 274 after Step 2. Every rule for the six files in Steps 1–2 — `dossiers`, `dossiers/[id]`, `centre-qualite`, `utilisateurs`, `etablissement-detail`, `etablissements` — is now at zero; none of them has a baseline entry left.

Step 3 took it from 274 to 133: 33 from the Tailwind island (`diffusion`, `equipe`, `journal-audit`, `parametres`) and 108 from `pilotage`, which the plan grouped with `questionnaires` and is done here instead; `questionnaires` moves to Step 4. The island's real debt was Tailwind utilities, which the ratchet does not count, so its progress measure is ESLint: the G1 Tailwind-palette rule went from 186 violations to 0 across the four pages. Every rule for those five files is at zero, and `bare-table` now has no baseline entries anywhere in the console. Two `setState`-in-render bugs (`diffusion`, `parametres`) and one link lost in `339c4a63` (`pilotage`'s activity feed) were fixed in their own commits ahead of each restyle. `.cam-dash-timeline-dot` gained status-tone modifiers, the step's one shared-CSS change. The `diffusion` scope radio, which does not reach the export filters, was raised separately for review; the restyle leaves that behaviour unchanged.

Steps 4a–4b took the admin baseline from 133 to **3**. The three that remain are `datastate-adoption` entries for `AdminHeaderActions`, `AdminPageHeader` and `admin/layout`, which are chrome and legitimately render no data state. Every other admin rule — hex, font-size literals, local formatting, bare tables, off-scale spacing, card proxies — has no entry anywhere, so any new violation fails outright. `questionnaires` moved into 4a from Step 3. Fix commits ahead of restyles in Step 4: a render-time impure call (`campagnes`), the sidebar brand "NEFOP" → "ONEFOP", and keyboard access to the companies directory's sort and detail. Seventeen classes of the pre-Figma shell were deleted as unused (48d056e7).

† Step 4c is not counted against the admin baseline: the respondent surface had no ratchet until 9b2672d6. It removed 692 dead `var(--cam-*, #hex)` fallbacks (198 of which named a colour the screen never showed), defined the eight tokens that 15 live fallbacks stood in for, restyled `/home/declarations`' summary cards (D10) onto the 940px measure, and moved the four respondent `toLocale*` calls onto the shared formatters. The respondent ratchet then recorded 355 hex lines, 475 font-size literals and 350 off-scale spacings across the questionnaire and `/home` code. Restyling the questionnaire wizards themselves is **not** part of this plan: it is questionnaire UX and needs a UX review first (CLAUDE.md §19).

Open items raised during Step 4, outside the tidy: the `diffusion` export scope radio (official export semantics); five intentional `set-state-in-effect` sites (`cibles` ×2, `CoveragePanel` ×2, `admin/layout`); `UsersDirectory`'s unreachable agent-roster mode; and `OnefopSubmissionSuccess`, which shows the declarant an invented "ONEFOP-SUB-…" reference when no submission id comes back.

From Step 3 on, `npx eslint` on each touched file is a per-commit gate alongside `tsc`, `next build`, `npm test`, `check:ui-grammar` and `check:admin-integrity`.

\* 692 from the two dossier commits; the other 2 came from `3b398319` (add-officer form), which landed between Steps 0 and 1.

---

## Findings that change the plan

Four measurements taken while preparing this plan are not in the audit, and each one moves the recommendation. They are stated first because the rest of the document rests on them.

### F1 — The design system is already clean. The mess is in TSX inline styles.

| Layer | Token references | Hex literals | Purity |
|---|---:|---:|---:|
| `admin-console.css` (2614 lines) | 536 | 53 | ~91% |
| `globals.css` (2473 lines) | 475 | 24 | ~95% |
| `tokens.css` (318 lines) | 38 | 46 (definitions) | n/a |
| **CSS layer total** | **1,011** | **77** | **~93%** |
| Admin TSX (`app/admin/**`, `components/admin/**`) | — | **933** | — |

This is not a project that needs a design system built. It has one, and it is nearly token-pure. What it needs is for page bodies to stop re-implementing it inline. **The tidy is a migration of styling location, not a redesign.** That single fact rules out the category-by-category plans and makes page-by-page viable.

`globals.css` lines 1–3 import `tokens.css` and `admin-console.css`, so every `cam-*` class is available on every surface, admin and respondent alike. No CSS plumbing is required anywhere in this plan.

### F2 — One commit caused the majority of the admin mess, and it was a Figma pixel-match pass.

`66f9eec3 style(admin): rebuild dossier detail to match supervision Figma` built `admin/dossiers/[id]` on purpose-written `.cam-dossier-*` classes — 25 class usages.

`339c4a63 style(admin/supervision): pixel-perfect alignment of Module 1 with Figma, retaining all functional widgets` then replaced them with inline hex, and did the same to its neighbours:

| File touched by 339c4a63 | Hex today |
|---|---:|
| `admin/dossiers/[id]/page.tsx` | 230 |
| `admin/dossiers/page.tsx` | 144 |
| `admin/pilotage/page.tsx` | 66 |
| `components/admin/AdminHeaderActions.tsx` | 18 |
| `components/admin/AdminPageHeader.tsx` | 13 |
| `components/admin/AdminSidebar.tsx` | 11 |
| **Total** | **482 — 52% of all admin hex** |

This is the single most important input to Part 6. A PNG carries no token names, so an agent asked to match one samples colours and writes hex. The audit's hex volume is not an accumulation of sloppiness over months; half of it arrived in one well-intentioned styling commit.

### F3 — ~330 lines of purpose-built CSS for the two worst pages is sitting orphaned.

| Class family | Lines in `admin-console.css` | TSX consumers |
|---|---|---:|
| `.cam-dossier-*` (axes, pill, grid, fields, section, history, card-title) | 2315–2520 | **0** |
| `.cam-param-*` (layout, nav, panel, note, roles, list, audit) | 1770–1900 | **0** |
| `.cam-pilot-kpi-*` | 1419–1486 | 1 (`questionnaires`) |
| `.cam-kpi-tile-*` | 1932–2000 | 1 (`KpiTile.tsx`) |

`admin/dossiers/[id]/page.tsx` uses **zero** `cam-*` classes across 2,126 lines while a stylesheet written specifically for it sits unused. `admin/parametres` is Tailwind-native while `.cam-param-*` waits. The two highest-cost pages are therefore far cheaper to fix than their size suggests: the target markup is recoverable from `git show 66f9eec3`, and the CSS it needs is already in the tree.

### F4 — The shared components are themselves off-palette, so component adoption must be preceded by component detox.

| Shared thing | Problem |
|---|---|
| `.cam-kpi-tile` CSS block | Entirely Tailwind palette: `#ffffff`, `#e5e7eb`, `#111827`, `#f59e0b`, `#2563eb`, `#dc2626`, `#9ca3af`, `#6b7280`, `#d1d5db`, `#4b5563` |
| `DataState.tsx` | 19 hex, slate inline `TONES` map; does not use `.cam-admin-empty`, which exists for exactly this |
| `AdminPageHeader.tsx:41–46` | Status tone map written as literal copies of token *values* (`#1e6b3a`, `#144a28`, `#b3261e`, `#92620a`, `#e8a020`, `#f0b429`, `#4a5a50`) |
| **4 naked phantom tokens** | `var(--cam-surface-card)` (`questionnaires`), `var(--cam-font-display)` (`home/inscription-en-attente`), `var(--cam-highlight-bg)` ×2 (`LiveTablePreview`), `var(--cam-space-8)` (`VtValidationScreen`) — referenced with **no fallback** and never defined, so each renders transparent / drops the property today |

Telling eight pages to adopt `KpiTile` right now would propagate the Tailwind palette into eight more files. `--cam-kpi-tone` is a false positive in the phantom list — it is a legitimate local contract variable set by `.cam-kpi-tile--{tone}`.

---

## Part 1 — The reference page

### 1.1 Ranking

**1st — `admin/campagnes/page.tsx`. This is the reference.**

| Metric | campagnes | registration | questionnaires |
|---|---:|---:|---:|
| Lines | 1087 | 1944 | 264 |
| Hex literals | **0** | **0** | 4 |
| Tailwind utility hits | **0** | **0** | 0 |
| `cam-*` class usages | **242** | 14 | 57 |
| Inline `style={{` blocks | 60 | **18** | 32 |
| Inline blocks per 100 lines | 5.5 | **0.9** | **12.1** |
| Shared components used | `AdminPageHeader`, `AdminDialog`, `AdminHeaderActions`, `.cam-table` | shared rail/header/review in `components/auth/` | `AdminPageHeader`, `AdminDialog`, `.cam-dash-card` |
| Exercises tables / filters / dialogs / lists | **all four** | none | dialog only |
| Phantom tokens | 0 | 0 | 1 (`--cam-surface-card`, renders transparent) |

Campagnes wins because it is the only candidate that is **both** clean and representative. It is an admin page, so its grammar transfers to admin pages with no translation; and it is made of the four things every admin page is made of — a filtered list, a table, dialogs, and status badges. Its vocabulary is 242 `cam-*` class usages and zero colour literals in 1,087 lines.

**2nd — the registration wizard. The ceiling for discipline, the wrong reference for grammar.**

It is tidier in absolute terms than campagnes: 0 hex and 18 inline style blocks across 1,944 lines, because essentially all of its appearance lives in `globals.css` as semantic classes (`input-row`, `label-cell`, `value-cell`, `btn-primary`, `wizard-section`, `table-official`). That 0.9-inline-blocks-per-100-lines figure is the number the admin pages should eventually approach, and it proves the discipline is achievable in this codebase.

But it cannot be the admin reference. Its class namespace is unprefixed and separate (`input-row`, not `cam-field`). Its container is `--cam-container-wizard` 600px, a reading measure, against admin's 1360px. Its density is respondent-scale. And it contains none of the four admin building blocks — no table, no filter bar, no pagination, no bulk action. Copying it would answer questions admin pages do not ask and leave unanswered every question they do.

**3rd — `admin/questionnaires/page.tsx`. Thin, readable, and not a data page.**

It is a card-grid landing page: no table, no filters, no pagination, no `DataState`. It also leaks more than its size suggests — the **highest inline-style density of the three** (12.1 per 100 lines), 4 hex (`#e8f7f3` / `#007a5e` badge, twice), 3 raw `fontSize` literals, raw `"0.75rem"` and `"6px"` where tokens exist, and the phantom `var(--cam-surface-card)` that renders its dialog section cards transparent. It cannot be the reference because it does not exercise the grammar it would be defining.

### 1.2 The grammar — 15 rules

Extracted from campagnes, plus what the CSS layer already provides for the cases campagnes does not reach. **Rules G13 and G14 are the two the reference itself breaks** (11 raw `fontSize` literals; `"10px 14px"`, `6px`, `2px` paddings) — they are in the grammar because the CSS layer and `tokens.css` already support them, and they must be fixed in campagnes before it is held up as the model.

| # | Area | Rule |
|---|---|---|
| **G1** | Colour | No hex literal in TSX. Every colour is `var(--cam-*)` or comes from a class. Status tones map from the enum via a module-level `Record<string, string>` of class names, never a per-row inline colour. |
| **G2** | Page chrome | `<div className="cam-admin-page">` is the page's only root. Width, max-width and page padding come from `.cam-admin-main` in `admin/layout.tsx`. A page never sets its own width or page padding. |
| **G3** | Header | `AdminPageHeader` with `breadcrumb={[{hub},{route}]}`, `title` from `adminNav.routes.*`, `subtitle`, `actions={<AdminHeaderActions/>}`. Never a hand-built `<h1>`. |
| **G4** | Containers | Titled block: `.cam-admin-section` › `.cam-admin-section-head` › `.cam-admin-h2` › `.cam-admin-section-body`. Dashboard panel: `.cam-pilot-panel` › `-head` / `-body`. Card in a grid: `.cam-dash-card` › `-head` / `-title`. Never an inline white box. |
| **G5** | Buttons | `.cam-button` plus exactly one of `-primary` / `-secondary` / `-danger`; add `-sm` in toolbars and table rows; `.cam-text-button` for an inline text action. One primary action per view. Never an inline-styled `<button>`. |
| **G6** | Tables | Directories and record lists: `.cam-table-wrapper` › `.cam-table`. Numeric dashboard grids: `.cam-dash-table`. Dashboard panel tables: `.cam-pilot-table`. Numeric columns carry `.is-num`. Never a bare `<table>`. |
| **G7** | Dialogs | `AdminDialog` only — native `<dialog>`, so focus trap, Escape, inert background and focus return come for free. Props `eyebrow` / `title` / `footer` / `wide`. Never a `position: "fixed"` overlay. |
| **G8** | Fields | `.cam-field` wrapper, `.cam-admin-label` label, `.cam-input` / `.cam-select` / `.cam-admin-textarea` control. Filter bars use `.cam-admin-filters`. Control height is `--cam-form-field-height` (40px) — never a local 34 or 38. |
| **G9** | Notices | `.cam-admin-notice` plus `--success` / `--warn` / `--error` / `--info`, with `.cam-admin-notice-close` when dismissible. Mutation failures render through `formatApiError`. |
| **G10** | States | `DataState` / `DataStateRow`, driven by `resolveDataState`, with `resource` plus page-level `emptyTitle` / `hint`. Loading, empty, error, forbidden, unavailable and notFound are six distinct renders and are never conflated. A KPI never shows `"…"` as a value, and a failed screen guard never `return null`. |
| **G11** | Badges | `.cam-badge` plus `-success` / `-warning` / `-info` / `-error` / `-neutral`, mapped from the stored enum code. |
| **G12** | Numbers & dates | `count`, `percent`, `stamp`, `shortStamp`, `elapsedSince` from `lib/admin-data-state.ts`. `elapsedSince` in lists, `stamp` on detail. No local `toLocaleString` / `toLocaleDateString`. |
| **G13** | Typography | Size and weight come from the class. **A page sets no `fontSize`.** Where a one-off is unavoidable it is a `--cam-font-size-*` token. |
| **G14** | Spacing | Inline `style` carries layout only — `display`, `grid*`, `flex*`, `gap`, `justify*`, `align*` — and every length in it is `var(--cam-space-*)`. No colour, no border, no radius, no background, no padding literal. |
| **G15** | URL state | List filters, view switches and pagination live in the query string via `hrefWith` in `lib/admin-url.ts`, so a reload keeps the view. |

G14 is the load-bearing rule. It is the one-sentence form of F1: inline style positions things, classes paint them. A page obeying G14 cannot break G1, G4, G5, G11 or G13.

---

## Part 2 — The target state

### 2.1 Per-page conformance, ranked by visible cost

Scored on what a reader actually sees: `hex + 2×(inline style blocks) + 2×(Tailwind colour/radius/spacing utilities)`. Inline blocks and Tailwind utilities are doubled because each one is a *location* where the grammar was bypassed, whereas a hex is a single value.

| Rank | Page | Hex | Inline | TW | `cam-*` | Cost | Verdict |
|---:|---|---:|---:|---:|---:|---:|---|
| 1 | `admin/dossiers/[id]` | 230 | 175 | 0 | **0** | **580** | Violates G1,G3,G4,G6,G7,G13,G14. Zero grammar. Its CSS is orphaned (F3). |
| 2 | `admin/dossiers` | 144 | 103 | 0 | 1 | **350** | Violates G1,G4,G5,G6,G7,G14. Two hand-rolled overlays. |
| 3 | `admin/centre-qualite` | 114 | 108 | 0 | 33 | **330** | Violates G1,G4,G8,G14. Uses `.cam-table` + `DataState` + helpers already; the chrome is inline. |
| 4 | `admin/utilisateurs` | 80 | 94 | 0 | 21 | **268** | Violates G1,G4,G6,G14. Inline KPI tiles, inline table. |
| 5 | `admin/etablissement-detail` | 92 | 72 | 0 | 4 | **236** | Violates G1,G4,G14. Local `CARD` constant. |
| 6 | `admin/etablissements` | 86 | 71 | 0 | 1 | **228** | Violates G1,G4,G6,G8,G14. |
| 7 | `admin/pilotage` | 66 | 72 | 0 | 24 | **210** | Violates G1,G14. Only page using `KpiTile` + `.cam-dash-card` — and still paints inline over them. |
| 8 | `admin/diffusion` | 16 | 1 | 62 | 3 | **142** | Violates G1,G4,G5,G6,G8,G14 via Tailwind. The island's largest page. |
| 9 | `admin/campagnes` | **0** | 60 | 0 | 242 | **120** | **The reference.** Violates only G13 (11 `fontSize`) and G14 (off-scale pads), plus G10 and G12. |
| 10 | `admin/journal-audit` | 5 | 0 | 34 | 3 | **73** | Violates G1,G6,G14 via Tailwind. |
| 11 | `admin/equipe` | 6 | 2 | 30 | 13 | **70** | Violates G1,G10,G12,G14 via Tailwind. |
| 12 | `admin/questionnaires` | 4 | 32 | 0 | 57 | **68** | Violates G1,G10,G13,G14 + 1 phantom token. |
| 13 | `admin/inscriptions` | 14 | 24 | 0 | 69 | **62** | Violates G1,G10,G14. Local `Kpi` + `Filter`. |
| 14 | `admin/parametres` | 8 | 0 | 20 | 3 | **48** | Violates G1,G14 via Tailwind. Its `.cam-param-*` CSS is orphaned (F3). |
| 15 | `admin/inscriptions/nouvelle` | 0 | 12 | 0 | 36 | **24** | Nearly right. G14 only. |
| 16 | `admin/notifications` | 0 | 11 | 0 | 14 | **22** | Nearly right. G10, G12, G14. |
| 17 | `admin/cibles` | 0 | 6 | 0 | 44 | **12** | Nearly right. G10 only. |
| 18 | `admin/sectors` | 0 | 3 | 0 | 26 | **6** | Nearly right. G3 (no header), G10. |
| 19 | `admin/annuaire` | **0** | **0** | **0** | 5 | **0** | **Already matches.** |

**Concentration.** Total cost 2,849. Ranks 1–7 — the inline-hex cluster — carry **2,202, or 77%**. Ranks 8, 10, 11, 14 — the Tailwind island — carry **333, or 12%**. Together, eleven pages are 89% of what a user sees as wrong. The remaining eight pages are collectively 11%, and four of them are already nearly right.

**Shared-component adoption, for reference:**

| Component | Pages using it | Pages that should |
|---|---:|---:|
| `AdminPageHeader` | 17 / 19 | 19 (missing: `dossiers/[id]`, `sectors`) |
| `AdminDialog` | 8 | 10 (missing: `dossiers`, `dossiers/[id]` — 5 hand-rolled overlays) |
| `DataState` | 11 | 17 |
| `.cam-dash-card` | 2 | ~10 |
| `KpiTile` | **1** | ~8 |
| `stamp` / `count` | 11 | 16 (9 files still call `toLocaleString` directly) |

### 2.2 The target, as a visual result

The console reads as one warm off-white page — `--cam-bg` `#fafaf7` — on which every panel is the same white card with the same single `#d8ddd3` hairline, the same 10px radius and the same barely-there shadow, so the eye stops counting containers and starts reading content; nothing is boxed that does not need a boundary, and no card sits inside another card. Green appears in exactly four places and nowhere else: the active navigation item, the one primary button per view, the national flag ribbon, and a validated status badge — so when something is green it means *this is the action* or *this is done*, rather than meaning *this is our brand colour*. Everything else is the same two inks on the same off-white — `#0b1f14` for what you read and `#4a5a50` for what tells you about it — with amber reserved for waiting, red for refused, and type that steps 11 → 13 → 15 → 24px and never between, so a dossier list, a quota grid and a quality register look like three views of one register rather than three applications that happen to share a sidebar.

### 2.3 The respondent side — same product, two densities

**Decision: one product, two densities, one primitive layer.**

The evidence is already in the tree:

- `globals.css` imports `tokens.css` *and* `admin-console.css` at lines 1–3. Both surfaces load the same stylesheet. There is no technical separation to preserve.
- The shared primitives — `.cam-button`, `.cam-field`, `.cam-input`, `.cam-select`, `.cam-label`, `.cam-badge*`, `.cam-table`, `.cam-panel` — are defined in `globals.css` and used by both surfaces today.
- The VT wizard's skin tokens were *already* aliased to the CAM tokens by explicit request, with the note "so the VT wizard matches everywhere — only the card border and status colors stay VT-specific." That decision has already been taken once; this plan restates it rather than making it.
- The registration wizard carries 0 hex and 0 Tailwind. It is not a different visual language; it is the same one at a different measure.

What legitimately differs is **density and measure**, and those differences are intentional:

| | Respondent | Admin |
|---|---|---|
| Measure | `--cam-container-wizard` 600px / `--vt-content-max` 940px — a reading measure for one column of label + input | `.cam-admin-main` 1360px — a working surface for wide tables |
| Page type scale | `--cam-step-title-size` 1.25rem | `--cam-font-size-xl` 1.5rem |
| Chrome | Masthead + step rail + one framed card | Sidebar + flag ribbon + breadcrumb + tabs |
| Compositions | `wizard-section`, `input-row`, `label-cell` in `globals.css` | `cam-admin-*`, `cam-dash-*` in `admin-console.css` |
| Density | One question at a time, progressive disclosure | Many records at once, filters and bulk actions |

So: **shared** — colours, type scale, radii, spacing scale, field height, button recipe, badge recipe, focus treatment. **Separate** — measure, page type scale, chrome, and compositions. Neither surface may invent a colour, a spacing value or a type size; each may own its own compositions.

This resolves **D10** (the last open decision on the respondent side): `home/declarations`'s local `SummaryCard` and the 900px measure should keep respondent chrome, not adopt `KpiTile`. `KpiTile` carries admin semantics in its markup — a tone-coded left edge, a trailing arrow, and a link into a staff work queue — none of which mean anything to a declarant. The tidy for `SummaryCard` is `.cam-dash-card` plus `--cam-*` tokens, which costs nothing because `admin-console.css` is already loaded globally. On the 900px measure: match `--vt-content-max` 940px, so the respondent surface has two measures (600 wizard, 940 content) rather than three.

---

## Part 3 — The path

### Option A — Page by page, pilot-critical first

Order: `admin/dossiers`, `admin/dossiers/[id]`, `admin/pilotage`, `admin/inscriptions`, then the rest.

- **Week 1:** the four pilot pages. 1,202 of 2,849 cost points — 42%.
- **After week 1:** the four screens a pilot officer touches daily look like one product; the directory cluster (`utilisateurs`, `etablissements`, `centre-qualite`) still looks like a different application.
- **After the last step:** full conformance, ~5 weeks.
- **Risk:** `pilotage` is the only page already using `KpiTile` and `.cam-dash-card`, and both are off-palette (F4). Touching `pilotage` in week 1 means either shipping it still wrong or detoxifying the components mid-page — and then `pilotage` gets redone when the other eight pages adopt `KpiTile`. The ordering is by importance but not by dependency, so it pays for the same page twice. It also leaves the ratchet (Part 5) unprotected for a week, during which a well-meant styling commit can do what 339c4a63 did.

### Option B — Reference-and-copy, one page per session

- **Week 1:** campagnes fixed to its own grammar (G13, G14, G10, G12), then one page refactored to match it completely.
- **After week 1:** two pages are right. The other seventeen are untouched, and the app looks very slightly better.
- **After the last step:** the highest-fidelity result of any option, ~7 weeks.
- **Risk:** slowest visible progress, and the "never touch a second page until the first matches" rule has no stopping condition — "matches" is a judgement call until the rules exist in executable form, so the first page can absorb a week. It is also the only option that does not fix the shared components first, so each page re-derives the same KPI-tile and DataState decisions independently and they drift again.

### Option C — Component-first

Components to tighten (all existing; no new ones): `.cam-kpi-tile` CSS block, `KpiTile`, `DataState` / `DataStateRow`, `AdminDialog`, `AdminPageHeader` tone map, `.cam-dash-card`, `.cam-table` / `.cam-dash-table`, `.cam-button*`, `.cam-badge*`, `.cam-admin-empty`, `.cam-admin-filters`, `lib/admin-data-state.ts` helpers. **What each looks like when tidy:**

| Component | Tidy state |
|---|---|
| `.cam-kpi-tile` CSS | All 10 Tailwind hex → `--cam-surface`, `--cam-border`, `--cam-text`, `--cam-text-muted`, `--cam-border-strong`; the three tone vars → `--cam-warning`, `--cam-info`, `--cam-error`; `32px`/`13px` → `--cam-font-size-*`; `0 1px 2px rgba(0,0,0,.02)` → `--cam-shadow-sm` |
| `DataState` | Inline `TONES` map deleted; renders `.cam-admin-empty` plus `cam-admin-notice--error` / `--warn` for the error and forbidden states; `fontSize` and `padding` from tokens; 19 hex → 0 |
| `AdminPageHeader` | Lines 41–46 literal tone values → the `var(--cam-*)` they were copied from; breadcrumb accepts the `dossiers/[id]` three-crumb shape |
| `AdminDialog` | Unchanged — already clean. Its job is to be adopted by the 5 hand-rolled overlays |
| `KpiTile` | Unchanged markup — already clean. Its CSS is the problem |
| `.cam-admin-empty` | Becomes the shell `DataState` renders into, rather than a class pages use directly for loading |

- **Week 1:** the whole shared layer is token-pure and safe to adopt; the 4 naked phantom tokens are defined or removed.
- **After week 1:** the app looks **almost identical**. Only `pilotage` and `questionnaires` visibly change, because they are the only pages using the components. This is the option's fatal flaw as a standalone plan.
- **After the last step:** ~6 weeks.
- **Risk:** a week of invisible work, which is hard to justify mid-pilot and easy to abandon. Conversely, skipping it is worse — adoption without detox propagates the Tailwind palette into eight more files.

### Option D — Chrome first

- **Week 1:** sidebar, header actions, page header, breadcrumb, tabs, page padding.
- **After week 1:** essentially no visible change. **The chrome is already nearly tidy:** `admin/layout.tsx` has 0 hex; `AdminSidebar` 11; `AdminHeaderActions` 18; `AdminPageHeader` 13 — 42 hex total, and a large share of the sidebar and header hex is the deliberate flag tricolour (`#007a5e`, `#b3261e`, `#f0b429`). `AdminPageHeader` is already on 17 of 19 pages and `.cam-admin-main` already owns width and padding.
- **After the last step:** ~5 weeks, but the first week bought almost nothing.
- **Risk:** the premise is false for this codebase. Chrome-first is the right move when the shell is the inconsistent part; here the shell is the *most* consistent part and the page bodies are the problem. Reject.

### Option E — Hybrid: chrome, then components, then pages

- Inherits D's wasted first week. The chrome stage should be folded into the component stage, since `AdminPageHeader` / `AdminSidebar` / `AdminHeaderActions` *are* components and their combined fix is a few hours, not a week.

### Option F — **Recommended. Detox, then page-by-page in dependency order.**

E, with the chrome stage collapsed into the component stage, the component stage compressed to half a day, and the page order set by dependency and cost-concentration rather than by category or by importance alone.

**Step 0 — the shared layer (half a day, one commit).**
The 77 hex in the three CSS files; the `.cam-kpi-tile` block; `DataState`'s inline slate map; `AdminPageHeader`'s literal tone map; the chrome's 42 hex; the 4 naked phantom tokens; and the `12px` type-token decision. Ship the Part 5 ratchet in the same commit with the baseline recorded. *Visible outcome: almost nothing, deliberately — plus two real bug fixes (a transparent dialog card on `questionnaires`, a transparent highlight in `LiveTablePreview`).*

**Step 1 — the dossier pair (week 1).**
`admin/dossiers` and `admin/dossiers/[id]`. 930 cost points, **33%**, two files. This is a restoration, not a redesign: `git show 66f9eec3` holds the markup that used the `.cam-dossier-*` classes still sitting in `admin-console.css`, and the five hand-rolled overlays become `AdminDialog`. *After week 1: the two highest-traffic staff screens, and a third of everything a user sees as wrong, are fixed. The dossier detail stops being the one page in the console with no shared chrome at all.*

**Step 2 — the directory cluster (week 2).**
`centre-qualite`, `utilisateurs`, `etablissements`, `etablissement-detail`. 1,062 points, **37%**. These four are the same page shape — KPI row, filter bar, table, detail pane — so they are one pattern applied four times, and this is where the newly-safe `KpiTile`, `.cam-dash-card`, `.cam-table` and `.cam-admin-filters` get their first real adoption. *After week 2: 70% of the cost is gone and the Déclarants and Contrôle Qualité hubs match the Supervision hub.*

**Step 3 — dashboards and the Tailwind island (week 3).**
`pilotage` and `questionnaires` (278 points) — now cheap, because Step 0 fixed what they were painting over. Then `diffusion`, `journal-audit`, `equipe`, `parametres` (333 points), a mechanical Tailwind-to-class swap, with `.cam-param-*` already waiting for `parametres`. *After week 3: 89% of the cost is gone. Every admin page draws from one palette and one class vocabulary.*

**Step 4 — residue, respondent side, copy (week 4).**
Campagnes' own G13/G14/G10/G12 debt; `cibles`, `inscriptions`, `inscriptions/nouvelle`, `notifications`, `sectors`; the respondent side per 2.3 (`home/declarations` `SummaryCard` → `.cam-dash-card`, 900px → 940px, the 9 `toLocaleString` callers, the ONEFOP token fallbacks that name the wrong colour); then the copy pass as its own commits (Part 4). *After the last step: full conformance in ~4 weeks, and the reference page is no longer an exception to its own grammar.*

### Why F

| | A | B | C | D | E | **F** |
|---|---|---|---|---|---|---|
| Visible gain after week 1 | 42% | ~8% | ~2% | ~1% | ~1% | **33%** |
| Weeks to conformance | 5 | 7 | 6 | 5 | 5 | **4** |
| Any page refactored twice | yes | no | no | yes | yes | **no** |
| Ratchet live from day one | no | no | no | no | no | **yes** |
| Shared layer safe before adoption | no | no | yes | no | yes | **yes** |

A posts a bigger week-one number, but it buys it by refactoring `pilotage` before the components it depends on are safe, and then paying for `pilotage` again. F gives up nine points in week one to spend half a day making the shared layer adoptable, and recovers them with interest in week two — because Step 2's four pages are only cheap *once* `KpiTile`, `DataState` and `.cam-dash-card` are safe to adopt.

F is also the only option that is shaped like the problem. F1 says the design system is already clean and the fix is relocating styling. F3 says the two most expensive pages have their CSS already written and orphaned, so they are the *cheapest* per point, not the dearest — which is why they go first and why week one is a third of the work. F2 says the failure mode is a single styling commit undoing a page's token discipline, which is why the ratchet ships in Step 0 rather than at the end.

**Risk of F, stated plainly.** Step 0 is invisible work and will feel like a stall; it must be timeboxed to half a day and must not expand into a design-system rewrite. Step 1 touches `dossiers/[id]`, which is 2,126 lines carrying the Axis-1 visa, reject and correction flows — the diff will be large and genuinely risky, and the restoration must preserve every widget 339c4a63's message says it retained. Mitigation: Step 1 is markup-and-class only, with no change to mutation wiring, query keys or dialog logic, and it is reviewed against `git show 66f9eec3` plus the committed `react-web/docs/figma/supervision/dossiers/_id.png` for structure. The phase-gated rhythm already in use on this project applies — one commit per step, stop for diff review between steps, stage files explicitly.

---

## Part 4 — The copy plan

### 4.1 Decisions already made — confirmed

| | Decision | Confirmation |
|---|---|---|
| **D1** | Admin primary green is `--cam-green` `#1e6b3a` | **Confirmed.** It is the defined brand token, `--cam-accent` already aliases it, and the focus shadow `rgba(30,107,58,.15)` is derived from it. `#007a5e` (18 admin hits) and `#006644` (31) are undefined invented greens. `--cam-flag-green` `#0e5c2b` stays scoped to the tricolour ribbon and the seal — the flag is a different signal from the primary action and must not become the button colour. |
| **D2** | **déclaration** (respondent) / **dossier** (staff); retire *fiche* and *soumission* from admin copy | **Confirmed, with a sense-split — see 4.3.** Current volumes in `messages/fr.json`: déclaration 69, dossier 62, soumission 23, fiche 17. |
| **D3** | **viser** for the Axis-1 decision | **Confirmed.** The list page already chose it (`endorseSelectionButton`, `badgeEndorsed` "VISÉ", `axis1Title` "VISA ADMINISTRATIF"), it is the correct Cameroonian administrative verb for granting a visa, and it does not collide with *approuver* (accounts and inscriptions) or *valider* (campaign returns). |
| **D7** | `form/FormGrid.tsx` and `ui/FormSectionCard.tsx` survive | **Confirmed.** `form/FormGrid.tsx` has the live importer (`VtWizardSectionScreen.tsx:43`) and `ui/FormSectionCard.tsx` is the titled variant. Consequence to carry out: `ui/FormGrid.tsx`'s two importers (`SectionRenderer.tsx:9`, `Section1ThematicRenderer.tsx:8`) migrate to `form/FormGrid`, `ui/FormGrid.tsx`'s untitled `FormSectionCard` export is removed, and `ui/MicroCopy.tsx` is deleted as dead (no importers besides itself). `form/FormGrid`'s gaps change from 18/20/16 to the token scale as part of that move. |

### 4.2 Decisions proposed

| | Decision | Recommendation | Where it applies | Why |
|---|---|---|---|---|
| **D4** | cible / objectif / quota | **quota** | `/admin/cibles` (`quotaColumn`, `quotaRateColumn` already correct; `clearRegionButton`, `noTargetWarning`, `newTarget`, `purposeHint`, `descriptionRegistration`, `BEHIND_TARGET`, `mixedRegionWarning`, `targetModeAriaLabel`, `confirmSaveBody`) and campaign copy. 8 `cible` + 9 `objectif` strings in `fr.json`, plus `en.json`. | The nav already chose it ("Quotas et retours"), the column headers already use it, and the API says `returns`. *Quota* is the only one of the three that names a number a region must reach; *objectif* is aspirational and *cible* is a thing you aim at. Retire *cible* from UI copy entirely, including the campaign-purpose phrase "cibles d'inscription" → "quotas d'inscription" — a second sense of a retired word reintroduces the drift. The route `/admin/cibles` stays (D9), and identifiers such as `pilotage-target-payload.ts` are untouched. |
| **D5** | Contrôle Qualité vs Centre Qualité | **Contrôle Qualité** | `adminNav.routes.centreQualite` (1 string) aligns to `adminNav.hubs.qualite` (2 strings); breadcrumb and H1 follow automatically. | The hub label governs: it is breadcrumb position 1 and the nav group name, so changing the page to match costs one string and changing the hub costs two plus the group. *Contrôle* names the activity staff perform and matches `AnomalyStatus` / the rules registry the page actually contains; *Centre* names a place that exists nowhere else in the information architecture. Route `/admin/centre-qualite` stays. |
| **D6** | Registration rail wording | **Déclarant** and **Récapitulatif** | `respondentTitle` (`fr.json:303`) → the `stepRespondent` wording; `reviewTitle` (`:328`) → the `stepReview` wording. Rail and `StepHeader` then agree. | *Déclarant* is the term used by the Déclarants hub, the inscriptions review and the respondent surface; *Répondant* is survey-methodology vocabulary appearing nowhere else in the IA. *Récapitulatif* because *Vérification* collides with the staff verification/visa activity — on the respondent side it would suggest staff are checking at that step, which they are not. **Keep** "Quel type de structure déclarez-vous ?" as the H2 against the rail's "Type d'entité": a rail label and a question heading do different jobs, and the audit flagged this as possibly intentional. It is. |
| **D8** | List JSON envelope | **`{ items, total }` for new work only** | Documented in `docs/audit/fe-be-contract-*.md`; applied to endpoints added from here on. | It is the shape the questionnaires admin list already returns, and it is noun-free so it generalises. **Do not migrate `{ users, total }` or `{ data, total }`** — they are live contracts with shipped clients, and a rename buys consistency in a place no user ever sees at the cost of a coordinated FE/BE change during a pilot. Zero-migration decision. |
| **D9** | Rename live URLs to match labels | **No. Keep paths; labels are the product names.** | One comment in `admin/_routes.ts` recording that path ≠ label is deliberate. | Pilot staff have bookmarks; the 18 exported Figma frames are named after the current paths; the audit found no single existing convention to rename *toward* (`centre-qualite`, `parametres`, `equipe` are French while `pilotage`, `sectors`, `notifications` are not); and a rename needs redirects plus churn across every audit document. The mismatch costs nothing a user can see — nobody reads the address bar to learn what a page is called. |
| **D10** | Home KPI / cards | **Respondent-styled.** `SummaryCard` → `.cam-dash-card` + tokens; not `KpiTile`. 900px → 940px. | `home/declarations/page.tsx:398`. | See 2.3. `KpiTile` carries admin semantics in its markup — tone-coded left edge, trailing arrow, link into a staff queue — that mean nothing to a declarant. `.cam-dash-card` is already globally available via `globals.css`. |
| **D11** *(new)* | Empty-state pattern | **Title `Aucun(e) {noun} trouvé(e)` + optional hint, rendered by `DataState`** | Retires `Aucune donnée disponible` (`ui/StatisticalTable.tsx:55`), `Aucun enregistrement pour ${resource}` (`admin-data-state.ts:297`), `Aucune notification.` (`notifications/page.tsx:81`) and the `Aucun X enregistré` family. Seven patterns → one. | Four of the seven already converge on *trouvé*, and `dossiers` / `etablissements` / `journal-audit` / `utilisateurs` already pass `emptyTitle` + `emptyHint` through `DataState`. The *enregistré* variants additionally lie: they imply nothing was ever recorded when the truth may be that the filter excluded everything. |
| **D12** *(new)* | Send-back verb | **Demander une correction** / confirm button **Confirmer la demande** | `confirmReturn` (`:1596`) and the dialog title "Retour pour Correction" (`:1571`) align to `requestCorrectionButton` (`:1534`). | D3 settles the visa verb but leaves the third dossier action with two words. *Retour* is a noun for the thing that happens next, not the decision the officer is taking; the officer requests a correction. Keeps *complément* for inscriptions untouched, as the audit's tidy already has it. |
| **D13** *(new)* | Reject verb | **Rejeter** / **Confirmer le rejet** | `rejectSelectionButton` (`:1432`), `rejectFormButton` (`:1551`), `confirmReject` (`:1611`) — drop "Fiche", drop the capital on "Rejet". | Mechanical in the audit, listed here so the dossier's three actions are decided together: **Viser** / **Demander une correction** / **Rejeter**, each with a `Confirmer le/la …` confirmation. |
| **D14** *(new)* | `SubmissionStatus.VALIDATED` wording | Maps to the **visa** wording, not "approuvé" | Campaign-returns UI only. Prisma enums unchanged. | The audit's §5.3 tidy. Recorded as a copy decision so the enum collision between `SubmissionStatus.VALIDATED`, `OnefopStatus.APPROVED` and the UI's "visé" never produces three words on one screen. |

### 4.3 The sense-split — the part a find-and-replace would break

D2 retires *fiche* and *soumission*, but each word carries a second, correct sense that must survive. A blind replacement produces wrong French.

**`soumission` — retire as the *record*, keep as the *act*.**

| Keep (the act of submitting) | Retire (the record) |
|---|---|
| `submissionError` "Erreur lors de la soumission" | `dialogTitle` "Nouvelle soumission" → **Nouvelle déclaration** |
| `submittingInProgress` "Soumission en cours…" | `showingRange` "… {soumissions}" → **dossiers** |
| `submittingButton` "Soumission…" | `zeroSubmissions` "0 soumission" → **0 dossier** |
| `dateFilterLabel` "Date de soumission" | `submissionsColumn` "Soumissions" → **Déclarations** |
| `reviewStatusReady` "Prêt pour soumission" | `submissionHistoryTitle` "Historique des Soumissions" → **Historique des déclarations** |
| `errorsBlockingSubmit`, `finalSubmissionUnavailable` | `submissionsCollected` "Soumissions collectées" → **Déclarations collectées** |
| `historyEmptyHint` "…aucune date de soumission…" | `submissionsResource` "l'historique des soumissions" → **des déclarations** |

**`fiche` — retire as the *record*, keep as the *questionnaire template*.**

| Keep (the survey form itself — correct statistical French) | Retire (the record) |
|---|---|
| `adminQuestionnairesPage.subtitle` "modèles nationaux de fiches d'enquête" | `formRef` "Fiche #{id}" → **Dossier #{id}** |
| `registerBody` "les modèles de fiches de collecte ONEFOP" | `formIdColumn` "ID Fiche" → **ID Dossier** |
| | `timelineReceived` "Fiche reçue…" → **Déclaration reçue…** |
| | `rejectFormButton` "Rejeter la Fiche" → **Rejeter** (D13) |
| | `historyTitle` "Historique d'instruction de la Fiche" → **du dossier** |
| | `approveBody` "…à cette fiche…" → **à ce dossier** |
| | `rejectSuccess` "La fiche a été…" → **Le dossier a été…** |

`etablissementDetail.noIdHint` "Ouvrez une fiche depuis le répertoire des établissements" is a third sense — an establishment record, not an ONEFOP one — and becomes **Ouvrez un établissement depuis le répertoire**.

Also carried out under D2/D3: `validateArchiveButton` "Valider et Archiver", `confirmValidation` "Confirmer la validation" and `validating` "Validation…" on the dossier detail are retired in favour of the list page's visa wording; and `date d'enregistrement` (`etablissement-detail:1904`) aligns to `date d'inscription` (`etablissements:1821`), while *enregistrement* is kept for "save this form" and for the legal registration number.

### 4.4 Copy execution — a separate pass, with one exception

**Recommendation: the copy changes ship as their own commits after the visual tidy, not inside each page's commit.**

Four reasons.

1. **Disjoint files.** Copy lives in `messages/fr.json` and `messages/en.json`; the visual tidy lives in `page.tsx` and `.css`. Bundling them makes a 2,000-line styling diff also a copy diff, and the copy — which is the part needing domain judgement — becomes unreviewable inside it.
2. **Different approval path.** D2, D3, D4 and D14 are administrative and statistical terminology. Under the project's own rules, changes to statistical definitions and official-export-facing wording need human review; a CSS refactor does not. Mixing them forces the stricter gate onto both.
3. **A rhythm already exists.** The i18n work established one commit per hub plus a glossary document per phase (`admin-i18n-phase3…7-glossary-2026-10-06.md`). The copy pass is the same shape of work on the same files and should produce the same artifact — an `app-tidy-copy-glossary` document recording every string changed, old → new, with its decision reference. That also gives the Part 5 copy rule its allowlist.
4. **Different blast radius.** A copy decision that turns out wrong is reverted in one file across the whole app. A copy change buried in eleven page commits is not.

**Sequencing:** the copy pass runs as Step 4 of Part 3, in three commits grouped by decision rather than by page — (i) D2/D3/D12/D13/D14, the dossier vocabulary, which is the largest and most review-sensitive; (ii) D4, the quota vocabulary; (iii) D5/D6/D11, labels and empty states. Both `fr.json` and `en.json` in each.

**The one exception.** Where a page's visual tidy rewrites an element whose string is hard-coded in TSX rather than in `messages/`, the string moves into a key in that page's commit — because the element is being rebuilt anyway and leaving a hard-coded string behind to fix later guarantees it is missed. Concretely: `notifications/page.tsx:60–61` (`"Notifications"` ×2 → `adminNav.routes.notifications`), `dossiers/[id]/page.tsx:412` (the hand-built `<h1>` → `AdminPageHeader` title), and `ui/StatisticalTable.tsx:55` (`"Aucune donnée disponible"` → the page key, under D11).

---

## Part 5 — Enforcement

### 5.1 Where the rules live

**A markdown file as the normative text, with the checks as code. Not a JSON schema.**

- `docs/standards/admin-ui-grammar.md` — the 15 rules from Part 1.2 with rationale and a worked example per rule. This is what humans and agents read, and it is the artifact that makes "does this page match?" answerable without a judgement call.
- A pointer from `CLAUDE.md` §12, which already names `tokens.css` as the design-token location and is the natural place for "and here is how to use it."
- **Not a JSON schema.** Nothing would consume it, and the rules it would need to express — "a card uses `.cam-dash-card`", "dialogs use `AdminDialog`" — are not shape constraints on data. A schema would be a worse markdown file.

### 5.2 What enforces them

**Follow the precedent this repository already has, exactly.** Two mechanisms exist and work:

1. **Scoped ESLint `no-restricted-syntax` blocks** with `files:` globs — `eslint.config.mjs` already carries the DataTable typography guard and the administrative data-integrity guard this way. Use it for anything AST-shaped: a `fontSize` literal in a JSX `style`, a `position: "fixed"`, a bare `<table>`, a `toLocaleString` member call, a Tailwind colour class in a `className`.
2. **A standalone node script** — `scripts/check-admin-ui-grammar.mjs`, wired as `npm run check:ui-grammar`, modelled on `scripts/check-admin-data-integrity.mjs` (scan directories, regex per rule, print `file:line` plus the rule, `process.exit(1)` on failure). Use it for anything text-shaped or cross-file: hex counts per file, phantom-token resolution, copy terms in `messages/*.json`.

**Not a pre-commit hook.** There is no `.husky` directory in this repository; adding one changes every contributor's commit workflow in order to enforce a styling rule, and a hook that is slow or noisy gets bypassed with `--no-verify`, which teaches people to bypass hooks.

**Not CI.** There is no `.github/workflows` directory at all. Proposing CI here is proposing CI infrastructure for this project, which is a separate decision with its own cost, and it should not arrive attached to a tidy plan.

**So: npm scripts, run by hand and by agents, plus a line in `CLAUDE.md` §18 requiring agents to run `npm run check:ui-grammar` after any change under `app/admin/**` or `components/admin/**`.** That is the enforcement this project actually has, and the two existing guard scripts prove the pattern holds. If CI is adopted later, these same scripts are what it would run — nothing is wasted.

### 5.3 The ratchet — the design decision that makes any of this possible

A rule that blocks on day one blocks **933 existing hex violations**, 479 off-scale spacings and 1,024 font-size literals. Every rule would have to ship switched off, and a rule that ships switched off never gets switched on.

Instead: `scripts/ui-grammar-baseline.json` records the current per-file violation count for each rule. **The check fails only when a file's count rises above its baseline, or when a file with a baseline of zero gains any violation.** Each step of Part 3 lowers the baseline it touched; the script rewrites the baseline only under an explicit `--update` flag, so a lowering is a visible line in the diff.

This is the direct countermeasure to F2. Nothing stopped 339c4a63 from taking `dossiers/[id]` from 25 shared-class usages to zero and from 0 hex to 230. Under the ratchet, that commit fails the check at the first hex, in a file whose baseline was zero.

### 5.4 The rule set

| Rule | How it is checked | On violation | When it blocks |
|---|---|---|---|
| **No hex literals in TSX** under `app/admin/**`, `components/admin/**` | Script: `/#[0-9a-fA-F]{3,8}\b/` per line, counted per file against baseline | **Block on increase** | Step 0 |
| **No phantom tokens** — every `var(--cam-*)` resolves to a definition in `tokens.css` / `globals.css` / `admin-console.css`, minus a short allowlist of local contract vars (`--cam-kpi-tone`) | Script: collect definitions, collect references, diff | **Block immediately**, no baseline | Step 0 — only 4 violations, all fixed in that commit |
| **No `toLocaleString` / `toLocaleDateString`** under `app/admin/**`, `components/admin/**`; use `lib/admin-data-state.ts` | ESLint `no-restricted-syntax`, `MemberExpression[property.name=/^toLocale(String\|DateString\|TimeString)$/]`, scoped by `files:` | **Block**, with the 9 current files baselined | Step 0 baseline; fully blocking after Step 4 |
| **Dialogs use `AdminDialog`** | ESLint: `Property[key.name='position'][value.value='fixed']` in `app/admin/**` | **Block** — only `dossiers` and `dossiers/[id]` violate, both in Step 1 | Step 1 |
| **Tables use `.cam-table` / `.cam-dash-table` / `.cam-pilot-table`** | ESLint: `JSXOpeningElement[name.name='table']` in `app/admin/**` without a matching `className` | **Block** — 4 files, all in Steps 1–3 | Step 3 |
| **Font sizes from tokens** | ESLint: `fontSize` with a numeric or `px`/`rem` literal in a JSX `style`; plus `text-[…]` in `className` | **Block on increase**, baselined | Step 0 baseline. **Depends on the 12px token decision** |
| **Spacing on 4/8/12/16/24/32/48** | Script: length literals in inline `style` objects, excluding `%`, `fr`, `auto`, `0` and `calc()` | **Warn only**, baselined | Never blocks. 479 admin violations and real exceptions (`42%`, `2px` hairlines) make it too noisy to gate; the ratchet still stops it growing |
| **Cards use `.cam-dash-card`** | Not mechanically decidable — a `<div>` is not distinguishable from a card. Check the proxy: an inline `style` object containing **both** a `background` and a `border` | **Warn**, baselined | Never blocks. Catches the real pattern (`#ffffff` + `1px solid #e5e7eb` + radius) without pretending to understand intent |
| **No Tailwind colour / radius / spacing utilities** in `app/admin/**` | ESLint `className` regex, modelled on the existing DataTable typography guard | **Warn** until Step 3, then **block** | Step 3, when the island is converted |
| **Empty / loading / error use `DataState`** | Script: file imports `useQuery`/`useQueries` but not `DataState` | **Warn** | Never blocks. Legitimate exceptions exist (`annuaire` and `sectors` are thin wrappers); a warning plus the 11→17 adoption target is enough |
| **Copy: retired terms** — no record-sense *fiche*, no record-sense *soumission*, no *cible*, no *objectif* in admin namespaces of `messages/*.json` | Script over `messages/fr.json` + `en.json`, keys under `admin*` namespaces, with an **explicit allowlist of the surviving-sense keys** from §4.3 | **Warn** before the copy pass, **block** after | Step 4 |

The copy rule's allowlist is the reason §4.3 exists and the reason the copy pass produces a glossary document: the allowlist is generated from it, so the rule enforces the sense-split rather than a word-ban.

### 5.5 When the rules arrive

**Alongside, ratcheted — introduced in Step 0, lowered by every subsequent step.**

- **Before, as blocking:** impossible. 933 violations.
- **Before, as warnings:** produces ~2,400 warnings on day one, which is indistinguishable from no rules at all.
- **After:** this is exactly how the current state arose. The dossier detail *was* tidy, in `66f9eec3`, and nothing prevented the next styling commit from undoing it. Rules that arrive after the tidy protect nothing during the tidy, which is precisely when eleven pages are being rewritten.
- **Alongside, ratcheted:** the baseline makes the rules true on day one without blocking anything, every step produces a visible baseline reduction (which is also the progress report), and no file can regress — including the files already clean, which are the ones most at risk, because `campagnes`, `cibles` and `annuaire` have nothing to lose and no guard today.

---

## Part 6 — The Figma loop

### 6.1 The constraints, before the recommendation

Three facts determine this answer, and two of them are hard blocks.

1. **The seat is Viewer.** On 2026-09-29 the official Figma plugin MCP refused the admin redesign file with "no edit access", and the REST-based server returned a 429 with a multi-day retry because the seat is Viewer/Collaborator. Any plan that begins "design it in Figma first" requires write access that does not exist today, and any plan that ends "capture it back to Figma" requires the same.
2. **The frames are already in the repository.** `react-web/docs/figma/` holds 18 exported PNGs, one per admin route — `supervision/dossiers/_id.png`, `qualite/centre.png`, `collecte/campagnes.png`, `donnees/exports.png`, and so on. The structural information a frame carries is already available offline, with no MCP round-trip and no rate limit.
3. **Figma-as-pixel-source is the documented cause of the mess.** F2: `339c4a63 "pixel-perfect alignment of Module 1 with Figma"` produced 482 of the 933 admin hex literals — 52% — and took `dossiers/[id]` from 25 shared-class usages to zero, abandoning a stylesheet written for it five days earlier. This is not a hypothetical risk. It is what happened, once, to the three most important pages in the console.

### 6.2 Direction: port directly. Do not design in Figma first, and do not capture back.

A PNG has no token names. An agent asked to match one must read values out of pixels, and pixels only come in hex — so the output is `#111827`, never `var(--cam-text)`. The mechanism is not carelessness; it is that the source of truth was an image, and an image cannot express "this is the muted-text token." Pointing a tidy at Figma frames would re-run the exact process that created the problem the tidy exists to fix.

The values must come from `tokens.css`. The structure — which blocks exist, in what order, at what emphasis — can come from the frames, and already does, from the PNGs in the repo.

### 6.3 Which direction is faster

**Direct port, by a wide margin, and the gap is larger than it looks.**

| | Design in Figma first | Port directly |
|---|---|---|
| Needs an Editor seat | **yes — blocked today** | no |
| MCP round-trips per page | several (`get_design_context`, `get_variable_defs`, `get_screenshot`) | **zero** |
| Rate-limit exposure | high — a 4-day 429 has already occurred on this file | **none** |
| Source of colour / spacing / type | the frame, i.e. hex | **`tokens.css`, i.e. tokens** |
| Source of structure | the frame | **the committed PNG, same information** |
| Added artifact to maintain | 19 page frames, which drift from code on every change | **the grammar document, which the ratchet keeps true** |

Designing first would add a blocked prerequisite, a rate-limited dependency and nineteen artifacts that start drifting the moment a page ships — in exchange for structural information that is already sitting in `react-web/docs/figma/`. Capturing back has the same seat problem and produces a reference that is stale on arrival, because the code is what the ratchet enforces, so the code is the reference.

**Use Figma read-only, for structure arbitration only.** When a page's intended layout is genuinely ambiguous — which blocks exist, in what order, which is emphasised — read the committed PNG, or `get_screenshot` if a frame has changed. Never read values. In practice Step 1 should consult `supervision/dossiers/_id.png` and `_id/retour-correction.png` for exactly that, alongside `git show 66f9eec3` for the markup.

### 6.4 What a frame would need to produce a grammar-matching page

If an Editor seat is obtained later, this is the bar — and it is worth stating because it explains why page frames are the wrong investment:

- **Figma Variables named exactly as the CSS custom properties** — `cam/green`, `cam/text-muted`, `cam/space-4`, `cam/radius-lg` — so `get_variable_defs` returns `cam/text-muted` instead of `#4a5a50`. Without this, nothing else matters: the MCP emits hex and the ratchet rejects the commit.
- **Components named exactly as the classes and components** — `cam-dash-card`, `cam-table`, `cam-button-primary`, `AdminDialog`, `AdminPageHeader`, `KpiTile`, `DataState` — with a **Code Connect mapping committed** for the ~12 shared pieces, so `get_code_connect_map` resolves a frame node to the component that already exists rather than to a fresh `<div>`.
- **Auto-layout with gaps drawn from the 4/8/12/16/24/32/48 scale**, and text bound to the six `--cam-font-size-*` styles — including a decision on 12px, which has no token and is the most-used raw size in the codebase.
- **All six states drawn per data region** — ready, loading, empty, error, forbidden, unavailable. A frame that shows only populated tables guarantees `DataState` is re-invented, which is how the current seven empty-state patterns arose.
- **Density and measure recorded as constraints**, not as a 1440px artboard: 1360px `.cam-admin-main` for admin, 600px wizard and 940px content for respondent, 40px controls.

Every item on that list is a property of the **design system**, not of any page. So the worthwhile Figma investment, if the seat arrives, is **one design-system file — tokens as Variables plus the twelve shared components with Code Connect — and zero page frames.** A component library is what makes the MCP produce grammar-matching output. Page frames are what made it produce 482 hex literals.

Until then: the grammar document in §1.2 is the design system of record, the ratchet keeps it true, and the 18 PNGs are read-only structural reference.

---

## Recommendations

### Recommended execution option

**Option F — detox the shared layer, then page-by-page in dependency order.** Half a day on the shared layer and the ratchet; then the dossier pair (33% of visible cost, week 1); then the directory cluster (37%, week 2); then dashboards and the Tailwind island (19%, week 3); then residue, respondent side and copy (week 4).

It is the fastest to visible harmony that does not pay for any page twice, it is the only option with the ratchet live from day one, and it is the only one shaped like the actual problem: a clean design system, a styling-location migration, two expensive pages whose CSS is already written and orphaned, and a historical failure mode that only a ratchet prevents.

### Recommended enforcement

**`docs/standards/admin-ui-grammar.md` for the rules; scoped ESLint blocks plus `scripts/check-admin-ui-grammar.mjs` for the checks; a `ui-grammar-baseline.json` ratchet so nothing blocks on day one and nothing can regress; `npm run check:ui-grammar` invoked by hand and by agents via `CLAUDE.md` §18.** No pre-commit hook, no new CI. Four rules block (hex-on-increase, phantom tokens, `position: fixed`, `toLocaleString`), four warn (spacing, cards, DataState, Tailwind-until-Step-3), and the copy rule warns then blocks after the copy pass.

### Recommended Figma direction

**Port directly; Figma stays read-only and structural.** Values come from `tokens.css`, structure from the 18 PNGs already committed in `react-web/docs/figma/`. Do not design in Figma first and do not capture back — both need an Editor seat the account does not have, and the one commit in this project's history that treated a Figma frame as the source of visual truth produced 52% of the admin colour debt. If an Editor seat is obtained later, build **one design-system file** (tokens as Variables, twelve components, Code Connect) and **no page frames**.

### Decisions the human must make before the first commit

Only three of these block Step 0. The rest can be settled during the week they apply.

**Blocking Step 0:**

1. **The 12px type token.** 12px has no token and is the most-used raw font size in the codebase. Either add a 0.75rem token, or rule that every current 12px becomes 11px (`--cam-font-size-2xs`) or 13px (`--cam-font-size-xs`). The font-size rule and its baseline cannot be written until this is decided.
2. **The four naked phantom tokens** — `--cam-surface-card`, `--cam-font-display`, `--cam-highlight-bg`, `--cam-space-8`. Define each, or redirect it to the existing token it was reaching for (`--cam-surface`, `--cam-font-serif`, `--cam-warning-bg`, `--cam-space-7`). These are live rendering bugs, not style preferences.
3. **Confirmation that `#007a5e` is not a brand colour.** It appears 18 times in admin, including the flag ribbon, the dossier primary button and the questionnaires badge, and it is defined nowhere. D1 says the primary is `--cam-green` `#1e6b3a` and the ribbon is `--cam-flag-green` `#0e5c2b`. If `#007a5e` is in fact an institutional colour someone chose, it needs a token before Step 0; if it is an invention, it is deleted.

**Needed before Step 1 (week 1):**

4. **That `dossiers/[id]` may be restored to the `.cam-dossier-*` structure of `66f9eec3`**, accepting that it will not be pixel-identical to `docs/figma/supervision/dossiers/_id.png`, while every widget and flow is preserved. This is the plan's one substantive visual-authority decision: tokens over pixel-match.

**Needed before Step 4 (the copy pass):**

5. **D4** — quota, including whether "cibles d'inscription" is also retired (recommended: yes).
6. **D5** — Contrôle Qualité as both hub and page label.
7. **D6** — Déclarant and Récapitulatif in the registration rail and `StepHeader`.
8. **D11–D14** — the empty-state pattern and the three dossier verbs, as a set.
9. **The §4.3 sense-split**, which is the one part of the copy plan where a wrong call produces incorrect French rather than merely inconsistent French.

**Informational, no migration:** D8 (`{ items, total }` for new work only), D9 (keep paths), D10 (home stays respondent-styled).

### First commit — the smallest step that visibly improves harmony

**`style(admin): paint the shared layer from tokens and add the UI-grammar ratchet`**

| Change | Effect |
|---|---|
| The 53 hex in `admin-console.css`, 24 in `globals.css` → `var(--cam-*)` | Every page inherits the correct palette through the classes it already uses |
| The `.cam-kpi-tile` block (10 Tailwind hex, `32px`, `13px`, raw shadow) → tokens | Makes `KpiTile` safe for the eight pages that will adopt it in Step 2 |
| `DataState.tsx` — delete the inline slate `TONES` map; render `.cam-admin-empty` and `cam-admin-notice--error`/`--warn` | 19 hex → 0; the shared state component stops being the thing that violates its own rule |
| `AdminPageHeader.tsx:41–46` — literal tone values → the tokens they were copied from | 13 hex → ~0 on a component present on 17 of 19 pages |
| `AdminSidebar.tsx`, `AdminHeaderActions.tsx` — 29 hex → tokens; the tricolour → `--cam-flag-*` | The chrome every page shares becomes token-pure |
| Define or redirect the 4 naked phantom tokens | Fixes two live rendering bugs: a transparent dialog card on `questionnaires`, a transparent highlight in `LiveTablePreview` |
| Add `docs/standards/admin-ui-grammar.md`, `scripts/check-admin-ui-grammar.mjs`, `ui-grammar-baseline.json`, the ESLint blocks, the `check:ui-grammar` npm script | The ratchet is live before the first page is touched |

**Why this is the right first commit.** It is the only change that improves every one of the nineteen admin pages at once without opening a single page file — because `globals.css` imports `admin-console.css` globally, so the corrected palette reaches the respondent surface too. It is confined to three CSS files and four components, so it is reviewable in one sitting. It removes two real bugs rather than only moving values around. It makes the shared components safe to adopt, which is what the next three weeks consist of. And it installs the ratchet *before* eleven pages are rewritten, which is the window in which the project last lost its token discipline.

Per the project's phase-gated rhythm: one commit, files staged explicitly, stop for diff review before Step 1. The grammar document and the baseline go in their own commit after the code commit.
