import Dexie, { type Table } from "dexie";
import type { RegisterCompanyPayload } from "./api-client";

const DATABASE_NAME = "camleap-registration-outbox";
const KEY_ID = "signup-payload-key-v1";
const MAX_PENDING_SIGNUPS = 1;
const CLIENT_REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidClientRequestId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_REQUEST_ID_PATTERN.test(value);
}

interface EncryptedSignup {
  id: string;
  createdAt: number;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
}

interface StoredCryptoKey {
  id: string;
  key: CryptoKey;
}

export interface QueuedSignup {
  id: string;
  createdAt: number;
  payload: RegisterCompanyPayload;
}

class RegistrationOutboxDb extends Dexie {
  entries!: Table<EncryptedSignup, string>;
  keys!: Table<StoredCryptoKey, string>;

  constructor() {
    super(DATABASE_NAME);
    this.version(1).stores({ entries: "id, createdAt", keys: "id" });
  }
}

// IndexedDB is browser-only; guarding construction keeps Next's server render
// and build from trying to open it.
const outboxDb = typeof indexedDB === "undefined" ? null : new RegistrationOutboxDb();

async function encryptionKey(db: RegistrationOutboxDb): Promise<CryptoKey> {
  const existing = await db.keys.get(KEY_ID);
  if (existing) return existing.key;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  await db.keys.put({ id: KEY_ID, key });
  return key;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export async function encryptSignupPayload(
  payload: RegisterCompanyPayload,
  key: CryptoKey,
  id: string,
): Promise<Pick<EncryptedSignup, "iv" | "ciphertext">> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(id);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, additionalData: additionalData.buffer as ArrayBuffer },
    key,
    plaintext.buffer as ArrayBuffer,
  );
  return { iv: asArrayBuffer(iv), ciphertext };
}

export async function decryptSignupPayload(
  entry: Pick<EncryptedSignup, "id" | "iv" | "ciphertext">,
  key: CryptoKey,
): Promise<RegisterCompanyPayload> {
  const additionalData = new TextEncoder().encode(entry.id);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: entry.iv,
      additionalData: additionalData.buffer as ArrayBuffer,
    },
    key,
    entry.ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as RegisterCompanyPayload;
}

function requireOutbox(): RegistrationOutboxDb {
  if (!outboxDb) throw new Error("Offline signup storage is unavailable in this browser.");
  if (!globalThis.crypto?.subtle) throw new Error("Secure offline signup storage is unavailable.");
  return outboxDb;
}

/** Store the complete request encrypted; never write applicant data/password in clear text. */
export async function enqueueSignup(payload: RegisterCompanyPayload): Promise<string> {
  const db = requireOutbox();
  if (!isValidClientRequestId(payload.clientRequestId)) {
    throw new Error("An offline signup request needs a valid idempotency key.");
  }
  if ((await db.entries.count()) >= MAX_PENDING_SIGNUPS) {
    throw new Error("A signup is already waiting to sync from this browser.");
  }

  const key = await encryptionKey(db);
  const encrypted = await encryptSignupPayload(payload, key, payload.clientRequestId);
  await db.entries.put({
    id: payload.clientRequestId,
    createdAt: Date.now(),
    ...encrypted,
  });
  return payload.clientRequestId;
}

/** The caller presents a pending request to the user before sending it. */
export async function getQueuedSignups(): Promise<QueuedSignup[]> {
  // Browsers without IndexedDB or Web Crypto cannot have a restorable queue.
  // Let their online registration form work normally; enqueueSignup reports
  // the limitation only if a submission actually needs offline storage.
  if (typeof indexedDB === "undefined" || !globalThis.crypto?.subtle) return [];
  const db = requireOutbox();
  const entries = await db.entries.orderBy("createdAt").toArray();
  if (entries.length === 0) return [];

  const validEntries: EncryptedSignup[] = [];
  for (const entry of entries) {
    if (!isValidClientRequestId(entry.id)) await db.entries.delete(entry.id);
    else validEntries.push(entry);
  }
  if (validEntries.length === 0) {
    await db.keys.delete(KEY_ID);
    return [];
  }

  const keyRecord = await db.keys.get(KEY_ID);
  if (!keyRecord) {
    await db.entries.bulkDelete(validEntries.map((entry) => entry.id));
    await db.keys.delete(KEY_ID);
    return [];
  }

  const queued: QueuedSignup[] = [];
  for (const entry of validEntries) {
    try {
      const payload = await decryptSignupPayload(entry, keyRecord.key);
      if (!isValidClientRequestId(payload.clientRequestId) || payload.clientRequestId !== entry.id) {
        await db.entries.delete(entry.id);
        continue;
      }
      queued.push({ id: entry.id, createdAt: entry.createdAt, payload });
    } catch {
      // A corrupt record cannot be authenticated or replayed safely. Drop it
      // so an unreadable item does not block the one-entry outbox forever.
      await db.entries.delete(entry.id);
    }
  }

  if (queued.length === 0) await db.keys.delete(KEY_ID);
  return queued;
}

/** Keep the encrypted request until the server confirms it accepted the signup. */
export async function sendQueuedSignup<T>(
  id: string,
  send: (payload: RegisterCompanyPayload) => Promise<T>,
): Promise<{ payload: RegisterCompanyPayload; response: T }> {
  const db = requireOutbox();
  const entry = await db.entries.get(id);
  if (!entry) throw new Error("This queued signup is no longer on this device.");
  if (!isValidClientRequestId(id)) {
    await db.entries.delete(id);
    if ((await db.entries.count()) === 0) await db.keys.delete(KEY_ID);
    throw new Error("This queued signup has an invalid idempotency key and was discarded.");
  }
  const keyRecord = await db.keys.get(KEY_ID);
  if (!keyRecord) {
    await db.entries.delete(id);
    throw new Error("This queued signup could not be decrypted and was discarded.");
  }

  let payload: RegisterCompanyPayload;
  try {
    payload = await decryptSignupPayload(entry, keyRecord.key);
  } catch {
    await db.entries.delete(id);
    if ((await db.entries.count()) === 0) await db.keys.delete(KEY_ID);
    throw new Error("This queued signup could not be authenticated and was discarded.");
  }
  if (!payload || typeof payload !== "object" || !isValidClientRequestId(payload.clientRequestId) || payload.clientRequestId !== id) {
    await db.entries.delete(id);
    if ((await db.entries.count()) === 0) await db.keys.delete(KEY_ID);
    throw new Error("This queued signup does not match its idempotency key and was discarded.");
  }
  const response = await send(payload);
  await db.entries.delete(id);
  if ((await db.entries.count()) === 0) await db.keys.delete(KEY_ID);
  return { payload, response };
}

/** Explicitly discard the local queued request and its encryption key. */
export async function discardQueuedSignup(id: string): Promise<void> {
  const db = requireOutbox();
  await db.entries.delete(id);
  if ((await db.entries.count()) === 0) await db.keys.delete(KEY_ID);
}
