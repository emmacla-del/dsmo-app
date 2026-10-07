

---

# CAM-LEAP — Token Harmonisation Plan — 2026-10-07

**Status:** read-only proposal. No application files changed.
**Scope:** complete the token layer so both registration surfaces (self-registration `/register`, admin-assisted `/admin/inscriptions/nouvelle`) and the admin app share one definition of colours, fonts, weights, sizes, line-heights, letter-spacing, field heights, field widths, radii, spacing, and alpha variants.
**Basis:** the existing tidy plan (`app-tidy-plan-2026-10-06.md`, Steps 0–3 landed) plus the wizard audit and structural diff.
**Constraint:** the two `page.tsx` files stay separate. The wizard keeps its 600px frame and step rhythm. Admin keeps its 1360px console. Harmonisation is tokens and rules, not layout or component merging.

**Change log 2026-10-07:** D1, D2, D5 and the Phase 0 scope corrected after reading the actual `tokens.css` and grepping the source tree. The original draft assumed four phantom tokens and a missing 12px step; both assumptions were wrong. Details inline below.

---

## Progress

| Phase | Scope | Status |
|---|---|---|
| 0 | Complete the token layer | ⏳ Not started |
| 1 | Point the ratchet at the wizard | ⏳ Not started |
| 2 | Rewire the wizard's classes | ⏳ Not started |
| 3 | Ratchet becomes a gate | ⏳ Not started |
| 4 | Document the two compositions | ⏳ Not started |

---

## What this plan assumes

Three facts established by the prior work:

1. **The admin app already has a token layer and a ratchet.** Steps 0–3 of the tidy plan landed `tokens.css`, `check-admin-ui-grammar.mjs`, `ui-grammar-baseline.json`, and cleared 15 of 19 admin pages. Colours, font sizes, spacing, and radii are defined and enforced — for admin.
2. **The wizard is outside every guard.** `check-admin-ui-grammar.mjs` and the ESLint G1/G7/G12/G13 selectors glob `src/app/admin` + `src/components/admin` only. The wizard's raw `fontSize`, raw `rgba()`, off-scale spacings, inline button paddings, and inline-styled radio list and success screen are invisible to the ratchet.
3. **Four token categories do not exist anywhere.** Font weights, line-heights (other than `--cam-line-height-base`), letter-spacings, and field widths are written as literals on both surfaces. There is also no alpha convention — every translucent colour is a raw `rgba()`, some inside `tokens.css`, some at call sites.

The work is therefore: **add the missing categories, adopt one alpha convention, and point the existing ratchet at the wizard's globs with its current violations baselined.** No page rewrites in this plan.

---

## Decisions baked into this plan

These are the recommendations from the review. Confirm or override before the first commit.

| # | Decision | Recommendation | Rationale |
|---|---|---|---|
| D1 | The 12px font-size token | **[CORRECTED] Snap, do not add.** `--cam-font-size-2xs: 0.75rem` (12px) already exists. The wizard's 5 raw `fontSize` literals snap to it. | The ladder already gained 12px in a prior pass; the comment in `tokens.css` documents the rename (`3xs` was called `2xs` until 12px was inserted between it and `xs`). Adding a second 12px token would be a duplicate. |
| D2 | The four phantom tokens | **[CORRECTED] N/A — verified absent.** A grep of `tokens.css` and the full `src` tree returns nothing for `--cam-surface-card`, `--cam-font-display`, `--cam-highlight-bg`, or `--cam-space-8`. They never existed in code. No redirect needed. | The plan's original D2 was based on a stale or hallucinated reference. The *class* of bug it described is real, however, and the file shows it was already fixed once — see `--cam-border-subtle`, `--cam-surface-2`, `--cam-bg-subtle`, `--cam-primary`, `--cam-amber-*`, which are documented in `tokens.css` as "referenced with a hex fallback but never defined." A separate audit below checks whether any *new* names are in that state today. |
| D3 | The alpha convention | **`color-mix` purpose tokens**, defined only in `tokens.css` | A `--cam-green-a08` family invites a new percentage at every call site. `color-mix` forces the question "what is this wash for?" and the answer becomes the token name. |
| D4 | Field widths | **Three tokens, admin keeps its responsive grid** | The wizard uses 220/280/100%; admin uses `auto-fit, minmax(240px, 1fr)`. Same vocabulary, different composition. Forcing fixed widths on admin breaks narrow viewports. |
| D5 | The two off-ladder radii | **[CORRECTED] Document, do not sanction.** `--cam-field-radius: 8px` and `--cam-section-radius: 12px` already exist in `tokens.css` with explanatory comments. Phase 0 documents them in `tokens.md`; no token change. | Same reason as D1: the work was already done. The plan just needs to record it. |
| D6 | One grammar doc or two | **One doc, two compositions** | Extend `admin-ui-grammar.md` with a Shared rules part and a Respondent composition part. A second file will drift. |
| D7 | The wizard's ratchet | **Join the existing ratchet, baselined** | Not a new ratchet for the wizard. Same `check-admin-ui-grammar.mjs`, same `ui-grammar-baseline.json`, wider globs. |

