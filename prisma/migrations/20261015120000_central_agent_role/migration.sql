-- A non-administrative role for staff of the central and attached MINEFOP
-- services (national read-only). Added on its own: PostgreSQL does not let a
-- transaction use an enum value it has just added.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CENTRAL_AGENT';
