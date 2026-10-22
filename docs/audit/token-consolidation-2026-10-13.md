# Token consolidation — one colour system, one type scale, one spacing rhythm

**Date:** 2026-10-13
**Decision implemented:** the staff console and the VT/ONEFOP wizards are canonical for colour, typography and spacing. Every other surface reconciles to them.
**Answers:** `docs/audit/portal-design-critique-2026-10-13.md` findings H1–H6, H10, H18, H4, D6.
**State:** uncommitted, in the working tree. Nothing committed, nothing pushed.

---

## 1. The canonical design system

### 1.1 Colour palette

Literal values now live only in the `:root` block of `src/app/tokens.css`. Everything else is an alias.

| Token | Value | Purpose |
|---|---|---|
| `--cam-white` | `#ffffff` | White primitive. Needed because `--cam-surface` is re-pointed by dark grounds. |
| `--cam-green` | `#1e6b3a` | Primary. 228 consumption sites — the highest in the platform. |
| `--cam-green-dark` | `#144a28` | Primary dark: hover, rail, dark ground. 40 sites. |
| `--cam-dark-surface` | → `--cam-green-dark` | The one dark ground (staff rail, portal footer/bands). |
| `--cam-on-dark` | → `--cam-white` | Text on the dark ground. |
| `--cam-on-dark-muted` | `color-mix(--cam-white 70%)` | Muted text on dark. 5.9:1 on `#144a28`. |
| `--cam-dark-line` | → `--cam-white-wash` (15% white) | Rules on the dark ground. |
| `--cam-gold` | `#e8a020` | Institutional gold. |
| `--cam-gold-dark` | `#b87c14` | Gold for text on light. |
| `--cam-warning` | → `--cam-gold-dark` | Warning text. |
| `--cam-warning-light` | → `--cam-gold` | Warning on a dark ground. 4.6:1 on `#144a28`. |
| `--cam-warning-bg` / `-border` | `#fdf3dc` / `#f0d999` | Warning surface and hairline. |
| `--cam-danger` | `#b3261e` | The one danger red. `--cam-error` aliases to it. |
| `--cam-danger-bg` / `-border` | `#fbeceb` / `#f2b8b5` | Danger surface and hairline. |
| `--cam-success` | → `--cam-green` | Success = primary. |
| `--cam-success-bg` / `-border` | `#eaf3ec` / `#c3e0cb` | Success tint and hairline. |
| `--cam-info` | `#1a6896` | Institutional blue (notices only). |
| `--cam-link-blue` | → `--cam-info` | The only blue a component may reach for. |
| `--cam-text` | `#000000` | Body text (owner, pure colours, 2026-10-10). |
| `--cam-neutral-muted` | → `--cam-text-muted` `#555555` | Muted grey. 7.5:1 on white. 307 sites. |
| `--cam-neutral-faint` | `#858585` | Faint grey: placeholders, not-started, disabled. |
| `--cam-border` | `#d9d9d9` | Hairline. 234 sites. |
| `--cam-border-strong` | `#ababab` | Strong hairline. 43 sites. |
| `--cam-focus` | `#e8a020` | The one focus ring, everywhere. |
| `--cam-flag-green` | `#0e5c2b` | Tricolour only — see §6. |
| `--cam-flag-red` | `#ce1126` | Tricolour only. Official value. |
| `--cam-flag-yellow` | `#fcd116` | Tricolour only. Official value. |
| `--cam-portal-cream` | `#f7f5ed` | Public-site ground. The one documented exception — see §6. |

Near-duplicates resolved by usage: `--cam-green` (228) beat `--cam-portal-teal` (8); `--cam-text-muted` (307) beat every other mid-grey; `--cam-border` (234) beat `--cam-portal-line` (1) and `--cam-border-subtle` (5).

### 1.2 Type scale

Already canonical in `tokens.css`; nothing was added or changed. Recorded here as the reference.

