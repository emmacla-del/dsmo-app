import { hasRealNiu, resolveTaxNumber } from './niu';

describe('hasRealNiu', () => {
  it('accepts a real taxpayer number', () => {
    expect(hasRealNiu('M123456789')).toBe(true);
    expect(hasRealNiu('TX1')).toBe(true);
  });

  it('rejects a missing value', () => {
    expect(hasRealNiu(null)).toBe(false);
    expect(hasRealNiu(undefined)).toBe(false);
    expect(hasRealNiu('')).toBe(false);
  });

  it('rejects the synthetic NA-<uuid> placeholder', () => {
    expect(hasRealNiu('NA-abc')).toBe(false);
    expect(hasRealNiu('NA-')).toBe(false);
    expect(hasRealNiu('NA-3f2b6c1e-0000-4000-8000-000000000000')).toBe(false);
  });
});

describe('resolveTaxNumber (Defect 6)', () => {
  it('returns company.taxNumber when submission.taxNumber is empty', () => {
    expect(resolveTaxNumber({ company: { taxNumber: 'P0TESTE2E1016' } })).toBe('P0TESTE2E1016');
    expect(resolveTaxNumber({ taxNumber: null, company: { taxNumber: 'P0TESTE2E1016' } })).toBe('P0TESTE2E1016');
    expect(resolveTaxNumber({ taxNumber: '', company: { taxNumber: 'P0TESTE2E1016' } })).toBe('P0TESTE2E1016');
  });

  it('returns submission.taxNumber when present and real', () => {
    expect(resolveTaxNumber({ taxNumber: 'TX999', company: { taxNumber: 'TX888' } })).toBe('TX888');
    expect(resolveTaxNumber({ taxNumber: 'TX999' })).toBe('TX999');
  });

  it('ignores synthetic NA-<uuid> placeholder and returns real company NIU', () => {
    expect(resolveTaxNumber({
      taxNumber: 'NA-3f2b6c1e-0000-4000-8000-000000000000',
      company: { taxNumber: 'P0TESTE2E1016' },
    })).toBe('P0TESTE2E1016');
  });

  it('returns null when synthetic placeholder is present and no real NIU exists', () => {
    expect(resolveTaxNumber({
      taxNumber: 'NA-3f2b6c1e-0000-4000-8000-000000000000',
    })).toBeNull();
  });

  it('returns undefined when neither is provided on the object', () => {
    expect(resolveTaxNumber({})).toBeUndefined();
    expect(resolveTaxNumber(null)).toBeUndefined();
  });

  it('never throws on a NIU that is not a string', () => {
    expect(() => resolveTaxNumber({ taxNumber: 12345, company: { taxNumber: 678 } })).not.toThrow();
    expect(resolveTaxNumber({ taxNumber: 12345, company: { taxNumber: 'P0TESTE2E1016' } })).toBe('P0TESTE2E1016');
  });
});

