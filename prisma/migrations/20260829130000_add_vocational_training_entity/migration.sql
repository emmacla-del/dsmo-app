-- Phase 1: Vocational Training ONEFOP entity type (VT-1, schema + migration
-- only, per VOCATIONAL_TRAINING_DESIGN_NOTE.md). Additive only — no
-- existing enum values, tables, or columns are altered or removed. Safe
-- for the six currently-operational entity types (Enterprise, Cooperative,
-- CTD, ONG, Administration, Project/Program); their data/behavior is
-- unaffected by this migration. No AST/DTO/normalizer/persistence/PDF/
-- export code is introduced by this migration — those begin at VT-2/4/7/8.

-- CreateEnum
CREATE TYPE "VtGender" AS ENUM ('MALE', 'FEMALE', 'TOTAL');

-- CreateEnum
CREATE TYPE "VtPersonType" AS ENUM ('TRAINEE', 'TRAINER');

-- CreateEnum
CREATE TYPE "VtDiplomaKind" AS ENUM ('ACADEMIC', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "VtDiplomaCode" AS ENUM ('DOCTORAT', 'MASTER2', 'MAITRISE', 'LICENCE', 'DEUG_DUT', 'BACC_GENERAL', 'BACC_TECHNIQUE', 'PROBATOIRE', 'BEPC', 'CEP', 'SANS_DIPLOME_ACADEMIQUE', 'DIPLEG_DIPES2', 'INGENIEUR_MASTER_PRO', 'DIPCEG_DIPES1', 'LICENCE_PRO', 'BTS_HND', 'BEP_BP_BACPRO', 'CAPIEG', 'CAPIAEG', 'CAP', 'DQP', 'CQP', 'AUTRES_PRO', 'SANS_DIPLOME_PROFESSIONNEL', 'TOTAL');

-- CreateEnum
CREATE TYPE "VtAgeBand" AS ENUM ('UNDER_14', 'AGE_14', 'AGE_15', 'AGE_16', 'AGE_17', 'AGE_18', 'AGE_19', 'AGE_20', 'AGE_21', 'AGE_22', 'AGE_23', 'AGE_24', 'AGE_25', 'AGE_26', 'AGE_27', 'AGE_28', 'AGE_29', 'AGE_30', 'AGE_31', 'AGE_32', 'AGE_33', 'AGE_34', 'AGE_35', 'ABOVE_35', 'TOTAL');

-- CreateEnum
CREATE TYPE "VtTrainerAgeBand" AS ENUM ('AGE_18_24', 'AGE_25_39', 'AGE_40_59', 'AGE_60_PLUS', 'TOTAL');

-- CreateEnum
CREATE TYPE "VtFlowStatus" AS ENUM ('ENTRANT', 'SORTANT', 'ABANDON');

-- CreateEnum
CREATE TYPE "VtEducationLevel" AS ENUM ('NON_ALPHABETISE', 'PRIMAIRE', 'PREMIER_CYCLE_GENERAL', 'PREMIER_CYCLE_TECHNIQUE', 'SECOND_CYCLE_GENERAL', 'SECOND_CYCLE_TECHNIQUE', 'ENSEIGNEMENT_NORMAL', 'ENSEIGNEMENT_SUPERIEUR', 'TOTAL');

-- CreateEnum
CREATE TYPE "VtVulnerableCategory" AS ENUM ('MOTEUR', 'VISUEL', 'AUDITIF', 'POLYHANDICAPES', 'REFUGIES', 'ORPHELINS_VULNERABLES', 'DEPLACES_INTERNES', 'RETOURNES', 'BORORO', 'BAKA', 'BAGUIELI', 'TOTAL');

-- CreateEnum
CREATE TYPE "VtTrainerDisabilityType" AS ENUM ('MOTEUR', 'VISUEL', 'AUDITIF', 'POLYHANDICAPES', 'TOTAL');

-- CreateEnum
CREATE TYPE "VtTrainingType" AS ENUM ('INITIAL', 'CONTINUING');

-- CreateEnum
-- TOTAL is 8.5's vocabulary only (8.5 is embedded as plain Int? columns on
-- onefop_vocational_training_details, not through this enum). Not used to
-- type onefop_vt_trainer_roster.trainerStatus, which is TEXT (1/2/3 as
-- printed) — TOTAL is structurally invalid on a named-person row.
CREATE TYPE "VtTrainerStatus" AS ENUM ('VACATAIRE_PROFESSIONNEL', 'VACATAIRE_NON_PROFESSIONNEL', 'PERMANENT', 'TOTAL');