| Token | Size | Weight / line-height / tracking | Role |
|---|---|---|---|
| `--cam-font-size-4xs` | 9px | 600–700 · `--cam-line-height-ui` 1.4 · `--cam-tracking-kicker` .03em | Rail brand sub-label only |
| `--cam-font-size-3xs` | 11px | 600 · 1.4 | Micro-labels, badges |
| `--cam-font-size-2xs` | 12px | 400 · `--cam-line-height-label` 1.3 | Hints (`--cam-microcopy-size`) |
| `--cam-font-size-xs` | 13px | 400–600 · 1.3–1.4 | Field hints, captions, chips |
| `--cam-font-size-sm` | 14px | 400 · `--cam-line-height-base` 1.5 | Answers (`--cam-answer-size`), table cells |
| `--cam-font-size-base` | 15px | 500 · 1.3 | Questions (`--cam-question-size`), buttons, inputs |
| `--cam-font-size-input-ios` | 16px | — | Off-ladder: stops iOS zoom on focus |
| `--cam-font-size-lg` | 18px | 600 · `--cam-line-height-title` 1.25 | Section headings |
| `--cam-font-size-xl` | 24px | 600 · 1.25 | Panel KPI |
| `--cam-font-size-2xl` | 25px | 700 · `--cam-line-height-tight` 1.2 | Dashboard KPI |
| `--cam-font-size-3xl` | 32px | 600 · 1.25 · `--cam-tracking-tight` −0.01em | Largest text in the platform |

Families: `--cam-font-sans` (Inter) for everything; `--cam-font-mono` for codes and IDs only. There is no display serif on either side, so nothing had to be reconciled. Weights: 400 / 500 / 600 / 700.

### 1.3 Spacing scale

| Token | Value | Role |
|---|---|---|
| `--cam-space-1` … `-7` | 4 / 8 / 12 / 16 / 24 / 32 / 48px | The ladder |
| `--cam-section-pad-hero` | → 48px | **New tier.** Hero bands |
| `--cam-section-pad-standard` | → 32px | **New tier.** Standard bands |
| `--cam-section-pad-compact` | → 24px | **New tier.** Notice strips |
| `--cam-card-pad-x` | 26px (16px ≤640px) | Wizard card chrome |
| `--cam-auth-card-pad` | 26px | Auth card |
| `--cam-form-field-height` | 40px | Admin control |
| `--cam-respondent-field-height` | 36px | Respondent control |
| `--cam-button-height` | 44px | Button |

The three section tiers are the only spacing tokens added. They reference existing ladder steps; no new length was introduced.

---

## 2. Colour tokens changed from literal to alias

### `src/app/tokens.css`

**Front door (9 of 11 names):**

| Token | Old | New |
|---|---|---|
| `--cam-portal-ink` | `#112530` | `var(--cam-dark-surface)` → `#144a28` |
| `--cam-portal-teal` | `#476c59` | `var(--cam-green)` → `#1e6b3a` |
| `--cam-portal-teal-dark` | `#2e4c3c` | `var(--cam-green-dark)` → `#144a28` |
| `--cam-portal-teal-surface` | `#e8f3ef` | `var(--cam-success-bg)` → `#eaf3ec` |
| `--cam-portal-line` | `#cbd7d1` | `var(--cam-border)` → `#d9d9d9` |
| `--cam-portal-red` | `#b74a42` | `var(--cam-danger)` → `#b3261e` |
| `--cam-portal-yellow` | `#e8bb52` | `var(--cam-warning-light)` → `#e8a020` |
| `--cam-portal-on-ink` | `#ffffff` | `var(--cam-on-dark)` |
| `--cam-portal-on-ink-muted` | `#b9c6cd` | `var(--cam-on-dark-muted)` |
| `--cam-portal-ink-line` | `#2b3f4b` | `var(--cam-dark-line)` |

**Tricolour:**

| Token | Old | New |
|---|---|---|
| `--cam-flag-red` | `#b3202c` | `#ce1126` (official) |
| `--cam-flag-yellow` | `#f0b429` | `#fcd116` (official) |

**Greens — the Tailwind ramp and the bespoke near-misses:**

