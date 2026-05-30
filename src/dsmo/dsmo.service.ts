// src/dsmo/dsmo.service.ts
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
import { EstablishmentIdGenerator } from '../common/utils/establishment-id.generator';

@Injectable()
export class DsmoService {
  constructor(
    private prisma: PrismaService,
    private validationService: ValidationService,
    private auditService: AuditService,
    private pdfService: PdfService,
  ) { }

  /**
   * Looks up the MINEFOP processing service for a company declaration.
   * Companies are handled at the DDEFOP (departmental) level.
   * Returns the service info for the PDF header, with its parent (DREFOP) if available.
   */
  private async resolveProcessingService(): Promise<PdfData['processingService']> {
    try {
      const svc = await this.prisma.minefopService.findUnique({
        where: { code: 'DDEFOP' },
      });
      if (!svc) return undefined;

      let parent: typeof svc | null = null;
      if (svc.parentCode) {
        parent = await this.prisma.minefopService.findUnique({ where: { code: svc.parentCode } });
      }

      return {
        name: svc.name,
        nameEn: svc.nameEn,
        acronym: svc.acronym,
        parentName: parent?.name ?? null,
        parentNameEn: parent?.nameEn ?? null,
        parentAcronym: parent?.acronym ?? null,
      };
    } catch {
      return undefined; // non-fatal — PDF falls back to static labels
    }
  }

  private async generateTrackingNumber(year: number): Promise<string> {
    const count = await this.prisma.declaration.count({
      where: { year, status: { not: DeclarationStatus.DRAFT } },
    });
    const seq = String(count + 1).padStart(7, '0');
    return `DSMO-${year}-${seq}`;
  }

