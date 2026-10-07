-- Shared invitation links for groups of MINEFOP staff (Phase B of the staff
-- invitation work). The link secret is stored only as its SHA-256.

-- CreateTable
CREATE TABLE "staff_invitation_links" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "region" TEXT,
    "department" TEXT,
    "maxUses" INTEGER NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invitation_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_invitation_links_tokenHash_key" ON "staff_invitation_links"("tokenHash");

-- CreateIndex
CREATE INDEX "staff_invitation_links_createdBy_idx" ON "staff_invitation_links"("createdBy");

-- AddForeignKey
ALTER TABLE "staff_invitation_links" ADD CONSTRAINT "staff_invitation_links_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

