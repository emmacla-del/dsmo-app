import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';

import { Prisma, DataCampaign, OnefopEntityType, CampaignPeriodicity, CampaignPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../dsmo/notification.service';
import { UserRole } from '../types/prisma.types';
import { computeCollectionPeriod } from './campaign-period.helper';

// Transaction client type provided by Prisma — doesn't include NestJS lifecycle methods.
type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CampaignService {
    private readonly logger = new Logger(CampaignService.name);

    // Before the targeting UI had an explicit "All" option, the only way to
    // target every entity type was to manually tick every checkbox — so a
    // targetEntityTypes array that happens to list all of these is just as
    // unrestricted as an empty one, and must be treated the same way when
    // matching companies (otherwise every company with no entityType set
    // — common for older registrations — silently stops matching).
    private readonly allEntityTypes: OnefopEntityType[] = ['ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG'];

    // The campaign name is always one of these two official titles, tied
    // 1:1 to the collection type it gates — never taken from the client, so
    // a stale UI build or a direct API call can't create a campaign with a
    // blank or mistyped name (mirrors campaignNameByCollectionType in
    // lib/screens/campaign/campaign_constants.dart).
    private readonly campaignNameByCollectionType: Record<string, string> = {
        ONEFOP: "COLLECTE DES DONNEES SUR LES EMPLOIS CREES PAR LE SECTEUR MODERNE DE L'ECONOMIE",
        DSMO: "DECLARATION SUR LA SITUATION DE LA MAIN D'OEUVRE",
    };

    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
    ) { }

    private validateReferencePeriod(
        collectionType: string,
        referenceYear?: any,
        referenceQuarter?: any,
    ): { referenceYear?: number; referenceQuarter?: number } {
        if (collectionType === 'ONEFOP') {
            if (
                referenceYear === undefined ||
                referenceYear === null ||
                (typeof referenceYear === 'string' && referenceYear.trim() === '') ||
                !Number.isInteger(Number(referenceYear)) ||
                Number(referenceYear) < 2000 ||
                Number(referenceYear) > 2100
            ) {
                throw new BadRequestException("L'année de référence est obligatoire pour les campagnes ONEFOP (ex: 2026).");
            }
            if (
                referenceQuarter === undefined ||
                referenceQuarter === null ||
                (typeof referenceQuarter === 'string' && referenceQuarter.trim() === '') ||
                !Number.isInteger(Number(referenceQuarter)) ||
                Number(referenceQuarter) < 1 ||
                Number(referenceQuarter) > 4
            ) {
                throw new BadRequestException("Le trimestre de référence est obligatoire pour les campagnes ONEFOP (valeur entre 1 et 4).");
            }
            return {
                referenceYear: Number(referenceYear),
                referenceQuarter: Number(referenceQuarter),
            };
        }

        const year = referenceYear !== undefined && referenceYear !== null && referenceYear !== ''
            ? Number(referenceYear)
            : undefined;
        const quarter = referenceQuarter !== undefined && referenceQuarter !== null && referenceQuarter !== ''
            ? Number(referenceQuarter)
            : undefined;

        if (quarter !== undefined && (!Number.isInteger(quarter) || quarter < 1 || quarter > 4)) {
            throw new BadRequestException("Le trimestre de référence doit être compris entre 1 et 4.");
        }

        return { referenceYear: year, referenceQuarter: quarter };
    }

    // One non-archived ONEFOP campaign per (purpose, referenceYear,
    // referenceQuarter): a collection campaign and a registration campaign
    // may share a quarter, two of the same purpose may not. This rule is
    // application-level only — no database constraint backs it yet. A partial
    // unique index on (collectionType, purpose, referenceYear, referenceQuarter)
    // WHERE status <> 'ARCHIVED' is planned as a separate schema step.
    private async assertNoPeriodDuplicate(
        collectionType: string,
        purpose: CampaignPurpose,
        referenceYear?: number,
        referenceQuarter?: number,
    ) {
        if (collectionType === 'ONEFOP' && referenceYear !== undefined && referenceQuarter !== undefined) {
            const duplicate = await this.prisma.dataCampaign.findFirst({
                where: {
                    collectionType: 'ONEFOP',
                    purpose,
                    referenceYear,
                    referenceQuarter,
                    status: { not: 'ARCHIVED' },
                },
                select: { code: true },
            });
            if (duplicate) {
                const kind = purpose === CampaignPurpose.REGISTRATION ? " d'inscription" : '';
                throw new ConflictException(
                    `Une campagne ONEFOP${kind} existe déjà pour la période ${referenceYear}-T${referenceQuarter} (campagne ${duplicate.code}).`,
                );
            }
        }
    }

    // Validated by hand: POST /campaigns has no DTO class (@Body() data: any),
    // so nothing upstream rejects an off-enum value.
    private parsePurpose(raw: unknown): CampaignPurpose {
        if (raw === undefined || raw === null || raw === '') return CampaignPurpose.COLLECTION;
        if (typeof raw === 'string' && (Object.values(CampaignPurpose) as string[]).includes(raw)) {
            return raw as CampaignPurpose;
        }
        throw new BadRequestException(
            `L'objet de la campagne doit valoir ${Object.values(CampaignPurpose).join(' ou ')}.`,
        );
    }

    // A registration campaign holds inscription targets and nothing else: it
    // opens no collection round, creates no CampaignSubmission rows, sends no
    // email and is never offered to respondents. It stays DRAFT for life, so
    // every lifecycle action that would move it out of DRAFT or reach
    // companies is refused here.
    private async assertNotRegistration(id: string, refusal: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({
            where: { id },
            select: { purpose: true },
        });
        if (campaign?.purpose === CampaignPurpose.REGISTRATION) {
            throw new BadRequestException(
                `Une campagne d'inscription ${refusal} : elle porte des cibles, pas une collecte.`,
            );
        }
    }

    async createCampaign(data: any) {
        const collectionType = data.collectionType === 'DSMO' ? 'DSMO' : 'ONEFOP';
        const purpose = this.parsePurpose(data.purpose);
        const { referenceYear, referenceQuarter } = this.validateReferencePeriod(
            collectionType,
            data.referenceYear,
            data.referenceQuarter,
        );
        await this.assertNoPeriodDuplicate(collectionType, purpose, referenceYear, referenceQuarter);

        const startDate = new Date(data.startDate);
        const refPeriod = referenceYear !== undefined && referenceQuarter !== undefined
            ? { year: referenceYear, quarter: referenceQuarter }
            : undefined;
        const periodicity: CampaignPeriodicity = data.periodicity ?? data.type ?? 'QUARTERLY';
        const code = await this.generateCampaignCode(periodicity, startDate, refPeriod);

        const campaign = await this.prisma.dataCampaign.create({
            data: {
                code,
                name: `${this.campaignNameByCollectionType[collectionType]} ` +
                    this.buildPeriodSuffix(periodicity, startDate, refPeriod),
                description: data.description,
                periodicity,
                purpose,
                collectionType,
                referenceYear,
                referenceQuarter,
                startDate: new Date(data.startDate),
                deadline: new Date(data.deadline),
                targetRegions: data.targetRegions || [],
                targetDepartments: data.targetDepartments || [],
                targetEntityTypes: data.targetEntityTypes,
                autoReminders: data.autoReminders ?? true,
                reminderDays: data.reminderDays || [7, 3, 1],
                createdBy: data.createdBy,
            },
        });

        // A registration campaign is a target container and stays DRAFT: it is
        // never activated (see assertNotRegistration).
        if (purpose === CampaignPurpose.REGISTRATION) return campaign;

        // Campaigns go live immediately on creation — entities matching the
        // targeting criteria need to see them right away, not after a separate
        // manual "activate" step the admin may not know to take.
        return this.activateCampaign(campaign.id, data.createdBy);
    }


    async listCampaigns(
        status?: string,
        type?: string,        // legacy wire key, still sent by the Flutter clients
        user?: any,
        periodicity?: string, // new wire key
    ) {
        const where: any = {};
        if (status) where.status = status;
        const periodicityFilter = periodicity ?? type;
        if (periodicityFilter) where.periodicity = periodicityFilter;

        if (user?.role === UserRole.REGIONAL_ADMIN && user.region) {
            // An empty targetRegions means "all regions", so it must still
            // match here — `has` on an empty array is always false, which
            // used to hide every "all regions" campaign from REGIONAL users.
            where.OR = [
                { targetRegions: { isEmpty: true } },
                { targetRegions: { has: user.region } },
            ];
        }

        const campaigns = await this.prisma.dataCampaign.findMany({
            where,
            include: {
                _count: { select: { submissions: true } },
                creator: { select: { firstName: true, lastName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Self-heal: the nightly scheduler is the only other thing that
        // flips a passed-deadline campaign from ACTIVE to CLOSED, so without
        // this a campaign can sit here showing "Active" for up to 24h after
        // it has already stopped appearing in the company workspace (which
        // filters live by deadline on every request). Reconcile eagerly so
        // the two views never disagree.
        await Promise.all(
            campaigns
                .filter(c => this._isPastDeadline(c))
                .map(async (c) => Object.assign(c, await this.expireCampaign(c.id))),
        );

        // FIX N+1: fetch all campaign progress in a single grouped query
        // instead of one DB roundtrip per campaign.
        const campaignIds = campaigns.map(c => c.id);
        const allSubmissions = await this.prisma.campaignSubmission.groupBy({
            by: ['campaignId', 'status'],
            where: { campaignId: { in: campaignIds } },
            _count: true,
        });

        // Build a lookup map keyed by campaignId
        const progressMap = new Map<string, ReturnType<typeof this._buildProgress>>();
        for (const id of campaignIds) {
            const rows = allSubmissions.filter(s => s.campaignId === id);
            progressMap.set(id, this._buildProgress(rows));
        }

        return campaigns.map(c => this.toCampaignWire({
            ...c,
            progress: progressMap.get(c.id) ?? this._buildProgress([]),
        }));
    }

    async getCampaign(id: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({
            where: { id },
            include: {
                creator: { select: { firstName: true, lastName: true, email: true } },
                submissions: { take: 20, orderBy: { submittedAt: 'desc' } },
                reminders: { orderBy: { sentAt: 'desc' }, take: 10 },
            },
        });

        if (!campaign) throw new NotFoundException('Campaign not found');
        return this.toCampaignWire(campaign);
    }

    async updateCampaign(id: string, data: any) {
        if (data.referenceYear !== undefined || data.referenceQuarter !== undefined) {
            throw new BadRequestException('La période de référence (année et trimestre) ne peut pas être modifiée après création.');
        }

        // name is intentionally not editable here — it's derived from
        // collectionType, which is itself immutable after creation.
        const campaign = await this.prisma.dataCampaign.update({
            where: { id },
            data: {
                description: data.description,
                deadline: data.deadline ? new Date(data.deadline) : undefined,
                targetRegions: data.targetRegions,
                targetDepartments: data.targetDepartments,
                targetEntityTypes: data.targetEntityTypes,
                reminderDays: data.reminderDays,
            },
        });

        // Edits here (name/deadline/targeting) previously never reached the
        // SubmissionRound actually gating submission — an admin editing a
        // live campaign's deadline or target regions had no real effect.
        // periodEnd is intentionally not touched: it's the data-collection
        // period (computed from the campaign's immutable type/startDate at
        // round-open time — see computeCollectionPeriod()), not the
        // submission deadline being edited here.
        await this.prisma.submissionRound.updateMany({
            where: { campaignId: id, status: { in: ['OPEN', 'EXTENDED'] } },
            data: {
                labelFr: campaign.name,
                labelEn: campaign.name,
                deadline: campaign.deadline ?? undefined,
                targetRegions: campaign.targetRegions,
                targetEntityTypes: campaign.targetEntityTypes as OnefopEntityType[],
            },
        });

        return campaign;
    }

    /**
     * The active campaign (if any) already collecting for this module —
     * used to warn an admin before creating a second one, since activating
     * the new one will close the existing one's round.
     */
    async findActiveCampaignForModule(collectionType: string, excludeId?: string) {
        if (collectionType !== 'ONEFOP' && collectionType !== 'DSMO') {
            throw new BadRequestException('collectionType must be ONEFOP or DSMO');
        }
        return this.prisma.dataCampaign.findFirst({
            where: {
                collectionType,
                status: 'ACTIVE',
                id: excludeId ? { not: excludeId } : undefined,
            },
            select: { id: true, name: true, code: true, deadline: true },
        });
    }

    async deleteCampaign(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const campaign = await tx.dataCampaign.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            submissions: true,
                            onefopSubmissions: true,
                            declarations: true,
                            quotas: true,
                            freezes: true,
                        },
                    },
                },
            });

            if (!campaign) {
                throw new NotFoundException('Campagne introuvable');
            }

            if (campaign.status !== 'DRAFT') {
                throw new ConflictException(
                    `Impossible de supprimer la campagne "${campaign.name}" : son statut est "${campaign.status}". Seules les campagnes à l'état DRAFT peuvent être supprimées. Veuillez l'archiver.`,
                );
            }

            const blockers: string[] = [];
            if (campaign._count.submissions > 0) {
                blockers.push(`${campaign._count.submissions} soumission(s) de campagne`);
            }
            if (campaign._count.onefopSubmissions > 0) {
                blockers.push(`${campaign._count.onefopSubmissions} soumission(s) ONEFOP`);
            }
            if (campaign._count.declarations > 0) {
                blockers.push(`${campaign._count.declarations} déclaration(s) DSMO`);
            }
            if (campaign._count.quotas > 0) {
                blockers.push(`${campaign._count.quotas} quota(s) territorial(aux)`);
            }
            if (campaign._count.freezes > 0) {
                blockers.push(`${campaign._count.freezes} gel(s) statistique(s)`);
            }

            if (blockers.length > 0) {
                throw new ConflictException(
                    `Impossible de supprimer la campagne "${campaign.name}" : des données liées existent (${blockers.join(', ')}).`,
                );
            }

            // Deleting the campaign sets the round's campaignId to NULL (FK is
            // ON DELETE SET NULL) rather than deleting it — close it first inside
            // this transaction so an OPEN round doesn't survive, orphaned, past its
            // campaign's deletion.
            await this._closeCollectionRound(id, undefined, tx);
            return tx.dataCampaign.delete({ where: { id } });
        });
    }

    async activateCampaign(id: string, actorUserId?: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({ where: { id } });
        if (!campaign) throw new NotFoundException('Campaign not found');

        if (campaign.purpose === CampaignPurpose.REGISTRATION) {
            throw new BadRequestException(
                "Une campagne d'inscription ne s'active pas : elle porte des cibles, pas une collecte.",
            );
        }

        if (campaign.status !== 'DRAFT' && campaign.status !== 'PAUSED') {
            throw new BadRequestException('Only DRAFT or PAUSED campaigns can be activated');
        }

        // FIX: wrap in a transaction so a crash mid-way doesn't leave
        // submissions initialized but status still DRAFT.
        await this.prisma.$transaction(async (tx) => {
            await this._initializeCampaignSubmissions(id, tx);

            await tx.dataCampaign.update({
                where: { id },
                data: { status: 'ACTIVE' },
            });
        });

        // This is what actually opens data collection for companies — without
        // it, the campaign just tracked reminders/status while the real
        // ONEFOP/DSMO submission gate (SubmissionRound) stayed untouched.
        await this._openCollectionRound(campaign, actorUserId ?? campaign.createdBy ?? undefined);

        if (campaign.autoReminders) {
            // Fire-and-forget: announcement emails are a best-effort side
            // effect of activation, not part of it. Awaiting this used to
            // mean every create/activate call blocked on emailing every
            // targeted company one at a time — disastrous when targeting
            // is broad and SMTP is slow or unreachable (same pattern as the
            // registration/reset emails in AuthService).
            this.sendReminders(id, 'CAMPAIGN_ANNOUNCEMENT').catch((error) => {
                this.logger.error(
                    `Failed to send campaign announcement reminders for ${id}: ${(error as Error).message}`,
                );
            });
        }

        return this.prisma.dataCampaign.findUnique({ where: { id } });
    }

    async pauseCampaign(id: string, actorUserId?: string) {
        // No status gate here: a DRAFT would become PAUSED, which is activatable.
        await this.assertNotRegistration(id, 'ne se suspend pas');
        const campaign = await this.prisma.dataCampaign.update({
            where: { id },
            data: { status: 'PAUSED' },
        });
        await this._closeCollectionRound(id, actorUserId ?? campaign.createdBy ?? undefined);
        return campaign;
    }

    async closeCampaign(id: string, actorUserId?: string) {
        const campaign = await this.prisma.dataCampaign.update({
            where: { id },
            data: { status: 'CLOSED', closedAt: new Date() },
        });
        await this._closeCollectionRound(id, actorUserId ?? campaign.createdBy ?? undefined);
        return campaign;
    }

    async archiveCampaign(id: string, actorUserId?: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({ where: { id } });
        if (!campaign) {
            throw new NotFoundException('Campagne introuvable');
        }
        if (campaign.status === 'ARCHIVED') {
            throw new ConflictException('La campagne est déjà archivée');
        }
        const updated = await this.prisma.dataCampaign.update({
            where: { id },
            data: { status: 'ARCHIVED' },
        });
        await this._closeCollectionRound(id, actorUserId ?? campaign.createdBy ?? undefined);
        return updated;
    }

    // Shared by the nightly deadline scheduler and listCampaigns' eager
    // reconciliation, so a campaign expires the same way (one expiry
    // notification, then closed) regardless of which of the two notices
    // the passed deadline first.
    async expireCampaign(id: string) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const alreadyNotified = await this.prisma.campaignReminder.findFirst({
            where: { campaignId: id, reminderType: 'CAMPAIGN_EXPIRED', sentAt: { gte: startOfToday } },
        });
        if (!alreadyNotified) {
            await this.sendReminders(id, 'CAMPAIGN_EXPIRED');
        }
        return this.closeCampaign(id);
    }

    async extendDeadline(id: string, newDeadline: Date) {
        // Audit D15: the update below writes status 'ACTIVE' unconditionally,
        // so extending a registration campaign would activate it.
        await this.assertNotRegistration(id, 'ne se prolonge pas');
        const campaign = await this.prisma.dataCampaign.update({
            where: { id },
            data: { deadline: newDeadline, extendedDeadline: newDeadline, status: 'ACTIVE' },
        });
        // Keep the open round's submission deadline in sync; bump it to
        // EXTENDED so the distinction between "still within the original
        // window" and "running past it" survives in the round's own status
        // too. periodEnd (the data-collection period S21Q01 etc. display) is
        // deliberately left untouched — extending the submission deadline
        // doesn't change what period the collected data itself covers.
        await this.prisma.submissionRound.updateMany({
            where: { campaignId: id, status: { in: ['OPEN', 'EXTENDED'] } },
            data: { deadline: newDeadline, status: 'EXTENDED' },
        });
        await this.sendReminders(id, 'DEADLINE_EXTENDED');
        return campaign;
    }

    async getCampaignProgress(campaignId: string) {
        const submissions = await this.prisma.campaignSubmission.groupBy({
            by: ['status'],
            where: { campaignId },
            _count: true,
        });
        return this._buildProgress(submissions);
    }

    async getCampaignSubmissions(campaignId: string, filters: { status?: string; region?: string }) {
        const where: any = { campaignId };
        if (filters.status) where.status = filters.status;

        const submissions = await this.prisma.campaignSubmission.findMany({
            where,
            include: { campaign: { select: { name: true, code: true } } },
            orderBy: { submittedAt: 'desc' },
        });

        // FIX N+1: collect all establishmentIds then fetch companies in one query.
        const establishmentIds = submissions
            .map(s => s.establishmentId)
            .filter((id): id is string => id != null);

        const companies = await this.prisma.company.findMany({
            where: { establishmentId: { in: establishmentIds } },
            select: { establishmentId: true, name: true, region: true, department: true },
        });

        const companyMap = new Map(companies.map(c => [c.establishmentId, c]));

        return submissions.map(sub => {
            const company = sub.establishmentId
                ? companyMap.get(sub.establishmentId)
                : undefined;
            return {
                ...sub,
                companyName: company?.name ?? null,
                region: company?.region ?? null,
                department: company?.department ?? null,
            };
        });
    }

    async sendReminders(campaignId: string, reminderType: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) throw new NotFoundException('Campaign not found');
        if (campaign.purpose === CampaignPurpose.REGISTRATION) {
            throw new BadRequestException(
                "Une campagne d'inscription n'envoie pas de relances : elle porte des cibles, pas une collecte.",
            );
        }

        const companies = await this._getPendingCompanies(campaignId);
        const subject = this.getReminderSubject(reminderType, campaign.name);
        const message = this.getReminderMessage(reminderType, campaign);

        const { sent, failed } = await this.notificationService.sendToCompanies(
            companies,
            subject,
            message,
        );

        const reminder = await this.prisma.campaignReminder.create({
            data: {
                campaignId,
                reminderType,
                recipientCount: sent,
                failedCount: failed,
                subject,
                message,
            },
        });

        const summary = `Reminder [${reminderType}] sent to ${sent}/${companies.length} recipients for campaign ${campaignId} (${failed} failed)`;
        // Elevate to warn when anything failed, so a fully-failed batch (e.g.
        // SMTP outage) stands out in logs instead of reading like a routine send.
        if (failed > 0) {
            this.logger.warn(summary);
        } else {
            this.logger.log(summary);
        }
        return reminder;
    }

    /**
     * Companies still pending (not SUBMITTED/VALIDATED) for a campaign,
     * with the fields NotificationService needs to email them.
     */
    private async _getPendingCompanies(campaignId: string) {
        // FIX N+1: fetch pending submissions, then all their companies in one query.
        const pendingSubmissions = await this.prisma.campaignSubmission.findMany({
            where: { campaignId, status: { notIn: ['SUBMITTED', 'VALIDATED'] } },
            select: { establishmentId: true },
        });

        const establishmentIds = pendingSubmissions
            .map(s => s.establishmentId)
            .filter((id): id is string => id != null);

        return this.prisma.company.findMany({
            where: { establishmentId: { in: establishmentIds } },
            select: { id: true, userId: true, name: true },
        });
    }

    async getActiveCampaignsForCompany(userId: string) {
        const company = await this.prisma.company.findUnique({ where: { userId } });
        if (!company?.establishmentId) return [];

        // Each targeting axis is independent: an empty array means "no
        // restriction on this axis" (the "All" option in the targeting UI),
        // not "matches nothing" — `has` on an empty array is always false,
        // so the previous OR-across-axes version meant a campaign with no
        // filters at all (the common "target everyone" case) never matched
        // any company. A campaign only needs to satisfy every axis it
        // actually restricts.
        // Registration campaigns hold targets only and are never offered to a
        // respondent. Without this filter the newest one by startDate would
        // win the per-module pick below, DRAFT or not — this query has no
        // status filter.
        const campaigns = await this.prisma.dataCampaign.findMany({
            where: {
                purpose: CampaignPurpose.COLLECTION,
                AND: [
                    { OR: [{ targetRegions: { isEmpty: true } }, { targetRegions: { has: company.region } }] },
                    { OR: [{ targetDepartments: { isEmpty: true } }, { targetDepartments: { has: company.department } }] },
                    company.entityType
                        ? {
                              OR: [
                                  { targetEntityTypes: { isEmpty: true } },
                                  { targetEntityTypes: { hasEvery: this.allEntityTypes } },
                                  { targetEntityTypes: { has: company.entityType } },
                              ],
                          }
                        : {
                              OR: [
                                  { targetEntityTypes: { isEmpty: true } },
                                  { targetEntityTypes: { hasEvery: this.allEntityTypes } },
                              ],
                          },
                ],
            },
            orderBy: { startDate: 'desc' },
            include: {
                submissions: {
                    where: { establishmentId: company.establishmentId },
                    take: 1,
                },
            },
        });

        // Keep one stable slot per collection module. The dashboard needs to
        // show inactive modules too, while older campaigns should not crowd
        // out the current/latest one.
        const latestByModule = new Map<string, typeof campaigns[number]>();
        for (const campaign of campaigns) {
            if (!latestByModule.has(campaign.collectionType)) {
                latestByModule.set(campaign.collectionType, campaign);
            }
        }

        return [...latestByModule.values()].map(c => this.toCampaignWire({
            id: c.id,
            code: c.code,
            name: c.name,
            description: c.description,
            periodicity: c.periodicity,
            collectionType: c.collectionType,
            startDate: c.startDate,
            deadline: c.deadline,
            status: c.status,
            mySubmission: c.submissions[0]?.status || 'NOT_STARTED',
        }));
    }

    // ═══════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Response shaper for every endpoint that returns a campaign object.
     *
     * DataCampaign.type was renamed to `periodicity`, but react-web, the
     * Flutter admin and the Flutter company workspace all still read the
     * JSON key `type`. GET /campaigns and GET /campaigns/:id used to return
     * the raw Prisma row by spread, so the wire key was simply the Prisma
     * field name — renaming the column would have silently renamed the key
     * and broken all three clients at once.
     *
     * So we dual-emit: `periodicity` is the real field, and `type` is
     * re-added explicitly with the same value. Drop the legacy key once all
     * three clients read `periodicity`.
     */
    private toCampaignWire<T extends { periodicity: CampaignPeriodicity | null }>(
        c: T,
    ): T & { type: CampaignPeriodicity | null } {
        return { ...c, type: c.periodicity };
    }

    /**
     * Opens (or reopens) the SubmissionRound that gates the campaign's
     * collectionType module. One round per campaign (campaignId is unique),
     * so reactivating a PAUSED campaign reopens its existing round instead
     * of creating a duplicate. Any other round still open for the same
     * module is closed first — only one round per module may be open at
     * once. This is now the only code path that opens a round: the old
     * standalone admin open/close endpoints were removed because they let a
     * round be opened without a campaignId, so "no active campaign" and "no
     * open round" could silently drift apart. The superseded campaign's own
     * status is closed too, so the campaign list
     * doesn't keep showing it as ACTIVE after its round was cut off —
     * this is the "overwrite" the admin is warned about and confirms via
     * GET /campaigns/conflicts before creating a colliding campaign.
     */
    private async _openCollectionRound(campaign: DataCampaign, userId?: string) {
        // Submission deadline (when respondents may still submit) — distinct
        // from the data-collection period below, and the only one of the two
        // extendDeadline() ever moves.
        const submissionDeadline = campaign.extendedDeadline ?? campaign.deadline ?? new Date();
        // Data-collection period (what S21Q01 and its sibling questions ask
        // about) — the calendar quarter/semester/year the campaign covers,
        // fixed at round-open time and never altered by extending the
        // submission deadline. See computeCollectionPeriod().
        const { periodStart, periodEnd } = computeCollectionPeriod(
            campaign.periodicity ?? 'QUARTERLY',
            campaign.startDate ?? new Date(),
        );

        await this.prisma.$transaction(async (tx) => {
            await tx.submissionRound.updateMany({
                where: {
                    campaignId: { not: campaign.id },
                    module: campaign.collectionType,
                    status: { in: ['OPEN', 'EXTENDED'] },
                },
                data: { status: 'CLOSED', closedAt: new Date(), closedBy: userId },
            });

            await tx.dataCampaign.updateMany({
                where: {
                    id: { not: campaign.id },
                    collectionType: campaign.collectionType,
                    status: 'ACTIVE',
                },
                data: { status: 'CLOSED', closedAt: new Date() },
            });

            await tx.submissionRound.upsert({
                where: { campaignId: campaign.id },
                create: {
                    campaignId: campaign.id,
                    module: campaign.collectionType,
                    quarterCode: campaign.code,
                    labelFr: campaign.name,
                    labelEn: campaign.name,
                    periodStart,
                    periodEnd,
                    deadline: submissionDeadline,
                    targetRegions: campaign.targetRegions,
                    targetEntityTypes: campaign.targetEntityTypes as OnefopEntityType[],
                    status: 'OPEN',
                    openedAt: new Date(),
                    openedBy: userId,
                },
                update: {
                    labelFr: campaign.name,
                    labelEn: campaign.name,
                    periodStart,
                    periodEnd,
                    deadline: submissionDeadline,
                    targetRegions: campaign.targetRegions,
                    targetEntityTypes: campaign.targetEntityTypes as OnefopEntityType[],
                    status: 'OPEN',
                    openedAt: new Date(),
                    openedBy: userId,
                    closedAt: null,
                    closedBy: null,
                },
            });
        });
    }

    // Mirrors the date filter getActiveCampaignsForCompany uses (deadline
    // strictly before now), so a campaign can't linger as "Active" in the
    // admin list after it has already stopped being returned to companies.
    private _isPastDeadline(campaign: DataCampaign): boolean {
        if (campaign.status !== 'ACTIVE') return false;
        const deadline = campaign.extendedDeadline ?? campaign.deadline;
        return !!deadline && deadline.getTime() < Date.now();
    }

    /** Closes the SubmissionRound tied to this campaign, if one is open. */
    private async _closeCollectionRound(campaignId: string, userId?: string, tx?: PrismaTx) {
        const client = tx ?? this.prisma;
        await client.submissionRound.updateMany({
            where: { campaignId, status: { in: ['OPEN', 'EXTENDED'] } },
            data: { status: 'CLOSED', closedAt: new Date(), closedBy: userId },
        });
    }

    /**
     * Shared progress builder — used by both getCampaignProgress()
     * and the batched listCampaigns() aggregation to avoid duplication.
     */
    private _buildProgress(rows: { status: string; _count: number }[]) {
        const total = rows.reduce((acc, s) => acc + s._count, 0);
        const submitted = rows.find(s => s.status === 'SUBMITTED')?._count ?? 0;
        const notStarted = rows.find(s => s.status === 'NOT_STARTED')?._count ?? 0;
        const inProgress = rows.find(s => s.status === 'IN_PROGRESS')?._count ?? 0;

        return {
            total,
            submitted,
            notStarted,
            inProgress,
            completionRate: total > 0 ? ((submitted / total) * 100).toFixed(1) : '0.0',
            byStatus: rows.reduce<Record<string, number>>(
                (acc, s) => ({ ...acc, [s.status]: s._count }),
                {},
            ),
            lastUpdated: new Date(),
        };
    }

    /**
     * Initializes campaign submissions for all matching establishments.
     * Accepts an optional Prisma transaction client so it can run inside
     * the activateCampaign() transaction safely.
     */
    private async _initializeCampaignSubmissions(
        campaignId: string,
        tx?: PrismaTx,
    ) {
        const db = tx ?? this.prisma;
        const campaign = await db.dataCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) return;

        const where: any = {
            isPrincipal: true,
            status: 'ACTIVE',
        };
        if (campaign.targetRegions?.length) where.region = { in: campaign.targetRegions };
        if (campaign.targetDepartments?.length) where.department = { in: campaign.targetDepartments };
        if (campaign.targetEntityTypes?.length) where.company = { entityType: { in: campaign.targetEntityTypes } };

        const establishments = await db.establishment.findMany({
            where,
            select: { id: true, companyId: true },
        });

        await db.campaignSubmission.createMany({
            data: establishments.map((est) => ({
                campaignId,
                companyId: est.companyId,
                establishmentId: est.id,
                status: 'NOT_STARTED' as const,
            })),
            skipDuplicates: true,
        });
    }

    /**
     * Spells out which quarter/semester/year a campaign actually covers —
     * e.g. "POUR LE PREMIER TRIMESTRE 2026" — computed from its own
     * type/startDate rather than hardcoded, so it stays correct no matter
     * when a campaign is created or which period it's backdated/scheduled
     * for.
     */
    private buildPeriodSuffix(type: string, startDate: Date, refPeriod?: { year: number; quarter: number }): string {
        const year = refPeriod?.year ?? startDate.getFullYear();
        const quarter = refPeriod?.quarter ?? Math.ceil((startDate.getMonth() + 1) / 3); // 1..4

        if (type === 'SEMESTER') {
            const semesterOrdinals = ['PREMIER', 'DEUXIEME'];
            const semester = quarter <= 2 ? 0 : 1;
            return `POUR LE ${semesterOrdinals[semester]} SEMESTRE ${year}`;
        }
        if (type === 'ANNUAL') {
            return `POUR L'ANNEE ${year}`;
        }
        const quarterOrdinals = ['PREMIER', 'DEUXIEME', 'TROISIEME', 'QUATRIEME'];
        return `POUR LE ${quarterOrdinals[quarter - 1]} TRIMESTRE ${year}`;
    }

    /**
     * FIX: replaces Math.random() with a DB count to derive a collision-free
     * sequence number. Two campaigns of the same type created in the same
     * quarter/year will get consecutive suffixes (001, 002, …) instead of
     * random ones that can collide.
     *
     * e.g. QUARTERLY_2024_T3_001, QUARTERLY_2024_T3_002
     */
    private async generateCampaignCode(
        type: string,
        startDate?: Date,
        refPeriod?: { year: number; quarter: number },
    ): Promise<string> {
        const d = startDate ?? new Date();
        const year = refPeriod?.year ?? d.getFullYear();
        const quarter = refPeriod?.quarter ?? Math.ceil((d.getMonth() + 1) / 3);

        const suffix =
            type === 'QUARTERLY' ? `T${quarter}` :
                type === 'SEMESTER' ? `S${quarter <= 2 ? 1 : 2}` :
                    type === 'ANNUAL' ? 'AN' :
                        `T${quarter}`;

        const prefix = `${type}_${year}_${suffix}`;

        // This code is reused as the SubmissionRound.quarterCode opened
        // alongside the campaign, and that round row outlives the campaign
        // (its campaignId FK is ON DELETE SET NULL, not cascade) — so a
        // deleted campaign's code stays permanently reserved on its orphaned
        // round. Counting only current DataCampaign rows could regenerate a
        // code that collides with one of those leftover rounds. Check both
        // tables directly by unique key instead, so a code is never reused.
        let seq = 1;
        for (;;) {
            const candidate = `${prefix}_${seq.toString().padStart(3, '0')}`;
            const [campaignClash, roundClash] = await Promise.all([
                this.prisma.dataCampaign.findUnique({ where: { code: candidate } }),
                this.prisma.submissionRound.findUnique({ where: { quarterCode: candidate } }),
            ]);
            if (!campaignClash && !roundClash) return candidate;
            seq++;
        }
    }

    private getReminderSubject(type: string, campaignName: string): string {
        const subjects: Record<string, string> = {
            CAMPAIGN_ANNOUNCEMENT: `Nouvelle campagne: ${campaignName}`,
            DEADLINE_APPROACHING: `Rappel: Échéance de la campagne ${campaignName}`,
            FINAL_REMINDER: `Dernier rappel: ${campaignName} se termine bientôt`,
            DEADLINE_EXTENDED: `Prorogation: Nouvelle échéance pour ${campaignName}`,
            CAMPAIGN_EXPIRED: `Campagne clôturée: ${campaignName}`,
        };
        return subjects[type] ?? `Information: ${campaignName}`;
    }

    private getReminderMessage(type: string, campaign: any): string {
        const messages: Record<string, string> = {
            CAMPAIGN_ANNOUNCEMENT: `La campagne "${campaign.name}" est active. Veuillez soumettre vos données avant le ${campaign.deadline?.toLocaleDateString('fr-FR')}.`,
            DEADLINE_APPROACHING: `La campagne "${campaign.name}" se termine le ${campaign.deadline?.toLocaleDateString('fr-FR')}. Finalisez votre soumission.`,
            FINAL_REMINDER: `DERNIER RAPPEL: La campagne "${campaign.name}" se termine dans 24 heures.`,
            DEADLINE_EXTENDED: `La date limite de "${campaign.name}" a été prolongée au ${campaign.deadline?.toLocaleDateString('fr-FR')}.`,
            CAMPAIGN_EXPIRED: `La campagne "${campaign.name}" est désormais clôturée. Aucune soumission supplémentaire ne sera prise en compte.`,
        };
        return messages[type] ?? `Veuillez prendre connaissance de la campagne "${campaign.name}".`;
    }
}