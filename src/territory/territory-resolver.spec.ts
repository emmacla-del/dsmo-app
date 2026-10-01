import { BadRequestException } from '@nestjs/common';
import {
  resolveAndValidateTerritory,
  resolveStaffTerritory,
  normalizeTerritoryName,
  TxOrPrisma,
} from './territory-resolver';

describe('TerritoryResolver', () => {
  const mockRegions = [
    { id: 'reg-centre', name: 'Centre' },
    { id: 'reg-littoral', name: 'Littoral' },
    { id: 'reg-extreme-nord', name: 'Extrême-Nord' },
  ];

  const mockDepartments = [
    { id: 'dept-mfoundi', name: 'Mfoundi', regionId: 'reg-centre', region: { id: 'reg-centre', name: 'Centre' } },
    { id: 'dept-mbam-inoubou', name: 'Mbam-et-Inoubou', regionId: 'reg-centre', region: { id: 'reg-centre', name: 'Centre' } },
    { id: 'dept-wouri', name: 'Wouri', regionId: 'reg-littoral', region: { id: 'reg-littoral', name: 'Littoral' } },
    { id: 'dept-diamare', name: 'Diamaré', regionId: 'reg-extreme-nord', region: { id: 'reg-extreme-nord', name: 'Extrême-Nord' } },
  ];

  const mockSubdivisions = [
    {
      id: 'sub-yaounde-1',
      name: 'Yaoundé 1er',
      departmentId: 'dept-mfoundi',
      department: { id: 'dept-mfoundi', name: 'Mfoundi' },
    },
    {
      id: 'sub-douala-1',
      name: 'Douala 1er',
      departmentId: 'dept-wouri',
      department: { id: 'dept-wouri', name: 'Wouri' },
    },
    {
      id: 'sub-maroua-1',
      name: 'Maroua 1er',
      departmentId: 'dept-diamare',
      department: { id: 'dept-diamare', name: 'Diamaré' },
    },
  ];

  let mockPrisma: TxOrPrisma;

  beforeEach(() => {
    mockPrisma = {
      region: {
        findUnique: jest.fn(async ({ where }: any) => mockRegions.find(r => r.id === where.id) || null),
        findMany: jest.fn(async () => mockRegions),
      } as any,
      department: {
        findUnique: jest.fn(async ({ where }: any) => mockDepartments.find(d => d.id === where.id) || null),
        findMany: jest.fn(async ({ where }: any) =>
          mockDepartments.filter(d => !where?.regionId || d.regionId === where.regionId),
        ),
        findFirst: jest.fn(async ({ where }: any) => {
          const name = where?.name?.equals;
          return (
            mockDepartments.find(
              d => d.name.toLowerCase() === (name?.toLowerCase() || ''),
            ) || null
          );
        }),
      } as any,
      subdivision: {
        findUnique: jest.fn(async ({ where }: any) => mockSubdivisions.find(s => s.id === where.id) || null),
        findMany: jest.fn(async ({ where }: any) =>
          mockSubdivisions.filter(s => !where?.departmentId || s.departmentId === where.departmentId),
        ),
        findFirst: jest.fn(async ({ where }: any) => {
          const name = where?.name?.equals;
          return (
            mockSubdivisions.find(
              s => s.name.toLowerCase() === (name?.toLowerCase() || ''),
            ) || null
          );
        }),
      } as any,
    };
  });

  describe('normalizeTerritoryName', () => {
    it('normalizes accents, casing, and hyphens', () => {
      expect(normalizeTerritoryName('Extrême-Nord')).toBe('extreme nord');
      expect(normalizeTerritoryName('  Mbam-et-Inoubou  ')).toBe('mbam et inoubou');
      expect(normalizeTerritoryName("Yaoundé 1'er")).toBe('yaounde 1 er');
      expect(normalizeTerritoryName('LITTORAL')).toBe('littoral');
    });
  });

  describe('valid chains', () => {
    it('resolves valid chain using IDs', async () => {
      const result = await resolveAndValidateTerritory(mockPrisma, {
        regionId: 'reg-centre',
        departmentId: 'dept-mfoundi',
        subdivisionId: 'sub-yaounde-1',
      });

      expect(result).toEqual({
        regionId: 'reg-centre',
        departmentId: 'dept-mfoundi',
        subdivisionId: 'sub-yaounde-1',
        region: 'Centre',
        department: 'Mfoundi',
        subdivision: 'Yaoundé 1er',
      });
    });

    it('resolves valid chain using canonical text names', async () => {
      const result = await resolveAndValidateTerritory(mockPrisma, {
        region: 'Centre',
        department: 'Mfoundi',
        subdivision: 'Yaoundé 1er',
      });

      expect(result).toEqual({
        regionId: 'reg-centre',
        departmentId: 'dept-mfoundi',
        subdivisionId: 'sub-yaounde-1',
        region: 'Centre',
        department: 'Mfoundi',
        subdivision: 'Yaoundé 1er',
      });
    });

    it('resolves valid chain without optional subdivision', async () => {
      const result = await resolveAndValidateTerritory(mockPrisma, {
        regionId: 'reg-littoral',
        departmentId: 'dept-wouri',
      });

      expect(result).toEqual({
        regionId: 'reg-littoral',
        departmentId: 'dept-wouri',
        subdivisionId: null,
        region: 'Littoral',
        department: 'Wouri',
        subdivision: null,
      });
    });
  });

  describe('accent and case variants', () => {
    it('resolves text with missing accents and uppercase', async () => {
      const result = await resolveAndValidateTerritory(mockPrisma, {
        region: 'EXTREME-NORD',
        department: 'diamare',
        subdivision: 'maroua 1er',
      });

      expect(result).toEqual({
        regionId: 'reg-extreme-nord',
        departmentId: 'dept-diamare',
        subdivisionId: 'sub-maroua-1',
        region: 'Extrême-Nord',
        department: 'Diamaré',
        subdivision: 'Maroua 1er',
      });
    });
  });

  describe('hierarchy mismatches', () => {
    it('rejects department that does not belong to the region (ID-based)', async () => {
      await expect(
        resolveAndValidateTerritory(mockPrisma, {
          regionId: 'reg-centre',
          departmentId: 'dept-wouri', // Wouri is in Littoral, not Centre
        }),
      ).rejects.toThrow(
        new BadRequestException("Le département 'Wouri' n'appartient pas à la région 'Centre'."),
      );
    });

    it('rejects department that does not belong to the region (text-based)', async () => {
      await expect(
        resolveAndValidateTerritory(mockPrisma, {
          region: 'Extrême-Nord',
          department: 'Mbam-et-Inoubou', // In Centre
        }),
      ).rejects.toThrow(
        new BadRequestException(
          "Le département 'Mbam-et-Inoubou' n'appartient pas à la région 'Extrême-Nord' (il appartient à la région 'Centre').",
        ),
      );
    });

    it('rejects subdivision that does not belong to the department (ID-based)', async () => {
      await expect(
        resolveAndValidateTerritory(mockPrisma, {
          regionId: 'reg-centre',
          departmentId: 'dept-mfoundi',
          subdivisionId: 'sub-douala-1', // In Wouri, not Mfoundi
        }),
      ).rejects.toThrow(
        new BadRequestException(
          "L'arrondissement 'Douala 1er' n'appartient pas au département 'Mfoundi'.",
        ),
      );
    });

    it('rejects subdivision that does not belong to the department (text-based)', async () => {
      await expect(
        resolveAndValidateTerritory(mockPrisma, {
          region: 'Centre',
          department: 'Mfoundi',
          subdivision: 'Douala 1er', // In Wouri
        }),
      ).rejects.toThrow(
        new BadRequestException(
          "L'arrondissement 'Douala 1er' n'appartient pas au département 'Mfoundi' (il appartient au département 'Wouri').",
        ),
      );
    });
  });

  describe('unknown names and missing fields', () => {
    it('rejects unknown region name', async () => {
      await expect(
        resolveAndValidateTerritory(mockPrisma, {
          region: 'Atlantique',
          department: 'Mfoundi',
        }),
      ).rejects.toThrow(new BadRequestException("Région inconnue : 'Atlantique'."));
    });

    it('rejects unknown department name', async () => {
      await expect(
        resolveAndValidateTerritory(mockPrisma, {
          region: 'Centre',
          department: 'InconnuDept',
        }),
      ).rejects.toThrow(new BadRequestException("Département inconnu : 'InconnuDept'."));
    });

    it('rejects unknown subdivision name', async () => {
      await expect(
        resolveAndValidateTerritory(mockPrisma, {
          region: 'Centre',
          department: 'Mfoundi',
          subdivision: 'InconnuArr',
        }),
      ).rejects.toThrow(new BadRequestException("Arrondissement inconnu : 'InconnuArr'."));
    });

    it('rejects missing region', async () => {
      await expect(
        resolveAndValidateTerritory(mockPrisma, {
          department: 'Mfoundi',
        }),
      ).rejects.toThrow(new BadRequestException('La région est obligatoire.'));
    });

    it('rejects missing department', async () => {
      await expect(
        resolveAndValidateTerritory(mockPrisma, {
          region: 'Centre',
        }),
      ).rejects.toThrow(new BadRequestException('Le département est obligatoire.'));
    });

    it('rejects missing subdivision when requireSubdivision is true', async () => {
      await expect(
        resolveAndValidateTerritory(
          mockPrisma,
          {
            region: 'Centre',
            department: 'Mfoundi',
          },
          { requireSubdivision: true },
        ),
      ).rejects.toThrow(new BadRequestException("L'arrondissement est obligatoire."));
    });
  });

  describe('resolveStaffTerritory', () => {
    it('resolves REGIONAL staff territory with canonical name and null department', async () => {
      const res = await resolveStaffTerritory(mockPrisma, 'REGIONAL', {
        region: 'centre',
        department: 'anything',
      });
      expect(res).toEqual({
        region: 'Centre',
        department: null,
      });
    });

    it('rejects REGIONAL staff missing region', async () => {
      await expect(
        resolveStaffTerritory(mockPrisma, 'REGIONAL', { region: '' }),
      ).rejects.toThrow('Les utilisateurs régionaux doivent avoir une région assignée');
    });

    it('resolves DIVISIONAL staff territory with canonical names', async () => {
      const res = await resolveStaffTerritory(mockPrisma, 'DIVISIONAL', {
        region: 'littoral',
        department: 'wouri',
      });
      expect(res).toEqual({
        region: 'Littoral',
        department: 'Wouri',
      });
    });

    it('rejects DIVISIONAL staff missing department', async () => {
      await expect(
        resolveStaffTerritory(mockPrisma, 'DIVISIONAL', { region: 'Centre', department: '' }),
      ).rejects.toThrow('Les utilisateurs divisionnaires doivent avoir une région et un département assignés');
    });

    it('rejects DIVISIONAL staff with cross-region department mismatch', async () => {
      await expect(
        resolveStaffTerritory(mockPrisma, 'DIVISIONAL', { region: 'Centre', department: 'Wouri' }),
      ).rejects.toThrow("Le département 'Wouri' n'appartient pas à la région 'Centre' (il appartient à la région 'Littoral').");
    });

    it('clears territory for non-territorial staff (e.g. CENTRAL)', async () => {
      const res = await resolveStaffTerritory(mockPrisma, 'CENTRAL', {
        region: 'Centre',
        department: 'Mfoundi',
      });
      expect(res).toEqual({
        region: null,
        department: null,
      });
    });
  });
});

