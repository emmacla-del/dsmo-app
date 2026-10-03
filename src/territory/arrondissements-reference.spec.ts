import * as fs from 'fs';
import * as path from 'path';

interface CanonicalSubdivision {
  name: string;
  code: string;
}

interface CanonicalDepartment {
  name: string;
  code: string;
  subdivisions: CanonicalSubdivision[];
}

interface CanonicalRegion {
  name: string;
  code: string;
  departments: CanonicalDepartment[];
}

const fixturePath = path.resolve(__dirname, '../../test/fixtures/canonical-360.json');
const CANONICAL_CAMEROON_360: CanonicalRegion[] = JSON.parse(
  fs.readFileSync(fixturePath, 'utf8'),
);

describe('Arrondissements Reference Data (360 canonical list)', () => {
  it('contains exactly 10 official regions', () => {
    expect(CANONICAL_CAMEROON_360).toHaveLength(10);
    const regionNames = CANONICAL_CAMEROON_360.map((r) => r.name);
    expect(regionNames).toEqual([
      'Adamaoua',
      'Centre',
      'Est',
      'Extrême-Nord',
      'Littoral',
      'Nord',
      'Nord-Ouest',
      'Ouest',
      'Sud',
      'Sud-Ouest',
    ]);
  });

  it('contains exactly 58 departments across all regions', () => {
    const totalDepartments = CANONICAL_CAMEROON_360.reduce(
      (sum, r) => sum + r.departments.length,
      0,
    );
    expect(totalDepartments).toBe(58);

    const deptCodes = CANONICAL_CAMEROON_360.flatMap((r) =>
      r.departments.map((d) => d.code),
    );
    expect(new Set(deptCodes).size).toBe(58);
    for (let i = 1; i <= 58; i++) {
      expect(deptCodes).toContain(String(i).padStart(2, '0'));
    }
  });

  it('contains exactly 360 subdivisions in total', () => {
    const totalSubdivisions = CANONICAL_CAMEROON_360.reduce(
      (sum, r) =>
        sum +
        r.departments.reduce((dSum, d) => dSum + d.subdivisions.length, 0),
      0,
    );
    expect(totalSubdivisions).toBe(360);
  });

  it('ensures no subdivision name appears in more than one department', () => {
    const subdivToDepts = new Map<string, string[]>();
    for (const r of CANONICAL_CAMEROON_360) {
      for (const d of r.departments) {
        for (const s of d.subdivisions) {
          const key = s.name;
          if (!subdivToDepts.has(key)) {
            subdivToDepts.set(key, []);
          }
          subdivToDepts.get(key)!.push(`${r.name}/${d.name}`);
        }
      }
    }

    const duplicates: Array<{ name: string; departments: string[] }> = [];
    for (const [name, depts] of subdivToDepts.entries()) {
      if (depts.length > 1) {
        duplicates.push({ name, departments: depts });
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('ensures every subdivision code is 4 digits and globally unique', () => {
    const allCodes = CANONICAL_CAMEROON_360.flatMap((r) =>
      r.departments.flatMap((d) =>
        d.subdivisions.map((s) => ({
          subdivision: s.name,
          department: d.name,
          code: s.code,
        })),
      ),
    );

    expect(allCodes).toHaveLength(360);

    const codeSet = new Set<string>();
    for (const item of allCodes) {
      expect(item.code).toMatch(/^\d{4}$/);
      expect(codeSet.has(item.code)).toBe(false);
      codeSet.add(item.code);
    }
    expect(codeSet.size).toBe(360);
  });

  it('documents official department spelling changes', () => {
    const centre = CANONICAL_CAMEROON_360.find((r) => r.name === 'Centre')!;
    const sudOuest = CANONICAL_CAMEROON_360.find((r) => r.name === 'Sud-Ouest')!;

    // Méfou-et-Afamba -> Mefou-et-Afamba
    expect(centre.departments.some((d) => d.name === 'Mefou-et-Afamba')).toBe(true);
    expect(centre.departments.some((d) => d.name === 'Méfou-et-Afamba')).toBe(false);

    // Méfou-et-Akono -> Mefou-et-Akono
    expect(centre.departments.some((d) => d.name === 'Mefou-et-Akono')).toBe(true);
    expect(centre.departments.some((d) => d.name === 'Méfou-et-Akono')).toBe(false);

    // Koupé-Muanenguba -> Kupe-Manenguba
    expect(sudOuest.departments.some((d) => d.name === 'Kupe-Manenguba')).toBe(true);
    expect(sudOuest.departments.some((d) => d.name === 'Koupé-Muanenguba')).toBe(false);
  });
});
