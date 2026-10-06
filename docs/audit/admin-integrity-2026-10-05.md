# READ-ONLY AUDIT REPORT v2 — REACT WEB ADMIN APP

**Revision date:** 2026-10-05
**Supersedes:** `docs/audit/admin-integrity-2026-10-03.md`
**Original audit:** 78 findings (6 Critical, 14 High, 33 Medium, 25 Low)
**Status of this revision:** post-remediation. Original preserved for history.

---

## 0. What changed since 2026-10-03

Two structural changes invalidate a large portion of the original audit:

**1. Role model collapsed from eleven roles to six.**
`SUPER_ADMIN_DSMO`, `SUPER_ADMIN_ONEFOP`, `CENTRAL`, `CAMPAIGN_MANAGER`, `DATA_MANAGER`, `ANALYST` no longer exist. Survivors: `COMPANY`, `SUPER_ADMIN`, `ADMIN_ONEFOP`, `REGIONAL_ADMIN`, `DIVISIONAL_ADMIN`, `AUDITOR`.

Every finding premised on role drift between the frontend and backend for a now-deleted role is moot. That covers most of Section 8 and several entries in Sections 5, 7, 10.

**2. DSMO removed from the admin console.**
The admin app no longer calls `/dsmo/*` endpoints (except `/dsmo/company` for respondent profile, which is out of scope). Deleted: `DeclarationsList`, `SendNotificationForm`, their clients, and the pages that rendered them.

Every finding against a DSMO declaration or notification endpoint is moot from the admin app's perspective.

**Also shipped since 2026-10-03:**
- Nav profiles (`nav-profiles.ts`) — per-role hub curation
- Territorial admin monitoring — four phases (attribution columns, assisted registration, in-app notifications, dashboard)
- FE-BE contract check — 90 findings, 4 fixed
- Endpoint data-integrity scan — 10 endpoints scanned
- Integrity fixes — companies/stats buckets, anomaly backfill gate, campaign returns quota math
- Commit-5 cleanup — dead controls, orphan exports, route gates

---

## 1. Corrections to the original audit

The original audit contained factual errors, discovered during follow-up work. These are corrections, not changes of opinion.

| # | Original claim | Correction | Source |
|---|---|---|---|
| C1 | §8 R-01: `SUPER_ADMIN_DSMO` triggers a 403 storm on the queues poll | Role no longer exists. Endpoint role list was realigned during the refactor. | Role refactor, commits `85d8304d` |
| C2 | §8 R-02: auditors 403 on `GET /auth/users` | Role still exists but is deferred (no audit work in v1). If it ships, `GET /auth/users/search` is the correct endpoint, not the full list. | 2026-10-04 correction in the endpoint-integrity doc |
| C3 | §9.3: `OnefopAnomaly` has no writers | Provably false. Three `createMany` call sites exist: `eligibility-engine.service.ts:58`, `:841`, `questionnaires.service.ts:1530`. | 2026-10-04 correction |
| C4 | §5 `GET /data-management/stats` is DRIFT because `regionId` triggers a 500 | Latent, not live. Three gates currently prevent it. See `endpoint-integrity-2026-10-04.md`. | 2026-10-04 investigation |
| C5 | §7 F-01: actor-summary coverage shows national figures on every row | Wrong. A national read at line 320 is a single-query optimization; `coverageFor` (line 430) extracts each actor's own region/department. | 2026-10-05 verification |
| C6 | §3: E-01 "ASFOP" is offered as an entity type filter | Fixed in Commit 4 (`45accd21`). `ENTITY_TYPES` now derives from the seven live enum values. | Commit 4 |
| C7 | §4 A-07: 30s poll on `layout.tsx` | Still present, and its premise still holds: `layout.tsx:41` polls every 30s for every `ADMIN_ROLES` member, including AUDITOR, which the endpoint's `@Roles` rejects. Recorded as R1 in `fe-be-contract-2026-10-05.md`; deferred per the 2026-10-05 decision (AUDITOR is not urgent for the pilot). *(Corrected 2026-10-06: this row previously called the premise superseded.)* | Role refactor; `fe-be-contract-2026-10-05.md` R1 |

---

## 2. Corrected executive summary

| Status | Count | Notes |
|---|---|---|
| **Resolved** | ~34 | Fixed in one of the 30+ commits since 2026-10-03 |
| **Moot — role refactor** | ~15 | Premised on a role that no longer exists |
| **Moot — DSMO removal** | ~6 | Endpoint no longer called by admin app |
| **Corrected — original was wrong** | 5 | See §1 |
| **Still open** | ~18 | See §5 |
| **Deferred by decision** | ~6 | Documented as out-of-scope |
| **Total (approximate)** | 78 | — |

