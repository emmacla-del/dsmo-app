import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
// ✅ Import error class directly from the client package
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
        },
      });

      const { passwordHash: _, ...result } = user;
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
      // ✅ Properly typed transaction client (tx)
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
      // ✅ Narrowing error type for safe code access
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un utilisateur avec cet email ou ce numéro contribuable existe déjà');
      }
      throw error;
    }
  }
}