// src/data-management/spss/sav-writer.ts
//
// Native IBM SPSS Statistics system-file (.sav) writer — replaces the
// scripts/generate_spss_sav.py round trip (CSV on disk → pandas → pyreadstat)
// so the export no longer depends on a Python interpreter and packages being
// present on the server, and no longer re-parses our own CSV (whose header
// row is labels, not names) to recover the dictionary.
//
// Format reference: the GNU PSPP "System File Format" appendix. What is
// written, in order:
//   file header ($FL2, bytecode-compressed, bias 100)
//   variable records (type 2) — one per variable plus one continuation
//     record per extra 8-byte segment of a string wider than 8
//   value labels (types 3 + 4) for numeric and ≤8-byte string variables
//   machine integer info (7/3), machine float info (7/4)
//   variable display parameters (7/11) — measurement level / width / align
//   long variable names (7/13)
//   character encoding (7/20) = UTF-8
//   long string value labels (7/21)
//   dictionary termination (999), then the compressed case data.
//
// Strings are capped at 255 bytes (no "very long string" 7/14 support —
// no canonical variable is wider than that). Values are converted exactly the
// way the old pipeline did (csvEscape → pandas.to_numeric(errors='coerce')),
// so switching writers changes no data: blank / non-numeric → system-missing.

export type SavMeasure = 'nominal' | 'ordinal' | 'scale';

export interface SavVariable {
  /** Long variable name, already a valid, unique SPSS name (≤ 64 bytes). */
  name: string;
  label?: string;
  type: 'numeric' | 'string';
  /** Strings: storage width in bytes (1–255). Numerics: display width. */
  width: number;
  decimals?: number;
  valueLabels?: Record<string, string>;
  /** Discrete user-missing values (numeric only, at most 3). */
  missingValues?: number[];
  measure?: SavMeasure;
}

export interface SavWriterOptions {
  fileLabel?: string;
  createdAt?: Date;
}

const SYSMIS = -Number.MAX_VALUE;
const MAX_STRING_WIDTH = 255;
const MAX_VALUE_LABEL_BYTES = 120;
const BIAS = 100;
/** Byte offset of the int32 case count in the file header. */
export const SAV_NCASES_OFFSET = 80;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

class ByteSink {
  private parts: Buffer[] = [];
  int32(n: number) {
    const b = Buffer.alloc(4);
    b.writeInt32LE(n, 0);
    this.parts.push(b);
  }
  float64(n: number) {
    const b = Buffer.alloc(8);
    b.writeDoubleLE(n, 0);
    this.parts.push(b);
  }
  bytes(b: Buffer) {
    this.parts.push(b);
  }
  /** Fixed-width field, space-padded (or truncated) to `len` bytes. */
  fixed(s: string, len: number, pad = 0x20) {
    const out = Buffer.alloc(len, pad);
    truncateUtf8(s, len).copy(out);
    this.parts.push(out);
  }
  toBuffer() {
    return Buffer.concat(this.parts);
  }
}

/** UTF-8 encode, cut to at most `maxBytes` without splitting a character. */
export function truncateUtf8(s: string, maxBytes: number): Buffer {
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= maxBytes) return buf;
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return buf.subarray(0, end);
}

function padTo(buf: Buffer, multiple: number, fill = 0x20): Buffer {
  const len = Math.ceil(buf.length / multiple) * multiple;
  if (len === buf.length) return buf;
  const out = Buffer.alloc(len, fill);
  buf.copy(out);
  return out;
}

function segmentsOf(v: SavVariable): number {
  return v.type === 'numeric' ? 1 : Math.ceil(stringWidth(v) / 8);
}

function stringWidth(v: SavVariable): number {
  return Math.min(Math.max(Math.round(v.width) || 1, 1), MAX_STRING_WIDTH);
}

/** Same coercion as pandas.to_numeric(str, errors='coerce'); null = system-missing. */
export function toSavNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' && typeof value !== 'bigint') return null;
  const s = String(value).trim();
  if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Same text the CSV pipeline produced (see DataManagementService.csvEscape). */
export function toSavString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function formatCode(v: SavVariable): number {
  if (v.type === 'string') {
    const w = stringWidth(v);
    return (1 << 16) | (w << 8); // A<w>
  }
  const w = Math.min(Math.max(Math.round(v.width) || 8, 1), 40);
  const d = Math.min(Math.max(v.decimals ?? 0, 0), 16);
  return (5 << 16) | (w << 8) | d; // F<w>.<d>
}

/** 8-byte, upper-case, unique short names as required by the type-2 records. */
function buildShortNames(vars: SavVariable[]): string[] {
  const used = new Set<string>();
  return vars.map((v) => {
    const base = v.name.toUpperCase();
    let candidate = base.slice(0, 8);
    for (let n = 1; used.has(candidate); n++) {
      const suffix = String(n);
      candidate = base.slice(0, 8 - suffix.length) + suffix;
    }
    used.add(candidate);
    return candidate;
  });
}

