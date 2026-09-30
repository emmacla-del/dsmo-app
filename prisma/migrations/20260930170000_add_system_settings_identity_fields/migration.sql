-- Admin rebuild — /admin/parametres editable identity fields.
--
-- Additive only: four nullable columns on the system_settings singleton.
-- No default, no NOT NULL, no drop or rename. The existing row keeps all
-- its values; the new columns start NULL ("not configured yet").
-- Not applied by the build session — a human runs `npx prisma migrate deploy`.

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "defaultLanguage" TEXT,
ADD COLUMN     "observatoryName" TEXT,
ADD COLUMN     "timezone" TEXT;
