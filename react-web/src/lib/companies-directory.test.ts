import assert from "node:assert/strict";
import { test } from "node:test";

import { establishmentsListHref, hasRealNiu } from "@/lib/companies-directory";

test("hasRealNiu accepts a real taxpayer number", () => {
  assert.equal(hasRealNiu("P000000000000"), true);
});

test("hasRealNiu rejects a missing value", () => {
  assert.equal(hasRealNiu(null), false);
  assert.equal(hasRealNiu(undefined), false);
});

test("hasRealNiu rejects the synthetic NA- placeholder", () => {
  assert.equal(hasRealNiu("NA-abc"), false);
  assert.equal(hasRealNiu("NA-"), false);
});

test("establishment links preserve approved-register drill-down filters", () => {
  assert.equal(
    establishmentsListHref({ region: "Centre", department: "Mfoundi", type: "ONG", status: "ACTIVE", includeArchived: true }),
    "/admin/etablissements?region=Centre&department=Mfoundi&type=ONG&status=ACTIVE&includeArchived=true",
  );
});
