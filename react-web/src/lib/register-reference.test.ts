import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEPARTMENT_NOMENCLATURE,
  REGION_NOMENCLATURE,
  SUBDIVISION_NOMENCLATURE,
  bundledDepartments,
  bundledSubdivisions,
} from "@/lib/location-nomenclature";
import { SECTOR_NOMENCLATURE } from "@/lib/sector-nomenclature";
import { branchList, departmentList, regionList, subdivisionList, subdivisionsStatusOf } from "@/lib/register-reference";

test("the bundled branch list is available before the sectors request succeeds", () => {
  assert.deepEqual(branchList({}), [...SECTOR_NOMENCLATURE]);
});

test("a successful live branch response replaces the bundled snapshot, including an empty response", () => {
  const live = [{ id: "live-branch", name: "Live branch", category: "Primary" }];
  assert.deepEqual(branchList({ data: live }), live);
  assert.deepEqual(branchList({ data: [] }), []);
});

test("regions are available before the regions request succeeds, and live data wins", () => {
  assert.deepEqual(regionList({}), [...REGION_NOMENCLATURE]);
  const live = [{ id: "live-region", name: "Live region" }];
  assert.deepEqual(regionList({ data: live }), live);
});

test("departments are bundled by selected region and stay gated until one is selected", () => {
  const regionId = REGION_NOMENCLATURE[0].id;
  assert.deepEqual(departmentList({}, ""), []);
  assert.deepEqual(departmentList({}, regionId), bundledDepartments(regionId));

  const live = [{ id: "live-department", name: "Live department", regionId }];
  assert.deepEqual(departmentList({ data: live }, regionId), live);
});

test("subdivisions are bundled by selected department and stay gated until one is selected", () => {
  const departmentId = DEPARTMENT_NOMENCLATURE[0].id;
  assert.deepEqual(subdivisionList({}, ""), []);
  assert.deepEqual(subdivisionList({}, departmentId), bundledSubdivisions(departmentId));
  assert.ok(bundledSubdivisions(departmentId).length > 0);

  const live = [{ id: "live-subdivision", name: "Live subdivision", departmentId }];
  assert.deepEqual(subdivisionList({ data: live }, departmentId), live);
  assert.deepEqual(subdivisionList({ data: [] }, departmentId), []);
});

test("subdivision completeness treats bundled rows as ready during an API error", () => {
  const departmentId = DEPARTMENT_NOMENCLATURE[0].id;
  const bundled = bundledSubdivisions(departmentId);
  assert.equal(bundled.length > 0, true);
  assert.equal(
    subdivisionsStatusOf(departmentId, { isFetching: false, isError: true }, bundled),
    "ready",
  );
});

test("a live empty subdivision list overrides the snapshot and is not required", () => {
  const departmentId = DEPARTMENT_NOMENCLATURE[0].id;
  assert.equal(
    subdivisionsStatusOf(
      departmentId,
      { data: [], isFetching: false, isError: false },
      bundledSubdivisions(departmentId),
    ),
    "empty",
  );
});

test("an unknown department stays unresolved rather than being treated as an empty subdivision list", () => {
  assert.equal(
    subdivisionsStatusOf("new-department", { isFetching: true, isError: false }, []),
    "loading",
  );
  assert.equal(
    subdivisionsStatusOf("new-department", { isFetching: false, isError: true }, []),
    "error",
  );
});

test("bundled reference snapshots contain the expected national hierarchy", () => {
  assert.equal(REGION_NOMENCLATURE.length, 10);
  assert.equal(DEPARTMENT_NOMENCLATURE.length, 58);
  assert.equal(SUBDIVISION_NOMENCLATURE.length, 360);
  assert.equal(SECTOR_NOMENCLATURE.length, 19);
});