-- CreateEnum
CREATE TYPE "VtInfrastructureType" AS ENUM ('SALLE_CLASSE', 'ATELIERS_PRATIQUES', 'LABORATOIRES', 'BLOCS_ADMINISTRATIFS', 'SALLE_REUNION', 'SALLE_FORMATEURS', 'BUREAUX', 'MAGASIN', 'ESPACES_TEMPORAIRES');

-- CreateEnum
CREATE TYPE "VtFurnitureType" AS ENUM ('BANC_1_PLACE', 'BANC_2_PLACES', 'BANC_3_PLACES', 'BANC_4_PLACES_PLUS', 'CHAISES_FORMATEURS', 'TABLES_FORMATEURS', 'ARMOIRES', 'TABLEAUX');

-- CreateEnum
CREATE TYPE "VtScholarshipCategory" AS ENUM ('OTHER_ADMIN', 'INTERNATIONAL', 'TOTAL');

-- CreateEnum
CREATE TYPE "VtScholarshipStatus" AS ENUM ('GRANTED', 'RECEIVED');

-- AlterEnum
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside any
-- transaction that also references the new value, so this must be
-- applied as its own statement/step, consistent with how Prisma
-- generates enum additions (see 20260828140000_add_administration_entity,
-- 20260829120000_add_project_program_entity). Nothing later in this
-- migration references 'VOCATIONAL_TRAINING' as a value.
ALTER TYPE "OnefopEntityType" ADD VALUE 'VOCATIONAL_TRAINING';

