import { EstablishmentIdGenerator } from './establishment-id.generator';

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
// VOCATIONAL_TRAINING_CENTER/'VC' was added 2026-08-31 after production
// logs showed registerCompany throwing "Unknown entity type:
// VOCATIONAL_TRAINING_CENTER" — this is the unrelated, DSMO-only, no-ONEFOP-
// questionnaire entity type (EntityType.vocationalCenter in
// minefop_models.dart), which had never been wired into ENTITY_PREFIX or the
// Company.entityType Prisma enum at all.

function makePrisma(lastEstablishmentId: string | null = null) {
  return {
    company: {
      findFirst: jest.fn().mockResolvedValue(
        lastEstablishmentId ? { establishmentId: lastEstablishmentId } : null,
      ),
    },
  } as any;
}

describe('EstablishmentIdGenerator', () => {
  const currentYear2 = new Date().getFullYear().toString().slice(-2);

  it.each([
    ['ENTREPRISE', 'EN'],
    ['COOPERATIVE', 'CO'],
    ['CTD', 'CT'],
    ['ONG', 'ON'],
    ['ADMINISTRATION', 'AD'],
    ['PROJECT_PROGRAM', 'PP'],
    ['VOCATIONAL_TRAINING', 'VT'],
    ['VOCATIONAL_TRAINING_CENTER', 'VC'],
  ])('generates a first-serial ID for %s with prefix %s', async (entityType, prefix) => {
    const prisma = makePrisma();
    const id = await EstablishmentIdGenerator.generate(prisma, entityType, '12');
    expect(id).toBe(`${prefix}${currentYear2}000112`);
    expect(prisma.company.findFirst).toHaveBeenCalledWith({
      where: { establishmentId: { startsWith: `${prefix}${currentYear2}` } },
      orderBy: { establishmentId: 'desc' },
    });
  });

  it('is case-insensitive on entityType, matching the existing four-type behavior', async () => {
    const prisma = makePrisma();
    const id = await EstablishmentIdGenerator.generate(prisma, 'administration', '05');
    expect(id).toBe(`AD${currentYear2}000105`);
  });

  it('increments the serial for ADMINISTRATION the same way as the existing four types', async () => {
    const prisma = makePrisma(`AD${currentYear2}000312`);
    const id = await EstablishmentIdGenerator.generate(prisma, 'ADMINISTRATION', '12');
    expect(id).toBe(`AD${currentYear2}000412`);
  });

  it('still throws explicitly for an unrecognized entity type', async () => {
    const prisma = makePrisma();
    await expect(
      EstablishmentIdGenerator.generate(prisma, 'NOT_A_REAL_TYPE', '12'),
    ).rejects.toThrow('Unknown entity type: NOT_A_REAL_TYPE');
    expect(prisma.company.findFirst).not.toHaveBeenCalled();
  });

  it('is case-insensitive on PROJECT_PROGRAM, matching the existing behavior', async () => {
    const prisma = makePrisma();
    const id = await EstablishmentIdGenerator.generate(prisma, 'project_program', '05');
    expect(id).toBe(`PP${currentYear2}000105`);
  });

  it('is case-insensitive on VOCATIONAL_TRAINING, matching the existing behavior', async () => {
    const prisma = makePrisma();
    const id = await EstablishmentIdGenerator.generate(prisma, 'vocational_training', '05');
    expect(id).toBe(`VT${currentYear2}000105`);
  });

  it('increments the serial for VOCATIONAL_TRAINING the same way as the existing types', async () => {
    const prisma = makePrisma(`VT${currentYear2}000312`);
    const id = await EstablishmentIdGenerator.generate(prisma, 'VOCATIONAL_TRAINING', '12');
    expect(id).toBe(`VT${currentYear2}000412`);
  });

  it('is case-insensitive on VOCATIONAL_TRAINING_CENTER, matching the existing behavior', async () => {
    const prisma = makePrisma();
    const id = await EstablishmentIdGenerator.generate(prisma, 'vocational_training_center', '05');
    expect(id).toBe(`VC${currentYear2}000105`);
  });

  it('increments the serial for VOCATIONAL_TRAINING_CENTER the same way as the existing types', async () => {
    const prisma = makePrisma(`VC${currentYear2}000312`);
    const id = await EstablishmentIdGenerator.generate(prisma, 'VOCATIONAL_TRAINING_CENTER', '12');
    expect(id).toBe(`VC${currentYear2}000412`);
  });

  describe('isValid', () => {
    it.each(['EN', 'CO', 'CT', 'ON', 'AD', 'PP', 'VT', 'VC'])('accepts a well-formed %s-prefixed ID', (prefix) => {
      expect(EstablishmentIdGenerator.isValid(`${prefix}26000112`)).toBe(true);
    });

    it('rejects a prefix outside the eight known types', () => {
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

    it('round-trips a VOCATIONAL_TRAINING_CENTER ID', () => {
      const parsed = EstablishmentIdGenerator.parse('VC26000112');
      expect(parsed).toEqual({
        prefix: 'VC',
        entityType: 'VOCATIONAL_TRAINING_CENTER',
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
