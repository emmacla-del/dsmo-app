-- Company.regionId / departmentId indexes for Axis 1 coverage counts.
-- New folder. Do not edit 20261001153000_add_territory_targets_and_campaign_quotas.
-- NOT applied by this commit.

-- CreateIndex
CREATE INDEX "companies_regionId_idx" ON "companies"("regionId");

-- CreateIndex
CREATE INDEX "companies_departmentId_idx" ON "companies"("departmentId");
