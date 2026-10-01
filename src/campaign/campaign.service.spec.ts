import { BadRequestException, ConflictException } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../dsmo/notification.service';

describe('CampaignService - reference period and lateness gating', () => {
    let service: CampaignService;
    let prisma: {
        dataCampaign: {
            findFirst: jest.Mock;
            findUnique: jest.Mock;
            create: jest.Mock;
            update: jest.Mock;
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
                create: jest.fn(),
                update: jest.fn(),
            },
            submissionRound: {
                findUnique: jest.fn(),
                updateMany: jest.fn(),
            },
            $transaction: jest.fn(),
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
});
