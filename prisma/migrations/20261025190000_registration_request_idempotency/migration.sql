-- A client keeps this key with an encrypted offline signup request. If the
-- server creates the account but the response is lost, retrying the same key
-- returns the existing account instead of creating a duplicate.
ALTER TABLE "users" ADD COLUMN "registrationRequestId" TEXT;

CREATE UNIQUE INDEX "users_registrationRequestId_key"
  ON "users"("registrationRequestId");