| Token | Old | New |
|---|---|---|
| `--cam-success` | `#1e6b3a` | `var(--cam-green)` |
| `--cam-success-surface` | `#f0fdf4` | `var(--cam-success-bg)` |
| `--cam-success-border-soft` | `#bbf7d0` | `var(--cam-success-border)` |
| `--cam-success-border-faint` | `#dcfce7` | `var(--cam-success-border)` |
| `--cam-success-mark` | `#16a34a` | `var(--cam-green)` |
| `--cam-success-link` | `#15803d` | `var(--cam-green)` |
| `--cam-success-text-strong` | `#166534` | `var(--cam-green)` |
| `--cam-success-text-deep` | `#14532d` | `var(--cam-green-dark)` |
| `--cam-rail-active` | `#0e4d29` | `var(--cam-green-dark)` |
| `--cam-table-focus` | `#1a5c3a` | `var(--cam-green)` |
| `--cam-green-active-ink` | `#1e7e34` | `var(--cam-green)` |
| `--cam-green-active-wash` | `#e6f4ea` | `var(--cam-success-bg)` |
| `--cam-primary` | `#1d4ed8` (blue) | `var(--cam-green)` |

**Ambers:**

| Token | Old | New |
|---|---|---|
| `--cam-amber-bg` | `#fff8e6` | `var(--cam-warning-bg)` |
| `--cam-amber-border` | `#fcd34d` | `var(--cam-warning-border)` |
| `--cam-amber-badge` | `#fef3c7` | `var(--cam-warning-bg)` |
| `--cam-amber-text` | `#92400e` | `var(--cam-warning)` |
| `--cam-notice-surface` | `#fffceb` | `var(--cam-warning-bg)` |
| `--cam-notice-text` | `#7a6200` | `var(--cam-warning)` |
| `--cam-alert-orange` | `#d9530f` | `var(--cam-warning)` |
| `--cam-alert-orange-text` | `#b03e08` | `var(--cam-warning)` |

**Reds, greys, surfaces:**

| Token | Old | New |
|---|---|---|
| `--cam-error` | `#b3261e` | `var(--cam-danger)` |
| `--cam-error-bg` / `-border` | `#fbeceb` / `#f2b8b5` | `var(--cam-danger-bg)` / `-border` |
| `--vt-red-soft` | `#fff5f5` | `var(--cam-danger-bg)` |
| `--cam-placeholder` | `#858585` | `var(--cam-neutral-faint)` |
| `--cam-rail-upcoming` | `#6e6e6e` | `var(--cam-neutral-faint)` |
| `--cam-status-in-progress` | `#555555` | `var(--cam-neutral-muted)` |
| `--cam-status-not-started` | `#888888` | `var(--cam-neutral-faint)` |
| `--cam-viewer-backdrop` | `#525659` | `var(--cam-slate-600)` |
| `--cam-pdf-viewer-bg` | `#525252` | `var(--cam-slate-600)` |
| `--cam-border-subtle` | `#eeeeee` | `var(--cam-border)` |
| `--cam-surface-2` | `#f2f2f2` | `var(--cam-surface-subtle)` |
| `--cam-bg-subtle` | `#f8f8f8` | `var(--cam-surface-subtle)` |
| `--cam-table-head-bg` | `#ffffff` | `var(--cam-white)` |
| `--cam-table-text` | `#000000` | `var(--cam-text)` |
| `--cam-table-hover` | `#fafafa` | `var(--cam-surface-subtle)` |
| `--cam-bg` / `--cam-surface` | `#ffffff` | `var(--cam-white)` |

**VT wizard** (both the `:root` copy and the `.vt-wizard` block):

| Token | Old | New |
|---|---|---|
| `--vt-yellow` | `#fcd116` | `var(--cam-flag-yellow)` |
| `--vt-red` | `#ce1126` | `var(--cam-flag-red)` |
| `--vt-ink-faint` | `#7a7a7a` | `var(--cam-neutral-faint)` |

`--vt-bg`, `--vt-ink`, `--vt-ink-soft`, `--vt-accent`, `--vt-accent-soft`, `--vt-card-border`, `--vt-card-radius`, `--vt-sidebar-width`, `--vt-font` were **already** aliases — the wizard skin had been reconciled in an earlier pass.

### `src/app/admin-console.css`

