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
import { REGISTRATION_REJECTED_LOGIN_MESSAGE } from '../common/registration-messages';
import { buildUserListWhere, type UserListFilterParams } from './user-list-filter';
import { TERRITORIAL_APPROVER_ROLES, assertCanApproveRegistration, assertCanManageRole, manageableRolesFor } from './staff-scope';
import { assertTerritorialAuthority, territoryWhere, type Territory } from './territory';
import { toPublicUser } from './public-user';
import { resolveAndValidateTerritory, resolveStaffTerritory } from '../territory/territory-resolver';
import { ResubmitRegistrationDto } from './dto/resubmit-registration.dto';
import {
  emptyValueRefusalMessage,
  emptyVerificationRows,
  missingVerificationFlags,
  verificationAuditDetails,
  verificationRefusalMessage,
  type VerificationFlags,
} from './registration-verification';

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

/**
 * Entity types approved at self-registration instead of by staff review.
 *
 * ADMINISTRATION files are state structures: the applicant is already a
 * known public body, there is nothing for a reviewer to verify that the
 * registration form does not already carry, and leaving them in the queue
 * only delayed their own declarations. Their account is therefore created
 * ACTIVE with its establishment ID allocated on the spot — the same
 * allocation approveCompanyRegistration performs, written in one
 * transaction so the activation and the ID commit together.
 *
 * Every other entity type keeps the staff-approval path untouched. The
 * `centralStructureConfirmed` gate in approveCompanyRegistration is left in
 * place deliberately: it stays correct for any ADMINISTRATION file still
 * sitting in the queue from before this change, and for a file that reaches
 * review because its auto-approval transaction failed.
 */
const AUTO_APPROVE_ENTITY_TYPES = ['ADMINISTRATION'] as const;

/**
 * The stored form of a login email: trimmed and lowercased. Applied on every
 * company write (registration, assisted registration, correction) and on both
 * staff account creations (register, adminCreateMinefopUser), so Jean@x.cm
 * and jean@x.cm cannot become two accounts. Accounts created before that keep
 * their typed case; the lookups below therefore stay case-insensitive.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Case-insensitive match on User.email, for lookups by a typed address. */
export function emailMatch(email: string) {
  return { email: { equals: email.trim(), mode: 'insensitive' as const } };
}

/**
 * A staff account's name for display next to a record it authored, falling
 * back to the address when neither name part is set (seeded and
 * script-created accounts have no first/last name). null when there is no
 * author at all — a self-registration, which the UI renders as its own case
 * rather than as a missing name.
 */
function displayNameOf(
  user: { firstName: string | null; lastName: string | null; email: string } | null | undefined,
): string | null {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter((part) => part?.trim()).join(' ').trim();
  return name || user.email;
}

/**
 * The company half of a registration body, shared by the public route and the
 * admin-assisted one. Extracted verbatim from registerCompany's former inline
 * literal so both paths are typed by one declaration rather than two copies.
 */
export interface CompanyRegistrationData {
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
}


/**
 * Extra confirmations a reviewer must supply alongside an approval.
 *
 * `centralStructureConfirmed` backs the "structure centrale" checkbox the
 * review dialog shows for an ADMINISTRATION file. It is re-checked
 * server-side because the checkbox alone is client-side: a request can be
 * sent without it, and the queue's `requiresCentralStructureCheck` is a hint
 * for the UI, not an enforcement point.
 *
 * The four verification flags are the reviewer's marks on the entity's name,
 * phone, contact email and (for the five CNPS types) CNPS number; see
 * registration-verification.ts.
 */
