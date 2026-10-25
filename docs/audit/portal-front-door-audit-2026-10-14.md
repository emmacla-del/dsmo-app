# CAMLEAP front door — design and grammar audit

**Date:** 2026-10-14
**Surface:** `react-web/src/app/(portal)/**`, `react-web/src/components/landing/**`
**Measured against:** `react-web/src/app/tokens.css`, `docs/standards/ui-grammar.md`, `docs/standards/brand.md`, `CLAUDE.md` §8/§11/§13
**State audited:** the working tree as it stands, uncommitted, at `90be890f`. Evidence is `npm run check:ui-grammar`, `git diff`, and DOM measurement of the running dev server at four viewports.

**A note on the brief.** This audit was commissioned as a review of a standalone landing-page HTML file plus a plan to port it into `react-web`. That port happened. The front door is five routes under `src/app/(portal)`, built on a CSS module, with its own section in `ui-grammar.md` dated 2026-10-14. §4 below therefore answers the six port questions against the shipped port rather than proposing one.

---

## 1. Verdict

The portal's second palette was not retired — it was de-tokenised. `--cam-portal-ink`, `-teal`, `-cream`, `-line`, `-red` and `-yellow` were deleted from `tokens.css` in the current working tree, and every one of those colours is still on the page, now written as a raw literal or a dead `var()` fallback where no rule names it and no future rename can reach it. The ratchet caught it — three blocking regressions, `hex-in-module-css` at **0 → 24** on a rule the grammar locks at zero — so the governance works; the work simply has not been corrected. The single thing most worth keeping is the route split: five real URLs with server-rendered bilingual titles and `aria-current` read from the pathname is the correct architecture for a government portal and nothing in this audit touches it. **The front door is structurally right and materially ungoverned: it reads as a careful institutional page that someone has since decorated with a SaaS vocabulary the design system does not contain.**

---

## 2. The seven-lens audit

### Lens 1 — Authority

**Verdict: Fail.**

**1.1 The platform misspells its own name on first paint, five times.** `brand.md` §The name is normative: "written **CAMLEAP**, one word, in capitals… Not CAM-LEAP". The hero eyebrow is `CAM-LEAP / ONEFOP · MINEFOP`, the lede opens `CAM-LEAP is the Cameroon Labour Market…`, and `statusEyebrow`, `aboutEyebrow` and `aboutBody` repeat it — directly beneath a 156px logo that reads CAMLEAP. A state portal that cannot spell its own name consistently in the first two lines has conceded the argument before the visitor reads the third.
→ Replace `CAM-LEAP` with `CAMLEAP` in those five `portalPage` keys in `messages/fr.json` and `messages/en.json`.

**1.2 The lockup's endorsement line is a borrowed footer string.** `PortalMasthead.tsx:83` renders `t("portalPage.footerBody")`, which is `ONEFOP · MINEFOP` — two acronyms in a row. `brand.md` specifies the exact words for the front-door lockup: "Une plateforme de l'ONEFOP" / "A platform of ONEFOP". The one place the brand standard dictates literal copy, the code reaches for a different key.
→ Add `portalPage.endorsement` with those two strings; read it in the masthead.

**1.3 The CAMLEAP logo is being recoloured into UI green.** `globals.css` now paints `.cam-camleap-ink-green` → `--cam-green`, `-navy` → `--cam-green-dark`, and **both leaf accents → `--cam-green`**: four inks collapsed to two. `brand.md` §Logo colours — added in this same working tree — states the artwork's inks are `--cam-logo-green #077440`, `--cam-logo-navy #021f40`, `--cam-logo-accent #0e8445`, `--cam-logo-accent-light #58ad3b`, that "nothing else uses them", and under §Never: "a recoloured… logo". Those four tokens were deleted from `tokens.css` in the same diff that wrote the paragraph asserting they exist.
→ Restore the four `--cam-logo-*` tokens and repoint the four classes back, or amend `brand.md`. The two cannot both stand.

**1.4 The national tricolor is printed in pastel.** `PortalHero.tsx:121–123` draws three bars at `#007a3d`, `#b74a42`, `#e8bb52`. The flag tokens are `--cam-flag-green #0e5c2b`, `--cam-flag-red #ce1126`, `--cam-flag-yellow #fcd116`. `#b74a42` is a muted brick, not Cameroonian red; `#e8bb52` is a dulled ochre, not the flag's yellow. These are the deleted `--cam-portal-red` and `--cam-portal-yellow` values, re-entered by hand. Removing the tricolor would be a defensible decision; printing the flag in the wrong colours is not a decision, it is an error, and on a MINEFOP surface it is the kind a journalist screenshots.
→ Use `var(--cam-flag-green/red/yellow)`, or drop the motif. Not a third colour.

**1.5 The authority leak is architectural, not tonal.** `.heroVisualWrapper` (portal.module.css:531–547) is a mint panel `#d9eeea` with `border-radius: 24px` and `box-shadow: 16px 16px 0 #d8dcd3` — a hard 16px offset drop shadow — containing two cards rotated `-4deg` and `2.5deg`. The radius ladder tops out at 10px plus the pill. `tokens.css` holds exactly one light-surface shadow, `--cam-shadow-sm` at 4% opacity. A hard offset shadow and rotated cards are a sticker-board idiom; they are the loudest object above the fold on a page whose job is to be believed.
→ Delete the wrapper's background, radius and shadow; set the two cards upright. §6 of this audit keeps the paper → digital idea, not its styling.

