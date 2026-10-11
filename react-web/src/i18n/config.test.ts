import { test } from "node:test";
import assert from "node:assert/strict";
import { preferredLocale } from "./config";

test("no browser preference falls back to French", () => {
  assert.equal(preferredLocale(null), "fr");
  assert.equal(preferredLocale(""), "fr");
  assert.equal(preferredLocale([]), "fr");
});

test("an English browser gets English, regional tags included", () => {
  assert.equal(preferredLocale("en-US,en;q=0.9"), "en");
  assert.equal(preferredLocale(["en-GB"]), "en");
});

test("the highest-weighted supported language wins, not the first listed", () => {
  assert.equal(preferredLocale("fr;q=0.5,en;q=0.9"), "en");
  assert.equal(preferredLocale("de-DE,fr-CM;q=0.8,en;q=0.7"), "fr");
});

test("unsupported languages and q=0 entries are skipped", () => {
  assert.equal(preferredLocale("de,es;q=0.9"), "fr");
  assert.equal(preferredLocale("en;q=0,fr;q=0.1"), "fr");
  assert.equal(preferredLocale(["pt-BR", "en-US"]), "en");
});
