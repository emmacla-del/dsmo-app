// Pins the region → department cascade used by the dossier and
// registration filter bars. Null means "do not clear": the tree is
// missing or the region name does not match.

import assert from "node:assert/strict";
import test from "node:test";

import { departmentInRegion, regionInTree, type LocationRegion } from "./territory";

const tree: LocationRegion[] = [
  {
    id: "littoral",
    name: "Littoral",
    departments: [
      { id: "wouri", name: "Wouri", subdivisions: [] },
      { id: "nkam", name: "Nkam", subdivisions: [] },
    ],
  },
  {
    id: "centre",
    name: "Centre",
    departments: [
      { id: "mfoundi", name: "Mfoundi", subdivisions: [] },
    ],
  },
];

test("departmentInRegion is true when the department is in the region", () => {
  assert.equal(departmentInRegion(tree, "Littoral", "Wouri"), true);
  assert.equal(departmentInRegion(tree, "littoral", "wouri"), true);
});

test("departmentInRegion is false when the department belongs to another region", () => {
  assert.equal(departmentInRegion(tree, "Centre", "Wouri"), false);
});

test("departmentInRegion is null when the region is not in the tree", () => {
  assert.equal(departmentInRegion(tree, "Nord", "Wouri"), null);
  assert.equal(departmentInRegion(undefined, "Littoral", "Wouri"), null);
  assert.equal(departmentInRegion(tree, "", "Wouri"), null);
});

test("departmentInRegion is null when the department is empty", () => {
  assert.equal(departmentInRegion(tree, "Littoral", ""), null);
  assert.equal(departmentInRegion(tree, "Littoral", "   "), null);
});

test("regionInTree is true when the region is in the tree", () => {
  assert.equal(regionInTree(tree, "Littoral"), true);
  assert.equal(regionInTree(tree, "littoral"), true);
});

test("regionInTree is false when the loaded tree does not contain the region", () => {
  assert.equal(regionInTree(tree, "Unknown"), false);
  assert.equal(regionInTree([], "Littoral"), false);
});

test("regionInTree is null while the tree is missing or the region is empty", () => {
  assert.equal(regionInTree(undefined, "Littoral"), null);
  assert.equal(regionInTree(tree, ""), null);
  assert.equal(regionInTree(tree, "   "), null);
});