---

## Phase 0 — Complete the token layer

### Scope

Extend `src/app/tokens.css` with the genuinely missing categories.

**Font weights — 4 tokens**

```
--cam-font-weight-regular:  400;
--cam-font-weight-medium:   500;
--cam-font-weight-semibold: 600;
--cam-font-weight-bold:     700;
```

**Line heights — 4 new tokens (base already exists, named by job)**

```
--cam-line-height-tight: 1.2;   /* headings */
--cam-line-height-title: 1.25;  /* section titles */
--cam-line-height-label: 1.3;   /* field labels — load-bearing */
--cam-line-height-ui:    1.4;   /* buttons, chips, table cells */
--cam-line-height-base:  1.5;   /* body copy — already exists */
```

**[CORRECTED]** The 1.3 is the one that matters. It currently appears in two places in `globals.css`:

- the label rule, as `line-height: 1.3` (unitless)
- the alignment calc, as `calc((var(--cam-field-height) - 1.3em) / 2)` — **note `1.3em`, not `1.3`**

Both must read the same token after Phase 0. Rewrite the calc as `calc((var(--cam-field-height) - calc(var(--cam-line-height-label) * 1em)) / 2)` so a future change to the label line-height moves the alignment with it. If that rewrite is too clever for the review, keep the `1.3em` literal in the calc and add a comment pointing at the token. Either way, the two numbers must not drift. This is the plan's highest-risk silent-break item and should get a before/after screenshot of a two-column `FormRow` in the PR.

**Letter spacing — 4 tokens**

```
--cam-tracking-caption: 0.01em;
--cam-tracking-tight:  -0.01em;
--cam-tracking-label:   0.02em;
--cam-tracking-kicker:  0.03em;
```

**Field widths — 3 tokens**

```
--cam-field-width-full:   100%;
--cam-field-width-medium: 280px;
--cam-field-width-short:  220px;
```

**Alpha purpose tokens — 6, using `color-mix`**

```
--cam-focus-shadow:       0 0 0 3px color-mix(in srgb, var(--cam-green) 15%, transparent);
--cam-focus-shadow-error: 0 0 0 3px color-mix(in srgb, var(--cam-error) 15%, transparent);
--cam-focus-shadow-gold:  0 0 0 3px color-mix(in srgb, var(--cam-gold)  18%, transparent);
--cam-scrim:              color-mix(in srgb, var(--cam-text) 45%, transparent);
--cam-green-wash:         color-mix(in srgb, var(--cam-green) 10%, transparent);
--cam-green-wash-hover:   color-mix(in srgb, var(--cam-green) 5%,  transparent);
```

**[CORRECTED] — `--cam-focus-shadow` rewrite is colour-identical.** Current value in `tokens.css` is `0 0 0 3px rgba(30, 107, 58, 0.15)`. `--cam-green` is `#1e6b3a` = `rgb(30, 107, 58)`. The `color-mix` rewrite produces the same colour, so this change is invisible. Include the arithmetic in the commit message so a reviewer can verify it without opening a browser.

**Alias**

