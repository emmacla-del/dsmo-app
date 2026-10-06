// src/onefop/onefop.service.ts
import {
    Injectable,
    ForbiddenException,
    ConflictException,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnefopSubmissionDto } from '../dto/onefop-submission.dto';
import { OnefopSubmissionPdfService } from '../pdf/onefop-submission-pdf.service';
import { surveyYearFromQuarterCode } from '../services/pdf-data-mapper.service';
import { territoryFromUser, territoryWhere } from '../auth/territory';

@Injectable()
export class OnefopService {
    constructor(
        private prisma: PrismaService,
        private pdfService: OnefopSubmissionPdfService,
    ) { }

    async submitForm(userId: string, dto: OnefopSubmissionDto) {
        const { data, entityType, isDraft, formId, establishmentId, quarterCode, __meta } = dto;

        // Re-validated here (not just client-side) so an offline-queued
        // submission that fires after the round has since closed is
        // rejected rather than silently accepted late. Only gates the real
        // submission — the isDraft write is just an autosave-adjacent status,
        // not a legal filing.
        if (!isDraft) {
            const activeQuarter = await this.getActiveQuarter();
            if (!activeQuarter.isOpen) {
                throw new ForbiddenException(
                    activeQuarter.message ??
                    "La période de collecte n'est pas ouverte aux soumissions.",
                );
            }
        }

        // NORMALIZE entityType to uppercase (database expects ENTREPRISE, COOPERATIVE, CTD, ONG)
        const normalizedEntityType = entityType?.toUpperCase() || 'ENTREPRISE';

        // Get user's company
        const company = await this.prisma.company.findFirst({
            where: { userId }
        });

        if (!company) {
            throw new ForbiddenException('No company profile found');
        }

        // Check for existing submission
        const existing = await this.prisma.onefopSubmission.findFirst({
            where: {
                companyId: company.id,
                quarterCode: quarterCode || '2025-T1',
                status: isDraft ? 'DRAFT' : { not: 'DRAFT' }
            }
        });

        if (existing && !isDraft) {
            throw new ConflictException('A submission already exists for this quarter');
        }

        const submissionData: any = {
            submissionId: formId,
            formType: normalizedEntityType,  // ← USING NORMALIZED VALUE
            status: isDraft ? 'DRAFT' : 'PENDING_REVIEW',
            rawData: data,
            surveyYear: surveyYearFromQuarterCode(quarterCode || '2025-T1'),
            companyId: company.id,
            submittedBy: userId,
            quarterCode: quarterCode || '2025-T1',
            establishmentId: establishmentId || company.establishmentId,
            taxNumber: __meta?.taxNumber || company.taxNumber,
            cnpsNumber: __meta?.cnpsNumber || company.cnpsNumber,
            registrationNumber: __meta?.registrationNumber || company.registrationNumber,
            metaJson: __meta || {},
        };

        if (existing && isDraft) {
            return this.prisma.onefopSubmission.update({
                where: { id: existing.id },
                data: {
                    rawData: data,
                    updatedAt: new Date(),
                }
            });
        } else if (existing && !isDraft) {
            return this.prisma.onefopSubmission.update({
                where: { id: existing.id },
                data: {
                    status: 'PENDING_REVIEW',
                    rawData: data,
                    updatedAt: new Date(),
                }
            });
        } else {
            return this.prisma.onefopSubmission.create({
                data: submissionData
            });
        }
    }

    async previewForm(userId: string, dto: OnefopSubmissionDto) {
        // Validate company exists
        const company = await this.prisma.company.findFirst({
            where: { userId }
        });

        if (!company) {
            throw new ForbiddenException('No company profile found');
        }

        return { success: true, message: 'Preview ready', data: dto.data };
    }

