-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('COMPANY', 'DIVISIONAL', 'REGIONAL', 'CENTRAL');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'DIVISION_APPROVED', 'REGION_APPROVED', 'FINAL_APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED', 'BOUNCED', 'OPENED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECRUITMENT', 'PROMOTION', 'DISMISSAL', 'RETIREMENT', 'DEATH');

-- CreateEnum
CREATE TYPE "ValidationStepType" AS ENUM ('GENDER_SUM', 'CATEGORY_SUM', 'MOVEMENT_CONSISTENCY', 'WORKFORCE_GROWTH', 'EMPLOYEE_VALIDATION', 'OVERALL_CONSISTENCY');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TRAINING_CENTER', 'RECRUITMENT_PLANS', 'CAMEROUNISATION', 'TEMP_AGENCIES', 'QUALITATIVE', 'QUANTITATIVE');

-- CreateEnum
CREATE TYPE "QuestionSection" AS ENUM ('GENERAL', 'EMPLOYMENT', 'TRAINING', 'DIVERSITY', 'FUTURE_PLANS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'COMPANY',
    "region" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentCompany" TEXT,
    "mainActivity" TEXT NOT NULL,
    "secondaryActivity" TEXT,
    "region" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "district" TEXT NOT NULL,
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

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
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

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeclarationMovement" (
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

    CONSTRAINT "DeclarationMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationStep" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "stepType" "ValidationStepType" NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message" TEXT,
    "checkedBy" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
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

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
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

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
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

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Declaration" (
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

    CONSTRAINT "Declaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualitativeQuestion" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL DEFAULT 'QUALITATIVE',
    "section" "QuestionSection" NOT NULL DEFAULT 'GENERAL',
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

    CONSTRAINT "QualitativeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_userId_key" ON "Company"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_taxNumber_key" ON "Company"("taxNumber");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_declarationId_idx" ON "AuditLog"("declarationId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "Notification_sentBy_idx" ON "Notification"("sentBy");

-- CreateIndex
CREATE INDEX "Notification_sentAt_idx" ON "Notification"("sentAt");

-- CreateIndex
CREATE INDEX "QualitativeQuestion_declarationId_idx" ON "QualitativeQuestion"("declarationId");

-- CreateIndex
CREATE INDEX "QualitativeQuestion_questionType_idx" ON "QualitativeQuestion"("questionType");

-- CreateIndex
CREATE INDEX "QualitativeQuestion_section_idx" ON "QualitativeQuestion"("section");

-- CreateIndex
CREATE UNIQUE INDEX "QualitativeQuestion_declarationId_questionType_version_key" ON "QualitativeQuestion"("declarationId", "questionType", "version");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclarationMovement" ADD CONSTRAINT "DeclarationMovement_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationStep" ADD CONSTRAINT "ValidationStep_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Declaration" ADD CONSTRAINT "Declaration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitativeQuestion" ADD CONSTRAINT "QualitativeQuestion_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
