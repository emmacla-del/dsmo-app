# Campaign Model Refactor — Design Plan

**Status:** Design agreed. Not implemented.
**Date:** 2026-10-05
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
| `type` | enum | `COLLECTION` \| `REGISTRATION` |
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

**Uniqueness:** one campaign per `(type, referenceYear, referenceQuarter)`. Enforced by a database unique constraint.

**No granularity field.** Every campaign is quarterly. Semester and annual views are computed, not stored.

**No objectives field. No targets field. One concept: quotas.**

### Why quarters only

The alternative — annual campaigns with quarterly sub-campaigns — produces two independent sets of numbers for the same period and a permanent ambiguity about which one is authoritative. Splitting into quarters makes every quota traceable to a specific period, and the semester/annual views become simple sums.

This also matches the existing system: `SubmissionRound.quarterCode` is already quarterly (`2026-T4`), and the register wizard and submission flow assume quarter windows.

---

## 3. Quotas

One table. Replaces four.

```
CampaignQuota
  id             UUID
  campaignId     FK → Campaign
  regionId       FK → Region    (nullable)
  departmentId   FK → Department (nullable)
  quantity       Int

  @@unique([campaignId, regionId, departmentId])
```

**Region-level row:** `regionId` set, `departmentId` null.
**Department-level row:** both set.
**National total:** never stored. Computed as `SUM(quantity) WHERE campaignId = X`.

**Validation** (in the service, not the schema):
- The sum of a region's department quotas must equal the region's own quota if the region has one.
- If a region has no quota set, its departments' quotas stand alone.
- Negative quantities rejected.
- A quota cannot be set for a region outside the campaign's `scopeRegions`.

### Why no national row

Storing it would require a special-case row with both FKs null, which makes the composite unique constraint awkward in Postgres. Computing it instead guarantees the national figure is always consistent with the regional sum.

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
| `territory_targets` | Deprecated. Data migrates to `CampaignQuota`. |
| `central_inscription_targets` | Deprecated. |
| `campaign_quotas` | Deprecated. Data migrates to `CampaignQuota`. |
| `central_campaign_quotas` | Deprecated. |

**Do not drop the old tables in the first migration.** Deprecate first, migrate data, verify, then drop in a follow-up. Reversibility matters.

### Synthetic campaigns on migration

If `territory_targets` or `central_inscription_targets` contain rows, the migration creates one synthetic annual REGISTRATION campaign per year present:

- `name`: `"Campagne d'inscription annuelle [YYYY]"`
- `type`: `REGISTRATION`
- `referenceYear`: the year
- `referenceQuarter`: 4 (the campaign is treated as ending in Q4)
- `startDate`: YYYY-01-01
- `deadline`: YYYY-12-31
- `lifecycle`: `CLOSED`
- `publishedAt`: null

Quota rows are attached to the matching synthetic campaign.

**Note:** the synthetic campaign's quarterly representation is a migration artifact, not a real quarterly planning unit. It exists only to give the historical annual target a parent. If the source tables are empty (expected given the earlier data reset), no synthetic campaigns are created and the migration only touches `campaign_quotas` and `central_campaign_quotas`, which already reference real campaigns.

Migration verification:
- Row counts in `CampaignQuota` match the sum of rows in the four source tables.
- Every region-level row maps to a `CampaignQuota` row with `regionId` set, `departmentId` null.
- Every department-level row maps to a row with both FKs set.

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

- `/admin/activite` — every section duplicated elsewhere
- `/admin/files-attente` — queues redistributed
- `/admin/cibles` — content becomes campaign detail tabs

---

## 9. Sequence

This is a multi-phase refactor. Each phase is independently verifiable.

**Phase 1 — Schema**
Add `CampaignQuota`. Add `type`, `referenceYear`, `referenceQuarter`, `publishedAt` to the campaign model. Enforce unique `(type, referenceYear, referenceQuarter)`. Deprecate the four old tables but do not drop them.

**Phase 2 — Data migration**
Backfill `CampaignQuota` from the four old tables. Create synthetic campaigns only if the annual source tables contain rows. Verify counts match.

**Phase 3 — Service layer**
`PilotageService.getCoverage` and `actor-summary.service.ts` read `CampaignQuota`. Add semester and annual roll-up computations. `getCampaignReturns` unchanged.

**Phase 4 — Endpoints**
Retire the year-scoped quota endpoints. Add campaign-scoped and roll-up equivalents. Keep the old ones returning 410 Gone for one release.

**Phase 5 — UI restructure**
The IA changes in §8. Both tabs and pages.

**Phase 6 — Drop deprecated tables**
Only after Phase 4 is verified in production and no caller references them.

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

Uniqueness on `(type, referenceYear, referenceQuarter)` prevents two campaigns of the same type in the same quarter by construction. Registration and collection campaigns may coexist in the same quarter. No granularity caveat because every campaign is quarterly.

There is no "annual campaign vs quarterly campaign" ambiguity because annual campaigns do not exist. (§2, §4)

### R5 — Synthetic campaigns on migration

One synthetic annual REGISTRATION campaign per year present in `territory_targets` or `central_inscription_targets`, with `referenceQuarter = 4` and `lifecycle = CLOSED`. If the source tables are empty, no synthetic campaigns are created. (§6)

---

## 11. What this does not do

- Does not change the `OnefopSubmission` or `Company` models.
- Does not change the anomaly registry.
- Does not change notifications.
- Does not affect the register wizard.
- Does not touch the DSMO module.

The refactor is scoped to campaigns and their quotas.