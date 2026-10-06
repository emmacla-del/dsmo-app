import { ConflictException } from '@nestjs/common';
import { ESTABLISHMENT_ID_EXHAUSTED_MESSAGE, EstablishmentIdGenerator } from './establishment-id.generator';

// Regression coverage for the Phase 1 correction: ADMINISTRATION
// establishment IDs failed to generate ("Unknown entity type: ADMINISTRATION")
// because ENTITY_PREFIX only ever listed the original four entity types,
// even after Administration was wired up elsewhere (AST, DTO, Prisma,
// questionnaires.service.ts). This exercises generate()/isValid()/parse()
// for all six now-supported types, plus the explicit-failure path for an
// unrecognized type, against a mocked PrismaService (no live database).
// PROJECT_PROGRAM/'PP' was added in the Projects & Programs structural
// implementation phase — see establishment-id.generator.ts's ENTITY_PREFIX.
// VOCATIONAL_TRAINING/'VT' was added when VT company registration was found
// to throw "Unknown entity type: VOCATIONAL_TRAINING" (ENTITY_PREFIX had
// never been updated despite VT being wired up in AST/DTO/Prisma/
// questionnaires.service.ts).

/**
 * A $queryRaw mock answering the generator's two statements in order:
 * establishment_serial_ensure() -> the sequence name, then nextval() -> the
 * serial (a bigint, as Postgres returns it). Each call to generate() takes
 * one pair.
 */
function makePrisma(serial: number | Error = 1) {
  const queryRaw = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join('?');
    if (sql.includes('establishment_serial_ensure')) {
      const [prefix, yy] = values as string[];
      return [{ seq: `public.establishment_serial_${prefix.toLowerCase()}${yy}` }];
    }
    if (serial instanceof Error) throw serial;
    return [{ serial: BigInt(serial) }];
  });
  return { $queryRaw: queryRaw } as any;
}

/** The SQL text of the n-th $queryRaw call. */
const sqlOf = (prisma: any, n: number) => (prisma.$queryRaw.mock.calls[n][0] as string[]).join('?');

