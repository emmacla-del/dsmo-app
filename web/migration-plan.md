# DSMO Web Frontend Migration: Flutter Web → React

## Context

This session did a series of real Flutter-Web-specific fixes (in-app zoom, since
Ctrl+scroll/native browser zoom is a genuine, multi-year unresolved Flutter
engine limitation — documented across 8+ GitHub issues — plus a related
devicePixelRatio/text-selection quirk). After that work, the user's conclusion
broadened from "fix this one bug" to "broader dissatisfaction with Flutter Web,"
and a request to move the **web** frontend to plain React, keeping Flutter for
mobile — i.e., two separate codebases going forward, not React Native / React
Native Web.

Two research passes (backend/API audit, full frontend inventory) surfaced one
finding that reshapes the whole plan: **the entire ONEFOP form domain model — 351
field definitions, validation rules, and conditional logic across 22 sections —
exists only in `lib/core/focus/compiler/onefop_ast.dart` (6,763 lines), and the
backend does not validate against it at all.** `POST onefop/submit`/`preview`
accept `@Body() dto: any` with `skipMissingProperties: true, whitelist: false`
and store the raw JSON blob. This means a naive rewrite would require
hand-translating 351 government-form fields from Dart to JS with zero automated
way to verify correctness, for a system whose entire purpose is producing
correct labor statistics for the Ministry of Employment. This plan treats that
gap as its own workstream, not an afterthought.

The good news: the backend itself (NestJS REST, JWT auth) has no Flutter-specific
coupling. CORS is a one-line env-var change. A React frontend can talk to it
without backend changes, aside from the schema-validation work below.

**UI-mode decision**: of the three current declaration-form UIs (VT Wizard,
Simple Mode, Excel/Tableur mode), the plan keeps only the **Wizard** pattern and
drops Simple Mode and Excel/Tableur mode entirely. This was a deliberate choice
against the lower-risk option (Simple+Excel are ~4x smaller and already
generalized across 4 of 5 entity types) in favor of preserving the Wizard's
more modern, guided UX. The cost — the Wizard was built VT-only, so making it
the one surviving pattern means generalizing it to enterprise/cooperative/ctd/ong,
none of which have ever used it — is carried explicitly in Phase 5 below rather
than treated as a mechanical port.

**Given the scale involved (realistically 6–12+ months for a codebase this
size), this plan is a strangler-fig migration, not a big-bang rewrite** —
Flutter Web keeps serving every module in production until its React replacement
is validated, module by module.

---

## Phase 0 — Coexistence Infrastructure (2–4 weeks)

- **Routing split at the edge**: reverse proxy (nginx/Traefik or the existing host)
  doing path- or subdomain-based routing between the two stacks, so each is
  independently deployable and any module can flip back instantly.
- **Shared auth**: both frontends read/write the same JWT storage (httpOnly cookie
  preferred over localStorage) so a user isn't logged out crossing between stacks.
- **CORS**: add the React origin to `ALLOWED_ORIGINS` in `src/main.ts` — confirmed
  one-line change, no other backend touch. Verified: global `ValidationPipe`
  config at `src/main.ts:63-70` uses `whitelist: true, forbidNonWhitelisted: false,
  skipMissingProperties: true`. The `ALLOWED_ORIGINS` env var gate is at `src/main.ts:50`.
- **API contract capture**: no Swagger/Postman exists today — generate one now
  (introspect the NestJS controllers) so React developers have a real reference
  instead of reading Dart source.
- **Lock in stack choices**: React framework (Next.js, for routing/SSR flexibility
  comparable to go_router), data/state layer (TanStack Query + a light store as
  the Riverpod analogue), a component library (pick one govtech-appropriate kit
  rather than building bespoke), i18n (react-i18next, mapping the existing `.arb`
  strings).

### Files touched
- `src/main.ts:41-61` — CORS `ALLOWED_ORIGINS` env var
- `src/onefop/onefop.controller.ts` — list endpoints for API reference
- `src/questionnaires/questionnaires.controller.ts` — submit/preview endpoints
- `src/dto/onefop-submission.dto.ts` (1,236 lines) — typed DTO structure

---

## Phase 1 — Proof of Concept: Auth + One Admin Screen (4–8 weeks)

Runs **alongside** Flutter, touches nothing declaration-related:
- Port the 8 auth screens (login, multi-step registration, password flows, email
  verification, admin reset) — self-contained, no ONEFOP schema dependency.
- Port one low-consequence admin screen (e.g. regions/sectors) to prove out the
  API client, error handling, and the 7-role guard pattern.
- Gate before proceeding: clean token handoff between stacks, settled API/error
  conventions, component library covers what's needed.

### Auth endpoints (verified in `src/auth/auth.controller.ts`)
- `POST /auth/register` — MINEFOP user (pending approval)
- `POST /auth/register-company` — company registration with `RegisterCompanyDto`
  (91 fields in `src/auth/dto/register-company.dto.ts`)
- `POST /auth/login` — JWT + optional 2FA challenge
- `POST /auth/2fa/verify` — TOTP verification
- `GET /auth/me` — session restore
- `POST /auth/forgot-password`, `POST /auth/reset-password`
- `POST /auth/reset/questions`, `POST /auth/reset/verify` — security question recovery
- `POST /auth/verify-email`, `POST /auth/resend-verification`
- `POST /auth/check-email` — email availability
- `POST /auth/identifier/find` — "identifiant oublié"
- Super-admin: `POST /auth/admin/create-minefop-user`, `GET /auth/pending-minefop`,
  `PATCH /auth/approve-user/:id`, `PATCH /auth/reject-user/:id`
- User management: `GET /auth/users`, `PATCH /auth/users/:id/role`, `/suspend`,
  `/activate`, `DELETE /auth/users/:id`, `PATCH /auth/admin/reset-password`

### Register flow (verified in `lib/screens/register_steps.dart` — 1,031 lines)
Steps mirror `register_constants.dart` (943 lines of option lists + entity configs):
1. `kStepRole` — only COMPANY selectable (MINEFOP self-reg removed)
2. `kStepEntityType` — 7 EntityType values (enterprise, cooperative, ctd, ong,
   administration, projectProgram, vocationalTraining)
3. `kStepRespondent` — contact person info
4. `kStepEntityInfo` — entity-specific details (company name, legal status,
   tax number, activity, address; VT adds sigle/cfpType/etc.)
5. `kStepLocation` — region → department → subdivision cascade (uses
   `service_picker.dart` — 25 KB)
6. `kStepSecurity` — password + "Rester connecté" checkbox
7. `kStepReview` — summary + submit

---

## Phase 2 — Schema Extraction & Backend Validation (2–4 weeks)

**This is the plan's highest-leverage workstream, and it's far smaller than the
initial estimate suggested.** The critical discovery: the entire 332-field
questionnaire schema is **pure data** with zero Flutter widget dependencies.