function validateVariables(vars: SavVariable[]) {
  const seen = new Set<string>();
  for (const v of vars) {
    // Saved variables must start with a letter or @ (# = scratch, $ = system).
    if (!/^[A-Za-z@][A-Za-z0-9@#$_.]{0,63}$/.test(v.name) || v.name.endsWith('.')) {
      throw new Error(`Nom de variable SPSS invalide : "${v.name}"`);
    }
    const key = v.name.toUpperCase();
    if (seen.has(key)) throw new Error(`Nom de variable SPSS en double : "${v.name}"`);
    seen.add(key);
    if (v.type === 'numeric' && (v.missingValues?.length ?? 0) > 3) {
      throw new Error(`Plus de 3 valeurs manquantes pour "${v.name}"`);
    }
  }
}

/**
 * Usage: write `header()` once, then `encodeCase()` for every row, then
 * `finish()`. Each call returns the bytes to append; compressed case data is
 * emitted in whole 8-command blocks, so the encoder carries partial blocks
 * across cases (the format allows a block to span case boundaries).
 */
export class SavWriter {
  private readonly shortNames: string[];
  private readonly totalSegments: number;
  private commands: number[] = [];
  private raw: Buffer[] = [];
  private caseCount = 0;
  private readonly truncations = new Map<string, number>();

  constructor(private readonly vars: SavVariable[], private readonly options: SavWriterOptions = {}) {
    if (vars.length === 0) throw new Error('Aucune variable à exporter.');
    validateVariables(vars);
    this.shortNames = buildShortNames(vars);
    this.totalSegments = vars.reduce((n, v) => n + segmentsOf(v), 0);
  }

  get casesWritten() {
    return this.caseCount;
  }

  /** Variables whose values had to be shortened to fit their width, with counts. */
  get truncatedValues(): ReadonlyMap<string, number> {
    return this.truncations;
  }

  header(): Buffer {
    const out = new ByteSink();
    const now = this.options.createdAt ?? new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const yy = String(now.getFullYear() % 100).padStart(2, '0');
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');

    // ── File header (176 bytes) ──
    out.fixed('$FL2', 4);
    out.fixed('@(#) SPSS DATA FILE CAM-LEAP ONEFOP', 60);
    out.int32(2); // layout code
    out.int32(this.totalSegments); // nominal case size
    out.int32(1); // bytecode compression
    out.int32(0); // no weight variable
    out.int32(-1); // case count unknown while streaming — patched by the caller when known
    out.float64(BIAS);
    out.fixed(`${dd} ${MONTHS[now.getMonth()]} ${yy}`, 9);
    out.fixed(time, 8);
    out.fixed(this.options.fileLabel ?? '', 64);
    out.bytes(Buffer.alloc(3));

    // ── Variable records ──
    this.vars.forEach((v, i) => {
      out.int32(2);
      out.int32(v.type === 'numeric' ? 0 : stringWidth(v));
      const label = v.label ? truncateUtf8(v.label, 255) : null;
      out.int32(label && label.length > 0 ? 1 : 0);
      const missing = v.type === 'numeric' ? v.missingValues ?? [] : [];
      out.int32(missing.length);
      const fmt = formatCode(v);
      out.int32(fmt); // print format
      out.int32(fmt); // write format
      out.fixed(this.shortNames[i], 8);
      if (label && label.length > 0) {
        out.int32(label.length);
        out.bytes(padTo(label, 4));
      }
      for (const m of missing) out.float64(m);

      for (let s = 1; s < segmentsOf(v); s++) {
        out.int32(2);
        out.int32(-1);
        out.int32(0);
        out.int32(0);
        out.int32(0);
        out.int32(0);
        out.fixed('', 8);
      }
    });

    // ── Value labels (types 3 + 4): numerics and strings up to 8 bytes ──
    const segmentIndex: number[] = [];
    let idx = 1;
    for (const v of this.vars) {
      segmentIndex.push(idx);
      idx += segmentsOf(v);
    }
    const longStringLabels: { name: string; width: number; labels: [Buffer, Buffer][] }[] = [];

    this.vars.forEach((v, i) => {
      const entries = Object.entries(v.valueLabels ?? {});
      if (entries.length === 0) return;
      if (v.type === 'numeric') {
        const numeric = entries
          .map(([k, lbl]) => [toSavNumber(k), lbl] as const)
          .filter((e): e is readonly [number, string] => e[0] !== null);
        if (numeric.length === 0) return;
        out.int32(3);
        out.int32(numeric.length);
        for (const [value, lbl] of numeric) {
          out.float64(value);
          this.writeLabel(out, lbl);
        }
      } else if (stringWidth(v) <= 8) {
        out.int32(3);
        out.int32(entries.length);
        for (const [value, lbl] of entries) {
          out.fixed(value, 8);
          this.writeLabel(out, lbl);
        }
      } else {
        longStringLabels.push({
          name: v.name,
          width: stringWidth(v),
          labels: entries.map(([value, lbl]) => [truncateUtf8(value, stringWidth(v)), truncateUtf8(lbl, MAX_VALUE_LABEL_BYTES)]),
        });
        return;
      }
      out.int32(4);
      out.int32(1);
      out.int32(segmentIndex[i]);
    });

    // ── 7/3 machine integer info ──
    this.extension(out, 3, 4, [20, 0, 0, -1, 1, 1, 2, 65001].map(int32));
    // ── 7/4 machine float info: sysmis, highest, lowest ──
    const lowest = Buffer.from([0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xef, 0xff]); // -DBL_MAX + 1ulp
    this.extension(out, 4, 8, [float64(SYSMIS), float64(Number.MAX_VALUE), lowest]);
    // ── 7/11 variable display parameters (one set per variable, not per segment) ──
    const display: Buffer[] = [];
    for (const v of this.vars) {
      const measure = v.measure ?? (v.type === 'string' || Object.keys(v.valueLabels ?? {}).length > 0 ? 'nominal' : 'scale');
      display.push(int32(measure === 'nominal' ? 1 : measure === 'ordinal' ? 2 : 3));
      display.push(int32(v.type === 'string' ? Math.min(stringWidth(v), 40) : Math.min(Math.max(Math.round(v.width) || 8, 1), 40)));
      display.push(int32(v.type === 'string' ? 0 : 1)); // left / right aligned
    }
    this.extension(out, 11, 4, display);
    // ── 7/13 long variable names ──
    const longNames = this.vars.map((v, i) => `${this.shortNames[i]}=${v.name}`).join('\t');
    this.extension(out, 13, 1, [Buffer.from(longNames, 'utf8')]);
    // ── 7/20 character encoding ──
    this.extension(out, 20, 1, [Buffer.from('UTF-8', 'ascii')]);
    // ── 7/21 long string value labels ──
    if (longStringLabels.length > 0) {
      const parts: Buffer[] = [];
      for (const v of longStringLabels) {
        const name = Buffer.from(v.name, 'utf8');
        parts.push(int32(name.length), name, int32(v.width), int32(v.labels.length));
        for (const [value, lbl] of v.labels) {
          parts.push(int32(value.length), value, int32(lbl.length), lbl);
        }
      }
      this.extension(out, 21, 1, parts);
    }

    // ── Dictionary termination ──
    out.int32(999);
    out.int32(0);
    return out.toBuffer();
  }

  /** Encodes one case; `values` are in variable order. */
  encodeCase(values: unknown[]): Buffer {
    if (values.length !== this.vars.length) {
      throw new Error(`Cas invalide : ${values.length} valeurs pour ${this.vars.length} variables.`);
    }
    const blocks: Buffer[] = [];
    this.vars.forEach((v, i) => {
      if (v.type === 'numeric') {
        const n = toSavNumber(values[i]);
        if (n === null) this.push(255, null, blocks);
        else if (Number.isInteger(n) && n >= 1 - BIAS && n <= 251 - BIAS && !Object.is(n, -0)) this.push(n + BIAS, null, blocks);
        else this.push(253, float64(n), blocks);
      } else {
        const width = stringWidth(v);
        const text = toSavString(values[i]);
        const bytes = truncateUtf8(text, width);
        if (bytes.length < Buffer.byteLength(text, 'utf8')) {
          this.truncations.set(v.name, (this.truncations.get(v.name) ?? 0) + 1);
        }
        const padded = Buffer.alloc(segmentsOf(v) * 8, 0x20);
        bytes.copy(padded);
        for (let off = 0; off < padded.length; off += 8) {
          const chunk = padded.subarray(off, off + 8);
          if (chunk.every((b) => b === 0x20)) this.push(254, null, blocks);
          else this.push(253, Buffer.from(chunk), blocks);
        }
      }
    });
    this.caseCount++;
    return Buffer.concat(blocks);
  }

  /** Flushes the last partial command block, terminated by end-of-file (252). */
  finish(): Buffer {
    const blocks: Buffer[] = [];
    this.push(252, null, blocks);
    if (this.commands.length > 0) {
      while (this.commands.length < 8) this.commands.push(0);
      this.flush(blocks);
    }
    return Buffer.concat(blocks);
  }

  private push(command: number, raw: Buffer | null, blocks: Buffer[]) {
    this.commands.push(command);
    if (raw) this.raw.push(raw);
    if (this.commands.length === 8) this.flush(blocks);
  }

  private flush(blocks: Buffer[]) {
    blocks.push(Buffer.from(this.commands), ...this.raw);
    this.commands = [];
    this.raw = [];
  }

  private writeLabel(out: ByteSink, label: string) {
    const bytes = truncateUtf8(label, MAX_VALUE_LABEL_BYTES);
    // length byte + label, padded so the pair is a multiple of 8 bytes
    const total = Math.ceil((bytes.length + 1) / 8) * 8;
    const b = Buffer.alloc(total, 0x20);
    b[0] = bytes.length;
    bytes.copy(b, 1);
    out.bytes(b);
  }

  private extension(out: ByteSink, subtype: number, size: number, parts: Buffer[]) {
    const data = Buffer.concat(parts);
    out.int32(7);
    out.int32(subtype);
    out.int32(size);
    out.int32(data.length / size);
    out.bytes(data);
  }
}

function int32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32LE(n, 0);
  return b;
}

function float64(n: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeDoubleLE(n, 0);
  return b;
}
