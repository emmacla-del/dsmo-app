import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EstablishmentIdGenerator } from '../common/utils/establishment-id.generator';
import { NotificationService } from '../dsmo/notification.service';

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
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
        emailVerified: user.emailVerified,
        features,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable.');
    if (user.status === 'REJECTED' || !user.isActive) {
      throw new UnauthorizedException(
        'Votre compte a été désactivé. Contactez un administrateur.',
      );
    }
    const { passwordHash, ...safeUser } = user;
    return safeUser;
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

    // ✅ GENERATE ESTABLISHMENT ID
    let establishmentId: string | undefined;
    if (companyData.entityType && companyData.subdivision) {
      // Get subdivision code from name
      const subdivision = await this.prisma.subdivision.findFirst({
        where: { name: companyData.subdivision }
      });
      const subdivisionCode = subdivision?.code?.slice(-2) || '00';

      establishmentId = await EstablishmentIdGenerator.generate(
        this.prisma,
        companyData.entityType,
        subdivisionCode,
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
          emailVerified: false,
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
          establishmentId: establishmentId,
          establishmentIdGeneratedAt: establishmentId ? new Date() : undefined,
        },
      });

      const rawToken = await this.issueEmailVerificationToken(user.id);
      const verifyLink = `${process.env.APP_URL || 'https://dsmo.ministry.cm'}/verify-email?token=${rawToken}`;
      try {
        await this.notificationService.sendEmailVerificationEmail(user.email, verifyLink);
      } catch (error) {
        this.logger.error(
          `Failed to send verification email to ${user.email}: ${(error as Error).message}`,
        );
      }

      // ✅ Return the login response WITH company data including establishmentId
      const loginResult = await this.login(user);

      return {
        ...loginResult,
        company: {
          id: company.id,
          name: company.name,
          establishmentId: company.establishmentId,
          taxNumber: company.taxNumber,
          entityType: company.entityType,
        },
      };
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

  /**
   * Always returns a generic outcome regardless of whether the email exists,
   * to avoid leaking which addresses are registered.
   */
  async forgotPassword(email: string) {
    const genericResponse = {
      message:
        'Si un compte existe avec cette adresse, un e-mail de réinitialisation a été envoyé.',
    };

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return genericResponse;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      },
    });

    const baseUrl = process.env.APP_URL || 'https://dsmo.ministry.cm';
    const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;

    try {
      await this.notificationService.sendPasswordResetEmail(user.email, resetLink);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}: ${(error as Error).message}`,
      );
    }

    return genericResponse;
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new BadRequestException('Token et nouveau mot de passe requis');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 8 caractères',
      );
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash },
    });

    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Lien de réinitialisation invalide ou expiré');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        // Clicking a link mailed to this address already proves ownership.
        emailVerified: true,
      },
    });

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  private async issueEmailVerificationToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
      },
    });

    return rawToken;
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Token requis');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationTokenHash: tokenHash },
    });

    if (
      !user ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Lien de vérification invalide ou expiré');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpires: null,
      },
    });

    return { message: 'Adresse e-mail vérifiée avec succès.' };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable.');
    if (user.emailVerified) {
      return { message: 'Votre adresse e-mail est déjà vérifiée.' };
    }

    const rawToken = await this.issueEmailVerificationToken(user.id);
    const verifyLink = `${process.env.APP_URL || 'https://dsmo.ministry.cm'}/verify-email?token=${rawToken}`;

    try {
      await this.notificationService.sendEmailVerificationEmail(user.email, verifyLink);
    } catch (error) {
      this.logger.error(
        `Failed to resend verification email to ${user.email}: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        "Impossible d'envoyer l'e-mail pour le moment. Réessayez plus tard.",
      );
    }

    return { message: 'E-mail de vérification renvoyé.' };
  }
}