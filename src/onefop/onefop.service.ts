// src/onefop/onefop.service.ts
import {
    Injectable,
    ForbiddenException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnefopSubmissionDto } from '../dto/onefop-submission.dto';

@Injectable()
export class OnefopService {
    constructor(private prisma: PrismaService) { }

    async submitForm(userId: string, dto: OnefopSubmissionDto) {
        const { data, entityType, isDraft, formId, establishmentId, quarterCode, __meta } = dto;

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
            surveyYear: new Date().getFullYear(),
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
        }));
    }

    async getSubmissionDetail(userId: string, submissionId: string) {
        const submission = await this.prisma.onefopSubmission.findFirst({
            where: { id: submissionId },
            include: { company: true }
        });

        if (!submission) {
            throw new NotFoundException('Submission not found');
        }

        return submission;
    }

    async getActiveQuarter() {
        const round = await this.prisma.submissionRound.findFirst({
            where: { status: { in: ['OPEN', 'EXTENDED'] } },
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