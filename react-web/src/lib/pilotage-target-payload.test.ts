import { test } from "node:test";
import assert from "node:assert/strict";
import { TARGET_MAX } from "./pilotage-targets";
import {
  applyEditMode,
  buildTargetPayload,
  clearRegionDraft,
  hasUnsavedChanges,
  initDrafts,
  normalizeRegions,
  parseTargetInput,
  sumFilled,
  type NormalizedRegion,
  type RegionDraft,
} from "./pilotage-target-payload";
import type { TargetRegionRow } from "./pilotage-targets";

const field = "inscriptionTarget" as const;

function region(partial: Partial<NormalizedRegion> & Pick<NormalizedRegion, "regionId" | "name">): NormalizedRegion {
  return {
    mode: "UNSET",
    target: null,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: null },
      { departmentId: "d2", name: "Lekie", target: null },
    ],
    ...partial,
  };
}

function draft(regionId: string, partial: Partial<RegionDraft>): RegionDraft {
  return {
    regionId,
    mode: null,
    regionInput: "",
    departmentInputs: { d1: "", d2: "" },
    ...partial,
  };
}

test("parseTargetInput accepts 0 and TARGET_MAX, rejects junk", () => {
  assert.equal(parseTargetInput(""), null);
  assert.equal(parseTargetInput("  "), null);
  assert.equal(parseTargetInput("0"), 0);
  assert.equal(parseTargetInput(String(TARGET_MAX)), TARGET_MAX);
  assert.equal(parseTargetInput("01"), 1);
  assert.equal(parseTargetInput("-1"), "invalid");
  assert.equal(parseTargetInput("1.5"), "invalid");
  assert.equal(parseTargetInput("1e2"), "invalid");
  assert.equal(parseTargetInput(String(TARGET_MAX + 1)), "invalid");
});

test("normalizeRegions reads the named field", () => {
  const rows: TargetRegionRow[] = [
    {
      regionId: "r1",
      name: "Centre",
      mode: "DEPARTMENT",
      inscriptionTarget: 30,
      submissionTarget: 99,
      departments: [
        { departmentId: "d1", name: "Mfoundi", inscriptionTarget: 10, submissionTarget: 7 },
        { departmentId: "d2", name: "Lekie", inscriptionTarget: 20, submissionTarget: 8 },
      ],
    },
  ];
  const inscription = normalizeRegions(rows, "inscriptionTarget");
  assert.equal(inscription[0].target, 30);
  assert.equal(inscription[0].departments[0].target, 10);
  const quota = normalizeRegions(rows, "submissionTarget");
  assert.equal(quota[0].target, 99);
  assert.equal(quota[0].departments[1].target, 8);
});

test("unchanged DEPARTMENT region is omitted from PUT", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "DEPARTMENT",
    target: 30,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: 10 },
      { departmentId: "d2", name: "Lekie", target: 20 },
    ],
  });
  const result = buildTargetPayload({
    field,
    regions: [centre],
    drafts: initDrafts([centre]),
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors[0], /Aucune modification/);
});

test("editing one department sends the full remaining set for that region", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "DEPARTMENT",
    target: 30,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: 10 },
      { departmentId: "d2", name: "Lekie", target: 20 },
    ],
  });
  const drafts = initDrafts([centre]);
  drafts.r1.departmentInputs.d1 = "15";
  const result = buildTargetPayload({
    field,
    regions: [centre],
    drafts,
    originalCentral: 4,
    centralInput: "4",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.body.central, undefined);
  assert.deepEqual(result.body.entries, [
    { regionId: "r1", departmentId: "d1", inscriptionTarget: 15 },
    { regionId: "r1", departmentId: "d2", inscriptionTarget: 20 },
  ]);
});

test("blank department is omitted so the API deletes that row", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "DEPARTMENT",
    target: 30,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: 10 },
      { departmentId: "d2", name: "Lekie", target: 20 },
    ],
  });
  const drafts = initDrafts([centre]);
  drafts.r1.departmentInputs.d2 = "";
  const result = buildTargetPayload({
    field,
    regions: [centre],
    drafts,
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [
    { regionId: "r1", departmentId: "d1", inscriptionTarget: 10 },
  ]);
});

