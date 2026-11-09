import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OwnClaimLapseNote } from "./OwnClaimLapseNote";
import { ownLapseCount, type OwnClaimLapses } from "@/lib/claim-lapses";

const KEY = ["claims", "lapses", "me"];
const lapses = (registrations: number, submissions: number): OwnClaimLapses => ({
  since: "2026-10-10T00:00:00.000Z",
  until: "2026-11-09T00:00:00.000Z",
  days: 30,
  registrations,
  submissions,
});

test("the count a page shows is its own kind, and never negative or missing", () => {
  assert.equal(ownLapseCount(lapses(2, 5), "registrations"), 2);
  assert.equal(ownLapseCount(lapses(2, 5), "submissions"), 5);
  assert.equal(ownLapseCount(undefined, "registrations"), 0);
  // An older server answers without the fields: that is not a count.
  assert.equal(ownLapseCount({ days: 30 } as OwnClaimLapses, "submissions"), 0);
});

test("the officer reads their own missed deadlines for this queue, in words", () => {
  renderWithProviders(<OwnClaimLapseNote kind="registrations" />, { locale: "fr", queryData: [[KEY, lapses(2, 1)]] });
  assert.ok(screen.getByRole("note").textContent?.includes("2 de vos réclamations d’inscription ont expiré sans décision ces 30 derniers jours."));
});

test("one lapse reads in the singular", () => {
  renderWithProviders(<OwnClaimLapseNote kind="submissions" />, { locale: "en", queryData: [[KEY, lapses(0, 1)]] });
  assert.equal(screen.getByRole("note").textContent, "1 of your file claims expired without a decision in the last 30 days.");
});

test("nothing is shown when the officer missed no deadline on this kind of file", () => {
  renderWithProviders(<OwnClaimLapseNote kind="registrations" />, { locale: "fr", queryData: [[KEY, lapses(0, 4)]] });
  assert.equal(screen.queryByRole("note"), null);
});
