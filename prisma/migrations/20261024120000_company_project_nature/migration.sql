-- A project / programme's nature (PP_S1Q01 « Type d'entité ») is asked once
-- at registration and pre-filled into the wizard, as ctdType already is for
-- CTD_S1Q01. Holds the questionnaire's option string. Nullable: registrations
-- made before this column existed carry none, and the wizard asks them as before.
-- AlterTable
ALTER TABLE "companies" ADD COLUMN "projectNature" TEXT;
