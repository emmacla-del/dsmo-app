import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../dsmo/notification.service';

describe('CampaignService - reference period and lateness gating', () => {
    let service: CampaignService;
    let prisma: {
        dataCampaign: {
            findFirst: jest.Mock;
            findUnique: jest.Mock;
            findMany: jest.Mock;
            create: jest.Mock;
            update: jest.Mock;
            delete: jest.Mock;
        };
        campaignSubmission: {
            groupBy: jest.Mock;
        };
        submissionRound: {
            findUnique: jest.Mock;
            updateMany: jest.Mock;
        };
        $transaction: jest.Mock;
    };
    let notificationService: Partial<NotificationService>;

    beforeEach(() => {
        prisma = {
            dataCampaign: {
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
            campaignSubmission: {
                groupBy: jest.fn().mockResolvedValue([]),
            },
            submissionRound: {
                findUnique: jest.fn(),
                updateMany: jest.fn(),
            },
            $transaction: jest.fn((cb: any) => typeof cb === 'function' ? cb(prisma) : Promise.all(cb)),
        };
        notificationService = {};
        service = new CampaignService(prisma as unknown as PrismaService, notificationService as NotificationService);
        jest.spyOn(service, 'activateCampaign').mockImplementation(async (id: string) => ({ id, status: 'ACTIVE' } as any));
    });

    describe('createCampaign - ONEFOP reference period validation', () => {
        it('throws 400 when referenceYear is missing for ONEFOP', async () => {
            await expect(
                service.createCampaign({
                    collectionType: 'ONEFOP',
                    type: 'QUARTERLY',
                    startDate: '2026-10-01',
                    deadline: '2026-11-30',
                    referenceQuarter: 3,
                }),
            ).rejects.toThrow(
                new BadRequestException("L'année de référence est obligatoire pour les campagnes ONEFOP (ex: 2026)."),
            );
        });

        it('throws 400 when referenceQuarter is missing for ONEFOP', async () => {
            await expect(
                service.createCampaign({
                    collectionType: 'ONEFOP',
                    type: 'QUARTERLY',
                    startDate: '2026-10-01',
                    deadline: '2026-11-30',
                    referenceYear: 2026,
                }),
            ).rejects.toThrow(
                new BadRequestException("Le trimestre de référence est obligatoire pour les campagnes ONEFOP (valeur entre 1 et 4)."),
            );
        });

        it('throws 400 when referenceQuarter is out of range (< 1 or > 4)', async () => {
            await expect(
                service.createCampaign({
                    collectionType: 'ONEFOP',
                    type: 'QUARTERLY',
                    startDate: '2026-10-01',
                    deadline: '2026-11-30',
                    referenceYear: 2026,
                    referenceQuarter: 5,
                }),
            ).rejects.toThrow(
                new BadRequestException("Le trimestre de référence est obligatoire pour les campagnes ONEFOP (valeur entre 1 et 4)."),
            );
        });

        it('throws 409 ConflictException when an active ONEFOP campaign already exists for that period', async () => {
            prisma.dataCampaign.findFirst.mockResolvedValue({
                id: 'existing-1',
                code: 'QUARTERLY_2026_T3_001',
            });

            await expect(
                service.createCampaign({
                    collectionType: 'ONEFOP',
                    type: 'QUARTERLY',
                    startDate: '2026-10-01',
                    deadline: '2026-11-30',
                    referenceYear: 2026,
                    referenceQuarter: 3,
                }),
            ).rejects.toThrow(
                new ConflictException('Une campagne ONEFOP existe déjà pour la période 2026-T3 (campagne QUARTERLY_2026_T3_001).'),
            );

            expect(prisma.dataCampaign.findFirst).toHaveBeenCalledWith({
                where: {
                    collectionType: 'ONEFOP',
                    referenceYear: 2026,
                    referenceQuarter: 3,
                    status: { not: 'ARCHIVED' },
                },
                select: { code: true },
            });
        });

        it('allows creation when a conflicting ONEFOP campaign is ARCHIVED (findFirst returns null)', async () => {
            prisma.dataCampaign.findFirst.mockResolvedValue(null);
            prisma.dataCampaign.findUnique.mockResolvedValue(null);
            prisma.submissionRound.findUnique.mockResolvedValue(null);
            prisma.dataCampaign.create.mockResolvedValue({ id: 'c-new', code: 'QUARTERLY_2026_T3_001' });

            const result = await service.createCampaign({
                collectionType: 'ONEFOP',
                type: 'QUARTERLY',
                startDate: '2026-10-01',
                deadline: '2026-11-30',
                referenceYear: 2026,
                referenceQuarter: 3,
                createdBy: 'user-1',
            });

            expect(result).toBeDefined();
            expect(prisma.dataCampaign.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        collectionType: 'ONEFOP',
                        referenceYear: 2026,
                        referenceQuarter: 3,
                    }),
                }),
            );
        });

        it('derives ONEFOP code and suffix from referenceYear/referenceQuarter instead of startDate', async () => {
            prisma.dataCampaign.findFirst.mockResolvedValue(null);
            prisma.dataCampaign.findUnique.mockResolvedValue(null);
            prisma.submissionRound.findUnique.mockResolvedValue(null);
            prisma.dataCampaign.create.mockImplementation(async ({ data }) => ({ id: 'c-new', ...data }));

            // startDate is in October (Q4), but reference period is 2026 T3
            await service.createCampaign({
                collectionType: 'ONEFOP',
                type: 'QUARTERLY',
                startDate: '2026-10-15',
                deadline: '2026-12-31',
                referenceYear: 2026,
                referenceQuarter: 3,
                createdBy: 'user-1',
            });

            const createCall = prisma.dataCampaign.create.mock.calls[0][0];
            expect(createCall.data.code).toMatch(/^QUARTERLY_2026_T3_\d{3}$/);
            expect(createCall.data.name).toContain('POUR LE TROISIEME TRIMESTRE 2026');
            expect(createCall.data.referenceYear).toBe(2026);
            expect(createCall.data.referenceQuarter).toBe(3);
        });
    });

    describe('createCampaign - DSMO behavior', () => {
        it('allows creating DSMO campaign without reference period and derives from startDate', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue(null);
            prisma.submissionRound.findUnique.mockResolvedValue(null);
            prisma.dataCampaign.create.mockImplementation(async ({ data }) => ({ id: 'c-dsmo', ...data }));

            await service.createCampaign({
                collectionType: 'DSMO',
                type: 'QUARTERLY',
                startDate: '2026-10-15',
                deadline: '2026-12-31',
                createdBy: 'user-1',
            });

            const createCall = prisma.dataCampaign.create.mock.calls[0][0];
            // DSMO uses startDate (October -> Q4)
            expect(createCall.data.code).toMatch(/^QUARTERLY_2026_T4_\d{3}$/);
            expect(createCall.data.name).toContain('POUR LE QUATRIEME TRIMESTRE 2026');
            expect(createCall.data.referenceYear).toBeUndefined();
            expect(createCall.data.referenceQuarter).toBeUndefined();
        });
    });

    describe('updateCampaign - reference period immutability', () => {
        it('throws 400 when attempting to update referenceYear', async () => {
            await expect(
                service.updateCampaign('c-1', { referenceYear: 2027 }),
            ).rejects.toThrow(
                new BadRequestException('La période de référence (année et trimestre) ne peut pas être modifiée après création.'),
            );
        });

        it('throws 400 when attempting to update referenceQuarter', async () => {
            await expect(
                service.updateCampaign('c-1', { referenceQuarter: 4 }),
            ).rejects.toThrow(
                new BadRequestException('La période de référence (année et trimestre) ne peut pas être modifiée après création.'),
            );
        });

        it('allows updating other fields without changing reference period', async () => {
            prisma.dataCampaign.update.mockResolvedValue({
                id: 'c-1',
                name: 'Campaign 1',
                description: 'Updated desc',
                targetRegions: [],
                targetEntityTypes: [],
            });
            prisma.submissionRound.updateMany.mockResolvedValue({ count: 1 });

            const result = await service.updateCampaign('c-1', { description: 'Updated desc' });
            expect(result).toBeDefined();
            expect(prisma.dataCampaign.update).toHaveBeenCalledWith({
                where: { id: 'c-1' },
                data: expect.objectContaining({ description: 'Updated desc' }),
            });
        });
    });

    describe('CampaignService.deleteCampaign - 409 Conflict gating and atomic deletion', () => {
        it('throws 404 NotFoundException when campaign does not exist', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue(null);

            await expect(service.deleteCampaign('non-existent')).rejects.toThrow(
                new NotFoundException('Campagne introuvable'),
            );
        });

        it('throws 409 ConflictException when campaign status is ACTIVE', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-active',
                name: 'Campagne Active',
                status: 'ACTIVE',
                _count: {
                    submissions: 0,
                    onefopSubmissions: 0,
                    declarations: 0,
                    quotas: 0,
                    freezes: 0,
                },
            });

            await expect(service.deleteCampaign('c-active')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Campagne Active" : son statut est "ACTIVE". Seules les campagnes à l\'état DRAFT peuvent être supprimées. Veuillez l\'archiver.',
                ),
            );
        });

        it('throws 409 ConflictException when campaign status is PAUSED', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-paused',
                name: 'Campagne En Pause',
                status: 'PAUSED',
                _count: {
                    submissions: 0,
                    onefopSubmissions: 0,
                    declarations: 0,
                    quotas: 0,
                    freezes: 0,
                },
            });

            await expect(service.deleteCampaign('c-paused')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Campagne En Pause" : son statut est "PAUSED". Seules les campagnes à l\'état DRAFT peuvent être supprimées. Veuillez l\'archiver.',
                ),
            );
        });

        it('throws 409 ConflictException when campaign status is CLOSED', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-closed',
                name: 'Campagne Clôturée',
                status: 'CLOSED',
                _count: {
                    submissions: 0,
                    onefopSubmissions: 0,
                    declarations: 0,
                    quotas: 0,
                    freezes: 0,
                },
            });

            await expect(service.deleteCampaign('c-closed')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Campagne Clôturée" : son statut est "CLOSED". Seules les campagnes à l\'état DRAFT peuvent être supprimées. Veuillez l\'archiver.',
                ),
            );
        });

        it('throws 409 ConflictException when campaign status is ARCHIVED', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-archived',
                name: 'Campagne Archivée',
                status: 'ARCHIVED',
                _count: {
                    submissions: 0,
                    onefopSubmissions: 0,
                    declarations: 0,
                    quotas: 0,
                    freezes: 0,
                },
            });

            await expect(service.deleteCampaign('c-archived')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Campagne Archivée" : son statut est "ARCHIVED". Seules les campagnes à l\'état DRAFT peuvent être supprimées. Veuillez l\'archiver.',
                ),
            );
        });

        it('throws 409 ConflictException when campaign has linked CampaignSubmission rows', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-draft-1',
                name: 'Brouillon avec soumissions',
                status: 'DRAFT',
                _count: {
                    submissions: 5,
                    onefopSubmissions: 0,
                    declarations: 0,
                    quotas: 0,
                    freezes: 0,
                },
            });

            await expect(service.deleteCampaign('c-draft-1')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Brouillon avec soumissions" : des données liées existent (5 soumission(s) de campagne).',
                ),
            );
        });

        it('throws 409 ConflictException when campaign has linked OnefopSubmission rows', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-draft-2',
                name: 'Brouillon avec retours ONEFOP',
                status: 'DRAFT',
                _count: {
                    submissions: 0,
                    onefopSubmissions: 3,
                    declarations: 0,
                    quotas: 0,
                    freezes: 0,
                },
            });

            await expect(service.deleteCampaign('c-draft-2')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Brouillon avec retours ONEFOP" : des données liées existent (3 soumission(s) ONEFOP).',
                ),
            );
        });

        it('throws 409 ConflictException when campaign has linked Declaration rows', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-draft-3',
                name: 'Brouillon avec DSMO',
                status: 'DRAFT',
                _count: {
                    submissions: 0,
                    onefopSubmissions: 0,
                    declarations: 2,
                    quotas: 0,
                    freezes: 0,
                },
            });

            await expect(service.deleteCampaign('c-draft-3')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Brouillon avec DSMO" : des données liées existent (2 déclaration(s) DSMO).',
                ),
            );
        });

        it('throws 409 ConflictException when campaign has linked CampaignQuota rows', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-draft-4',
                name: 'Brouillon avec quotas territoriaux',
                status: 'DRAFT',
                _count: {
                    submissions: 0,
                    onefopSubmissions: 0,
                    declarations: 0,
                    quotas: 4,
                    freezes: 0,
                },
            });

            await expect(service.deleteCampaign('c-draft-4')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Brouillon avec quotas territoriaux" : des données liées existent (4 quota(s) territorial(aux)).',
                ),
            );
        });

        it('throws 409 ConflictException when campaign has linked CampaignFreeze rows', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-draft-6',
                name: 'Brouillon avec gels',
                status: 'DRAFT',
                _count: {
                    submissions: 0,
                    onefopSubmissions: 0,
                    declarations: 0,
                    quotas: 0,
                    freezes: 1,
                },
            });

            await expect(service.deleteCampaign('c-draft-6')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Brouillon avec gels" : des données liées existent (1 gel(s) statistique(s)).',
                ),
            );
        });

        it('multi-blocker test: collects ALL blockers into a single 409 ConflictException message', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-draft-multi',
                name: 'Brouillon Multi-Bloqué',
                status: 'DRAFT',
                _count: {
                    submissions: 10,
                    onefopSubmissions: 4,
                    declarations: 2,
                    quotas: 6,
                    freezes: 1,
                },
            });

            await expect(service.deleteCampaign('c-draft-multi')).rejects.toThrow(
                new ConflictException(
                    'Impossible de supprimer la campagne "Brouillon Multi-Bloqué" : des données liées existent (10 soumission(s) de campagne, 4 soumission(s) ONEFOP, 2 déclaration(s) DSMO, 6 quota(s) territorial(aux), 1 gel(s) statistique(s)).',
                ),
            );
        });

        it('successfully deletes a clean DRAFT campaign with no linked data and closes round in transaction', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-clean-draft',
                name: 'Brouillon Propre',
                status: 'DRAFT',
                _count: {
                    submissions: 0,
                    onefopSubmissions: 0,
                    declarations: 0,
                    quotas: 0,
                    freezes: 0,
                },
            });
            prisma.submissionRound.updateMany.mockResolvedValue({ count: 1 });
            prisma.dataCampaign.delete.mockResolvedValue({ id: 'c-clean-draft', name: 'Brouillon Propre' });

            const result = await service.deleteCampaign('c-clean-draft');

            expect(result).toEqual({ id: 'c-clean-draft', name: 'Brouillon Propre' });
            expect(prisma.submissionRound.updateMany).toHaveBeenCalledWith({
                where: { campaignId: 'c-clean-draft', status: { in: ['OPEN', 'EXTENDED'] } },
                data: expect.objectContaining({ status: 'CLOSED' }),
            });
            expect(prisma.dataCampaign.delete).toHaveBeenCalledWith({ where: { id: 'c-clean-draft' } });
        });
    });

    describe('CampaignService.archiveCampaign', () => {
        it('throws 404 NotFoundException when campaign does not exist', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue(null);

            await expect(service.archiveCampaign('non-existent')).rejects.toThrow(
                new NotFoundException('Campagne introuvable'),
            );
        });

        it('throws 409 ConflictException when campaign is already ARCHIVED', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-archived',
                status: 'ARCHIVED',
            });

            await expect(service.archiveCampaign('c-archived')).rejects.toThrow(
                new ConflictException('La campagne est déjà archivée'),
            );
        });

        it('successfully archives campaign and closes open rounds', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-to-archive',
                status: 'CLOSED',
                createdBy: 'admin-1',
            });
            prisma.dataCampaign.update.mockResolvedValue({
                id: 'c-to-archive',
                status: 'ARCHIVED',
            });
            prisma.submissionRound.updateMany.mockResolvedValue({ count: 1 });

            const result = await service.archiveCampaign('c-to-archive', 'user-actor');

            expect(result).toEqual({ id: 'c-to-archive', status: 'ARCHIVED' });
            expect(prisma.dataCampaign.update).toHaveBeenCalledWith({
                where: { id: 'c-to-archive' },
                data: { status: 'ARCHIVED' },
            });
            expect(prisma.submissionRound.updateMany).toHaveBeenCalledWith({
                where: { campaignId: 'c-to-archive', status: { in: ['OPEN', 'EXTENDED'] } },
                data: expect.objectContaining({ status: 'CLOSED', closedBy: 'user-actor' }),
            });
        });
    });
    // ───────────────────────────────────────────────────────────
    // DataCampaign.type was renamed to `periodicity`. react-web, the Flutter
    // admin and the Flutter company workspace all still read the JSON key
    // `type`, so every campaign response dual-emits both keys and the request
    // side accepts either. These tests pin that contract — delete them only
    // when the legacy `type` key is actually retired.
    // ───────────────────────────────────────────────────────────
    describe('periodicity / type wire compatibility', () => {
        const futureDeadline = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        it('getCampaign emits both `periodicity` and the legacy `type` key with the same value', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-1',
                code: 'QUARTERLY_2026_T3_001',
                periodicity: 'QUARTERLY',
                purpose: 'COLLECTION',
                status: 'ACTIVE',
            });

            const result: any = await service.getCampaign('c-1');

            expect(result.periodicity).toBe('QUARTERLY');
            expect(result.type).toBe('QUARTERLY');
            expect(result.purpose).toBe('COLLECTION');
        });

        it('getCampaign carries a null periodicity through to both keys rather than inventing a value', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue({
                id: 'c-null',
                code: 'QUARTERLY_2026_T3_002',
                periodicity: null,
                purpose: 'COLLECTION',
                status: 'ACTIVE',
            });

            const result: any = await service.getCampaign('c-null');

            expect(result.periodicity).toBeNull();
            expect(result.type).toBeNull();
        });

        it('listCampaigns emits both keys on every row', async () => {
            prisma.dataCampaign.findMany.mockResolvedValue([
                {
                    id: 'c-1',
                    code: 'ANNUAL_2026_AN_001',
                    periodicity: 'ANNUAL',
                    purpose: 'COLLECTION',
                    status: 'ACTIVE',
                    deadline: futureDeadline,
                },
            ]);

            const result: any[] = await service.listCampaigns();

            expect(result).toHaveLength(1);
            expect(result[0].periodicity).toBe('ANNUAL');
            expect(result[0].type).toBe('ANNUAL');
            // the mapper must not swallow anything else the endpoint returns
            expect(result[0].progress).toBeDefined();
            expect(result[0].code).toBe('ANNUAL_2026_AN_001');
        });

        it('listCampaigns filters on periodicity whether the caller sends `type` or `periodicity`', async () => {
            prisma.dataCampaign.findMany.mockResolvedValue([]);

            await service.listCampaigns(undefined, 'SEMESTER');
            expect(prisma.dataCampaign.findMany).toHaveBeenLastCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ periodicity: 'SEMESTER' }) }),
            );

            await service.listCampaigns(undefined, undefined, undefined, 'ANNUAL');
            expect(prisma.dataCampaign.findMany).toHaveBeenLastCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ periodicity: 'ANNUAL' }) }),
            );
        });

        it('listCampaigns prefers the new `periodicity` key when a client sends both', async () => {
            prisma.dataCampaign.findMany.mockResolvedValue([]);

            await service.listCampaigns(undefined, 'QUARTERLY', undefined, 'ANNUAL');

            expect(prisma.dataCampaign.findMany).toHaveBeenLastCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ periodicity: 'ANNUAL' }) }),
            );
        });

        it('createCampaign stores periodicity from the legacy `type` request key', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue(null);
            prisma.submissionRound.findUnique.mockResolvedValue(null);
            prisma.dataCampaign.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));

            await service.createCampaign({
                collectionType: 'DSMO',
                type: 'ANNUAL',
                startDate: '2026-10-15',
                deadline: '2026-12-31',
                createdBy: 'user-1',
            });

            const createCall = prisma.dataCampaign.create.mock.calls[0][0];
            expect(createCall.data.periodicity).toBe('ANNUAL');
            expect(createCall.data).not.toHaveProperty('type');
        });

        it('createCampaign accepts the new `periodicity` request key', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue(null);
            prisma.submissionRound.findUnique.mockResolvedValue(null);
            prisma.dataCampaign.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));

            await service.createCampaign({
                collectionType: 'DSMO',
                periodicity: 'SEMESTER',
                startDate: '2026-10-15',
                deadline: '2026-12-31',
                createdBy: 'user-1',
            });

            const createCall = prisma.dataCampaign.create.mock.calls[0][0];
            expect(createCall.data.periodicity).toBe('SEMESTER');
            // the code and name are derived from the same value, whichever key carried it
            expect(createCall.data.code).toMatch(/^SEMESTER_2026_S2_\d{3}$/);
            expect(createCall.data.name).toContain('POUR LE DEUXIEME SEMESTRE 2026');
        });

        it('createCampaign defaults purpose to COLLECTION and falls back to QUARTERLY periodicity', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue(null);
            prisma.submissionRound.findUnique.mockResolvedValue(null);
            prisma.dataCampaign.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));

            await service.createCampaign({
                collectionType: 'DSMO',
                startDate: '2026-10-15',
                deadline: '2026-12-31',
                createdBy: 'user-1',
            });

            const createCall = prisma.dataCampaign.create.mock.calls[0][0];
            expect(createCall.data.periodicity).toBe('QUARTERLY');
            expect(createCall.data.purpose).toBe('COLLECTION');
        });

        it('createCampaign honours an explicit REGISTRATION purpose', async () => {
            prisma.dataCampaign.findUnique.mockResolvedValue(null);
            prisma.submissionRound.findUnique.mockResolvedValue(null);
            prisma.dataCampaign.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));

            await service.createCampaign({
                collectionType: 'DSMO',
                periodicity: 'QUARTERLY',
                purpose: 'REGISTRATION',
                startDate: '2026-10-15',
                deadline: '2026-12-31',
                createdBy: 'user-1',
            });

            expect(prisma.dataCampaign.create.mock.calls[0][0].data.purpose).toBe('REGISTRATION');
        });
    });
});
