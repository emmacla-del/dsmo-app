# Campaign Model Refactor — Design Plan

**Status:** Design agreed. Phase 1 landed. Phase 2 skipped. Phase 3a/3b/3c landed. Phase 3d-bis landed. Phase 3e next.
**Date:** 2026-10-05 (rev 4)
**Supersedes:** the annual-target vs campaign-quota split that exists today.

---

## 1. Why

Today the system carries **two parallel target concepts**:

| Concept | Table | Scoped to |
|---|---|---|
| Annual inscription targets | `territory_targets` | A year |
| Campaign quotas | `campaign_quotas` | A campaign |
| Central annual targets | `central_inscription_targets` | A year, national |
| Central campaign quotas | `central_campaign_quotas` | A campaign, national |

That produces the confusion the IA scan surfaced: `/admin/cibles` has four in-page tabs mixing annual and per-campaign work, and users cannot tell which number applies.

The refactor collapses the two into one. **The quarterly campaign is the primary entity. Quotas belong to a campaign. There is no separate annual concept — the annual figure is computed.**

---

## 2. The campaign

A campaign is one quarter of collection or registration work. It is the atomic planning unit.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Human label |
| `purpose` | enum | `COLLECTION` \| `REGISTRATION`. **Renamed from `type` (see §2.1).** |
| `referenceYear` | int | e.g. 2026 |
| `referenceQuarter` | int | 1–4 |
| `startDate` | date | |
| `deadline` | date | |
| `scopeRegions` | relation | Which regions this campaign covers |
| `scopeEntityTypes` | enum[] | Which entity types it covers |
| `lifecycle` | enum | `DRAFT` \| `ACTIVE` \| `PAUSED` \| `CLOSED` \| `ARCHIVED` |
| `createdBy` | FK User | |
| `ownerRole` | enum | Which role manages it |
| `publishedAt` | timestamp? | Nullable. Distinct from lifecycle. |
| `createdAt`, `updatedAt` | timestamp | |

**Uniqueness:** one campaign per `(purpose, referenceYear, referenceQuarter)`. Enforced by a database unique constraint.

**No granularity field.** Every campaign is quarterly. Semester and annual views are computed, not stored.

**No objectives field. No targets field. One concept: quotas.**

### 2.1 The `type` → `purpose` rename

The existing `DataCampaign.type String?` field currently holds periodicity values (e.g. `'QUARTERLY'`). Under this model every campaign is quarterly, so periodicity is redundant. The field is repurposed:

- **Rename:** `type` → `purpose`
- **Values change:** from free-text periodicity to enum `COLLECTION | REGISTRATION`
- **Timing:** made in Phase 3 alongside the service-layer work, not in Phase 1

The existing `collectionType: SubmissionModule` field is a **different axis** (ONEFOP vs DSMO) and stays as-is.

### Why quarters only

The alternative — annual campaigns with quarterly sub-campaigns — produces two independent sets of numbers for the same period and a permanent ambiguity about which one is authoritative. Splitting into quarters makes every quota traceable to a specific period, and the semester/annual views become simple sums.

This also matches the existing system: `SubmissionRound.quarterCode` is already quarterly (`2026-T4`), and the register wizard and submission flow assume quarter windows.

---

## 3. Quotas

**The unified quota table is the existing `CampaignQuota` model, extended in place.** No new model, no rename of the model. `CentralCampaignQuota`, `TerritoryTarget`, and `CentralInscriptionTarget` are deprecated (§6).

Target shape:

```
CampaignQuota
  id             UUID
  campaignId     FK → DataCampaign
  scopeKind      enum TERRITORIAL | ADMINISTRATION
  regionId       FK → Region    (nullable)
  departmentId   FK → Department (nullable)
  submissionTarget Int        (name kept — see §12)
  createdBy, updatedBy
  createdAt, updatedAt
```