**Of the two findings that were critical: one deferred, one removed.** The polling 403 problem is still open: `layout.tsx:41` polls every 30s for AUDITOR, which the endpoint rejects. It is recorded as R1 in `fe-be-contract-2026-10-05.md` and deferred per the 2026-10-05 decision (AUDITOR is not urgent for the pilot). The hardcoded Render fallback was removed in `5c1cc363`; `NEXT_PUBLIC_API_URL` is now required outside local development. *(Corrected 2026-10-06.)*

---

## 3. Category A — Hardcoded values (corrected)

| # | File:Line | Value | Status | Notes |
|---|---|---|---|---|
| A-01 | removed in `5c1cc363` | `https://dsmo-app-2.onrender.com/api` | **REMOVED** | Deleted in `5c1cc363`. `NEXT_PUBLIC_API_URL` is now required outside local development; a production or staging build without it throws on first render instead of silently targeting the Render host. *(Corrected 2026-10-06: previously listed as MITIGATED.)* |
| A-02 | `api-client.ts:30` | `http://localhost:3001/api` | **STILL OPEN** | Dev-only fallback, kept on purpose: used only when `NEXT_PUBLIC_API_URL` is unset and the app runs on localhost/127.0.0.1. Any other build without the variable throws rather than falling back. *(Corrected 2026-10-06.)* |
| A-03 / A-04 | `api-client.ts:25-26` | Storage keys | **STILL OPEN (LOW)** | Centralised in one file; no drift found. |
| A-05 | `dossiers/[id]:147` | `"7 jours ouvrables"` | **STILL OPEN** | Not addressed. |
| A-06 | `AdminHeaderActions.tsx:61` | Quarter regex | **STILL OPEN** | Not addressed. |
| A-07 | `layout.tsx:41` | `30000` refetch interval | **STILL OPEN (DEFERRED)** | The poll still fires every 30s for AUDITOR, which the queues endpoint rejects. Recorded as R1 in `fe-be-contract-2026-10-05.md`; deferred per the 2026-10-05 decision (AUDITOR is not urgent for the pilot). *(Corrected 2026-10-06: previously "RESOLVED-ISH — the poll no longer fires for rejected roles".)* |
| A-08 to A-18 | Various | Page size constants | **STILL OPEN (MEDIUM)** | All still there. Plan 5 proposed a shared `admin-constants.ts`; not built. |
| A-19 to A-24 | `pilotage-targets.ts`, `system-settings.ts` | Business constants | **STILL OPEN** | Not addressed. |
| A-25 to A-27 | Various | Debounce constants | **STILL OPEN** | Not addressed. |
| A-28 | `layout.tsx:25-28` | `PAGE_TITLES` map | **STILL OPEN** | Not addressed. |
| A-29 to A-44 | Various pages | Route path literals | **PARTIALLY RESOLVED** | Commit 5 (`52190420`) added hidden sub-routes to `_routes.ts`. Most page-level literals remain. |
| A-45 | `activite/page.tsx:44-89` | Inline hex colors | **STILL OPEN** | Cosmetic; deferred to a design-system pass. |
| A-46 | 15 pages | Inline French strings | **PARTIALLY RESOLVED** | Some i18n keys added during register work. Admin pages still French-only. |

---

## 4. Category B — Contract map (corrected)

The original contract map is superseded. The current authoritative version is in **`docs/audit/fe-be-contract-2026-10-04.md`**, which catalogues 76 routes and lists 90 findings (2 HIGH, ~24 MEDIUM, ~64 LOW).

Of those 90:

| Status | Count | Notes |
|---|---|---|
| **Fixed** | 4 | companyName, ONEFOP date, reject modal, onefop/draft |
| **Still open — HIGH** | 0 | Both HIGHs fixed |
| **Still open — MEDIUM** | ~20 | Bucketed in the deferred list |
| **Still open — LOW** | ~64 | Bucketed into 11 failure classes |

Original Section 5's DRIFT rows are almost all superseded. Two remain relevant:

- **`GET /auth/users` role gate** — `USER_ADMIN_ROLES` is `['SUPER_ADMIN', 'ADMIN_ONEFOP']`. Any page that allows a role outside this set and calls the endpoint will 403.
- **`GET /system-settings` role gate** — only `SUPER_ADMIN` (per DECISION D3). Any `ADMIN_ONEFOP` reaching `/admin/parametres` will 403. The route list was tightened to `SUPER_ADMIN` only, so this is resolved in practice.

