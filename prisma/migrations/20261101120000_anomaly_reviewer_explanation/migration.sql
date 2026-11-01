-- A warning a reviewer explains from the dossier workspace (« Expliquer »)
-- is closed as RESOLVED with a resolution type of its own (owner, CLAUDE.md
-- §21, 2026-11-01). Stored as FIELD_INSPECTION it would have read, in the
-- Quality Centre and the audit trail, as an on-site check by a sworn agent
-- that never took place.
--
-- Additive: no existing row is read or rewritten, and the value is used by
-- no statement in this migration (PostgreSQL requires it committed first).

ALTER TYPE "AnomalyResolutionType" ADD VALUE IF NOT EXISTS 'REVIEWER_EXPLANATION';
