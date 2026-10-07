Here is the full file, no outer fence. Copy everything from `# CAM-LEAP` to the last line and save as `react-web/docs/standards/token-harmonisation-plan-2026-10-07.md`.

---

# CAM-LEAP — Token Harmonisation Plan — 2026-10-07

**Status:** read-only proposal. No application files changed.
**Scope:** complete the token layer so both registration surfaces (self-registration `/register`, admin-assisted `/admin/inscriptions/nouvelle`) and the admin app share one definition of colours, fonts, weights, sizes, line-heights, letter-spacing, field heights, field widths, radii, spacing, and alpha variants.
**Basis:** the existing tidy plan (`app-tidy-plan-2026-10-06.md`, Steps 0–3 landed) plus the wizard audit and structural diff.
**Constraint:** the two `page.tsx` files stay separate. The wizard keeps its 600px frame and step rhythm. Admin keeps its 1360px console. Harmonisation is tokens and rules, not layout or component merging.

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
2. **The wizard is outside every guard.** `check-admin-ui-grammar.mjs` and the ESLint G1/G7/G12/G13 selectors glob `src/app/admin` + `src/components/admin` only. The wizard's 5 raw `fontSize`, 8 raw `rgba()`, 26 off-scale spacings, 3 inline button paddings, and inline-styled radio list and success screen are invisible to the ratchet.
3. **Four token categories do not exist anywhere.** Font weights, line-heights, letter-spacings, and field widths are written as literals on both surfaces. There is also no alpha convention — every translucent colour is a raw `rgba()`.

The work is therefore: **add the missing categories, adopt one alpha convention, and point the existing ratchet at the wizard's globs with its current violations baselined.** No page rewrites in this plan.

---

## Decisions baked into this plan

These are the recommendations from the review. Confirm or override before the first commit.

| # | Decision | Recommendation | Rationale |
|---|---|---|---|
| D1 | The 12px font-size token | **Add `--cam-font-size-2xs: 12px`** | 12px is the most-used raw size. Snapping to 11px hurts readability on low-DPI; snapping to 13px crowds the gap to 14px. |
| D2 | The four phantom tokens | **Redirect, do not redefine** | `--cam-surface-card` → `--cam-surface`; `--cam-font-display` → `--cam-font-serif`; `--cam-highlight-bg` → `--cam-warning-bg`; `--cam-space-8` → `--cam-space-7`. These are rendering bugs, not design choices. |
| D3 | The alpha convention | **`color-mix` purpose tokens**, defined only in `tokens.css` | A `--cam-green-a08` family invites a new percentage at every call site. `color-mix` forces the question "what is this wash for?" and the answer becomes the token name. |
| D4 | Field widths | **Three tokens, admin keeps its responsive grid** | The wizard uses 220/280/100%; admin uses `auto-fit, minmax(240px, 1fr)`. Same vocabulary, different composition. Forcing fixed widths on admin breaks narrow viewports. |
| D5 | The two off-ladder radii | **Sanction as purpose values** | `--cam-field-radius: 8px` keeps the focus ring from hugging the border; `--cam-section-radius: 12px` is what the frame already looks like. Name the purpose, don't pollute the ladder. |
| D6 | One grammar doc or two | **One doc, two compositions** | Extend `admin-ui-grammar.md` with a Shared rules part and a Respondent composition part. A second file will drift. |
| D7 | The wizard's ratchet | **Join the existing ratchet, baselined** | Not a new ratchet for the wizard. Same `check-admin-ui-grammar.mjs`, same `ui-grammar-baseline.json`, wider globs. |

---

## Phase 0 — Complete the token layer

### Scope

Extend `src/app/tokens.css` with the missing categories.

**Font weights — 4 tokens**

    --cam-font-weight-regular:  400;
    --cam-font-weight-medium:   500;
    --cam-font-weight-semibold: 600;
    --cam-font-weight-bold:     700;

