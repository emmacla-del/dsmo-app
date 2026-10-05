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

The refactor collapses the two into one. **The campaign is the primary entity. Quotas belong to a campaign. There is no separate annual concept.**

---

## 2. The campaign

A campaign is the unit of collection or registration work. It carries:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | string | Human label |
| `type` | enum | `COLLECTION` \| `REGISTRATION` |
| `granularity` | enum | `QUARTERLY` \| `SEMESTER` \| `ANNUAL` |
| `startDate` | date | |
| `deadline` | date | |
| `referenceYear` | int | For reporting; a Q1 2026 campaign has year 2026 |
| `scopeRegions` | relation | Which regions this campaign covers |
| `scopeEntityTypes` | enum[] | Which entity types it covers |
| `lifecycle` | enum | `DRAFT` \| `ACTIVE` \| `PAUSED` \| `CLOSED` \| `ARCHIVED` |
| `createdBy` | FK User | |
| `ownerRole` | enum | Which role manages it |
| `createdAt`, `updatedAt` | timestamp | |

**No objectives field. No targets field. One concept: quotas.**

### Granularity and the "active campaign" question

A campaign can be quarterly, semester or annual. **Overlapping campaigns of the same type are prevented at creation time.** Rule: no two campaigns of the same `type` may have overlapping `[startDate, deadline]` windows. Quarterly + annual *of the same type* is rejected. Quarterly registration + annual collection is allowed.

If a future requirement needs overlapping campaigns, this rule is the thing to revisit — not the schema.

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

Storing it would require a special-case row with both FKs null, which makes the composite unique constraint awkward in Postgres. Computing it instead guarantees the national figure is always consistent with the regional sum. If a national number is displayed, it is a display of the sum, not a stored number.

---

## 4. Lifecycle states

| State | Meaning |
|---|---|
| `DRAFT` | Being prepared. Not visible to respondents. |
| `ACTIVE` | Collecting submissions. |
| `PAUSED` | Temporarily not accepting new submissions. Reviews continue. |
| `CLOSED` | No new submissions. Reviews and corrections continue. |
| `ARCHIVED` | Frozen. Read-only. Included in statistical reports. |

**Open decision:** should `CLOSED` allow reviews, or freeze everything? Current proposal: `CLOSED` stops new submissions but allows review work; `ARCHIVED` freezes everything. Confirm before implementation.

**Open decision:** a `PUBLISHED` flag distinct from lifecycle? Statistical offices often distinguish "campaign closed" from "campaign included in published statistics." If yes, add `publishedAt: DateTime?`.

---

## 5. What this replaces

| Existing table | After refactor |
|---|---|
| `territory_targets` | Deprecated. Data migrates to `CampaignQuota`. |
| `central_inscription_targets` | Deprecated. |
| `campaign_quotas` | Deprecated. Data migrates to `CampaignQuota`. |
| `central_campaign_quotas` | Deprecated. |

The migration is the risky part. Every existing row must be attached to a campaign. For annual targets, the migration creates a synthetic campaign per year if none exists.

**Do not drop the old tables in the first migration.** Deprecate first, migrate data, verify, then drop in a follow-up. Reversibility matters.

---

## 6. Endpoint changes

Every quota endpoint becomes campaign-scoped. Signature changes:

| Today | After |
|---|---|
| `GET /admin/pilotage/targets/inscriptions?year=2026` | `GET /admin/pilotage/campaigns/:id/quotas` |
| `PUT /admin/pilotage/targets/inscriptions?year=2026` | `PUT /admin/pilotage/campaigns/:id/quotas` |
| `GET /admin/pilotage/campaigns/:id/quotas` | Unchanged, but reads the unified table |
| `GET /admin/pilotage/coverage?year=2026` | `GET /admin/pilotage/campaigns/:id/coverage` |

**The pilotage dashboard reads the active campaign's coverage**, not an annual target. If multiple campaigns are active (registration + collection), the dashboard shows one at a time with a selector.

`actor-summary.service.ts` coverage column reads the same source — campaign quotas for the actor's own region/department.

---

## 7. UI implications

The IA restructure follows directly from the model.

### Collecte hub

| Tab | Content |
|---|---|
| Campagnes | Campaign list, selector, lifecycle actions |
| Questionnaires | Unchanged |

Campaign **detail** view gains in-page tabs:
- **Quotas** — region and department quota editor
- **Retours** — completed campaign returns
- **Couverture** — progress against quotas, per region

### Supervision hub

| Tab | Content |
|---|---|
| Tableau de bord | KPI tiles; coverage section reads the **active campaign** |
| Dossiers | In-page tabs: File d'attente · Visas · Corrections |
| ~~Objectifs~~ | Deleted. Annual targets no longer exist as a concept. |

The Supervision "Objectifs" tab disappears. What it held — annual registration targets — is now a campaign's quotas, under Collecte.

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

## 8. Sequence

This is a multi-phase refactor. Each phase is independently verifiable.

**Phase 1 — Schema**
Add `CampaignQuota`. Add `type`, `granularity`, `referenceYear` to the campaign model if missing. Deprecate the four old tables but do not drop them.

**Phase 2 — Data migration**
Backfill `CampaignQuota` from the four old tables. For annual targets, create a synthetic annual campaign per reference year. Verify counts match.

**Phase 3 — Service layer**
`PilotageService.getCoverage` and `actor-summary.service.ts` read `CampaignQuota`. `getCampaignReturns` unchanged.

**Phase 4 — Endpoints**
Retire the year-scoped quota endpoints. Add campaign-scoped equivalents. Keep the old ones returning 410 Gone for one release.

**Phase 5 — UI restructure**
The IA changes in §7. Both tabs and pages.

**Phase 6 — Drop deprecated tables**
Only after Phase 4 is verified in production and no caller references them.

**Phase 7 — WB UI port**
The pilotage page redesign, on top of the now-stable IA.

---

## 9. Open questions

Before implementation:

1. **CLOSED vs ARCHIVED** — does CLOSED allow reviews, or freeze everything? (§4)
2. **Publication flag** — separate from lifecycle? (§4)
3. **Owner role** — which role creates and manages a campaign? `SUPER_ADMIN` only, or `ADMIN_ONEFOP` too?
4. **Overlap rule** — confirmed: same-type campaigns cannot overlap in time. Different types may. (§2)
5. **Synthetic campaigns on migration** — if a year has `territory_targets` but no matching campaign, the migration must create one. What `name` and `type` should it carry?

## 10. What this does not do

- Does not change the `OnefopSubmission` or `Company` models.
- Does not change the anomaly registry.
- Does not change notifications.
- Does not affect the register wizard.
- Does not touch the DSMO module.

The refactor is scoped to campaigns and their quotas.