**Region-level row:** `regionId` set, `departmentId` null.
**Department-level row:** both set.
**National total:** never stored. Computed as `SUM(submissionTarget) WHERE campaignId = X AND scopeKind = 'TERRITORIAL'`.
The ADMINISTRATION row is deliberately excluded — summing it in would
silently add the ministries' cohort target to the national figure.

**Validation** (in the service, not the schema):
- The sum of a region's department quotas must equal the region's own quota if the region has one.
- If a region has no quota set, its departments' quotas stand alone.
- Negative quantities rejected (enforced by CHECK constraint, §3.1).
- A quota cannot be set for a region outside the campaign's `scopeRegions`.

### 3.1 Constraints are enforced in migration SQL, not Prisma

The schema comment at `prisma/schema.prisma:2517-2535` documents that uniqueness on `CampaignQuota` cannot be expressed as `@@unique` because of the nullable `departmentId` and now `regionId` too. Postgres treats NULLs as distinct, so `@@unique([campaignId, regionId, departmentId])` would permit two region-level rows.

The uniqueness rules and the scope shape live in
`prisma/migrations/20261008120000_campaign_quota_scope_kind/migration.sql`, which replaced the two original `campaign_quotas` indexes from `20261001153000_add_territory_targets_and_campaign_quotas` (that migration is applied and stays byte-identical):

| Constraint | Purpose |
|---|---|
| `campaign_quotas_administration_uidx` | `(campaignId) WHERE scopeKind = 'ADMINISTRATION'` |
| `campaign_quotas_territorial_region_uidx` | `(campaignId, regionId) WHERE departmentId IS NULL AND scopeKind = 'TERRITORIAL'` |
| `campaign_quotas_territorial_department_uidx` | `(campaignId, regionId, departmentId) WHERE departmentId IS NOT NULL AND scopeKind = 'TERRITORIAL'` |
| `campaign_quotas_scope_shape` | `CHECK` — `ADMINISTRATION` => both FKs NULL; `TERRITORIAL` => `regionId` NOT NULL |
| `campaign_quotas_submission_target_nonneg` | `CHECK ("submissionTarget" >= 0)` — unchanged, from `20261001153000` |

The `scopeKind` predicate on the two territorial indexes is not decoration: `departmentId IS NULL` is the region-level marker, and the ADMINISTRATION row also has a NULL `departmentId`, so without it the cohort row would collide with a region-level quota.

**Do not add `@@unique` to the Prisma model.** It would generate a different (weaker) constraint and duplicate the existing ones. Any future schema edit must preserve the hand-written SQL pattern.

### Why no national row — and why the ADMINISTRATION row is not one

The national *total* is still not stored. Computing it as the sum of territorial quotas guarantees the national figure is always consistent with its parts, and that has not changed.

What this section originally got wrong is treating "a row with both FKs null" as necessarily a national total. The ADMINISTRATION row is not a roll-up of anything: ministries answer the questionnaire as one cohort, their returns are counted in the `central` bucket of `getCampaignReturns` and excluded from every territorial bucket, so no sum over regions can ever produce their target. It is a leaf, not a parent.

**Resolved via Path 1 (scopeKind discriminator), landed in Phase 3d-bis.** Cohort is the permanent granularity for ADMINISTRATION — one row per campaign. Per-ministry targets, if they ever arrive, are a new `scopeKind` value, not a nullable ministry column.

The "awkward composite unique constraint" objection was real and is answered by making the predicate explicit rather than by refusing the row: see the three scope-qualified partial indexes in §3.1.

---

## 4. Computed roll-ups — semester and annual

Neither is stored. Both are `SUM` over the underlying quarterly campaigns.

| View | Source | Example |
|---|---|---|
| **Quarter** | The campaign itself | "Centre's Q2 registration quota is 300" |
| **Semester** | Sum of two quarters | "H1 = Q1 + Q2" |
| **Annual** | Sum of four quarters (or two semesters) | "2026 = Q1 + Q2 + Q3 + Q4" |

A semester has no separate quota editor. An annual figure has no separate quota editor. They are read-only views over the quarterlies.