```
--cam-field-height: var(--cam-form-field-height);  /* was an independent 40px literal */
```

**[CORRECTED]** `tokens.css` currently defines both `--cam-form-field-height: 40px` (Density block) and `--cam-field-height: 40px` (wizard metrics block) as independent literals that happen to agree. After the alias they become coupled, which is the point. Note in the commit that a future change to `--cam-form-field-height` now propagates to the wizard.

**New token for Phase 2**

```
--cam-choice-size: 18px;  /* radio and checkbox control size */
```

**[CORRECTED] Removed from Phase 0 scope:**

- ~~`--cam-font-size-2xs: 12px`~~ — already exists.
- ~~Redirect the four phantom tokens~~ — they don't exist.
- ~~Sanction `--cam-field-radius` and `--cam-section-radius`~~ — already defined with comments; Phase 0 only documents them.

### Also in Phase 0

Add `docs/standards/tokens.md` — one table listing every token, its value, its category, and its sanctioned use. Plus two rules:

1. `rgba()` may only appear inside `tokens.css`, as `color-mix` of a defined solid colour.
2. Off-ladder values must be named as purpose tokens and documented in this file.

Rewrite `--cam-focus-shadow` as `color-mix` of the same green at the same percentage (colour-identical; see above).

**Phantom-token audit (new).** Before committing Phase 0, run the extraction below to confirm no *real* phantom tokens exist today, since the original D2 named the wrong ones:

```powershell
# Every --cam-* referenced in wizard sources
Select-String -Path "src\app\register\page.tsx","src\components\auth\*.tsx","src\app\globals.css" `
  -Pattern "var\(--cam-[\w-]+\)" -AllMatches |
  ForEach-Object { $_.Matches.Value } |
  Sort-Object -Unique |
  ForEach-Object { $_ -replace 'var\(|\)','' }

# Every --cam-* defined in tokens.css
Select-String -Path "src\app\tokens.css" -Pattern "^\s*--cam-[\w-]+:" |
  ForEach-Object { ($_.Line -split ':')[0].Trim() }
