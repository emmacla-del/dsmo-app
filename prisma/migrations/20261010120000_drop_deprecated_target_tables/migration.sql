-- Phase 6b of docs/plans/campaign-model-refactor.md: drops the three
-- deprecated target tables.
--
--   territory_targets             annual registration targets per territory
--   central_inscription_targets   annual national registration target
--   central_campaign_quotas       per-campaign target for the ministry cohort
--
-- All three were superseded by campaign_quotas. The ministry cohort moved
-- into it behind scopeKind in 20261008120000_campaign_quota_scope_kind;
-- coverage folds its quarterly rows since Phase 3e.
--
-- Why this is safe:
--   - Phase 6a (89cdebc5) removed every code reader. No writer has existed
--     since 3d-bis or earlier.
--   - All three tables were verified empty in the live project on
--     2026-10-05, and nothing has written to them since. No backfill.
--   - No other table holds a foreign key into these three. Their own
--     foreign keys, indexes (including the two partial unique indexes on
--     territory_targets) and CHECK constraints are dropped with them.
--     None of the three references another, so order is not significant.
--
-- Plain DROP TABLE on purpose: no IF EXISTS, so a table already missing is
-- a loud failure rather than a silent no-op; no CASCADE, so an unexpected
-- dependency stops the migration instead of being dropped along with it.
--
-- NOT applied by this commit.

-- DropTable
DROP TABLE "territory_targets";

-- DropTable
DROP TABLE "central_inscription_targets";

-- DropTable
DROP TABLE "central_campaign_quotas";
