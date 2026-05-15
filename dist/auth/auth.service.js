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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const bcrypt = require("bcrypt");
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async validateUser(email, password) {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user)
            return null;
        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid)
            return null;
        if (user.status === 'PENDING_APPROVAL') {
            throw new common_1.UnauthorizedException("Votre compte est en attente d'approbation par un administrateur.");
        }
        if (user.status === 'REJECTED' || !user.isActive) {
            throw new common_1.UnauthorizedException('Votre compte a été désactivé. Contactez un administrateur.');
        }
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    }
    async login(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            region: user.region,
            department: user.department,
            firstName: user.firstName,
            lastName: user.lastName,
        };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                region: user.region,
                department: user.department,
            },
        };
    }
    async register(email, password, firstName, lastName, role, region, department, matricule, poste, serviceCode) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Un utilisateur avec cet email existe déjà');
        }
        if (role === 'DIVISIONAL' && !department) {
            throw new common_1.BadRequestException('Les utilisateurs divisionnaires doivent avoir un département assigné');
        }
        if (role === 'REGIONAL' && !region) {
            throw new common_1.BadRequestException('Les utilisateurs régionaux doivent avoir une région assignée');
        }
        const hashed = await bcrypt.hash(password, 10);
        const isMinefop = role !== 'COMPANY';
        try {
            const user = await this.prisma.user.create({
                data: {
                    email,
                    passwordHash: hashed,
                    firstName,
                    lastName,
                    role: role,
                    region,
                    department,
                    matricule,
                    poste,
                    serviceCode: serviceCode ?? null,
                    status: isMinefop ? 'PENDING_APPROVAL' : 'ACTIVE',
                    isActive: !isMinefop,
                },
            });
            const { passwordHash, ...safeUser } = user;
            return safeUser;
        }
        catch (error) {
            if (error instanceof library_1.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('Un utilisateur avec cet email existe déjà');
            }
            throw error;
        }
    }
    async registerCompany(email, password, companyData) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Un utilisateur avec cet email existe déjà');
        }
        const existingCompany = await this.prisma.company.findUnique({
            where: { taxNumber: companyData.taxNumber },
        });
        if (existingCompany) {
            throw new common_1.BadRequestException('Une entreprise avec ce numéro contribuable existe déjà');
        }
        const hashed = await bcrypt.hash(password, 10);
        try {
            const user = await this.prisma.user.create({
                data: {
                    email,
                    passwordHash: hashed,
                    role: 'COMPANY',
                    firstName: companyData.contactName ??
                        email.split('@')[0],
                    lastName: '',
                    region: companyData.region,
                    department: companyData.department,
                    status: 'ACTIVE',
                    isActive: true,
                },
            });
            const company = await this.prisma.company.create({
                data: {
                    userId: user.id,
                    name: companyData.name,
                    parentCompany: companyData.parentCompany,
                    mainActivity: companyData.mainActivity,
                    secondaryActivity: companyData.secondaryActivity,
                    region: companyData.region,
                    department: companyData.department,
                    subdivision: companyData.subdivision,
                    address: companyData.address,
                    taxNumber: companyData.taxNumber,
                    cnpsNumber: companyData.cnpsNumber,
                    socialCapital: companyData.socialCapital,
                    entityType: companyData.entityType,
                    totalEmployees: 0,
                    menCount: 0,
                    womenCount: 0,
                    area: companyData.area,
                    sectorId: companyData.sectorId,
                    phone: companyData.phone,
                    phone2: companyData.phone2,
                    poBox: companyData.poBox,
                    legalStatus: companyData.legalStatus,
                    cooperativeType: companyData.cooperativeType,
                    ctdType: companyData.ctdType,
                    yearOfCreation: companyData.yearOfCreation,
                    mainMission: companyData.mainMission,
                    registrationNumber: companyData.registrationNumber,
                    trainingDomains: companyData.trainingDomains,
                    respondentPhone: companyData.respondentPhone,
                    respondentPhone2: companyData.respondentPhone2,
                    respondentFunction: companyData.respondentFunction,
                },
            });
            return this.login(user);
        }
        catch (error) {
            if (error instanceof library_1.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('Email ou numéro contribuable déjà utilisé');
            }
            throw error;
        }
    }
    async getPendingMinefopUsers() {
        return this.prisma.user.findMany({
            where: {
                role: { not: 'COMPANY' },
                status: 'PENDING_APPROVAL',
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                matricule: true,
                serviceCode: true,
                createdAt: true,
                role: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }
    async approveUser(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            throw new common_1.BadRequestException('Utilisateur non trouvé');
        }
        if (user.role === 'COMPANY') {
            throw new common_1.BadRequestException('Les entreprises sont automatiquement approuvées');
        }
        if (user.status !== 'PENDING_APPROVAL') {
            throw new common_1.BadRequestException("Cet utilisateur n'est pas en attente d'approbation");
        }
        return this.prisma.user.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                isActive: true,
            },
        });
    }
    async rejectUser(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            throw new common_1.BadRequestException('Utilisateur non trouvé');
        }
        if (user.role === 'COMPANY') {
            throw new common_1.BadRequestException('Les entreprises ne peuvent pas être rejetées');
        }
        return this.prisma.user.update({
            where: { id },
            data: {
                status: 'REJECTED',
                isActive: false,
            },
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map