| Line | Old | New |
|---|---|---|
| `.cam-admin-rail-hub:focus-visible` | `2px solid var(--cam-flag-yellow)` | `2px solid var(--cam-focus)` |
| `.cam-admin-rail-logout:focus-visible` | `2px solid var(--cam-flag-yellow)` | `2px solid var(--cam-focus)` |
| `.cam-admin-rail-hub-icon` | `background: var(--cam-flag-yellow)` | `background: var(--cam-gold)` |
| status badge `--pending` / `--correction` | `--cam-status-dot: var(--cam-flag-yellow)` | `var(--cam-gold)` |

This is the one change inside the admin stylesheet. It is required by the decision: the flag's yellow could not become the official `#fcd116` while it was also serving as the rail's focus ring, and the focus ring had to become `--cam-focus` to be one colour platform-wide. No `/admin/*` route file was touched.

### `src/components/landing/portal.module.css`

The `.page` re-pointing block was removed. Once `--cam-portal-teal` became `var(--cam-green)`, the rule `--cam-green: var(--cam-portal-teal)` was self-referential, which makes a custom property invalid at computed-value time and would have broken the portal. Removed: `--cam-text`, `--cam-border`, `--cam-green`, `--cam-green-dark`, `--cam-accent`, `--cam-success`, `--cam-gold`, `--cam-error`. Kept: `--cam-bg: var(--cam-portal-cream)`.

Dropping the `--cam-text` re-point also fixed a conflation: `--cam-portal-ink` was serving as both the dark band's background and the portal's body-text colour. The band keeps the name; text returns to `--cam-text` (`#000`).

---

## 3. Typography values changed

| File(s) | Old | New |
|---|---|---|
| `portal.module.css` `.preflightBox` | `font-size: 10px` | `var(--cam-font-size-3xs)` (11px) |
| `admin-console.css` (1 rule) | `font-size: 18px` | `var(--cam-font-size-lg)` |
| `LocaleSwitcher.tsx` | `var(--cam-font-size-xs, 12px)` | `var(--cam-font-size-xs)` (dead fallback removed) |
| 18 component files, 92 occurrences | `fontSize: 9 \| 11 \| 12 \| 13 \| 14 \| 15 \| 18 \| 24` | the matching `--cam-font-size-*` token |

The 92 inline replacements are exact ladder matches, so nothing moved. The 10px → 11px change is the one typographic value that shifted, by 1px, on a decorative checkmark glyph.

No font family was changed anywhere. No line-height or letter-spacing value was changed.

---

## 4. Spacing values changed

| File | Old | New |
|---|---|---|
| `portal.module.css` `.section` | `padding-block: var(--cam-space-7)` (flat 48px) | `var(--cam-section-pad-standard)` (32px) |
| `portal.module.css` | — | `.section:has(> .wrap.hero)` → `--cam-section-pad-hero` (48px) |
| `portal.module.css` | — | `.section.bandTeal` → `--cam-section-pad-compact` (24px) |
| `portal.module.css` `.preflightBox` | `border: 1px` / `border-radius: 2px` | `var(--cam-border-width)` / `var(--cam-radius-sm)` |
| `LocaleSwitcher.tsx` | `borderRadius: 8 \| 4 \| 6` | `var(--cam-radius-control)` / `var(--cam-radius-md)` / `var(--cam-radius-control)` |

The portal's flat 48px is now three tiers. Verified on `/`: hero 48px, status band 24px, journey band 32px.

The locale switcher's portal chip moves from an off-ladder 8px radius to the 6px control radius — this was critique finding D1 (8px was one of seven radii in use).

---

## 5. Hardcoded values removed from outside the canonical `:root`

| Category | Count | Where |
|---|---|---|
| Hex colour literals in `.tsx` / `.ts` | **101 → 0** | 21 component files |
| Dead `var(--token, #hex)` fallbacks | included above | `FormSection.tsx`, `ModernJobsWizard.tsx`, `ConditionalOptions.tsx`, `FactsTracker.tsx`, `LocaleSwitcher.tsx`, `AuthLoadingSplash.tsx` |
| Raw `rgba()` colours in CSS | **10 → 0** | `admin-console.css` (status washes, dialog shadow, backdrop, pulse ring) → `color-mix()` of tokens |
| Hex literals in `.css` outside `tokens.css` | **0** | `globals.css` and `admin-console.css` were already clean |
| Inline `fontSize` numbers on the ladder | **92 → 0** | 18 component files |

