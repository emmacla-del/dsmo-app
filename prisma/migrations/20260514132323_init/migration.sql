-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('COMPANY', 'DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'DIVISION_APPROVED', 'REGION_APPROVED', 'FINAL_APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('CENTRALE', 'DECONCENTRE', 'RATTACHE');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECRUITMENT', 'PROMOTION', 'DISMISSAL', 'RETIREMENT', 'DEATH');

-- CreateEnum
CREATE TYPE "OnefopEntityType" AS ENUM ('ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG');

-- CreateEnum
CREATE TYPE "OnefopStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'OPENED', 'CLICKED', 'FAILED');

-- CreateEnum
CREATE TYPE "ValidationStepType" AS ENUM ('IDENTIFICATION', 'CSP_TABLES', 'DIPLOMA_TABLES', 'DISABILITY_TABLES', 'VULNERABLE_TABLES', 'FIRST_TIME_TABLES', 'DEPARTURE_TABLES', 'SKILLS_TABLES', 'TRAINING_TABLES', 'FINAL_VALIDATION', 'GENDER_SUM', 'CATEGORY_SUM', 'MOVEMENT_CONSISTENCY', 'WORKFORCE_GROWTH', 'EMPLOYEE_VALIDATION');

-- CreateEnum
CREATE TYPE "CspCategory" AS ENUM ('CADRES', 'FOREMEN', 'WORKERS', 'TOTAL');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'TOTAL');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('AGE_15_24', 'AGE_25_34', 'AGE_35_PLUS', 'TOTAL');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'TEMPORARY', 'TOTAL');

-- CreateEnum
CREATE TYPE "DepartureType" AS ENUM ('DISMISSAL', 'RESIGNATION', 'RETIREMENT', 'OTHER', 'ENSEMBLE');

-- CreateEnum
CREATE TYPE "InternshipType" AS ENUM ('VACATION', 'ACADEMIC', 'PROFESSIONAL', 'PRE_EMPLOYMENT', 'TOTAL');

-- CreateEnum
CREATE TYPE "DiplomaType" AS ENUM ('CEP', 'PROBATOIRE', 'BAC', 'BTS', 'LICENCE', 'MAITRISE', 'MASTER', 'DQP', 'CQP', 'AUTRES', 'SANS_DIPLOME', 'TOTAL');

-- CreateEnum
CREATE TYPE "DisabilityStatus" AS ENUM ('PERMANENT', 'TEMPORARY', 'TOTAL');

-- CreateEnum
CREATE TYPE "DismissalUnemploymentType" AS ENUM ('DISMISSAL', 'TECHNICAL_UNEMPLOYMENT', 'TOTAL');

-- CreateEnum
CREATE TYPE "VulnerableType" AS ENUM ('DEPLACES_INTERNES', 'REFUGIES', 'ORPHELINS', 'CADRES_VULN', 'FOREMEN_VULN', 'WORKERS_VULN', 'TOTAL_VULN');

-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('MINISTRE', 'SECRETAIRE_GENERAL', 'DIRECTEUR', 'SOUS_DIRECTEUR', 'CHEF_DIVISION', 'CHEF_SERVICE', 'CHEF_BUREAU', 'CHEF_CELLULE', 'CHARGE_ETUDES_ASSISTANT', 'INSPECTEUR_GENERAL_SERVICES', 'INSPECTEUR_SERVICES', 'INSPECTEUR_GENERAL_FORMATIONS', 'INSPECTEUR_FORMATIONS', 'ATTACHE_PEDAGOGIQUE', 'CONSEILLER_TECHNIQUE', 'CHEF_SECRETARIAT_PARTICULIER', 'DELEGUE_REGIONAL', 'DELEGUE_DEPARTEMENTAL', 'INSPECTEUR_REGIONAL_FORMATIONS', 'CONSEILLER_REGIONAL_FORMATIONS', 'STAFF');