### Lens 2 — Clarity of purpose

**Verdict: Fail.**

**2.1 The primary action promises something the destination cannot do.** `heroPrimaryAction` is "Submit data" / "Soumettre des données", the nav's second tab is "Submit data", and `/declarer`'s browser title is "Submit data · CAMLEAP". `/declarer` cannot submit anything: it offers registration and sign-in. The hero's own `heroRequirement`, one line above the button, says registration and sign-in are required first. The button contradicts the sentence above it and the page below it.
→ Label it for what it does: "Faire ma déclaration" / "Start a declaration", or "Commencer" / "Get started". Change the nav tab and the route title with it.

**2.2 The fact that decides whether a declarant can act today is buried.** `approvalNotice` — "Registration requires review by ONEFOP before you can file a declaration" — renders at y=827 on `/declarer`, **below all four buttons** (at y=695 and y=743), at 14px in `.flowHint` muted styling, inside a two-column ribbon. An employer against a deadline follows "Submit data" → registers → and only then learns that a human has to approve the account. That is the one thing the page owes them, and it is the quietest text on it.
→ Promote it to the hero's `.heroRequirement` slot on `/` and to the top of `.flowPanel` on `/declarer`, above the buttons, at body size. The existing `heroRequirement` string is the weaker half of the same truth; merge them.

**2.3 The primary action is below the fold on both phones.** Measured:

| Viewport | h1 size | Primary CTA top | CTA bottom | % of fold | Document height |
|---|---:|---:|---:|---:|---:|
| 1440×900 | 44px | 553 | 593 | 61% | 1532 |
| 1024×768 | 32.77px | 551 | 591 | 72% | 1557 |
| 390×844 | 24px | 704 | 744 | 83% | 3270 |
| 360×800 | 24px | 704 | 744 | 88% | 3397 |

At 360×800 the CTA's bottom edge sits 56px from the viewport floor; Chrome's Android toolbar is taller than that, so on a common Android the first action is not visible without scrolling. On iPhone 390×844 with Safari's chrome the button is cut in half. What you scroll past to reach it: a hyphenated eyebrow, a 3-line 44px abstract headline, an 85-word lede, and a requirement strip — **553px of preamble before anything is actionable at desktop width.**
→ Cut the lede to one sentence (the second sentence, "Phase 1 replaces paper-based collection with authenticated digital teledeclarations…", is the one that orients; the first is a mission statement). Move the CTA above the status line. That alone lifts it ~150px.

**2.4 Two buttons, two promises, one destination.** On `/declarer`, "Sign in and declare" and "Check a declaration status" both point at `/login`. There is no status lookup — `status4` says so explicitly ("there is no public lookup"), which is the honest line. The second button implies one exists.
→ Delete `portalActionStatus`, or relabel it "Sign in to see my declarations" so the destination matches the promise.

**2.5 The pre-flight checklist ships pre-ticked.** `PortalDeclare.tsx:78–101` renders five `<li>`s each prefixed with `.preflightBox` containing `✓`, inside `<details open>`. Every item the visitor has not yet gathered is already shown as done, in a disclosure that never discloses.
→ Use a neutral marker (a hyphen rule, or `list-style: disc`); drop `open` or drop `<details>`. Reserve `✓` for state the system actually knows.

### Lens 3 — Grammar compliance

**Verdict: Fail — three blocking regressions, currently uncommitted.**

`npm run check:ui-grammar` on the working tree:

```
✗ hex-in-module-css          portal.module.css              baseline 0 → 24
✗ respondent-hex-in-tsx      PortalHero.tsx                 baseline 0 → 12
✗ respondent-font-size-literal  PortalHero.tsx              baseline 0 →  1
⚠ respondent-spacing-off-scale  PortalHero.tsx              baseline 0 →  3
FAIL: 3 blocking UI-grammar regression(s).
```

**Hard violations**

