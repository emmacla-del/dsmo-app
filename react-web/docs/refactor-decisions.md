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
- `63fd6ac6` — removed sticky topbar; layout renders `AdminPageHeader` fallback (Commit 5)
- Commit 6 — `admin/pilotage` refactor (`KpiTile`, `AdminHeaderActions`)

## Next
Commit 5: remove sticky topbar from `admin/layout.tsx`, relocate survivors
into `AdminPageHeader` or page content. Then start page-by-page refactors.

## Removed during refactor
Every removal is logged here. Anything that has a Figma equivalent is listed
as "replaced by"; anything dropped outright says why.

### Commit 5 — layout topbar
- **Topbar search box** — removed. It was a non-functional placeholder
  (`aria-hidden`, no input). Add a real search when a backend exists.
- **Campaign pill in `AdminSidebar`** — removed. Header-only per Figma
  (now in `AdminHeaderActions`).

### Commit 6 — `admin/pilotage`
- **Quick-action buttons** ("Données et exports", "Traiter les dossiers en
  instance") — removed. Duplicated sidebar links (Exports, Dossiers en instance).
- **KPI row** (Total Soumissions, Taux d'éligibilité, Visas en instance,
  Anomalies bloquantes) — replaced by the "À traiter" tiles and pipeline:
  Total → pipeline "Déclarations"; Éligibilité → "Qualité des Données";
  Visas → "Déclarations à examiner" tile + pipeline control stages;
  Anomalies → "Alertes qualité" tile.
- **"Files de traitement" queue panel** — replaced by the "À traiter" tiles
  (same `/admin/files-attente?tab=…` links). Its "Éligibles à la diffusion"
  count is now the pipeline "Exportables" stage, which is not a link
  (the Figma pipeline has no links; Exports stays reachable from the sidebar).
- **"Activité récente" table** — replaced by the Figma timeline. The
  "Type de fiche" column is no longer shown; each item still links to its dossier.
- **"Répartition territoriale" bar chart** — replaced by the "Couverture
  Régionale" table (same per-region counts, all 10 regions).
- **Kept although not in Figma:** "Statut des fiches" donut
  (`TODO(design, S)` in `pilotage/page.tsx`).

## Follow-ups (small, non-blocking)
- `scripts/todo-report.mjs` writes Windows backslash paths (`src\app\...`) into
  `docs/pending-work.md` when run on Windows. Normalise with `.replaceAll("\\", "/")`.
- `admin/sectors` and `admin/utilisateurs` render their own `<h1>` in the
  access-denied state while the layout fallback header also renders one
  (two `<h1>`s, since Commit 5). Fix when those pages are refactored.
