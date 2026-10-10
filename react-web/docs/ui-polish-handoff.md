# UI polish pass — handoff (2026-10-10)

For the next coding agent. Read this, then `docs/ui-polish-checklist.md`
(route checklist), `../CLAUDE.md`, and `../docs/standards/ui-grammar.md`.

## Scope and working rules (agreed with the owner)

- **This is a government platform.** Judge every review and edit against
  public-sector form conventions (GOV.UK Design System as the reference):
  actions at the end of the form, error summary at the top, one primary
  action, labels above fields, plain wording, WCAG 2.2. No SaaS patterns.

- **react-web only.** No Flutter, no backend changes (backend is paused).
- Owner's brief: systemic UI/UX fixes over cosmetic ones; fix the shared
  component/token, not each page. Institutional, data-dense look; no SaaS
  cards, decorative containers or wasted whitespace. Inspect every route's
  rendered page and its key interactions before ticking it in the
  checklist. Preserve functionality; small reviewable changes; work through
  the full route inventory.
- **One commit per batch, stop for the owner's diff review between
  batches.** Stage files explicitly (never `git add -A`). Code and docs in
  separate commits. **Never `git push`** — the owner pushes.
- ONEFOP/VT declaration wizard: **shared spacing/typography/alignment fixes
  only** (shared components + tokens). No changes to flow, gateways,
  statistical semantics or questionnaire structure.
- Gates before every commit, from `react-web/`:
  `npx tsc --noEmit -p .`, `npx eslint <changed files>`,
  `npm run check:ui-grammar`, `npm test` (445 passing at 58fdd865).
- **`check:ui-grammar -- --update` rewrites every entry and RAISES
  advisory baselines that are over.** Never commit a raised baseline.
  After `--update`, hand-revert any increase (see 58fdd865 for an example).
- Known pre-existing lint errors (not ours): `src/app/admin/layout.tsx:60`
  (set-state-in-effect), `src/app/home/declarations/page.tsx` (`any`, ~l.494).

## Browser / data

- Dev servers: start both with `preview_start {name: "react-web"}` and
  `{name: "backend"}` (`.claude/launch.json`); the backend takes ~40s. Backend at localhost:3001 uses
  the **shared database**: read and navigate only; ask the owner before any
  save/approve/submit/send/delete. Never submit the registration wizard.
- The owner supplied a SUPER_ADMIN test login for localhost in chat on
  2026-10-10; ask them for it again (credentials are not recorded here).
  A respondent (company) test account is still needed for `/home/**` and
  `/onefop/preview` — ask the owner.
- Controlled React inputs: `form_input` does not update React state. Set
  values via the native value setter + `input`/`change` events, or click +
  type.

## Done (committed, not pushed)

