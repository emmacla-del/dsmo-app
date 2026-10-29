/**
 * Which registration files share an identity with another file.
 *
 * The same three keys as AuthService.withDuplicateHints, decided before
 * pagination so the total, the pages and the CSV describe one selection:
 *   - NIU, except a placeholder that starts with "NA-" (those are unique
 *     stand-ins, not a taxpayer number two establishments share);
 *   - CNPS number;
 *   - the organisation's name within one subdivision.
 * Name equality is the hint's own comparison: case-insensitive and
 * accent-sensitive (localeCompare sensitivity "accent"), which is what
 * lower(name) expresses for the letters the register stores. A match
 * anywhere in the register counts, including a file outside the officer's
 * territory; the caller keeps the territory clause and only adds these ids.
 */
export type RegistrationDuplicateRow = {
  id: string;
  taxNumber: string | null;
  cnpsNumber: string | null;
  name: string | null;
  subdivisionId: string | null;
};

function sameRegistrationName(a: string, b: string): boolean {
  return a.localeCompare(b, 'fr', { sensitivity: 'accent' }) === 0;
}

export function registrationDuplicateIds(rows: RegistrationDuplicateRow[]): string[] {
  const ids = new Set<string>();

  const byNiu = new Map<string, string[]>();
  const byCnps = new Map<string, string[]>();
  for (const row of rows) {
    const niu = row.taxNumber ?? '';
    if (niu && !niu.startsWith('NA-')) {
      const bucket = byNiu.get(niu);
      if (bucket) bucket.push(row.id);
      else byNiu.set(niu, [row.id]);
    }
    if (row.cnpsNumber) {
      const bucket = byCnps.get(row.cnpsNumber);
      if (bucket) bucket.push(row.id);
      else byCnps.set(row.cnpsNumber, [row.id]);
    }
  }
  const markShared = (groups: Map<string, string[]>) => {
    for (const bucket of groups.values()) {
      if (bucket.length > 1) for (const id of bucket) ids.add(id);
    }
  };
  markShared(byNiu);
  markShared(byCnps);

  const bySubdivision = new Map<string, RegistrationDuplicateRow[]>();
  for (const row of rows) {
    if (!row.subdivisionId) continue;
    const bucket = bySubdivision.get(row.subdivisionId);
    if (bucket) bucket.push(row);
    else bySubdivision.set(row.subdivisionId, [row]);
  }
  for (const group of bySubdivision.values()) {
    const clusters: RegistrationDuplicateRow[][] = [];
    for (const row of group) {
      const name = row.name ?? '';
      const cluster = clusters.find((items) => sameRegistrationName(items[0].name ?? '', name));
      if (cluster) cluster.push(row);
      else clusters.push([row]);
    }
    for (const cluster of clusters) {
      if (cluster.length > 1) for (const row of cluster) ids.add(row.id);
    }
  }

  return [...ids];
}
