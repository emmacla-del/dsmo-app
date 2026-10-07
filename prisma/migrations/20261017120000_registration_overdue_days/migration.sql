-- The overdue threshold for company registrations becomes a platform
-- setting (/admin/parametres). Default 7, the value it had in code.

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "registrationOverdueDays" INTEGER NOT NULL DEFAULT 7;

