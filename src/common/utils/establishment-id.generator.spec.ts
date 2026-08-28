import { EstablishmentIdGenerator } from './establishment-id.generator';

// Regression coverage for the Phase 1 correction: ADMINISTRATION
// establishment IDs failed to generate ("Unknown entity type: ADMINISTRATION")
// because ENTITY_PREFIX only ever listed the original four entity types,
// even after Administration was wired up elsewhere (AST, DTO, Prisma,
// questionnaires.service.ts). This exercises generate()/isValid()/parse()
// for all five now-supported types, plus the explicit-failure path for an
// unrecognized type, against a mocked PrismaService (no live database).

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

  it('still throws explicitly for an unrecognized entity type (e.g. PROJECT_PROGRAM)', async () => {
    const prisma = makePrisma();
    await expect(
      EstablishmentIdGenerator.generate(prisma, 'PROJECT_PROGRAM', '12'),
    ).rejects.toThrow('Unknown entity type: PROJECT_PROGRAM');
    expect(prisma.company.findFirst).not.toHaveBeenCalled();
  });

  describe('isValid', () => {
    it.each(['EN', 'CO', 'CT', 'ON', 'AD'])('accepts a well-formed %s-prefixed ID', (prefix) => {
      expect(EstablishmentIdGenerator.isValid(`${prefix}26000112`)).toBe(true);
    });

    it('rejects a prefix outside the five known types', () => {
      expect(EstablishmentIdGenerator.isValid('PP26000112')).toBe(false);
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

    it('still round-trips the four pre-existing entity types', () => {
      expect(EstablishmentIdGenerator.parse('EN26000112')?.entityType).toBe('ENTREPRISE');
      expect(EstablishmentIdGenerator.parse('CO26000112')?.entityType).toBe('COOPERATIVE');
      expect(EstablishmentIdGenerator.parse('CT26000112')?.entityType).toBe('CTD');
      expect(EstablishmentIdGenerator.parse('ON26000112')?.entityType).toBe('ONG');
    });
  });
});
