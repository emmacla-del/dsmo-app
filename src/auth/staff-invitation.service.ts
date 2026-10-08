// src/auth/staff-invitation.service.ts
//
// Staff invitation links: the way ONEFOP personnel get an account.
//
// An administrator fills in who the agent is (email, role, territory and,
// for a delegate, the position), the server signs that into a token, and the
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
// Who may invite whom follows staff-scope.ts and adds nothing to it:
// SUPER_ADMIN invites anyone in INVITABLE_ROLES; ADMIN_ONEFOP invites the
// territorial roles only (manageableRolesFor), so it can never mint its own
// rank.
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

// Delegate positions belong to one territorial level each.
const DELEGATE_POSITION_ROLE: Record<string, InvitableRole> = {
  DELEGUE_REGIONAL: 'REGIONAL_ADMIN',
  DELEGUE_DEPARTEMENTAL: 'DIVISIONAL_ADMIN',
};

// PositionType values (schema.prisma) an invitation may carry. The field is
// a free String on User, so this list is the only thing keeping it to real
// positions.
const POSITION_TYPES = new Set([
  'MINISTRE',
  'SECRETAIRE_GENERAL',
  'DIRECTEUR',
  'SOUS_DIRECTEUR',
  'CHEF_DIVISION',
  'CHEF_SERVICE',
  'CHEF_BUREAU',
  'CHEF_CELLULE',
  'CHARGE_ETUDES_ASSISTANT',
  'INSPECTEUR_GENERAL_SERVICES',
  'INSPECTEUR_SERVICES',
  'INSPECTEUR_GENERAL_FORMATIONS',
  'INSPECTEUR_FORMATIONS',
  'ATTACHE_PEDAGOGIQUE',
  'CONSEILLER_TECHNIQUE',
  'CHEF_SECRETARIAT_PARTICULIER',
  'DELEGUE_REGIONAL',
  'DELEGUE_DEPARTEMENTAL',
  'INSPECTEUR_REGIONAL_FORMATIONS',
  'CONSEILLER_REGIONAL_FORMATIONS',
  'STAFF',
]);

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
  positionType: string | null;
  invitedBy: string;
  iat?: number;
  exp?: number;
}

export interface CreateStaffInvitationInput {
  email?: string;
  role?: string;
  region?: string;
  department?: string;
  positionType?: string;
}

export interface AcceptStaffInvitationInput {
  token?: string;
  firstName?: string;
  lastName?: string;
  matricule?: string;
  poste?: string;
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
    const role = trimmed(input.role);
    if (!(INVITABLE_ROLES as readonly string[]).includes(role)) {
      throw new BadRequestException('Rôle invalide pour une invitation.');
    }
    assertCanInvite(actor.role, role);

    const email = normalizeEmail(trimmed(input.email));
    if (!EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('Adresse e-mail invalide.');
    }
    const existing = await this.prisma.user.findFirst({ where: emailMatch(email) });
    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    const positionType = trimmed(input.positionType) || null;
    if (positionType !== null) {
      if (!POSITION_TYPES.has(positionType)) {
        throw new BadRequestException('Poste inconnu.');
      }
      const delegateRole = DELEGATE_POSITION_ROLE[positionType];
      if (delegateRole && delegateRole !== role) {
        throw new BadRequestException(
          positionType === 'DELEGUE_REGIONAL'
            ? 'Un délégué régional a le rôle administrateur régional.'
            : 'Un délégué départemental a le rôle administrateur départemental.',
        );
      }
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
      positionType,
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
          details: { email, role, ...territory, positionType, expiresAt },
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
      positionType,
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
    return {
      email: payload.email,
      role: payload.role,
      region: payload.region,
      department: payload.department,
      positionType: payload.positionType,
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
          positionType: payload.positionType,
          matricule: trimmed(input.matricule) || null,
          poste: trimmed(input.poste) || null,
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
