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

// 4.10 and 6.3 (owner, 2026-10-11): the official PDF prints their Total
// column, and the normalized specialty rows store it, from the saved value.
test("saves the totals of 4.10 and 6.3, the add-a-row tables with a calculated column", () => {
  const writes: Record<string, unknown>[] = [];
  const data: FormData = {
    s4q10_row1_specialtyText: "Couture",
    s4q10_row1_male: 3,
    s4q10_row1_female: 4,
    s6q3_row2_specialtyText: "Soudure",
    s6q3_row2_male: 2,
  };
  renderHook(() => useVtFixedRowTotals(vt, data, (u) => writes.push(u)));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].s4q10_row1_total, 7);
  assert.equal(writes[0].s6q3_row2_total, 2);
  assert.ok(!("s4q10_row2_total" in writes[0]), "an empty row gets no total");
  assert.ok(!Object.keys(writes[0]).some((k) => k.startsWith("s4q3_")), "add-a-row tables without a calculated column are untouched");
});