**This is what eliminates the double-count risk.** There is only one stored number per territory per quarter. Every higher-level figure is a sum of those. No two sources can disagree.

---

## 5. Lifecycle states

| State | Meaning |
|---|---|
| `DRAFT` | Being prepared. Not visible to respondents. |
| `ACTIVE` | Collecting submissions. |
| `PAUSED` | Temporarily not accepting new submissions. Reviews continue. |
| `CLOSED` | No new submissions. Reviews and corrections continue. |
| `ARCHIVED` | Frozen. Read-only. Included in statistical reports. |

**Resolved:** `CLOSED` stops new submissions but allows review work. `ARCHIVED` freezes everything. This matches the standard statistical workflow: submission window, review period, publication freeze.

**Resolved:** a `publishedAt: DateTime?` flag is added, distinct from lifecycle. It lets the reporting layer distinguish "campaign closed" from "data official," and feeds the provenance strip.

---

## 6. What this replaces

| Existing table | After refactor |
|---|---|
| `territory_targets` | **Deprecated.** Deprecation comment added in Phase 1. |
| `central_inscription_targets` | **Deprecated.** Deprecation comment added in Phase 1. |
| `campaign_quotas` | **Kept.** Extended in place; becomes the unified table. |
| `central_campaign_quotas` | **Deprecated and inert.** Deprecation comment added in Phase 1; last writer removed in Phase 3d-bis. |

The ADMINISTRATION cohort target is not part of that sum — it is non-territorial. It moves into `CampaignQuota` as a row with `scopeKind = 'ADMINISTRATION'` (see §9 Phase 3d-bis).

> The deprecation header on `model CentralCampaignQuota` (`prisma/schema.prisma`) still reads "National totals are now computed as the sum of CampaignQuota rows," which is the claim this paragraph corrects. Fixing that comment is a code edit and is out of scope for this doc pass — carry it into the Phase 6 drop.

**No data migration is required.** All five tables (`campaign_quotas`, `central_campaign_quotas`, `territory_targets`, `central_inscription_targets`, `data_campaigns`) were verified empty in the live Supabase project on 2026-10-05. There is nothing to backfill.

### 6.1 The synthetic-campaign mechanism is not needed

The earlier draft specified creating synthetic annual campaigns from rows in `territory_targets` / `central_inscription_targets`. With both tables empty, no synthetic campaigns are created.

The mechanism is documented here for the record — if the tables ever have rows before Phase 6 drops them, the same rule applies:

- One synthetic campaign per year present
- `name`: `"Campagne d'inscription annuelle [YYYY]"`
- `purpose`: `REGISTRATION`
- `referenceYear`: the year
- `referenceQuarter`: 4
- `startDate`: YYYY-01-01
- `deadline`: YYYY-12-31
- `lifecycle`: `CLOSED`
- `publishedAt`: null

Quota rows attach to the matching synthetic campaign.

**Do not drop the deprecated tables in Phase 1 or Phase 3.** Keep them for rollback safety until Phase 4 is verified in production.

---

## 7. Endpoint changes

Every quota endpoint becomes campaign-scoped. Signature changes:

| Today | After |
|---|---|
| `GET /admin/pilotage/targets/inscriptions?year=2026` | `GET /admin/pilotage/campaigns/:id/quotas` |
| `PUT /admin/pilotage/targets/inscriptions?year=2026` | `PUT /admin/pilotage/campaigns/:id/quotas` |
| `GET /admin/pilotage/campaigns/:id/quotas` | Unchanged, but reads the unified table |
| `GET /admin/pilotage/coverage?year=2026` | `GET /admin/pilotage/campaigns/:id/coverage` |

**New roll-up endpoints:**
- `GET /admin/pilotage/coverage/semester?year=2026&semester=1` — SUM of two quarters
- `GET /admin/pilotage/coverage/annual?year=2026` — SUM of four quarters

Both are read-only. Neither has a write endpoint.