-- CreateTable
CREATE TABLE "minefop_services" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "acronym" TEXT,
    "category" "ServiceCategory" NOT NULL,
    "level" INTEGER NOT NULL,
    "parentCode" TEXT,
    "roleMapping" "UserRole" NOT NULL,
    "requiresRegion" BOOLEAN NOT NULL DEFAULT false,
    "requiresDepartment" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "minefop_services_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "service_positions" (
    "id" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "positionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "level" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "nameEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "nameEn" TEXT,
    "regionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subdivisions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "nameEn" TEXT,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subdivisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT,
    "nameEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'COMPANY',
    "region" TEXT,
    "department" TEXT,
    "subdivision" TEXT,
    "matricule" TEXT,
    "poste" TEXT,
    "serviceCode" TEXT,
    "positionType" TEXT,
    "positionTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rejectionReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentCompany" TEXT,
    "mainActivity" TEXT NOT NULL,
    "secondaryActivity" TEXT,
    "region" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "subdivision" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "taxNumber" TEXT NOT NULL,
    "cnpsNumber" TEXT,
    "socialCapital" DOUBLE PRECISION,
    "totalEmployees" INTEGER NOT NULL,
    "menCount" INTEGER,
    "womenCount" INTEGER,
    "lastYearTotal" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fax" TEXT,
    "lastYearMenCount" INTEGER,
    "lastYearWomenCount" INTEGER,
    "entityType" "OnefopEntityType",
    "sectorId" TEXT,
    "regionId" TEXT,
    "departmentId" TEXT,
    "subdivisionId" TEXT,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declarations" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "status" "DeclarationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "pdfUrl" TEXT,
    "receiptUrl" TEXT,
    "qrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fillingDate" TIMESTAMP(3),

    CONSTRAINT "declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "nationality" TEXT NOT NULL,
    "diploma" TEXT,
    "function" TEXT NOT NULL,
    "seniority" INTEGER NOT NULL,
    "salaryCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "salary" INTEGER,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaration_movements" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "cat1_3" INTEGER NOT NULL DEFAULT 0,
    "cat4_6" INTEGER NOT NULL DEFAULT 0,
    "cat7_9" INTEGER NOT NULL DEFAULT 0,
    "cat10_12" INTEGER NOT NULL DEFAULT 0,
    "catNonDeclared" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "declaration_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_steps" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "stepType" "ValidationStepType" NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message" TEXT,
    "checkedBy" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualitative_questions" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerText" TEXT,
    "answerOptions" JSONB,
    "hasTrainingCenter" BOOLEAN,
    "trainingCenterDetails" TEXT,
    "recruitmentPlansNext" BOOLEAN,
    "recruitmentPlanCount" INTEGER,
    "camerounisationPlan" BOOLEAN,
    "usesTempAgencies" BOOLEAN,
    "temporaryWorkerCount" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tempAgencyDetails" TEXT,

    CONSTRAINT "qualitative_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "regionFilter" TEXT,
    "departmentFilter" TEXT,
    "submissionStatus" "DeclarationStatus",
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "declarationId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "details" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_submissions" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "formType" "OnefopEntityType" NOT NULL,
    "status" "OnefopStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rawData" JSONB NOT NULL,
    "flags" JSONB,
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "surveyYear" INTEGER NOT NULL,
    "region" TEXT,
    "department" TEXT,
    "subdivision" TEXT,
    "submittedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT,
    "regionId" TEXT,
    "departmentId" TEXT,
    "subdivisionId" TEXT,

    CONSTRAINT "onefop_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_respondents" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "respondentName" TEXT NOT NULL,
    "respondentFunction" TEXT NOT NULL,
    "phone1" TEXT NOT NULL,
    "phone2" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_respondents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_enterprise_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "legalStatus" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "subdivision" TEXT NOT NULL,
    "locality" TEXT,
    "phone1" TEXT NOT NULL,
    "phone2" TEXT,
    "poBox" TEXT,
    "sector" TEXT NOT NULL,
    "branch" TEXT,
    "mainActivity" TEXT NOT NULL,
    "headOffice" TEXT,
    "permanentWorkers" INTEGER NOT NULL,
    "vacancies" INTEGER,
    "enterpriseSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sectorId" TEXT,

    CONSTRAINT "onefop_enterprise_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_cooperative_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "cooperativeName" TEXT NOT NULL,
    "headOffice" TEXT,
    "yearCreated" INTEGER,
    "area" TEXT,
    "region" TEXT,
    "department" TEXT,
    "subdivision" TEXT,
    "locality" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "poBox" TEXT,
    "sector" TEXT,
    "branch" TEXT,
    "mainActivity" TEXT,
    "cooperativeType" TEXT,
    "cooperativeTypeOther" TEXT,
    "permanentWorkers" INTEGER,
    "vacancies" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_cooperative_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_ctd_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "ctdType" TEXT NOT NULL,
    "councilType" TEXT,
    "yearCreated" INTEGER,
    "area" TEXT,
    "region" TEXT,
    "department" TEXT,
    "subdivision" TEXT,
    "locality" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "poBox" TEXT,
    "sector" TEXT,
    "branch" TEXT,
    "permanentWorkers" INTEGER,
    "vacancies" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_ctd_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_ong_details" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "ongName" TEXT NOT NULL,
    "headOffice" TEXT,
    "yearCreated" INTEGER,
    "area" TEXT,
    "region" TEXT,
    "department" TEXT,
    "subdivision" TEXT,
    "locality" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "poBox" TEXT,
    "sector" TEXT,
    "branch" TEXT,
    "mainMission" TEXT,
    "permanentWorkers" INTEGER,
    "vacancies" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_ong_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_csp_gender_age" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "cspCategory" "CspCategory" NOT NULL,
    "gender" "Gender" NOT NULL,
    "ageBand" "AgeBand",
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_csp_gender_age_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_diploma_data" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "diploma" "DiplomaType" NOT NULL,
    "gender" "Gender" NOT NULL,
    "ageBand" "AgeBand",
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_diploma_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_disability_data" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "cspCategory" "CspCategory" NOT NULL,
    "status" "DisabilityStatus" NOT NULL,
    "gender" "Gender" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_disability_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_vulnerable_data" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "vulnerableType" "VulnerableType" NOT NULL,
    "status" "DisabilityStatus" NOT NULL,
    "gender" "Gender" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_vulnerable_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_first_time_workers" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "cspCategory" "CspCategory" NOT NULL,
    "gender" "Gender" NOT NULL,
    "ageBand" "AgeBand",
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_first_time_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_departure_data" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "cspCategory" "CspCategory" NOT NULL,
    "departureType" "DepartureType" NOT NULL,
    "gender" "Gender" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_departure_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_dismissal_reasons" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reasonIndex" INTEGER NOT NULL,
    "reasonText" TEXT,
    "maleCount" INTEGER NOT NULL DEFAULT 0,
    "femaleCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_dismissal_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_dismissal_unemployment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "cspCategory" "CspCategory" NOT NULL,
    "type" "DismissalUnemploymentType" NOT NULL,
    "gender" "Gender" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_dismissal_unemployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_internship_data" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "internshipType" "InternshipType" NOT NULL,
    "gender" "Gender" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_internship_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_skill_needs" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "skillIndex" INTEGER NOT NULL,
    "skillDescription" TEXT,
    "maleCount" INTEGER NOT NULL DEFAULT 0,
    "femaleCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_skill_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_training_needs" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "domainIndex" INTEGER NOT NULL,
    "trainingDomain" TEXT,
    "maleCount" INTEGER NOT NULL DEFAULT 0,
    "femaleCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_training_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_fact_recruitments" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "region" TEXT,
    "department" TEXT,
    "subdivision" TEXT,
    "businessSector" INTEGER,
    "companySize" INTEGER,
    "csp" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "recruitmentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_fact_recruitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onefop_fact_skill_needs" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "region" TEXT,
    "department" TEXT,
    "subdivision" TEXT,
    "businessSector" INTEGER,
    "companySize" INTEGER,
    "skillDescription" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onefop_fact_skill_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "region" TEXT,
    "department" TEXT,
    "totalEmployment" INTEGER NOT NULL,
    "maleEmployment" INTEGER NOT NULL,
    "femaleEmployment" INTEGER NOT NULL,
    "totalRecruitment" INTEGER NOT NULL,
    "totalDismissals" INTEGER NOT NULL,
    "avgSalaryCategory" DOUBLE PRECISION,
    "companiesSubmitted" INTEGER NOT NULL,
    "companiesApproved" INTEGER NOT NULL,
    "companiesPending" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_positions_serviceCode_positionType_key" ON "service_positions"("serviceCode", "positionType");

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_regionId_name_key" ON "departments"("regionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "subdivisions_code_key" ON "subdivisions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subdivisions_departmentId_name_key" ON "subdivisions"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_name_key" ON "sectors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_code_key" ON "sectors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_serviceCode_idx" ON "users"("serviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "companies_userId_key" ON "companies"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_taxNumber_key" ON "companies"("taxNumber");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_declarationId_idx" ON "audit_logs"("declarationId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_submissions_submissionId_key" ON "onefop_submissions"("submissionId");

-- CreateIndex
CREATE INDEX "onefop_submissions_status_idx" ON "onefop_submissions"("status");

-- CreateIndex
CREATE INDEX "onefop_submissions_formType_idx" ON "onefop_submissions"("formType");

-- CreateIndex
CREATE INDEX "onefop_submissions_surveyYear_idx" ON "onefop_submissions"("surveyYear");

-- CreateIndex
CREATE INDEX "onefop_submissions_region_idx" ON "onefop_submissions"("region");

-- CreateIndex
CREATE INDEX "onefop_submissions_submittedBy_idx" ON "onefop_submissions"("submittedBy");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_respondents_submissionId_key" ON "onefop_respondents"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_enterprise_details_submissionId_key" ON "onefop_enterprise_details"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_cooperative_details_submissionId_key" ON "onefop_cooperative_details"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_ctd_details_submissionId_key" ON "onefop_ctd_details"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_ong_details_submissionId_key" ON "onefop_ong_details"("submissionId");

-- CreateIndex
CREATE INDEX "onefop_csp_gender_age_submissionId_tableName_idx" ON "onefop_csp_gender_age"("submissionId", "tableName");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_csp_gender_age_submissionId_tableName_cspCategory_ge_key" ON "onefop_csp_gender_age"("submissionId", "tableName", "cspCategory", "gender", "ageBand");

-- CreateIndex
CREATE INDEX "onefop_diploma_data_submissionId_idx" ON "onefop_diploma_data"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_diploma_data_submissionId_diploma_gender_ageBand_key" ON "onefop_diploma_data"("submissionId", "diploma", "gender", "ageBand");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_disability_data_submissionId_cspCategory_status_gend_key" ON "onefop_disability_data"("submissionId", "cspCategory", "status", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_vulnerable_data_submissionId_vulnerableType_status_g_key" ON "onefop_vulnerable_data"("submissionId", "vulnerableType", "status", "gender");

-- CreateIndex
CREATE INDEX "onefop_first_time_workers_submissionId_idx" ON "onefop_first_time_workers"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_first_time_workers_submissionId_contractType_cspCate_key" ON "onefop_first_time_workers"("submissionId", "contractType", "cspCategory", "gender", "ageBand");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_departure_data_submissionId_cspCategory_departureTyp_key" ON "onefop_departure_data"("submissionId", "cspCategory", "departureType", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_dismissal_reasons_submissionId_reasonIndex_key" ON "onefop_dismissal_reasons"("submissionId", "reasonIndex");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_dismissal_unemployment_submissionId_cspCategory_type_key" ON "onefop_dismissal_unemployment"("submissionId", "cspCategory", "type", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_internship_data_submissionId_internshipType_gender_key" ON "onefop_internship_data"("submissionId", "internshipType", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_skill_needs_submissionId_skillIndex_key" ON "onefop_skill_needs"("submissionId", "skillIndex");

-- CreateIndex
CREATE UNIQUE INDEX "onefop_training_needs_submissionId_domainIndex_key" ON "onefop_training_needs"("submissionId", "domainIndex");

-- CreateIndex
CREATE INDEX "onefop_fact_recruitments_submissionId_idx" ON "onefop_fact_recruitments"("submissionId");

-- CreateIndex
CREATE INDEX "onefop_fact_recruitments_year_region_idx" ON "onefop_fact_recruitments"("year", "region");

-- CreateIndex
CREATE INDEX "onefop_fact_skill_needs_submissionId_idx" ON "onefop_fact_skill_needs"("submissionId");

-- CreateIndex
CREATE INDEX "onefop_fact_skill_needs_year_region_idx" ON "onefop_fact_skill_needs"("year", "region");

-- AddForeignKey
ALTER TABLE "minefop_services" ADD CONSTRAINT "minefop_services_parentCode_fkey" FOREIGN KEY ("parentCode") REFERENCES "minefop_services"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_positions" ADD CONSTRAINT "service_positions_serviceCode_fkey" FOREIGN KEY ("serviceCode") REFERENCES "minefop_services"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subdivisions" ADD CONSTRAINT "subdivisions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_serviceCode_fkey" FOREIGN KEY ("serviceCode") REFERENCES "minefop_services"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_subdivisionId_fkey" FOREIGN KEY ("subdivisionId") REFERENCES "subdivisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declarations" ADD CONSTRAINT "declarations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "declarations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaration_movements" ADD CONSTRAINT "declaration_movements_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "declarations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_steps" ADD CONSTRAINT "validation_steps_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "declarations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualitative_questions" ADD CONSTRAINT "qualitative_questions_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "declarations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "declarations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_submissions" ADD CONSTRAINT "onefop_submissions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_submissions" ADD CONSTRAINT "onefop_submissions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_submissions" ADD CONSTRAINT "onefop_submissions_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_submissions" ADD CONSTRAINT "onefop_submissions_subdivisionId_fkey" FOREIGN KEY ("subdivisionId") REFERENCES "subdivisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_submissions" ADD CONSTRAINT "onefop_submissions_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_respondents" ADD CONSTRAINT "onefop_respondents_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_enterprise_details" ADD CONSTRAINT "onefop_enterprise_details_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_enterprise_details" ADD CONSTRAINT "onefop_enterprise_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_cooperative_details" ADD CONSTRAINT "onefop_cooperative_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_ctd_details" ADD CONSTRAINT "onefop_ctd_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_ong_details" ADD CONSTRAINT "onefop_ong_details_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_csp_gender_age" ADD CONSTRAINT "onefop_csp_gender_age_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_diploma_data" ADD CONSTRAINT "onefop_diploma_data_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_disability_data" ADD CONSTRAINT "onefop_disability_data_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_vulnerable_data" ADD CONSTRAINT "onefop_vulnerable_data_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_first_time_workers" ADD CONSTRAINT "onefop_first_time_workers_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_departure_data" ADD CONSTRAINT "onefop_departure_data_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_dismissal_reasons" ADD CONSTRAINT "onefop_dismissal_reasons_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_dismissal_unemployment" ADD CONSTRAINT "onefop_dismissal_unemployment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_internship_data" ADD CONSTRAINT "onefop_internship_data_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_skill_needs" ADD CONSTRAINT "onefop_skill_needs_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_training_needs" ADD CONSTRAINT "onefop_training_needs_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_fact_recruitments" ADD CONSTRAINT "onefop_fact_recruitments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onefop_fact_skill_needs" ADD CONSTRAINT "onefop_fact_skill_needs_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "onefop_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
