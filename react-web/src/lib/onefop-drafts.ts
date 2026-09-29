// src/lib/onefop-drafts.ts
//
// Local draft persistence — plan §5.5: "IndexedDB + Dexie is preferred
// over treating localStorage as the primary database." Draft is keyed by
// entityType + quarterCode so that a partially-filled Q1 form never
// reloads as Q2 data (D1 fix: prior key was entityType only).

import Dexie, { type Table } from "dexie";
import type { FormData } from "./onefop-schema";

export interface DraftRecord {
  id: string;          // `${entityType}::${quarterCode}`
  entityType: string;
  quarterCode: string;
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
  }
}

// Dexie touches indexedDB at construction time, which doesn't exist during
// Next.js's server-side/build-time render — guard so `next build` doesn't
// try to open a database on the server.
export const draftsDb: OnefopDraftsDb | null =
  typeof window !== "undefined" ? new OnefopDraftsDb() : null;

function draftId(entityType: string, quarterCode: string): string {
  return `${entityType}::${quarterCode}`;
}

export async function loadDraft(entityType: string, quarterCode: string): Promise<FormData | null> {
  if (!draftsDb) return null;
  const record = await draftsDb.drafts.get(draftId(entityType, quarterCode));
  return record?.data ?? null;
}

export async function saveDraft(
  entityType: string,
  quarterCode: string,
  data: FormData,
): Promise<void> {
  if (!draftsDb) return;
  await draftsDb.drafts.put({
    id: draftId(entityType, quarterCode),
    entityType,
    quarterCode,
    data,
    updatedAt: Date.now(),
  });
}

export async function clearDraft(entityType: string, quarterCode: string): Promise<void> {
  if (!draftsDb) return;
  await draftsDb.drafts.delete(draftId(entityType, quarterCode));
}
