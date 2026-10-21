import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACTIVITY_SECTOR_OPTIONS,
  branchesFor,
  dropUnofferedBranch,
  sectorOfBranch,
} from "@/lib/register-activity";

// The live `sectors` table, abridged: one branch per category, plus the two
// offered to some types only.
const BRANCHES = [
  { id: "agri", name: "Agriculture, élevage, sylviculture et pêche", category: "Primary" },
  { id: "manu", name: "Industrie manufacturière", category: "Secondary" },
  { id: "comm", name: "Commerce de gros et de détail", category: "Tertiary" },
  { id: "admin", name: "Administration publique et défense", category: "Public" },
  { id: "extra", name: "Organismes extraterritoriaux", category: "Public" },
];
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

test("the sector answers are the form's own option values", () => {
  assert.deepEqual(
    ACTIVITY_SECTOR_OPTIONS.map((o) => o.value),
    ["Primaire/ Primary", "Secondaire/ Secondary", "Tertiaire/ Tertiary"]
  );
});

test("a branch's sector comes from its category; Public counts as Tertiaire", () => {
  assert.equal(sectorOfBranch("Primary"), "Primaire/ Primary");
  assert.equal(sectorOfBranch("Secondary"), "Secondaire/ Secondary");
  assert.equal(sectorOfBranch("Public"), "Tertiaire/ Tertiary");
  // Nothing known, nothing answered.
  assert.equal(sectorOfBranch(null), undefined);
  assert.equal(sectorOfBranch("Autre"), undefined);
});

test("no sector, no branches", () => {
  assert.deepEqual(branchesFor(BRANCHES, undefined, "enterprise"), []);
  assert.deepEqual(branchesFor(undefined, "Primaire/ Primary", "enterprise"), []);
});

test("branches are those of the chosen sector", () => {
  assert.deepEqual(ids(branchesFor(BRANCHES, "Primaire/ Primary", "enterprise")), ["agri"]);
  assert.deepEqual(ids(branchesFor(BRANCHES, "Secondaire/ Secondary", "ctd")), ["manu"]);
});

test("public administration and extraterritorial bodies only where they fit", () => {
  const tertiary = "Tertiaire/ Tertiary";
  assert.deepEqual(ids(branchesFor(BRANCHES, tertiary, "enterprise")), ["comm"]);
  assert.deepEqual(ids(branchesFor(BRANCHES, tertiary, "cooperative")), ["comm"]);
  assert.deepEqual(ids(branchesFor(BRANCHES, tertiary, "administration")), ["comm", "admin"]);
  assert.deepEqual(ids(branchesFor(BRANCHES, tertiary, "ctd")), ["comm", "admin"]);
  assert.deepEqual(ids(branchesFor(BRANCHES, tertiary, "ong")), ["comm", "extra"]);
  assert.deepEqual(ids(branchesFor(BRANCHES, tertiary, "projectProgram")), ["comm", "admin", "extra"]);
});

test("a branch the new sector or type does not offer is dropped", () => {
  const data = { activitySector: "Tertiaire/ Tertiary", branchId: "admin", phone: "655000000" };
  assert.equal(dropUnofferedBranch(data, BRANCHES, "administration"), data);
  assert.deepEqual(dropUnofferedBranch(data, BRANCHES, "enterprise"), {
    activitySector: "Tertiaire/ Tertiary",
    phone: "655000000",
  });
  assert.deepEqual(
    dropUnofferedBranch({ ...data, activitySector: "Primaire/ Primary" }, BRANCHES, "administration"),
    { activitySector: "Primaire/ Primary", phone: "655000000" }
  );
  // The list has not loaded: nothing can be checked, nothing is dropped.
  assert.equal(dropUnofferedBranch(data, undefined, "enterprise"), data);
});