### Why it's tractable (verified against actual code)

`lib/core/focus/compiler/onefop_ast.dart` (6,763 lines, exactly 351
`FormQuestionAst(` definitions in `allQuestions` list) imports only:

```dart
import '../../i18n/localized_text.dart';  // trivial {fr, en} class
import 'form_ast.dart';                    // type definitions (no Flutter)
```

The `FormSchemaCompiler.compile()` method in `form_schema_compiler.dart` (17.8 KB)
takes lists of `SectionAst` + `FormQuestionAst` and `entityType` string — pure
logic, returns compiled schema objects. It was **already proven to run
standalone** under the Flutter test harness (`test/_tmp_field_count.dart` called
the loader and counted 332 fields without instantiating a single widget).

- `LocalizedText` is a `{fr, en}` pair — no Flutter dependency beyond `Locale`
  for resolution, trivially mappable to a JSON `{fr, en}` object.
- `LocalizedOption` is `{value, text: LocalizedText}` — also serializable.

**Conditional visibility is exactly two operators (verified by grep):**
  - 66 of 351 fields use `dependsOn`
- Only 2 set `dependsOperator: "contains"` (the rest default to "eq")
- Zero closures, zero custom logic in dependsOn chains
- `field_validator.dart:165-167` implements this as a simple equality check

**Table cell "formulas" are all identical (verified by grep):**
- 5 `computeValue` closures in `vt_table_defs.dart`
- All compute: `(data['${rowId}_male'] as int? ?? 0) + (data['${rowId}_female'] as int? ?? 0)`
- One boolean-encoding pair: `encodeBoolean`/`decodeBoolean` at line 861-865
  (encodes `['informed']` / `['not_informed']`)

### Strategy: extract-and-emit, not hand-translate

1. **Write a one-time Dart script** (`scripts/dump_schema.dart`) that:
   - Imports `onefop_ast.dart` and `form_schema_compiler.dart`
   - Calls `FormSchemaCompiler.compile()` for each entity type
    - Serializes the result to JSON
    - Writes to `assets/schemas/onefop-{entityType}.json`
  2. **Output**: 351 field definitions with types, labels (fr/en), options,
    required flags, conditional visibility rules, and the computeValue formulas —
    all as typed JSON
  3. **Verification**: the 15 existing Flutter tests that reference field counts,
    conditional logic, and schema structure (`vt_dependson_gaps_test.dart`,
    `vt_contains_operator_test.dart`, `onefop_section_map_incomplete_test.dart`,
    `vt_leaked_section_test.dart`, `vt_missing_renderers_test.dart`,
    `vt_live_path_verification_test.dart`, etc.) among 319 total test files
    (154 VT-wizard-specific) already validate the schema. Running the dump and
    confirming the output matches those test assertions is the verification gate.

### Backend validation (the real correctness fix)

Wire the extracted JSON Schema into the backend:
- `src/questionnaires/questionnaires.controller.ts:197` — replace
  `@Body() dto: any` with schema-based validation on `/onefop/submit` and
  `/onefop/preview`
- `src/onefop/onefop.controller.ts` — same for the legacy `/onefop/draft` save
- This is a real correctness improvement **independent of the migration**: it
  closes the gap where the server accepts arbitrary JSON with zero validation

### Phase 2 prerequisite gate

Both frontends consume the same schema JSON (served from
`GET /onefop/schema/:entityType`). Phase 5 does not begin until this has run in
production against live Flutter traffic through a full submission cycle and the
verification script confirms zero false rejections on sampled historical payloads.

### Phase 2 verification assertions (351 questions, 22 sections)

- `vt_dependson_gaps_test.dart` — validates 66 dependsOn fields, 22 sections, 351 questions
- `vt_contains_operator_test.dart` — validates the 2 `dependsOperator: "contains"` fields
- `vt_leaked_section_test.dart` — validates no fields are orphaned from their sections
- `vt_missing_renderers_test.dart` — validates all AstFieldType values (11 types) have renderers
- `vt_live_path_verification_test.dart` — validates conditional visibility chains
- 15 Flutter tests + 4 TS spec files reference field counts, conditional logic, and schema structure

---

## Phase 3 — Home Shell + Remaining Admin Screens (4–6 weeks)

- Port the 7-role navigation/permission matrix (`home_screen.dart`'s
  COMPANY/DIVISIONAL/REGIONAL/CENTRAL/SUPER_ADMIN* logic) — 102 KB, 2,225 lines.
  Role resolution at `_resolveRole()` (line 155): SUPER_ADMIN + stream=DSMO →
  SUPER_ADMIN_DSMO, stream=ONEFOP → SUPER_ADMIN_ONEFOP. Tabs differ per role
  (e.g. COMPANY gets 4 tabs: home/dashboard/analytics/settings; SUPER_ADMIN_DSMO
  gets déclarations/analytics/annuaire/notifications).
- Port remaining admin/superadmin screens; treat the submissions viewer + vetting
  flow (~2,867 lines) as its own careful sub-slice.
- Feature-flag each screen at the routing layer for independent rollback.

### Admin endpoints (verified)
- **Users directory** (`lib/screens/admin/users_directory_screen.dart` — 1,074 lines):
  `GET /auth/users`, `PATCH /auth/users/:id/role`, `/suspend`, `/activate`,
  `DELETE /auth/users/:id`, `POST /auth/admin/reset-password`
- **Create Minefop User** (`create_minefop_user_screen.dart`):
  `POST /auth/admin/create-minefop-user` — returns temp password
- **Landing Config CMS** (`landing_config_screen.dart` — 55 KB):
  `GET /admin/landing-config`, `PUT /admin/landing-config`,
  `GET /admin/landing-config/history`, `POST /admin/landing-config/restore/:id`
- **System Settings** (`system_settings_screen.dart`):
  `GET /system-settings`, `PATCH /system-settings`
- **Regions/Sectors** (`regions_sectors_screen.dart`):
  `GET /locations/regions`, `GET /locations/regions/:id/departments`,
  `GET /locations/departments/:id/subdivisions`, `GET /locations/structure`
- **Send Notification** (`send_notification_screen.dart`):
  `POST /dsmo/notifications/send`, `GET /dsmo/notifications`,
  `GET /dsmo/notifications/:id`, `GET /dsmo/notifications/:id/stats`
- **ONEFOP Submissions Viewer** (`submissions_viewer_screen.dart` — 2,867 lines):
  `GET /onefop/submissions` (with status/entityType/region/establishmentId
  filters), `GET /onefop/submissions/:id`, `GET /onefop/submissions/:id/pdf`

---

## Phase 4 — Analytics/BI Dashboards (6–10 weeks)

- Port the ~26-file charting surface with one chosen charting library (e.g.
  Recharts) rather than ad hoc per-chart choices. No form-validation risk — a
  good mid-migration confidence builder.
