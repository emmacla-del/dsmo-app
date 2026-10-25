import assert from "node:assert/strict";
import { test } from "node:test";
import type { RegisterCompanyPayload } from "@/lib/api-client";
import { decryptSignupPayload, encryptSignupPayload } from "@/lib/registration-outbox";

const PAYLOAD: RegisterCompanyPayload = {
  clientRequestId: "request-1",
  email: "agent@example.cm",
  password: "Secret-Password-123!",
  firstName: "Awa",
  lastName: "Manga",
  role: "COMPANY",
  companyName: "Example Organisation",
  address: "Centre, Cameroon",
};

async function key() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

test("an offline signup payload is encrypted and can be restored with its device key", async () => {
  const cryptoKey = await key();
  const encrypted = await encryptSignupPayload(PAYLOAD, cryptoKey, PAYLOAD.clientRequestId!);
  const ciphertext = Buffer.from(encrypted.ciphertext).toString("base64");

  assert.equal(ciphertext.includes(PAYLOAD.password), false);
  assert.deepEqual(
    await decryptSignupPayload({ id: PAYLOAD.clientRequestId!, ...encrypted }, cryptoKey),
    PAYLOAD,
  );
});

test("an encrypted signup cannot be opened with a different request key", async () => {
  const cryptoKey = await key();
  const encrypted = await encryptSignupPayload(PAYLOAD, cryptoKey, PAYLOAD.clientRequestId!);

  await assert.rejects(
    decryptSignupPayload({ id: "another-request", ...encrypted }, cryptoKey),
  );
});

test("tampering with the stored ciphertext is detected", async () => {
  const cryptoKey = await key();
  const encrypted = await encryptSignupPayload(PAYLOAD, cryptoKey, PAYLOAD.clientRequestId!);
  const tampered = encrypted.ciphertext.slice(0);
  new Uint8Array(tampered)[0] ^= 1;

  await assert.rejects(
    decryptSignupPayload(
      { id: PAYLOAD.clientRequestId!, ...encrypted, ciphertext: tampered },
      cryptoKey,
    ),
  );
});