    /**
     * Autosave / resume support for OnefopUnifiedFormScreenV4, wired up
     * through home_screen.dart. One slot per establishment+quarter (see
     * SubmissionDraft's @@unique) — a fresh autosave overwrites the
     * previous one. Deliberately independent of OnefopSubmission/its
     * DRAFT status (that's a legacy marker on already-submitted rows, see
     * `getSubmissions`' status filter), so this can't interfere with the
     * real submit flow in `submitForm`.
     */
    async saveDraft(userId: string, params: { quarterCode: string; entityType: string; draftData: any }) {
        const company = await this.prisma.company.findFirst({ where: { userId } });
        if (!company) throw new ForbiddenException('No company profile found');
        // Company.establishmentId is nullable, SubmissionDraft.establishmentId
        // is not: without this guard a company whose site code has not been
        // issued yet drives a null into the composite unique key, which Prisma
        // rejects as a 500. Answer 400 with a message the respondent can act on.
        if (!company.establishmentId) {
            throw new BadRequestException(
                "Votre établissement n'a pas encore d'identifiant (code site). Impossible d'enregistrer un brouillon avant son attribution.",
            );
        }
        const establishmentId = company.establishmentId;

        const { quarterCode, entityType, draftData } = params;
        return this.prisma.submissionDraft.upsert({
            where: { establishmentId_quarterCode: { establishmentId, quarterCode } },
            update: { entityType: entityType?.toUpperCase() as any, draftData, lastSavedAt: new Date(), savedByUserId: userId },
            create: {
                establishmentId,
                quarterCode,
                entityType: entityType?.toUpperCase() as any,
                draftData,
                savedByUserId: userId,
            },
        });
    }

    async getDrafts(userId: string) {
        const company = await this.prisma.company.findFirst({ where: { userId } });
        if (!company) return [];
        return this.prisma.submissionDraft.findMany({
            where: { establishmentId: company.establishmentId },
            orderBy: { lastSavedAt: 'desc' },
        });
    }

    async deleteDraft(userId: string, quarterCode: string) {
        const company = await this.prisma.company.findFirst({ where: { userId } });
        if (!company) return;
        await this.prisma.submissionDraft.deleteMany({
            where: { establishmentId: company.establishmentId, quarterCode },
        });
    }

