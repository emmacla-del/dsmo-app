"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLocationStructure } from "@/lib/api-client";
import {
  findDepartmentInTree,
  findRegionInTree,
  findSubdivisionInTree,
  getValidDepartments,
  getValidSubdivisions,
  REGION_NAME_EN,
  regionDisplayName,
  validateCameroonGeography,
  findCameroonRegion,
  findCameroonDepartment,
  findCameroonSubdivision,
  type LocationDepartment,
  type LocationRegion,
  type LocationSubdivision,
} from "@/lib/territory";

export {
  findDepartmentInTree,
  findRegionInTree,
  findSubdivisionInTree,
  getValidDepartments,
  getValidSubdivisions,
  REGION_NAME_EN,
  regionDisplayName,
  validateCameroonGeography,
  findCameroonRegion,
  findCameroonDepartment,
  findCameroonSubdivision,
};
export type { LocationDepartment, LocationRegion, LocationSubdivision };

/**
 * Primary React Query hook caching the full administrative hierarchy indefinitely.
 */
export function useTerritoryStructure() {
  return useQuery({
    queryKey: ["locations", "structure"],
    queryFn: getLocationStructure,
    staleTime: Infinity,
  });
}

/**
 * Convenience hook returning the list of region names.
 */
export function useTerritoryRegions() {
  const query = useTerritoryStructure();
  const regions = useMemo(() => {
    return query.data ? query.data.map((r) => r.name) : [];
  }, [query.data]);

  return {
    ...query,
    regions,
  };
}

/**
 * Convenience hook returning the list of department names, optionally scoped to a region.
 */
export function useTerritoryDepartments(regionName?: string | null) {
  const query = useTerritoryStructure();
  const departments = useMemo(() => {
    if (!query.data) return [];
    if (!regionName || regionName === "all" || regionName === "Toutes") {
      return query.data.flatMap((r) => r.departments.map((d) => d.name));
    }
    const reg = findRegionInTree(query.data, regionName);
    return reg ? reg.departments.map((d) => d.name) : [];
  }, [query.data, regionName]);

  return {
    ...query,
    departments,
  };
}

/**
 * Convenience hook returning the list of subdivision names, optionally scoped to dept and region.
 */
export function useTerritorySubdivisions(deptName?: string | null, regionName?: string | null) {
  const query = useTerritoryStructure();
  const subdivisions = useMemo(() => {
    if (!query.data) return [];
    const dept = findDepartmentInTree(query.data, deptName, regionName);
    return dept ? dept.subdivisions.map((s) => s.name) : [];
  }, [query.data, deptName, regionName]);

  return {
    ...query,
    subdivisions,
  };
}
