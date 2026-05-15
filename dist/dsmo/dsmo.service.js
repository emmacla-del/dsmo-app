"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DsmoService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const prisma_types_1 = require("../types/prisma.types");
const validation_service_1 = require("./validation.service");
const audit_service_1 = require("./audit.service");
const pdf_service_1 = require("./pdf.service");
let DsmoService = class DsmoService {
    constructor(prisma, validationService, auditService, pdfService) {
        this.prisma = prisma;
        this.validationService = validationService;
        this.auditService = auditService;
        this.pdfService = pdfService;
    }
    async resolveProcessingService() {
        try {
            const svc = await this.prisma.minefopService.findUnique({
                where: { code: 'DDEFOP' },
            });
            if (!svc)
                return undefined;
            let parent = null;
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
        }
        catch {
            return undefined;
        }
    }
    async generateTrackingNumber(year) {
        const count = await this.prisma.declaration.count({
            where: { year, status: { not: prisma_types_1.DeclarationStatus.DRAFT } },
        });
        const seq = String(count + 1).padStart(7, '0');
        return `DSMO-${year}-${seq}`;
    }
    async getMyCompany(userId) {
        return this.prisma.company.findUnique({ where: { userId } });
    }
    async saveCompanyProfile(userId, dto) {
        const subdivisionValue = dto.subdivision ?? dto.department ?? 'Non spécifié';
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
            ...(dto.entityType ? { entityType: dto.entityType } : {}),
            totalEmployees: 0,
        };
        try {
            const company = await this.prisma.company.upsert({
                where: { userId },
                update: data,
                create: { userId, ...data },
            });
            await this.auditService.log(userId, 'CREATE_COMPANY_PROFILE', 'Company', company.id, dto.name);
            return company;
        }
        catch (err) {
            if (err.code === 'P2002') {
                throw new common_1.ConflictException('Le numéro contribuable (NIU) est déjà utilisé.');
            }
            throw err;
        }
    }
    async createOrUpdateCompany(userId, dto) {
        const subdivisionValue = dto.subdivision ?? 'Non spécifié';
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
        };
        try {
            const company = await this.prisma.company.upsert({
                where: { userId },
                update: companyData,
                create: { userId, ...companyData },
            });
            await this.auditService.log(userId, 'UPDATE_COMPANY', 'Company', company.id, 'Mise à jour du profil entreprise');
            return company;
        }
        catch (err) {
            if (err.code === 'P2002') {
                throw new common_1.ConflictException('Le numéro contribuable (NIU) est déjà utilisé.');
            }
            throw err;
        }
    }
    async submitDeclaration(userId, dto) {
        const company = await this.createOrUpdateCompany(userId, dto.company);
        const existingDecl = await this.prisma.declaration.findFirst({
            where: {
                companyId: company.id,
                year: dto.year,
                status: { notIn: [prisma_types_1.DeclarationStatus.REJECTED, prisma_types_1.DeclarationStatus.DRAFT] },
            },
        });
        if (existingDecl) {
            throw new common_1.ForbiddenException(`Une déclaration pour l'année ${dto.year} est déjà active.`);
        }
        let declaration = await this.prisma.declaration.findFirst({
            where: { companyId: company.id, year: dto.year, status: prisma_types_1.DeclarationStatus.DRAFT },
        });
        if (!declaration) {
            declaration = await this.prisma.declaration.create({
                data: {
                    year: dto.year,
                    companyId: company.id,
                    region: company.region,
                    division: company.department,
                    status: prisma_types_1.DeclarationStatus.DRAFT,
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
            throw new common_1.BadRequestException(`Validation échouée: ${validation.errors.join('; ')}`);
        }
        const trackingNumber = await this.generateTrackingNumber(dto.year);
        const fullDecl = await this.prisma.declaration.findUniqueOrThrow({
            where: { id: declaration.id },
            include: { employees: true, movements: true, qualitativeQuestions: true },
        });
        const getMovement = (type) => {
            const m = fullDecl.movements.find((mv) => mv.movementType === type);
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
                recruitments: getMovement(prisma_types_1.MovementType.RECRUITMENT),
                promotions: getMovement(prisma_types_1.MovementType.PROMOTION),
                dismissals: getMovement(prisma_types_1.MovementType.DISMISSAL),
                retirements: getMovement(prisma_types_1.MovementType.RETIREMENT),
                deaths: getMovement(prisma_types_1.MovementType.DEATH),
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
                status: prisma_types_1.DeclarationStatus.SUBMITTED,
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
    async getPendingDeclarations(user) {
        const where = {
            status: {
                in: [
                    prisma_types_1.DeclarationStatus.SUBMITTED,
                    prisma_types_1.DeclarationStatus.DIVISION_APPROVED,
                    prisma_types_1.DeclarationStatus.REGION_APPROVED,
                ],
            },
        };
        if (user.role === prisma_types_1.UserRole.DIVISIONAL)
            where.division = user.department;
        else if (user.role === prisma_types_1.UserRole.REGIONAL)
            where.region = user.region;
        else if (user.role === prisma_types_1.UserRole.COMPANY)
            throw new common_1.ForbiddenException('Accès refusé.');
        return this.prisma.declaration.findMany({
            where,
            include: { company: true, employees: true },
            orderBy: { submittedAt: 'desc' },
        });
    }
    async validateDeclaration(declarationId, userId, accept, reason) {
        return accept
            ? this.approveDeclaration(declarationId, userId)
            : this.rejectDeclaration(declarationId, userId, reason || 'Non précisé');
    }
    async approveDeclaration(declarationId, userId, notes) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        await this.getDeclarationWithAccess(userId, declarationId);
        let nextStatus;
        if (user.role === prisma_types_1.UserRole.DIVISIONAL)
            nextStatus = prisma_types_1.DeclarationStatus.DIVISION_APPROVED;
        else if (user.role === prisma_types_1.UserRole.REGIONAL)
            nextStatus = prisma_types_1.DeclarationStatus.REGION_APPROVED;
        else if (user.role === prisma_types_1.UserRole.CENTRAL)
            nextStatus = prisma_types_1.DeclarationStatus.FINAL_APPROVED;
        else
            throw new common_1.ForbiddenException('Privilèges insuffisants.');
        return this.prisma.declaration.update({
            where: { id: declarationId },
            data: { status: nextStatus, validatedBy: userId, validatedAt: new Date() },
        });
    }
    async rejectDeclaration(declarationId, userId, reason) {
        return this.prisma.declaration.update({
            where: { id: declarationId },
            data: {
                status: prisma_types_1.DeclarationStatus.REJECTED,
                rejectionReason: reason,
                validatedBy: userId,
                validatedAt: new Date(),
            },
        });
    }
    async getDeclarationsForUser(userId, filters) {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const where = {};
        if (user.role === prisma_types_1.UserRole.COMPANY) {
            const comp = await this.prisma.company.findUnique({ where: { userId } });
            where.companyId = comp?.id;
        }
        else if (user.role === prisma_types_1.UserRole.DIVISIONAL) {
            where.division = user.department;
        }
        else if (user.role === prisma_types_1.UserRole.REGIONAL) {
            where.region = user.region;
        }
        if (filters.year)
            where.year = filters.year;
        if (filters.status)
            where.status = filters.status;
        return this.prisma.declaration.findMany({
            where,
            include: { company: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getPdfPath(declarationId, userId, copy) {
        const decl = await this.getDeclarationWithAccess(userId, declarationId);
        if (!decl.qrCode) {
            throw new common_1.NotFoundException('PDF non disponible — numéro de suivi introuvable.');
        }
        const exists = await this.pdfService.pdfExists(decl.qrCode, decl.year, copy);
        if (!exists) {
            console.log(`[PDF] Missing: ${decl.qrCode} copy ${copy} — regenerating...`);
            await this._regeneratePdfs(decl);
            console.log(`[PDF] Regenerated: ${decl.qrCode}`);
        }
        return this.pdfService.getSignedUrl(decl.qrCode, decl.year, copy);
    }
    async _regeneratePdfs(decl) {
        const q = decl.qualitativeQuestions?.[0];
        const getMovement = (type) => {
            const m = decl.movements?.find((mv) => mv.movementType === type);
            if (!m)
                return undefined;
            return {
                cat1_3: m.cat1_3,
                cat4_6: m.cat4_6,
                cat7_9: m.cat7_9,
                cat10_12: m.cat10_12,
                catNonDeclared: m.catNonDeclared,
            };
        };
        const processingService = await this.resolveProcessingService();
        const pdfData = {
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
            employees: decl.employees.map((e) => ({
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
    async getDeclarationWithAccess(userId, declarationId) {
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
        if (user.role === prisma_types_1.UserRole.COMPANY && decl.company.userId !== userId) {
            throw new common_1.ForbiddenException('Accès interdit.');
        }
        return decl;
    }
    async getDeclarationStats(year, region, department) {
        const where = { year };
        if (region)
            where.region = region;
        if (department)
            where.division = department;
        const [total, submitted, approved, rejected] = await Promise.all([
            this.prisma.declaration.count({ where }),
            this.prisma.declaration.count({ where: { ...where, status: prisma_types_1.DeclarationStatus.SUBMITTED } }),
            this.prisma.declaration.count({ where: { ...where, status: prisma_types_1.DeclarationStatus.FINAL_APPROVED } }),
            this.prisma.declaration.count({ where: { ...where, status: prisma_types_1.DeclarationStatus.REJECTED } }),
        ]);
        return { total, submitted, approved, rejected };
    }
};
exports.DsmoService = DsmoService;
exports.DsmoService = DsmoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        validation_service_1.ValidationService,
        audit_service_1.AuditService,
        pdf_service_1.PdfService])
], DsmoService);
//# sourceMappingURL=dsmo.service.js.map