| # | Rule | Where | What |
|---|---|---|---|
| H1 | G1 / `hex-in-module-css` | `portal.module.css` ×24 | Hex in a CSS module, on a rule the grammar locks at zero. Includes `#334155`, `#cbd5e1`, `#6ee7b7`, `#d9eeea`, `#e8f3ef`, `#d8dcd3`, `#cbd7d1`, `#112530`, `#ffffff` ×5. |
| H2 | G1 / `respondent-hex-in-tsx` | `PortalHero.tsx` ×12 | Tailwind slate (`#e2e8f0`, `#f1f5f9`, `#cbd5e1`, `#94a3b8`, `#475569`) plus the retired ink `#112530` and the pastel tricolor. |
| H3 | G13 | `PortalHero.tsx:86` | `fontSize: 10` — 10px is not on the ladder at all; the grammar states "no 10, 16, or 20 step". |
| H4 | G13 | `portal.module.css:348` | `.title { font-size: clamp(2rem, 3.2vw, 2.75rem) }` — 44px ceiling, above the ladder's 32px top, and at 1024px it renders a fractional 32.77px. |
| H5 | G13 | `portal.module.css` ×10 | `font-size: 24px` ×2, `12px` ×3, `11px` ×4, `10px` ×3 as literals where `--cam-font-size-xl/2xs/3xs` exist and 10px does not. |
| H6 | G13 | `portal.module.css` ×9 | `font-weight: 700` ×7 and **`font-weight: 900` ×2**. The weight tokens are 400/500/600/700; 900 is not a weight this system has, and against the hinted static Inter it will synthesise. |
| H7 | G13 | `portal.module.css` | `letter-spacing: 0.08em` (`.eyebrow`), `0.04em` ×2, `-0.025em` (`.title`); tracking tokens are 0.01/−0.01/0.02/0.03. `line-height: 1.15`, `1`, `1.4`, `1.6` against tokens 1.2/1.25/1.3/1.4/1.45/1.5. |
| H8 | §Shared rules → Alpha | `portal.module.css` ×16 | `rgba()` literals. Four are `rgba(17, 37, 48, …)` — shadows built on the deleted `--cam-portal-ink`. Two are Tailwind emerald (`rgba(16,185,129,.2)`, `rgba(52,211,153,.4)`). |
| H9 | G4 | `PortalDeclare.tsx:35–41` | An inline `style` carrying both `background` and `border` — the grammar's stated mechanical tell for a card. `card-proxy` is advisory, so nothing blocks it. |
| H10 | G14 | `PortalDeclare.tsx`, `PortalSupport.tsx` | Inline `style` carrying colour, border, radius, padding and `fontWeight: 600`. G14: "inline style positions things, classes paint them." |
| H11 | G5 / CLAUDE.md §11 | `/declarer` | **Three `cam-button-primary` on one view**, and the dock's primary — the conventional continue slot, bottom right — is **"Get help" → /assistance**. The page teaches that the way forward is to ask for help. |
| H12 | §Tokens, redundant fallback | `portal.module.css` ×7 | `var(--cam-green, #476c59)` ×5 — the retired teal, parked where it can never fire while the token exists and can never be found by a rename. `var(--cam-flag-red, #b74a42)` names a *different colour* than the token resolves to: the grammar's "the real colour in disguise". |
| H13 | §Public portal, cream exception | `portal.module.css:35–41` | The diff **removed** `--cam-bg: var(--cam-portal-cream)` from `.page` and all three cream call sites, and deleted the token — while adding a header comment that says the exception is in force. `ui-grammar.md` §The cream exception is normative, dated 2026-10-14, and now documents something the code does not do. |

**Soft violations (respected in letter, broken in spirit)**

- **S1 — `.cam-button` is borrowed and then repainted.** `.heroActions a:first-child` / `:last-child` (portal.module.css:508–527) override the shared button's background, border-colour, colour and add a shadow and a `translateY(-1px)` hover. The class passes G5; the *point* of G5 — one button that looks the same everywhere — does not survive. The selectors are positional, so reordering the two links silently swaps their appearance. `PortalSupport.tsx` reuses `.heroActions` and inherits the hack on a page with no hero.
- **S2 — Hover affordances on things you cannot click.** `.statusItem:hover` and `.journeyStep:hover` restyle `<li>` elements that contain no link. `.heroVisual*Card:hover` animates three decorative divs. Prior critique Fix 1.5A asked for exactly this; it is a usability defect, not a polish.
- **S3 — Grey field fill on statements of fact.** `.statusItem` is `background: var(--cam-surface-subtle)` + 1px border + radius: four claims about the platform, boxed and greyed. CLAUDE.md §8 and `.claude/rules/frontend-ux.md` both forbid "unnecessary cards" and "unnecessary grey field fills" by name.
- **S4 — Classes named after colours that no longer exist.** `.bandCream` paints `--cam-bg` (no cream), `.bandTeal` paints `--cam-success-bg` (no teal), `.heroVisualEyebrowTeal` and `.heroVisualEyebrowEmerald` are named for Tailwind families. G1's model is name-by-job.
- **S5 — Depth is derived from colour.** `.section.bandTeal { padding-block: compact }` and `.section:has(> .wrap.hero) { padding-block: hero }`. A band's rhythm tier is inferred from its background class and from a descendant's structure. The explicit `.sectionHero` / `.sectionCompact` classes that exist for this are dead.
- **S6 — No `prefers-reduced-motion` block.** The module now carries eight transforms and transitions including two rotations and a 300ms tween. `globals.css:2172` and `admin-console.css:812` both have the guard; the module has none.
- **S7 — Dead and phantom code.** 16 classes defined and never used (`.actionList`, `.actionRow*` ×6, `.branch`, `.declareRequirement`, `.detailsButton`, `.journeyAction`, `.phaseSummary` + its two `::marker` rules, `.portalActions`, `.sectionHero`, `.sectionCompact`, `.dialogRow`, `.dialogTitle`); `.doors` and `.stateCards` appear **only** inside the 900px media query and are defined nowhere; `PortalDialog.tsx` (68 lines) is never imported, with ~60 lines of CSS behind it. `styles.field` in `PortalDeclare.tsx:62` resolves to `undefined` — the CSS-module analogue of a phantom token, which no check covers.

**Genuine gaps that need a governance decision, not a local fix** — see §5. In short: the ladder has no step between 32px and nothing, which is why the hero reached for `clamp()`.