test("clearing every department in DEPARTMENT mode emits a region clear", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "DEPARTMENT",
    target: 10,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: 10 },
      { departmentId: "d2", name: "Lekie", target: null },
    ],
  });
  const drafts = initDrafts([centre]);
  drafts.r1.departmentInputs.d1 = "";
  const result = buildTargetPayload({
    field,
    regions: [centre],
    drafts,
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [{ regionId: "r1", clear: true }]);
  assert.equal(result.changes[0].to, "Non défini");
});

test("REGION mode sends a single departmentId: null entry", () => {
  const littoral = region({
    regionId: "r2",
    name: "Littoral",
    mode: "UNSET",
  });
  const result = buildTargetPayload({
    field,
    regions: [littoral],
    drafts: {
      r2: draft("r2", { mode: "REGION", regionInput: "80" }),
    },
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [
    { regionId: "r2", departmentId: null, inscriptionTarget: 80 },
  ]);
});

test("switching DEPARTMENT to REGION sends only the region-level row", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "DEPARTMENT",
    target: 30,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: 10 },
      { departmentId: "d2", name: "Lekie", target: 20 },
    ],
  });
  const switched = applyEditMode(centre, "REGION");
  assert.equal(switched.regionInput, "30");
  const result = buildTargetPayload({
    field,
    regions: [centre],
    drafts: { r1: { ...switched, regionInput: "40" } },
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [
    { regionId: "r1", departmentId: null, inscriptionTarget: 40 },
  ]);
});

test("unchanged sibling region is omitted", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "REGION",
    target: 50,
  });
  const ouest = region({
    regionId: "r3",
    name: "Ouest",
    mode: "UNSET",
  });
  const result = buildTargetPayload({
    field,
    regions: [centre, ouest],
    drafts: {
      r1: draft("r1", { mode: "REGION", regionInput: "50" }),
      r3: draft("r3", { mode: "REGION", regionInput: "12" }),
    },
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.body.entries.length, 1);
  assert.equal(result.body.entries[0].regionId, "r3");
});

test("MIXED unpicked is omitted; MIXED picked DEPARTMENT sends department rows", () => {
  const mixed = region({
    regionId: "r1",
    name: "Centre",
    mode: "MIXED",
    target: null,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: 10 },
      { departmentId: "d2", name: "Lekie", target: null },
    ],
  });
  const skipped = buildTargetPayload({
    field,
    regions: [mixed],
    drafts: initDrafts([mixed]),
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(skipped.ok, false);

  const picked = applyEditMode(mixed, "DEPARTMENT");
  const result = buildTargetPayload({
    field,
    regions: [mixed],
    drafts: { r1: picked },
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [
    { regionId: "r1", departmentId: "d1", inscriptionTarget: 10 },
  ]);
});

test("central is omitted, set, or cleared", () => {
  const empty = region({ regionId: "r1", name: "Centre" });
  const drafts = initDrafts([empty]);

  const omit = buildTargetPayload({
    field,
    regions: [empty],
    drafts,
    originalCentral: 5,
    centralInput: "5",
  });
  assert.equal(omit.ok, false);

  const set = buildTargetPayload({
    field,
    regions: [empty],
    drafts,
    originalCentral: null,
    centralInput: "9",
  });
  assert.equal(set.ok, true);
  if (set.ok) assert.deepEqual(set.body.central, { inscriptionTarget: 9 });

  const clear = buildTargetPayload({
    field,
    regions: [empty],
    drafts,
    originalCentral: 5,
    centralInput: "",
  });
  assert.equal(clear.ok, true);
  if (clear.ok) assert.equal(clear.body.central, null);
});

test("invalid department input surfaces a line error", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "DEPARTMENT",
    target: 10,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: 10 },
      { departmentId: "d2", name: "Lekie", target: null },
    ],
  });
  const drafts = initDrafts([centre]);
  drafts.r1.departmentInputs.d2 = "abc";
  const result = buildTargetPayload({
    field,
    regions: [centre],
    drafts,
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors[0], /Mfoundi|Lekie|entier/);
});

test("sumFilled ignores blanks and invalid cells", () => {
  assert.equal(sumFilled({ d1: "10", d2: "", d3: "abc", d4: "5" }), 15);
  assert.equal(sumFilled({ d1: "", d2: "" }), null);
});