**The pilotage dashboard** shows the current quarter by default, with a toggle to semester and annual views. Coverage reads from the same source in all three cases — the quarterly campaigns.

`actor-summary.service.ts` coverage column reads the campaign quotas for the actor's own region/department, matching the current quarter by default.

---

## 8. UI implications

The IA restructure follows directly from the model.

### Collecte hub

| Tab | Content |
|---|---|
| Campagnes | Campaign list, selector, lifecycle actions |
| Questionnaires | Unchanged |

Campaign **detail** view gains in-page tabs:
- **Quotas** — region and department quota editor for that quarter
- **Retours** — that campaign's returns
- **Couverture** — progress against that campaign's quotas

### Supervision hub

| Tab | Content |
|---|---|
| Tableau de bord | KPI tiles; coverage section reads the current quarter, with a semester/annual toggle |
| Dossiers | In-page tabs: File d'attente · Visas · Corrections |
| ~~Objectifs~~ | Deleted. Annual targets no longer exist as a concept. |

The Supervision "Objectifs" tab disappears. What it held — annual registration targets — is now a quarter's quotas, under Collecte.

### Contrôle Qualité

| Tab | Content |
|---|---|
| Qualité | Unchanged |
| Anomalies | Absorbs `/admin/files-attente?tab=anomalies` |

### Administration

| Tab | Change |
|---|---|
| Utilisateurs | Renamed from "Utilisateurs & rôles" |
| Administrateurs territoriaux | Renamed from "Équipe" |
| Traçabilité | Renamed from "Journal d'audit" |
| Paramètres | Unchanged |

### Pages deleted

- `/admin/activite` — **deleted** (Phase 5 / IA Part A, 2026-10-05)
- `/admin/files-attente` — **deleted** (Phase 5 / IA Part A, 2026-10-05)
- `/admin/cibles` — content becomes campaign detail tabs (pending Phase 3–4)

---

## 9. Sequence

This is a multi-phase refactor. Each phase is independently verifiable.

**Phase 1 — Schema comments** ✅ Done (`08618fba`, `53863f4b` chain)

Deprecation headers added to `CentralCampaignQuota`, `TerritoryTarget`, `CentralInscriptionTarget`. No field renames. No migrations. No code changes.

**Phase 2 — Data migration** ⏭ **Skipped**

All five source tables verified empty on 2026-10-05. No backfill needed. The synthetic-campaign mechanism is documented in §6.1 for the record.

**Phase 3 — Field rename and service layer**

Split into sub-phases once the rename turned out to touch the wire contract of three clients.

**3a — Schema and backend** ✅ Done (`a18bf69a`)

- `DataCampaign.type` renamed to `periodicity` (enum `CampaignPeriodicity`: `QUARTERLY | SEMESTER | ANNUAL`).
- New `purpose` (enum `CampaignPurpose`: `COLLECTION | REGISTRATION`, default `COLLECTION`).
- Migration `20261007120000_rename_campaign_type_and_add_purpose`. Any legacy free-text value, `SPECIAL` included, folds into `QUARTERLY`.
- `campaign.service.ts#toCampaignWire()` **dual-emits** both `periodicity` and the legacy `type` on every response; the request side accepts either key.

**Correction to §2.1:** the earlier draft said `type` → `purpose`. What shipped is `type` → `periodicity` *plus* a new `purpose` field. The two are separate axes and both are kept: periodicity is what period the campaign covers, purpose is what it is for. §2's table lists `purpose` only because every campaign is quarterly in the target model — `periodicity` survives as the field the existing code and campaign codes are built on, and collapsing it is not part of this refactor.

**3b — react-web client** ✅ Done (`822fbcf3`)