-- CreateTable
CREATE TABLE "onefop_vocational_training_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "structureCode" TEXT,
    "name" TEXT NOT NULL,
    "sigle" TEXT,
    "region" TEXT,
    "department" TEXT,
    "subdivision" TEXT,
    "commune" TEXT,
    "locality" TEXT,
    "area" TEXT,
    "educationSystem" TEXT,
    "cfpType" TEXT,
    "functionalStatus" TEXT,
    "nonFunctionalReason" TEXT,
    "nonFunctionalReasonOther" TEXT,
    "yearOfEstablishment" INTEGER,
    "respondentSex" TEXT,
    "promoterName" TEXT,
    "promoterSex" TEXT,
    "promoterPhone1" TEXT,
    "promoterPhone2" TEXT,
    "promoterEmail" TEXT,
    "hasStateAgreement" BOOLEAN,
    "agreementTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "siteCount" INTEGER,
    "sharesInfrastructure" BOOLEAN,
    "sharedWithSchoolName" TEXT,
    "hasSpecialNeedsTrainers" BOOLEAN,
    "specialNeedsTrainerTotal" INTEGER,
    "specialNeedsTrainerFemale" INTEGER,
    "hasAccessRamps" BOOLEAN,
    "hasDirectorOffice" BOOLEAN,
    "poBox" TEXT,
    "email" TEXT,
    "website" TEXT,
    "isAccredited" BOOLEAN,
    "lastAccreditationYear" INTEGER,
    "accreditationOrderNumber" TEXT,
    "accreditationOrderDate" TEXT,
    "trainingTypesOffered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalTraineesDeclared" INTEGER,
    "totalTrainersDeclared" INTEGER,
    "traineesFromLowerSecondary" INTEGER,
    "traineesFromUpperSecondary" INTEGER,
    "hasEnergySource" BOOLEAN,
    "isEnergySourceFunctional" BOOLEAN,
    "energySourceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasWaterSource" BOOLEAN,
    "waterSourceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasHandwashingDevice" BOOLEAN,
    "hasReceivedHealthCampaign" BOOLEAN,
    "hasFirstAidBox" BOOLEAN,
    "hasDispensary" BOOLEAN,
    "hasFunctionalLibrary" BOOLEAN,
    "fenceStatus" TEXT,
    "hasSchoolCouncil" BOOLEAN,
    "hasLevelCouncil" BOOLEAN,
    "hasDisciplinaryCouncil" BOOLEAN,
    "hasFunctionalLatrines" BOOLEAN,
    "latrineTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latrinesSeparateByGender" BOOLEAN,
    "latrinesSeparateFromStaff" BOOLEAN,
    "hasPlayground" BOOLEAN,
    "playgroundTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasIctTools" BOOLEAN,
    "ictToolsForTrainersCount" INTEGER,
    "ictToolsInternetCount" INTEGER,
    "trainersIctTrained" BOOLEAN,
    "trainersIctTrainedTotal" INTEGER,
    "trainersIctTrainedFemale" INTEGER,
    "trainersViolenceTraining" BOOLEAN,
    "trainersPssTraining" BOOLEAN,
    "hasBoarding" BOOLEAN,
    "hasGbvMechanism" BOOLEAN,
    "hasCanteen" BOOLEAN,
    "facedCrisis" BOOLEAN,
    "crisisTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "crisisClosedCenter" BOOLEAN,
    "closureDurationWeeks" INTEGER,
    "siteRelocated" BOOLEAN,
    "relocationLocality" TEXT,
    "traineesReassigned" BOOLEAN,
    "reassignedTo" TEXT,
    "hasEarlyWarningSystem" BOOLEAN,
    "earlyWarningDescription" TEXT,
    "earlyWarningFunctional" BOOLEAN,
    "trainersInnovativePedagogyTrained" BOOLEAN,
    "trainersInnovativePedagogyMale" INTEGER,
    "trainersInnovativePedagogyFemale" INTEGER,
    "trainersCrisisPedagogyTrained" BOOLEAN,
    "trainersCrisisPedagogyMale" INTEGER,
    "trainersCrisisPedagogyFemale" INTEGER,
    "trainersDrrmTrained" BOOLEAN,
    "trainersDrrmMale" INTEGER,
    "trainersDrrmFemale" INTEGER,
    "trainersEvacuationDrillTrained" BOOLEAN,
    "trainersEvacuationDrillMale" INTEGER,
    "trainersEvacuationDrillFemale" INTEGER,
    "trainersOtherEmergencyTrained" BOOLEAN,
    "trainersOtherEmergencyMale" INTEGER,
    "trainersOtherEmergencyFemale" INTEGER,
    "hasStudentRecordsSecurity" BOOLEAN,
    "hasTextbookSecurity" BOOLEAN,
    "hasContingencyPlan" BOOLEAN,
    "traineesTrainedOnProtection" BOOLEAN,
    "hasTraineeStudyGuides" BOOLEAN,
    "traineeStudyGuideCount" INTEGER,
    "hasTrainerStudyGuides" BOOLEAN,
    "trainerStudyGuideCount" INTEGER,
    "hasCareerGuidanceService" BOOLEAN,
    "careerGuidanceTimings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "traineesChooseWithSupport" BOOLEAN,
    "collaboratesWithCiopCosup" BOOLEAN,
    "guidanceSupportTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guidanceSupportOther" TEXT,
    "hasPostTrainingFollowUp" BOOLEAN,
    "followUpMechanisms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "followUpMechanismOther" TEXT,
    "hasInsertionSupportUnit" BOOLEAN,
    "hasTraineeDatabaseTool" BOOLEAN,
    "hasJobSearchSupportTool" BOOLEAN,
    "hasHivAidsRules" BOOLEAN,
    "hivRulesCoverSafety" BOOLEAN,
    "hivRulesCoverStigmaHiv" BOOLEAN,
    "hivRulesCoverStigmaOther" BOOLEAN,
    "hivRulesCoverHarassment" BOOLEAN,
    "hasDisciplinaryProcedures" BOOLEAN,
    "pupilsCommsChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teachingStaffCommsChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nonTeachingStaffCommsChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentsCommsChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schoolCouncilCommsChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "addressesIstIssues" BOOLEAN,
    "traineesReceivedFullSexEd" BOOLEAN,
    "genericLifeSkillsInSyllabus" BOOLEAN,
    "genericLifeSkillsExtracurricular" BOOLEAN,
    "reproHealthEdInSyllabus" BOOLEAN,
    "reproHealthEdExtracurricular" BOOLEAN,
    "hivTransmissionEdInSyllabus" BOOLEAN,
    "hivTransmissionEdExtracurricular" BOOLEAN,
    "trainersDeliveredSexEd" BOOLEAN,
    "trainersPassedOnToStudents" BOOLEAN,
    "heldParentOrientationSessions" BOOLEAN,
    "vacataireProfMale" INTEGER,
    "vacataireProfFemale" INTEGER,
    "vacataireNonProfMale" INTEGER,
    "vacataireNonProfFemale" INTEGER,
    "permanentMale" INTEGER,
    "permanentFemale" INTEGER,
    "facesDifficulties" BOOLEAN,
    "difficultyTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficultyOtherTexts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "perspectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vocational_training_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_diploma_data" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "personType" "VtPersonType" NOT NULL,
    "diplomaKind" "VtDiplomaKind" NOT NULL,
    "diploma" "VtDiplomaCode" NOT NULL,
    "gender" "VtGender" NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_diploma_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_trainee_age_flow" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "ageBand" "VtAgeBand" NOT NULL,
    "flowStatus" "VtFlowStatus" NOT NULL,
    "gender" "VtGender" NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_trainee_age_flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_trainer_age" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "ageBand" "VtTrainerAgeBand" NOT NULL,
    "gender" "VtGender" NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_trainer_age_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_education_level_flow" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "educationLevel" "VtEducationLevel" NOT NULL,
    "flowStatus" "VtFlowStatus" NOT NULL,
    "gender" "VtGender" NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_education_level_flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_trainee_vulnerable" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "category" "VtVulnerableCategory" NOT NULL,
    "flowStatus" "VtFlowStatus" NOT NULL,
    "gender" "VtGender" NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_trainee_vulnerable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_trainer_disability" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "category" "VtTrainerDisabilityType" NOT NULL,
    "gender" "VtGender" NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_trainer_disability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_scholarship" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "category" "VtScholarshipCategory" NOT NULL,
    "status" "VtScholarshipStatus" NOT NULL,
    "gender" "VtGender" NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_scholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_specialty_rows" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "tableCode" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "specialtyText" TEXT,
    "fiMale" INTEGER,
    "fiFemale" INTEGER,
    "fcMale" INTEGER,
    "fcFemale" INTEGER,
    "year1Male" INTEGER,
    "year1Female" INTEGER,
    "year2Male" INTEGER,
    "year2Female" INTEGER,
    "male" INTEGER,
    "female" INTEGER,
    "total" INTEGER,
    "fiCount" INTEGER,
    "fcCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_specialty_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_curricula" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "specialtyText" TEXT,
    "hasCurriculum" BOOLEAN,
    "isApproved" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_curricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_infrastructure" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "infrastructureType" "VtInfrastructureType" NOT NULL,
    "totalCount" INTEGER,
    "permanentGoodCount" INTEGER,
    "permanentBadCount" INTEGER,
    "temporaryCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_infrastructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_furniture" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "furnitureType" "VtFurnitureType" NOT NULL,
    "goodCount" INTEGER,
    "badCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_furniture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vt_trainer_roster" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "sex" TEXT,
    "trainerStatus" TEXT,
    "isAdminPersonnel" BOOLEAN,
    "academicDiploma" "VtDiplomaCode",
    "professionalDiploma" "VtDiplomaCode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vt_trainer_roster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vocational_training_details_submissionId_key" ON "onefop_vocational_training_details"("submissionId");

