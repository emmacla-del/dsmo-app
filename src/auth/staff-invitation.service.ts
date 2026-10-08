// src/auth/staff-invitation.service.ts
//
// Staff invitation links: the way ONEFOP personnel get an account.
//
// An administrator fills in who the agent is -- their email, their place in
// the seeded MINEFOP organigramme (a MinefopService and one of its
// ServicePositions) and, for a delegation, the territory -- the server
// signs that into a token, and the
// administrator sends the resulting link -- typically over WhatsApp. The
// agent opens it, adds their name and chooses their own password, and the
// account is created ACTIVE. Nothing is stored until then, so there is no
// invitations table and no migration:
//
//  - The token is a JWT carrying purpose 'staff_invitation'. JwtStrategy
//    refuses any token with a purpose claim, so an invitation can never be
//    used as a Bearer token; verify() checks the purpose the other way, so
//    no other purpose-token can be accepted as an invitation.
//  - Everything that decides what the account may do (role, territory,
//    position, email) comes from the signed token, never from the accept
//    request.
//  - It is single-use in practice: it names one email, and once that
//    account exists the token is refused.
//  - It cannot be revoked before it expires. The expiry is short (24h for a
//    central administrator, 72h for territorial staff) and acceptance
//    re-checks that the inviter is still active and still allowed to grant
//    the role, so suspending the inviter kills their outstanding links.
//
// The platform role is not chosen: it is the service's roleMapping, so a
// post in the Delegation Regionale (DREFOP) is a REGIONAL_ADMIN, one in the
// Delegation Departementale (DDEFOP) a DIVISIONAL_ADMIN, and one in a
// central or attached service an ADMIN_ONEFOP.
//
// Who may invite whom follows staff-scope.ts and adds nothing to it:
// SUPER_ADMIN invites anyone in INVITABLE_ROLES; ADMIN_ONEFOP invites the
// territorial roles only (manageableRolesFor), so it can never mint its own
// rank -- in organigramme terms, it can invite into the deconcentrated
// services only.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { resolveStaffTerritory } from '../territory/territory-resolver';
import { emailMatch, normalizeEmail } from './auth.service';
import { toPublicUser } from './public-user';
import { assertCanManageRole } from './staff-scope';

export const STAFF_INVITATION_PURPOSE = 'staff_invitation';