### Lens 4 — Typography

**Verdict: Weak.**

The brief's premise is already resolved: Fraunces, Space Grotesk and DM Sans never reached the port. `portal.module.css`'s header records the decision — "not its typefaces. The app stays on Inter" — and `--cam-font-sans` is the only family on the surface. **No display family earns a place here and none is present.** That is settled; do not reopen it.

What survived the port is the arbitrary sizing, which is the part that actually hurts.

**4.1 The h1 runs three different mechanisms across the range.** `clamp(2rem, 3.2vw, 2.75rem)` gives 32px at ≤1000px, a sliding fractional size (32.77px measured at 1024), and 44px from 1375px up — and then `@media (max-width: 900px)` overrides the whole thing to `--cam-font-size-xl` (24px). So the clamp's lower bound never renders, and only one of the three sizes the visitor can meet (24px) is on the ladder. Two responsive mechanisms, one cancelling the other.
→ **If it must obey the ladder today:** `--cam-font-size-3xl` (32px) with `--cam-line-height-tight` (1.2) and `--cam-tracking-tight` (−0.01em), keeping the existing 24px below 900px. Delete the clamp. That is a one-line change and it is defensible: 32px over a 623px measure on a page with no competing content reads as a headline, not as a body paragraph.
→ **If 32px proves too quiet at 1440**, that is a real ladder gap and it is a reviewed act: see §5.

**4.2 The ladder does not contain 16px.** The brief lists the steps as 9/11/12/13/14/15/16/18/24/25/32; `tokens.css` and G13 have no 16 step — `--cam-font-size-input-ios` (16px) is the iOS control floor and is explicitly "not a ladder step". Worth correcting in any brief that goes to an implementer, because 16px is exactly the size someone will reach for.

