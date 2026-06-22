// src/campaign/campaign.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, DataCampaign, OnefopEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../dsmo/notification.service';
import { UserRole } from '../types/prisma.types';

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

    async createCampaign(data: any) {
        const collectionType = data.collectionType === 'DSMO' ? 'DSMO' : 'ONEFOP';
        const startDate = new Date(data.startDate);
        const code = await this.generateCampaignCode(data.type, startDate);

        const campaign = await this.prisma.dataCampaign.create({
            data: {
                code,
                name: `${this.campaignNameByCollectionType[collectionType]} ` +
                    this.buildPeriodSuffix(data.type, startDate),
                description: data.description,
                type: data.type,
                collectionType,
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

        // Campaigns go live immediately on creation — entities matching the
        // targeting criteria need to see them right away, not after a separate
        // manual "activate" step the admin may not know to take.
        return this.activateCampaign(campaign.id, data.createdBy);
    }

    async listCampaigns(status?: string, type?: string, user?: any) {
        const where: any = {};
        if (status) where.status = status;
        if (type) where.type = type;

        if (user?.role === UserRole.REGIONAL && user.region) {
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

        return campaigns.map(c => ({
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
        return campaign;
    }

    async updateCampaign(id: string, data: any) {
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
        await this.prisma.submissionRound.updateMany({
            where: { campaignId: id, status: { in: ['OPEN', 'EXTENDED'] } },
            data: {
                labelFr: campaign.name,
                labelEn: campaign.name,
                deadline: campaign.deadline ?? undefined,
                periodEnd: campaign.deadline ?? undefined,
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
        // Deleting the campaign sets the round's campaignId to NULL (FK is
        // ON DELETE SET NULL) rather than deleting it — close it first so an
        // OPEN round doesn't survive, orphaned, past its campaign's deletion.
        await this._closeCollectionRound(id);
        return this.prisma.dataCampaign.delete({ where: { id } });
    }

    async activateCampaign(id: string, actorUserId?: string) {
        const campaign = await this.prisma.dataCampaign.findUnique({ where: { id } });
        if (!campaign) throw new NotFoundException('Campaign not found');

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

    async extendDeadline(id: string, newDeadline: Date) {
        const campaign = await this.prisma.dataCampaign.update({
            where: { id },
            data: { deadline: newDeadline, extendedDeadline: newDeadline, status: 'ACTIVE' },
        });
        // Keep the open round's deadline in sync; bump it to EXTENDED so the
        // distinction between "still within the original window" and
        // "running past it" survives in the round's own status too.
        await this.prisma.submissionRound.updateMany({
            where: { campaignId: id, status: { in: ['OPEN', 'EXTENDED'] } },
            data: { deadline: newDeadline, periodEnd: newDeadline, status: 'EXTENDED' },
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

        const now = new Date();
        // Each targeting axis is independent: an empty array means "no
        // restriction on this axis" (the "All" option in the targeting UI),
        // not "matches nothing" — `has` on an empty array is always false,
        // so the previous OR-across-axes version meant a campaign with no
        // filters at all (the common "target everyone" case) never matched
        // any company. A campaign only needs to satisfy every axis it
        // actually restricts.
        const campaigns = await this.prisma.dataCampaign.findMany({
            where: {
                status: 'ACTIVE',
                startDate: { lte: now },
                deadline: { gte: now },
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
            include: {
                submissions: {
                    where: { establishmentId: company.establishmentId },
                    take: 1,
                },
            },
        });

        return campaigns.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            description: c.description,
            type: c.type,
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
     * Opens (or reopens) the SubmissionRound that gates the campaign's
     * collectionType module. One round per campaign (campaignId is unique),
     * so reactivating a PAUSED campaign reopens its existing round instead
     * of creating a duplicate. Any other round still open for the same
     * module is closed first — only one round per module may be open at
     * once, mirroring SubmissionRoundsService.open()'s invariant. The
     * superseded campaign's own status is closed too, so the campaign list
     * doesn't keep showing it as ACTIVE after its round was cut off —
     * this is the "overwrite" the admin is warned about and confirms via
     * GET /campaigns/conflicts before creating a colliding campaign.
     */
    private async _openCollectionRound(campaign: DataCampaign, userId?: string) {
        const periodEnd = campaign.extendedDeadline ?? campaign.deadline ?? new Date();

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
                    periodStart: campaign.startDate ?? new Date(),
                    periodEnd,
                    deadline: periodEnd,
                    targetRegions: campaign.targetRegions,
                    targetEntityTypes: campaign.targetEntityTypes as OnefopEntityType[],
                    status: 'OPEN',
                    openedAt: new Date(),
                    openedBy: userId,
                },
                update: {
                    labelFr: campaign.name,
                    labelEn: campaign.name,
                    periodStart: campaign.startDate ?? undefined,
                    periodEnd,
                    deadline: periodEnd,
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

    /** Closes the SubmissionRound tied to this campaign, if one is open. */
    private async _closeCollectionRound(campaignId: string, userId?: string) {
        await this.prisma.submissionRound.updateMany({
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

        const where: any = { establishmentId: { not: null } };
        if (campaign.targetRegions?.length) where.region = { in: campaign.targetRegions };
        if (campaign.targetDepartments?.length) where.department = { in: campaign.targetDepartments };
        // FIX: targetEntityTypes was selected in the create-campaign UI and
        // stored on the campaign, but never actually used to filter who gets
        // a submission record — every company in the targeted region(s)
        // was initialized regardless of entity type.
        if (campaign.targetEntityTypes?.length) where.entityType = { in: campaign.targetEntityTypes };

        const establishments = await db.company.findMany({
            where,
            select: { id: true, establishmentId: true },
        });

        // FIX: one upsert per establishment (N sequential round-trips inside
        // the activation transaction) made creating a broadly-targeted —
        // especially "all" — campaign take a very long time. A single bulk
        // insert does the same job (skipDuplicates mirrors the old upsert's
        // update: {} no-op on conflict) in one round-trip.
        await db.campaignSubmission.createMany({
            data: establishments
                .filter((est) => est.establishmentId)
                .map((est) => ({
                    campaignId,
                    companyId: est.id,
                    establishmentId: est.establishmentId!,
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
    private buildPeriodSuffix(type: string, startDate: Date): string {
        const year = startDate.getFullYear();
        const quarter = Math.ceil((startDate.getMonth() + 1) / 3); // 1..4

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
    private async generateCampaignCode(type: string, startDate?: Date): Promise<string> {
        const d = startDate ?? new Date();
        const year = d.getFullYear();
        const quarter = Math.ceil((d.getMonth() + 1) / 3);

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