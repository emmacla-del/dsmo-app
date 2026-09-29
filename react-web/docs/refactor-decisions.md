# Admin UI Refactor — Locked Decisions

## Goal
Visual refactor of `src/app/admin/*` to match Figma. **Do not change routes.**
Do not use `react-router-dom`. Do not restructure folders.
Ignore any pasted `routes.tsx` — it is not part of this repo.

## Design references
All 15 Figma frames exported to `docs/figma/`. Tree mirrors route names.

## Locked decisions
- Font: **Inter** (committed in `cea2592d`)
- Flag green: **`#007A5E`** — snapped `--cam-flag-green`; do NOT merge with `--cam-green`
- Sidebar: follows `declarants/inscriptions` frame — narrow rail, white brand text
- Approved new tokens:
  - `rgba(255,255,255,0.5)` — sidebar section labels
  - `rgba(240,180,41,0.1)` — campaign badge bg
- Rejected: `#C8D2C8` — snap to standard nav label color

## Scope
- **In scope:** `admin/layout.tsx`, `admin/pilotage`, `admin/dossiers`,
  `admin/dossiers/[id]`, `admin/campagnes`, `admin/utilisateurs`, `admin/parametres`
- **Out of scope:** `admin/diffusion`, `admin/sectors`, `questionnaires` (#11:217),
  `admin/files-attente`
- **Net-new candidates (deferred until existing pages done):**
  `retour-correction`, `donnees/exports`, `declarants/etablissements` (+ `_id` + `approbation`),
  `administration/journal-audit`, `qualite/centre`

## Commits so far
- `dc80d22d` — baseline snapshot before refactor
- `cea2592d` — font -> Inter
- `39dec6e1` — `AdminPageHeader`
- `0faaa24f` — `AdminSidebar`
- `08fd571b` — wired `AdminSidebar` into layout (Commit 4)

## Next
Commit 5: remove sticky topbar from `admin/layout.tsx`, relocate survivors
into `AdminPageHeader` or page content. Then start page-by-page refactors.