  // ✅ UPDATED: getMyCompany with establishmentId fields
  async getMyCompany(userId: string) {
    const company = await this.prisma.company.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        taxNumber: true,
        cnpsNumber: true,
        registrationNumber: true,
        establishmentId: true,
        establishmentIdGeneratedAt: true,
        entityType: true,
        region: true,
        department: true,
        subdivision: true,
        address: true,
        phone: true,
        phone2: true,
        poBox: true,
        mainActivity: true,
        secondaryActivity: true,
        parentCompany: true,
        legalStatus: true,
        enterpriseSize: true,
        area: true,
        branch: true,
        respondentFirstName: true,
        respondentLastName: true,
        respondentFunction: true,
        respondentPhone: true,
        respondentPhone2: true,
      }
    });
    return company;
  }

  // ✅ UPDATED: saveCompanyProfile with establishmentId generation
  async saveCompanyProfile(userId: string, dto: any) {
    const subdivisionValue = dto.subdivision ?? dto.department ?? 'Non spécifié';

    // Check if company already exists
    const existing = await this.prisma.company.findUnique({
      where: { userId }
    });

    let establishmentId = dto.establishmentId;

    // Generate establishmentId if not provided and we have entityType
    if (!establishmentId && dto.entityType && !existing?.establishmentId) {
      // Get subdivision code
      let subdivisionCode = '00';
      if (dto.subdivision) {
        const subdivision = await this.prisma.subdivision.findFirst({
          where: { name: dto.subdivision }
        });
        subdivisionCode = subdivision?.code?.slice(-2) || '00';
      } else if (dto.department) {
        const department = await this.prisma.department.findFirst({
          where: { name: dto.department }
        });
        subdivisionCode = department?.code?.slice(-2) || '00';
      }

      establishmentId = await EstablishmentIdGenerator.generate(
        this.prisma,
        dto.entityType,
        subdivisionCode,
      );
    }

    const data = {
      name: dto.name,
      taxNumber: dto.taxNumber,
      mainActivity: dto.mainActivity,
      region: dto.region,
      department: dto.department,
      subdivision: subdivisionValue,
      address: dto.address,
      parentCompany: dto.parentCompany,
      secondaryActivity: dto.secondaryActivity,
      cnpsNumber: dto.cnpsNumber,
      fax: dto.fax,
      socialCapital: dto.socialCapital,
      ...(dto.entityType ? { entityType: dto.entityType as any } : {}),
      totalEmployees: 0,
      ...(establishmentId ? {
        establishmentId,
        establishmentIdGeneratedAt: new Date()
      } : {}),
    };

    try {
      const company = await this.prisma.company.upsert({
        where: { userId },
        update: {
          ...data,
          establishmentId: existing?.establishmentId || establishmentId,
        },
        create: { userId, ...data },
      });
      await this.auditService.log(userId, 'CREATE_COMPANY_PROFILE', 'Company', company.id, dto.name);
      return company;
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException('Le numéro contribuable (NIU) est déjà utilisé.');
      }
      throw err;
    }
  }

  // ✅ UPDATED: createOrUpdateCompany with establishmentId generation
  async createOrUpdateCompany(userId: string, dto: CreateCompanyDto) {
    const subdivisionValue = dto.subdivision ?? 'Non spécifié';

    // Check if company already exists
    const existing = await this.prisma.company.findUnique({
      where: { userId }
    });

    let establishmentId = (dto as any).establishmentId;

    // Generate establishmentId if not provided and we have entityType
    if (!establishmentId && (dto as any).entityType && !existing?.establishmentId) {
      let subdivisionCode = '00';
      if (dto.subdivision) {
        const subdivision = await this.prisma.subdivision.findFirst({
          where: { name: dto.subdivision }
        });
        subdivisionCode = subdivision?.code?.slice(-2) || '00';
      } else if (dto.department) {
        const department = await this.prisma.department.findFirst({
          where: { name: dto.department }
        });
        subdivisionCode = department?.code?.slice(-2) || '00';
      }

      establishmentId = await EstablishmentIdGenerator.generate(
        this.prisma,
        (dto as any).entityType,
        subdivisionCode,
      );
    }

    const companyData = {
      name: dto.name,
      parentCompany: dto.parentCompany,
      mainActivity: dto.mainActivity,
      secondaryActivity: dto.secondaryActivity,
      region: dto.region,
      department: dto.department,
      subdivision: subdivisionValue,
      address: dto.address,
      taxNumber: dto.taxNumber,
      cnpsNumber: dto.cnpsNumber,
      socialCapital: dto.socialCapital,
      totalEmployees: dto.totalEmployees,
      menCount: dto.menCount,
      womenCount: dto.womenCount,
      lastYearTotal: dto.lastYearTotal,
      lastYearMenCount: dto.lastYearMenCount,
      lastYearWomenCount: dto.lastYearWomenCount,
      ...(establishmentId ? {
        establishmentId,
        establishmentIdGeneratedAt: new Date()
      } : {}),
    };

    try {
      const company = await this.prisma.company.upsert({
        where: { userId },
        update: {
          ...companyData,
          establishmentId: existing?.establishmentId || establishmentId,
        },
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
          questionType: 'QUALITATIVE',
          section: 'GENERAL',
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

    const getMovement = (type: MovementType) => {
      const m = fullDecl.movements.find((mv: any) => mv.movementType === type);
      return m ? {
        cat1_3: m.cat1_3, cat4_6: m.cat4_6, cat7_9: m.cat7_9,
        cat10_12: m.cat10_12, catNonDeclared: m.catNonDeclared,
      } : undefined;
    };

    const processingService = await this.resolveProcessingService();
    const { urls, hashes } = await this.pdfService.generateDeclarationPdfs({
      trackingNumber,
      year: dto.year,
      fillingDate: dto.fillingDate || new Date().toISOString(),
      language: dto.language ?? 'fr',
      processingService,
      company: {
        ...company,
        parentCompany: company.parentCompany ?? undefined,
        secondaryActivity: company.secondaryActivity ?? undefined,
        fax: company.fax ?? undefined,
        cnpsNumber: company.cnpsNumber ?? undefined,
        socialCapital: company.socialCapital ?? undefined,
        menCount: company.menCount ?? undefined,
        womenCount: company.womenCount ?? undefined,
        lastYearMenCount: company.lastYearMenCount ?? undefined,
        lastYearWomenCount: company.lastYearWomenCount ?? undefined,
        lastYearTotal: company.lastYearTotal ?? undefined,
        recruitments: getMovement(MovementType.RECRUITMENT),
        promotions: getMovement(MovementType.PROMOTION),
        dismissals: getMovement(MovementType.DISMISSAL),
        retirements: getMovement(MovementType.RETIREMENT),
        deaths: getMovement(MovementType.DEATH),
      },
      qualitative: fullDecl.qualitativeQuestions[0] ? {
        hasTrainingCenter: fullDecl.qualitativeQuestions[0].hasTrainingCenter ?? undefined,
        recruitmentPlansNext: fullDecl.qualitativeQuestions[0].recruitmentPlansNext ?? undefined,
        camerounisationPlan: fullDecl.qualitativeQuestions[0].camerounisationPlan ?? undefined,
        usesTempAgencies: fullDecl.qualitativeQuestions[0].usesTempAgencies ?? undefined,
        tempAgencyDetails: fullDecl.qualitativeQuestions[0].tempAgencyDetails ?? undefined,
      } : undefined,
      employees: fullDecl.employees.map(e => ({
        fullName: e.fullName,
        gender: e.gender,
        age: e.age,
        nationality: e.nationality,
        diploma: e.diploma ?? undefined,
        function: e.function,
        seniority: e.seniority,
        salaryCategory: e.salaryCategory ?? undefined,
        salary: e.salary ?? undefined,
      })),
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

  async getPendingDeclarations(user: any) {
    const where: any = {
      status: {
        in: [
          DeclarationStatus.SUBMITTED,
          DeclarationStatus.DIVISION_APPROVED,
          DeclarationStatus.REGION_APPROVED,
        ],
      },
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

  async validateDeclaration(declarationId: string, userId: string, accept: boolean, reason?: string) {
    return accept
      ? this.approveDeclaration(declarationId, userId)
      : this.rejectDeclaration(declarationId, userId, reason || 'Non précisé');
  }

  async approveDeclaration(declarationId: string, userId: string, notes?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.getDeclarationWithAccess(userId, declarationId);

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

  /**
   * Returns declarations for the authenticated user.
   */
  async getDeclarationsForUser(userId: string, filters: any) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const where: any = {};

    if (user.role === UserRole.COMPANY) {
      const comp = await this.prisma.company.findUnique({ where: { userId } });
      if (!comp) return [];
      where.companyId = comp.id;
    } else if (user.role === UserRole.DIVISIONAL) {
      where.division = user.department;
    } else if (user.role === UserRole.REGIONAL) {
      where.region = user.region;
    }

    if (filters.year) where.year = filters.year;
    if (filters.status) where.status = filters.status;

    return this.prisma.declaration.findMany({
      where,
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPdfPath(declarationId: string, userId: string, copy: number): Promise<string> {
    const decl = await this.getDeclarationWithAccess(userId, declarationId);

    if (!decl.qrCode) {
      throw new NotFoundException('PDF non disponible — numéro de suivi introuvable.');
    }

    const exists = await this.pdfService.pdfExists(decl.qrCode, decl.year, copy);

    if (!exists) {
      console.log(`[PDF] Missing: ${decl.qrCode} copy ${copy} — regenerating...`);
      await this._regeneratePdfs(decl);
      console.log(`[PDF] Regenerated: ${decl.qrCode}`);
    }

    return this.pdfService.getSignedUrl(decl.qrCode, decl.year, copy);
  }

  private async _regeneratePdfs(decl: any): Promise<void> {
    const q = decl.qualitativeQuestions?.[0];

    const getMovement = (type: string) => {
      const m = decl.movements?.find((mv: any) => mv.movementType === type);
      if (!m) return undefined;
      return {
        cat1_3: m.cat1_3,
        cat4_6: m.cat4_6,
        cat7_9: m.cat7_9,
        cat10_12: m.cat10_12,
        catNonDeclared: m.catNonDeclared,
      };
    };

    const processingService = await this.resolveProcessingService();
    const pdfData: PdfData = {
      trackingNumber: decl.qrCode,
      year: decl.year,
      language: 'fr',
      processingService,
      company: {
        name: decl.company.name,
        mainActivity: decl.company.mainActivity,
        region: decl.company.region,
        department: decl.company.department,
        subdivision: decl.company.subdivision,
        address: decl.company.address,
        taxNumber: decl.company.taxNumber,
        totalEmployees: decl.company.totalEmployees,
        cnpsNumber: decl.company.cnpsNumber ?? undefined,
        socialCapital: decl.company.socialCapital ?? undefined,
        menCount: decl.company.menCount ?? undefined,
        womenCount: decl.company.womenCount ?? undefined,
        lastYearTotal: decl.company.lastYearTotal ?? undefined,
        recruitments: getMovement('RECRUITMENT'),
        promotions: getMovement('PROMOTION'),
        dismissals: getMovement('DISMISSAL'),
        retirements: getMovement('RETIREMENT'),
        deaths: getMovement('DEATH'),
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
      employees: decl.employees.map((e: any) => ({
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

    await this.pdfService.generateDeclarationPdfs(pdfData);
  }

  async getDeclarationWithAccess(userId: string, declarationId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const decl = await this.prisma.declaration.findUniqueOrThrow({
      where: { id: declarationId },
      include: {
        company: true,
        employees: true,
        movements: true,
        qualitativeQuestions: true,
      },
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