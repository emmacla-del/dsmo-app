import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { SubmitDeclarationDto } from './dto/submit-declaration.dto';
import { UserRole, DeclarationStatus, MovementType } from '../types/prisma.types';
import { ValidationService } from './validation.service';
import { AuditService } from './audit.service';
import { PdfService, PdfData } from './pdf.service';
import * as fs from 'fs';

@Injectable()
export class DsmoService {
  constructor(
    private prisma: PrismaService,
    private validationService: ValidationService,
    private auditService: AuditService,
    private pdfService: PdfService,
  ) { }

  /**
   * Generates a unique tracking number for official submissions.
   */
  private async generateTrackingNumber(year: number): Promise<string> {
    const count = await this.prisma.declaration.count({
      where: { year, status: { not: DeclarationStatus.DRAFT } },
    });
    const seq = String(count + 1).padStart(7, '0');
    return `DSMO-${year}-${seq}`;
  }

  /**
   * Synchronizes company profile data.
   */
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
    };

    try {
      const company = await this.prisma.company.upsert({
        where: { userId },
        update: companyData,
        create: { userId, ...companyData },
      });

      await this.auditService.log(userId, 'UPDATE_COMPANY', 'Company', company.id, 'Mise à jour du profil entreprise');
      return company;
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException('Le numéro contribuable (NIU) est déjà utilisé.');
      }
      throw err;
    }
  }

  /**
   * Main entry point for submitting a DSMO declaration.
   */
  async submitDeclaration(userId: string, dto: SubmitDeclarationDto) {
    const company = await this.createOrUpdateCompany(userId, dto.company);

    const existingDecl = await this.prisma.declaration.findFirst({
      where: {
        companyId: company.id,
        year: dto.year,
        status: { notIn: [DeclarationStatus.REJECTED, DeclarationStatus.DRAFT] },
      },
    });
    if (existingDecl) {
      throw new ForbiddenException(`Une déclaration pour l'année ${dto.year} est déjà active.`);
    }

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

    // Atomic data persistence
    await this.prisma.$transaction([
      this.prisma.employee.deleteMany({ where: { declarationId: declaration.id } }),
      this.prisma.employee.createMany({
        data: dto.employees.map((emp) => ({
          ...emp,
          declarationId: declaration.id,
          diploma: emp.diploma ?? null,
          salaryCategory: emp.salaryCategory ?? null,
        })),
      }),
      this.prisma.declarationMovement.deleteMany({ where: { declarationId: declaration.id } }),
      this.prisma.declarationMovement.createMany({
        data: (dto.movements || []).map((m) => ({
          ...m,
          declarationId: declaration.id,
        })),
      }),
      this.prisma.qualitativeQuestion.deleteMany({ where: { declarationId: declaration.id } }),
      this.prisma.qualitativeQuestion.create({
        data: {
          declarationId: declaration.id,
          questionText: 'Informations qualitatives DSMO',
          ...dto.qualitative,
        },
      }),
    ]);

    const validation = await this.validationService.validateDeclaration(declaration.id);
    if (!validation.isValid) {
      throw new BadRequestException(`Validation échouée: ${validation.errors.join('; ')}`);
    }

    const trackingNumber = await this.generateTrackingNumber(dto.year);
    const fullDecl = await this.prisma.declaration.findUniqueOrThrow({
      where: { id: declaration.id },
      include: { employees: true, movements: true, qualitativeQuestions: true },
    });

    // Solve TS7006 by explicitly typing 'mv'
    const getMovement = (type: MovementType) => {
      const m = fullDecl.movements.find((mv: any) => mv.movementType === type);
      return m ? {
        cat1_3: m.cat1_3, cat4_6: m.cat4_6, cat7_9: m.cat7_9,
        cat10_12: m.cat10_12, catNonDeclared: m.catNonDeclared
      } : undefined;
    };

    const { urls, hashes } = await this.pdfService.generateDeclarationPdfs({
      trackingNumber,
      year: dto.year,
      fillingDate: dto.fillingDate || new Date().toISOString(),
      language: dto.language ?? 'fr',
      company: {
        ...company,
        recruitments: getMovement(MovementType.RECRUITMENT),
        promotions: getMovement(MovementType.PROMOTION),
        dismissals: getMovement(MovementType.DISMISSAL),
        retirements: getMovement(MovementType.RETIREMENT),
        deaths: getMovement(MovementType.DEATH),
      },
      qualitative: fullDecl.qualitativeQuestions[0],
      employees: fullDecl.employees,
    });

    const submitted = await this.prisma.declaration.update({
      where: { id: declaration.id },
      data: {
        status: DeclarationStatus.SUBMITTED,
        submittedAt: new Date(),
        pdfUrl: urls[0],
        receiptUrl: urls[1],
        qrCode: trackingNumber,
        fillingDate: dto.fillingDate ? new Date(dto.fillingDate) : new Date(),
      },
    });

    await this.auditService.log(userId, 'SUBMIT_DECLARATION', 'Declaration', submitted.id, trackingNumber);

    return { success: true, trackingNumber, pdfUrls: urls, fileHashes: hashes };
  }

  /** Resolves TS2339: Logic for administrative 'Inbox' */
  async getPendingDeclarations(user: any) {
    const where: any = {
      status: { in: [DeclarationStatus.SUBMITTED, DeclarationStatus.DIVISION_APPROVED, DeclarationStatus.REGION_APPROVED] }
    };

    if (user.role === UserRole.DIVISIONAL) where.division = user.department;
    else if (user.role === UserRole.REGIONAL) where.region = user.region;
    else if (user.role === UserRole.COMPANY) throw new ForbiddenException('Accès refusé.');

    return this.prisma.declaration.findMany({
      where,
      include: { company: true, employees: true },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /** Resolves TS2339: Unified Validation handler */
  async validateDeclaration(declarationId: string, userId: string, accept: boolean, reason?: string) {
    return accept
      ? this.approveDeclaration(declarationId, userId)
      : this.rejectDeclaration(declarationId, userId, reason || 'Non précisé');
  }

  async approveDeclaration(declarationId: string, userId: string, notes?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const decl = await this.getDeclarationWithAccess(userId, declarationId);

    let nextStatus: DeclarationStatus;
    if (user.role === UserRole.DIVISIONAL) nextStatus = DeclarationStatus.DIVISION_APPROVED;
    else if (user.role === UserRole.REGIONAL) nextStatus = DeclarationStatus.REGION_APPROVED;
    else if (user.role === UserRole.CENTRAL) nextStatus = DeclarationStatus.FINAL_APPROVED;
    else throw new ForbiddenException('Privilèges insuffisants.');

    return this.prisma.declaration.update({
      where: { id: declarationId },
      data: { status: nextStatus, validatedBy: userId, validatedAt: new Date() },
    });
  }

  async rejectDeclaration(declarationId: string, userId: string, reason: string) {
    return this.prisma.declaration.update({
      where: { id: declarationId },
      data: {
        status: DeclarationStatus.REJECTED,
        rejectionReason: reason,
        validatedBy: userId,
        validatedAt: new Date(),
      },
    });
  }

  /** Resolves TS2339: Search and history retrieval */
  async getDeclarationsForUser(userId: string, filters: any) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const where: any = {};

    if (user.role === UserRole.COMPANY) {
      const comp = await this.prisma.company.findUnique({ where: { userId } });
      where.companyId = comp?.id;
    } else if (user.role === UserRole.DIVISIONAL) where.division = user.department;
    else if (user.role === UserRole.REGIONAL) where.region = user.region;

    if (filters.year) where.year = filters.year;
    if (filters.status) where.status = filters.status;

    return this.prisma.declaration.findMany({
      where,
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Resolves TS2339: PDF retrieval for streaming */
  async getPdfPath(declarationId: string, userId: string, copy: number): Promise<string> {
    const decl = await this.getDeclarationWithAccess(userId, declarationId);
    if (!decl.qrCode) throw new NotFoundException('Fichier PDF non disponible.');

    const path = this.pdfService.getFilePath(decl.qrCode, decl.year, copy);
    if (!fs.existsSync(path)) throw new NotFoundException('Le fichier physique est introuvable.');
    return path;
  }

  async getDeclarationWithAccess(userId: string, declarationId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const decl = await this.prisma.declaration.findUniqueOrThrow({
      where: { id: declarationId },
      include: { company: true, employees: true, movements: true, qualitativeQuestions: true },
    });

    if (user.role === UserRole.COMPANY && decl.company.userId !== userId) {
      throw new ForbiddenException('Accès interdit.');
    }
    return decl;
  }

  async getDeclarationStats(year: number, region?: string, department?: string) {
    const where: any = { year };
    if (region) where.region = region;
    if (department) where.division = department;

    const [total, submitted, approved, rejected] = await Promise.all([
      this.prisma.declaration.count({ where }),
      this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.SUBMITTED } }),
      this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.FINAL_APPROVED } }),
      this.prisma.declaration.count({ where: { ...where, status: DeclarationStatus.REJECTED } }),
    ]);

    return { total, submitted, approved, rejected };
  }
}