import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserStatus } from '@prisma/client';
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
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      // Only allow login if user is active and approved (for MINEFOP roles)
      if (!user.isActive || user.status !== 'ACTIVE') {
        return null;
      }
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
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
      throw new BadRequestException('Les utilisateurs divisionnaires doivent avoir un département assigné');
    }
    if (role === 'REGIONAL' && !region) {
      throw new BadRequestException('Les utilisateurs régionaux doivent avoir une région assignée');
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
          // MINEFOP users require admin approval
          status: isMinefop ? 'PENDING_APPROVAL' : 'ACTIVE',
          isActive: isMinefop ? false : true,
        },
      });

      const { passwordHash: _, ...result } = user;
      // For MINEFOP, we still return a JWT but the user won't be able to log in until approved.
      // This is fine; the login guard will reject them.
      return result;
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
      district: string;
      address: string;
      taxNumber: string;
      cnpsNumber?: string;
      socialCapital?: number;
      contactName?: string;
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
      throw new BadRequestException('Une entreprise avec ce numéro contribuable existe déjà');
    }

    const hashed = await bcrypt.hash(password, 10);

    try {
      const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash: hashed,
            role: 'COMPANY',
            firstName: companyData.contactName || email.split('@')[0],
            lastName: '',
            region: companyData.region,
            department: companyData.department,
            status: 'ACTIVE',
            isActive: true,
          },
        });

        const company = await tx.company.create({
          data: {
            userId: user.id,
            name: companyData.name,
            parentCompany: companyData.parentCompany,
            mainActivity: companyData.mainActivity,
            secondaryActivity: companyData.secondaryActivity,
            region: companyData.region,
            department: companyData.department,
            district: companyData.district,
            address: companyData.address,
            taxNumber: companyData.taxNumber,
            cnpsNumber: companyData.cnpsNumber,
            socialCapital: companyData.socialCapital,
            totalEmployees: 0,
          },
        });

        return { user, company };
      });

      return this.login(result.user);
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un utilisateur avec cet email ou ce numéro contribuable existe déjà');
      }
      throw error;
    }
  }

  // ========== ADMIN METHODS ==========

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
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.role === 'COMPANY') throw new BadRequestException('Les entreprises sont automatiquement approuvées');
    if (user.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Cet utilisateur n\'est pas en attente d\'approbation');
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true },
    });
  }

  async rejectUser(id: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.role === 'COMPANY') throw new BadRequestException('Les entreprises ne peuvent pas être rejetées');
    return this.prisma.user.update({
      where: { id },
      data: { status: 'REJECTED', isActive: false },
    });
  }
}