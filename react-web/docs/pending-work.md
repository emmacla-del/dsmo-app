# Pending work — auto-generated

> Generated from `// TODO(backend, S|M|L)` and `// TODO(design)` comments in `src/`.
> **Do not edit by hand.** Run `npm run todo:report` to regenerate.

Total: **12** — 10 backend, 2 design

## Backend

| Size | Task | Location |
|---|---|---|
| S | ROUND 2 — questionnaire-type filter param for the "Type de questionnaire" field | `src\app\admin\dossiers\page.tsx:203` |
| S | ROUND 2 — submission-date range params for the "Période" field | `src\app\admin\dossiers\page.tsx:204` |
| M | ROUND 2 — bulk reject endpoint for "Rejeter Sélection" | `src\app\admin\dossiers\page.tsx:205` |
| M | ROUND 2 — list/selection export endpoint for "Exporter (CSV/Excel)" | `src\app\admin\dossiers\page.tsx:206` |
| M | missing campaign target, national completion %, and active agent count for the Figma progress bar and stats row | `src\app\admin\pilotage\page.tsx:65` |
| M | missing per-region completion, QC and anomaly rates for the Couverture Régionale columns | `src\app\admin\pilotage\page.tsx:98` |
| M | no audit-log endpoint; timeline is derived from the latest submissions, and "Voir tout le journal" needs /admin/journal-audit | `src\app\admin\pilotage\page.tsx:127` |
| L | remaining quality metrics (Complétude, Cohérence, Anomalies, Avertissements rates) and the /admin/qualite centre link | `src\app\admin\pilotage\page.tsx:162` |
| S | missing inscriptions count (Figma pipeline starts with an "Inscriptions" stage) | `src\app\admin\pilotage\page.tsx:276` |
| S | missing /admin/inscriptions/count for the "Inscriptions en attente" tile | `src\app\admin\pilotage\page.tsx:286` |

## Design

| Size | Task | Location |
|---|---|---|
| S | status donut is not in the Figma dashboard — kept because it is the only status breakdown; verify placement with designer | `src\app\admin\pilotage\page.tsx:182` |
| S | Figma highlights "Déclarations" and "Contrôle régional" stages — confirm what the highlight means before styling it | `src\app\admin\pilotage\page.tsx:277` |