    async getSubmissions(user: any, filters: {
        status?: string;
        entityType?: string;
        region?: string;
        establishmentId?: string;
        quarterCode?: string;
    }) {
        const where: any = {};

        if (filters.status) where.status = filters.status;
        // NORMALIZE entityType filter to uppercase
        if (filters.entityType) where.formType = filters.entityType.toUpperCase();
        if (filters.establishmentId) where.establishmentId = filters.establishmentId;
        if (filters.quarterCode) where.quarterCode = filters.quarterCode;

        // Role-based filtering. COMPANY sees its own rows; every other role is
        // scoped by territoryWhere, which fails closed: a REGIONAL_ADMIN with
        // no region or a DIVISIONAL_ADMIN with no department matches nothing
        // instead of falling through to the national list, and DIVISIONAL
        // matches region AND department (department names repeat by region).
        if (user.role === 'COMPANY') {
            const company = await this.prisma.company.findFirst({ where: { userId: user.id } });
            if (!company) return [];
            where.companyId = company.id;
        } else {
            Object.assign(where, territoryWhere(territoryFromUser(user)));
        }

        // The `region` query parameter only narrows: it is ANDed with the
        // territory scope above, so a territorial caller naming another
        // region gets an empty list (not their own, not the other region's).
        const regionFilter = filters.region?.trim();
        if (regionFilter) {
            where.AND = [{ region: { equals: regionFilter, mode: 'insensitive' } }];
        }

        const submissions = await this.prisma.onefopSubmission.findMany({
            where,
            include: {
                company: {
                    select: { name: true, region: true, department: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Transform to match frontend expected format
        return submissions.map(s => ({
            id: s.id,
            submissionId: s.submissionId,
            establishmentId: s.establishmentId,
            establishmentName: s.company?.name,
            quarterCode: s.quarterCode,
            status: s.status,
            entityType: s.formType,
            entityTypeLabel: this.getEntityTypeLabel(s.formType),
            submittedAt: s.createdAt,
            region: s.company?.region,
            department: s.company?.department,
            flagCount: Array.isArray(s.flags) ? s.flags.length : 0,
        }));
    }

    async getSubmissionDetail(user: any, submissionId: string) {
        const submission = await this.prisma.onefopSubmission.findFirst({
            where: { id: submissionId },
            include: { company: true }
        });

        if (!submission) {
            throw new NotFoundException('Submission not found');
        }

        await this.assertCanAccessSubmission(user, submission.companyId);

        return submission;
    }

    async getSubmissionPdfUrl(submissionId: string, user: any): Promise<string> {
        const submission = await this.prisma.onefopSubmission.findFirst({
            where: { id: submissionId },
        });

        if (!submission) {
            throw new NotFoundException('Submission not found');
        }

        await this.assertCanAccessSubmission(user, submission.companyId);

        return this.pdfService.getSignedUrl(submission);
    }

    /// A COMPANY user may only reach their own submissions — the other
    /// roles listed on these endpoints (DIVISIONAL_ADMIN / REGIONAL_ADMIN /
    /// ADMIN_ONEFOP / SUPER_ADMIN) are trusted reviewer roles with no scoping
    /// today, so this only tightens the newly-added COMPANY case.
    private async assertCanAccessSubmission(user: any, companyId: string) {
        if (user.role !== 'COMPANY') return;
        const company = await this.prisma.company.findFirst({ where: { userId: user.id } });
        if (!company || company.id !== companyId) {
            throw new ForbiddenException('Access denied');
        }
    }

    async getActiveQuarter() {
        // `deadline` is checked directly rather than trusting `status` alone:
        // a round is only flipped to CLOSED by a daily cron that can miss its
        // firing (e.g. Render free-tier idle spin-down), so a round can sit
        // OPEN past its own deadline.
        const openRound = await this.prisma.submissionRound.findFirst({
            where: {
                module: 'ONEFOP',
                status: { in: ['OPEN', 'EXTENDED'] },
                deadline: { gte: new Date() },
            },
            orderBy: { openedAt: 'desc' },
        });

        // No genuinely open round: fall back to the most recent one so the
        // respondent can still be told *which* period is closed, and so
        // `code` stays populated. `code` is not cosmetic — it is the draft
        // key on both the server (OnefopDraft) and the client (IndexedDB via
        // useOnefopDraft), and the Save-draft button is disabled when it is
        // missing. Returning a null code here would lock respondents out of
        // saving work in progress and silently re-key existing drafts, which
        // is worse than the closed period itself. Drafts stay writable while
        // closed by design: only the final filing is gated (see submitForm).
        let round = openRound;
        if (!round) {
            round = await this.prisma.submissionRound.findFirst({
                where: { module: 'ONEFOP' },
                orderBy: { createdAt: 'desc' },
            });
        }

        // Reported to the respondent verbatim (ActiveQuarter.message in
        // react-web/src/lib/onefop-submission.ts). French to match `labelFr`,
        // which is the only other human-readable string on this payload.
        const closedMessage = (r: { deadline: Date; labelFr: string }) =>
            r.deadline < new Date()
                ? `La période de collecte « ${r.labelFr} » est close depuis le ${r.deadline.toLocaleDateString('fr-FR')}.`
                : `La période de collecte « ${r.labelFr} » n'est pas ouverte aux soumissions.`;

        if (!round) {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
            const quarterCode = `${currentYear}-T${currentQuarter}`;
            // Deliberately still open: this branch is only reached when the
            // SubmissionRound table holds no ONEFOP round whatsoever, i.e. a
            // fresh or local database that has never run a campaign. It is an
            // explicit test affordance (note the label), and the honesty fix
            // below is scoped to real rounds. Flipping this to false would
            // make a seed-less environment unable to submit at all.
            return {
                isOpen: true,
                code: quarterCode,
                label: `Trimestre ${currentQuarter} ${currentYear} (Période test)`,
                deadline: new Date(currentYear, 11, 31, 23, 59, 59),
                periodStart: new Date(currentYear, (currentQuarter - 1) * 3, 1),
                periodEnd: new Date(currentYear, currentQuarter * 3, 0),
            };
        }
        const isOpen = round.id === openRound?.id;
        return {
            isOpen,
            ...(isOpen ? {} : { message: closedMessage(round) }),
            code: round.quarterCode,
            label: round.labelFr,
            deadline: round.deadline,
            // The round's own data-collection period — the calendar
            // quarter/semester/year the campaign covers (e.g. 01/01-31/03
            // for a Q1 QUARTERLY campaign), computed once at round-open time
            // from the campaign's type/startDate (see
            // CampaignService.computeCollectionPeriod()). This is the single
            // source of truth the questionnaire itself (S21Q01's dynamic
            // period wording) reads. Deliberately independent of `deadline`
            // above (the submission cutoff, which can be extended without
            // changing what period the collected data covers).
            periodStart: round.periodStart,
            periodEnd: round.periodEnd,
        };
    }

    private getEntityTypeLabel(entityType: string): string {
        const labels: Record<string, string> = {
            'ENTREPRISE': 'Entreprise',
            'COOPERATIVE': 'Coopérative',
            'CTD': 'CTD',
            'ONG': 'ONG',
            'VOCATIONAL_TRAINING': 'Formation professionnelle',
        };
        return labels[entityType] || entityType;
    }
}