-- Central and attached services now map to CENTRAL_AGENT instead of
-- ADMIN_ONEFOP. A post in one of them is a staff post, not an administrator:
-- ADMIN_ONEFOP is granted explicitly by a SUPER_ADMIN, never derived from a
-- service. Only rows still carrying the old mapping are touched.
UPDATE public.minefop_services
SET "roleMapping" = 'CENTRAL_AGENT'
WHERE category IN ('CENTRALE', 'RATTACHE')
  AND "roleMapping" = 'ADMIN_ONEFOP';
