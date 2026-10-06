-- Drop registration_documents.
--
-- The registration-documents feature was retired in 23af1de8: no upload path
-- ever existed, so its rows recorded clicks on files that were never
-- received. Every code read and write went with that commit; this removes
-- the table, the RegistrationDocument model and its two User relations.
--
-- Rechecked against production on 2026-10-06: 0 rows, and no foreign key or
-- view refers to the table. Its own indexes and its two foreign keys to
-- users go with it. Dropping it also ends the onDelete: Restrict relation
-- that blocked deleteUser on a registrant with document rows.

DROP TABLE "registration_documents";
