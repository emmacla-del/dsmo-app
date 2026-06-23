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
import { PdfService } from '../dsmo/pdf.service';

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Demo-grade self-service reset: fixed pool of 4 questions answered
// against existing Company fields. No new table — see
// getSecurityQuestions / resetPasswordWithSecurityAnswers.
type SecurityQuestionKey = 'rccm' | 'phone' | 'companyName' | 'registrationDate';

const SECURITY_QUESTIONS: Record<SecurityQuestionKey, string> = {
  rccm: 'Quel est le numéro RCCM (registre du commerce) de votre entreprise ?',
  phone: 'Quel est le numéro de téléphone enregistré sur votre compte ?',
  companyName: 'Quel est le nom de votre organisation ?',
  registrationDate:
    "Quel est le mois et l'année d'inscription de votre compte (format MM/AAAA) ?",
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
    private pdfService: PdfService,
  ) { }

  /**
   * Accepts either the account email or a company's establishmentId (the
   * "identifiant" shown on the registration attestation) in the login field,
   * so a company that's lost track of its email can still log in.
   */
  async validateUser(login: string, password: string) {
    let user = await this.prisma.user.findUnique({ where: { email: login } });
    if (!user) {
      const company = await this.prisma.company.findFirst({
        where: { establishmentId: login },
      });
      if (company) {
        user = await this.prisma.user.findUnique({ where: { id: company.userId } });
      }
    }
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
        mustChangePassword: user.mustChangePassword,
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

      // Attestation generation must never block registration — the account
      // and establishmentId already exist at this point regardless.
      let attestationUrl: string | undefined;
      if (establishmentId) {
        try {
          const attestation = await this.pdfService.generateRegistrationAttestation({
            establishmentId,
            companyName: company.name,
            entityType: company.entityType ?? 'N/A',
            taxNumber: company.taxNumber,
            region: company.region,
            department: company.department,
            subdivision: company.subdivision,
            registrationDate: company.createdAt,
            email: user.email,
          });
          attestationUrl = attestation.signedUrl;
          await this.prisma.company.update({
            where: { id: company.id },
            data: {
              attestationUrl: attestation.storagePath,
              attestationGeneratedAt: new Date(),
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to generate registration attestation for company ${company.id}: ${(error as Error).message}`,
          );
        }
      }

      const rawToken = await this.issueEmailVerificationToken(user.id);
      const verifyLink = `${process.env.APP_URL || 'https://dsmo.ministry.cm'}/verify-email?token=${rawToken}`;
      // Fire-and-forget: a slow/unreachable SMTP server must not block the
      // registration response (the account is already created at this point).
      this.notificationService.sendEmailVerificationEmail(user.email, verifyLink).catch((error) => {
        this.logger.error(
          `Failed to send verification email to ${user.email}: ${(error as Error).message}`,
        );
      });

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
          attestationUrl: attestationUrl ?? null,
        },
      };
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email ou numéro contribuable déjà utilisé');
      }
      throw error;
    }
  }

  /**
   * Self-service "identifiant oublié": matches organisation name + NIU
   * (taxNumber) + phone against the Company table — the only 3 fields
   * collected for every entity type today. Same generic-failure convention
   * as resetPasswordWithSecurityAnswers: never reveal which field was wrong.
   */
  async findIdentifier(companyName: string, taxNumber: string, phone: string) {
    const GENERIC_ERROR = 'Informations incorrectes.';
    if (!companyName?.trim() || !taxNumber?.trim() || !phone?.trim()) {
      throw new BadRequestException(GENERIC_ERROR);
    }

    const normalizedPhone = this.normalizeDigits(phone);
    const candidates = await this.prisma.company.findMany({
      where: {
        name: { equals: companyName.trim(), mode: 'insensitive' },
        taxNumber: taxNumber.trim(),
      },
    });

    const match = candidates.find(
      (c) => normalizedPhone.length > 0 && this.normalizeDigits(c.phone) === normalizedPhone,
    );
    if (!match) {
      throw new BadRequestException(GENERIC_ERROR);
    }
    if (!match.establishmentId) {
      throw new BadRequestException(
        'Identifiant non disponible pour ce compte. Contactez le support DSMO.',
      );
    }

    return {
      establishmentId: match.establishmentId,
      companyName: match.name,
    };
  }

  private normalizeDigits(value: string | null | undefined): string {
    return (value ?? '').replace(/\D/g, '');
  }

  /** Re-signs the stored attestation PDF so it can be re-downloaded anytime. */
  async getAttestation(userId: string) {
    const company = await this.prisma.company.findUnique({ where: { userId } });
    if (!company?.attestationUrl) {
      throw new BadRequestException("Aucune attestation n'est disponible pour ce compte.");
    }
    const url = await this.pdfService.getSignedUrlForPath(company.attestationUrl);
    return { url };
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

  private static readonly ASSIGNABLE_ROLES = [
    'DIVISIONAL',
    'REGIONAL',
    'CENTRAL',
    'SUPER_ADMIN',
    'SUPER_ADMIN_DSMO',
    'SUPER_ADMIN_ONEFOP',
    'DATA_MANAGER',
    'CAMPAIGN_MANAGER',
    'ANALYST',
    'AUDITOR',
  ];

  /**
   * Excludes role=COMPANY by default — company accounts are managed via
   * the company directory (dsmo.service.listCompanies), not this staff
   * roster, and approveUser/rejectUser already special-case COMPANY out
   * of the equivalent pending-list query above.
   */
  async listUsers(params: {
    search?: string;
    role?: string;
    status?: string;
    isActive?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize =
      params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;

    const where: any = { role: { not: 'COMPANY' } };
    if (params.role) where.role = params.role;
    if (params.status) where.status = params.status;
    if (params.isActive !== undefined) where.isActive = params.isActive === 'true';

    const term = params.search?.trim();
    if (term) {
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { matricule: { contains: term, mode: 'insensitive' } },
        { serviceCode: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          isActive: true,
          region: true,
          department: true,
          matricule: true,
          serviceCode: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { users, total, page, pageSize };
  }

  async updateUserRole(id: string, role: string, actingUserId: string) {
    if (id === actingUserId) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre rôle');
    }
    if (!AuthService.ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException('Rôle invalide');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.role === 'COMPANY') {
      throw new BadRequestException(
        'Le rôle des comptes entreprise ne peut pas être modifié',
      );
    }
    return this.prisma.user.update({
      where: { id },
      data: { role: role as any },
    });
  }

  async setUserActive(id: string, isActive: boolean, actingUserId: string) {
    if (id === actingUserId) {
      throw new BadRequestException(
        isActive
          ? 'Vous ne pouvez pas réactiver votre propre compte'
          : 'Vous ne pouvez pas suspendre votre propre compte',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Hard delete. Most staff accounts with any activity (declarations,
   * submissions, notifications, audit logs, etc.) carry required FK
   * references to User with no cascade configured in schema.prisma, so
   * Postgres will reject the delete with a foreign-key violation —
   * surfaced here as a ConflictException telling the admin to suspend
   * instead. Only accounts with zero linked records can actually be
   * hard-deleted.
   */
  async deleteUser(id: string, actingUserId: string) {
    if (id === actingUserId) {
      throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    try {
      await this.prisma.user.delete({ where: { id } });
      return { message: 'Utilisateur supprimé avec succès.' };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'Impossible de supprimer cet utilisateur : des données liées existent ' +
            '(déclarations, soumissions, notifications...). Suspendez le compte à la place.',
        );
      }
      throw error;
    }
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

    // Fire-and-forget: the response is identical regardless of email outcome
    // (we never reveal whether the account exists), so don't block on SMTP.
    this.notificationService.sendPasswordResetEmail(user.email, resetLink).catch((error) => {
      this.logger.error(
        `Failed to send password reset email to ${user.email}: ${(error as Error).message}`,
      );
    });

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

  /**
   * Self-service reset, step 1: always returns 2 randomly chosen questions
   * from the fixed pool, regardless of whether the login exists — this
   * never reveals account existence. Demo-grade: no rate limiting.
   */
  async getSecurityQuestions(_login: string) {
    const keys = Object.keys(SECURITY_QUESTIONS) as SecurityQuestionKey[];
    const selected = [...keys].sort(() => Math.random() - 0.5).slice(0, 2);

    return {
      questions: selected.map((key) => ({
        key,
        question: SECURITY_QUESTIONS[key],
      })),
    };
  }

  /**
   * Self-service reset, step 2: both answers must match the user's Company
   * fields (case-insensitive, trimmed). Demo-grade: no lockout/rate
   * limiting, and any failure returns the same generic message so it
   * doesn't reveal which part was wrong or whether the account exists.
   */
  async resetPasswordWithSecurityAnswers(
    login: string,
    answers: Record<string, string>,
    newPassword: string,
  ) {
    const GENERIC_ERROR = 'Informations incorrectes.';

    if (!login || !answers || Object.keys(answers).length !== 2 || !newPassword) {
      throw new BadRequestException(GENERIC_ERROR);
    }
    if (newPassword.length < 8) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 8 caractères',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: login } });
    if (!user) {
      throw new BadRequestException(GENERIC_ERROR);
    }

    const company = await this.prisma.company.findUnique({
      where: { userId: user.id },
    });

    const allCorrect = Object.entries(answers).every(([key, value]) =>
      this.checkSecurityAnswer(key, value, company),
    );
    if (!allCorrect) {
      throw new BadRequestException(GENERIC_ERROR);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  private checkSecurityAnswer(
    key: string,
    providedAnswer: string,
    company: {
      registrationNumber: string | null;
      phone: string | null;
      name: string;
      createdAt: Date;
    } | null,
  ): boolean {
    if (!company || typeof providedAnswer !== 'string' || !providedAnswer.trim()) {
      return false;
    }

    let expected: string | null;
    switch (key as SecurityQuestionKey) {
      case 'rccm':
        expected = company.registrationNumber;
        break;
      case 'phone':
        expected = company.phone;
        break;
      case 'companyName':
        expected = company.name;
        break;
      case 'registrationDate':
        expected = this.formatMonthYear(company.createdAt);
        break;
      default:
        expected = null;
    }

    if (!expected) return false;
    return providedAnswer.trim().toLowerCase() === expected.trim().toLowerCase();
  }

  private formatMonthYear(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${month}/${date.getFullYear()}`;
  }

  /**
   * Admin-mediated reset: temporarily inert. It used to email a reset
   * link, but EmailService was removed from the password reset flow in
   * favor of the self-service security-question flow above
   * (getSecurityQuestions / resetPasswordWithSecurityAnswers). This
   * endpoint's replacement behavior hasn't been decided yet.
   */
  async adminResetPassword(_email: string, _adminUserId: string) {
    throw new BadRequestException(
      'La réinitialisation par administrateur est temporairement ' +
        'indisponible. Utilisez le flux de questions de sécurité côté ' +
        'utilisateur.',
    );
  }

  /**
   * Authenticated password change. Used both for the voluntary "change my
   * password" action and for the forced change after an admin-issued
   * temporary password (mustChangePassword).
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Mot de passe actuel et nouveau mot de passe requis');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable.');

    const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new BadRequestException('Mot de passe actuel incorrect.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return { message: 'Mot de passe mis à jour avec succès.' };
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