test("quota field name is used on entries and central", () => {
  const littoral = region({ regionId: "r2", name: "Littoral", mode: "UNSET" });
  const result = buildTargetPayload({
    field: "submissionTarget",
    regions: [littoral],
    drafts: { r2: draft("r2", { mode: "REGION", regionInput: "3" }) },
    originalCentral: null,
    centralInput: "1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [
    { regionId: "r2", departmentId: null, submissionTarget: 3 },
  ]);
  assert.deepEqual(result.body.central, { submissionTarget: 1 });
});

test("clearRegionDraft emits a region clear and skips UNSET", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "REGION",
    target: 50,
  });
  const result = buildTargetPayload({
    field,
    regions: [centre],
    drafts: { r1: clearRegionDraft(centre) },
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [{ regionId: "r1", clear: true }]);
  assert.equal(result.changes[0].from, "Région seule · 50");
  assert.equal(result.changes[0].to, "Non défini");

  const unset = region({ regionId: "r2", name: "Littoral", mode: "UNSET" });
  const skipped = buildTargetPayload({
    field,
    regions: [unset],
    drafts: { r2: clearRegionDraft(unset) },
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(skipped.ok, false);
  if (!skipped.ok) assert.match(skipped.errors[0], /Aucune modification/);
});

test("empty REGION input on a stored region emits a clear", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "REGION",
    target: 80,
  });
  const drafts = initDrafts([centre]);
  drafts.r1.regionInput = "";
  const result = buildTargetPayload({
    field,
    regions: [centre],
    drafts,
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [{ regionId: "r1", clear: true }]);
});

test("clearing one region leaves a sibling valued entry", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "DEPARTMENT",
    target: 10,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: 10 },
      { departmentId: "d2", name: "Lekie", target: null },
    ],
  });
  const littoral = region({ regionId: "r2", name: "Littoral", mode: "UNSET" });
  const result = buildTargetPayload({
    field,
    regions: [centre, littoral],
    drafts: {
      r1: clearRegionDraft(centre),
      r2: draft("r2", { mode: "REGION", regionInput: "12" }),
    },
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [
    { regionId: "r1", clear: true },
    { regionId: "r2", departmentId: null, inscriptionTarget: 12 },
  ]);
});

test("quota clear entry has no submissionTarget field", () => {
  const littoral = region({
    regionId: "r2",
    name: "Littoral",
    mode: "REGION",
    target: 3,
  });
  const result = buildTargetPayload({
    field: "submissionTarget",
    regions: [littoral],
    drafts: { r2: clearRegionDraft(littoral) },
    originalCentral: null,
    centralInput: "",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.body.entries, [{ regionId: "r2", clear: true }]);
});

test("hasUnsavedChanges returns false for pristine drafts and central", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "REGION",
    target: 50,
  });
  const drafts = initDrafts([centre]);
  assert.equal(
    hasUnsavedChanges({
      regions: [centre],
      drafts,
      originalCentral: 100,
      centralInput: "100",
    }),
    false,
  );
});

test("hasUnsavedChanges detects region input, department input, or central input change", () => {
  const centre = region({
    regionId: "r1",
    name: "Centre",
    mode: "DEPARTMENT",
    target: 20,
    departments: [
      { departmentId: "d1", name: "Mfoundi", target: 20 },
      { departmentId: "d2", name: "Lekie", target: null },
    ],
  });

  // Pristine
  const pristineDrafts = initDrafts([centre]);
  assert.equal(
    hasUnsavedChanges({
      regions: [centre],
      drafts: pristineDrafts,
      originalCentral: null,
      centralInput: "",
    }),
    false,
  );

  // Department input change
  const deptDrafts = initDrafts([centre]);
  deptDrafts.r1.departmentInputs.d2 = "15";
  assert.equal(
    hasUnsavedChanges({
      regions: [centre],
      drafts: deptDrafts,
      originalCentral: null,
      centralInput: "",
    }),
    true,
  );

  // Central change
  assert.equal(
    hasUnsavedChanges({
      regions: [centre],
      drafts: pristineDrafts,
      originalCentral: null,
      centralInput: "50",
    }),
    true,
  );

  // Mode change
  const modeDrafts = initDrafts([centre]);
  modeDrafts.r1.mode = "REGION";
  assert.equal(
    hasUnsavedChanges({
      regions: [centre],
      drafts: modeDrafts,
      originalCentral: null,
      centralInput: "",
    }),
    true,
  );
});