// ADMIN_ONEFOP is the central administrator. AUDITOR is not invitable: the
// role is deferred (decision 2026-10-05).
export const INVITABLE_ROLES = ['ADMIN_ONEFOP', 'REGIONAL_ADMIN', 'DIVISIONAL_ADMIN'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

// Any service may take an agent who holds none of its head posts: "Cadre".
// The organigramme seed lists head posts only (delegue, chef de service,
// chef de bureau...), so without this an ordinary agent could not be placed.
export const GENERIC_POSITION_TYPE = 'STAFF';
const GENERIC_POSITION_TITLE = 'Cadre';

const CENTRAL_TTL_SECONDS = 24 * 60 * 60;
const TERRITORIAL_TTL_SECONDS = 72 * 60 * 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// One message for every way a token can be unusable (bad signature, wrong
// purpose, malformed, expired): which of them it was is not the holder's
// business, and distinguishing them helps nobody but someone probing.
const INVALID_INVITATION = "Ce lien d'invitation est invalide ou a expiré.";
const USED_INVITATION = 'Ce lien a déjà été utilisé : un compte existe pour cette adresse. Connectez-vous.';

export interface StaffInvitationPayload {
  purpose: typeof STAFF_INVITATION_PURPOSE;
  email: string;
  role: InvitableRole;
  region: string | null;
  department: string | null;
  serviceCode: string;
  positionType: string;
  // The post's title from the organigramme, stored as User.poste.
  positionTitle: string;
  invitedBy: string;
  iat?: number;
  exp?: number;
}

export interface CreateStaffInvitationInput {
  email?: string;
  serviceCode?: string;
  positionType?: string;
  region?: string;
  department?: string;
}

export interface AcceptStaffInvitationInput {
  token?: string;
  firstName?: string;
  lastName?: string;
  matricule?: string;
  password?: string;
}

/** Whether `actorRole` may invite `targetRole` -- staff-scope.ts's rule. */
function assertCanInvite(actorRole: string | undefined, targetRole: string): void {
  if (targetRole === 'ADMIN_ONEFOP' && actorRole !== 'SUPER_ADMIN') {
    throw new ForbiddenException("Seul le super administrateur peut inviter un administrateur central.");
  }
  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN_ONEFOP') {
    throw new ForbiddenException("Vous n'êtes pas autorisé à inviter des agents.");
  }
  if (targetRole !== 'ADMIN_ONEFOP') assertCanManageRole(actorRole, targetRole);
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class StaffInvitationService {
  private readonly logger = new Logger(StaffInvitationService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private systemSettings: SystemSettingsService,
  ) {}

  /** An administrator creates an invitation and gets back the token to send. */
  async create(input: CreateStaffInvitationInput, actor: { id: string; role: string }) {
    const serviceCode = trimmed(input.serviceCode);
    const service = serviceCode
      ? await this.prisma.minefopService.findUnique({ where: { code: serviceCode } })
      : null;
    if (!service || !service.isActive) {
      throw new BadRequestException("Service inconnu dans l'organigramme.");
    }
    const role = service.roleMapping as string;
    if (!(INVITABLE_ROLES as readonly string[]).includes(role)) {
      throw new BadRequestException("Ce service ne peut pas recevoir d'invitation.");
    }
    assertCanInvite(actor.role, role);

    const positionType = trimmed(input.positionType);
    let positionTitle: string;
    if (positionType === GENERIC_POSITION_TYPE) {
      positionTitle = GENERIC_POSITION_TITLE;
    } else {
      const position = positionType
        ? await this.prisma.servicePosition.findFirst({
            where: { serviceCode, positionType, isActive: true },
            orderBy: { orderIndex: 'asc' },
          })
        : null;
      if (!position) {
        throw new BadRequestException("Ce poste n'existe pas dans ce service.");
      }
      positionTitle = position.title;
    }

    const email = normalizeEmail(trimmed(input.email));
    if (!EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('Adresse e-mail invalide.');
    }
    const existing = await this.prisma.user.findFirst({ where: emailMatch(email) });
    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Region names for REGIONAL_ADMIN, region + department for
    // DIVISIONAL_ADMIN, nothing for the central role -- and an unknown or
    // mismatched territory is refused here, at invitation time, rather than
    // when the agent has already filled the form in.
    const territory = await resolveStaffTerritory(this.prisma, role, {
      region: input.region,
      department: input.department,
    });

    const ttl = role === 'ADMIN_ONEFOP' ? CENTRAL_TTL_SECONDS : TERRITORIAL_TTL_SECONDS;
    const payload: StaffInvitationPayload = {
      purpose: STAFF_INVITATION_PURPOSE,
      email,
      role: role as InvitableRole,
      region: territory.region,
      department: territory.department,
      serviceCode,
      positionType,
      positionTitle,
      invitedBy: actor.id,
    };
    const token = this.jwtService.sign(payload, { expiresIn: ttl });
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    await this.prisma.auditLog
      .create({
        data: {
          userId: actor.id,
          action: 'STAFF_INVITATION_CREATED',
          resourceType: 'User',
          // No account exists yet; the invitation is identified by its email.
          resourceId: email,
          details: { email, role, ...territory, serviceCode, positionType, positionTitle, expiresAt },
        },
      })
      .catch((error: any) => this.logger.error(`Audit log failed: ${error?.message ?? error}`));

    return {
      token,
      expiresAt,
      email,
      role,
      region: territory.region,
      department: territory.department,
      serviceCode,
      serviceName: service.name,
      positionType,
      positionTitle,
    };
  }

  /**
   * What the invitation says, for the agent's form. Refuses a token that is
   * invalid, expired or already used, so the form can say so before the
   * agent types anything.
   */
  async preview(token: string | undefined) {
    const payload = this.verify(token);
    await this.assertEmailFree(payload.email);
    const service = await this.prisma.minefopService.findUnique({ where: { code: payload.serviceCode } });
    return {
      email: payload.email,
      role: payload.role,
      region: payload.region,
      department: payload.department,
      serviceCode: payload.serviceCode,
      serviceName: service?.name ?? null,
      positionType: payload.positionType,
      positionTitle: payload.positionTitle,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
    };
  }

  /** The agent completes the invitation; the account is created ACTIVE. */
  async accept(input: AcceptStaffInvitationInput) {
    const payload = this.verify(input.token);

    const firstName = trimmed(input.firstName);
    const lastName = trimmed(input.lastName);
    if (!firstName || !lastName) {
      throw new BadRequestException('Le prénom et le nom sont obligatoires.');
    }
    const password = typeof input.password === 'string' ? input.password : '';
    const { passwordMinLength } = await this.systemSettings.getSettings();
    if (password.length < passwordMinLength) {
      throw new BadRequestException(
        `Le mot de passe doit contenir au moins ${passwordMinLength} caractères`,
      );
    }

    await this.assertEmailFree(payload.email);

    // The inviter's authority is re-checked now, not trusted from the moment
    // of signing: a suspended or demoted administrator's outstanding links
    // stop working without needing any revocation list.
    const inviter = await this.prisma.user.findUnique({ where: { id: payload.invitedBy } });
    if (!inviter || inviter.status !== 'ACTIVE' || !inviter.isActive) {
      throw new GoneException(INVALID_INVITATION);
    }
    try {
      assertCanInvite(inviter.role, payload.role);
    } catch {
      throw new GoneException(INVALID_INVITATION);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: payload.email,
          passwordHash,
          firstName,
          lastName,
          role: payload.role as any,
          region: payload.region,
          department: payload.department,
          serviceCode: payload.serviceCode,
          positionType: payload.positionType,
          poste: payload.positionTitle,
          matricule: trimmed(input.matricule) || null,
          status: 'ACTIVE',
          isActive: true,
          // The agent chose this password themselves; nothing to change.
          mustChangePassword: false,
          createdBy: payload.invitedBy,
          registrationMethod: 'INVITATION',
        },
      });
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(USED_INVITATION);
      }
      throw error;
    }

    await this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: 'STAFF_INVITATION_ACCEPTED',
          resourceType: 'User',
          resourceId: user.id,
          details: {
            email: payload.email,
            role: payload.role,
            region: payload.region,
            department: payload.department,
            serviceCode: payload.serviceCode,
            positionType: payload.positionType,
            invitedBy: payload.invitedBy,
            registrationMethod: 'INVITATION',
          },
        },
      })
      .catch((error: any) => this.logger.error(`Audit log failed: ${error?.message ?? error}`));

    return { user: toPublicUser(user) };
  }

  private verify(token: string | undefined): StaffInvitationPayload {
    if (typeof token !== 'string' || !token.trim()) {
      throw new GoneException(INVALID_INVITATION);
    }
    let payload: any;
    try {
      payload = this.jwtService.verify(token.trim());
    } catch {
      throw new GoneException(INVALID_INVITATION);
    }
    if (
      payload?.purpose !== STAFF_INVITATION_PURPOSE ||
      typeof payload.email !== 'string' ||
      typeof payload.invitedBy !== 'string' ||
      typeof payload.serviceCode !== 'string' ||
      typeof payload.positionType !== 'string' ||
      !(INVITABLE_ROLES as readonly string[]).includes(payload.role)
    ) {
      throw new GoneException(INVALID_INVITATION);
    }
    return payload as StaffInvitationPayload;
  }

  private async assertEmailFree(email: string): Promise<void> {
    const existing = await this.prisma.user.findFirst({ where: emailMatch(email) });
    if (existing) throw new ConflictException(USED_INVITATION);
  }
}
