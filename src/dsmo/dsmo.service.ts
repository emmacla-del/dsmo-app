import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { SubmitDeclarationDto } from './dto/submit-declaration.dto';
import { UserRole, DeclarationStatus } from '../types/prisma.types';
import { ValidationService } from './validation.service';
import { AuditService } from './audit.service';
import { PdfService } from './pdf.service';
import * as fs from 'fs';

@Injectable()
export class DsmoService {
  constructor(
    private prisma: PrismaService,
    private validationService: ValidationService,
    private auditService: AuditService,
    private pdfService: PdfService,
  ) { }

  /** Generates DSMO-YYYY-NNNNNNN tracking number based on declaration count for the year. */
  private async generateTrackingNumber(year: number): Promise<string> {
    const count = await this.prisma.declaration.count({ where: { year } });
    const seq = String(count + 1).padStart(7, '0');
    return `DSMO-${year}-${seq}`;
  }

  async createOrUpdateCompany(userId: string, dto: CreateCompanyDto) {
    const companyData = {
      name: dto.name,
      parentCompany: dto.parentCompany,
      mainActivity: dto.mainActivity,
      secondaryActivity: dto.secondaryActivity,
      region: dto.region,
      department: dto.department,
      district: dto.district,
      address: dto.address,
      taxNumber: dto.taxNumber,
      cnpsNumber: dto.cnpsNumber,
      socialCapital: dto.socialCapital,
      totalEmployees: dto.totalEmployees,
      menCount: dto.menCount,
      womenCount: dto.womenCount,
      lastYearTotal: dto.lastYearTotal,
      recruitments: dto.recruitments,
      promotions: dto.promotions,
      dismissals: dto.dismissals,
      retirements: dto.retirements,
      deaths: dto.deaths,
    };

    const existing = await this.prisma.company.findUnique({ where: { userId } });
    try {
      if (existing) {
        const updated = await this.prisma.company.update({ where: { userId }, data: companyData });
        await this.auditService.log(userId, 'UPDATE_COMPANY', 'Company', existing.id, 'Updated company information');
        return updated;
      }
      const created = await this.prisma.company.create({ data: { userId, ...companyData } });
      await this.auditService.log(userId, 'CREATE_COMPANY', 'Company', created.id, 'Created new company');
      return created;
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        throw new ConflictException('Ce numéro contribuable (NIU) est déjà utilisé par une autre entreprise.');
      }
      throw err;
    }
  }

  async submitDeclaration(userId: string, dto: SubmitDeclarationDto) {
    let company = await this.prisma.company.findUnique({ where: { userId } });
    if (!company) {
      company = await this.createOrUpdateCompany(userId, dto.company);
    } else {
      company = await this.createOrUpdateCompany(userId, dto.company);
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

    // Add employees — explicit field mapping avoids unknown fields (e.g. otherCountry)
    // hitting Prisma and causing a rejected write.
    if (dto.employees && dto.employees.length > 0) {
      await this.prisma.employee.deleteMany({ where: { declarationId: declaration.id } });
      await this.prisma.employee.createMany({
        data: dto.employees.map((emp) => ({
          fullName: emp.fullName,
          gender: emp.gender,
          age: emp.age,
          nationality: emp.nationality,
          diploma: emp.diploma ?? null,
          function: emp.function,
          seniority: emp.seniority,
          salaryCategory: emp.salaryCategory ?? null,
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

    // Generate tracking number and PDFs
    const trackingNumber = await this.generateTrackingNumber(dto.year);
    const submittedAt = new Date();

    const fullDeclaration = await this.prisma.declaration.findUnique({
      where: { id: declaration.id },
      include: { employees: true, movements: true, qualitativeQuestions: true },
    });
    if (!fullDeclaration) throw new NotFoundException('Declaration not found after save');

    const q = fullDeclaration.qualitativeQuestions[0];
    const pdfData: import('./pdf.service').PdfData = {
      trackingNumber,
      year: dto.year,
      fillingDate: dto.fillingDate,
      company: {
        name: company.name,
        parentCompany: company.parentCompany ?? undefined,
        mainActivity: company.mainActivity,
        secondaryActivity: company.secondaryActivity ?? undefined,
        region: company.region,
        department: company.department,
        district: company.district,
        address: company.address,
        taxNumber: company.taxNumber,
        cnpsNumber: company.cnpsNumber ?? undefined,
        socialCapital: company.socialCapital ?? undefined,
        totalEmployees: company.totalEmployees,
        menCount: company.menCount ?? undefined,
        womenCount: company.womenCount ?? undefined,
        recruitments: company.recruitments ?? undefined,
        promotions: company.promotions ?? undefined,
        dismissals: company.dismissals ?? undefined,
        retirements: company.retirements ?? undefined,
        deaths: company.deaths ?? undefined,
      },
      qualitative: q
        ? {
            hasTrainingCenter: q.hasTrainingCenter ?? undefined,
            recruitmentPlansNext: q.recruitmentPlansNext ?? undefined,
            camerounisationPlan: q.camerounisationPlan ?? undefined,
            usesTempAgencies: q.usesTempAgencies ?? undefined,
            tempAgencyDetails: q.tempAgencyDetails ?? undefined,
          }
        : undefined,
      employees: fullDeclaration.employees.map((e: { fullName: string; gender: string; age: number; nationality: string; diploma: string | null; function: string; seniority: number; salaryCategory: string | null }) => ({
        fullName: e.fullName,
        gender: e.gender,
        age: e.age,
        nationality: e.nationality,
        diploma: e.diploma ?? undefined,
        function: e.function,
        seniority: e.seniority,
        salaryCategory: e.salaryCategory ?? undefined,
      })),
    };

    let pdfUrls: string[] = [];
    let fileHashes: string[] = [];
    try {
      const result = await this.pdfService.generateDeclarationPdfs(pdfData);
      pdfUrls = result.urls;
      fileHashes = result.hashes;
    } catch (pdfError) {
      // PDF failure should not block submission
      console.error('PDF generation error:', pdfError);
    }

    // Update status to SUBMITTED, store tracking number and PDF URLs
    const submitted = await this.prisma.declaration.update({
      where: { id: declaration.id },
      data: {
        status: DeclarationStatus.SUBMITTED,
        submittedAt,
        pdfUrl: pdfUrls[0] ?? null,
        receiptUrl: pdfUrls[1] ?? null,
        qrCode: trackingNumber,
      },
      include: { employees: true },
    });

    await this.auditService.log(
      userId, 'SUBMIT_DECLARATION', 'Declaration', submitted.id,
      `Submitted DSMO declaration for year ${dto.year} — ${trackingNumber}`,
    );

    const nextYear = dto.year + 1;
    return {
      success: true,
      message: 'Déclaration enregistrée avec succès',
      trackingNumber,
      submissionDeadline: `31/01/${nextYear}`,
      pdfUrls,
      fileHashes,
      generatedAt: submittedAt.toISOString(),
      declaration: submitted,
    };
  }

  /** Returns the local file path for a PDF copy of the given declaration. */
  async getPdfPath(declarationId: string, userId: string, copy: number): Promise<string> {
    const declaration = await this.getDeclarationWithAccess(userId, declarationId);
    const trackingNumber = declaration.qrCode; // we store tracking number in qrCode field
    if (!trackingNumber) throw new NotFoundException('PDF not yet generated for this declaration');

    const filePath = this.pdfService.getFilePath(trackingNumber, declaration.year, copy);
    if (!fs.existsSync(filePath)) throw new NotFoundException(`PDF copy ${copy} not found`);
    return filePath;
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
    if (!user) throw new NotFoundException('User not found');
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
    if (!user) throw new NotFoundException('User not found');
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
    if (!user) throw new NotFoundException('User not found');
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
    if (!user) throw new NotFoundException('User not found');
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
