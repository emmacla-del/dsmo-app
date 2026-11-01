-- A coherence warning on a pending file whose figures no longer disagree,
-- found by a re-check of the file with the current rules, is closed as
-- RESOLVED with a resolution type of its own (owner, CLAUDE.md §21,
-- 2026-11-01): the system closed it, not a reviewer, and the history says so.
--
-- Additive: no existing row is read or rewritten, and the value is used by
-- no statement in this migration (PostgreSQL requires it committed first).

ALTER TYPE "AnomalyResolutionType" ADD VALUE IF NOT EXISTS 'RULE_RECHECK';