export interface ApproveRegistrationOptions extends VerificationFlags {
  centralStructureConfirmed?: boolean;
}

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
   * so a company that's lost track of its email can still log in. IDs are
   * minted upper-case, so the typed ID is upper-cased before its lookup:
   * "en26000112" from a phone keyboard is the same identifier.
   */
  async validateUser(login: string, password: string) {
    const identifier = login.trim();
    let user = await this.prisma.user.findFirst({ where: emailMatch(identifier) });
    if (!user) {
      const company = await this.prisma.company.findFirst({
        where: { establishmentId: identifier.toUpperCase() },
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
      if (user.role !== 'COMPANY') {
        throw new UnauthorizedException(
          "Votre compte est en attente d'approbation par un administrateur.",
        );
      }
    }
    // A rejected registration gets a fixed message that carries no reviewer
    // reason: the reason is reviewer-facing and reaches the company only in
    // the decision email, so login cannot be used to read it back. Both
    // checks sit after the password check, so neither reveals anything to
    // someone who does not already hold the credentials.
    if (user.status === 'REJECTED') {
      throw new UnauthorizedException(REGISTRATION_REJECTED_LOGIN_MESSAGE);
    }
    // A suspension (isActive=false without REJECTED) keeps its own message.
    if (!user.isActive) {
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

    // Update lastLoginAt on login
    this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

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
        status: user.status,
        approvalComment: user.approvalComment,
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
    // approvalComment stays out of PUBLIC_USER_SELECT (it is a reviewer note,
    // and toPublicUser also feeds the staff user lists). /auth/me is the
    // account's own row, and a COMPANY in COMPLEMENTS_REQUESTED has to read
    // the message to act on it — so it is added here only, for self.
    return { ...toPublicUser(user), approvalComment: user.approvalComment, features };
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

  // Roles a SUPER_ADMIN may create through adminCreateMinefopUser — the
  // MINEFOP field-agent roles only. SUPER_ADMIN, ADMIN_ONEFOP and AUDITOR
  // have no creation path: ADMIN_ONEFOP is excluded so that an ADMIN_ONEFOP
  // actor cannot mint more of its own rank (see ONEFOP_STAFF_ROLES in
  // staff-scope.ts). This endpoint exists specifically to replace the public
  // MINEFOP self-registration flow that was removed from the app.
  private static readonly MINEFOP_FIELD_ROLES = ['REGIONAL_ADMIN', 'DIVISIONAL_ADMIN'];

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
  }, actorRole: string, actorId: string) {
    if (!AuthService.MINEFOP_FIELD_ROLES.includes(dto.role)) {
      throw new BadRequestException('Rôle invalide pour la création directe');
    }
    // D1: ADMIN_ONEFOP may create ONEFOP staff only.
    assertCanManageRole(actorRole, dto.role);
    const email = normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findFirst({ where: emailMatch(email) });
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
          email,
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
          // Phase 1: the admin who minted the account owns it on the
          // attribution side — createdBy is the actor, not the target.
          createdBy: actorId,
          registrationMethod: 'ADMIN_CREATED',
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

  /**
   * Creates the user + company pair for a registration, whatever its origin.
   *
   * `attribution` is supplied by the caller, never by the request body: the
   * public route passes SELF_REGISTRATION with no author, the admin-assisted
   * route passes ASSISTED plus the acting admin's id.
   *
   * Deliberately returns the rows rather than a session. The public route
   * logs the new declarant in; the assisted route must not, because its
   * caller is the admin, who stays logged in as themselves.
   */
  private async createCompanyRegistration(
    email: string,
    password: string,
    companyData: CompanyRegistrationData,
    attribution: {
      registrationMethod: string;
      createdBy?: string | null;
      assigneeId?: string | null;
      /**
       * Forces the file into the review queue even when its entity type is in
       * AUTO_APPROVE_ENTITY_TYPES. Set by the assisted route per DECISION 2:
       * the field error rate is unknown, and a declarant that did not fill in
       * its own details gets no less oversight than one that did.
       */
      skipAutoApproval?: boolean;
    },
  ) {
    email = normalizeEmail(email);
    const existingUser = await this.prisma.user.findFirst({ where: emailMatch(email) });
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

    // The establishment ID is generated here, at registration, for every
    // file: public, assisted and auto-approved alike. Both inputs are checked
    // before any write, so a refused registration consumes no serial. A
    // failure after generate() (an email or NIU race) leaves a gap, which the
    // policy allows. The -01 Establishment row stays approval-time.
    if (!EstablishmentIdGenerator.isKnownEntityType(companyData.entityType)) {
      throw new BadRequestException("Type d'entité inconnu.");
    }
    const subdivision = await this.prisma.subdivision.findUnique({
      where: { id: resolvedTerritory.subdivisionId as string },
      select: { code: true },
    });
    const subdivisionCode = subdivision?.code?.trim();
    if (!subdivisionCode) {
      // Every subdivision is coded (360/360, frozen by 20261003120000), so
      // this is a data fault, not a user error: no fallback ID is made up.
      throw new Error(`Subdivision ${resolvedTerritory.subdivisionId} has no code`);
    }
    const establishmentId = await EstablishmentIdGenerator.generate(
      this.prisma,
      companyData.entityType as string,
      subdivisionCode.slice(-2),
    );

    const autoApprove =
      !attribution.skipAutoApproval &&
      !!companyData.entityType &&
      (AUTO_APPROVE_ENTITY_TYPES as readonly string[]).includes(companyData.entityType);
    const resolvedTaxNumber =
      companyData.taxNumber ||
      `NA-${crypto.randomUUID()}`;

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
          status: 'PENDING_APPROVAL',
          isActive: true,
          emailVerified: false,
          registrationMethod: attribution.registrationMethod,
          createdBy: attribution.createdBy ?? null,
          assigneeId: attribution.assigneeId ?? null,
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
          establishmentId,
          establishmentIdGeneratedAt: new Date(),
        },
      });

      // Issuance journal. The migration's sequence seed also reads these
      // rows, so a number whose company is later deleted is never reissued.
      // Attributed to the acting admin on the assisted route, to the
      // registrant otherwise. Losing it must not undo the registration.
      await this.prisma.auditLog
        .create({
          data: {
            userId: attribution.createdBy ?? user.id,
            action: 'COMPANY_ESTABLISHMENT_ID_ISSUED',
            resourceType: 'Company',
            resourceId: company.id,
            details: {
              establishmentId,
              companyId: company.id,
              registrantUserId: user.id,
              entityType: company.entityType,
              registrationMethod: attribution.registrationMethod,
            },
          },
        })
        .catch((error: any) => {
          this.logger.error(
            `Failed to audit establishment ID ${establishmentId} issuance: ${(error as Error).message}`,
          );
        });

      // Auto-approval: activate the account and create its -01 Establishment
      // in one transaction, reusing the ID generated above, so a failure here
      // leaves a normal PENDING_APPROVAL file for staff review.
      let activeUser = user;
      if (autoApprove) {
        const approved = await this.autoApproveRegistration(user, company);
        activeUser = approved.user;
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

      // activeUser, not user: callers echo `status` back to the client, and an
      // auto-approved account has to report ACTIVE, not PENDING_APPROVAL.
      return { user: activeUser, company, establishmentId: company.establishmentId as string };
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email ou numéro contribuable déjà utilisé');
      }
      throw error;
    }
  }

  /**
   * Public company self-registration. The declarant chose its own password and
   * is logged in on success, so the response shape is unchanged from before
   * createCompanyRegistration was extracted out of it.
   */
  async registerCompany(
    email: string,
    password: string,
    companyData: CompanyRegistrationData,
  ) {
    const created = await this.createCompanyRegistration(email, password, companyData, {
      registrationMethod: 'SELF_REGISTRATION',
    });

    const loginResult = await this.login(created.user);
    return {
      ...loginResult,
      company: {
        id: created.company.id,
        name: created.company.name,
        establishmentId: created.establishmentId,
        taxNumber: created.company.taxNumber,
        entityType: created.company.entityType,
        attestationUrl: null,
      },
    };
  }

  /**
   * Staff registers a declarant on its behalf — the field-work path.
   *
   * Phase 2 of docs/plans/territorial-admin-monitoring.md. Differs from the
   * public route in four ways, all of them deliberate:
   *
   *  - The password is generated here and returned once, in plaintext, like
   *    adminCreateMinefopUser. Outbound email is unreliable on this
   *    deployment, so handing it to the admin is the delivery path, not a
   *    fallback.
   *  - No session is issued. The caller is the admin, who must stay logged in
   *    as themselves; returning a token for the new declarant would hand the
   *    admin someone else's account.
   *  - The file always queues for review (DECISION 2), even for the entity
   *    types that auto-approve on the public route.
   *  - The acting admin is recorded as both author (createdBy) and owner of
   *    the follow-up (assigneeId).
   *
   * A territorial actor may only register inside its own ressort:
   * assertTerritorialAuthority is checked against the *resolved* territory, so
   * the check runs on canonical region/department names rather than on
   * whatever the body happened to spell.
   */
  async adminRegisterCompany(
    companyData: CompanyRegistrationData & { email: string },
    actor: Territory & { id: string },
  ) {
    const resolved = await resolveAndValidateTerritory(
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
    assertTerritorialAuthority(actor, {
      region: resolved.region,
      department: resolved.department,
      regionId: resolved.regionId,
      departmentId: resolved.departmentId,
    });

    const email = normalizeEmail(companyData.email);
    const temporaryPassword = this.generateTemporaryPassword();
    const created = await this.createCompanyRegistration(
      email,
      temporaryPassword,
      companyData,
      {
        registrationMethod: 'ASSISTED',
        createdBy: actor.id,
        assigneeId: actor.id,
        skipAutoApproval: true,
      },
    );

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'COMPANY_REGISTRATION_ASSISTED',
        resourceType: 'User',
        resourceId: created.user.id,
        details: {
          email,
          companyId: created.company.id,
          organisation: created.company.name,
          entityType: created.company.entityType,
          region: resolved.region,
          department: resolved.department,
          registrationMethod: 'ASSISTED',
        },
      },
    }).catch((error: any) => {
      // The registration itself succeeded; losing its journal entry must not
      // undo it or fail the admin's request.
      this.logger.error(
        `Failed to audit assisted registration of ${email}: ${(error as Error).message}`,
      );
    });

    return {
      user: toPublicUser(created.user),
      company: {
        id: created.company.id,
        name: created.company.name,
        establishmentId: created.establishmentId,
        taxNumber: created.company.taxNumber,
        entityType: created.company.entityType,
      },
      temporaryPassword,
    };
  }

  /**
   * Activates a freshly self-registered account whose entity type is in
   * AUTO_APPROVE_ENTITY_TYPES. Its establishment ID was generated at
   * registration; the `if (!issued)` branch below only serves a row that
   * has none (a legacy file), and is the same fallback approval keeps.
   *
   * Deliberately the same writes, in the same order, as the transaction
   * inside approveCompanyRegistration — (legacy: establishment ID and
   * Company update), principal Establishment row, user ACTIVE, audit row — so an
   * auto-approved file is indistinguishable downstream from a staff-approved
   * one. The only differences: the audit action records that no reviewer was
   * involved, and the audit row is attributed to the registrant because
   * there is no actor.
   *
   * EstablishmentIdGenerator draws its serial from a Postgres sequence, so
   * concurrent allocations never collide and no lock is involved. The
   * single retry on P2002 is kept for the remaining unique indexes the
   * transaction writes (the -01 Establishment code and principal row).
   */
  private async autoApproveRegistration(
    user: { id: string; email: string },
    company: {
      id: string;
      name: string | null;
      entityType: string | null;
      establishmentId: string | null;
      subdivisionId: string | null;
      regionId: string | null;
      departmentId: string | null;
      region: string | null;
      department: string | null;
      subdivision: string | null;
      address: string | null;
      phone: string | null;
    },
  ): Promise<{ user: any; establishmentId: string }> {
    if (!company.entityType) {
      throw new BadRequestException("Le type d'entité est obligatoire pour générer l'identifiant d'établissement.");
    }
    if (!company.subdivisionId) {
      throw new BadRequestException("L'arrondissement est obligatoire pour générer l'identifiant d'établissement.");
    }

    const attempts = 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const subdivision = await tx.subdivision.findUnique({
            where: { id: company.subdivisionId as string },
            select: { id: true, code: true },
          });
          if (!subdivision?.code?.trim()) {
            throw new BadRequestException("Code d'arrondissement introuvable pour cet établissement.");
          }
          const subdivisionCode = subdivision.code.slice(-2);
          let issued = company.establishmentId;
          if (!issued) {
            issued = await EstablishmentIdGenerator.generate(tx, company.entityType as string, subdivisionCode);
            await tx.company.update({
              where: { id: company.id },
              data: { establishmentId: issued, establishmentIdGeneratedAt: new Date() },
            });
          }
          await tx.establishment.create({
            data: {
              code: `${issued}-01`,
              name: company.name || 'Siège Principal',
              isPrincipal: true,
              status: 'ACTIVE',
              companyId: company.id,
              regionId: company.regionId || '',
              departmentId: company.departmentId || '',
              subdivisionId: (company.subdivisionId || '') as string,
              region: company.region || '',
              department: company.department || '',
              subdivision: company.subdivision || '',
              address: company.address || '',
              phone: company.phone || null,
              email: (company as any).email || user.email,
            },
          });
          const updated = await tx.user.update({
            where: { id: user.id },
            data: { status: 'ACTIVE', isActive: true, approvedAt: new Date() },
          });
          await tx.auditLog.create({
            data: {
              userId: user.id,
              action: 'COMPANY_REGISTRATION_AUTO_APPROVED',
              resourceType: 'User',
              resourceId: user.id,
              details: {
                companyId: company.id,
                establishmentId: issued,
                entityType: company.entityType,
                reason: 'AUTO_APPROVE_ENTITY_TYPES',
              },
            },
          });
          return { user: updated, establishmentId: issued };
        });
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002' && attempt < attempts) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException("Un identifiant d'établissement existe déjà pour ce territoire.");
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
    // Case-insensitive: Jean@x.cm must not read as available while
    // jean@x.cm is taken. A missing or blank address is not available.
    if (typeof email !== 'string' || email.trim() === '') return { available: false };
    const user = await this.prisma.user.findFirst({ where: emailMatch(email) });
    return { available: !user };
  }

  // actorTerritory: the acting user's region/department (territoryFromUser
  // of req.user). Only REGIONAL/DIVISIONAL actors need it (D3); without it
  // they fail closed.
  async approveUser(
    id: string,
    actorId: string,
    actorRole: string,
    actorTerritory?: Territory,
    options?: ApproveRegistrationOptions,
  ) {
    if (typeof actorId !== 'string' || actorId.trim() === '') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.role === 'COMPANY') {
      return this.approveCompanyRegistration(user, actorId, actorRole, actorTerritory, options);
    }
    assertCanApproveRegistration({ ...actorTerritory, role: actorRole }, user);
    if (user.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException("Cet utilisateur n'est pas en attente d'approbation");
    }
    return toPublicUser(await this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true, approvedAt: new Date() },
    }));
  }

  async rejectUser(
    id: string,
    actorId: string,
    actorRole: string,
    actorTerritory: Territory | undefined,
    reason: string,
  ) {
    if (typeof actorId !== 'string' || actorId.trim() === '') throw new UnauthorizedException();
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmed) throw new BadRequestException('Le motif de rejet est obligatoire.');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.role === 'COMPANY') {
      const company = await this.requireCompanyForReview(user.id);
      assertTerritorialAuthority({ ...actorTerritory, role: actorRole }, company);
      if (user.status !== 'PENDING_APPROVAL' && user.status !== 'COMPLEMENTS_REQUESTED') {
        throw new BadRequestException("Cet utilisateur n'est pas en attente d'approbation");
      }
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          status: 'REJECTED',
          isActive: false,
          rejectionReason: trimmed,
          rejectedAt: new Date(),
        },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: 'COMPANY_REGISTRATION_REJECTED',
          resourceType: 'User',
          resourceId: id,
          details: { companyId: company.id, reason: trimmed },
        },
      });
      // Fire-and-forget: SMTP is unreliable from the host, and a rejection
      // that is already committed must not surface as a 500.
      this.notificationService
        .sendRegistrationRejectedEmail(updated.email, company.name, trimmed)
        .catch((error) => this.logger.error(`Failed to send rejection email: ${(error as Error).message}`));
      return toPublicUser(updated);
    }
    assertCanApproveRegistration({ ...actorTerritory, role: actorRole }, user);
    // D3 grants REGIONAL/DIVISIONAL registration review only: without this,
    // "reject" on an ACTIVE colleague would deactivate the account.
    if ((TERRITORIAL_APPROVER_ROLES as readonly string[]).includes(actorRole) && user.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException("Cet utilisateur n'est pas en attente d'approbation");
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'REJECTED',
        isActive: false,
        rejectionReason: trimmed,
        rejectedAt: new Date(),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'STAFF_REGISTRATION_REJECTED',
        resourceType: 'User',
        resourceId: id,
        details: { reason: trimmed },
      },
    });
    return toPublicUser(updated);
  }

  async requestComplements(
    id: string,
    actorId: string,
    actorRole: string,
    actorTerritory: Territory | undefined,
    message: string,
  ) {
    if (typeof actorId !== 'string' || actorId.trim() === '') throw new UnauthorizedException();
    const trimmed = typeof message === 'string' ? message.trim() : '';
    if (!trimmed) throw new BadRequestException('Le message de demande de compléments est obligatoire.');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.role !== 'COMPANY') {
      throw new BadRequestException('Les demandes de compléments concernent uniquement les comptes entreprise.');
    }
    const company = await this.requireCompanyForReview(user.id);
    assertTerritorialAuthority({ ...actorTerritory, role: actorRole }, company);
    if (user.status !== 'PENDING_APPROVAL' && user.status !== 'COMPLEMENTS_REQUESTED') {
      throw new BadRequestException("Cet utilisateur n'est pas en attente d'approbation");
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: 'COMPLEMENTS_REQUESTED', isActive: true, approvalComment: trimmed },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'COMPANY_REGISTRATION_COMPLEMENTS_REQUESTED',
        resourceType: 'User',
        resourceId: id,
        details: { companyId: company.id, message: trimmed },
      },
    });
    this.notificationService
      .sendRegistrationComplementsEmail(updated.email, company.name, trimmed)
      .catch((error) => this.logger.error(`Failed to send complements email: ${(error as Error).message}`));
    return toPublicUser(updated);
  }

  /**
   * The company fields a company may correct itself when complements were
   * requested. An explicit allowlist, copied field by field below rather than
   * spread from the body, so establishmentId stays unreachable: it is
   * generated at registration and is permanent. Territory is handled separately because it has
   * to be resolved against the canonical records first.
   */
  private static readonly CORRECTABLE_COMPANY_FIELDS = [
    'name',
    'taxNumber',
    'mainActivity',
    'secondaryActivity',
    'parentCompany',
    'address',
    'phone',
    'cnpsNumber',
    'fax',
    'socialCapital',
    'entityType',
  ] as const;

  async resubmitRegistration(actorId: string, data?: ResubmitRegistrationDto) {
    if (typeof actorId !== 'string' || actorId.trim() === '') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');
    if (user.role !== 'COMPANY') {
      throw new BadRequestException('Seul un compte entreprise peut renvoyer son dossier.');
    }
    if (user.status !== 'COMPLEMENTS_REQUESTED') {
      throw new BadRequestException("Aucun complément n'a été demandé pour ce compte.");
    }
    const company = await this.requireCompanyForReview(user.id);
    const payload = (data ?? {}) as Record<string, unknown>;

    return this.prisma.$transaction(async (tx) => {
      // The status flip goes first and is conditional on the status still being
      // COMPLEMENTS_REQUESTED, so two concurrent resubmissions — or a reviewer
      // deciding in between — cannot both get through. count === 0 means
      // someone else moved the file: bail out before touching Company, so a
      // losing request never half-writes its corrections.
      const flipped = await tx.user.updateMany({
        where: { id: actorId, status: 'COMPLEMENTS_REQUESTED' },
        data: { status: 'PENDING_APPROVAL' },
      });
      if (flipped.count === 0) {
        throw new ConflictException(
          'Ce dossier a déjà été renvoyé ou traité entre-temps. Rechargez la page.',
        );
      }

      const updates: Record<string, unknown> = {};
      // A type alias, not an interface: that is what gives the diff an implicit
      // index signature, so it is assignable to Prisma's Json input type.
      type FieldDiff = { before: string | number | boolean | null; after: string | number | boolean | null };
      const changes: Record<string, FieldDiff> = {};
      const record = (field: string, before: unknown, after: unknown) => {
        if (before === after) return;
        updates[field] = after;
        changes[field] = { before: before as FieldDiff['before'], after: after as FieldDiff['after'] };
      };

      for (const field of AuthService.CORRECTABLE_COMPANY_FIELDS) {
        if (!(field in payload)) continue;
        const after = payload[field];
        if (after === undefined) continue;
        record(field, (company as Record<string, unknown>)[field], after);
      }

      // Territory moves only when the body carries part of the chain, and then
      // the whole chain is resolved against the canonical records; only the
      // resolved names and ids are persisted, never what the client sent.
      // Nothing else moves with it, so the file simply sits in the territorial
      // queue its (new) department belongs to.
      const territoryKeys = ['region', 'department', 'subdivision', 'regionId', 'departmentId', 'subdivisionId'];
      if (territoryKeys.some((key) => key in payload && payload[key] !== undefined)) {
        const resolved = await resolveAndValidateTerritory(
          tx,
          {
            regionId: payload.regionId as string | undefined,
            departmentId: payload.departmentId as string | undefined,
            subdivisionId: payload.subdivisionId as string | undefined,
            region: payload.region as string | undefined,
            department: payload.department as string | undefined,
            subdivision: payload.subdivision as string | undefined,
          },
          { requireSubdivision: true },
        );
        record('region', company.region, resolved.region);
        record('department', company.department, resolved.department);
        record('subdivision', company.subdivision, resolved.subdivision);
        record('regionId', company.regionId, resolved.regionId);
        record('departmentId', company.departmentId, resolved.departmentId);
        record('subdivisionId', company.subdivisionId, resolved.subdivisionId);
      }

      // The email lives on User, not Company, so it is diffed and written on
      // its own. It is the login identifier: a change takes effect as the
      // sign-in address immediately. emailVerified is deliberately left as is
      // and no new verification link is sent (decision of 2026-10-06; the flag
      // gates nothing today). Stored normalised, like registration; the
      // availability check is case-insensitive, like isEmailAvailable.
      let newEmail: string | undefined;
      if (typeof payload.email === 'string') {
        const after = normalizeEmail(payload.email);
        if (after !== user.email) {
          const taken = await tx.user.findFirst({
            where: { ...emailMatch(after), id: { not: actorId } },
            select: { id: true },
          });
          if (taken) {
            throw new ConflictException('Un utilisateur avec cet email existe déjà');
          }
          newEmail = after;
          changes.email = { before: user.email, after };
        }
      }

      // taxNumber is unique. Pre-checked for a readable 409, excluding this
      // company's own row, with the P2002 catch below as the race backstop.
      if (typeof updates.taxNumber === 'string') {
        const clash = await tx.company.findFirst({
          where: { taxNumber: updates.taxNumber, id: { not: company.id } },
          select: { id: true },
        });
        if (clash) {
          throw new ConflictException('Une entreprise avec ce numéro contribuable existe déjà');
        }
      }

      if (Object.keys(updates).length > 0) {
        try {
          await tx.company.update({ where: { id: company.id }, data: updates });
        } catch (error) {
          if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException('Une entreprise avec ce numéro contribuable existe déjà');
          }
          throw error;
        }
      }

      // Its own P2002 handler: the one above is worded for the NIU, and would
      // tell a declarant their tax number is taken when it is their email.
      if (newEmail !== undefined) {
        try {
          await tx.user.update({ where: { id: actorId }, data: { email: newEmail } });
        } catch (error) {
          if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException('Un utilisateur avec cet email existe déjà');
          }
          throw error;
        }
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'COMPANY_REGISTRATION_RESUBMITTED',
          resourceType: 'User',
          resourceId: actorId,
          details: { companyId: company.id, previousStatus: 'COMPLEMENTS_REQUESTED', changes },
        },
      });

      // Re-read rather than trusting the in-memory copies, so the response
      // carries exactly what was persisted. approvalComment is deliberately
      // left in place: the reviewer's message stays readable until the file is
      // decided.
      const [freshUser, freshCompany] = await Promise.all([
        tx.user.findUnique({ where: { id: actorId } }),
        tx.company.findUnique({ where: { id: company.id } }),
      ]);
      return { ...toPublicUser(freshUser!), company: freshCompany };
    });
  }

  async listCompanyRegistrations(
    actor: Territory,
    params: {
      entityType?: string;
      region?: string;
      from?: string;
      to?: string;
      search?: string;
      status?: string;
      createdBy?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;
    const scope = territoryWhere(actor);

    // Narrowing the queue to one region is a filter, not a widening: the
    // requested region is checked against the actor's own jurisdiction with
    // assertTerritorialAuthority, so a REGIONAL/DIVISIONAL reviewer asking
    // for someone else's region is refused rather than silently served their
    // own. The actor's own department is carried into the target so the
    // DIVISIONAL branch (region AND department) can match; national roles
    // return early inside the helper.
    const regionFilter = params.region?.trim();
    const regionScope: Record<string, unknown> = { ...scope };
    if (regionFilter) {
      assertTerritorialAuthority(actor, {
        region: regionFilter,
        department: actor.department,
        departmentId: actor.departmentId,
      });
      regionScope.AND = [{ region: { equals: regionFilter, mode: 'insensitive' } }];
    }

    const createdAt: Record<string, Date> = {};
    if (params.from) {
      const from = new Date(params.from);
      if (Number.isNaN(from.getTime())) throw new BadRequestException('Date de début invalide.');
      createdAt.gte = from;
    }
    if (params.to) {
      const to = new Date(params.to);
      if (Number.isNaN(to.getTime())) throw new BadRequestException('Date de fin invalide.');
      createdAt.lte = to;
    }

    const userWhere: Record<string, unknown> = { role: 'COMPANY' };
    // No status = the review queue (pending + complements). 'ALL' lifts the
    // status filter, for "every file this agent registered" (/admin/equipe).
    if (params.status === 'ALL') {
      // no status condition
    } else if (params.status) userWhere.status = params.status;
    else userWhere.status = { in: ['PENDING_APPROVAL', 'COMPLEMENTS_REQUESTED'] };
    // Files registered by one admin (assisted registration). A filter within
    // the actor's territory scope, never a widening of it: `regionScope`
    // still applies, so a REGIONAL_ADMIN sees only that agent's files in its
    // own region.
    const createdBy = params.createdBy?.trim();
    if (createdBy) userWhere.createdBy = createdBy;

    const where: Record<string, unknown> = {
      ...regionScope,
      user: userWhere,
    };
    if (params.entityType) where.entityType = params.entityType;
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
    const term = params.search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { taxNumber: { contains: term, mode: 'insensitive' } },
        { cnpsNumber: { contains: term, mode: 'insensitive' } },
        { user: { is: { email: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const [total, companies] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              createdAt: true,
              approvalComment: true,
              rejectionReason: true,
              registrationNumber: true,
              // Phase 2: who registered this file and how. createdByUser is
              // joined rather than resolved client-side so the queue renders
              // a name without a second round trip per row.
              registrationMethod: true,
              createdBy: true,
              createdByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = await this.withDuplicateHints(companies);
    const resubmissions = await this.lastResubmissionByUser(companies.map((row) => row.user.id));
    const itemsWithResubmission = items.map((item) => ({
      ...item,
      lastResubmission: resubmissions.get(item.id) ?? null,
    }));
    // Counts drive the status tabs: they follow the territory selection so
    // the tab numbers match the rows, but not search/type/date.
    const counts = await this.companyRegistrationCounts(regionScope);
    return { items: itemsWithResubmission, total, page, pageSize, counts };
  }

  /**
   * The corrections a company last sent, for the review queue — but only when
   * that resubmission is newer than the last complements request on the same
   * file. Otherwise a reviewer opening a freshly re-requested dossier would see
   * the diff from the previous round sitting next to their own new request.
   */
  private async lastResubmissionByUser(userIds: string[]) {
    const out = new Map<
      string,
      { at: Date; changes: Record<string, { before: unknown; after: unknown }> } | null
    >();
    if (userIds.length === 0) return out;

    const rows = await this.prisma.auditLog.findMany({
      where: {
        resourceType: 'User',
        resourceId: { in: userIds },
        action: {
          in: ['COMPANY_REGISTRATION_RESUBMITTED', 'COMPANY_REGISTRATION_COMPLEMENTS_REQUESTED'],
        },
      },
      select: { action: true, resourceId: true, details: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Newest first, so the first row seen for a (file, action) pair is its latest.
    const lastResubmitted = new Map<string, { at: Date; details: unknown }>();
    const lastRequested = new Map<string, Date>();
    for (const row of rows) {
      if (row.action === 'COMPANY_REGISTRATION_RESUBMITTED') {
        if (!lastResubmitted.has(row.resourceId)) {
          lastResubmitted.set(row.resourceId, { at: row.createdAt, details: row.details });
        }
      } else if (!lastRequested.has(row.resourceId)) {
        lastRequested.set(row.resourceId, row.createdAt);
      }
    }

    for (const id of userIds) {
      const resubmitted = lastResubmitted.get(id);
      const requested = lastRequested.get(id);
      if (!resubmitted || (requested && requested >= resubmitted.at)) {
        out.set(id, null);
        continue;
      }
      const details = (resubmitted.details ?? {}) as {
        changes?: Record<string, { before: unknown; after: unknown }>;
      };
      out.set(id, { at: resubmitted.at, changes: details.changes ?? {} });
    }
    return out;
  }

  private async approveCompanyRegistration(
    user: { id: string; email: string; status: string },
    actorId: string,
    actorRole: string,
    actorTerritory?: Territory,
    options?: ApproveRegistrationOptions,
  ) {
    const company = await this.requireCompanyForReview(user.id);
    assertTerritorialAuthority({ ...actorTerritory, role: actorRole }, company);
    if (user.status !== 'PENDING_APPROVAL' && user.status !== 'COMPLEMENTS_REQUESTED') {
      throw new BadRequestException("Cet utilisateur n'est pas en attente d'approbation");
    }
    if (!company.entityType) {
      throw new BadRequestException("Le type d'entité est obligatoire pour générer l'identifiant d'établissement.");
    }
    // An ADMINISTRATION file may only be approved once the reviewer has
    // confirmed the applicant really is a central structure. Strictly `true`:
    // a missing, null or merely truthy flag is refused, so the confirmation
    // has to be deliberate rather than a side effect of how a client
    // serialises its form. Checked before the transaction, so a refusal
    // creates no Establishment and writes no audit row.
    if (company.entityType === 'ADMINISTRATION' && options?.centralStructureConfirmed !== true) {
      throw new BadRequestException(
        "La confirmation « structure centrale » est obligatoire pour approuver une administration.",
      );
    }
    // The reviewer's marks on the entity's identifying values, enforced the
    // same way and at the same point: every row that applies to this entity
    // type must hold a value and be marked strictly `true`, or nothing is
    // written. An empty value is refused first, with its own message, because
    // no mark can fix it: the company has to send a correction.
    const verifiedValues = {
      name: company.name,
      phone: company.phone ?? null,
      contactEmail: user.email,
      cnpsNumber: company.cnpsNumber ?? null,
    };
    const emptyRows = emptyVerificationRows(company.entityType, verifiedValues);
    if (emptyRows.length > 0) {
      throw new BadRequestException(emptyValueRefusalMessage(emptyRows));
    }
    const missingFlags = missingVerificationFlags(company.entityType, options);
    if (missingFlags.length > 0) {
      throw new BadRequestException(verificationRefusalMessage(missingFlags));
    }
    if (!company.subdivisionId) {
      throw new BadRequestException("L'arrondissement est obligatoire pour générer l'identifiant d'établissement.");
    }

    const attempts = 2;
    let establishmentId = company.establishmentId;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const subdivision = await tx.subdivision.findUnique({
            where: { id: company.subdivisionId as string },
            select: { id: true, code: true },
          });
          if (!subdivision?.code?.trim()) {
            throw new BadRequestException("Code d'arrondissement introuvable pour cet établissement.");
          }
          const subdivisionCode = subdivision.code.slice(-2);
          // New files carry the ID generated at registration. Only a legacy
          // file (registered before IDs moved to registration) has none and
          // gets one here, with YY = the approval year.
          let issued = company.establishmentId;
          if (!issued) {
            issued = await EstablishmentIdGenerator.generate(tx, company.entityType as string, subdivisionCode);
            await tx.company.update({
              where: { id: company.id },
              data: { establishmentId: issued, establishmentIdGeneratedAt: new Date() },
            });
          }
          await tx.establishment.create({
            data: {
              code: `${issued}-01`,
              name: company.name || 'Siège Principal',
              isPrincipal: true,
              status: 'ACTIVE',
              companyId: company.id,
              regionId: company.regionId || '',
              departmentId: company.departmentId || '',
              subdivisionId: (company.subdivisionId || '') as string,
              region: company.region || '',
              department: company.department || '',
              subdivision: company.subdivision || '',
              address: company.address || '',
              phone: company.phone || null,
              email: (company as any).email || user.email,
            },
          });
          const updated = await tx.user.update({
            where: { id: user.id },
            data: { status: 'ACTIVE', isActive: true, approvedAt: new Date() },
          });
          await tx.auditLog.create({
            data: {
              userId: actorId,
              action: 'COMPANY_REGISTRATION_APPROVED',
              resourceType: 'User',
              resourceId: user.id,
              details: {
                companyId: company.id,
                establishmentId: issued,
                verification: verificationAuditDetails(company.entityType, verifiedValues),
              },
            },
          });
          return { updated, establishmentId: issued };
        });
        establishmentId = result.establishmentId;
        // Both of these run after COMMIT and swallow their own failures: the
        // approval is already durable, and neither
        // the mail server nor the PDF pipeline may undo them.
        this.notificationService
          .sendRegistrationApprovedEmail(user.email, company.name, result.establishmentId)
          .catch((error) => this.logger.error(`Failed to send approval email: ${(error as Error).message}`));
        this.issueAttestation(company.id, result.establishmentId, company, user.email).catch((error) =>
          this.logger.error(`Failed to generate attestation: ${(error as Error).message}`),
        );
        return toPublicUser(result.updated);
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002' && attempt < attempts) {
          continue;
        }
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException("Un identifiant d'établissement existe déjà pour ce territoire.");
        }
        throw error;
      }
    }
    throw new ConflictException("Un identifiant d'établissement existe déjà pour ce territoire.");
  }

  private async requireCompanyForReview(userId: string) {
    const company = await this.prisma.company.findUnique({ where: { userId } });
    if (!company) throw new BadRequestException('Entreprise introuvable pour ce compte.');
    return company;
  }

  private async issueAttestation(
    companyId: string,
    establishmentId: string,
    company: { name: string; entityType: string | null; taxNumber: string; region: string; department: string; subdivision: string; createdAt: Date },
    email: string,
  ) {
    const attestation = await this.pdfService.generateRegistrationAttestation({
      establishmentId,
      companyName: company.name,
      entityType: company.entityType ?? 'N/A',
      taxNumber: company.taxNumber,
      region: company.region,
      department: company.department,
      subdivision: company.subdivision,
      registrationDate: company.createdAt,
      email,
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: { attestationUrl: attestation.storagePath, attestationGeneratedAt: new Date() },
    });
  }

  private async companyRegistrationCounts(scope: Record<string, unknown>) {
    const [pending, complements, approved, rejected] = await Promise.all([
      this.prisma.company.count({ where: { ...scope, user: { role: 'COMPANY', status: 'PENDING_APPROVAL' } } }),
      this.prisma.company.count({ where: { ...scope, user: { role: 'COMPANY', status: 'COMPLEMENTS_REQUESTED' } } }),
      this.prisma.company.count({ where: { ...scope, user: { role: 'COMPANY', status: 'ACTIVE' } } }),
      this.prisma.company.count({ where: { ...scope, user: { role: 'COMPANY', status: 'REJECTED' } } }),
    ]);
    return { pending, complements, approved, rejected };
  }

  private async withDuplicateHints(
    companies: Array<{
      id: string;
      name: string;
      taxNumber: string;
      cnpsNumber: string | null;
      subdivisionId: string | null;
      entityType: string | null;
      region: string;
      department: string;
      createdAt: Date;
      phone: string | null;
      respondentFirstName: string | null;
      respondentLastName: string | null;
      respondentFunction: string | null;
      respondentPhone: string | null;
      respondentPhone2: string | null;
      user: {
        id: string;
        email: string;
        status: string;
        createdAt: Date;
        approvalComment: string | null;
        rejectionReason: string | null;
        registrationNumber: string | null;
        registrationMethod: string | null;
        createdBy: string | null;
        createdByUser: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
      };
    }>,
  ) {
    if (companies.length === 0) return [];
    const ids = companies.map((row) => row.id);
    const taxNumbers = companies.map((row) => row.taxNumber).filter((value) => value && !value.startsWith('NA-'));
    const cnpsNumbers = companies.map((row) => row.cnpsNumber).filter((value): value is string => !!value);
    const or: Record<string, unknown>[] = [];
    if (taxNumbers.length) or.push({ taxNumber: { in: taxNumbers } });
    if (cnpsNumbers.length) or.push({ cnpsNumber: { in: cnpsNumbers } });
    for (const row of companies) {
      if (row.subdivisionId) {
        or.push({ name: { equals: row.name, mode: 'insensitive' }, subdivisionId: row.subdivisionId });
      }
    }
    const others = or.length
      ? await this.prisma.company.findMany({
          where: { id: { notIn: ids }, OR: or },
          select: { id: true, name: true, taxNumber: true, cnpsNumber: true, subdivisionId: true },
        })
      : [];

    return companies.map((row) => {
      const hints: string[] = [];
      for (const other of others) {
        if (row.taxNumber && !row.taxNumber.startsWith('NA-') && other.taxNumber === row.taxNumber) {
          hints.push(`Même NIU que « ${other.name} »`);
        }
        if (row.cnpsNumber && other.cnpsNumber === row.cnpsNumber) {
          hints.push(`Même numéro CNPS que « ${other.name} »`);
        }
        if (
          row.subdivisionId &&
          other.subdivisionId === row.subdivisionId &&
          other.name.localeCompare(row.name, 'fr', { sensitivity: 'accent' }) === 0
        ) {
          hints.push(`Nom similaire dans le même arrondissement : « ${other.name} »`);
        }
      }
      return {
        id: row.user.id,
        companyId: row.id,
        organisation: row.name,
        email: row.user.email,
        entityType: row.entityType,
        region: row.region,
        department: row.department,
        status: row.user.status,
        taxNumber: row.taxNumber,
        cnpsNumber: row.cnpsNumber,
        phone: row.phone,
        // The declarant, shown to the reviewer as context, not verified.
        respondentFirstName: row.respondentFirstName,
        respondentLastName: row.respondentLastName,
        respondentFunction: row.respondentFunction,
        respondentPhone: row.respondentPhone,
        respondentPhone2: row.respondentPhone2,
        submittedAt: row.createdAt,
        registrationNumber: row.user.registrationNumber,
        approvalComment: row.user.approvalComment,
        rejectionReason: row.user.rejectionReason,
        duplicateHints: [...new Set(hints)],
        requiresCentralStructureCheck: row.entityType === 'ADMINISTRATION',
        registrationMethod: row.user.registrationMethod,
        createdBy: row.user.createdBy,
        createdByName: displayNameOf(row.user.createdByUser),
      };
    });
  }

  /** Hard cap on GET /auth/users/search — an autocomplete, not a list. */
  private static readonly SEARCH_MAX_RESULTS = 10;

  private static readonly ASSIGNABLE_ROLES = [
    'DIVISIONAL_ADMIN',
    'REGIONAL_ADMIN',
    'ADMIN_ONEFOP',
    'SUPER_ADMIN',
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
          // The post claimed in the organigramme: what an approver checks
          // before opening an account requested through a group link.
          poste: true,
          positionType: true,
          createdAt: true,
          lastLoginAt: true,
          perAgentTarget: true,
          // Phase 2: attribution on the staff roster, same treatment as the
          // registration queue.
          registrationMethod: true,
          createdBy: true,
          createdByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: {
            select: {
              onefopSubmissions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const mappedUsers = users.map((u: any) => ({
      ...u,
      submissionsCount: u._count?.onefopSubmissions ?? 0,
      createdByName: displayNameOf(u.createdByUser),
      createdByUser: undefined,
    }));

    return { users: mappedUsers, total, page, pageSize };
  }

  /**
   * Autocomplete behind the audit journal's actor filter.
   *
   * The audit list now matches `userId` exactly (audit-log-filter.ts), so the
   * page needs a way to turn a typed name into one id. Deliberately narrow
   * next to listUsers: name-partial only (no email — nothing on the audit
   * page needs to probe addresses), at most SEARCH_MAX_RESULTS rows, and only
   * id + displayName in the response, so this cannot become a back door onto
   * the fields the full list guards. Visibility reuses manageableRolesFor, so
   * an ADMIN_ONEFOP resolves only the accounts it already administers.
   *
   * Unlike listUsers this does NOT exclude role=COMPANY: declarants are
   * actors in the audit journal, and the substring filter this replaces
   * reached them too — excluding them would silently shrink what the page
   * can filter by. displayName cannot come back empty: the query matched
   * firstName or lastName, so at least one of them is non-empty.
   */
  async searchUsers(term: string | undefined, actorRole: string) {
    const query = term?.trim();
    if (!query) return [];

    const allowedRoles = manageableRolesFor(actorRole);
    // [] = this role manages nobody; an empty `in` would match every row in
    // Prisma only if omitted, so return early rather than widen by accident.
    if (allowedRoles && allowedRoles.length === 0) return [];

    const contains = { contains: query, mode: 'insensitive' as const };
    // `any`: allowedRoles is a readonly string[] from staff-scope, not the
    // generated UserRole union — same cast listUsers/buildUserListWhere use.
    const where: any = {
      ...(allowedRoles ? { role: { in: allowedRoles as string[] } } : {}),
      OR: [{ firstName: contains }, { lastName: contains }],
    };
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: AuthService.SEARCH_MAX_RESULTS,
    });

    return users.map((u) => ({
      id: u.id,
      displayName: [u.firstName, u.lastName].filter(Boolean).join(' ').trim(),
    }));
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
    if (role === 'DIVISIONAL_ADMIN' && (!user.department || !user.region)) {
      throw new BadRequestException(
        'Les utilisateurs divisionnaires doivent avoir une région et un département assignés',
      );
    }
    if (role === 'REGIONAL_ADMIN' && !user.region) {
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

    const user =
      typeof email === 'string' && email.trim() !== ''
        ? await this.prisma.user.findFirst({ where: emailMatch(email) })
        : null;
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