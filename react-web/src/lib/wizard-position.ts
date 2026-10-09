// Wizard position across a reload (N3): which stage and section the
// respondent was on, and whether they acknowledged the legal notice. Kept in
// sessionStorage — this browser tab's session only, never the URL and never
// localStorage — under keys derived from the same tenant-scoped draft key
// as the IndexedDB draft (onefop-drafts.ts draftId: user + establishment +
// entity + quarter), so one respondent's position never applies to another
// declaration.
//
// Every storage access is wrapped: with storage unavailable (private mode,
// blocked site data) reads return nothing and writes are dropped, and the
// wizard simply starts at its first step.
//
// The parsing helpers are pure and unit-tested (wizard-position.test.ts).

import type { StoredPositionLike } from "./wizard-rail-gate";

const POSITION_PREFIX = "camleap.onefop.position::";
const LEGAL_ACK_PREFIX = "camleap.onefop.legalAck::";

export interface StoredWizardPosition extends StoredPositionLike {
  /** ModernJobs only: the table open in the table deck. */
  activeTableId?: string;
}

export function wizardPositionKey(draftKey: string): string {
  return POSITION_PREFIX + draftKey;
}

export function legalAckKey(draftKey: string): string {
  return LEGAL_ACK_PREFIX + draftKey;
}

/** A stored position, or null when the value is missing or malformed. */
export function parseWizardPosition(raw: string | null | undefined): StoredWizardPosition | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.stage !== "section" && v.stage !== "quiz" && v.stage !== "review") return null;
  const index = typeof v.sectionIndex === "number" && Number.isFinite(v.sectionIndex) ? Math.trunc(v.sectionIndex) : 0;
  const out: StoredWizardPosition = { stage: v.stage, sectionIndex: Math.max(0, index) };
  if (typeof v.activeTableId === "string" && v.activeTableId) out.activeTableId = v.activeTableId;
  return out;
}

export function serializeWizardPosition(position: StoredWizardPosition): string {
  const out: StoredWizardPosition = { stage: position.stage, sectionIndex: position.sectionIndex };
  if (position.activeTableId) out.activeTableId = position.activeTableId;
  return JSON.stringify(out);
}

function session(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readWizardPosition(draftKey: string): StoredWizardPosition | null {
  try {
    return parseWizardPosition(session()?.getItem(wizardPositionKey(draftKey)));
  } catch {
    return null;
  }
}

export function writeWizardPosition(draftKey: string, position: StoredWizardPosition): void {
  try {
    session()?.setItem(wizardPositionKey(draftKey), serializeWizardPosition(position));
  } catch {
    /* storage unavailable or full — the position is simply not kept */
  }
}

export function readLegalAck(draftKey: string): boolean {
  try {
    return session()?.getItem(legalAckKey(draftKey)) === "1";
  } catch {
    return false;
  }
}

export function writeLegalAck(draftKey: string): void {
  try {
    session()?.setItem(legalAckKey(draftKey), "1");
  } catch {
    /* storage unavailable — the notice is shown again after a reload */
  }
}

/** Whether any legal acknowledgment is held in this session (any declaration). */
export function hasAnyLegalAck(): boolean {
  try {
    const s = session();
    if (!s) return false;
    for (let i = 0; i < s.length; i++) {
      if (s.key(i)?.startsWith(LEGAL_ACK_PREFIX)) return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

/** Forgets the position and the legal acknowledgment of one declaration (after submission). */
export function clearWizardSession(draftKey: string): void {
  try {
    const s = session();
    s?.removeItem(wizardPositionKey(draftKey));
    s?.removeItem(legalAckKey(draftKey));
  } catch {
    /* nothing to clear */
  }
}

/** Whether a storage key belongs to the wizard session state. */
export function isWizardSessionKey(key: string | null | undefined): boolean {
  return !!key && (key.startsWith(POSITION_PREFIX) || key.startsWith(LEGAL_ACK_PREFIX));
}

/** Forgets every stored position and acknowledgment (on logout). */
export function purgeWizardSessions(): void {
  try {
    const s = session();
    if (!s) return;
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (isWizardSessionKey(key)) keys.push(key as string);
    }
    keys.forEach((key) => s.removeItem(key));
  } catch {
    /* nothing to purge */
  }
}