**Line heights — 5 tokens, named by job**

    --cam-line-height-tight: 1.2;   /* headings */
    --cam-line-height-title: 1.25;  /* section titles */
    --cam-line-height-label: 1.3;   /* field labels — load-bearing */
    --cam-line-height-ui:    1.4;   /* buttons, chips, table cells */
    --cam-line-height-base:  1.5;   /* body copy (already exists) */

The 1.3 is the one that matters. It is duplicated between `globals.css:905` (the label rule) and `:1054` (the alignment calc). Those must read the same token, or the side-by-side label alignment breaks silently.

**Letter spacing — 4 tokens**

    --cam-tracking-caption: 0.01em;
    --cam-tracking-tight:  -0.01em;
    --cam-tracking-label:   0.02em;
    --cam-tracking-kicker:  0.03em;

**Field widths — 3 tokens**

    --cam-field-width-full:   100%;
    --cam-field-width-medium: 280px;
    --cam-field-width-short:  220px;

**Alpha purpose tokens — 6, using `color-mix`**

    --cam-focus-shadow:       0 0 0 3px color-mix(in srgb, var(--cam-green) 15%, transparent);
    --cam-focus-shadow-error: 0 0 0 3px color-mix(in srgb, var(--cam-error) 15%, transparent);
    --cam-focus-shadow-gold:  0 0 0 3px color-mix(in srgb, var(--cam-gold)  18%, transparent);
    --cam-scrim:              color-mix(in srgb, var(--cam-text) 45%, transparent);
    --cam-green-wash:         color-mix(in srgb, var(--cam-green) 10%, transparent);
    --cam-green-wash-hover:   color-mix(in srgb, var(--cam-green) 5%,  transparent);

**New ladder step**

    --cam-font-size-2xs: 12px;

**Alias**

    --cam-field-height: var(--cam-form-field-height);  /* was independent */

**Sanctioned off-ladder values (documented, not changed)**

- `--cam-field-radius: 8px`
- `--cam-section-radius: 12px`

**New token for Phase 2**

    --cam-choice-size: 18px;  /* radio and checkbox control size */

### Also in Phase 0

Add `docs/standards/tokens.md` — one table listing every token, its value, its category, and its sanctioned use. Plus two rules:

1. `rgba()` may only appear inside `tokens.css`, as `color-mix` of a defined solid colour.
2. Off-ladder values must be named as purpose tokens and documented in this file.

Rewrite `--cam-focus-shadow` from hardcoded `rgba(30,107,58,0.15)` to `color-mix` of the same green at the same percentage.

Fix the four phantom tokens by redirecting them to the existing tokens they were reaching for:

- `--cam-surface-card` → `--cam-surface`
- `--cam-font-display` → `--cam-font-serif`
- `--cam-highlight-bg` → `--cam-warning-bg`
- `--cam-space-8` → `--cam-space-7`

### Files changed

- `src/app/tokens.css` (extended)
- `docs/standards/tokens.md` (added)

### What we achieve

- One definition for every value the app uses. Colours, weights, sizes, line-heights, letter-spacings, heights, widths, radii, and alphas all named.
- Two live rendering bugs fixed by redirecting the phantom tokens (a transparent dialog card on `questionnaires`, a transparent highlight in `LiveTablePreview`).
- Zero page files touched. Zero classes touched. Zero visible change.
- The source of truth exists before anything starts pointing at it.

**Effort:** ~1 day. **Ships alone:** yes. **Reversible:** one `git revert`.

---

## Phase 1 — Point the ratchet at the wizard

### Scope

Add `src/app/register/**` and `src/components/auth/**` to `scripts/check-admin-ui-grammar.mjs:44–47` and `eslint.config.mjs:54–57`.

Baseline the wizard's current violations, measured, per rule:

