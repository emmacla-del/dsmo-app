import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  // =========================
  // VALIDATE USER
  // =========================
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    const passwordValid = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordValid) return null;

    if (user.status === 'PENDING_APPROVAL') {
      throw new UnauthorizedException(
        "Votre compte est en attente d'approbation par un administrateur.",
      );
    }

    if (user.status === 'REJECTED' || !user.isActive) {
      throw new UnauthorizedException(
        'Votre compte a été désactivé. Contactez un administrateur.',
      );
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // =========================
  // LOGIN
  // =========================
  async login(user: any) {
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

  // =========================
  // REGISTER USER
  // =========================
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: string,
    region?: string,
    department?: string,
    matricule?: string,
    poste?: string,
    serviceCode?: string,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(
        'Un utilisateur avec cet email existe déjà',
      );
    }

    if (role === 'DIVISIONAL' && !department) {
      throw new BadRequestException(
        'Les utilisateurs divisionnaires doivent avoir un département assigné',
      );
    }

    if (role === 'REGIONAL' && !region) {
      throw new BadRequestException(
        'Les utilisateurs régionaux doivent avoir une région assignée',
      );
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
          role: role as any,
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
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002') {
        throw new ConflictException(
          'Un utilisateur avec cet email existe déjà',
        );
      }
      throw error;
    }
  }

  // =========================
  // REGISTER COMPANY
  // =========================
  async registerCompany(
    email: string,
    password: string,
    companyData: {
      name: string;
      parentCompany?: string;
      mainActivity: string;
      secondaryActivity?: string;
      region: string;
      department: string;
      subdivision: string;
      address: string;
      taxNumber: string;
      cnpsNumber?: string;
      socialCapital?: number;
      contactName?: string;
      entityType?: string;
      // New fields
      area?: string;
      sectorId?: string;
      phone?: string;
      phone2?: string;
      poBox?: string;
      legalStatus?: string;
      cooperativeType?: string;
      ctdType?: string;
      yearOfCreation?: string;
      mainMission?: string;
      registrationNumber?: string;
      trainingDomains?: string;
      respondentPhone?: string;
      respondentPhone2?: string;
      respondentFunction?: string;
    },
  ) {
    // 1. Check user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(
        'Un utilisateur avec cet email existe déjà',
      );
    }

    // 2. Check company exists
    const existingCompany = await this.prisma.company.findUnique({
      where: { taxNumber: companyData.taxNumber },
    });

    if (existingCompany) {
      throw new BadRequestException(
        'Une entreprise avec ce numéro contribuable existe déjà',
      );
    }

    // 3. Hash password (OUTSIDE DB OPS)
    const hashed = await bcrypt.hash(password, 10);

    try {
      // 4. CREATE USER
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: hashed,
          role: 'COMPANY',
          firstName:
            companyData.contactName ??
            email.split('@')[0],
          lastName: '',
          region: companyData.region,
          department: companyData.department,
          status: 'ACTIVE',
          isActive: true,
        },
      });

      // 5. CREATE COMPANY
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
          entityType: companyData.entityType as any,
          totalEmployees: 0,
          menCount: 0,
          womenCount: 0,
          // New fields
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
    } catch (error: any) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email ou numéro contribuable déjà utilisé',
        );
      }

      throw error;
    }
  }

  // =========================
  // ADMIN METHODS
  // =========================
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

  async approveUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    if (user.role === 'COMPANY') {
      throw new BadRequestException(
        'Les entreprises sont automatiquement approuvées',
      );
    }

    if (user.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        "Cet utilisateur n'est pas en attente d'approbation",
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        isActive: true,
      },
    });
  }

  async rejectUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    if (user.role === 'COMPANY') {
      throw new BadRequestException(
        'Les entreprises ne peuvent pas être rejetées',
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        status: 'REJECTED',
        isActive: false,
      },
    });
  }
}