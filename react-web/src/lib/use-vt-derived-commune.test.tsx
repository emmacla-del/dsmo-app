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

test("defect 2: a commune the respondent typed survives a reload and subsequent subdivision change", () => {
  const session1Writes: Record<string, unknown>[] = [];
  // 1. Initial visit: prefilled subdivision "Douala 2", commune empty -> derived
  let dataSession1: FormData = { VT1_6: "Douala 2" };
  const { rerender: rerenderSession1 } = renderHook(() =>
    useVtDerivedCommune(vt, dataSession1, (u) => session1Writes.push(u)),
  );
  assert.deepEqual(session1Writes, [{ VT1_7: "Douala 2" }]);

  // 2. User types "Douala 2e" into 1.7
  dataSession1 = { VT1_6: "Douala 2", VT1_7: "Douala 2e" };
  rerenderSession1();
  assert.ok(session1Writes.some((w: Record<string, unknown>) => w.VT1_7_dirty === true), "typing marks commune dirty");

  // 3. User reloads page: fresh mount loads draft containing typed commune and dirty flag
  const session2Writes: Record<string, unknown>[] = [];
  let dataSession2: FormData = { VT1_6: "Douala 2", VT1_7: "Douala 2e", VT1_7_dirty: true };
  const { rerender: rerenderSession2 } = renderHook(() =>
    useVtDerivedCommune(vt, dataSession2, (u) => session2Writes.push(u)),
  );
  // Fresh mount must not overwrite typed commune
  assert.equal(session2Writes.find((w) => "VT1_7" in w), undefined);

  // 4. Changing subdivision in reloaded session must never replace the typed commune
  dataSession2 = { VT1_6: "Douala 1", VT1_7: "Douala 2e", VT1_7_dirty: true };
  rerenderSession2();
  assert.equal(session2Writes.find((w) => "VT1_7" in w), undefined);
});

