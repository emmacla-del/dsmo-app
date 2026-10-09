import { createHash } from 'crypto';
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

// ── Very long strings (E8, dataset v6) ──────────────────────────────────

/** Decompresses bytecode case data (bias 100) into 8-byte units. */
function decompress(body: Buffer): Array<Buffer | number | null> {
  const units: Array<Buffer | number | null> = [];
  let pos = 0;
  while (pos < body.length) {
    const commands = body.subarray(pos, pos + 8);
    pos += 8;
    for (const c of commands) {
      if (c === 0) continue;
      if (c === 252) return units;
      if (c === 253) { units.push(Buffer.from(body.subarray(pos, pos + 8))); pos += 8; }
      else if (c === 254) units.push(Buffer.alloc(8, 0x20));
      else if (c === 255) units.push(null);
      else units.push(c - 100);
    }
  }
  return units;
}

/** Every type-2 record (continuations excluded): [width, shortName]. */
function variableRecords(h: Buffer): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  let pos = 176;
  while (h.readInt32LE(pos) === 2) {
    const width = h.readInt32LE(pos + 4);
    const hasLabel = h.readInt32LE(pos + 8);
    const nMissing = h.readInt32LE(pos + 12);
    const name = h.subarray(pos + 24, pos + 32).toString('latin1').trimEnd();
    pos += 32;
    if (hasLabel) pos += 4 + Math.ceil(h.readInt32LE(pos) / 4) * 4;
    pos += 8 * Math.abs(nMissing);
    if (width !== -1) out.push([width, name]);
  }
  return out;
}

function extensionRecord(h: Buffer, subtype: number): Buffer | null {
  for (let pos = 0; pos + 16 <= h.length; pos++) { // records are byte-packed (7/13 has any length)
    if (h.readInt32LE(pos) === 7 && h.readInt32LE(pos + 4) === subtype && h.readInt32LE(pos + 8) >= 1) {
      const size = h.readInt32LE(pos + 8);
      const count = h.readInt32LE(pos + 12);
      if (size * count > 0 && pos + 16 + size * count <= h.length) return h.subarray(pos + 16, pos + 16 + size * count);
    }
  }
  return null;
}

describe('SavWriter very long strings (> 255 bytes)', () => {
  const long: SavVariable[] = [
    { name: 'id', type: 'numeric', width: 8 },
    { name: 'VT9_4', label: 'Citer les 5 principales perspectives', type: 'string', width: 2000 },
    { name: 'court', type: 'string', width: 20 },
    { name: 'VT9_3', label: 'Autre (à préciser)', type: 'string', width: 600 },
  ];
  const text = 'Perspectives : élargir l’offre à l’Extrême-Nord, ' + 'é'.repeat(700); // > 1450 bytes

  it('leaves files without such a variable byte-identical to the previous writer', () => {
    // Golden digest produced by the pre-E8 writer (HEAD fa3103db) for this input.
    const golden: SavVariable[] = [
      { name: 'effectif_total', label: 'Effectif total', type: 'numeric', width: 10, missingValues: [-98, -99], valueLabels: { '1': 'Oui', '0': 'Non' }, measure: 'nominal' },
      { name: 'raison_sociale', label: 'Raison sociale — Extrême', type: 'string', width: 254 },
      { name: 'code', label: 'Code', type: 'string', width: 8, valueLabels: { A: 'Alpha' } },
      { name: 'statut', type: 'string', width: 20, valueLabels: { REPORTED: 'Chiffres déclarés' } },
      { name: 'montant', type: 'numeric', width: 14, decimals: 2, measure: 'scale' },
    ];
    const rows = [[1, 'Brasseries du Cameroun 😀', 'A', 'REPORTED', 1234.5], [null, 'é'.repeat(300), '', null, -98], [0, '', 'B', 'NONE', '42']];
    const w = new SavWriter(golden, { fileLabel: 'Golden', createdAt: new Date(2026, 8, 18, 16, 45, 0) });
    const bytes = Buffer.concat([w.header(), ...rows.map((r) => w.encodeCase(r)), w.finish()]);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('2be528f9efffaa8879880eb3c291d14ed0cabd874d2060fa45508cd8310cc750');
  });

  it('splits a 2000-byte string into 8 segments (7 × A255 + A236) with unique short names', () => {
    const h = new SavWriter(long).header();
    // units: id 1 + VT9_4 (7×32 + 30) + court 3 + VT9_3 (2×32 + ceil(96/8)=12)
    expect(h.readInt32LE(68)).toBe(1 + 254 + 3 + 76);
    const recs = variableRecords(h);
    expect(recs.map((r) => r[0])).toEqual([0, 255, 255, 255, 255, 255, 255, 255, 236, 20, 255, 255, 96]);
    const names = recs.map((r) => r[1]);
    expect(new Set(names).size).toBe(names.length);
    expect(names[1]).toBe('VT9_4');
    expect(names[10]).toBe('VT9_3');
  });

  it('writes the 7/14 record and keeps 7/13 to one entry per variable', () => {
    const h = new SavWriter(long).header();
    expect(extensionRecord(h, 14)!.toString('latin1')).toBe('VT9_4=02000\0\tVT9_3=00600\0\t');
    expect(extensionRecord(h, 13)!.toString('latin1')).toBe('ID=id\tVT9_4=VT9_4\tCOURT=court\tVT9_3=VT9_3');
    // 7/11: 3 ints per segment (1 + 8 + 1 + 3 segments)
    expect(extensionRecord(h, 11)!.length).toBe(13 * 3 * 4);
    // no 7/14 when nothing is wider than 255
    expect(extensionRecord(new SavWriter(vars).header(), 14)).toBeNull();
  });

  it('lays case data out in 255-byte slices per segment, padded to each segment, without truncating', () => {
    const w = new SavWriter(long);
    const body = Buffer.concat([w.encodeCase([7, text, 'abc', 'é'.repeat(290)]), w.finish()]);
    const units = decompress(body);
    expect(units.length).toBe(1 + 254 + 3 + 76);
    expect(units[0]).toBe(7);

    const strBytes = (from: number, segUnits: number[], width: number) => {
      const parts: Buffer[] = [];
      let u = from;
      segUnits.forEach((n, s) => {
        const seg = Buffer.concat(units.slice(u, u + n) as Buffer[]);
        const used = Math.min(255, width - s * 255);
        // bytes past the data slice are padding (spaces)
        expect(seg.subarray(used).every((b) => b === 0x20)).toBe(true);
        parts.push(seg.subarray(0, used));
        u += n;
      });
      return Buffer.concat(parts).toString('utf8').trimEnd();
    };
    expect(strBytes(1, [32, 32, 32, 32, 32, 32, 32, 30], 2000)).toBe(text);
    expect(Buffer.concat(units.slice(255, 258) as Buffer[]).toString('utf8').trimEnd()).toBe('abc');
    expect(strBytes(258, [32, 32, 12], 600)).toBe('é'.repeat(290));
    expect(w.truncatedValues.size).toBe(0);
  });

  it('counts a value longer than even a very long width (UTF-8 bytes, not characters)', () => {
    const w = new SavWriter([{ name: 'note', type: 'string', width: 300 }]);
    w.encodeCase(['e'.repeat(300)]); // 300 bytes: fits
    w.encodeCase(['é'.repeat(151)]); // 151 characters but 302 bytes: does not
    expect(Object.fromEntries(w.truncatedValues)).toEqual({ note: 1 });
  });
});