Two defects found and fixed along the way:

- `AuthLoadingSplash.tsx` read `var(--cam-surface-ground, #f8fafc)`. **`--cam-surface-ground` is not defined anywhere**, so the fallback was what rendered — the auth splash was painting an undocumented Tailwind slate. Now `var(--cam-bg)`.
- `LocaleSwitcher.tsx` read `var(--cam-text-muted, #52656c)` and `var(--cam-ink, #112530)`; both tokens exist, so the fallbacks were dead code carrying two more off-palette colours.

Verification greps return empty for: hex in `.tsx`/`.ts`, hex in `.css` outside `tokens.css`, raw `rgba()` colour in `.css`, numeric `font-family`.

---

## 6. Tokens that could not be cleanly aliased

| Token | Value | Why |
|---|---|---|
| `--cam-portal-cream` / `-cream-light` | `#f7f5ed` / `#fdfaf4` | **The expected exception.** The canonical system's page ground is white; it has no cream. The owner approved cream as the public site's surface on 2026-10-12. Kept literal. |
| `--cam-flag-green` | `#0e5c2b` | **Open question.** Red and yellow moved to official values. The official flag green is `#007a5e`, which is not this. Changing it is a brand ruling, not a token consolidation, so it is unchanged and flagged. |
| `--cam-logo-green` / `-navy` / `-accent` / `-accent-light` | `#077440` `#021f40` `#0e8445` `#58ad3b` | Artwork colours, not UI colours. They are matched to `public/images/camleap-logo.svg`, which a stylesheet never reaches. Aliasing them would desynchronise the inline mark from the static asset. |
| `--cam-slate-200` … `-800` | 7 steps | The statistical tables' **rule palette** — frame, grid line, group separator, total rule are different weights of line, not text greys. Collapsing seven steps to two would flatten every data-entry table. Left intact, and the report's "two greys" rule applies to text and marks only. |
| `--cam-table-grid` | `#171a18` | Table frame primitive, same reasoning. |
| `--cam-shadow-black` | `#000000` | Named shadow base; black is not otherwise a token. |
| `--cam-info` family | `#1a6896` + tints | The institutional blue for info notices. The decision removed `--cam-primary`'s blue but did not abolish an info colour; `--cam-link-blue` now aliases here so nothing reaches for a second blue. |
| 34 off-ladder inline font sizes | `10, 11.5, 12.5, 13.5, 16, 17, 20px` | No ladder step exists for these. Replacing them would change rendering, which is a design change. Left alone and listed in §11. |
| Locale switcher paddings | `4px 10px`, `3px 8px`, `2px 8px` | 10px, 3px and 2px are not ladder steps. The only tokens holding those lengths are purpose-named for other components (`--cam-auth-inset-10`, `--cam-space-hairline`), so using them here would be semantically wrong. |

---

## 7. Before / after resolution — public portal

| Property | Before | After |
|---|---|---|
| Primary action | `#476c59` | `#1e6b3a` *(verified: hero button renders `rgb(30, 107, 58)`)* |
| Dark surface | `#112530` slate | `#144a28` *(verified: footer renders `rgb(20, 74, 40)`)* |
| Hairline | `#cbd7d1` | `#d9d9d9` |
| Warning | `#e8bb52` | `#e8a020` (4.6:1 on the dark ground) |
| Error | `#b74a42` | `#b3261e` |
| Focus ring | `#e8a020` | `#e8a020` *(unchanged — already canonical)* |
| Body text | `#112530` | `#000000` *(verified)* |
| Largest headline | 32px `--cam-font-size-3xl` | 32px *(unchanged — already the canonical top step)* |
| Body font | Inter | Inter *(unchanged)* |
| Section padding | flat 48px | 48 / 32 / 24 by role *(verified on `/`)* |
| Card padding | 16px / 24px | unchanged *(no canonical card-padding tier exists to reconcile to — see §11)* |

---

## 8. `.tsx` edits — all are literal replacements

21 files for colour, 18 for font size (overlapping set). Every edit replaces a hardcoded literal with a token reference. **No JSX structure, prop, class name or logic was changed.** The two non-mechanical files:

