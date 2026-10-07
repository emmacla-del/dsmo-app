import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STALE_AFTER_DAYS, daysSince, nudgePreview } from "./nudge-preview";

const NOW = new Date("2026-10-04T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function actor(partial: { role?: string; stale?: number; percent?: number | null; lastDecisionAt?: string | null }) {
  return {
    role: partial.role ?? "REGIONAL_ADMIN",
    coverage: { target: 100, current: 34, percent: partial.percent === undefined ? 0.34 : partial.percent },
    processing: {
      backlog: 3,
      stale: partial.stale ?? 0,
      decisions: { approved: 0, rejected: 0, corrections: 0 },
      medianDaysToDecision: null,
    },
    ...("lastDecisionAt" in partial ? { lastDecisionAt: partial.lastDecisionAt } : {}),
  };
}

test("daysSince counts whole days, never less than one", () => {
  assert.equal(daysSince(new Date(NOW.getTime() - 12 * DAY - 1000).toISOString(), NOW), 12);
  assert.equal(daysSince(new Date(NOW.getTime() - 60 * 1000).toISOString(), NOW), 1);
});

test("STALE_BACKLOG states the server's threshold, not a fixed 7", () => {
  assert.equal(
    nudgePreview("STALE_BACKLOG", actor({ stale: 2 }), { staleAfterDays: 10, now: NOW }),
    "Vous avez 2 dossiers en attente depuis plus de 10 jours.",
  );
  assert.equal(
    nudgePreview("STALE_BACKLOG", actor({ stale: 1 }), { now: NOW }),
    `Vous avez 1 dossier en attente depuis plus de ${DEFAULT_STALE_AFTER_DAYS} jours.`,
  );
  assert.equal(nudgePreview("STALE_BACKLOG", actor({ stale: 0 }), { now: NOW }), null);
});

test("BEHIND_TARGET names the current calendar year and the admin's scope", () => {
  assert.equal(nudgePreview("BEHIND_TARGET", actor({}), { now: NOW }), "Votre région est à 34% de la cible 2026.");
  assert.equal(
    nudgePreview("BEHIND_TARGET", actor({ role: "DIVISIONAL_ADMIN" }), { now: new Date("2027-03-01T00:00:00Z") }),
    "Votre département est à 34% de la cible 2027.",
  );
  assert.equal(nudgePreview("BEHIND_TARGET", actor({ percent: null }), { now: NOW }), null);
});

test("NO_RECENT_ACTIVITY counts from the last decision", () => {
  const last = new Date(NOW.getTime() - 12 * DAY).toISOString();
  assert.equal(
    nudgePreview("NO_RECENT_ACTIVITY", actor({ lastDecisionAt: last }), { now: NOW }),
    "Aucune décision enregistrée sur votre compte depuis 12 jours.",
  );
  assert.equal(
    nudgePreview("NO_RECENT_ACTIVITY", actor({ lastDecisionAt: null }), { now: NOW }),
    "Aucune décision n’a encore été enregistrée sur votre compte.",
  );
  // An older server sends no field at all: the count stays unstated.
  assert.match(nudgePreview("NO_RECENT_ACTIVITY", actor({}), { now: NOW }) ?? "", /depuis N jours/);
});
