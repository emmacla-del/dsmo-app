import { renderHook } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FormData, OnefopSchema } from "./onefop-schema";
import { useVtFixedRowTotals } from "./use-vt-fixed-row-totals";

const schema: OnefopSchema = JSON.parse(
  readFileSync(join(process.cwd(), "public", "schemas", "onefop.schema.json"), "utf8"),
);
const vt = schema.entities.vocationalTraining;
const enterprise = schema.entities.enterprise;

test("saves the missing totals of tables anywhere in the declaration, in one write", () => {
  const writes: Record<string, unknown>[] = [];
  const data: FormData = {
    s4q2_cap_male: 3,
    s4q2_cap_female: 2,
    s8q6_moteur_male: 1,
  };
  renderHook(() => useVtFixedRowTotals(vt, data, (u) => writes.push(u)));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].s4q2_cap_total, 5);
  assert.equal(writes[0].s8q6_moteur_total, 1);
});

test("writes nothing once the stored totals match", () => {
  const writes: Record<string, unknown>[] = [];
  const data: FormData = { s4q2_cap_male: 3, s4q2_cap_female: 2, s4q2_cap_total: 5 };
  renderHook(() => useVtFixedRowTotals(vt, data, (u) => writes.push(u)));
  assert.equal(writes.length, 0);
});

test("does nothing outside the training-centre questionnaire", () => {
  const writes: Record<string, unknown>[] = [];
  renderHook(() => useVtFixedRowTotals(enterprise, { s4q2_cap_male: 3 }, (u) => writes.push(u)));
  renderHook(() => useVtFixedRowTotals(undefined, { s4q2_cap_male: 3 }, (u) => writes.push(u)));
  assert.equal(writes.length, 0);
});