- `src/components/LocaleSwitcher.tsx` — four literal replacements (background, colour, font size, border radius).
- `src/components/auth/AuthLoadingSplash.tsx` — one literal replacement (the undefined-token fallback).

The remaining 19 files were edited by a scripted literal substitution over `fontSize:` numbers, `#hex` strings, Tailwind arbitrary values (`text-[#…]` → `text-[var(--…)]`) and dead `var()` fallbacks.

Tailwind v4.3.3 is in use, where opacity modifiers compile to `color-mix()`, so the two surviving `border-[var(--cam-green)]/20` and `/40` forms are valid.

---

## 9. Test results

```
npm test  →  tests 666 | pass 666 | fail 0 | skipped 0
duration 37.0s
```

---

## 10. Build results

```
npm run build  →  ✓ Compiled successfully in 905ms   (exit 0)
```

Two warnings, both pre-existing and unrelated: Next.js inferring the workspace root from a `package-lock.json` outside the repository.

`npm run check:ui-grammar` was not run — no file under `app/admin/**` or `components/admin/**` was touched.

---

## 11. Visual differences observed

Walked `/`, `/a-propos`, `/declarer`, `/feuille-de-route`, `/login` at 1440×900 in French, plus `/` at 375×812.

**The portal and the admin app now share the same primary green.** Confirmed by measurement, not by eye: the home hero's primary button computes `rgb(30, 107, 58)`, identical to `--cam-green`. The whole public site shifted from the muted sage `#476c59` to the brand green.

**The dark bands changed hue, and this is the largest visible change in the refactor.** The portal footer, the About closing band and the whole `/feuille-de-route` page moved from blue-slate `#112530` to dark green `#144a28`. The roadmap page in particular now reads as the same product as the staff console. Contrast was re-checked rather than assumed: muted text on the dark ground is 70% white over `#144a28` = **5.9:1**, and the warning amber is **4.6:1** — both pass AA.

**The type scale is unchanged, so it does not yet feel different.** The portal's largest headline was already 32px, which is already the canonical top step, so scrolling from a public page into an auth page reads as consistent in *size* — but it reads as consistent because both are small, not because the scale was improved. Critique finding D7 (hero too small, `h2` at lede size) is **not addressed by this work** and cannot be: the ladder has no step above 32px, and adding one is a new font size.

**Section spacing has a rhythm on the home page only.** Verified 48 / 24 / 32. But only `PortalHero` carries the `.hero` wrapper class, so `/a-propos`, `/declarer`, `/feuille-de-route` and `/assistance` have no hero tier — their lead bands went from 48px to the 32px standard, i.e. **tighter than before**. Giving them the hero tier needs a class added in four `.tsx` files, which is a structural edit this pass was told not to make. Flagged as the immediate follow-up.

**Other observations, not fixed:**

- The `/declarer` page still shows three green buttons; they are now all brand green rather than two teals and a teal, so the competing-primaries problem (F3) is unchanged but more visually uniform.
- The locale switcher's active chip is still the pure-black `--cam-ink`; it is now a token reference rather than a literal, but the critique's point (H29/D29 — pure black in a palette built on green) stands.
- At 375px the masthead sign-in button now computes `#ffffff` on `#144a28` (**10:1**). The audit measured 1.67:1 on this same tree earlier today. I could not reproduce the failing state after the token change and **cannot attribute the fix** — the parallel blocker session is working on exactly this file. Treat F1 as needing confirmation from that session, not as fixed here.
- 34 off-ladder inline font sizes remain (10, 11.5, 12.5, 13.5, 16, 17, 20px) across `EventProgress.tsx`, `ProjectProgramScopeQuiz.tsx`, `CameroonGeographySelector.tsx`, `FactsReview.tsx`, `FactsTracker.tsx`. Each needs a decision: round to a ladder step (changes rendering) or add a step (changes the scale).
- There is no canonical card-padding tier. The platform has `--cam-card-pad-x` (wizard), `--cam-auth-card-pad` (auth) and raw 16/24px in the portal. Defining compact/standard card padding is the one piece of §1.3 the canonical system was genuinely silent on.

---

*Uncommitted. Nothing committed, nothing pushed.*
