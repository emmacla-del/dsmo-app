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
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { computeOnefopFeatures } from '../common/onefop-features.util';
import { buildUserListWhere, type UserListFilterParams } from './user-list-filter';
import { TERRITORIAL_APPROVER_ROLES, assertCanApproveRegistration, assertCanManageRole, manageableRolesFor } from './staff-scope';
import type { Territory } from './territory';
import { toPublicUser } from './public-user';
import { resolveAndValidateTerritory, resolveStaffTerritory } from '../territory/territory-resolver';

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TWO_FACTOR_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TWO_FACTOR_CHALLENGE_JWT_TTL = '10m';
const MAX_LOGIN_ATTEMPTS = 8; // consecutive failures before lockout
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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
    private systemSettings: SystemSettingsService,
  ) { }

  private async requirePasswordMinLength(newPassword: string): Promise<void> {
    const { passwordMinLength } = await this.systemSettings.getSettings();
    if (newPassword.length < passwordMinLength) {
      throw new BadRequestException(
        `Le mot de passe doit contenir au moins ${passwordMinLength} caractères`,
      );
    }
  }

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

    // Account lockout: the global ThrottlerGuard (60 req/60s per IP) doesn't
    // stop credential stuffing against one specific account from rotating
    // IPs, since it isn't keyed by the account being attacked. This counter
    // is keyed by the account itself, so it holds regardless of source IP.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(
        `Trop de tentatives échouées. Réessayez dans ${minutesLeft} minute(s).`,
      );
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: shouldLock
          ? {
              failedLoginAttempts: 0,
              lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
            }
          : { failedLoginAttempts: attempts },
      });
      return null;
    }
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
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
    return toPublicUser(user);
  }

  private async buildFeatures(userId: string, role: string) {
    const empty = {
      onefopBasicAnalytics: false,
      onefopBenchmarking: false,
      onefopSubmissionStatus: null,
      onefopSurveyYear: null,
      onefopHasDraft: false,
      onefopRejectionReason: null,
    };
    if (role !== 'COMPANY') return empty;

    // Scoped by companyId, not submittedBy:userId — same result in
    // practice (Company.userId is @unique) but this is now the single
    // shared implementation also used server-side by AnalyticsController
    // to actually enforce the gate on each request, since these flags
    // never make it into the JWT (see onefop-features.util.ts).
    const company = await this.prisma.company.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!company) return empty;

    return computeOnefopFeatures(this.prisma, company.id);
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
        emailNotificationsEnabled: user.emailNotificationsEnabled,
        pushNotificationsEnabled: user.pushNotificationsEnabled,
        weeklyDigestEnabled: user.weeklyDigestEnabled,
        smsNotificationsEnabled: user.smsNotificationsEnabled,
        twoFactorEnabled: user.twoFactorEnabled,
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
    // Never computed here before -- harmless while nothing re-fetched /me
    // after login, but AuthNotifier.refreshUser() (Flutter) now calls this
    // on screen opens to pick up server-side changes mid-session, and
    // without `features` here it silently overwrote the correct login-time
    // value with UserFeatures' all-false default.
    const features = await this.buildFeatures(user.id, user.role);
    return { ...toPublicUser(user), features };
  }

  /**
   * Step 1 of 2FA login: credentials already verified by validateUser/
   * LocalStrategy. Issues a one-time code emailed to the user and a
   * short-lived signed challenge token (separate from the real access
   * token — it only proves "password was correct", not "fully logged in").
   * Blocking on the email send (see NotificationService.sendTwoFactorCodeEmail)
   * since the user can't proceed without the code actually arriving.
   */
  async initiateTwoFactorChallenge(user: { id: string; email: string }) {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCodeHash: codeHash,
        twoFactorCodeExpires: new Date(Date.now() + TWO_FACTOR_CODE_TTL_MS),
      },
    });

    try {
      await this.notificationService.sendTwoFactorCodeEmail(user.email, code);
    } catch (error) {
      this.logger.error(
        `Failed to send 2FA code to ${user.email}: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        "Impossible d'envoyer le code de vérification pour le moment. Réessayez.",
      );
    }

    const challengeToken = this.jwtService.sign(
      { sub: user.id, purpose: '2fa_pending' },
      { expiresIn: TWO_FACTOR_CHALLENGE_JWT_TTL },
    );

    return { requiresTwoFactor: true, challengeToken };
  }

  /**
   * Step 2 of 2FA login: verifies the emailed code against the
   * challengeToken from initiateTwoFactorChallenge, then issues the real
   * access token via login() — same shape as a normal, non-2FA login.
   */
  async verifyTwoFactorCode(challengeToken: string, code: string) {
    const GENERIC_ERROR = 'Code de vérification invalide ou expiré. Reconnectez-vous.';
    if (!challengeToken || !code) {
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(challengeToken);
    } catch {
      throw new UnauthorizedException(GENERIC_ERROR);
    }
    if (payload?.purpose !== '2fa_pending' || !payload.sub) {
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.twoFactorCodeHash || !user.twoFactorCodeExpires) {
      throw new UnauthorizedException(GENERIC_ERROR);
    }
    if (user.twoFactorCodeExpires.getTime() < Date.now()) {
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== user.twoFactorCodeHash) {
      throw new UnauthorizedException('Code de vérification incorrect.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorCodeHash: null, twoFactorCodeExpires: null },
    });

    return this.login(user);
  }

  /**
   * Updates the caller's notification preferences. Email is the only
   * channel actually wired to a sender today (see NotificationService) —
   * push/SMS are persisted so the toggle is real per-user state, but
   * nothing consumes them yet since no push/SMS gateway exists.
   */
  async updatePreferences(
    userId: string,
    prefs: {
      emailNotificationsEnabled?: boolean;
      pushNotificationsEnabled?: boolean;
      weeklyDigestEnabled?: boolean;
      smsNotificationsEnabled?: boolean;
    },
  ) {
    const data: Record<string, boolean> = {};
    if (prefs.emailNotificationsEnabled !== undefined) data.emailNotificationsEnabled = prefs.emailNotificationsEnabled;
    if (prefs.pushNotificationsEnabled !== undefined) data.pushNotificationsEnabled = prefs.pushNotificationsEnabled;
    if (prefs.weeklyDigestEnabled !== undefined) data.weeklyDigestEnabled = prefs.weeklyDigestEnabled;
    if (prefs.smsNotificationsEnabled !== undefined) data.smsNotificationsEnabled = prefs.smsNotificationsEnabled;

    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return toPublicUser(user);
  }

  async setTwoFactorEnabled(userId: string, enabled: boolean) {
    if (!enabled) {
      const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (existing.role !== 'COMPANY') {
        const { require2FAForStaff } = await this.systemSettings.getSettings();
        if (require2FAForStaff) {
          throw new BadRequestException(
            'La double authentification est obligatoire pour les comptes MINEFOP ' +
              'selon la politique de sécurité en vigueur.',
          );
        }
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: enabled },
    });
    return toPublicUser(user);
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

    let canonicalRegion = region ?? null;
    let canonicalDepartment = department ?? null;
    if (role === 'REGIONAL' || role === 'DIVISIONAL') {
      const resolved = await resolveStaffTerritory(this.prisma, role, { region, department });
      canonicalRegion = resolved.region;
      canonicalDepartment = resolved.department;
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
          region: canonicalRegion,
          department: canonicalDepartment,
          matricule,
          poste,
          serviceCode: serviceCode ?? null,
          status: isMinefop ? 'PENDING_APPROVAL' : 'ACTIVE',
          isActive: !isMinefop,
        },
      });
      return toPublicUser(user);
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un utilisateur avec cet email existe déjà');
      }
      throw error;
    }
  }

  // Roles a SUPER_ADMIN may create through adminCreateMinefopUser — the
  // MINEFOP field-agent roles only. Other staff roles (SUPER_ADMIN,
  // DATA_MANAGER, ANALYST, ...) still have no creation path; this endpoint
  // exists specifically to replace the public MINEFOP self-registration
  // flow that was removed from the app.
  private static readonly MINEFOP_FIELD_ROLES = ['CENTRAL', 'REGIONAL', 'DIVISIONAL'];

  /** Unambiguous charset (no 0/O/1/l/I) — this gets read aloud/copied by hand. */
  private generateTemporaryPassword(): string {
    const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    let out = '';
    for (let i = 0; i < 12; i++) {
      out += charset[bytes[i] % charset.length];
    }
    return out;
  }

  /**
   * SUPER_ADMIN creates a MINEFOP agent account directly, skipping the
   * PENDING_APPROVAL step that self-registration goes through — the admin
   * is already vouching for the account by creating it. Returns the
   * generated temporary password once, in plaintext, so the admin can hand
   * it to the agent out-of-band; it is never stored or returned again
   * (outbound email from this app is unreliable, so this is the primary
   * delivery path rather than a fallback).
   */
  async adminCreateMinefopUser(dto: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    region?: string;
    department?: string;
    matricule?: string;
    poste?: string;
    serviceCode?: string;
    positionType?: string;
  }, actorRole: string) {
    if (!AuthService.MINEFOP_FIELD_ROLES.includes(dto.role)) {
      throw new BadRequestException('Rôle invalide pour la création directe');
    }
    // D1: SUPER_ADMIN_ONEFOP may create ONEFOP staff only.
    assertCanManageRole(actorRole, dto.role);
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    const resolvedTerritory = await resolveStaffTerritory(this.prisma, dto.role, {
      region: dto.region,
      department: dto.department,
    });

    const temporaryPassword = this.generateTemporaryPassword();
    const hashed = await bcrypt.hash(temporaryPassword, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: hashed,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role as any,
          region: resolvedTerritory.region,
          department: resolvedTerritory.department,
          matricule: dto.matricule,
          poste: dto.poste,
          serviceCode: dto.serviceCode ?? null,
          positionType: dto.positionType ?? null,
          status: 'ACTIVE',
          isActive: true,
          mustChangePassword: true,
        },
      });
      return { user: toPublicUser(user), temporaryPassword };
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
      regionId?: string;
      departmentId?: string;
      subdivisionId?: string;
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
      // VOCATIONAL_TRAINING-specific identification fields — see the
      // 2026-08-30 VT registration audit. cfpType/educationSystem/
      // functionalStatus/nonFunctionalReason are plain strings (no VT enum
      // backs them, matching the AST's own posture on these fields).
      sigle?: string;
      cfpType?: string;
      educationSystem?: string;
      functionalStatus?: string;
      nonFunctionalReason?: string;
      nonFunctionalReasonOther?: string;
      // 1.16 — Promoteur/Directeur du CFP, a second contact block distinct
      // from the respondent above (1.15). VT-only; no other entity type
      // collects a second contact at registration time.
      promoterName?: string;
      promoterSex?: string;
      promoterPhone1?: string;
      promoterPhone2?: string;
    },
  ) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Only enforce the NIU-uniqueness check for entity types that actually
    // collect one (enterprise/cooperative/CTD/ONG/VT). Administration and
    // ProjectProgram registration has no taxNumber field in the UI (public
    // administrations and supervised projects/programs don't have a
    // taxpayer number), so companyData.taxNumber arrives as ''. Company.
    // taxNumber is @unique, so checking/storing '' verbatim would let the
    // first such registration through and reject every subsequent one with
    // a false "already exists" — skip the check, and see the synthetic
    // fallback generated below instead of storing the empty string.
    if (companyData.taxNumber) {
      const existingCompany = await this.prisma.company.findUnique({
        where: { taxNumber: companyData.taxNumber },
      });
      if (existingCompany) {
        throw new BadRequestException(
          'Une entreprise avec ce numéro contribuable existe déjà',
        );
      }
    }

    // Validate and resolve territory hierarchy against canonical DB records
    const resolvedTerritory = await resolveAndValidateTerritory(
      this.prisma,
      {
        regionId: companyData.regionId,
        departmentId: companyData.departmentId,
        subdivisionId: companyData.subdivisionId,
        region: companyData.region,
        department: companyData.department,
        subdivision: companyData.subdivision,
      },
      { requireSubdivision: true },
    );

    // ✅ GENERATE ESTABLISHMENT ID
    let establishmentId: string | undefined;
    if (companyData.entityType && resolvedTerritory.subdivisionId) {
      const subdivision = await this.prisma.subdivision.findUnique({
        where: { id: resolvedTerritory.subdivisionId },
      });
      const subdivisionCode = subdivision?.code?.slice(-2) || '00';

      establishmentId = await EstablishmentIdGenerator.generate(
        this.prisma,
        companyData.entityType,
        subdivisionCode,
      );
    }

    // Entity types with no real NIU still need a unique, non-empty value
    // to satisfy Company.taxNumber's unique constraint. Derive it from the
    // just-generated establishmentId (already guaranteed unique) rather
    // than storing '' — falls back to a random id on the rare path where
    // establishmentId itself couldn't be generated.
    const resolvedTaxNumber =
      companyData.taxNumber ||
      `NA-${establishmentId ?? crypto.randomUUID()}`;

    const hashed = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: hashed,
          role: 'COMPANY',
          firstName: companyData.respondentFirstName ?? companyData.contactName ?? email.split('@')[0],
          lastName: companyData.respondentLastName ?? '',
          region: resolvedTerritory.region,
          department: resolvedTerritory.department,
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
          region: resolvedTerritory.region,
          department: resolvedTerritory.department,
          subdivision: resolvedTerritory.subdivision!,
          regionId: resolvedTerritory.regionId,
          departmentId: resolvedTerritory.departmentId,
          subdivisionId: resolvedTerritory.subdivisionId,
          address: companyData.address,
          fax: companyData.fax,
          taxNumber: resolvedTaxNumber,
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
          sigle: companyData.sigle,
          cfpType: companyData.cfpType,
          educationSystem: companyData.educationSystem,
          functionalStatus: companyData.functionalStatus,
          nonFunctionalReason: companyData.nonFunctionalReason,
          nonFunctionalReasonOther: companyData.nonFunctionalReasonOther,
          promoterName: companyData.promoterName,
          promoterSex: companyData.promoterSex,
          promoterPhone1: companyData.promoterPhone1,
          promoterPhone2: companyData.promoterPhone2,
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

  // actorTerritory: the acting user's region/department (territoryFromUser
  // of req.user). Only REGIONAL/DIVISIONAL actors need it (D3); without it
  // they fail closed.
  async approveUser(id: string, actorRole: string, actorTerritory?: Territory) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    assertCanApproveRegistration({ ...actorTerritory, role: actorRole }, user);
    if (user.role === 'COMPANY') {
      throw new BadRequestException('Les entreprises sont automatiquement approuvées');
    }
    if (user.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException("Cet utilisateur n'est pas en attente d'approbation");
    }
    return toPublicUser(await this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true },
    }));
  }

  async rejectUser(id: string, actorRole: string, actorTerritory?: Territory) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    assertCanApproveRegistration({ ...actorTerritory, role: actorRole }, user);
    if (user.role === 'COMPANY') {
      throw new BadRequestException('Les entreprises ne peuvent pas être rejetées');
    }
    // D3 grants REGIONAL/DIVISIONAL registration review only: without this,
    // "reject" on an ACTIVE colleague would deactivate the account.
    if ((TERRITORIAL_APPROVER_ROLES as readonly string[]).includes(actorRole) && user.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException("Cet utilisateur n'est pas en attente d'approbation");
    }
    return toPublicUser(await this.prisma.user.update({
      where: { id },
      data: { status: 'REJECTED', isActive: false },
    }));
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
  async listUsers(
    params: Omit<UserListFilterParams, 'allowedRoles'> & {
      page?: number;
      pageSize?: number;
    },
    actorRole: string,
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize =
      params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;

    const where: any = buildUserListWhere({
      ...params,
      allowedRoles: manageableRolesFor(actorRole),
    });

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

  async updateUserRole(id: string, role: string, actingUserId: string, actorRole: string) {
    if (id === actingUserId) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre rôle');
    }
    if (!AuthService.ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException('Rôle invalide');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    // Both the account and the role being granted must be in scope.
    assertCanManageRole(actorRole, user.role);
    assertCanManageRole(actorRole, role);
    if (user.role === 'COMPANY') {
      throw new BadRequestException(
        'Le rôle des comptes entreprise ne peut pas être modifié',
      );
    }
    // Promotion keeps the account's stored territory, which must already be
    // complete (also enforced by users_divisional_requires_territory_chk and
    // users_regional_requires_region_chk).
    if (role === 'DIVISIONAL' && (!user.department || !user.region)) {
      throw new BadRequestException(
        'Les utilisateurs divisionnaires doivent avoir une région et un département assignés',
      );
    }
    if (role === 'REGIONAL' && !user.region) {
      throw new BadRequestException(
        'Les utilisateurs régionaux doivent avoir une région assignée',
      );
    }
    return toPublicUser(await this.prisma.user.update({
      where: { id },
      data: { role: role as any },
    }));
  }

  async updateUserTerritory(
    id: string,
    role: string,
    region: string | null,
    department: string | null,
    actingUserId: string,
    actorRole: string,
  ) {
    if (id === actingUserId) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre territoire');
    }
    if (!AuthService.ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException('Rôle invalide');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    assertCanManageRole(actorRole, user.role);
    assertCanManageRole(actorRole, role);

    const resolvedTerritory = await resolveStaffTerritory(this.prisma, role, {
      region,
      department,
    });

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role: role as any,
        region: resolvedTerritory.region,
        department: resolvedTerritory.department,
      },
    });
    await (this.prisma as any).auditLog.create({
      data: {
        userId: actingUserId,
        action: 'USER_TERRITORY_CHANGED',
        resourceType: 'User',
        resourceId: id,
        details: {
          previousRole: user.role,
          previousRegion: user.region ?? null,
          previousDepartment: user.department ?? null,
          newRole: role,
          newRegion: resolvedTerritory.region,
          newDepartment: resolvedTerritory.department,
        },
      },
    });
    return toPublicUser(updated);
  }

  async setUserActive(id: string, isActive: boolean, actingUserId: string, actorRole: string) {
    if (id === actingUserId) {
      throw new BadRequestException(
        isActive
          ? 'Vous ne pouvez pas réactiver votre propre compte'
          : 'Vous ne pouvez pas suspendre votre propre compte',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    assertCanManageRole(actorRole, user.role);
    return toPublicUser(await this.prisma.user.update({
      where: { id },
      data: { isActive },
    }));
  }

  /**
   * Self-service account deletion — soft only. Deactivates the account
   * (the same isActive flag admin suspend uses) rather than hard-deleting,
   * since most accounts carry FK-linked declarations/submissions that must
   * be retained for regulatory record-keeping (see deleteUser below).
   * Deactivation blocks future logins immediately (checked in validateUser)
   * but does not revoke an already-issued JWT, which stays valid until it
   * expires — the same limitation admin suspend already has, since this
   * codebase has no token blacklist.
   */
  async deactivateOwnAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    return { message: 'Compte désactivé avec succès.' };
  }

  /**
   * Admin break-glass: force-disables 2FA on another account, for when the
   * user is locked out because the OTP email never arrived (email delivery
   * on this deployment is known to be unreliable — see NotificationService).
   * Self-service /auth/two-factor only ever operates on the caller's own
   * account, so this is the only way to recover a locked-out user.
   */
  async adminSetTwoFactorEnabled(id: string, enabled: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { twoFactorEnabled: enabled, twoFactorCodeHash: null, twoFactorCodeExpires: null },
    });
    return toPublicUser(updated);
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
  async deleteUser(id: string, actingUserId: string, actorRole: string) {
    if (id === actingUserId) {
      throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    assertCanManageRole(actorRole, user.role);
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
    await this.requirePasswordMinLength(newPassword);

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
    await this.requirePasswordMinLength(newPassword);

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
    await this.requirePasswordMinLength(newPassword);

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