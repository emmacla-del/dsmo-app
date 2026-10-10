// src/lib/onefop-drafts.ts
//
// Local draft persistence — plan §5.5: "IndexedDB + Dexie is preferred
// over treating localStorage as the primary database." Draft is keyed by
// entityType + quarterCode so that a partially-filled Q1 form never
// reloads as Q2 data (D1 fix: prior key was entityType only).

import Dexie, { type Table } from "dexie";
import type { FormData } from "./onefop-schema";
import { purgeWizardSessions } from "./wizard-position";
import { referencePeriodKey } from "./onefop-period-label";

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

  // Same period, other code (F8): a draft started under the no-campaign
  // fallback "2026-T4" must still be found once the campaign opens as
  // "QUARTERLY_2026_T4_001" (or a later "…_002"). Same user, establishment
  // and entity only; the most recent one wins. It moves to the current key.
  if (!record) {
    const period = referencePeriodKey(quarterCode);
    if (period) {
      const u = userId?.trim() || "anon";
      const e = establishmentId?.trim() || "default";
      const candidates = (await draftsDb.drafts.where("entityType").equals(entityType).toArray())
        .filter((r) =>
          r.id !== id &&
          (r.userId || "anon") === u &&
          (r.establishmentId || "default") === e &&
          referencePeriodKey(r.quarterCode) === period &&
          r.data && Object.keys(r.data).length > 0)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const found = candidates[0];
      if (found) {
        record = { ...found, id, quarterCode };
        await draftsDb.drafts.put(record);
        await draftsDb.drafts.delete(found.id);
      }
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
  const scopedKey = draftId(entityType, quarterCode, userId, establishmentId);
  await draftsDb.drafts.delete(scopedKey);
  const legacyKey = draftId(entityType, quarterCode);
  if (legacyKey !== scopedKey) {
    await draftsDb.drafts.delete(legacyKey);
  }
}

/** Purges all local drafts (used on user logout for shared computer safety),
 *  together with the wizard positions and legal acknowledgments kept in
 *  sessionStorage (wizard-position.ts). */
export async function purgeAllDrafts(): Promise<void> {
  purgeWizardSessions();
  if (!draftsDb) return;
  await draftsDb.drafts.clear();
}
