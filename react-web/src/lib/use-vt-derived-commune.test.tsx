import { renderHook } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { FormData, OnefopEntity } from "./onefop-schema";
import { deriveVtCommune, useVtDerivedCommune } from "./use-vt-derived-commune";

const vt = { entityType: "vocationalTraining" } as OnefopEntity;
const enterprise = { entityType: "enterprise" } as OnefopEntity;

test("an empty commune takes the arrondissement's name", () => {
  assert.equal(deriveVtCommune(undefined, "Mfou", ""), "Mfou");
});

test("a commune that followed the arrondissement moves with it", () => {
  assert.equal(deriveVtCommune("Mfou", "Soa", "Mfou"), "Soa");
});

test("a commune the respondent typed is kept", () => {
  assert.equal(deriveVtCommune(undefined, "Mfou", "Nkolafamba"), undefined);
  assert.equal(deriveVtCommune("Mfou", "Soa", "Nkolafamba"), undefined);
});

test("nothing is written when the arrondissement is unchanged or empty", () => {
  assert.equal(deriveVtCommune("Mfou", "Mfou", ""), undefined);
  assert.equal(deriveVtCommune("Mfou", "", "Mfou"), undefined);
  assert.equal(deriveVtCommune(undefined, "Mfou", "Mfou"), undefined);
});

test("the hook fills the commune of a draft loaded without one", () => {
  const writes: Record<string, unknown>[] = [];
  const data: FormData = { VT1_6: "Mfou" };
  renderHook(() => useVtDerivedCommune(vt, data, (u) => writes.push(u)));
  assert.deepEqual(writes, [{ VT1_7: "Mfou" }]);
});

test("the hook moves a commune that followed a cleared then re-chosen arrondissement", () => {
  const writes: Record<string, unknown>[] = [];
  let data: FormData = { VT1_6: "Mfou", VT1_7: "Mfou" };
  const { rerender } = renderHook(() => useVtDerivedCommune(vt, data, (u) => writes.push(u)));
  data = { VT1_7: "Mfou" };
  rerender();
  data = { VT1_6: "Soa", VT1_7: "Mfou" };
  rerender();
  assert.deepEqual(writes, [{ VT1_7: "Soa" }]);
});

test("the hook does nothing outside the training-centre questionnaire", () => {
  const writes: Record<string, unknown>[] = [];
  renderHook(() => useVtDerivedCommune(enterprise, { VT1_6: "Mfou" }, (u) => writes.push(u)));
  renderHook(() => useVtDerivedCommune(undefined, { VT1_6: "Mfou" }, (u) => writes.push(u)));
  assert.equal(writes.length, 0);
});

// Defect 2 (2026-10-16): the wizard passes the entity only once the draft
// has loaded, so the registration prefill alone never writes a commune.
test("defect 2: nothing is written before the draft has loaded", () => {
  const writes: Record<string, unknown>[] = [];
  renderHook(() => useVtDerivedCommune(undefined, { VT1_6: "Douala 2" }, (u) => writes.push(u)));
  assert.equal(writes.length, 0);
});

test("defect 2: a typed commune in a draft that loads after mount is never replaced", () => {
  const writes: Record<string, unknown>[] = [];
  let entity: OnefopEntity | undefined = undefined;
  let data: FormData = { VT1_6: "Douala 2" };
  const { rerender } = renderHook(() => useVtDerivedCommune(entity, data, (u) => writes.push(u)));
  entity = vt;
  data = { VT1_6: "Douala 2", VT1_7: "Douala 2e" };
  rerender();
  data = { ...data, VT1_6: "Douala 3" };
  rerender();
  assert.equal(writes.length, 0);
});

test("defect 2: a filled-in commune in a draft that loads after mount still follows the arrondissement", () => {
  const writes: Record<string, unknown>[] = [];
  let entity: OnefopEntity | undefined = undefined;
  let data: FormData = {};
  const { rerender } = renderHook(() => useVtDerivedCommune(entity, data, (u) => writes.push(u)));
  entity = vt;
  data = { VT1_6: "Douala 2", VT1_7: "Douala 2" };
  rerender();
  assert.equal(writes.length, 0);
  data = { ...data, VT1_6: "Douala 3" };
  rerender();
  assert.deepEqual(writes, [{ VT1_7: "Douala 3" }]);
});
