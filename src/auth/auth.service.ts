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

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
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

  private async buildFeatures(userId: string, role: string) {
    if (role !== 'COMPANY') {
      return {
        onefopBasicAnalytics: false,
        onefopBenchmarking: false,
        onefopSubmissionStatus: null,
        onefopSurveyYear: null,
        onefopHasDraft: false,
      };
    }

    const onefopSubs = await this.prisma.onefopSubmission.findMany({
      where: { submittedBy: userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, surveyYear: true },
    });

    const latestSubmitted = onefopSubs.find((s) =>
      ['PENDING_REVIEW', 'APPROVED'].includes(s.status),
    );
    const latestApproved = onefopSubs.find((s) => s.status === 'APPROVED');

    return {
      onefopBasicAnalytics: !!latestSubmitted,
      onefopBenchmarking: !!latestApproved,
      onefopSubmissionStatus: latestSubmitted?.status ?? null,
      onefopSurveyYear: latestSubmitted?.surveyYear ?? null,
      onefopHasDraft: onefopSubs.some((s) => s.status === 'DRAFT'),
    };
  }

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

    const features = await this.buildFeatures(user.id, user.role);

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
        stream: user.stream,
        features,
      },
    };
  }

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
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
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
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un utilisateur avec cet email existe déjà');
      }
      throw error;
    }
  }

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
      fax?: string;
      totalEmployees?: number;
      menCount?: number;
      womenCount?: number;
      lastYearMenCount?: number;
      lastYearWomenCount?: number;
      lastYearTotal?: number;
      area?: string;
      sectorId?: string;
      phone?: string;
      phone2?: string;
      poBox?: string;
      branch?: string;
      legalStatus?: string;
      cooperativeType?: string;
      ctdType?: string;
      yearOfCreation?: string;
      mainMission?: string;
      registrationNumber?: string;
      trainingDomains?: string;
      respondentFirstName?: string;
      respondentLastName?: string;
      respondentPhone?: string;
      respondentPhone2?: string;
      respondentFunction?: string;
    },
  ) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    const existingCompany = await this.prisma.company.findUnique({
      where: { taxNumber: companyData.taxNumber },
    });
    if (existingCompany) {
      throw new BadRequestException(
        'Une entreprise avec ce numéro contribuable existe déjà',
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: hashed,
          role: 'COMPANY',
          firstName: companyData.respondentFirstName ?? companyData.contactName ?? email.split('@')[0],
          lastName: companyData.respondentLastName ?? '',
          region: companyData.region,
          department: companyData.department,
          status: 'ACTIVE',
          isActive: true,
        },
      });
      await this.prisma.company.create({
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
          fax: companyData.fax,
          taxNumber: companyData.taxNumber,
          cnpsNumber: companyData.cnpsNumber,
          socialCapital: companyData.socialCapital,
          entityType: companyData.entityType as any,
          totalEmployees: companyData.totalEmployees ?? 0,
          menCount: companyData.menCount,
          womenCount: companyData.womenCount,
          lastYearMenCount: companyData.lastYearMenCount,
          lastYearWomenCount: companyData.lastYearWomenCount,
          lastYearTotal: companyData.lastYearTotal,
          area: companyData.area,
          sectorId: companyData.sectorId,
          phone: companyData.phone,
          phone2: companyData.phone2,
          poBox: companyData.poBox,
          branch: companyData.branch,
          legalStatus: companyData.legalStatus,
          cooperativeType: companyData.cooperativeType,
          ctdType: companyData.ctdType,
          yearOfCreation: companyData.yearOfCreation,
          mainMission: companyData.mainMission,
          registrationNumber: companyData.registrationNumber,
          trainingDomains: companyData.trainingDomains,
          respondentFirstName: companyData.respondentFirstName,
          respondentLastName: companyData.respondentLastName,
          respondentPhone: companyData.respondentPhone,
          respondentPhone2: companyData.respondentPhone2,
          respondentFunction: companyData.respondentFunction,
        },
      });

      return this.login(user);
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email ou numéro contribuable déjà utilisé');
      }
      throw error;
    }
  }

  async getPendingMinefopUsers() {
    return this.prisma.user.findMany({
      where: { role: { not: 'COMPANY' }, status: 'PENDING_APPROVAL' },
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
      orderBy: { createdAt: 'asc' },
    });
  }

  async isEmailAvailable(email: string): Promise<{ available: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return { available: !user };
  }

  async approveUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.role === 'COMPANY') {
      throw new BadRequestException('Les entreprises sont automatiquement approuvées');
    }
    if (user.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException("Cet utilisateur n'est pas en attente d'approbation");
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true },
    });
  }

  async rejectUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.role === 'COMPANY') {
      throw new BadRequestException('Les entreprises ne peuvent pas être rejetées');
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: 'REJECTED', isActive: false },
    });
  }
}