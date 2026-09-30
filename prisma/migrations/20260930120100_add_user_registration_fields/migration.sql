-- Admin rebuild B1 — user & registration fields.
--
-- Additive only: every new users column is nullable except "tokenVersion",
-- which has a default (Postgres 11+ adds it without rewriting the table).
-- One new table. No drop, rename or NOT NULL without a default. Existing
-- rows keep all their values; the new columns start NULL (tokenVersion 0).
-- Nothing in the application reads or writes these columns yet.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approvalComment" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "perAgentTarget" INTEGER,
ADD COLUMN     "registrationMethod" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "registration_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileRef" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,

    CONSTRAINT "registration_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Unique over a column that is NULL on every existing row: Postgres allows
-- any number of NULLs, so this cannot fail on current data.
CREATE UNIQUE INDEX "users_registrationNumber_key" ON "users"("registrationNumber");

-- CreateIndex
CREATE INDEX "users_createdBy_idx" ON "users"("createdBy");

-- CreateIndex
CREATE INDEX "users_assigneeId_idx" ON "users"("assigneeId");

-- CreateIndex
CREATE INDEX "registration_documents_userId_idx" ON "registration_documents"("userId");

-- CreateIndex
CREATE INDEX "registration_documents_verifiedBy_idx" ON "registration_documents"("verifiedBy");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_documents" ADD CONSTRAINT "registration_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_documents" ADD CONSTRAINT "registration_documents_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