describe('EstablishmentIdGenerator', () => {
  const currentYear2 = new Date().getUTCFullYear().toString().slice(-2);

  it.each([
    ['ENTREPRISE', 'EN'],
    ['COOPERATIVE', 'CO'],
    ['CTD', 'CT'],
    ['ONG', 'ON'],
    ['ADMINISTRATION', 'AD'],
    ['PROJECT_PROGRAM', 'PP'],
    ['VOCATIONAL_TRAINING', 'VT'],
  ])('generates a first-serial ID for %s with prefix %s', async (entityType, prefix) => {
    const prisma = makePrisma(1);
    const id = await EstablishmentIdGenerator.generate(prisma, entityType, '12');
    expect(id).toBe(`${prefix}${currentYear2}000112`);
  });

  it('ensures the (prefix, UTC year) sequence, then takes nextval from it', async () => {
    const prisma = makePrisma(7);
    await EstablishmentIdGenerator.generate(prisma, 'ENTREPRISE', '12');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(sqlOf(prisma, 0)).toContain('establishment_serial_ensure');
    expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual(['EN', currentYear2]);
    expect(sqlOf(prisma, 1)).toContain('nextval');
    expect(prisma.$queryRaw.mock.calls[1].slice(1)).toEqual([`public.establishment_serial_en${currentYear2}`]);
  });

  it('takes no advisory lock and reads no company row', async () => {
    const prisma = makePrisma(1);
    await EstablishmentIdGenerator.generate(prisma, 'ENTREPRISE', '12');
    for (const call of prisma.$queryRaw.mock.calls) {
      expect((call[0] as string[]).join('?')).not.toMatch(/advisory|companies/);
    }
  });

  it('pads the serial to four digits and keeps the 10-character format', async () => {
    await expect(EstablishmentIdGenerator.generate(makePrisma(42), 'ADMINISTRATION', '12')).resolves.toBe(
      `AD${currentYear2}004212`,
    );
    const top = await EstablishmentIdGenerator.generate(makePrisma(9999), 'ENTREPRISE', '07');
    expect(top).toBe(`EN${currentYear2}999907`);
    expect(EstablishmentIdGenerator.isValid(top)).toBe(true);
  });

  it('pads or truncates the subdivision suffix to two characters', async () => {
    await expect(EstablishmentIdGenerator.generate(makePrisma(1), 'ENTREPRISE', '5')).resolves.toBe(
      `EN${currentYear2}000105`,
    );
    await expect(EstablishmentIdGenerator.generate(makePrisma(1), 'ENTREPRISE', '123')).resolves.toBe(
      `EN${currentYear2}000112`,
    );
  });

  it('is case-insensitive on entityType, matching the existing behaviour', async () => {
    for (const [entityType, prefix] of [
      ['administration', 'AD'],
      ['project_program', 'PP'],
      ['vocational_training', 'VT'],
    ]) {
      await expect(EstablishmentIdGenerator.generate(makePrisma(1), entityType, '05')).resolves.toBe(
        `${prefix}${currentYear2}000105`,
      );
    }
  });

  it('throws for an unrecognized or deprecated entity type before touching the database', async () => {
    for (const entityType of ['NOT_A_REAL_TYPE', 'VOCATIONAL_TRAINING_CENTER']) {
      const prisma = makePrisma();
      await expect(EstablishmentIdGenerator.generate(prisma, entityType, '12')).rejects.toThrow(
        `Unknown entity type: ${entityType}`,
      );
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    }
  });

  it('turns an exhausted sequence into a 409 with the fixed message', async () => {
    const exhausted = Object.assign(new Error('Raw query failed'), {
      code: 'P2010',
      meta: { code: '2200H', message: 'nextval: reached maximum value of sequence "establishment_serial_en26" (9999)' },
    });
    const error = await EstablishmentIdGenerator.generate(makePrisma(exhausted), 'ENTREPRISE', '12').catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.message).toBe(ESTABLISHMENT_ID_EXHAUSTED_MESSAGE);
  });

  it('rethrows any other database error unchanged', async () => {
    const other = new Error('connection reset');
    await expect(EstablishmentIdGenerator.generate(makePrisma(other), 'ENTREPRISE', '12')).rejects.toBe(other);
  });

  it('logs a warning from 90% usage on, and not before', async () => {
    const warn = jest.spyOn((EstablishmentIdGenerator as any).logger, 'warn').mockImplementation(() => undefined);
    try {
      await EstablishmentIdGenerator.generate(makePrisma(8999), 'ENTREPRISE', '12');
      expect(warn).not.toHaveBeenCalled();
      await EstablishmentIdGenerator.generate(makePrisma(9000), 'ENTREPRISE', '12');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('9000/9999');
    } finally {
      warn.mockRestore();
    }
  });

  describe('isValid', () => {
    it.each(['EN', 'CO', 'CT', 'ON', 'AD', 'PP', 'VT'])('accepts a well-formed %s-prefixed ID', (prefix) => {
      expect(EstablishmentIdGenerator.isValid(`${prefix}26000112`)).toBe(true);
    });

    it('rejects a prefix outside the known types', () => {
      expect(EstablishmentIdGenerator.isValid('XX26000112')).toBe(false);
    });
  });

  describe('parse', () => {
    it('round-trips an ADMINISTRATION ID the same way as the existing four types', () => {
      const parsed = EstablishmentIdGenerator.parse('AD26000112');
      expect(parsed).toEqual({
        prefix: 'AD',
        entityType: 'ADMINISTRATION',
        year: '2026',
        serial: 1,
        subdivisionCode: '12',
      });
    });

    it('round-trips a PROJECT_PROGRAM ID', () => {
      const parsed = EstablishmentIdGenerator.parse('PP26000112');
      expect(parsed).toEqual({
        prefix: 'PP',
        entityType: 'PROJECT_PROGRAM',
        year: '2026',
        serial: 1,
        subdivisionCode: '12',
      });
    });

    it('round-trips a VOCATIONAL_TRAINING ID', () => {
      const parsed = EstablishmentIdGenerator.parse('VT26000112');
      expect(parsed).toEqual({
        prefix: 'VT',
        entityType: 'VOCATIONAL_TRAINING',
        year: '2026',
        serial: 1,
        subdivisionCode: '12',
      });
    });

    it('still round-trips the four pre-existing entity types', () => {
      expect(EstablishmentIdGenerator.parse('EN26000112')?.entityType).toBe('ENTREPRISE');
      expect(EstablishmentIdGenerator.parse('CO26000112')?.entityType).toBe('COOPERATIVE');
      expect(EstablishmentIdGenerator.parse('CT26000112')?.entityType).toBe('CTD');
      expect(EstablishmentIdGenerator.parse('ON26000112')?.entityType).toBe('ONG');
    });
  });
});
