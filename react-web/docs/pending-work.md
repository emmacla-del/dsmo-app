# Pending work — auto-generated

> Generated from `// TODO(backend, S|M|L)` and `// TODO(design)` comments in `src/`.
> **Do not edit by hand.** Run `npm run todo:report` to regenerate.

Total: **13** — 10 backend, 3 design

## Backend

| Size | Task | Location |
|---|---|---|
| S | known limitation — CTD dossiers are searchable only by ID or respondent name (OnefopCtdDetail has no name column; server search no longer reads rawData) | `src\app\admin\dossiers\page.tsx:80` |
| M | ROUND 2 — bulk reject endpoint for "Rejeter Sélection" | `src\app\admin\dossiers\page.tsx:220` |
| M | ROUND 2 — list/selection export endpoint for "Exporter (CSV/Excel)" | `src\app\admin\dossiers\page.tsx:221` |
| M | missing campaign target, national completion %, and active agent count for the Figma progress bar and stats row | `src\app\admin\pilotage\page.tsx:65` |
| M | missing per-region completion, QC and anomaly rates for the Couverture Régionale columns | `src\app\admin\pilotage\page.tsx:98` |
| M | no audit-log endpoint; timeline is derived from the latest submissions, and "Voir tout le journal" needs /admin/journal-audit | `src\app\admin\pilotage\page.tsx:127` |
| L | remaining quality metrics (Complétude, Cohérence, Anomalies, Avertissements rates) and the /admin/qualite centre link | `src\app\admin\pilotage\page.tsx:162` |
| S | missing inscriptions count (Figma pipeline starts with an "Inscriptions" stage) | `src\app\admin\pilotage\page.tsx:276` |
| S | missing /admin/inscriptions/count for the "Inscriptions en attente" tile | `src\app\admin\pilotage\page.tsx:286` |
| S | delete QuestionnairesService.getAllQuestionnaires in a follow-up — dead code since 40529d79 (GET /admin/questionnaires now uses listForAdmin) | `src\lib\api-client.ts:519` |

## Design

| Size | Task | Location |
|---|---|---|
| S | what is "ASFOP" in the Figma's questionnaire types? Labels use entityTypeLabel until the domain answers (VOCATIONAL_TRAINING?) | `src\app\admin\dossiers\page.tsx:81` |
| S | status donut is not in the Figma dashboard — kept because it is the only status breakdown; verify placement with designer | `src\app\admin\pilotage\page.tsx:182` |
| S | Figma highlights "Déclarations" and "Contrôle régional" stages — confirm what the highlight means before styling it | `src\app\admin\pilotage\page.tsx:277` |

