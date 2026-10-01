import { BadRequestException } from '@nestjs/common';
import {
  assertEntryCount,
  parseTargetBody,
  parseYear,
  summarizeRegion,
  TARGET_MAX,
} from './pilotage-validation';

describe('parseYear', () => {
  it('accepts a year in range, including a numeric string', () => {
    expect(parseYear('2026')).toBe(2026);
    expect(parseYear(' 2026 ')).toBe(2026);
    expect(parseYear(2000)).toBe(2000);
    expect(parseYear(2100)).toBe(2100);
  });

  it('rejects a missing, fractional, or out-of-range year', () => {
    for (const raw of [undefined, null, '', '   ', '2026.5', '2026a', -1, 1999, 2101, 20.26, ['2026']]) {
      expect(() => parseYear(raw)).toThrow(BadRequestException);
    }
    expect(() => parseYear(undefined)).toThrow('Le paramètre « year » est obligatoire.');
    expect(() => parseYear('')).toThrow('Le paramètre « year » est obligatoire.');
    expect(() => parseYear('1999')).toThrow('Le paramètre « year » doit être une année entre 2000 et 2100.');
  });
});

describe('parseTargetBody', () => {
  const row = (regionId: string, departmentId: string | null, inscriptionTarget: number) => ({
    regionId,
    departmentId,
    inscriptionTarget,
  });

  it('accepts zero and the int4 maximum, and treats a missing department as regional', () => {
    const parsed = parseTargetBody({
      entries: [row('r1', null, 0), { regionId: 'r2', inscriptionTarget: TARGET_MAX }],
    }, 'inscriptionTarget');
    expect(parsed.entries).toEqual([
      { regionId: 'r1', departmentId: null, target: 0 },
      { regionId: 'r2', departmentId: null, target: TARGET_MAX },
    ]);
    expect(parsed.central).toBeUndefined();
  });

  it('accepts one row per department across 58 departments', () => {
    const entries = Array.from({ length: 58 }, (_, index) => row('r1', `d${index}`, index));
    expect(parseTargetBody({ entries }, 'inscriptionTarget').entries).toHaveLength(58);
  });

  it('rejects negatives, floats, numeric strings, and booleans', () => {
    for (const inscriptionTarget of [-1, 1.5, '12', true, null, TARGET_MAX + 1]) {
      expect(() => parseTargetBody({ entries: [{ regionId: 'r1', departmentId: 'd1', inscriptionTarget }] }, 'inscriptionTarget'))
        .toThrow('La ligne 1 : « inscriptionTarget » doit être un entier positif ou nul.');
    }
  });

  it('rejects an empty department id and a duplicate territory', () => {
    expect(() => parseTargetBody({ entries: [row('r1', '  ', 1)] }, 'inscriptionTarget'))
      .toThrow("La ligne 1 : un département vide n'est pas un objectif régional.");
    expect(() => parseTargetBody({ entries: [row('r1', 'd1', 1), row('r1', 'd1', 2)] }, 'inscriptionTarget'))
      .toThrow('La ligne 2 répète un territoire déjà présent dans la requête.');
    expect(() => parseTargetBody({
      entries: [{ regionId: 'r1', inscriptionTarget: 1 }, { regionId: 'r1', departmentId: null, inscriptionTarget: 2 }],
    }, 'inscriptionTarget')).toThrow('La ligne 2 répète un territoire déjà présent dans la requête.');
  });

  it('rejects a region that mixes a regional row with department rows', () => {
    expect(() => parseTargetBody({ entries: [row('r1', null, 5), row('r1', 'd1', 1)] }, 'inscriptionTarget'))
      .toThrow('La région « r1 » mélange un objectif régional et des objectifs départementaux.');
  });

  it('parses central as omitted, cleared, or set', () => {
    expect(parseTargetBody({ entries: [] }, 'inscriptionTarget').central).toBeUndefined();
    expect(parseTargetBody({ entries: [], central: null }, 'inscriptionTarget').central).toBeNull();
    expect(parseTargetBody({ entries: [], central: { inscriptionTarget: 0 } }, 'inscriptionTarget').central).toBe(0);
    expect(() => parseTargetBody({ entries: [], central: { inscriptionTarget: -1 } }, 'inscriptionTarget'))
      .toThrow('« central.inscriptionTarget » doit être un entier positif ou nul.');
    expect(() => parseTargetBody({ entries: [], central: [] }, 'inscriptionTarget'))
      .toThrow('« central » doit être un objet ou null.');
  });

  it('rejects a body that is not an object with an entries array', () => {
    expect(() => parseTargetBody(null, 'submissionTarget')).toThrow('Le corps de la requête est invalide.');
    expect(() => parseTargetBody([], 'submissionTarget')).toThrow('Le corps de la requête est invalide.');
    expect(() => parseTargetBody({}, 'submissionTarget')).toThrow('Le champ « entries » doit être un tableau.');
  });
});

describe('assertEntryCount', () => {
  it('allows a body up to the number of known territories', () => {
    expect(() => assertEntryCount(58, 68)).not.toThrow();
    expect(() => assertEntryCount(69, 68)).toThrow('Le corps contient 69 lignes, au-delà des 68 territoires connus.');
  });
});

describe('summarizeRegion', () => {
  it('sums department targets and reports department mode', () => {
    expect(summarizeRegion([
      { departmentId: 'd1', target: 10 },
      { departmentId: 'd2', target: 0 },
      { departmentId: 'd3', target: 25 },
    ])).toEqual({ mode: 'DEPARTMENT', target: 35 });
  });

  it('returns the single regional value, an empty region, and refuses to add a mixed set', () => {
    expect(summarizeRegion([])).toEqual({ mode: 'UNSET', target: null });
    expect(summarizeRegion([{ departmentId: null, target: 80 }])).toEqual({ mode: 'REGION', target: 80 });
    expect(summarizeRegion([
      { departmentId: null, target: 80 },
      { departmentId: 'd1', target: 10 },
    ])).toEqual({ mode: 'MIXED', target: null });
    expect(summarizeRegion([
      { departmentId: null, target: 80 },
      { departmentId: null, target: 5 },
    ])).toEqual({ mode: 'MIXED', target: null });
  });
});