-- CreateIndex
CREATE INDEX "onefop_vt_diploma_data_submissionId_idx" ON "onefop_vt_diploma_data"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_diploma_data_submissionId_personType_diplomaKind__key" ON "onefop_vt_diploma_data"("submissionId", "personType", "diplomaKind", "diploma", "gender");

-- CreateIndex
CREATE INDEX "onefop_vt_trainee_age_flow_submissionId_idx" ON "onefop_vt_trainee_age_flow"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_trainee_age_flow_submissionId_ageBand_flowStatus__key" ON "onefop_vt_trainee_age_flow"("submissionId", "ageBand", "flowStatus", "gender");

-- CreateIndex
CREATE INDEX "onefop_vt_trainer_age_submissionId_idx" ON "onefop_vt_trainer_age"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_trainer_age_submissionId_ageBand_gender_key" ON "onefop_vt_trainer_age"("submissionId", "ageBand", "gender");

-- CreateIndex
CREATE INDEX "onefop_vt_education_level_flow_submissionId_idx" ON "onefop_vt_education_level_flow"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_education_level_flow_submissionId_educationLevel__key" ON "onefop_vt_education_level_flow"("submissionId", "educationLevel", "flowStatus", "gender");

-- CreateIndex
CREATE INDEX "onefop_vt_trainee_vulnerable_submissionId_idx" ON "onefop_vt_trainee_vulnerable"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_trainee_vulnerable_submissionId_category_flowStat_key" ON "onefop_vt_trainee_vulnerable"("submissionId", "category", "flowStatus", "gender");

