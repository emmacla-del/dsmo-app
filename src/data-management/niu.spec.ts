import { hasRealNiu } from './niu';

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