- `Campaign.periodicity` and `Campaign.purpose` added; legacy `type` kept but `@deprecated` and read only through `campaignPeriodicity()`.
- `createCampaign` sends **both** keys with the same value. A backend deploy predating 3a reads only `type` and would otherwise store a silent `QUARTERLY`. The client dual-emit is the mirror of the server's, and both halves retire together.
- The create dialog's periodicity options derive from the enum, which drops the no-longer-valid `SPECIAL` option.
- `campaigns.test.ts` pins the contract: prefer the new key, fall back to the old, reject off-enum values, never invent a periodicity.

**3c — Flutter clients** ⏳ Next

Two readers of the JSON key `type`: the Flutter admin and the Flutter company workspace. Both must read `periodicity` with the same fallback. Flutter changes are the user's to commit.

**3d-bis — ADMINISTRATION cohort target** ✅ Landed ahead of schedule

- New enum `CampaignQuotaScope { TERRITORIAL | ADMINISTRATION }`.
- `CampaignQuota.regionId` becomes nullable; `region` relation becomes optional.
- Three scope-qualified partial unique indexes replace the two originals.
- `campaign_quotas_scope_shape` CHECK added.
- `getCampaignQuotas` / `getCampaignReturns` read the ADMINISTRATION row from the unified table; `central` response shape unchanged.
- `writeQuotas` writes the ADMINISTRATION row via `writeAdministrationQuota`.
- `CENTRAL_CAMPAIGN_QUOTA_*` audit actions removed.
- `CentralCampaignQuota` becomes inert; retires in Phase 6.

Numbered out of sequence because it is independent of the `periodicity` alias work in 3b–3d and was unblocked first. It does not depend on 3c, and 3d does not depend on it.

**3d — Drop the aliases**

Only once 3b and 3c have both shipped: delete `toCampaignWire()`'s legacy `type` line, the request-side `?? data.type`, the `?? type` list filter, their pinning tests in `campaign.service.spec.ts`, and `buildCreateCampaignPayload`'s `type` key plus the `Campaign.type` field in react-web.

**3e — Service layer** (the original Phase 3 body, unblocked by the rename)

- Add `publishedAt`.
- `PilotageService.getCoverage` and `actor-summary.service.ts` read `CampaignQuota` only.
- ~~Remove the `applyCentral` write path (`pilotage.service.ts:577`) that still writes to `CentralCampaignQuota`.~~ Absorbed into 3d-bis.
- Add semester and annual roll-up computations.
- `getCampaignReturns` unchanged.

**Phase 4 — Endpoints**

- Retire the year-scoped quota endpoints. Add campaign-scoped and roll-up equivalents.
- Keep old endpoints returning 410 Gone for one release.
- Remove readers of `TerritoryTarget` / `CentralInscriptionTarget`.

**Phase 5 — UI restructure**

The IA changes in §8. `/admin/cibles` becomes campaign detail tabs.

**Phase 6 — Drop deprecated tables**

Drop `central_campaign_quotas`, `territory_targets`, and `central_inscription_targets`.

Only after Phase 4 is verified in production and no caller references `CentralCampaignQuota`, `TerritoryTarget`, or `CentralInscriptionTarget`.

`CentralCampaignQuota` already has no writers as of 3d-bis. One reader remains — the `centralQuota` delete-blocker in `campaign.service.ts` — and it can no longer fire, because no row can be created. Drop the model, the relation on `DataCampaign`, that blocker condition, and correct the stale "sum of CampaignQuota rows" deprecation header noted in §6.

**Phase 7 — WB UI port**

The pilotage page redesign, on top of the now-stable IA.

---

## 10. Resolutions — 2026-10-05

All open questions from the earlier draft have been decided.

### R1 — CLOSED allows reviews; ARCHIVED freezes

`CLOSED` stops new submissions; review work continues. `ARCHIVED` is the frozen, read-only, publication-ready state. (§5)

### R2 — Publication flag added

`publishedAt: DateTime?` on the Campaign model, nullable. Distinct from lifecycle. (§5)

### R3 — Owner role limited to SUPER_ADMIN and ADMIN_ONEFOP

