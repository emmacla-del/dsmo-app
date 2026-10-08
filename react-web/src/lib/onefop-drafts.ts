// src/lib/onefop-drafts.ts
//
// Local draft persistence — plan §5.5: "IndexedDB + Dexie is preferred
// over treating localStorage as the primary database." Draft is keyed by
// entityType + quarterCode so that a partially-filled Q1 form never
// reloads as Q2 data (D1 fix: prior key was entityType only).

import Dexie, { type Table } from "dexie";
import type { FormData } from "./onefop-schema";

export interface DraftRecord {
  id: string;          // `${userId || "anon"}::${establishmentId || "default"}::${entityType}::${quarterCode}`
  entityType: string;
  quarterCode: string;
  userId?: string;
  establishmentId?: string;
  formId?: string;
  data: FormData;
  updatedAt: number;
}

class OnefopDraftsDb extends Dexie {
  drafts!: Table<DraftRecord, string>;

  constructor() {
    super("camleap-onefop-drafts");
    // v1: entityType was the sole PK.
    this.version(1).stores({ drafts: "entityType" });
    // v2: drop the store — IndexedDB does not allow changing the primary key
    // of an existing object store in-place; it must be deleted first.
    this.version(2).stores({ drafts: null });
    // v3: recreate with the compound id key (entityType::quarterCode).
    this.version(3).stores({ drafts: "id, entityType, quarterCode" });
    // v4: multi-tenant composite key with userId & establishmentId indexing (D8 fix).
    this.version(4).stores({ drafts: "id, entityType, quarterCode, userId, establishmentId" });
  }
}

// Dexie touches indexedDB at construction time, which doesn't exist during
// Next.js's server-side/build-time render — guard so `next build` doesn't
// try to open a database on the server.
export const draftsDb: OnefopDraftsDb | null =
  typeof window !== "undefined" ? new OnefopDraftsDb() : null;

export function draftId(
  entityType: string,
  quarterCode: string,
  userId?: string | null,
  establishmentId?: string | null,
): string {
  const u = userId?.trim() || "anon";
  const e = establishmentId?.trim() || "default";
  return `${u}::${e}::${entityType}::${quarterCode}`;
}

export async function loadDraft(
  entityType: string,
  quarterCode: string,
  userId?: string | null,
  establishmentId?: string | null,
): Promise<{ data: FormData; formId?: string } | null> {
  if (!draftsDb) return null;
  // Try tenant-scoped key first (v4)
  const id = draftId(entityType, quarterCode, userId, establishmentId);
  let record = await draftsDb.drafts.get(id);

  // Migration fallback: if not found, check legacy v3 key (`${entityType}::${quarterCode}`)
  if (!record) {
    const legacyId = `${entityType}::${quarterCode}`;
    const legacyRecord = await draftsDb.drafts.get(legacyId);
    if (legacyRecord) {
      record = legacyRecord;
      // Re-save under tenant key and delete legacy record
      await draftsDb.drafts.put({
        ...legacyRecord,
        id,
        userId: userId || undefined,
        establishmentId: establishmentId || undefined,
      });
      await draftsDb.drafts.delete(legacyId);
    }
  }

  if (!record) return null;
  return { data: record.data, formId: record.formId };
}

export async function saveDraft(
  entityType: string,
  quarterCode: string,
  data: FormData,
  userId?: string | null,
  establishmentId?: string | null,
  formId?: string,
): Promise<void> {
  if (!draftsDb) return;
  await draftsDb.drafts.put({
    id: draftId(entityType, quarterCode, userId, establishmentId),
    entityType,
    quarterCode,
    userId: userId || undefined,
    establishmentId: establishmentId || undefined,
    formId,
    data,
    updatedAt: Date.now(),
  });
}

export async function clearDraft(
  entityType: string,
  quarterCode: string,
  userId?: string | null,
  establishmentId?: string | null,
): Promise<void> {
  if (!draftsDb) return;
  await draftsDb.drafts.delete(draftId(entityType, quarterCode, userId, establishmentId));
}

/** Purges all local drafts (used on user logout for shared computer safety). */
export async function purgeAllDrafts(): Promise<void> {
  if (!draftsDb) return;
  await draftsDb.drafts.clear();
}