-- CreateIndex
CREATE INDEX "onefop_vt_trainer_disability_submissionId_idx" ON "onefop_vt_trainer_disability"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_trainer_disability_submissionId_category_gender_key" ON "onefop_vt_trainer_disability"("submissionId", "category", "gender");

-- CreateIndex
CREATE INDEX "onefop_vt_scholarship_submissionId_idx" ON "onefop_vt_scholarship"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_scholarship_submissionId_category_status_gender_key" ON "onefop_vt_scholarship"("submissionId", "category", "status", "gender");

-- CreateIndex
CREATE INDEX "onefop_vt_specialty_rows_submissionId_idx" ON "onefop_vt_specialty_rows"("submissionId");

-- CreateIndex
CREATE INDEX "onefop_vt_specialty_rows_submissionId_tableCode_idx" ON "onefop_vt_specialty_rows"("submissionId", "tableCode");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_specialty_rows_submissionId_tableCode_rowIndex_key" ON "onefop_vt_specialty_rows"("submissionId", "tableCode", "rowIndex");

-- CreateIndex
CREATE INDEX "onefop_vt_curricula_submissionId_idx" ON "onefop_vt_curricula"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_curricula_submissionId_rowIndex_key" ON "onefop_vt_curricula"("submissionId", "rowIndex");

-- CreateIndex
CREATE INDEX "onefop_vt_infrastructure_submissionId_idx" ON "onefop_vt_infrastructure"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_infrastructure_submissionId_infrastructureType_key" ON "onefop_vt_infrastructure"("submissionId", "infrastructureType");

-- CreateIndex
CREATE INDEX "onefop_vt_furniture_submissionId_idx" ON "onefop_vt_furniture"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_furniture_submissionId_furnitureType_key" ON "onefop_vt_furniture"("submissionId", "furnitureType");

-- CreateIndex
CREATE INDEX "onefop_vt_trainer_roster_submissionId_idx" ON "onefop_vt_trainer_roster"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vt_trainer_roster_submissionId_rowIndex_key" ON "onefop_vt_trainer_roster"("submissionId", "rowIndex");

-- AddForeignKey
ALTER TABLE "onefop_vocational_training_details" ADD CONSTRAINT "onefop_vocational_training_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_diploma_data" ADD CONSTRAINT "onefop_vt_diploma_data_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_trainee_age_flow" ADD CONSTRAINT "onefop_vt_trainee_age_flow_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_trainer_age" ADD CONSTRAINT "onefop_vt_trainer_age_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_education_level_flow" ADD CONSTRAINT "onefop_vt_education_level_flow_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_trainee_vulnerable" ADD CONSTRAINT "onefop_vt_trainee_vulnerable_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_trainer_disability" ADD CONSTRAINT "onefop_vt_trainer_disability_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_scholarship" ADD CONSTRAINT "onefop_vt_scholarship_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_specialty_rows" ADD CONSTRAINT "onefop_vt_specialty_rows_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_curricula" ADD CONSTRAINT "onefop_vt_curricula_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_infrastructure" ADD CONSTRAINT "onefop_vt_infrastructure_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_furniture" ADD CONSTRAINT "onefop_vt_furniture_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vt_trainer_roster" ADD CONSTRAINT "onefop_vt_trainer_roster_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