```

Any name in the first list that is not in the second is a live phantom token. If the first list is fully covered, D2 is genuinely moot and the plan can drop it cleanly. Record the result in the commit message either way.

### Files changed

- `src/app/tokens.css` (extended)
- `docs/standards/tokens.md` (added)

### What we achieve

- One definition for every value the app uses. Colours, weights, sizes, line-heights, letter-spacings, heights, widths, radii, and alphas all named.
- **[CORRECTED]** Zero page files touched. Zero classes touched. Zero visible change — including the `--cam-focus-shadow` rewrite, which is colour-identical.
- The source of truth exists before anything starts pointing at it.

**[CORRECTED] Removed:** the claim that Phase 0 fixes "two live rendering bugs." Those bugs were described against tokens that don't exist. If the phantom-token audit above finds real ones, add a line here naming them; otherwise this plan's Phase 0 has no bug-fix component.

**Effort:** ~1 day. **Ships alone:** yes. **Reversible:** one `git revert`.

---

## Phase 1 — Point the ratchet at the wizard

### Scope

Add `src/app/register/**` and `src/components/auth/**` to `scripts/check-admin-ui-grammar.mjs:44–47` and `eslint.config.mjs:54–57`.

**[CORRECTED] Re-baseline from code before writing this table.** The counts and line numbers below are from the original draft and have not been verified against the current source. The D1/D2 errors suggest the rest of the plan's evidence should be treated as a starting point, not a source of truth. Run the measurement, replace the numbers, then commit.

Baseline the wizard's current violations, measured, per rule:

| Rule | Count | Where | On day one |
|---|---:|---|---|
| `hex-in-tsx` | 0 | — | Block. A new hex fails. |
| `font-size-literal` | 5 | `src/app/register/page.tsx` | Ratchet. |
| `locale-format` | 0 | — | Block. |
| `bare-table` | 2 | `register/page.tsx:1011`, `RegistrationReview.tsx:65`, both `.table-official` | Measure. Exemption lands in Phase 3. |
| `spacing-off-scale` | 6 | `src/app/register/page.tsx` | Advisory ratchet, same as admin. |
| `card-proxy` | 0 | — | Advisory. |
| `datastate-adoption` | 0 | Rule left admin-only. `register/page.tsx` calls `useQuery` and does not render `DataState`. | Leave admin-only. The wizard has a legitimate different state model. |
| `Tailwind palette`, `position: "fixed"`, `toLocale*` | 0 | — | ESLint can error immediately. |
| `rgba-literal` | 2 | `src/app/register/page.tsx` | Advisory. Blocks in Phase 3. |
| `font-metric-literal` | 6 | `register/page.tsx` 5, `RegistrationReview.tsx` 1 | Advisory. Blocks in Phase 3. |

Add two new rules, baselined:

- **`rgba()` outside `tokens.css`** — warn now, with the wizard's violations baselined. Blocks once Phase 2 clears them.
- **Raw `fontWeight` / `lineHeight` / `letterSpacing` in TSX** — warn, baselined.

Turn the ESLint G13 `fontSize` selector on for the wizard glob only once Phase 2 clears the violations. ESLint does not ratchet, so this is a switch — and it flips in **Phase 3**, not Phase 2.

**[CORRECTED] Add to scope:** confirm `.table-official` is used only in wizard tables before relying on the Phase 3 exemption. If admin also uses it, the exemption applies to both globs or neither.

### Files changed

- `scripts/check-admin-ui-grammar.mjs`
- `eslint.config.mjs`
- `scripts/ui-grammar-baseline.json` (baseline for the new globs)

### What we achieve

- The wizard can no longer gain a new `fontSize`, a new `rgba()`, or a new hex while Phase 2 is in progress.
- The ratchet is live **before** the rewiring, which is the lesson from `admin-ui-grammar.md:201–202`: a rule that arrives after the tidy protects nothing during it.
- Both surfaces are now measured against the same rules.

**Effort:** half a day. **Ships alone:** yes, after Phase 0. **Reversible:** the baseline is a visible line in the diff.

---

## Phase 2 — Rewire the wizard's classes to the tokens

### Scope

Wizard only. **[CORRECTED]** The numbered steps below still cite line numbers from the original draft. Treat them as hints and locate each item in the current file before editing. Do not trust a line number you haven't verified in the current source.

1. `.btn-primary--inline` modifier replaces the 3 inline padding overrides.
2. Success screen moves to classes: disc, title, subtitle, ID chip, status weight. The ID chip uses the code treatment, not `.cam-badge`.
3. Step-1 radio list becomes one class. The legend uses `.sr-only`, the fieldset reset becomes a class. Control size becomes `--cam-choice-size`.
4. The raw `fontSize` literals become tokens: `20` → `--cam-step-title-size`, `13` → `--cam-font-size-xs`, `"14px"` → `--cam-font-size-sm`, `"12px"` → `--cam-font-size-2xs`.
5. Off-scale spacing in the wizard CSS block moves onto the ladder or onto named optical tokens.
6. The raw alphas become the Phase 0 purpose tokens.
7. Line-heights, tracking, and weights move onto the new tokens inside the classes. **The 1.3 label line-height and the 1.3em alignment calc must read the same token.**
8. `.seal` 10px → `--cam-font-size-3xs` (11px). Placeholder 14px → `--cam-font-size-sm`. The 16px phone rule becomes `--cam-font-size-input-ios` and stays.
9. Radio 17px → `--cam-choice-size`. Certify checkbox 18px and login checkbox 15px use it too.

**[CORRECTED] Step 8 is a visible change.** The seal grows by 1px (10 → 11). The rest of Phase 2 is "type and alignment come from tokens" — i.e. no visible change. Call the 1px out in the PR description so the "no visible change" framing isn't falsified by a screenshot diff.

### Shared CSS caution

`.cam-auth-page` is one stylesheet for login, forgot-password, verify-email, the wizard, and the receipt. **[CORRECTED] Make this a gate, not a warning:** any commit that touches a `.cam-auth-page` rule must include a screenshot diff of all five surfaces in the PR description. "Checked" is not a rule a reviewer can enforce.

### Files changed

- `src/app/register/page.tsx`
- `src/components/auth/FormRow.tsx`, `RegistrationReview.tsx`, `RegistrationProgress.tsx`
- `src/app/globals.css` (the wizard block)
- `src/app/tokens.css` (add `--cam-choice-size` if not added in Phase 0)

### What we achieve

- The receipt, the radio list, and the in-flow buttons lose inline paint.
- Type, tracking, and the label/input alignment come from tokens.
- The wizard's visible debt is cleared — the same kind of change Steps 1–3 made to 15 admin pages.
- The baselined `fontSize`, `rgba()`, and button overrides are gone.

**The frame stays 600px. The rail stays. The step rhythm stays.**

**Effort:** 3–5 days, including the login check. **Risk:** highest — `.cam-auth-page` is shared with login. **Ships alone:** yes, after Phase 0.

---

## Phase 3 — The ratchet becomes a gate

### Scope

- Lower the baselines for the wizard globs using `--update` only where Phase 2 actually cleared the violations.
- Switch the ESLint G13 `fontSize` selector to **error** for the wizard glob.
- The `rgba()` rule moves from **warn** to **block**.
- The `fontWeight` / `lineHeight` / `letterSpacing` rules move from **warn** to **block**.
- Exempt `.table-official` from the bare-table rule for the wizard glob — **[CORRECTED] only if Phase 1 confirmed `.table-official` is wizard-only.**
- Keep `datastate-adoption` admin-only.

### Files changed

- `scripts/ui-grammar-baseline.json`
- `eslint.config.mjs`
- `scripts/check-admin-ui-grammar.mjs`

### What we achieve

- Nothing new can violate the token rules on either surface.
- The next commit that tries to write `fontSize: 12`, `rgba(30,107,58,0.12)`, `fontWeight: 550`, or a raw hex fails the check.
- The countermeasure to the F2 failure mode (one styling commit undoing a page's discipline) is now live on both surfaces.

**Effort:** half a day. **Ships alone:** the blocking half ships after Phase 2. **Reversible:** the baseline is a visible diff.

---

## Phase 4 — Document the two compositions

### Scope

- Extend `docs/standards/admin-ui-grammar.md` with a **Shared rules** part and a **Respondent composition** part. The shared part names the tokens, the field slot contract, the button recipe, the notice shape, the code treatment, and the alpha convention. The respondent part names the wizard's shell, frame, rail, `FormRow`, `.btn-primary`, `.table-official`, and its state model.
- Rewrite the respondent paragraph at `admin-ui-grammar.md:139–143` — "0 hex and 18 inline blocks" is no longer evidence that the wizard is clean.
- **[CORRECTED] Document the wizard's state model explicitly.** Phase 1 keeps `datastate-adoption` admin-only on the grounds that "the wizard has a legitimate different state model." That's a claim, not a rule. Name the model in this doc, or the exemption becomes an undocumented hole.
- Point `CLAUDE.md` §12 at the grammar doc.
- **Rename to `docs/standards/ui-grammar.md`** with the old path left as a pointer. The plan called this optional; the file has outgrown its admin-only name.
- Name `.cam-target-year` as a year filter, not a field wrapper, so it is not reused as one.

### Files changed

- `docs/standards/ui-grammar.md` (renamed from `admin-ui-grammar.md`)
- `docs/standards/admin-ui-grammar.md` (stub pointer)
- `CLAUDE.md`

### What we achieve

- A future contributor (human or agent) can tell, without guessing, which rules apply to the wizard and which to admin.
- The two compositions are sanctioned by name, not by omission.
- The one-doc-or-two question is settled as **one doc, two compositions**.

**Effort:** half a day. **Ships alone:** yes, once Phases 0–2 have shipped.

---

## Summary — what each phase achieves

| Phase | Scope | Files changed | Visible outcome | Effort |
|---|---|---|---|---|
| **0** | Complete the token layer | `tokens.css`, `docs/standards/tokens.md` | **None** — all changes colour- and pixel-identical | ~1 day |
| **1** | Point the ratchet at the wizard's globs, baseline the current violations | `check-admin-ui-grammar.mjs`, `eslint.config.mjs`, `ui-grammar-baseline.json` | **None** — but no new violation can land | ~½ day |
| **2** | Rewire the wizard's classes to the new tokens | `register/page.tsx`, 3 auth components, `globals.css` wizard block, `tokens.css` | **Yes** — receipt, radio list, buttons lose inline paint; type and alignment come from tokens; the seal grows 1px | 3–5 days |
| **3** | Ratchet becomes a gate | `ui-grammar-baseline.json`, `eslint.config.mjs`, `check-admin-ui-grammar.mjs` | **None** — but the next violation fails | ~½ day |
| **4** | Document the two compositions | `ui-grammar.md`, `CLAUDE.md` | **None** — documentation | ~½ day |

**Total:** roughly 5–7 working days, with Phase 2 the only phase that touches a page and the only one with real risk (because `.cam-auth-page` is shared with login).

---

## What we end up with

**One token layer.** Every colour, font family, font size, font weight, line-height, letter-spacing, field height, field width, radius, spacing value, and alpha variant defined once in `tokens.css` and named in `docs/standards/tokens.md`.

**One alpha convention.** `rgba()` appears only inside `tokens.css`, as `color-mix` of a defined solid colour. Every translucent need is a named purpose token — `--cam-scrim`, `--cam-green-wash`, `--cam-focus-shadow` — not a new percentage at a call site.

**Two compositions, one vocabulary.** The wizard reads the same tokens as admin, at its own 600px measure and step rhythm. Admin reads the same tokens at its 1360px console density. Neither invents a value.

**One ratchet covering both.** `check:ui-grammar` measures both surfaces against the same rules, with a baseline that starts at today's violation count and only ratchets down. Nothing new can violate the rules on either surface, and the F2 failure mode — a single styling commit undoing a page's discipline — is structurally prevented.

**No merged orchestrators, no merged layouts, no shared field component.** The two `page.tsx` files stay separate. That was settled by the structural diff and is not revisited here.

---

## What this plan does not do

- It does not merge the two registration orchestrators.
- It does not make the wizard look like a staff console.
- It does not extract a shared field component, button component, or notice component.
- It does not rewire the admin registration page's nested-label field wrapper to the sibling pattern.
- It does not touch the copy.
- It does not touch `cibles` / `CoveragePanel`'s use of `.cam-target-year` as a field wrapper. That is a separate small change on a different page.

---

## Recommended first commit

**`style(tokens): complete the token layer for both surfaces`**

- Extends `tokens.css` with weights, line-heights, letter-spacings, field widths, alpha purpose tokens, the field-height alias, and `--cam-choice-size`.
- Adds `docs/standards/tokens.md`, including the two rules (rgba only in `tokens.css`; off-ladder values named and documented).
- Rewrites `--cam-focus-shadow` as `color-mix` of the same green at the same percentage (colour-identical; include the arithmetic in the commit message).
- Documents the two already-existing off-ladder radii in `tokens.md`.
- **[CORRECTED] Removed from the commit:** adding `--cam-font-size-2xs` (already exists) and redirecting the four phantom tokens (they don't exist).
- **[CORRECTED] Added to the commit:** a one-line summary of the phantom-token audit result, so a reviewer knows it was run.

No page touched. Reviewable in one sitting. Revertible with one `git revert`. This is Phase 0, and it is the whole foundation — everything after points at it.

---

## Cross-references

- `react-web/docs/audit/app-tidy-audit-2026-10-06.md` — the map
- `react-web/docs/standards/app-tidy-plan-2026-10-06.md` — the admin tidy plan (Steps 0–3 landed)
- `react-web/docs/standards/ui-grammar.md` — the 15 rules both surfaces obey (renamed from `admin-ui-grammar.md` in Phase 4)
- `react-web/src/app/tokens.css` — the token definitions
- `react-web/scripts/check-admin-ui-grammar.mjs` — the guard
- `react-web/scripts/ui-grammar-baseline.json` — the ratchet baseline
- `react-web/CLAUDE.md` §12 (design-token location) and §18 (agent enforcement)

---

