# Pending work — auto-generated

> Generated from `// TODO(backend, S|M|L)` and `// TODO(design)` comments in `src/`.
> **Do not edit by hand.** Run `npm run todo:report` to regenerate.

Total: **8** — 6 backend, 2 design

## Backend

| Size | Task | Location |
|---|---|---|
| M | missing campaign target, national completion %, and active agent count for the Figma progress bar and stats row | `src\app\admin\pilotage\page.tsx:65` |
| M | missing per-region completion, QC and anomaly rates for the Couverture Régionale columns | `src\app\admin\pilotage\page.tsx:98` |
| M | no audit-log endpoint; timeline is derived from the latest submissions, and "Voir tout le journal" needs /admin/journal-audit | `src\app\admin\pilotage\page.tsx:127` |
| L | remaining quality metrics (Complétude, Cohérence, Anomalies, Avertissements rates) and the /admin/qualite centre link | `src\app\admin\pilotage\page.tsx:162` |
| S | missing inscriptions count (Figma pipeline starts with an "Inscriptions" stage) | `src\app\admin\pilotage\page.tsx:274` |
| S | missing /admin/inscriptions/count for the "Inscriptions en attente" tile | `src\app\admin\pilotage\page.tsx:284` |

## Design

| Size | Task | Location |
|---|---|---|
| S | status donut is not in the Figma dashboard — kept because it is the only status breakdown; verify placement with designer | `src\app\admin\pilotage\page.tsx:182` |
| S | Figma highlights "Déclarations" and "Contrôle régional" stages — confirm what the highlight means before styling it | `src\app\admin\pilotage\page.tsx:275` |