| Commit | What |
|---|---|
| 58fdd865 | Auth family on one card shell (reset/forgot-password, verify-email). |
| 701c81e9 | `docs/ui-polish-checklist.md` |
| 8b201155 | Registration wizard one column at every width + page scroll (owner's decision). `scripts/test-register-layout.mjs` 155/155 against localhost, no submission. Backend was down, so region/department option loading was not exercised. |
| b161783a | Admin: page-level margins no longer stack on the `.cam-admin-page` gap; `/admin/sectors` one header. **Not yet seen rendered** — now verified rendered (see 9bf53ca9); dossiers/[id] still to view. |
| 2032ee18 | DSMO inputs keep focus (inner components hoisted); ONEFOP drafts/corrections route to `/onefop/preview?entity=<entityType>`. **Not yet seen rendered** (needs a company account). Unverified: whether the ONEFOP wizard reopens that submission's data. |
| 68e2205b | Registration footer at the end of the form (not sticky) and an error summary with field links at the top of the section — owner's decision, government-form convention. Layout script 158/158. |
| 9fd8c69f | Landing notices a ruled list; /inscription-agent back-to-sign-in link. |
| 9bf53ca9 | ViewSwitch stray vertical scrollbar (systemic); French "Chargement de les" → "des" (systemic, tested); cibles 24px rhythm. Admin rhythm from b161783a verified rendered on dossiers, centre-qualite, diffusion, etablissements, inscriptions, utilisateurs, cibles, pilotage, sectors (all 24px). |
| 5f0a6748 | ui-grammar.md / tokens.md record the one-column wizard. |

Gates at 5f0a6748: tsc clean; eslint no new findings (pre-existing errors
in centre-qualite, diffusion, dossiers, admin/layout, home/declarations);
check:ui-grammar PASS; npm test 445/445.

## Next batches (from the two read-only audits, 2026-10-10)

Admin (systemic first):
1. `.cam-table` density: `line-height: var(--cam-line-height-ui)`; th sentence
   case / no tracking / weight 600 (visible — show owner); `DataStateRow`
   pass `dense` (loading row ~140px → jump).
2. `.cam-table .is-num { text-align:right; font-variant-numeric: tabular-nums }`
   in globals.css; use on utilisateurs:282,324, inscriptions:438,
   GroupInvitationLinks:95,123.
3. "0 results" while loading: `query.data?.total ?? 0` → `?? null` + `count()`
   in UsersDirectory:122, CompaniesDirectory:130, inscriptions:234 (G10).
4. Filter bars boxed separately from their table (dossiers:454, equipe:186,
   etablissements:367, inscriptions:343, journal-audit:254) → sectors
   composition (filters + table in one `.cam-admin-section`).
5. One `AdminPager` + one page size; centre-qualite (limit 50, no pager) and
   utilisateurs (50, no pager) silently truncate. Page size change = owner OK.
6. KPI idioms → one strip with loading/error/unavailable states (5 pages);
   `.cam-dash-pipeline` `repeat(6)` with 4–5 stages.
7. Hub tabs filled green compete with primary (admin-console.css:1168-1218).
8. Mobile: admin inputs 14px → iOS zoom; use `--cam-font-size-input-ios`
   under 640px. utilisateurs:548 dialog `1fr 1fr`.
Needs domain/backend decision, don't touch: dossier review sections
unavailable + decision buttons on terminal statuses (dossiers/[id]);
CompaniesDirectory sort is page-only; campagnes "Soumissions collectées"
hardcoded "—"; pilotage dead columns.

Respondent (in agreed scope):
1. `FieldControl.tsx`: Modern Jobs radios/checkboxes use boxed
   `ui/AccessibleRadioGroup|CheckboxGroup` (CLAUDE.md §9) → use the VT
   `form/Radio`/`form/Checkbox` groups; also removes the doubled "select all
   that apply" and duplicate ids. Check empty `[]` vs `undefined` handling.
2. `TableRenderer.tsx:312` `maxHeight: 75vh` nested scroll → `overflowX` only.
3. Inputs: unify `.sovereign-text-input/-select` (height, radius, 1px focus
   border); strip inline duplicates in FieldControl / VtWizardFields.
4. Table cell padding/input height tokens shared by the 4 table renderers.
5. Shared step header + footer buttons (`cam-button`) for VT / Modern Jobs.
6. Landing "Avis aux déclarants" cards → ruled list
   (`components/landing/landing.module.css:194-200`).
7. Hardcoded strings: WizardShell "Section x / y", "Sauvegarde...", home
   layout "Menu".
Needs UX/domain review: question codes shown to respondents (S1Q01…);
DSMO Yes/No as single checkboxes (unanswered stored as No); multiple green
primaries on /home; emoji removal; Yes/No segmented → radio.

## Route checklist status
See `docs/ui-polish-checklist.md`. Done: auth family. Inspected with issues:
`/`, `/register`, `/inscription-agent` (invalid-link state has no way back
to sign-in). Every admin and respondent route still needs its rendered
inspection.
