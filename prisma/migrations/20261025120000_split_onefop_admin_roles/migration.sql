-- Split ONEFOP administrator access by its two operational domains.
-- ADMIN_ONEFOP remains available for existing accounts and keeps its current
-- broad access until a Super Admin explicitly assigns a specialist role.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN_ONEFOP_REGISTRATIONS';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN_ONEFOP_SUBMISSIONS';
