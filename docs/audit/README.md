# CAM-LEAP admin console audit — index

Audit date: 2026-11-02, open items settled 2026-11-06. Source state: branch `master`, commit `f9589993`.
Uncommitted admin work that appeared in the working tree after that (rail, filter bars, saved views, a registration review route `inscriptions/[id]`, among others) is **not** described here; neither the text nor the screenshots cover it.
Read-only audit: no source file was changed to produce it.

The audit is split into four parts, to be read in order:

| Part | File | Sections |
|---|---|---|
| 1 | [admin-console-audit-part-1.md](admin-console-audit-part-1.md) | 1 Overview · 2 Route inventory · 3 Shell and navigation · 4 Roles, scope and permissions |
| 2 | [admin-console-audit-part-2.md](admin-console-audit-part-2.md) | 5 Page-by-page specification (19 routes) |
| 3 | [admin-console-audit-part-3.md](admin-console-audit-part-3.md) | 6 Domain model · 7 Lifecycles and state machines · 8 User flows |
| 4 | [admin-console-audit-part-4.md](admin-console-audit-part-4.md) | 9 Shared components · 10 Design system · 11 Data and API · 12 Copy and localization · 13 Gaps and debt · 14 Open questions |

## Conventions

- Paths are relative to `react-web/src/` unless they start with `prisma/`, `docs/` or `src/` of the backend (marked "backend").
- UI strings are quoted verbatim as `FR | EN`, taken from `react-web/messages/fr.json` and `en.json`.
  Where a string is hard-coded in TypeScript rather than in the message files, this is said.
- "NOT DETERMINED" marks a fact the front-end code does not settle; each one says what was checked.
- Backend authorization was not re-audited here. Where the front end cites the backend (`@Roles`, territory helpers), the citation is the front end's own comment, flagged as such.

## Screenshots

57 full-page captures in [`screenshots/admin/`](screenshots/admin/), one per route and width, named `{route}-{width}.png` (widths 1280, 820, 390). Example: [`dossiers-1280.png`](screenshots/admin/dossiers-1280.png).

- Captured 2026-11-02 with Playwright against the local dev servers (`localhost:3000`, backend `localhost:3001`), in French, signed in as the test account `superadmin@minefop.cm` (role `SUPER_ADMIN`). The data is the development database's test data (names such as "Societe E2E Batiment 20261017"); the respondent contacts visible on `dossier-detail-*` are test values.
- **One role only.** The super admin sees every route, but not how pages change for other roles: hidden buttons, read-only notices, forbidden states and the auditor's blank landing page (part 1 §4.2–4.3, part 4 §13) are not shown. Per-role captures need one test account per role.
- Each route was loaded once at 1280 px and given 30 s for slow lists, then resized in place to 820 and 390 px, so the narrower shots show the same data without a reload.
- Detail pages used the first record found: `etablissement-detail?id=AD26000101` and the first dossier in the unassigned queue (opened through the name link; nothing was claimed or changed).
- The round "N" badge at the bottom left is the Next.js dev-mode indicator, not part of the UI.
- In full-page shots the desktop rail stops at the 900 px viewport height because it is a fixed-height column; the page itself does not end there.
- Three shots are wider than their viewport, which means the page scrolls sideways at that width: `campagnes-390.png` (454 px), `utilisateurs-390.png` (537 px), `dossiers-820.png` (897 px). See part 4 §13.

## Not found

`docs/standards/admin-ui-constitution.md`, named in the brief and cited by `docs/standards/admin-layout-spec.md`, does not exist in the repository.
`docs/standards/admin-ui-grammar.md` exists but only says the rules moved to `ui-grammar.md`.
