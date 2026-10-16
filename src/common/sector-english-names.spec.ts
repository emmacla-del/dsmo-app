// The 19 sectors' English names (defect 7, approved 2026-10-16): the data
// migration and the seed must name the same sectors with the same English.
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..', '..');
const migration = fs.readFileSync(
  path.join(root, 'prisma', 'migrations', '20261021120000_sector_english_names', 'migration.sql'),
  'utf8',
);
const seed = fs.readFileSync(path.join(root, 'prisma', 'seed.ts'), 'utf8');

const unquote = (s: string) => s.replace(/''/g, "'");

function fromMigration(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /UPDATE "sectors" SET "nameEn" = '((?:[^']|'')+)' WHERE "name" = '((?:[^']|'')+)' AND "nameEn" IS NULL;/g;
  for (const m of migration.matchAll(re)) out.set(unquote(m[2]), unquote(m[1]));
  return out;
}

function fromSeed(): Map<string, string> {
  const out = new Map<string, string>();
  const re = /\{ name: (['"])(.+?)\1, nameEn: (['"])(.+?)\3, category: /g;
  for (const m of seed.matchAll(re)) out.set(m[2], m[4]);
  return out;
}

describe('sector English names', () => {
  it('the migration sets all 19, only where none is set, and does nothing else', () => {
    const map = fromMigration();
    expect(map.size).toBe(19);
    const statements = migration.split('\n').filter((l) => l.trim() && !l.startsWith('--'));
    expect(statements).toHaveLength(19);
    expect(migration).not.toMatch(/ALTER|DELETE|INSERT|DROP/i);
  });

  it('the seed gives every sector the same English name as the migration', () => {
    const seeded = fromSeed();
    expect(seeded.size).toBe(19);
    expect(Object.fromEntries(seeded)).toEqual(Object.fromEntries(fromMigration()));
  });

  it('a few names read as approved', () => {
    const map = fromMigration();
    expect(map.get("Activités financières et d'assurance")).toBe('Financial and insurance activities');
    expect(map.get('Construction et BTP')).toBe('Construction and public works');
    expect(map.get("Production et distribution d'eau, électricité et gaz")).toBe('Water, electricity and gas supply');
  });
});
