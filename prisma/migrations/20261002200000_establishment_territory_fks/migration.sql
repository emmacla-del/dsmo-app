-- Add foreign keys for territory hierarchy on establishments
ALTER TABLE "establishments"
  ADD CONSTRAINT "establishments_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "regions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "establishments"
  ADD CONSTRAINT "establishments_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "establishments"
  ADD CONSTRAINT "establishments_subdivisionId_fkey"
  FOREIGN KEY ("subdivisionId") REFERENCES "subdivisions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