| Rule | Count | Where | On day one |
|---|---:|---|---|
| `hex-in-tsx` | 0 | — | Block. A new hex fails. |
| `font-size-literal` | 5 | `register/page.tsx:999, :1004, :1032, :1158, :1164` | Ratchet. |
| `locale-format` | 0 | — | Block. |
| `bare-table` | 2 | `register/page.tsx:1011`, `RegistrationReview.tsx:65` | Exempt `.table-official`, then block. |
| `spacing-off-scale` | 6 | `page.tsx:981, :1036, :1118, :1689, :1882, :1929` | Advisory ratchet, same as admin. |
| `card-proxy` | 0 | — | Advisory. |
| `datastate-adoption` | 1 | `register/page.tsx:7, :198` | Leave admin-only. The wizard has a legitimate different state model. |
| `Tailwind palette`, `position: "fixed"`, `toLocale*` | 0 | — | ESLint can error immediately. |

Add two new rules, baselined:

- **`rgba()` outside `tokens.css`** — warn now, with the wizard's 8 violations baselined. Blocks once Phase 2 clears them.
- **Raw `fontWeight` / `lineHeight` / `letterSpacing` in TSX** — warn, baselined.

Turn the ESLint G13 `fontSize` selector on for the wizard glob only once Phase 2 clears the 5 violations. ESLint does not ratchet, so this is a switch.

### Files changed

- `scripts/check-admin-ui-grammar.mjs`
- `eslint.config.mjs`
- `scripts/ui-grammar-baseline.json` (baseline for the new globs)

### What we achieve

- The wizard can no longer gain a sixth `fontSize`, a ninth `rgba()`, or a new hex while Phase 2 is in progress.
- The ratchet is live **before** the rewiring, which is the lesson from `admin-ui-grammar.md:201–202`: a rule that arrives after the tidy protects nothing during it.
- Both surfaces are now measured against the same rules.

**Effort:** half a day. **Ships alone:** yes, after Phase 0. **Reversible:** the baseline is a visible line in the diff.

---

## Phase 2 — Rewire the wizard's classes to the tokens

### Scope

Wizard only, in this order:

1. `.btn-primary--inline` modifier replaces the 3 inline padding overrides (`register/page.tsx:1689, :1882, :1929`).
2. Success screen (`:981–1068`) moves to classes: disc, title, subtitle, ID chip, status weight. The ID chip uses the code treatment, not `.cam-badge`.
3. Step-1 radio list (`:1104–1173`) becomes one class. The legend uses `.sr-only`, the fieldset reset becomes a class. Control size becomes `--cam-choice-size`.
4. The 5 raw `fontSize` become tokens: `20` → `--cam-step-title-size`, `13` → `--cam-font-size-xs`, `"14px"` → `--cam-font-size-sm`, `"12px"` → `--cam-font-size-2xs`.
5. Off-scale spacing in the wizard CSS block moves onto the ladder or onto named optical tokens.
6. The 8 alphas become the Phase 0 purpose tokens.
7. Line-heights, tracking, and weights move onto the new tokens inside the classes. **The 1.3 label line-height and the 1.3em alignment calc at `globals.css:1054` must read the same token.**
8. `.seal` 10px → `--cam-font-size-3xs` (11px). Placeholder 14px → `--cam-font-size-sm`. The 16px phone rule becomes `--cam-font-size-input-ios` and stays.
9. Radio 17px → `--cam-choice-size`. Certify checkbox 18px and login checkbox 15px use it too.

### Shared CSS caution

`.cam-auth-page` is one stylesheet for login, forgot-password, verify-email, the wizard, and the receipt. Any shared rule that moves must be checked against the other consumers in the same commit.

### Files changed

- `src/app/register/page.tsx`
- `src/components/auth/FormRow.tsx`, `RegistrationReview.tsx`, `RegistrationProgress.tsx`
- `src/app/globals.css` (the wizard block, ~lines 200–1880)
- `src/app/tokens.css` (add `--cam-choice-size` if not added in Phase 0)

### What we achieve