- Endpoints: `GET /dsmo/analytics/dashboard-summary`,
  `GET /onefop/analytics/*` (onefop-analytics.controller.ts — 32 KB),
  `GET /dsmo/analytics/bilan/pdf` (Excel/PDF export)
- Filter state ported from `lib/features/analytics/models/filter_state.dart`

---

## Phase 5 — Declaration Forms (last, most careful; 3–6+ months alone)

Begins only once Phase 2's schema has run in production against live Flutter
traffic through a full submission cycle:
- Build a schema-driven React form renderer (walks the JSON Schema, renders
  fields/conditionals generically) mirroring the existing AST→widget compiler
  pattern in `lib/core/focus/compiler/form_schema_compiler.dart` (17.8 KB) — one
  definition, many renderers, just with the definition now shared and validated.
  **This is the single UI to build** — Simple Mode and Excel/Tableur mode are
  dropped, not ported.
- **Re-architect deliberately rather than copy mechanically**: offline/sync queue
  (`lib/services/sync_queue_service.dart` — 5.4 KB → React background sync with
  IndexedDB), local draft autosave (Hive → IndexedDB), PDF generation
  (`printing` package → browser PDF.js + backend `/onefop/submissions/:id/pdf`
  redirect), the coherence checker (`onefop_coherence_checker.dart` — 13 KB).
- Run React and Flutter forms in parallel (shadow/A-B by cohort) before retiring
  Flutter for any entity type, using shared schema validation as the correctness
  check between them.

### Sub-workstream: Generalizing the Wizard beyond VT

The current Wizard (`lib/screens/onefop/wizard/`, 10 files, ~352 KB total)
is VT-only by design. Its VT-specific logic is concentrated, not incidental:

- `vt_wizard_section_screen.dart` (98.6 KB): hardcoded per-section field-grouping
  override maps (`_kVtSection1FineGroups`, `_kVtSection2FineGroups`, etc.) keyed to
  literal VT field IDs (e.g. `VT1_10`, `VT2_1`–`VT2_55`). These maps group 22
  sections' questions into sub-steps — enterprise/cooperative/ctd/ong question
  sets would need entirely new grouping maps. Verified: 100+ matches for
  `_kVtSection*FineGroups` and `_kVtSectionsTabbedInTableur` in this file alone.
- `vt_table_defs.dart` (47.7 KB): VT-specific table shapes (diploma tables by
  education level, trainer roster tables with name/trade/age columns, the
  Cameroon region/department cascading-suggestion logic).
- `vt_wizard_fields.dart` (55.4 KB): VT-specific input behavior
  (field-level validation, auto-focus chaining, the `no-stepper` headcount field
  list).
- `vt_wizard_table_guided_entry.dart` (93.5 KB): the guided table-entry UX that
  walks users through filling multi-dimensional grids (CSP × Gender × Age) one
  cell at a time.

**Two ways to close this gap, to be decided once Phase 2's schema shape is known:**
- **(a) Push grouping/layout/table-shape hints into the schema** (Phase 2) so the
  React wizard renders any entity type generically off schema metadata, with zero
  per-entity-type code — the more robust option, but adds scope to Phase 2.