---

## 5. Still open (current authoritative list)

### 5.1 Code fixes deferred by decision

| Item | Why deferred |
|---|---|
| DSMO mirror of the `isOpen` fix | Separate respondent surface. Tracked as its own task. |
| `questionnaires.service.ts:423` warn-only round guard | Same class as the fixed ONEFOP issue. Endpoint not called by admin app. |
| `getDataStats` `const where: any` | Type erasure. Latent, not live. |
| 20 MEDIUM contract findings | Bucketed as fix branch work. |
| 64 LOW contract findings | Same. |

### 5.2 Deferred on purpose

| Item | Decision date |
|---|---|
| Company-accessible notification surface (out of `/admin`) | Phase 3-full |
| Phase 3-full notifications (approval, rejection, complements) | Deferred |
| Quota utilisation on `/admin/cibles` | Separate feature |
| Choropleth regional map | Requires GeoJSON, out of scope |
| `NEXT_PUBLIC_API_URL` on frontend Render | Deployment task |

### 5.3 Design work

| Item | Status |
|---|---|
| Port WB-standard admin UI from mock to real components | Mock at `admin-ui-mock.html`; port not started |
| Density toggle | Not started |
| FR/EN toggle in UI | Not started |
| Print stylesheets on dashboard pages | Not started |
| Per-panel CSV/PNG export buttons | Not started |

---

## 6. New findings since 2026-10-03

Documented in three places:

1. **`docs/audit/fe-be-contract-2026-10-04.md`** — 90 FE/BE contract findings
2. **`docs/audit/endpoint-integrity-2026-10-04.md`** — 10-endpoint data-integrity verdicts
3. **`docs/audit/endpoint-integrity-2026-10-04.md` (corrections)** — corrections to the data-management and actor-summary findings

Plus the monitoring work itself: 4-phase feature, ~10 files, shipped 2026-10-04 (`14fbe023`).

---

## 7. Where each finding lives now

| Original section | Successor document |
|---|---|
| §4 Category A | This document |
| §5 Contract map | `fe-be-contract-2026-10-04.md` |
| §6 Field name mismatches | `fe-be-contract-2026-10-04.md` §Merged findings |
| §7 Enum drift | This document + role refactor commits |
| §8 Auth/RLS drift | Mostly moot — see §1, §3 |
| §9 Orphans | This document (below) |
| §10 Duplicated constants | Resolved by role refactor (`lib/roles.ts`) |
| §11 Cross-reference | Superseded by this document |
| §12 Open questions | All answered during the 2026-10-04 session |

---

## 8. Orphans (updated)

### Still orphaned

- **`GET /dsmo/companies/:id`** — still missing. `etablissement-detail` and `approbation` still fall back to a search-and-find. Deferred as a real fix.
- **`GET /campaigns/conflicts`** — still no FE caller.
- **`GET /campaigns/:id/progress`** — still no FE caller (data embedded in list).
- **`GET /campaigns/:id/submissions`** — still no FE caller.
- **`PUT /campaigns/:id`** — no FE caller.
- **`GET /admin/questionnaires/pending`** — superseded but still registered.
- **`GET /admin/questionnaires/correction-requested`** — same.
- **`GET /data-management/regions` / `sectors`** — redundant but still registered.

### Resolved by deletion

- All `/dsmo/declarations/*` and `/dsmo/notifications/*` frontend callers — removed.
- `listAnomaliesRegistry` / `resolveAnomaly` duplicates — deleted in Commit 5.
- `ADMIN_ROUTES` derived export — deleted in Commit 5.

---

## 9. Where the original is still correct

For historical reference, the following original findings remain accurate as of 2026-10-05:

- Section 4 A-01 through A-46 — statuses vary but the observations were accurate
- Section 9 ORPHAN_HANDLERs — the list is still largely correct, just longer now
- Section 12 open questions — the questions were real; they have since been answered

---

## 10. Recommendation

Treat this document and its three companion files as the working set:

1. **`admin-integrity-2026-10-03.md`** — historical baseline. Do not edit.
2. **`fe-be-contract-2026-10-04.md`** — current contract reference.
3. **`endpoint-integrity-2026-10-04.md`** — current data-integrity reference.
4. **This file** — status roll-up across all four.

New findings get added to the appropriate companion, not to the original.