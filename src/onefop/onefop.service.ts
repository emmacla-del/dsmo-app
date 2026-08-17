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
                throw new BadRequestException(activeQuarter.message);
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

        const { quarterCode, entityType, draftData } = params;
        return this.prisma.submissionDraft.upsert({
            where: { establishmentId_quarterCode: { establishmentId: company.establishmentId, quarterCode } },
            update: { entityType: entityType?.toUpperCase() as any, draftData, lastSavedAt: new Date(), savedByUserId: userId },
            create: {
                establishmentId: company.establishmentId,
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

        // Role-based filtering
        if (user.role === 'DIVISIONAL' && user.department) {
            where.department = user.department;
        } else if (user.role === 'REGIONAL' && user.region) {
            where.region = user.region;
        } else if (user.role === 'COMPANY') {
            const company = await this.prisma.company.findFirst({ where: { userId: user.id } });
            if (!company) return [];
            where.companyId = company.id;
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
    /// roles listed on these endpoints (DIVISIONAL/REGIONAL/CENTRAL/
    /// SUPER_ADMIN*) are trusted reviewer roles with no per-record scoping
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
        const round = await this.prisma.submissionRound.findFirst({
            where: {
                module: 'ONEFOP',
                status: { in: ['OPEN', 'EXTENDED'] },
                deadline: { gte: new Date() },
            },
            orderBy: { openedAt: 'desc' },
        });
        if (!round) {
            return {
                isOpen: false,
                code: null,
                message: "Aucune période de soumission n'est actuellement ouverte.",
            };
        }
        return {
            isOpen: true,
            code: round.quarterCode,
            label: round.labelFr,
            deadline: round.deadline,
        };
    }

    private getEntityTypeLabel(entityType: string): string {
        const labels: Record<string, string> = {
            'ENTREPRISE': 'Entreprise',
            'COOPERATIVE': 'Coopérative',
            'CTD': 'CTD',
            'ONG': 'ONG',
        };
        return labels[entityType] || entityType;
    }
}