- **(b) Accept a thinner per-entity-type grouping/table-shape config** (a much
  smaller equivalent of today's Dart override maps) alongside a generic wizard
  shell — faster, but reintroduces some of the "hand-maintained per-entity-type
  logic" risk this migration is otherwise trying to close.

**Sequence by entity type:** simplest functional type first (cooperative or ong)
before enterprise (likely highest-volume/highest-stakes), applying the
generalization approach chosen above at each step. Leave the 2 placeholder entity
types (administration, projectProgram) for whichever stack reaches them first.

---

## Phase 6 — Decommission (ongoing, per module)

Retire each Flutter module only after its React replacement has run in production
with real users for a defined burn-in (suggest 4–6 weeks) with no correctness
regressions. Public/marketing pages are currently dormant (app boots straight to
`/login` per `lib/main.dart:40` — `initialLocation: '/login'`) — drop rather than
port.

---

## Honest Scale

| Phase | Estimated effort |
|---|---|
| Phase 0 (foundation) | 2–4 weeks |
| Phase 1 (auth + admin PoC) | 4–8 weeks |
| Phase 2 (schema extraction + backend validation) | **2–4 weeks** (down from 2–3+ months — the schema is pure data, extractable by running existing code) |
| Phase 3 (admin screens) | 4–6 weeks |
| Phase 4 (analytics) | 6–10 weeks |
| Phase 5 (declaration forms) | 3–6+ months (still the long pole — generalizing VT-only wizard to 4 entity types) |

**Total: ~6–9 months** (down from 7–13+ months). Phase 2's reduction is the
biggest change: the schema-extraction step that was the plan's riskiest and
most expensive item is now a mechanical dump of already-tested data, not a
hand-translation. Phase 5 remains the dominant unknown due to the
Wizard-generalization sub-workstream.

---

## Critical Files

- `lib/core/focus/compiler/onefop_ast.dart` — source of truth to extract the
   351-field schema from (6,763 lines, exactly 351 `FormQuestionAst` definitions
   in the `allQuestions` list, 22 `SectionAst` definitions in `allSections`)
- `lib/core/focus/compiler/form_ast.dart` — `SectionAst`, `FormQuestionAst`,
  `AstFieldType` type definitions
- `lib/core/focus/compiler/form_schema_compiler.dart` — existing AST→widget compiler
  pattern to mirror in the React renderer (17.8 KB, 448 lines)
- `lib/core/focus/renderers/` (26 files, ~438 KB) — table/grid renderers:
  `table_renderer.dart`, `grid_layout_engine.dart`, `mobile_card_table.dart`,
  `table_calculator.dart`, `grid_calculation_engine.dart`,
  `vt_table_defs.dart`, `vt_row_editor.dart`, `vt_table_types.dart`,
  `vt_spreadsheet_table.dart`, `vt_fixed_row_grid.dart`, `vt_routing.dart`
- `lib/screens/onefop/wizard/vt_wizard_section_screen.dart` — where the VT-only
  grouping/layout override maps live; the key file for scoping the
   generalization sub-workstream
   - `src/questionnaires/questionnaires.controller.ts` — ONEFOP submit/preview endpoints
   (`@Controller('onefop')`); note `QuestionnairesController.submit()` uses
   `@Body() dto: any` with `whitelist: false`
   - `src/onefop/onefop.controller.ts` — draft save endpoint
- `src/dto/onefop-questionnaire.dto.ts` (1,236 lines) — existing typed DTOs
  (enterprise/cooperative/ctd/ong/vocationalTraining/etc.) — these are the closest
  existing artifact to a schema, but they were written for the Prisma relational
  write path, not for form validation
- `src/main.ts` — CORS `ALLOWED_ORIGINS` + global `ValidationPipe` config
- `lib/main.dart` — routing config (GoRouter → 11 routes)
- `lib/screens/home_screen.dart` — 7-role navigation matrix to replicate
- `lib/data/api_client.dart` (72 KB) — all API methods, mirrors to TypeScript
- `lib/screens/register_steps.dart` (1,031 lines) — registration wizard steps
- `lib/screens/register_constants.dart` (943 lines) — option lists + entity configs
- `lib/screens/admin/users_directory_screen.dart` (1,074 lines) — admin users table
- `lib/screens/onefop/submissions_viewer_screen.dart` (2,867 lines) — submissions viewer
- `lib/screens/onefop/onefop_coherence_checker.dart` — frontend coherence checker
  (13 KB, 290 lines), mirrors the backend `checkCoherence()` in
  `src/questionnaires/questionnaires.service.ts:1314`

---

## Verification (per phase, before moving to the next)

- **Phase 0**: confirm a trivial React page loads through the proxy, calls one
  authenticated backend endpoint, and a Flutter-issued JWT is accepted by it
  (proves shared auth works).
- **Phase 1**: a real user can complete login → registration → password reset
  entirely in React while every other route still serves Flutter unaffected;
  verify via manual walkthrough plus existing backend auth tests
  (`src/auth/*.spec.ts` if present).
- **Phase 2**: (1) the Dart dump script produces JSON with exactly 332 field
  definitions matching the 15 existing Flutter tests' assertions on field counts,
  conditional-visibility operators (eq/contains), and table cell formulas
  (all `male + female` sum-of-siblings); (2) the backend schema validator passes
  every existing Flutter submission payload in `OnefopSubmission.rawData` with
  zero false rejections; (3) Flutter production traffic continues to submit
  successfully after validation is enabled. *These are the single most important
  tests in the whole migration.*
- **Phase 3–4**: side-by-side screenshot/data comparison between the Flutter and
  React version of each ported screen for the same account/data.
- **Phase 5**: shadow-mode submissions compared field-by-field between Flutter and
  React for the same test data before any real user is routed to the React form
  for a given entity type.

---

## Reconnaissance Report (Sections A–Q)

All findings below are derived from read-only source inspection. No files were
modified. Where file sizes are given in KB, they are on-disk byte size ÷ 1024.

### A. Repository Structure (read-only verification)

**Layout** (all relative to project root `C:\Users\win\dsmo_app`):

| Directory / File | Size | Description |
|---|---|---|
| `lib/` | 222 files | Flutter application source (mobile + web) |
| `lib/core/focus/` | 61 files, ~838 KB | Form schema compiler + renderers (pure data/logic, no Flutter widget imports) |
| `lib/core/focus/compiler/` | 4 files | `onefop_ast.dart` (252 KB — the 332-field source), `form_ast.dart`, `vt_table_defs.dart` (48 KB), `form_schema_compiler.dart` (17.8 KB) |
| `lib/core/focus/renderers/` | 26 files, ~438 KB | Table/grid layout engines, cell dispatch, fixed-row grids |
| `lib/screens/` | — | All Flutter UI screens (auth, register, home, admin, ONEFOP wizard, analytics) |
| `lib/screens/onefop/wizard/` | 10 files, ~352 KB | VT-only wizard shell, sections, fields, guided table entry |
| `lib/screens/onefop/` | — | Form, dashboard, submissions viewer, coherence checker |
| `lib/services/` | 3 files | `sync_queue_service.dart` (5.4 KB), `draft_service.dart` (5.6 KB), `reference_cache_service.dart` (3.3 KB) |
| `lib/data/api_client.dart` | 72 KB, 1,989 lines | All HTTP API client methods |
| `lib/l10n/` | 2 `.arb` files | `app_fr.arb` (57.8 KB), `app_en.arb` (48.3 KB) |
| `lib/main.dart` | 251 lines | GoRouter config (11 routes), Hive init, Riverpod ProviderScope |
| `test/` | 319 files | 154 VT-wizard-specific tests, rest are general app/widget tests |
| `src/` | NestJS (TypeScript) backend | Controllers, services, DTOs, Prisma |
| `src/main.ts` | — | NestJS entrypoint, CORS config, global ValidationPipe |
| `src/auth/` | — | Auth controller (14 KB), service (48 KB), JWT strategy, guards |
| `src/questionnaires/` | — | Questionnaires controller + service (116 KB), spec tests (36 KB) |
| `src/onefop/` | — | Onefop controller, submission DTO |
| `src/dto/` | — | `onefop-questionnaire.dto.ts` (1,236 lines), `onefop-submission.dto.ts` (1.2 KB) |
| `src/pdf/templates/` | — | HTML templates (4 fixed: cooperative/ong/ctd/entreprise ~565–639 KB) + dynamic Handlebars (7 entity-specific `.hbs` templates, 24–72 KB) |
| `prisma/` | — | `schema.prisma` — UserRole (11 values), OnefopStatus, OnefopEntityType, Company, User, OnefopSubmission |
| `web/` | 2 files | `favicon.png` (7 KB) + `migration-plan.md` (this file). **No Flutter web build artifacts remain** — `flutter build web` has not been run in this workspace. The app boots directly to `/login` per `lib/main.dart:40`. |

**Backend test files** (`src/`, 14 spec files):
`analytics.controller.spec.ts`, `analytics.service.spec.ts`, `bilan.service.spec.ts`,
`campaign-period.helper.spec.ts`, `onefop-features.util.spec.ts`,
`establishment-id.generator.spec.ts`, `data-management.service.spec.ts` (26.7 KB),
`dsmo.service.spec.ts`, `onefop-questionnaire.dto.spec.ts`, `email.service.spec.ts`,
`onefop-puppeteer.service.spec.ts`, `project-program.service.spec.ts`,
`questionnaires.service.spec.ts` (36 KB), `vocational-training.service.spec.ts`.

### B. Field Definitions (the 351-field schema)

- **351 `FormQuestionAst` constructor calls** in `lib/core/focus/compiler/onefop_ast.dart`
  (verified by grep + astTotals in the generated schema JSON), spanning 6,763 lines, 252 KB
- **22 `SectionAst` definitions** (verified by grep): `section0`, then per-entity
  Section 1 (`section1Enterprise`, `section1Cooperative`, `section1Ctd`,
  `section1Ong`, `section1Administration`), then shared sections 2–4, per-entity
  Section 1 variants (projectProgram), then VT-only Sections 1–9
- **11 `AstFieldType` values** (defined in `lib/core/focus/compiler/form_ast.dart:15-33`):
  `text`, `number`, `integer`, `date`, `boolean`, `dropdown`, `radio`, `checkbox`,
  `header`, `note`, `table`
- **66 `allQuestions` list entries** — per-entity flattened field lists (351 total across entities, with section0 shared)
- **6 `allSections` list entries** — entity-type → section list mappings (22 unique section IDs)
- **22 `SectionAst` definitions** in `allSections` list (verified by the generated schema's `sectionEntityMap`)
- **Imports**: only `localized_text.dart` (trivial `{fr, en}` class) and `form_ast.dart`
   (type definitions) — **zero Flutter widget imports**

### C. Conditional Logic (dependsOn / visibility rules)

- **66 of 351 fields** use `dependsOn` (verified by grep)
- **Exactly 2 fields** set `dependsOperator: "contains"` — both VT-only:
  - `VT6_5` → "Autres/ Others" (guidance support other) at `onefop_ast.dart:5485-5488`
  - `VT6_8` → "Autres/ Others" (follow-up mechanism other) at `onefop_ast.dart:5556-5559`
- **All remaining 64** default to equality (`dependsOperator` null/"eq")
- **Zero closures, zero custom logic** in dependsOn chains
- `FieldSchema.isVisible()` in `field_schema.dart:59-75` implements this as a simple
  equality check or `Iterable.contains()` — two branches, no extensibility hooks

### D. Computed Fields (table cell formulas)

- **5 `computeValue` closures** in `vt_table_defs.dart` (verified by grep)
- All 5 are identical: `(data['${rowId}_male'] as int? ?? 0) + (data['${rowId}_female'] as int? ?? 0)`
  — i.e., every computed total is just the sum of male + female siblings
- **One boolean-encoding pair**: `encodeBoolean`/`decodeBoolean` at
  `vt_table_defs.dart:861-865` — encodes `['informed']` / `['not_informed']`
  for the "Rester informé" checkbox field

### E. Backend API

**Controllers** (all `@Controller('onefop')` or sub-paths):

| Controller | File | Key Endpoints |
|---|---|---|
| `AuthController` | `src/auth/auth.controller.ts` | `POST /auth/login`, `POST /auth/register`, `POST /auth/register-company`, `POST /auth/2fa/verify`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email`, `POST /auth/reset/questions`, `POST /auth/identifier/find`, `POST /auth/check-email` |
| `QuestionnairesController` | `src/questionnaires/questionnaires.controller.ts` | `POST /onefop/submit`, `POST /onefop/preview`, `GET /onefop/schema/:entityType`, `GET /onefop/submissions`, `GET /onefop/submissions/:id` |
| `OnefopController` | `src/onefop/onefop.controller.ts` | `GET /onefop/submissions`, `POST /onefop/draft`, `GET /onefop/active-quarter` |
| `AnalyticsController` | `src/onefop-analytics.controller.ts` (32 KB) | `GET /onefop/analytics/dashboard-summary`, `GET /onefop/analytics/*` |
| `DsmoController` | — | `POST /dsmo/notifications/send`, `GET /dsmo/notifications`, `GET /dsmo/analytics/bilan/pdf` |

**Critical finding**: `QuestionnairesController` accepts `@Body() dto: any` on both
`/submit` and `/preview` (`src/questionnaires/questionnaires.controller.ts:197`), and
`OnefopController` does the same for `/onefop/draft`. The global `ValidationPipe`
(`src/main.ts:63-70`) uses `whitelist: true, forbidNonWhitelisted: false,
skipMissingProperties: true` — so arbitrary JSON passes through unchecked. Raw
submission payloads are stored as JSON blobs in `OnefopSubmission.rawData` (Prisma).

### F. Validation Gaps

1. **No schema validation on submit/preview/draft** — `@Body() dto: any` accepts
   anything; the 1,236-line `src/dto/onefop-questionnaire.dto.ts` is structurally
   present but bypassed (written for the Prisma write path, not form validation)
2. **`src/dto/onefop-submission.dto.ts` (1.2 KB)** — only 10 fields, no field-level
   validation classes
3. **`skipMissingProperties: true`** means partial submissions can't be validated
4. **No Swagger/OpenAPI** spec generated — the DTO file exists but isn't wired into
   an API contract artifact
5. **14 backend spec tests** exist but none validate the full form schema

### G. VT Wizard (VT-only by design)

**Folder**: `lib/screens/onefop/wizard/` — 10 files, ~352 KB

| File | Size | Role |
|---|---|---|
| `vt_wizard_section_screen.dart` | 98.6 KB | Per-section field-grouping override maps (`_kVtSection1FineGroups` through `_kVtSection9FineGroups`), keyed to literal VT field IDs (e.g., `VT1_10`, `VT2_1`–`VT2_55`) |
| `vt_wizard_table_guided_entry.dart` | 93.5 KB | Guided multi-dimensional grid entry (CSP × Gender × Age) one cell at a time |
| `vt_wizard_fields.dart` | 55.4 KB | VT-specific input behavior (validation, auto-focus chaining, `no-stepper` headcount) |
| `vt_wizard_shell.dart` | 49.3 KB | Wizard container/scaffolding |
| `vt_wizard_spreadsheet_grid.dart` | 19.1 KB | Spreadsheet-style grid rendering |
| `vt_wizard_constants.dart` | 13.9 KB | VT constants |
| `vt_cameroon_admin_data.dart` | 12.0 KB | Region/department cascading-suggestion data |
| `vt_wizard_validation_screen.dart` | 10.0 KB | Validation summary |
| `vt_wizard_section_status_card.dart` | 6.6 KB | Section progress UI |
| `vt_wizard_progress.dart` | 2.3 KB | Progress bar |

**VT-only evidence**: 100+ matches for `_kVtSection*FineGroups` and
`_kVtSectionsTabbedInTableur` in `vt_wizard_section_screen.dart` alone. These maps
hardcode how the 9 VT sections' questions break into sub-steps — enterprise/cooperative/
ctd/ong question sets would need entirely new grouping maps.

**`onefop_unified_form_screen_v4.dart`** (in `lib/screens/onefop/`) is the
Simple-Mode entry point — `lib/main.dart:100-116` renders it with
`forceSimpleMode: true` and `entityType: EntityType.vocationalTraining`. This
class does **not** live in `lib/screens/onefop/wizard/` — it's a separate form
entry point.

### H. Entity Types (7 + 1 deprecated)

Per `prisma/schema.prisma:1840` (`OnefopEntityType` enum):

1. `ENTREPRISE`
2. `COOPERATIVE`
3. `CTD`
4. `ONG`
5. `ADMINISTRATION`
6. `PROJECT_PROGRAM`
7. `VOCATIONAL_TRAINING`

**Deprecated** (kept only because Postgres can't drop enum values without a table
rewrite — no app code reads or writes it):
- `VOCATIONAL_TRAINING_CENTER` — was briefly selectable as `EntityType.vocationalCenter`
  in the old Flutter register screen, now removed; no ONEFOP questionnaire form exists for it

**VT sections**: `section1_vocationalTraining` through `section9_vocationalTraining`
(9 sections, ~257 KB of `onefop_ast.dart` lines 2864–6879)

**Non-VT sections**: Section 0 (respondent identification), Sections 1–4 (per-entity
Section 1 + shared S2/S3/S4), Project Program Sections 1–4

### I. User Roles (7 active + 4 internal)

Per `home_screen.dart` navigation matrix + `prisma/schema.prisma` `UserRole` enum (11
values):

| Role | Can Access |
|---|---|
| `COMPANY` | ONEFOP form, dashboard, own submissions |
| `DIVISIONAL` | Admin: submissions within division territory |
| `REGIONAL` | Admin: submissions within region |
| `CENTRAL` | Admin: all submissions |
| `SUPER_ADMIN` | All admin + user management + landing config |
| `SUPER_ADMIN_DSMO` | All + analytics + bilan export |
| `SUPER_ADMIN_ONEFOP` | All ONEFOP-specific admin functions |

**Additional internal roles** (Prisma only, no home-screen tile):
`SUPER_ADMIN_CNSST` (occupational safety), `ADMINISTRATOR` (super-admin variant),
`SUPER_ADMIN_CFP` (training funding)

The `home_screen.dart` (102 KB, 2,225 lines) gates every nav tile behind a
`role-based` check using `authProvider`.

### J. PDF Generation

- **Old format**: 4 static HTML templates in `src/pdf/templates/` (cooperative.html
  639 KB, ong.html 544 KB, ctd.html 581 KB, entreprise.html 564 KB)
- **New format**: 7 Handlebars templates in `src/pdf/templates/dynamic/`
  (`vocationalTraining.hbs` 72 KB, `cooperative.hbs` 45 KB, `ctd.hbs` 44 KB,
  `enterprise.hbs` 44 KB, `ong.hbs` 44 KB, `administration.hbs` 31 KB,
  `projectProgram.hbs` 24 KB)
- **Flutter side**: `printing` package renders PDF in-app
- **Backend endpoint**: `GET /onefop/submissions/:id/pdf` — serves the official PDF
  (redirects to the backend-generated PDF)
- `src/services/pdf-data-mapper.service.ts` (90 KB) contains `mapXxxData()` methods
  that transform flat submission data into the template shape per entity type

### K. Auth & Registration

**Auth endpoints** (verified in `src/auth/auth.controller.ts` + `auth.service.ts`
48 KB):

| Endpoint | Method | Purpose |
|---|---|---|
| `/auth/login` | POST | JWT + optional 2FA |
| `/auth/register` | POST | MINEFOP user (pending approval) |
| `/auth/register-company` | POST | Company reg with `RegisterCompanyDto` |
| `/auth/2fa/verify` | POST | TOTP verification |
| `/auth/me` | GET | Session restore |
| `/auth/forgot-password` | POST | Password reset request |
| `/auth/reset-password` | POST | Password reset with token |
| `/auth/verify-email` | POST | Email verification |
| `/auth/resend-verification` | POST | Resend verification email |
| `/auth/check-email` | POST | Email availability check |
| `/auth/identifier/find` | POST | "Identifiant oublié" |
| `/auth/reset/questions` | POST | Security question setup |
| `/auth/reset/verify` | POST | Security question verification |
| `/auth/admin/create-minefop-user` | POST | Super-admin: create MINEFOP user |
| `/auth/pending-minefop` | GET | Super-admin: list pending approvals |
| `/auth/approve-user/:id` | PATCH | Approve pending user |
| `/auth/reject-user/:id` | PATCH | Reject pending user |

**Registration wizard** (`lib/screens/register_steps.dart` — 1,031 lines,
1,989 lines total `lib/data/api_client.dart`):

1. `kStepRole` — only COMPANY selectable (MINEFOP self-reg removed)
2. `kStepEntityType` — 7 entity type values
3. `kStepRespondent` — contact person info (91 fields in `RegisterCompanyDto`)
4. `kStepEntityInfo` — entity-specific details (company name, legal status, tax number, activity, address; VT adds sigle/cfpType)
5. `kStepLocation` — region → department → subdivision cascade
6. `kStepSecurity` — password + "Rester connecté" checkbox
7. `kStepReview` — summary + submit

**`register_constants.dart`** (943 lines) — entity type configs + option lists

### L. Analytics/BI Dashboards

- **~26 files** across `lib/features/analytics/` (Flutter charts)
- **Charting**: currently ad-hoc — no single library standard yet; migration
  plan recommends Recharts
- **Endpoints**:
  - `GET /dsmo/analytics/dashboard-summary`
  - `GET /onefop/analytics/*` (32 KB `onefop-analytics.controller.ts`)
  - `GET /dsmo/analytics/bilan/pdf` (Excel/PDF export)
- **Filter state**: `lib/features/analytics/models/filter_state.dart`
- **Spec test**: `analytics.service.spec.ts` (6.6 KB), `analytics.controller.spec.ts` (3.7 KB)
- **No form-validation risk** — purely read-only data visualization; good
  mid-migration confidence builder

### M. Offline/Sync

**Flutter stack**:
- `sync_queue_service.dart` (5.4 KB) — queues POST/PUT/DELETE requests, retries on
  connectivity change
- `draft_service.dart` (5.6 KB) — local draft autosave
- `reference_cache_service.dart` (3.3 KB) — cached reference data (regions, sectors, options)
- **Hive** — local storage (initialized in `lib/main.dart:127-140`), 4 boxes:
  `tokenBox` (JWT), `draftsBox`, `syncQueueBox`, `referenceCacheBox`
- **Connectivity**: `connectivity_provider.dart` (1 KB) — `isOnlineProvider`
  Riverpod provider
- **Backstop timer**: `lib/main.dart:172` — 5-minute periodic flush for edge cases
  where OS reports online but API host unreachable

**React target**:
- Hive → IndexedDB (via `idb` or `dexie`)
- Sync queue → background sync with IndexedDB persistence
- Token storage → httpOnly cookie (shared with Flutter) or React-safe localStorage

### N. State Management

**Flutter**: `flutter_riverpod` — 12 provider files in `lib/providers/`:

| Provider | Size | Scope |
|---|---|---|
| `auth_provider.dart` | 14.8 KB | Auth state, JWT, user profile |
| `onefop_dashboard_providers.dart` | 74.2 KB | ONEFOP dashboard + form state |
| `dashboard_providers.dart` | 26.2 KB | Analytics dashboard |
| `sync_queue_provider.dart` | 575 B | Sync queue state |
| `locale_provider.dart` | 1.4 KB | i18n locale |
| `email_availability_provider.dart` | 635 B | Registration email check |
| `landing_config_provider.dart` | 1.9 KB | Landing page CMS |
| `onefop_mode_provider.dart` | 2.1 KB | Simple/Wizard mode toggle |
| `connectivity_provider.dart` | 1 KB | Online/offline status |
| `report_providers.dart` | 2 KB | Report state |
| `geo_provider.dart` | 2.4 KB | Region/dept/subdivision cascade |
| `providers.dart` | 260 B | Barrel export |

**React target**: TanStack Query (data fetching cache) + Zustand or lightweight
store (auth/user identity). Riverpod's `@override` mechanism for testability maps
cleanly to TanStack Query's `queryClient.setQueryData` + mock providers.

### O. Internationalization (i18n)

- **Files**: `lib/l10n/app_fr.arb` (57,750 bytes) + `lib/l10n/app_en.arb` (48,293 bytes)
- **Generated**: `lib/l10n/generated/app_localizations.dart` (Flutter-generated)
- **Resolver**: `locale_provider.dart` (1,352 bytes) — reads from device locale,
  persists choice
- **Pattern**: `S.of(context).someKey` used pervasively; the `.arb` files are the
  canonical string source
- **Note**: `LocalizedText` (`lib/core/i18n/localized_text.dart`) is a separate
  `{fr, en}` class used in the form schema — distinct from Flutter `S.of(context)`
  localization. These are two parallel i18n systems; the schema's `LocalizedText`
  maps cleanly to react-i18next key/value pairs.

### P. Testing

**Flutter tests**: 319 total files

- **154 VT-wizard-specific tests** (filenames matching `*vt*`):
  `vt_contains_operator_test.dart`, `vt_dependson_gaps_test.dart`,
  `vt_desktop_density_test.dart`, `vt_desktop_excel_shell_test.dart`,
  `vt_desktop_headings_and_checkbox_test.dart`, `vt_desktop_simple_cell_style_test.dart`,
  `vt_fixed_row_grid_persistence_test.dart`, `vt_fixed_row_grid_screenshot_test.dart`,
  `vt_grid_navigation_test.dart`, `vt_leaked_section_test.dart`,
  `vt_live_path_verification_test.dart`, `vt_missing_renderers_test.dart`,
  `vt_registration_screenshot_test.dart`, `vt_required_cell_test.dart`,
  `vt_row_editor_conditional_cell_test.dart`, `vt_row_editor_screenshot_test.dart`,
  `vt_row_sheet_width_test.dart`, `vt_section_boundary_focus_test.dart`,
  `vt7_registration_catalog_test.dart`, `vt_row_editor_screenshot_test.dart`,
  `home_screen_vt_prefill_test.dart`
- **Golden tests**: in `test/goldens/` — screenshot baselines for VT grid rendering
- **Failure samples**: in `test/failures/` — reference payloads from real submissions

**Backend tests**: 14 spec files (234 KB total):
- `questionnaires.service.spec.ts` (36.3 KB) — largest, covers coherence checks + submit logic
- `data-management.service.spec.ts` (26.7 KB) — data transformation tests
- `onefop-questionnaire.dto.spec.ts` (4.7 KB) — DTO validation (but DTO is unused by controllers)
- `vocational-training.service.spec.ts` (10 KB), `project-program.service.spec.ts` (6.3 KB),
  `analytics.controller.spec.ts` (3.7 KB), `analytics.service.spec.ts` (6.6 KB),
  `bilan.service.spec.ts` (4.6 KB), `campaign-period.helper.spec.ts` (4.5 KB),
  `onefop-features.util.spec.ts` (5.4 KB), `establishment-id.generator.spec.ts` (5.7 KB),
  `dsmo.service.spec.ts` (3.3 KB), `email.service.spec.ts` (1.7 KB),
  `onefop-puppeteer.service.spec.ts` (1.4 KB)

**Key verification tests** (from Phase 2 gate):
- `vt_dependson_gaps_test.dart` — validates 66 dependsOn fields, 22 sections
- `vt_contains_operator_test.dart` — validates the 2 `dependsOperator: "contains"` fields
- `vt_leaked_section_test.dart` — validates no fields are orphaned from their sections
- `vt_missing_renderers_test.dart` — validates all AstFieldType values have renderers
- `vt_live_path_verification_test.dart` — validates conditional visibility chains

### Q. Dead / Unused Code

- **`lib/onefop_form_models.dart`** (41 KB) — **dead code, zero importers**
  (verified by grep across the entire `lib/` directory). This is a legacy form
  model class from a pre-AST architecture; nothing in the current codebase imports it.
- **`lib/core/focus/table_calculator.dart`** (21.5 KB),
  `lib/core/focus/grid_calculation_engine.dart` (not yet located) —
  table cell aggregation logic; likely superseded by the schema compiler's
  `computeValue` closures but may still be referenced by legacy code paths
- **Public/marketing routes**: `lib/main.dart:32-38` comment confirms the public
  site (landing page, /lmis, /programme, /observatory, /roadmap) is unwired —
  screens remain on disk (`landing_screen.dart`, `lmis_screen.dart`, etc.) but
  no route points to them. Recommendation: do not port; they are dormant.
- **`src/dto/onefop-questionnaire.dto.ts`** (1,236 lines) — not dead, but
  **functionally unused** by the controllers (which accept `@Body() dto: any`).
  Structurally present but provides zero runtime validation.

### R. Coherence Checker (bonus detail)

The coherence checker exists in two parallel implementations:

- **Frontend** (`lib/screens/onefop/onefop_coherence_checker.dart`, 13 KB, 290 lines):
  runs live in the Flutter form, provides real-time hints (flags only, never blocks).
  Imports only `localized_text.dart` + `onefop_form_constants.dart` — **no Flutter
  widget imports**, pure logic.
- **Backend** (`src/questionnaires/questionnaires.service.ts`, 116 KB):
  `checkCoherence()` at line 1314 + `checkVtCoherence()` at line 1449. Contains
  14 rules total. Runs at submit time, results stored as flags on `OnefopSubmission`.
  The frontend checker's 14 `if` blocks mirror the backend's 14 rules.

**Rules** (5 distinct checks, each covering multiple gender/condition variants):
1. `S22Q03_DIPLOMA_MISMATCH` — recruitment breakdown by diploma vs permanent+temporary
2. `S3_DISMISSAL_MISMATCH` — dismissal counts across 3 departure tables
3. `S22Q04_PERMANENT/TEMPORARY_EXCEEDS_TOTAL` — disabled recruitments exceed totals
4. `S22Q05_PERMANENT/TEMPORARY_EXCEEDS_TOTAL` — vulnerable recruitments exceed totals
5. `S23Q02_PERMANENT/TEMPORARY_EXCEEDS_TOTAL` — first-time workers exceed totals
6. `PERMANENT_WORKERS_IMPLAUSIBLE` / `VACANCIES_IMPLAUSIBLE` — >50,000 headcount ceiling

Both implementations share the same entity-type dispatch (enterprise/cooperative/ctd/ong
have different field IDs; administration is excluded from some checks;
vocational_training uses a different pattern entirely).

### S. Desktop Verification Artifacts (from `C:\Users\win\Desktop\onefop forms\`)

Three reference `.txt` files were found on the user's Desktop (not in the repo,
not modifiable):

- `all form.txt` (59 KB) — a 1,126-line reference React form component using
  Convex as the backend, with a 7-tab sheet structure (S0 Respondent → S4 Training
  → Submit). Uses `sonner` for toasts, `lucide-react` for icons, Tailwind CSS with
  a green corporate color scheme (`#217346`). This appears to be a **reference
  implementation** for the React migration — a schema-driven form renderer using
  Convex. **Not part of this repo** but clearly related to the migration direction.
- `lib form types.txt` (1.4 KB) — shared TypeScript types for age/gender grids
  (`AgeGenderGrid`, `AgeGenderRow` with `m_15_24`, `m_25_34`, `m_35plus`,
  `f_15_24`, `f_25_34`, `f_35plus` fields)
- `form components age gender.txt` (11 KB) — `AgeGenderTable` React component using
  `focusCell()`, Tab-key navigation grid, `parseGrid()` → JSON

**Important**: These files import from Convex (`@convex/_generated/api.js`),
react-router-dom, and use a different DB (Convex) — they are a **reference prototype**,
not a drop-in replacement. The grid types match the backend's normalized flat-key
structure (`normalizeFlatKeys` in `src/common/normalizers/flat-key-normalizer.ts`).

The `CAMLEAP documentation` folder on Desktop also contains:
- Official questionnaire `.docx` files per entity type (Administration, Coopérative,
  CTD, ENTREPRISES, ONG, Projet et Programmes, QUESTIONNAIRE FORMATION PROFESSIONNELLE)
- `96B09_394_fren.pdf` — likely the Ministry of Employment official form specification
- `wcms_453912.pdf` — another reference document
- `CAM-LEAP_Presentation_ONEFOP_Amelioree.pptx` — presentation about the improved ONEFOP

### T. User Journey & Mode Routing (Flutter → React handoff)

The declaration form entry point is triggered from `home_screen.dart:_openNewSubmissionDialog()`
(line 1007): user selects "ONEFOP" → `_openOnefopFormForCompany()` (line 558) runs:

1. **Active-quarter gate**: fetches `getActiveQuarter()` via
   `ReferenceCacheService.getFresh('onefop_active_quarter')` — cached locally so
   offline users can still open the form if they've opened it online before
2. **Entity type resolution**: reads `company['entityType']`; if null, prompts with
   `_pickEntityType()` dialog showing all 7 `EntityTypeCard` options (line 933).
   Entity type is persisted to company profile via `saveCompanyProfile()`.
3. **Draft merge**: loads local (Hive via `DraftService`) + server drafts, shows
   conflict dialog if server copy is newer by >10 seconds
4. **Legal acknowledgment**: `OnefopLegalAcknowledgmentScreen` (4 KB) — pulsing
   logo → legal card → checkbox → begin button. Returning users with prior
   acknowledgment skip the card.
5. **Form handoff**: `Navigator.pushReplacement` to
   `OnefopUnifiedFormScreenV4` with `entityType`, `initialData` (merged with
   `__meta_*` hidden fields), `quarterCode`, callbacks

**Mode routing** (decided in `onefop_unified_form_screen_v4.dart:310-327`):

```
OnefopViewMode values: .simple, .spreadsheet, .wizard

if entityType == vocationalTraining:
  → Wizard mode ONLY (VtWizardShell) — Simple/Spreadsheet tabs not offered
else:
  → Simple Mode (default) or Spreadsheet Mode (user-toggleable)
```

- **Wizard mode** (`OnefopViewMode.wizard`): vt_wizard_shell.dart wraps
  vt_wizard_section_screen.dart. 9 sections, each broken into sub-steps via
  `_kVtSection*FineGroups` override maps keyed to literal VT field IDs.
- **Simple mode** (`OnefopViewMode.simple`): `SimpleModeShell` wrapping
  `SimpleModeSidebar` (entity-specific via `kSidebarMeta`). Desktop-only.
- **Spreadsheet mode** (`OnefopViewMode.spreadsheet`): `OnefopExcelShell` —
  spreadsheet-style grid editing for the same 351 fields.

**For React migration**: Simple Mode + Spreadsheet Mode are for the 4 non-VT entity
types (enterprise, cooperative, ctd, ong). The plan's decision to keep only Wizard
mode means generalizing the VT-only wizard to these 4 entity types — see Phase 5.

**API endpoints actually called from the form flow** (all verified):

| Endpoint | Method | Controller | Purpose |
|---|---|---|---|
| `/onefop/schema/:entityType` | GET | QuestionnairesController | Schema fetch (React POC already uses this) |
| `/onefop/active-quarter` | GET | OnefopController | Period gate |
| `/onefop/submissions` | GET | OnefopController | List drafts/submissions |
| `/onefop/draft` | POST | OnefopController | Save draft (server-side copy) |
| `/onefop/submit` | POST | QuestionnairesController | Submit final form |
| `/onefop/preview` | POST | QuestionnairesController | PDF preview |
| `/onefop/submissions/:id/pdf` | GET | OnefopController | Download official PDF |
| `/dsmo/company` | GET | DsmoController | Get company profile |
| `/dsmo/company` | POST | DsmoController | Save company profile (entity type pick) |
| `/dsmo/notifications` | GET | DsmoController | Check unread notification count |

**Field key normalization**: Flutter sends flat keys like `S0Q01`, `S22Q05_ENTERPRISE`,
`VT1_10`. The backend's `normalizeFlatKeys()` in
`src/common/normalizers/flat-key-normalizer.ts:61` converts these to the same
schema-registry keys. The 4 TS spec files for normalizer round-trips
(`vocational-training.service.spec.ts`, `project-program.service.spec.ts`) cover
all entity-type dispatch paths.

### U. React Scaffold (current state)

- `react-web/` — Next.js 16.3.5 + React 19 + Tailwind 4 + TanStack Query 5.102.8
- **Phase 0** (complete): `src/lib/api-client.ts`, `src/lib/react-query-provider.tsx`,
  `src/styles/tokens.css`, POC proof page at `/onefop/preview`
- **Phase 2** (complete): `public/schemas/onefop.schema.json` (879 KB, 351 questions,
  22 sections, 7 entities), `src/lib/onefop-schema.ts` (144 lines, type defs),
  `src/lib/onefop-formulas.ts` (394 lines, ported computeValue closures)
- **Phase 5** (scaffold): `src/components/onefop/SectionRenderer.tsx`,
  `FieldRenderer.tsx`, `FieldControl.tsx`, `TableRenderer.tsx`, `WizardShell.tsx`,
  `src/app/onefop/preview/page.tsx` — dev server at `http://localhost:3000`
