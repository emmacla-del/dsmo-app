import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { SubmitDeclarationDto } from './dto/submit-declaration.dto';
import { UserRole, DeclarationStatus } from '../types/prisma.types';
import { ValidationService } from './validation.service';
import { AuditService } from './audit.service';

@Injectable()
export class DsmoService {
  constructor(
    private prisma: PrismaService,
    private validationService: ValidationService,
    private auditService: AuditService,
  ) { }

  async createOrUpdateCompany(userId: string, dto: CreateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { userId } });
    if (existing) {
      const updated = await this.prisma.company.update({ where: { userId }, data: dto });
      await this.auditService.log(userId, 'UPDATE_COMPANY', 'Company', existing.id, 'Updated company information');
      return updated;
    }
    const created = await this.prisma.company.create({ data: { userId, ...dto } });
    await this.auditService.log(userId, 'CREATE_COMPANY', 'Company', created.id, 'Created new company');
    return created;
  }

  async submitDeclaration(userId: string, dto: SubmitDeclarationDto) {
    let company = await this.prisma.company.findUnique({ where: { userId } });
    if (!company) {
      company = await this.createOrUpdateCompany(userId, dto.company);
    } else {
      company = await this.prisma.company.update({ where: { userId }, data: dto.company });
    }

    // Check if declaration already exists for this year
    const existingDecl = await this.prisma.declaration.findFirst({
      where: { companyId: company.id, year: dto.year, status: { notIn: [DeclarationStatus.REJECTED, DeclarationStatus.DRAFT] } },
    });
    if (existingDecl) throw new ForbiddenException('A declaration already exists for this year and status');

    // Validate data before submission
    let declaration = await this.prisma.declaration.findFirst({
      where: { companyId: company.id, year: dto.year, status: DeclarationStatus.DRAFT },
    });

    if (!declaration) {
      declaration = await this.prisma.declaration.create({
        data: {
          year: dto.year,
          companyId: company.id,
          region: company.region,
          division: company.department,
          status: DeclarationStatus.DRAFT,
        },
      });
    }

    // Add employees
    if (dto.employees && dto.employees.length > 0) {
      await this.prisma.employee.deleteMany({ where: { declarationId: declaration.id } });
      await this.prisma.employee.createMany({
        data: dto.employees.map((emp) => ({
          ...emp,
          declarationId: declaration.id,
        })),
      });
    }

    // Save movements (quarterly breakdown by salary category)
    if (dto.movements && dto.movements.length > 0) {
      await this.prisma.declarationMovement.deleteMany({ where: { declarationId: declaration.id } });
      await this.prisma.declarationMovement.createMany({
        data: dto.movements.map((m) => ({
          movementType: m.movementType,
          cat1_3: m.cat1_3 ?? 0,
          cat4_6: m.cat4_6 ?? 0,
          cat7_9: m.cat7_9 ?? 0,
          cat10_12: m.cat10_12 ?? 0,
          declarationId: declaration.id,
        })),
      });
    }

    // Save qualitative questions (informations supplémentaires)
    if (dto.qualitative) {
      await this.prisma.qualitativeQuestion.deleteMany({ where: { declarationId: declaration.id } });
      await this.prisma.qualitativeQuestion.create({
        data: {
          declarationId: declaration.id,
          questionText: 'Informations supplémentaires',
          hasTrainingCenter: dto.qualitative.hasTrainingCenter,
          recruitmentPlansNext: dto.qualitative.recruitmentPlansNext,
          camerounisationPlan: dto.qualitative.camerounisationPlan,
          usesTempAgencies: dto.qualitative.usesTempAgencies,
          tempAgencyDetails: dto.qualitative.tempAgencyDetails,
        },
      });
    }

    // Save filling date
    if (dto.fillingDate) {
      await this.prisma.declaration.update({
        where: { id: declaration.id },
        data: { fillingDate: new Date(dto.fillingDate) },
      });
    }

    // Run validation
    const validationResult = await this.validationService.validateDeclaration(declaration.id);
    if (!validationResult.isValid) {
      throw new BadRequestException(`Validation failed: ${validationResult.errors.join('; ')}`);
    }

    // Update status to SUBMITTED
    const submitted = await this.prisma.declaration.update({
      where: { id: declaration.id },
      data: {
        status: DeclarationStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: { employees: true },
    });

    await this.auditService.log(userId, 'SUBMIT_DECLARATION', 'Declaration', submitted.id, `Submitted DSMO declaration for year ${dto.year}`);

    return submitted;
  }

  async getPendingDeclarations(user: any) {
    const where: any = { status: { in: [DeclarationStatus.SUBMITTED, DeclarationStatus.DIVISION_APPROVED, DeclarationStatus.REGION_APPROVED] } };

    if (user.role === UserRole.DIVISIONAL) {
      if (!user.department) throw new ForbiddenException('No department assigned');
      where.division = user.department;
    } else if (user.role === UserRole.REGIONAL) {
      if (!user.region) throw new ForbiddenException('No region assigned');
      where.region = user.region;
    } else if (user.role === UserRole.COMPANY) {
      throw new ForbiddenException('Companies cannot view pending declarations');
    } else if (user.role !== UserRole.CENTRAL) {
      throw new ForbiddenException('Insufficient privileges');
    }

    return this.prisma.declaration.findMany({
      where,
      include: { company: true, employees: true, validationSteps: true },
      orderBy: { submittedAt: 'desc' }
    });
  }

  async approveDeclaration(declarationId: string, userId: string, notes?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const declaration = await this.getDeclarationWithAccess(userId, declarationId);

    let nextStatus: DeclarationStatus;

    if (user.role === UserRole.DIVISIONAL) {
      if (declaration.status !== DeclarationStatus.SUBMITTED) {
        throw new BadRequestException('Declaration must be SUBMITTED to approve at divisional level');
      }
      nextStatus = DeclarationStatus.DIVISION_APPROVED;
    } else if (user.role === UserRole.REGIONAL) {
      if (declaration.status !== DeclarationStatus.DIVISION_APPROVED) {
        throw new BadRequestException('Declaration must be DIVISION_APPROVED to approve at regional level');
      }
      nextStatus = DeclarationStatus.REGION_APPROVED;
    } else if (user.role === UserRole.CENTRAL) {
      if (declaration.status !== DeclarationStatus.REGION_APPROVED) {
        throw new BadRequestException('Declaration must be REGION_APPROVED to approve at central level');
      }
      nextStatus = DeclarationStatus.FINAL_APPROVED;
    } else {
      throw new ForbiddenException('Only DIVISIONAL, REGIONAL, or CENTRAL users can approve');
    }

    const updated = await this.prisma.declaration.update({
      where: { id: declarationId },
      data: {
        status: nextStatus,
        validatedBy: userId,
        validatedAt: new Date(),
      },
    });

    await this.auditService.log(userId, 'APPROVE_DECLARATION', 'Declaration', declarationId, `Approved to ${nextStatus}. Notes: ${notes || 'None'}`);

    return updated;
  }

  async rejectDeclaration(declarationId: string, userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const declaration = await this.getDeclarationWithAccess(userId, declarationId);

    if (![DeclarationStatus.SUBMITTED, DeclarationStatus.DIVISION_APPROVED, DeclarationStatus.REGION_APPROVED].includes(declaration.status)) {
      throw new BadRequestException('Cannot reject a declaration in this status');
    }

    if (![UserRole.DIVISIONAL, UserRole.REGIONAL, UserRole.CENTRAL].includes(user.role)) {
      throw new ForbiddenException('Only DIVISIONAL, REGIONAL, or CENTRAL users can reject');
    }

    const updated = await this.prisma.declaration.update({
      where: { id: declarationId },
      data: {
        status: DeclarationStatus.REJECTED,
        rejectionReason: reason,
        validatedBy: userId,
        validatedAt: new Date(),
      },
    });

    await this.auditService.log(userId, 'REJECT_DECLARATION', 'Declaration', declarationId, `Rejected with reason: ${reason}`);

    return updated;
  }

  async getDeclarationWithAccess(userId: string, declarationId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const declaration = await this.prisma.declaration.findUnique({
      where: { id: declarationId },
      include: { company: true, employees: true, movements: true, qualitativeQuestions: true, validationSteps: true },
    });

    if (!declaration) throw new NotFoundException('Declaration not found');

    // Check access based on role
    if (user.role === UserRole.COMPANY && declaration.company.userId !== userId) {
      throw new ForbiddenException('Cannot access this declaration');
    }

    if (user.role === UserRole.DIVISIONAL && user.department !== declaration.division) {
      throw new ForbiddenException('Cannot access declarations outside your division');
    }

    if (user.role === UserRole.REGIONAL && user.region !== declaration.region) {
      throw new ForbiddenException('Cannot access declarations outside your region');
    }

    return declaration;
  }

  async validateDeclaration(declarationId: string, userId: string, accept: boolean, rejectionReason?: string) {
    const declaration = await this.prisma.declaration.findUnique({ where: { id: declarationId } });
    if (!declaration) throw new NotFoundException('Declaration not found');
    if (declaration.status !== DeclarationStatus.SUBMITTED) throw new ForbiddenException('Only SUBMITTED declarations can be validated');

    if (accept) {
      return this.approveDeclaration(declarationId, userId);
    } else {
      return this.rejectDeclaration(declarationId, userId, rejectionReason || 'No reason provided');
    }
  }

  async getDeclarationsForUser(userId: string, filters?: { year?: number; status?: DeclarationStatus; region?: string; department?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const where: any = {};

    // Build filter based on role
    if (user.role === UserRole.COMPANY) {
      const company = await this.prisma.company.findUnique({ where: { userId } });
      where.companyId = company?.id;
    } else if (user.role === UserRole.DIVISIONAL) {
      where.division = user.department;
    } else if (user.role === UserRole.REGIONAL) {
      where.region = user.region;
    }
    // CENTRAL can see all

    // Apply additional filters
    if (filters?.year) where.year = filters.year;
    if (filters?.status) where.status = filters.status;
    if (filters?.region && user.role === UserRole.CENTRAL) where.region = filters.region;
    if (filters?.department && user.role === UserRole.CENTRAL) where.division = filters.department;

    return this.prisma.declaration.findMany({
      where,
      include: { company: true, employees: true, movements: true, qualitativeQuestions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeclarationStats(year: number, region?: string, department?: string) {
    const where: any = { year };
    if (region) where.region = region;
    if (department) where.division = department;

    const stats = {
      total: await this.prisma.declaration.count({ where }),
      submitted: await this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.SUBMITTED } }),
      divisionApproved: await this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.DIVISION_APPROVED } }),
      regionApproved: await this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.REGION_APPROVED } }),
      finalApproved: await this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.FINAL_APPROVED } }),
      rejected: await this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.REJECTED } }),
    };

    return stats;
  }
}
