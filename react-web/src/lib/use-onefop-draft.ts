"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormData } from "./onefop-schema";
import { clearDraft, loadDraft, saveDraft } from "./onefop-drafts";
import { mergeWithAutofill } from "./onefop-autofill";

export type DraftStatus = "loading" | "saving" | "saved" | "error";

/**
 * Loads a per-entity-per-quarter draft from IndexedDB on mount/entity-switch,
 * and autosaves back to it (debounced) whenever the caller's data changes.
 * Merges with initialAutofill (from account registration) so identification
 * fields are never left blank.
 *
 * `quarterCode` is required for keying — the draft load is deferred until it
 * is non-null so that a Q1 draft never reloads as Q2 data (D1 fix).
 *
 * `formId` is a stable UUID for the lifetime of an entity+quarter session.
 * It is reset whenever the entity type or quarter changes, so retrying a
 * submission in the same session reuses the same formId and the backend can
 * enforce idempotency (P4 fix).
 *
 * `status` is entirely derived (loadedKey vs. entityType+quarterCode, data vs.
 * lastSavedData) rather than set synchronously inside an effect body.
 */
export function useOnefopDraft(
  entityType: string,
  quarterCode: string | null | undefined,
  initialAutofill?: FormData,
  userId?: string | null,
  establishmentId?: string | null,
) {
  const [data, setData] = useState<FormData>({});
  const [loadedEntityType, setLoadedEntityType] = useState<string | null>(null);
  const [loadedQuarterCode, setLoadedQuarterCode] = useState<string | null>(null);
  const [lastSavedData, setLastSavedData] = useState<FormData>({});
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [idbSaveFailed, setIdbSaveFailed] = useState(false);
  const skipNextSave = useRef(false);
  const entityTypeRef = useRef(entityType);
  const quarterCodeRef = useRef(quarterCode);
  const initialAutofillRef = useRef(initialAutofill);
  const userIdRef = useRef(userId);
  const establishmentIdRef = useRef(establishmentId);
  // P4 / N1: stable formId per entity+quarter session
  const formIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    initialAutofillRef.current = initialAutofill;
  }, [initialAutofill]);

  useEffect(() => {
    entityTypeRef.current = entityType;
  }, [entityType]);

  useEffect(() => {
    quarterCodeRef.current = quarterCode;
  }, [quarterCode]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    establishmentIdRef.current = establishmentId;
  }, [establishmentId]);

  // Load draft once both entityType and quarterCode are known.
  // Reuses persisted formId if available for idempotency (N1 fix).
  useEffect(() => {
    if (!quarterCode) return;
    let cancelled = false;
    loadDraft(entityType, quarterCode, userId, establishmentId).then((draft) => {
      if (cancelled) return;
      if (draft?.formId) {
        formIdRef.current = draft.formId;
      } else {
        formIdRef.current = crypto.randomUUID();
      }
      const loaded = draft?.data ?? {};
      const merged = initialAutofillRef.current
        ? mergeWithAutofill(loaded, initialAutofillRef.current)
        : loaded;
      skipNextSave.current = true;
      setData(merged);
      setLastSavedData(merged);
      setLoadedEntityType(entityType);
      setLoadedQuarterCode(quarterCode);
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, quarterCode, userId, establishmentId]);

  const appliedAutofillRef = useRef<FormData | undefined>(undefined);

  // When initialAutofill arrives async (getMyCompany/getMe resolves after mount),
  // apply it — registration data always wins for identification fields (D3 fix).
  useEffect(() => {
    if (!initialAutofill || Object.keys(initialAutofill).length === 0) return;
    if (appliedAutofillRef.current === initialAutofill) return;
    appliedAutofillRef.current = initialAutofill;

    queueMicrotask(() => {
      if (entityTypeRef.current !== entityType) return;
      setData((prev) => {
        const merged = mergeWithAutofill(prev, initialAutofill);
        let changed = false;
        for (const k of Object.keys(merged)) {
          if (merged[k] !== prev[k]) {
            changed = true;
            break;
          }
        }
        return changed ? merged : prev;
      });
    });
  }, [initialAutofill, entityType]);

  useEffect(() => {
    if (!quarterCode) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const savedFor = entityTypeRef.current;
      const savedForQuarter = quarterCodeRef.current;
      const savedForUser = userIdRef.current;
      const savedForEst = establishmentIdRef.current;
      if (!savedForQuarter) return;
      saveDraft(savedFor, savedForQuarter, data, savedForUser, savedForEst, formIdRef.current).then(() => {
        if (entityTypeRef.current === savedFor && quarterCodeRef.current === savedForQuarter) {
          setLastSavedData(data);
          setLastSavedAt(new Date());
          setIdbSaveFailed(false);
        }
      }).catch(() => {
        // D2: IndexedDB write failed (private browsing, quota exceeded, ITP).
        // idbSaveFailed is set so callers can show a "save failed" toast.
        // lastSavedData is intentionally NOT updated — status stays "saving"
        // so the header badge makes the failure visible.
        setIdbSaveFailed(true);
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [data, quarterCode]);

  const onChange = useCallback((fieldId: string | Record<string, unknown>, value?: unknown) => {
    if (typeof fieldId === "object" && fieldId !== null) {
      setData((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [k, v] of Object.entries(fieldId)) {
          if (v === undefined) {
            if (k in next) {
              delete next[k];
              changed = true;
            }
          } else if (next[k] !== v) {
            next[k] = v;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      return;
    }

    setData((prev) => {
      if (value === undefined) {
        if (!(fieldId in prev)) return prev;
        const next = { ...prev };
        delete next[fieldId];
        return next;
      }
      if (prev[fieldId] === value) return prev;
      return { ...prev, [fieldId]: value };
    });
  }, []);

  // Deletes this session's local draft under the same user/establishment-scoped
  // key the autosave writes to — callers must not rebuild the key themselves.
  const clearLocalDraft = useCallback(async () => {
    const savedForQuarter = quarterCodeRef.current;
    if (!savedForQuarter) return;
    await clearDraft(entityTypeRef.current, savedForQuarter, userIdRef.current, establishmentIdRef.current);
  }, []);

  const status: DraftStatus =
    !quarterCode || loadedEntityType !== entityType || loadedQuarterCode !== quarterCode
      ? "loading"
      : idbSaveFailed
      ? "error"
      : data !== lastSavedData
      ? "saving"
      : "saved";

  return { data, onChange, status, formId: formIdRef.current, lastSavedAt, saveFailed: idbSaveFailed, clearLocalDraft };
}
