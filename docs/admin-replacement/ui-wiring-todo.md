# UI wiring to-do

Elements of UI-only screen shells that render "—" or a disabled control
because the data or capability does not exist yet. One row per element.
These shells add no backend endpoint and no schema change.

Type: ENDPOINT = needs a new or extended endpoint; SCHEMA = needs a column
or table; DECISION = needs a product / domain / permission ruling first;
UI = needs a frontend change on a page outside this pass.

| Date | Screen | Element | Type | What is missing | Shown today |
|---|---|---|---|---|---|
| 2026-09-30 | /admin/questionnaires | "Aperçu" — canonical AST viewer | DECISION | No viewer exists; what it shows (sections, questions, tables, gateways) and whether it reads onefop.schema.json or the AST needs a model decision | Disabled button + placeholder panel |
| 2026-09-30 | /admin/questionnaires | "+ Nouveau questionnaire" | DECISION | Questionnaire structure belongs to `onefop_ast.dart` (§3, §21), not to the console | Disabled |
| 2026-09-30 | /admin/questionnaires | "Actif" status pill | DECISION | Questionnaire status is not modelled anywhere (AST or DB) | "Statut —" |
| 2026-09-30 | /admin/questionnaires | Taux de complétion | DECISION | No definition of completion per questionnaire type, and no data | "—" |
| 2026-09-30 | /admin/questionnaires | ASFOP (Recensement) card | DECISION | Not an `OnefopEntityType` value; adding one is a questionnaire-structure change (§21) | Not rendered; the seven existing types are shown |
| 2026-09-30 | /admin/questionnaires | "Voir soumissions" filtered by type | UI | `/admin/dossiers` reads only `?status=` from the URL, not `?formType=`; that page is out of scope for this pass | Links to the unfiltered `/admin/dossiers` |
| 2026-09-30 | /admin/questionnaires | Total soumissions for roles outside AdminQuestionnairesController @Roles | DECISION | GET /admin/questionnaires is SUPER_ADMIN / SUPER_ADMIN_ONEFOP / CENTRAL / REGIONAL / DIVISIONAL | "—" |
| 2026-09-30 | /admin/questionnaires | Sidebar entry "Questionnaires" | DECISION | `_routes.ts` has `href: null`; out of bounds for this pass | Page reachable by URL only |
