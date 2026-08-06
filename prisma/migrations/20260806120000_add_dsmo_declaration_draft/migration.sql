-- CreateTable
CREATE TABLE "dsmo_declaration_drafts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "draftData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsmo_declaration_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dsmo_declaration_drafts_companyId_key" ON "dsmo_declaration_drafts"("companyId");

-- AddForeignKey
ALTER TABLE "dsmo_declaration_drafts" ADD CONSTRAINT "dsmo_declaration_drafts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
