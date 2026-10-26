// src/lib/register-reference.ts
//
// The registration form's four reference lists -- branch of activity, region,
// department, arrondissement -- resolved against the copies bundled with the
// app (sector-nomenclature.ts, location-nomenclature.ts).
//
// All four answers are required, and all four used to be fetched when the
// page opened. A respondent who arrived while the API was asleep (the Render
// service answers its first request in ~34s after an idle spell) was shown
// "Échec du chargement" in a required select and could not finish registering
// at all -- while the sector and the year beside them, which are compiled in,
// always worked. These lists are now read the same way: the bundle is what
// the form offers, and a live answer replaces it for the rest of the session,
// so an edit made in /admin/sectors is still picked up.
import type { Department, Region, Subdivision } from "./user-types";
import type { SubdivisionsStatus } from "./register-completeness";
import type { BranchRow } from "./register-activity";
import { SECTOR_NOMENCLATURE } from "./sector-nomenclature";
import {
  REGION_NOMENCLATURE,
  bundledDepartments,
  bundledSubdivisions,
} from "./location-nomenclature";

/** The parts of a React Query result these helpers read. */
export interface ReferenceQuery<T> {
  data?: T[];
  isFetching: boolean;
  isError: boolean;
}

/** The live list when the API has answered, the bundled one until then. */
function resolve<T>(data: T[] | undefined, bundled: readonly T[]): T[] {
  return data ?? [...bundled];
}

export function branchList(query: { data?: BranchRow[] }): BranchRow[] {
  return resolve(query.data, SECTOR_NOMENCLATURE);
}

export function regionList(query: { data?: Region[] }): Region[] {
  return resolve(query.data, REGION_NOMENCLATURE);
}

// Nothing is offered until the level above is answered: the bundle is read
// for the chosen parent only, exactly as the request would have been made.
export function departmentList(query: { data?: Department[] }, regionId: string): Department[] {
  if (!regionId) return [];
  return resolve(query.data, bundledDepartments(regionId));
}

export function subdivisionList(
  query: { data?: Subdivision[] },
  departmentId: string,
): Subdivision[] {
  if (!departmentId) return [];
  return resolve(query.data, bundledSubdivisions(departmentId));
}

/**
 * The arrondissement row's four states, with the bundle taken into account.
 *
 * "empty" means « this department has no arrondissement to choose », which
 * clears the field instead of blocking on it -- so it must never be said of a
 * department whose list is merely unknown. The live answer decides whenever
 * there is one; failing that, a bundled list that has rows is as good as
 * loaded; and a department the bundle does not know (added to the hierarchy
 * after the snapshot) keeps the old loading/error wait rather than being
 * waved through.
 */
export function subdivisionsStatusOf(
  departmentId: string,
  query: ReferenceQuery<Subdivision>,
  bundled: readonly Subdivision[],
): SubdivisionsStatus {
  if (!departmentId) return "idle";
  if (query.data) return query.data.length === 0 ? "empty" : "ready";
  if (bundled.length > 0) return "ready";
  if (query.isFetching) return "loading";
  if (query.isError) return "error";
  return "empty";
}
