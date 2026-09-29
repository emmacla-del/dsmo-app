import { SAV_NCASES_OFFSET, SavWriter, toSavNumber, toSavString, truncateUtf8, type SavVariable } from './sav-writer';

const vars: SavVariable[] = [
  { name: 'effectif_total', label: 'Effectif total', type: 'numeric', width: 10, missingValues: [-99] },
  { name: 'raison_sociale', label: 'Raison sociale', type: 'string', width: 20 },
];

describe('SavWriter', () => {
  it('writes a $FL2 header with bytecode compression, bias 100 and a patchable case count', () => {
    const h = new SavWriter(vars, { fileLabel: 'Test' }).header();
    expect(h.subarray(0, 4).toString('ascii')).toBe('$FL2');
    expect(h.readInt32LE(64)).toBe(2); // layout code
    expect(h.readInt32LE(68)).toBe(1 + 3); // 1 numeric segment + ceil(20/8) string segments
    expect(h.readInt32LE(72)).toBe(1); // compression
    expect(h.readInt32LE(SAV_NCASES_OFFSET)).toBe(-1);
    expect(h.readDoubleLE(84)).toBe(100);
    // dictionary ends with the 999 termination record
    expect(h.readInt32LE(h.length - 8)).toBe(999);
    expect(h.readInt32LE(h.length - 4)).toBe(0);
  });

  it('declares UTF-8 (7/3 character code 65001 and 7/20)', () => {
    const h = new SavWriter(vars).header();
    expect(h.includes(Buffer.from('UTF-8'))).toBe(true);
    const code = Buffer.alloc(4);
    code.writeInt32LE(65001, 0);
    expect(h.includes(code)).toBe(true);
  });

  it('compresses small integers, system-missing and blank string segments into command bytes', () => {
    const w = new SavWriter(vars);
    const body = Buffer.concat([w.encodeCase([5, '']), w.finish()]);
    // 5 → 105, then 3 blank 8-byte string segments → 254, then EOF 252, padding 0
    expect([...body.subarray(0, 8)]).toEqual([105, 254, 254, 254, 252, 0, 0, 0]);
    expect(body.length).toBe(8);

    const w2 = new SavWriter(vars);
    const body2 = Buffer.concat([w2.encodeCase([null, 'abc']), w2.finish()]);
    expect([...body2.subarray(0, 8)]).toEqual([255, 253, 254, 254, 252, 0, 0, 0]);
    expect(body2.subarray(8, 16).toString('utf8')).toBe('abc     ');
  });

  it('stores non-compressible numbers as raw doubles', () => {
    const w = new SavWriter([vars[0]]);
    const body = Buffer.concat([w.encodeCase([1234.5]), w.finish()]);
    expect(body[0]).toBe(253);
    expect(body.readDoubleLE(8)).toBe(1234.5);
  });

  it('lets a command block span case boundaries and counts cases', () => {
    const w = new SavWriter([vars[0]]);
    const parts = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => w.encodeCase([n]));
    expect(parts.slice(0, 7).every((b) => b.length === 0)).toBe(true);
    expect([...parts[7]]).toEqual([101, 102, 103, 104, 105, 106, 107, 108]);
    expect([...w.finish()]).toEqual([109, 252, 0, 0, 0, 0, 0, 0]);
    expect(w.casesWritten).toBe(9);
  });

  it('rejects invalid, reserved-prefix or duplicate names and wrong case widths', () => {
    expect(() => new SavWriter([{ name: '1abc', type: 'numeric', width: 8 }])).toThrow(/invalide/);
    expect(() => new SavWriter([{ name: '#tmp', type: 'numeric', width: 8 }])).toThrow(/invalide/);
    expect(() => new SavWriter([vars[0], { ...vars[0], name: 'EFFECTIF_TOTAL' }])).toThrow(/double/);
    expect(() => new SavWriter(vars).encodeCase([1])).toThrow(/2 variables/);
  });

  it('keeps 8-byte short names unique when long names share a prefix', () => {
    const many: SavVariable[] = ['s21q01_cadres_h', 's21q01_cadres_f', 's21q01_maitrise_h'].map((name) => ({
      name,
      type: 'numeric',
      width: 8,
    }));
    const h = new SavWriter(many).header().toString('latin1');
    expect(h).toContain('S21Q01_C=s21q01_cadres_h');
    expect(h).toContain('S21Q01_1=s21q01_cadres_f');
    expect(h).toContain('S21Q01_M=s21q01_maitrise_h');
  });
});

describe('truncation reporting', () => {
  it('counts values shortened to fit a string width, per variable', () => {
    const w = new SavWriter([{ name: 'quarterCode', type: 'string', width: 10 }]);
    w.encodeCase(['2025-T1']);
    w.encodeCase(['QUARTERLY_2026_T3']);
    w.encodeCase(['QUARTERLY_2026_T4']);
    expect(Object.fromEntries(w.truncatedValues)).toEqual({ quarterCode: 2 });
  });
});

describe('value conversion (matches the former CSV → pandas pipeline)', () => {
  it('coerces like pandas.to_numeric(errors="coerce")', () => {
    expect(toSavNumber(12)).toBe(12);
    expect(toSavNumber(' 12.5 ')).toBe(12.5);
    expect(toSavNumber('1e3')).toBe(1000);
    expect(toSavNumber('')).toBeNull();
    expect(toSavNumber('abc')).toBeNull();
    expect(toSavNumber(true)).toBeNull(); // pandas saw the text "true"
    expect(toSavNumber(undefined)).toBeNull();
    expect(toSavNumber(Number.NaN)).toBeNull();
  });

  it('formats strings like csvEscape did', () => {
    expect(toSavString(new Date('2026-09-18T16:45:00Z'))).toBe('2026-09-18');
    expect(toSavString(null)).toBe('');
    expect(toSavString(false)).toBe('false');
  });

  it('truncates UTF-8 without splitting a character', () => {
    expect(truncateUtf8('Extrême', 5).toString('utf8')).toBe('Extr');
    expect(truncateUtf8('Extrême', 6).toString('utf8')).toBe('Extrê');
  });
});