Only these two roles may create campaigns and edit quotas. Regional and divisional admins work toward quotas but cannot set them. Rationale: quotas are a national planning decision; local actors setting their own targets is the wrong incentive. (§2)

### R4 — No overlap rule needed

Uniqueness on `(purpose, referenceYear, referenceQuarter)` prevents two campaigns of the same purpose in the same quarter by construction. Registration and collection campaigns may coexist in the same quarter. No granularity caveat because every campaign is quarterly.

There is no "annual campaign vs quarterly campaign" ambiguity because annual campaigns do not exist. (§2, §4)

### R5 — Synthetic campaigns not needed

The mechanism is documented in §6.1 for the record but not implemented. Source tables are empty.

### R6 — Extend `CampaignQuota` in place, do not rename

The unified quota table is the existing `CampaignQuota` model. Chosen over creating a new model (`CampaignTarget`) or renaming the existing one (`CampaignTerritoryQuota`) because:

- It produces one deprecated artifact at the end, not two.
- Existing callers of `prisma.campaignQuota.*` keep working — no field-rename churn.
- The name is already correct for the unified concept.

---

### R7 — ADMINISTRATION cohort target moves into `CampaignQuota`

`SUM(CampaignQuota)` could not express the ministry cohort's target: `regionId` was NOT NULL and administration returns are excluded from every territorial bucket. The options were a nullable-FK row in the unified table behind a discriminator (Path 1), keeping `CentralCampaignQuota` alive indefinitely (Path 2), or dropping the cohort target altogether (Path 3).

**Path 1.** Rationale in §3 "Why no national row"; implementation in §9 Phase 3d-bis. The same `scopeKind` slot will serve the central registration target when Phase 4 folds `CentralInscriptionTarget` into synthetic annual campaigns, so the discriminator is paid for once.

---

## 11. What this does not do

- Does not change the `OnefopSubmission` or `Company` models.
- Does not change the anomaly registry.
- Does not change notifications.
- Does not affect the register wizard.
- Does not touch the DSMO module.

The refactor is scoped to campaigns and their quotas.

---

## 12. Deferred naming debt

### `CampaignQuota.submissionTarget` keeps its narrow name

The unified quota table holds both collection quotas and registration targets, so `submissionTarget` is too narrow a name for the field. The rename to `target` is **deferred**, not rejected.

The reason is that `submissionTarget` is not only a column name. The same literal is the HTTP wire field on both request and response:

- `parseTargetBody` reads `record[field]` off the `PUT` body (`src/pilotage/pilotage-validation.ts`).
- `labelTargets` emits `[field]: target` into the `GET` response (`src/pilotage/pilotage.service.ts`).
- `replaceScoped` / `applyCentral` / `writeAdministrationQuota` use the same literal as the Prisma column key.

`react-web` mirrors the wire name against `GET|PUT /admin/pilotage/campaigns/:id/quotas` in `pilotage-targets.ts`, `pilotage-target-payload.ts` and `admin/cibles/page.tsx`. Renaming the column alone would either break the Cibles page or require splitting the conflated `TargetField` into separate database and wire types. Either way it is a coordinated frontend and backend release, which is out of scope for a schema-comment phase.

~~A further wrinkle: `CentralCampaignQuota.submissionTarget` is deprecated but still written to (see Phase 3), so `TargetField` cannot drop the old literal until that model's write path is removed.~~

That wrinkle is gone as of Phase 3d-bis — `CentralCampaignQuota` has no writers. `TargetField` is now blocked only by the wire contract described above, and `CampaignQuota.scopeKind` adds nothing to the rename: it is a new column, not another alias for `submissionTarget`.

### The CHECK constraint name will need renaming too

`campaign_quotas_submission_target_nonneg` (defined in `prisma/migrations/20261001153000_add_territory_targets_and_campaign_quotas/migration.sql`) is named after the column. PostgreSQL carries a `CHECK` expression through `ALTER TABLE ... RENAME COLUMN` automatically, so the constraint keeps working, but its name goes stale. Rename it in the same migration that renames the column.