- The receipt, the radio list, and the in-flow buttons lose inline paint.
- Type, tracking, and the label/input alignment come from tokens.
- The wizard's visible debt is cleared — the same kind of change Steps 1–3 made to 15 admin pages.
- The 5 baselined `fontSize`, the 8 `rgba()`, and the 3 button overrides are gone.

**The frame stays 600px. The rail stays. The step rhythm stays.**

**Effort:** 3–5 days, including the login check. **Risk:** highest — `.cam-auth-page` is shared with login. **Ships alone:** yes, after Phase 0.

---

## Phase 3 — The ratchet becomes a gate

### Scope

- Lower the baselines for the wizard globs using `--update` only where Phase 2 actually cleared the violations.
- Switch the ESLint G13 `fontSize` selector to **error** for the wizard glob (the 5 are now 0).
- The `rgba()` rule moves from **warn** to **block**.
- The `fontWeight` / `lineHeight` / `letterSpacing` rules move from **warn** to **block**.
- Exempt `.table-official` from the bare-table rule for the wizard glob.
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
- Point `CLAUDE.md` §12 at the grammar doc.
- Optional rename to `docs/standards/ui-grammar.md` with the old path left as a pointer.
- Name `.cam-target-year` as a year filter, not a field wrapper, so it is not reused as one.

### Files changed

- `docs/standards/admin-ui-grammar.md`
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
| **0** | Complete the token layer + fix phantom tokens | `tokens.css`, `docs/standards/tokens.md` | **None** — plus two live rendering bugs fixed | ~1 day |
| **1** | Point the ratchet at the wizard's globs, baseline the current violations | `check-admin-ui-grammar.mjs`, `eslint.config.mjs`, `ui-grammar-baseline.json` | **None** — but no new violation can land | ~½ day |
| **2** | Rewire the wizard's classes to the new tokens | `register/page.tsx`, 3 auth components, `globals.css` wizard block, `tokens.css` | **Yes, on the wizard surface** — receipt, radio list, buttons lose inline paint; type and alignment come from tokens | 3–5 days |
| **3** | Ratchet becomes a gate | `ui-grammar-baseline.json`, `eslint.config.mjs`, `check-admin-ui-grammar.mjs` | **None** — but the next violation fails | ~½ day |
| **4** | Document the two compositions | `admin-ui-grammar.md`, `CLAUDE.md` | **None** — documentation | ~½ day |

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

- Extends `tokens.css` with weights, line-heights, letter-spacings, field widths, alpha purpose tokens, `--cam-font-size-2xs`, the field-height alias, `--cam-choice-size`, and the two sanctioned radii.
- Adds `docs/standards/tokens.md`.
- Redirects the four phantom tokens.
- Rewrites `--cam-focus-shadow` as `color-mix` of the same green at the same percentage.

No page touched. Reviewable in one sitting. Revertible with one `git revert`. This is Phase 0, and it is the whole foundation — everything after points at it.

---

## Cross-references

- `react-web/docs/audit/app-tidy-audit-2026-10-06.md` — the map
- `react-web/docs/standards/app-tidy-plan-2026-10-06.md` — the admin tidy plan (Steps 0–3 landed)
- `react-web/docs/standards/admin-ui-grammar.md` — the 15 rules the admin app obeys
- `react-web/src/app/tokens.css` — the token definitions
- `react-web/scripts/check-admin-ui-grammar.mjs` — the guard
- `react-web/scripts/ui-grammar-baseline.json` — the ratchet baseline
- `react-web/CLAUDE.md` §12 (design-token location) and §18 (agent enforcement)

---

That's the full file. Save it as `react-web/docs/standards/token-harmonisation-plan-2026-10-07.md` and commit:

```
git add react-web/docs/standards/token-harmonisation-plan-2026-10-07.md
git commit -m "docs(standards): add token harmonisation plan for both registration surfaces"
```

If any part still arrives truncated, tell me which phase it stops at and I'll re-send just that section.