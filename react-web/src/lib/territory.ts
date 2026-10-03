import type {
  LocationDepartment,
  LocationRegion,
  LocationSubdivision,
} from "./user-types";

export type { LocationDepartment, LocationRegion, LocationSubdivision };

/**
 * Display translations for Cameroon's 10 administrative regions.
 * Place names for departments/subdivisions have no distinct English form.
 */
export const REGION_NAME_EN: Record<string, string> = {
  "Adamaoua": "Adamawa",
  "Centre": "Centre",
  "Est": "East",
  "Extrême-Nord": "Far North",
  "Littoral": "Littoral",
  "Nord": "North",
  "Nord-Ouest": "North-West",
  "Ouest": "West",
  "Sud": "South",
  "Sud-Ouest": "South-West",
};

export function regionDisplayName(frenchName: string, locale: string): string {
  if (!locale.startsWith("en")) return frenchName;
  return REGION_NAME_EN[frenchName] ?? frenchName;
}

export function findRegionInTree(
  tree: LocationRegion[] | undefined | null,
  name: string | null | undefined,
): LocationRegion | null {
  if (!tree || !name || !name.trim()) return null;
  const clean = name.trim().toLowerCase();
  return (
    tree.find(
      (r) =>
        r.name.toLowerCase() === clean ||
        (REGION_NAME_EN[r.name] && REGION_NAME_EN[r.name].toLowerCase() === clean),
    ) ?? null
  );
}

export function findDepartmentInTree(
  tree: LocationRegion[] | undefined | null,
  deptName: string | null | undefined,
  regionName?: string | null,
): LocationDepartment | null {
  if (!tree || !deptName || !deptName.trim()) return null;
  const cleanDept = deptName.trim().toLowerCase();
  const region = findRegionInTree(tree, regionName);
  const regionsToSearch = region ? [region] : tree;
  for (const r of regionsToSearch) {
    const dept = r.departments.find((d) => d.name.toLowerCase() === cleanDept);
    if (dept) return dept;
  }
  return null;
}

export function findSubdivisionInTree(
  tree: LocationRegion[] | undefined | null,
  subdivName: string | null | undefined,
  deptName?: string | null,
  regionName?: string | null,
): LocationSubdivision | null {
  if (!tree || !subdivName || !subdivName.trim()) return null;
  const cleanSubdiv = subdivName.trim().toLowerCase();
  const dept = findDepartmentInTree(tree, deptName, regionName);
  if (dept) {
    const found = dept.subdivisions.find((s) => s.name.toLowerCase() === cleanSubdiv);
    if (found) return found;
  } else if (!deptName) {
    const region = findRegionInTree(tree, regionName);
    const regionsToSearch = region ? [region] : tree;
    for (const r of regionsToSearch) {
      for (const d of r.departments) {
        const found = d.subdivisions.find((s) => s.name.toLowerCase() === cleanSubdiv);
        if (found) return found;
      }
    }
  }
  return null;
}

export function getValidDepartments(
  tree: LocationRegion[] | undefined | null,
  regionName: string | null | undefined,
): string[] {
  const region = findRegionInTree(tree, regionName);
  return region ? region.departments.map((d) => d.name) : [];
}

export function getValidSubdivisions(
  tree: LocationRegion[] | undefined | null,
  deptName: string | null | undefined,
  regionName?: string | null | undefined,
): string[] {
  const dept = findDepartmentInTree(tree, deptName, regionName);
  return dept ? dept.subdivisions.map((s) => s.name) : [];
}

export function validateCameroonGeography(
  tree: LocationRegion[] | undefined | null,
  region?: string | null,
  dept?: string | null,
  subdiv?: string | null,
): {
  valid: boolean;
  errorField?: "region" | "department" | "subdivision";
  errorMessage?: { fr: string; en: string };
} {
  if (!region || !region.trim()) return { valid: true };
  if (!tree || tree.length === 0) return { valid: true };

  const regObj = findRegionInTree(tree, region);
  if (!regObj) {
    return {
      valid: false,
      errorField: "region",
      errorMessage: {
        fr: `Région '${region}' non reconnue`,
        en: `Unrecognized region '${region}'`,
      },
    };
  }

  if (dept && dept.trim()) {
    const deptObj = regObj.departments.find(
      (d) => d.name.toLowerCase() === dept.trim().toLowerCase(),
    );
    if (!deptObj) {
      return {
        valid: false,
        errorField: "department",
        errorMessage: {
          fr: `Le département '${dept}' ne fait pas partie de la région ${regObj.name}`,
          en: `Department '${dept}' does not belong to region ${regObj.name}`,
        },
      };
    }

    if (subdiv && subdiv.trim()) {
      const subFound = deptObj.subdivisions.find(
        (s) => s.name.toLowerCase() === subdiv.trim().toLowerCase(),
      );
      if (!subFound) {
        return {
          valid: false,
          errorField: "subdivision",
          errorMessage: {
            fr: `L'arrondissement '${subdiv}' ne fait pas partie du département ${deptObj.name}`,
            en: `Subdivision '${subdiv}' does not belong to department ${deptObj.name}`,
          },
        };
      }
    }
  }

  return { valid: true };
}

// Aliases matching legacy names for smooth transition
export const findCameroonRegion = findRegionInTree;
export const findCameroonDepartment = findDepartmentInTree;
export const findCameroonSubdivision = findSubdivisionInTree;
