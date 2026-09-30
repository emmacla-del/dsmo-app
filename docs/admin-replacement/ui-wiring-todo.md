# UI wiring to-do

Elements of UI-only screen shells that render "—" or a disabled control
because the data or capability does not exist yet. One row per element.
These shells add no backend endpoint and no schema change.

Type: ENDPOINT = needs a new or extended endpoint; SCHEMA = needs a column
or table; DECISION = needs a product / domain / permission ruling first.

| Date | Screen | Element | Type | What is missing | Shown today |
|---|---|---|---|---|---|
| 2026-09-30 | /admin/centre-qualite | KPI Complétude | DECISION | No definition of the completeness rate and no stored measure (computation over the canonical schema or a new column) | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | KPI Cohérence | DECISION | Coherence checks are advisory and client-side (§7); `OnefopSubmission.flags` is not an aggregate. Rate definition needed | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | KPI Taux d'anomalies / Avertissements | ENDPOINT | No aggregate over `onefop_anomalies` per declaration (blocking vs warning) | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | KPI Éligibilité statistique | ENDPOINT | The eligibility engine answers per dossier (`/diagnostic`); no rate endpoint | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | Anomalies par type (occurrences, % du total, tendance) | ENDPOINT | `GET /admin/questionnaires/anomalies/registry` lists; no group-by `ruleCode` / `ruleFamily`, no trend window | Panel with reason |
| 2026-09-30 | /admin/centre-qualite | Anomalies par région (déclarations, anomalies, taux) | ENDPOINT | No per-region aggregate | Panel with reason |
| 2026-09-30 | /admin/centre-qualite | Region Statut bands (Critique / Élevé / Modéré / Acceptable / Bon) | DECISION | Thresholds are undefined; storing them is a config table that needs a domain ruling | Not shown |
| 2026-09-30 | /admin/centre-qualite | Contrôles récents: "Contrôle automatique terminé — Lot #847" entries | SCHEMA | No control-run table; the feed shows the latest anomalies only | Latest 5 anomalies (wired) |
| 2026-09-30 | /admin/centre-qualite | Règles de validation list with Actif / Désactivé | DECISION | No rules table; toggling a rule changes validation semantics (§21). D6 only settles who (SUPER_ADMIN*) | Panel with reason |
| 2026-09-30 | /admin/centre-qualite | "Gérer les règles de validation →" | DECISION | Same as above | Disabled |
| 2026-09-30 | /admin/centre-qualite | Recent feed for roles outside AdminQuestionnairesController @Roles (e.g. DATA_MANAGER, ANALYST, AUDITOR) | DECISION | Registry is SUPER_ADMIN / SUPER_ADMIN_ONEFOP / CENTRAL / REGIONAL / DIVISIONAL | "—" + reason |
| 2026-09-30 | /admin/centre-qualite | Sidebar entries "Anomalies" / "Qualité" | DECISION | `_routes.ts` has `href: null`; out of bounds for this pass | Page reachable by URL only |
