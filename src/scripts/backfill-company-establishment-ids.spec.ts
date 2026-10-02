const { runBackfill } = require('../../scripts/backfill-company-establishment-ids');
import { EstablishmentIdGenerator } from '../common/utils/establishment-id.generator';

jest.mock('../common/utils/establishment-id.generator');

describe('backfill-company-establishment-ids script', () => {
  let mockPrisma: any;
  let mockTx: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ establishmentId: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      establishment: {
        create: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockPrisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'actor-1',
          email: 'admin@minefop.gov.cm',
          firstName: 'Super',
          lastName: 'Admin',
          role: 'SUPER_ADMIN',
          isActive: true,
          status: 'ACTIVE',
        }),
      },
      company: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'comp-1',
            name: 'Société Camerounaise de Bois',
            entityType: 'ENTREPRISE',
            regionId: 'reg-lt',
            departmentId: 'dept-wouri',
            subdivisionId: 'sub-dla1',
            region: 'Littoral',
            department: 'Wouri',
            subdivision: 'Douala 1er',
            address: 'Rue Joss, Bonanjo',
            phone: '+237699001122',
            userId: 'user-1',
            user: { email: 'contact@scb.cm' },
          },
        ]),
      },
      subdivision: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'sub-dla1', code: '5801', name: 'Douala 1er' },
        ]),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    (EstablishmentIdGenerator.generate as jest.Mock).mockResolvedValue('EN26000101');
  });

  it('in --apply mode: generates establishment ID and creates the principal establishment (-01)', async () => {
    const result = await runBackfill(mockPrisma, {
      actorEmail: 'admin@minefop.gov.cm',
      isApply: true,
    });

    expect(result.issued).toHaveLength(1);
    expect(result.issued[0]).toEqual({
      companyId: 'comp-1',
      name: 'Société Camerounaise de Bois',
      establishmentId: 'EN26000101',
    });

    // Company is updated with establishmentId
    expect(mockTx.company.update).toHaveBeenCalledWith({
      where: { id: 'comp-1' },
      data: expect.objectContaining({
        establishmentId: 'EN26000101',
      }),
    });

    // Principal establishment is minted
    expect(mockTx.establishment.create).toHaveBeenCalledWith({
      data: {
        code: 'EN26000101-01',
        name: 'Société Camerounaise de Bois',
        isPrincipal: true,
        status: 'ACTIVE',
        companyId: 'comp-1',
        regionId: 'reg-lt',
        departmentId: 'dept-wouri',
        subdivisionId: 'sub-dla1',
        region: 'Littoral',
        department: 'Wouri',
        subdivision: 'Douala 1er',
        address: 'Rue Joss, Bonanjo',
        phone: '+237699001122',
        email: 'contact@scb.cm',
      },
    });

    // Audit log is created
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'actor-1',
          action: 'COMPANY_ESTABLISHMENT_ID_BACKFILLED',
          resourceType: 'Company',
          resourceId: 'comp-1',
        }),
      }),
    );
  });

  it('uses default fallback values when company optional fields are empty', async () => {
    mockPrisma.company.findMany.mockResolvedValue([
      {
        id: 'comp-2',
        name: '',
        entityType: 'ENTREPRISE',
        regionId: null,
        departmentId: null,
        subdivisionId: 'sub-dla1',
        region: null,
        department: null,
        subdivision: null,
        address: null,
        phone: null,
        userId: 'user-2',
        user: { email: '' },
      },
    ]);

    await runBackfill(mockPrisma, {
      actorEmail: 'admin@minefop.gov.cm',
      isApply: true,
    });

    expect(mockTx.establishment.create).toHaveBeenCalledWith({
      data: {
        code: 'EN26000101-01',
        name: 'Siège Principal',
        isPrincipal: true,
        status: 'ACTIVE',
        companyId: 'comp-2',
        regionId: '',
        departmentId: '',
        subdivisionId: 'sub-dla1',
        region: '',
        department: '',
        subdivision: '',
        address: '',
        phone: null,
        email: null,
      },
    });
  });

  it('in DRY-RUN mode: lists candidates without executing write transaction', async () => {
    const result = await runBackfill(mockPrisma, {
      actorEmail: 'admin@minefop.gov.cm',
      isApply: false,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.issued).toHaveLength(0);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockTx.establishment.create).not.toHaveBeenCalled();
  });

  it('skips company if establishmentId was issued concurrently', async () => {
    mockTx.company.findUnique.mockResolvedValue({
      establishmentId: 'ALREADY_ISSUED',
    });

    const result = await runBackfill(mockPrisma, {
      actorEmail: 'admin@minefop.gov.cm',
      isApply: true,
    });

    expect(result.issued).toHaveLength(0);
    expect(EstablishmentIdGenerator.generate).not.toHaveBeenCalled();
    expect(mockTx.company.update).not.toHaveBeenCalled();
    expect(mockTx.establishment.create).not.toHaveBeenCalled();
  });
});
