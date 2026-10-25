// scripts/sync-reference-data.mjs
//
// Rewrites the two generated reference lists the registration form offers:
//
//   src/lib/sector-nomenclature.ts    <- GET /sectors
//   src/lib/location-nomenclature.ts  <- GET /locations/structure
//
// The form asks for a branch of activity and for a region, a department and
// an arrondissement, and every one of them is required. They used to be
// fetched when the page opened, so a respondent who arrived while the API was
// asleep or unreachable was shown "Échec du chargement" in a required select
// and could not finish registering at all. They are bundled now, like the
// sector and the year lists beside them; the live referential still wins
// whenever it answers.
//
// The ids are the referential's own: the registration stores the branch's id
// (Company.sectorId), so an invented id would be refused on submit.
//
// Run after changing either referential:
//   npm run sync:reference-data            (live API)
//   npm run sync:reference-data -- <url>   (another API base)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const base = process.argv[2] ?? "https://dsmo-app-2.onrender.com/api";
const libDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib");
const today = new Date().toISOString().slice(0, 10);

async function get(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`GET ${base}${path} -> HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${path} answered no rows`);
  return rows;
}

const lit = (v) => (v === null || v === undefined ? "null" : JSON.stringify(v));

// ── Branches of activity ────────────────────────────────────────────────
const sectors = await get("/sectors");
writeFileSync(
  join(libDir, "sector-nomenclature.ts"),
  `// src/lib/sector-nomenclature.ts
//
// GENERATED -- do not edit by hand. Regenerate with \`npm run sync:reference-data\`
// after changing the referential in /admin/sectors.
//
// The « Branche d'activité » list, bundled so the registration form offers it
// with no network call, as it already does for the sector and the year. The
// live referential still wins whenever it answers: this copy is what the form
// starts from and what it keeps when the API is asleep or unreachable.
// Source: GET /sectors (${sectors.length} branches, snapshot of ${today}).
import type { BranchRow } from "./register-activity";

export const SECTOR_NOMENCLATURE: readonly BranchRow[] = [
${sectors.map((r) => `  { id: ${lit(r.id)}, name: ${lit(r.name)}, nameEn: ${lit(r.nameEn)}, category: ${lit(r.category)} },`).join("\n")}
];
`,
  "utf8",
);

// ── Administrative hierarchy ────────────────────────────────────────────
// One request for the whole tree. Flattened here into the three lists the
// cascade reads, each row carrying the parent id the API's own rows carry.
const structure = await get("/locations/structure");
const departments = structure.flatMap((r) => (r.departments ?? []).map((d) => ({ ...d, regionId: r.id })));
const subdivisions = departments.flatMap((d) => (d.subdivisions ?? []).map((s) => ({ ...s, departmentId: d.id })));
const row = (r, parentKey, parentId) =>
  `  { id: ${lit(r.id)}, name: ${lit(r.name)}, code: ${lit(r.code ?? null)}${parentKey ? `, ${parentKey}: ${lit(parentId)}` : ""} },`;

writeFileSync(
  join(libDir, "location-nomenclature.ts"),
  `// src/lib/location-nomenclature.ts
//
// GENERATED -- do not edit by hand. Regenerate with \`npm run sync:reference-data\`
// after the administrative hierarchy changes.
//
// The regions, departments and arrondissements the registration cascade
// offers, bundled for the same reason as the branches beside them: all three
// are required, and a respondent who opened the form while the API was asleep
// could answer none of them. The live lists still win whenever they answer.
// Source: GET /locations/structure (${structure.length} regions, ${departments.length} departments,
// ${subdivisions.length} arrondissements, snapshot of ${today}).
import type { Department, Region, Subdivision } from "./user-types";

export const REGION_NOMENCLATURE: readonly Region[] = [
${structure.map((r) => row(r)).join("\n")}
];

export const DEPARTMENT_NOMENCLATURE: readonly Department[] = [
${departments.map((d) => row(d, "regionId", d.regionId)).join("\n")}
];

export const SUBDIVISION_NOMENCLATURE: readonly Subdivision[] = [
${subdivisions.map((s) => row(s, "departmentId", s.departmentId)).join("\n")}
];

/** The bundled departments of one region, in the order the API returns them. */
export function bundledDepartments(regionId: string): Department[] {
  return DEPARTMENT_NOMENCLATURE.filter((d) => d.regionId === regionId);
}

/** The bundled arrondissements of one department. */
export function bundledSubdivisions(departmentId: string): Subdivision[] {
  return SUBDIVISION_NOMENCLATURE.filter((s) => s.departmentId === departmentId);
}
`,
  "utf8",
);

console.log(
  `wrote ${sectors.length} branches, ${structure.length} regions, ` +
    `${departments.length} departments and ${subdivisions.length} arrondissements`,
);