**4.3 `font-weight: 900` is not a weight this system owns** (portal.module.css:579, 606, on the hero figure's "01"/"02" numerals). With the hinted static Inter the browser will synthesise it — the smeared result is the same class of defect as the font blur fixed in `6a6a0f1b`.
→ `--cam-font-weight-bold` (700).

**4.4 The eyebrow's tracking is nearly three times the token.** `letter-spacing: 0.08em` against `--cam-tracking-kicker` (0.03em). At 13px bold uppercase with a slash and a middot (`CAM-LEAP / ONEFOP · MINEFOP`), 0.08em pushes the string toward a line of disconnected glyphs — the prior critique noticed it reads "cramped" in French and prescribed the opposite of the fix.
→ `var(--cam-tracking-kicker)`.

**4.5 `.lede` is set in Tailwind slate-700 (`#334155`) at `line-height: 1.6`.** The owner's 2026-10-10 decision is pure neutrals — `--cam-text-muted` is `#555555` — and `#334155` is a blue-tinted grey. The second-most-read line on the site is the one place the "no tinted neutrals" rule is broken.
→ `var(--cam-text-muted)`, `var(--cam-line-height-base)` (1.5).

### Lens 5 — Layout and composition

**Verdict: Weak.** The skeleton is right; the fold and the container discipline are not.

**5.1 The fold.** Numbers in 2.3. The composition works at 1440 and nowhere else. At 1024×768 the figure is 388px wide against a 525px headline — two columns of near-equal visual weight, neither dominant. At 390 and 360 the grid collapses to one column and the figure drops **below** the CTA, so a phone visitor meets: headline, lede, requirement, buttons, status line, then a 529px decorative diagram, then the status band. The figure occupies 63% of a phone viewport and carries no action and no fact the headline does not.
→ At ≤900px, `display: none` on `.heroVisualWrapper`. It is the only element on the page that is purely illustrative; it should not cost a phone visitor two thirds of a screen.

**5.2 The grid.** `.wrap` is `max-width: 1180px` and does govern every band — that part is consistent. Inside it, five further measures appear with no stated relationship: 860 (`.flowFrame`), 760 (`.panel`, `.faq`), 520 (`.dialog`), 490 (`.heroVisualWrapper`), plus `58ch` (`.lede`) and `68ch` (`.intro`). The grammar permits literal `max-width` in a module, so none of these is a rule violation — but two reading measures (58ch and 68ch) on the same page, for text at the same size, is a wobble nobody chose.
→ Collapse `.lede` and `.intro` to one measure. 760px is already the module's reading width; use it for both and delete the `ch` values.

**5.3 `/declarer`'s one content block hangs off the left of its own container.** Measured at 1440: `.flowFrame` spans x=146→1006 inside a `.wrap` spanning 122→1302. That is 24px of margin on the left and **296px of empty ground on the right**. `.flowFrame { max-width: 860px }` has no `margin-inline: auto`. The prior critique recorded the same defect on `/assistance` ("more than 600px of desolate cream canvas") and it was never fixed; it is one declaration.
→ `margin-inline: auto` on `.flowFrame`, `.panel` and `.faq`. Then delete `PortalSupport.tsx:24`'s `style={{ maxWidth: "100%" }}`, which exists only to cancel `.panel`'s width because the centring was missing.

**5.4 The scroll rhythm is a property of the component, not of the route.** Each section hardcodes its own band class, so the page's colour sequence is decided by whichever components a route happens to import: `/` is cream→tint→cream, `/declarer` cream→tint→white, `/a-propos` cream→white→cream→ink. Reorder two imports and two identical grounds meet with an invisible seam — the exact failure `6be2e78e` had to fix for the footer.
→ Hoist the band to the route. Either pass a `tone` prop, or wrap: `<PortalBand tone="cream"><PortalHero/></PortalBand>`. The route composes the rhythm; the section renders content. Then put the depth tier on the element with the dead `.sectionHero` / `.sectionCompact` classes and delete the `:has()` and `.bandTeal` padding rules, so depth stops being derived from colour.

**5.5 The hero's two-column split is a default, and the right column is the strongest object on the page.** Measured at 1440 the figure is 461×488 starting at y=150 — larger than the headline's box, more saturated than anything else above the fold, and animated on hover. In the first 1.5 seconds the eye goes: mint block → headline → lede → (eventually) button. That is the reverse of the intended sequence.
→ Either shrink the figure to roughly a third of the column and move it below the CTA, or drop the second column on this route and let the headline, one-sentence lede and one button own the fold. The second is the stronger government-portal move and is what makes 5.1 unnecessary.

**5.6 Cross-section coherence is good and should be protected.** `.eyebrow` / `.title` / `.heading` / `.intro` / `.notice` / `.noticeLabel` are genuinely shared across all five routes, and `PortalStatus` renders every state — hero, phase, transformation step — through one component. This is the page's best structural decision. The erosion is `.heroActions` being reused on `/assistance` while carrying hero-only positional overrides, and `.phaseTitle` appearing once as an `<h2>` and once as a `<p>` in `PortalRoadmap.tsx`.

**5.7 The archaism test.**

| Pattern | Verdict |
|---|---|
| Masthead with four tabs + language switch + sign-in | **Keep.** This is government convention, not 2019 habit, and it is the only navigation the page needs. |
| Hero: text left, illustration right | **Habit.** See 5.5. A state portal's fold is a statement and an action, not a diptych. |
| Four-step numbered journey (`.journey`) | **Keep.** The order is the content and it is an `<ol>`. Correct. |
| Four-item claims grid (`.statusList`) | **Keep the content, drop the boxes.** See S3. |
| Three-card "eras" row (`.story`, `/a-propos`) | **Keep, flat.** Already de-rotated; the comment records why. |
| Accordion FAQ (`<details>`, `/declarer`) | **Keep.** Three questions, native element, no JS. |
| Accordion roadmap | **Already correctly abandoned** — four phases of three lines each are cards, and `PortalRoadmap.tsx` says why. Delete the leftover `.phaseSummary` rules. |
| Two-column "achieved / next" (`.progressGrid`) | **Keep.** The split is the message. |
| Pre-flight checklist in an always-open `<details>` | **Habit, and misleading.** See 2.5. |

### Lens 6 — Visual density and rhythm

**Verdict: Weak.**

**6.1 The rhythm system is right and bypassed.** `--cam-section-pad-hero/standard/compact` (48/32/24) exist, are documented in `ui-grammar.md` §Section rhythm, and are the correct answer to the brief's "does it wobble between py-16/20/24" question. They are then applied by inference (S5) rather than by the two classes built for it.

**6.2 Where the spacing actually goes off-scale.** `.heroVisualWrapper { padding: 28px 30px }` and its `right: 24px; top: 24px` dot; `PortalHero.tsx`'s `marginTop: 14` ×2, `marginLeft: 6`; `.statusItem::before { margin-top: 2px }`. The scale is 4/8/12/16/24/32/48. Every one of these is inside the hero figure — the decorated region is also the only unmeasured one.

**6.3 Where it breathes wrongly.** `.hero { gap: var(--cam-space-7) }` (48px) between the two columns at 1440 is correct; at 1024 the same 48px against a 388px figure crushes the text column to 525px. The grid collapses only at 900px, so 901–1100px is the page's worst width.
→ Collapse `.hero` to one column at 1024, not 900, and drop the gap to `--cam-space-6` between 1024 and 1180.

**6.4 Transition durations are invented four times over.** `--cam-transition-fast` is `150ms cubic-bezier(0.2, 0, 0, 1)`. The module writes `0.3s cubic-bezier(0.2, 0, 0, 1)` ×2 (the token's easing, hand-copied with a different duration), `0.2s ease`, `150ms ease` and `180ms ease-out`, plus `transition: all` on `.heroActions a`.
→ One token, everywhere. `transition: all` animates layout properties and should never appear.

### Lens 7 — The honest test

**Verdict: Fail on one sentence; otherwise unusually good.**

**7.1 The benchmarking note offers a benefit nobody can honour, for a duty that is already compulsory.** `benchmarkBody`:

> "Sector benchmarking and salary brackets will be delivered in Phase 3. **Filing in Phase 1 helps prioritize your organization for early access** — but no commercial promises are made until the analytical layer is operational."

Three problems in one sentence. It offers queue priority that no mechanism exists to grant. It frames a statutory declaration as something you do to earn a perk. And "no commercial promises" ("aucune promesse commerciale") describes a ministry service in the vocabulary of a vendor. This is the page's single overclaim and it is the one a journalist would quote.
→ Rewrite to the fact and stop: "Sector benchmarking and salary brackets belong to Phase 3. They depend on the analytical layer, which does not yet exist. Nothing on this page should be read as a commitment to a date." / "Le benchmarking sectoriel et les grilles salariales relèvent de la phase 3. Ils dépendent de la couche analytique, qui n'existe pas encore."

**7.2 The page commits on the one thing furthest out and hedges on everything nearer.** `transform4Status` is "Phase 4 · planned (2027)" — the only date on the site, attached to "Massify via Web & AI", the least-specified item. Phases 2 and 3 carry no date at all.
→ Remove the year, or give every phase one. The asymmetry reads as marketing.

**7.3 Two components contradict their own comments.** `PortalSupport.tsx`: "The reference mockup prints a city under its contact line; the truth pass took that out and **it stays out**" — and the file renders `helpLocation`, "Yaoundé, Cameroun". `PortalProgress.tsx`: "the wording names the dispositifs" — and `achieved1Body` names a population ("for employers and CFP centres"), not a dispositif, so "paperless workflow" reads as a claim about the whole ministry.
→ Delete the `helpLocation` line. Reword `achieved1` to name the two collections.

**7.4 `helpLocation`'s English string is in French.** `"Yaoundé, Cameroun"` in `en.json`. Moot if the line goes, but it is the only untranslated string in 196 keys and worth knowing the check does not catch it.

**7.5 What is honest and should be defended.** `status4` — "History and receipts are available in the authenticated account; **there is no public lookup**" — states a limitation most portals would omit. `phase1Desc` enumerates exactly what phase 1 does and claims nothing beyond it. Every phase and transformation step carries a real state through `PortalStatus` rather than four equal promises. `PortalHero`'s campaign query fails silently and renders no date rather than an invented one. This is the page's strongest quality and the thing most at risk from the next polish pass.

**7.6 One claim this audit could not verify.** `achieved2` — "Instant receipt: issued immediately upon submission as a PDF with a unique tracking number." Flagged, not disputed: confirm a declaration submission actually emits a PDF receipt with a tracking number before this ships. Registration does; declaration submission was not exercised here.

---

## 3. The rewrite priority

1. **Clear the three blocking ratchet failures** — 24 hex in the module, 12 + 1 in `PortalHero.tsx`. Everything else in this list is cosmetic until the surface compiles against its own rules; and leaving them lets the next commit raise a baseline to get past them.
2. **Delete the hero figure's decoration** — mint ground, 24px radius, 16px offset shadow, two rotations, three hover lifts, `font-weight: 900`, the pastel tricolor. This single edit removes roughly two thirds of items 1's violations and is the largest authority gain on the page.
3. **Relabel the primary action and the nav tab** from "Submit data" to "Start a declaration". One string in two files; it stops the page promising what the next click cannot deliver.
4. **Move the ONEFOP-approval requirement above the buttons** on `/` and `/declarer`, at body size. It is the fact that determines whether a declarant can act today, and it is currently the quietest text on the route.
5. **Fix `benchmarkBody`.** One sentence, and it is the only thing on the site that could be quoted against the ministry.
6. **Spell the platform CAMLEAP** in the five `portalPage` strings, and give the lockup its own endorsement string. Trivial effort, and misspelling your own name is the cheapest credibility loss available.
7. **Centre `.flowFrame`, `.panel` and `.faq`** (`margin-inline: auto`) and delete the `maxWidth: "100%"` override in `PortalSupport`. Three declarations; removes a visible 296px hole on two routes.
8. **Resolve the three doc/code contradictions** — the cream exception, the `--cam-logo-*` tokens, and the retired `--cam-portal-*` family now living as literals. Each needs a yes/no from the owner, not an engineering decision. While they stand, `ui-grammar.md` and `brand.md` are describing a product that does not exist, which is how the next agent gets it wrong too.
9. **Hoist the band tone to the route** and put the depth tier back on `.sectionHero` / `.sectionCompact`. Stops rhythm being derived from colour and makes reordering safe.
10. **Add the `prefers-reduced-motion` block** and delete the dead code (16 classes, 2 phantom selectors, `PortalDialog`, `styles.field`). The module is 1549 lines carrying the fossils of three abandoned designs.

---

## 4. The port — what it got right, and what to correct

The port is done. Answering the six questions against it:

**Route.** Correct as built. `src/app/(portal)` is a route group, so the group folder adds no segment and home stays at `/`. Five routes: `/`, `/declarer`, `/feuille-de-route`, `/assistance`, `/a-propos`, plus the branded 404. `/register` and `/login` were not moved and should not be — they are the wizard surface with its own shell. Nothing has to move. One correction: `/declarer`'s metadata title is "Submit data", which inherits item 3's wrong label.

**Shell.** `(portal)/layout.tsx` wraps all five in `.page` > skip link > `PortalMasthead` > `<main id="contenu">` > `PortalFooter`. The third container exists and is **1180px** (`.wrap`), against `.cam-admin-main`'s 1360 and `--cam-container-wizard`'s 600. 1180 is the right width and needs no token: `ui-grammar.md` §Public portal states that `max-width` is a layout value and not a token concern. Do not add `--cam-container-portal`; the brief's premise that a third container token is needed is already answered by the grammar. What *does* need fixing is that three inner frames (860/760/760) are uncentred inside it.

**Component decomposition.** Right on the repeating parts, wrong on one. `portal-content.ts` holds the data (nav, journey, phases, actions, story, achievements) and the copy lives in `messages/*.json` under `portalPage.*`, so a wording change never touches a component — that is the correct line. `PortalStatus` is the model case: one state object, one component, used by the hero, every phase and every transformation step. The error is `PortalDeclare.tsx`, which renders two pathway cards as hand-written duplicate JSX — same structure, same classes, different data — while `PORTAL_REGISTRATIONS` already exists in `portal-content.ts` for exactly that. It is also where the duplicated `declarePanelHint` string and the inline card styles live.
→ Map `PORTAL_REGISTRATIONS`; delete the second copy of the markup.

**Class strategy.** Settled, and the brief's `.cam-marketing-*` proposal is wrong for this repo. `ui-grammar.md` §Public portal makes the portal the one surface whose styling lives in a CSS module with unprefixed local classes (`.page`, `.masthead`, `.bandInk`, `.journeyStep`) — that is correct for a module and the `cam-*` prefix would be noise. What the portal may borrow needs writing down, because the current answer is being invented per call site:

| Borrowed | Allowed? |
|---|---|
| `.cam-button` + `-primary` / `-secondary` | **Yes, unmodified.** Today the module repaints it positionally (S1). That is the thing to stop. |
| Every `--cam-*` token in `tokens.css` | Yes. This is the whole point of the module. |
| `.cam-table`, `.cam-dash-table` | No. The portal has no record lists. |
| `AdminDialog`, `.cam-admin-*`, `.cam-field`, `.cam-badge` | No. Staff-console recipes. `PortalDialog.tsx` built a hand-rolled one and is unused — delete it rather than wire it up. |
| `.cam-question` / `.cam-answer` / `.cam-hint` (G16) | No. The portal has no respondent form. `.flowHint` is the portal's own and should stay. |

**The animation.** CSS, as the brief says. The module already expresses everything in CSS — `@keyframes camDetailsFadeIn` and class-based transitions, no `useEffect` toggling anything. The gap is only the guard: there is no `@media (prefers-reduced-motion: reduce)` block in `portal.module.css`, while `globals.css:2172` and `admin-console.css:812` both have one to copy. Add it in CSS; no JS, no hook, no `matchMedia`.

**The bilingual toggle.** Already a locale provider, not a `document.documentElement.lang` toggle. `next-intl` throughout: `useTranslations` in client components, `getTranslations` in the layout, `LocaleSwitcher variant="portal"` in the masthead, and `portal-metadata.ts` giving each route a server-rendered title in the visitor's language. Nothing to add. Two defects inside it: the English `helpLocation` is French, and nothing checks for that.

**The grammar ratchet.** The rules exist under different names than the brief assumes — there are no `marketing-*` rules, because the portal is covered by `hex-in-module-css` plus the four `respondent-*` rules. Current counts and targets:

| Rule | Baseline | Now | Target | Blocks? |
|---|---:|---:|---:|---|
| `hex-in-module-css` | 0 | **24** | 0 | yes — locked at zero, no baseline |
| `respondent-hex-in-tsx` (`PortalHero.tsx`) | 0 | **12** | 0 | yes |
| `respondent-font-size-literal` (`PortalHero.tsx`) | 0 | **1** | 0 | yes |
| `respondent-spacing-off-scale` (`PortalHero.tsx`) | 0 | **3** | 0 | advisory |
| *(proposed)* `font-metric-literal` in modules | — | ~19 | 0 | — |
| *(proposed)* `rgba-literal` in modules | — | 16 | 0 | — |
| *(proposed)* `phantom-module-class` | — | 1 | 0 | — |

These started at zero because the port was the moment to get it right. **Do not raise a baseline to land this work.**

---

## 5. Token and grammar deltas

### Tokens

| Name | Value | Why it is a real gap, not a convenience |
|---|---|---|
| **Restore** `--cam-portal-cream` | `#f7f5ed` | Not a new token — a deletion to revert. `ui-grammar.md` §The cream exception is normative, dated 2026-10-14, and names `.page` as its single read site. The code dropped it; the document still mandates it. Restore, or amend the grammar in the same commit. Owner's call; the recorded decision says restore. |
| **Restore** `--cam-logo-green` / `-navy` / `-accent` / `-accent-light` | `#077440` / `#021f40` / `#0e8445` / `#58ad3b` | Same: `brand.md` §Logo colours asserts they exist in `tokens.css` and forbids a recoloured logo. Deleting them repainted the launch mark in UI green and collapsed four inks to two. |
| `--cam-font-size-4xl` | `2.5rem` /* 40px */ | **Only if 32px proves too quiet at ≥1180px.** The ladder was built for the working application, where 32px is the largest number on a dashboard; the front door is the one surface with no competing content, and 32px over a 623px measure may under-read. This is a reviewed act — add the step, or keep the hero at `3xl`. Do not ship a `clamp()` as the answer to the question. |

**Not token gaps, and should not become any:**
- A tricolor colour — `--cam-flag-green/red/yellow` already exist and are the correct values.
- A raised shadow for card hovers — the page should not have card hovers (S2). Adding `--cam-shadow-raised` would make a decoration permanent.
- A 24px radius — the ladder is 2/4/6/10/pill plus two named purpose values. The hero figure should not have a radius at all.
- A 10px font size — nothing on a public page should be 10px.

### `ui-grammar.md`

| Section | Rule to state |
|---|---|
| §Public portal → What is enforced | **Extend the module scan past hex.** `font-size-literal`, `font-metric-literal` (weight / line-height / letter-spacing), `rgba-literal` and `spacing-off-scale` apply to `*.module.css` as they do to the wizard globs, locked at zero. Reason to record: `hex-in-module-css` caught the 24 colours and nothing caught the 19 type literals or the 16 `rgba()`s in the same file, because no rule looked. |
| §Public portal → What is enforced | **New check `phantom-module-class`.** A `styles.X` with no matching selector in the module resolves to `undefined` and silently renders unstyled — the exact reasoning the grammar already gives for phantom tokens. `styles.field` (`PortalDeclare.tsx:62`) is live today. No baseline. A companion advisory pass reports selectors defined and never used (16 now). |
| §Public portal → new ¶ **Borrowing** | The table in §4 above: `.cam-button` and every `--cam-*` token, nothing else. **A borrowed class is used unmodified** — a module rule that repaints `.cam-button`'s colour, border or shadow defeats the one reason to borrow it. Positional selectors (`:first-child`) on borrowed classes are forbidden outright. |
| §Public portal → new ¶ **Motion** | Every transition reads `--cam-transition-fast`. The module carries a `@media (prefers-reduced-motion: reduce)` block, as `globals.css` and `admin-console.css` do. `transition: all` is forbidden. **No hover affordance on a non-interactive element** — a hover state is a promise that a click does something. |
| §Public portal → new ¶ **Bands** | The band tone and the depth tier are set by the route, not by the section component, so reordering cannot put two identical grounds together. Depth is `.sectionHero` / `.section` / `.sectionCompact` on the element — never inferred from the band's colour or from a `:has()` on a descendant. |
| §Working from Figma → rename **Working from a reference** | The existing rule already says a frame is authority for structure, never for values. Extend it by name to critique documents: **a document in `docs/audit/` describes; it does not prescribe values.** A prescription of a colour, size, radius, duration or shadow in an audit is a request to `tokens.css`, which is a reviewed act. Every audit doc carries a `**Status:**` line, and a superseded one says so in its first paragraph. |

**Why that last rule is the important one.** `docs/audit/portal-design-critique-2026-10-13.md` is the proximate cause of most of §2 and §3. It names the retired palette (`#112530`, `#476c59`, cream) as the portal's "Biggest Design Strength" — the day the owner retired it — and prescribes, with values: Fix 1.5A, `transform: translateY(-2px)` with `box-shadow: 0 4px 12px rgba(17, 37, 48, 0.08)`; Fix 1.6A, `letter-spacing: -0.025em` on the display h1; Fix 1.1C, a 12px/8px radius system with 2px elevation; Fix 1.3C, `#25D366`. The first two are in `portal.module.css` verbatim, including the `rgba()` built on a token that no longer exists. It also asks for hover feedback on informative cards (S2), commissioned illustration and photography (against CLAUDE.md §8), and a tighter display tracking than any token allows.

**The regression is not carelessness. It is compliance with a document that nothing marked as superseded**, and which was more specific about values than the normative grammar is. `339c4a63` happened because a PNG carries no token names; this happened because a critique carries hex. The ratchet is the countermeasure for the first. A status line on audit documents is the countermeasure for the second.
→ Add `**Status:** superseded by docs/audit/portal-front-door-audit-2026-10-14.md. Its colour, radius, shadow and tracking prescriptions name the retired `--cam-portal-*` palette and must not be implemented.` to the top of the 2026-10-13 critique.

---

## 6. What to leave alone

- **The five-route architecture.** Real URLs, server-rendered bilingual titles, `aria-current` from the pathname, nothing hidden in the DOM to fake a tab. Correct, and the thing most worth protecting through the rewrite.
- **`portal-content.ts` + `messages/*.json` as the content layer.** A wording change touches no component; adding a phase is one line plus two strings.
- **`PortalStatus`.** One state object rendered one way in every place a state appears. This is what G1's enum→class mapping looks like done properly.
- **The honest copy.** `status4`'s "there is no public lookup", `phase1Desc`'s enumeration, every phase carrying a real state, the silent campaign-date failure. Defend these against the next polish pass; they are what makes the page credible.
- **Inter, and no display family.** Settled on 2026-10-12 and recorded in the module's header. Do not reopen it.
- **The section-rhythm tokens.** `--cam-section-pad-hero/standard/compact` are the right answer to vertical rhythm; only their application needs fixing.
- **The masthead lockup's 56px emblem.** It honours `--cam-brand-emblem-min` and `brand.md`'s reasoning about the seal's ring lettering. The only change it needs is its endorsement string.
- **The non-sticky masthead and the non-sticky dock.** Both are deliberate, both are recorded, both are right for a government page on a phone.
- **`<details>` for the FAQ, an `<ol>` for the journey, a `<ul>` for the phases.** The semantics match the content in each case.
