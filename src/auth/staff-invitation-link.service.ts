// src/auth/staff-invitation-link.service.ts
//
// Shared invitation links for GROUPS of MINEFOP staff (Phase B; the
// one-person link is staff-invitation.service.ts).
//
// An administrator creates a link for a scope -- a level (regional
// delegation, departmental delegation, central services) and, for a
// delegation, its territory -- and posts it in a WhatsApp group. Each person
// who opens it chooses their own service and post inside that scope, gives
// their email and a password, and gets an account that WAITS FOR APPROVAL:
// unlike the one-person link, nobody vouched for this individual, and the
// email is not verified (outbound mail is unreliable), so an approver checks
// name and post before the account opens. Approval is the existing
// PATCH /auth/approve-user/:id.
//
// Safety:
//  - the secret is random and stored only as its SHA-256 (tokenHash);
//  - a link expires (default 7 days, at most 30), has a use limit (default
//    50, at most 200) and can be revoked at any time;
//  - the use counter is incremented with a conditional update inside the
//    same transaction as the account, so concurrent sign-ups cannot exceed
//    the limit;
//  - the role is the level's, never chosen: regional -> REGIONAL_ADMIN,
//    departmental -> DIVISIONAL_ADMIN, central -> CENTRAL_AGENT. A group
//    link never produces an ADMIN_ONEFOP;
//  - the territory comes from the link, never from the sign-up request.
//
// Who may create, list and revoke: SUPER_ADMIN and ADMIN_ONEFOP. ADMIN_ONEFOP
// manages all three produced roles (staff-scope.ts manageableRolesFor).
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { resolveStaffTerritory } from '../territory/territory-resolver';
import { emailMatch, normalizeEmail } from './auth.service';
import { assertCanManageRole } from './staff-scope';
import { GENERIC_POSITION_TYPE } from './staff-invitation.service';

export const LINK_LEVELS = ['regional', 'departmental', 'central'] as const;
export type LinkLevel = (typeof LINK_LEVELS)[number];

const LEVEL_ROLE: Record<LinkLevel, string> = {
  regional: 'REGIONAL_ADMIN',
  departmental: 'DIVISIONAL_ADMIN',
  central: 'CENTRAL_AGENT',
};

// The organigramme root a delegation level's services must descend from.
const LEVEL_ROOT: Partial<Record<LinkLevel, string>> = {
  regional: 'DREFOP',
  departmental: 'DDEFOP',
};

export const LINK_DEFAULT_DAYS = 7;
export const LINK_MAX_DAYS = 30;
export const LINK_DEFAULT_USES = 50;
export const LINK_MAX_USES = 200;

const GENERIC_POSITION_TITLE = 'Cadre';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Deepest service under a delegation root in the seed is level 3; the walk
// stops well past that so a bad parent cycle cannot spin.
const MAX_ANCESTOR_STEPS = 8;

const INVALID_LINK = "Ce lien d'invitation n'est plus valable (expiré, révoqué ou complet). Demandez un nouveau lien.";

export interface CreateLinkInput {
  label?: string;
  level?: string;
  region?: string;
  department?: string;
  expiresInDays?: number;
  maxUses?: number;
}

export interface LinkSignUpInput {
  token?: string;
  email?: string;
  serviceCode?: string;
  positionType?: string;
  firstName?: string;
  lastName?: string;
  matricule?: string;
  password?: string;
}

export type LinkState = 'active' | 'expired' | 'revoked' | 'full';

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** A whole number within [min, max], or the default when absent. */
function boundedInt(value: unknown, fallback: number, min: number, max: number, message: string): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(message);
  return n;
}

export function linkState(link: { revokedAt: Date | null; expiresAt: Date; useCount: number; maxUses: number }, now = new Date()): LinkState {
  if (link.revokedAt) return 'revoked';
  if (link.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (link.useCount >= link.maxUses) return 'full';
  return 'active';
}

function assertCanManageLinks(actorRole: string | undefined, level: LinkLevel): void {
  if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN_ONEFOP') {
    throw new ForbiddenException("Vous n'êtes pas autorisé à gérer les liens d'invitation.");
  }
  assertCanManageRole(actorRole, LEVEL_ROLE[level]);
}

@Injectable()
export class StaffInvitationLinkService {
  private readonly logger = new Logger(StaffInvitationLinkService.name);

  constructor(
    private prisma: PrismaService,
    private systemSettings: SystemSettingsService,
  ) {}

  // ── Administration ──────────────────────────────────────────────────

  /** Creates a link. The token is returned once and never stored. */
  async create(input: CreateLinkInput, actor: { id: string; role: string }) {
    const level = trimmed(input.level) as LinkLevel;
    if (!(LINK_LEVELS as readonly string[]).includes(level)) {
      throw new BadRequestException('Niveau invalide.');
    }
    assertCanManageLinks(actor.role, level);

    const label = trimmed(input.label);
    if (!label || label.length > 120) {
      throw new BadRequestException('Donnez au lien un nom (120 caractères au plus).');
    }
    const days = boundedInt(input.expiresInDays, LINK_DEFAULT_DAYS, 1, LINK_MAX_DAYS, `La durée doit être comprise entre 1 et ${LINK_MAX_DAYS} jours.`);
    const maxUses = boundedInt(input.maxUses, LINK_DEFAULT_USES, 1, LINK_MAX_USES, `Le nombre d'utilisations doit être compris entre 1 et ${LINK_MAX_USES}.`);
    const territory = await resolveStaffTerritory(this.prisma, LEVEL_ROLE[level], {
      region: input.region,
      department: input.department,
    });

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const link = await this.prisma.staffInvitationLink.create({
      data: {
        tokenHash: hashToken(token),
        label,
        level,
        region: territory.region,
        department: territory.department,
        maxUses,
        expiresAt,
        createdBy: actor.id,
      },
    });

    await this.audit(actor.id, 'STAFF_INVITATION_LINK_CREATED', link.id, {
      label, level, ...territory, maxUses, expiresAt: expiresAt.toISOString(),
    });

    return { ...this.present(link), token };
  }

  /** The most recent links, newest first, with their state. */
  async list(actor: { role: string }) {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN_ONEFOP') {
      throw new ForbiddenException("Vous n'êtes pas autorisé à gérer les liens d'invitation.");
    }
    const links = await this.prisma.staffInvitationLink.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { createdByUser: { select: { firstName: true, lastName: true, email: true } } },
    });
    return links.map((l) => ({
      ...this.present(l),
      createdByName: l.createdByUser
        ? [l.createdByUser.firstName, l.createdByUser.lastName].filter(Boolean).join(' ').trim() || l.createdByUser.email
        : null,
    }));
  }

  async revoke(id: string, actor: { id: string; role: string }) {
    const link = await this.prisma.staffInvitationLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Lien introuvable.');
    assertCanManageLinks(actor.role, link.level as LinkLevel);
    if (link.revokedAt) return this.present(link);
    const updated = await this.prisma.staffInvitationLink.update({
      where: { id },
      data: { revokedAt: new Date(), revokedBy: actor.id },
    });
    await this.audit(actor.id, 'STAFF_INVITATION_LINK_REVOKED', id, { label: link.label, useCount: link.useCount });
    return this.present(updated);
  }

  // ── Public: the person holding the link ─────────────────────────────

  /** What the link allows, for the sign-up form. */
  async preview(token: string | undefined) {
    const link = await this.findUsable(token);
    return {
      label: link.label,
      level: link.level,
      role: LEVEL_ROLE[link.level as LinkLevel],
      region: link.region,
      department: link.department,
      expiresAt: link.expiresAt.toISOString(),
    };
  }

  /** Creates a PENDING_APPROVAL account within the link's scope. */
  async signUp(input: LinkSignUpInput) {
    const link = await this.findUsable(input.token);
    const level = link.level as LinkLevel;
    const role = LEVEL_ROLE[level];

    const email = normalizeEmail(trimmed(input.email));
    if (!EMAIL_PATTERN.test(email)) throw new BadRequestException('Adresse e-mail invalide.');
    const firstName = trimmed(input.firstName);
    const lastName = trimmed(input.lastName);
    if (!firstName || !lastName) throw new BadRequestException('Le prénom et le nom sont obligatoires.');
    const password = typeof input.password === 'string' ? input.password : '';
    const { passwordMinLength } = await this.systemSettings.getSettings();
    if (password.length < passwordMinLength) {
      throw new BadRequestException(`Le mot de passe doit contenir au moins ${passwordMinLength} caractères`);
    }

    const serviceCode = trimmed(input.serviceCode);
    await this.assertServiceInScope(serviceCode, level);
    const positionTitle = await this.positionTitle(serviceCode, trimmed(input.positionType));
    const positionType = trimmed(input.positionType);

    if (await this.prisma.user.findFirst({ where: emailMatch(email) })) {
      throw new ConflictException('Un compte existe déjà pour cette adresse.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user: { id: string; email: string };
    try {
      user = await this.prisma.$transaction(async (tx) => {
        // Claim one use. The condition is re-checked by PostgreSQL at update
        // time, so two sign-ups racing for the last use cannot both win.
        const claimed = await tx.staffInvitationLink.updateMany({
          where: { id: link.id, revokedAt: null, expiresAt: { gt: new Date() }, useCount: { lt: link.maxUses } },
          data: { useCount: { increment: 1 } },
        });
        if (claimed.count !== 1) throw new GoneException(INVALID_LINK);
        return tx.user.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
            role: role as any,
            region: link.region,
            department: link.department,
            serviceCode,
            positionType,
            poste: positionTitle,
            matricule: trimmed(input.matricule) || null,
            status: 'PENDING_APPROVAL',
            isActive: false,
            createdBy: link.createdBy,
            registrationMethod: 'INVITATION_LINK',
          },
          select: { id: true, email: true },
        });
      });
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un compte existe déjà pour cette adresse.');
      }
      throw error;
    }

    await this.audit(user.id, 'STAFF_INVITATION_LINK_USED', link.id, {
      email, role, region: link.region, department: link.department, serviceCode, positionType,
      linkLabel: link.label, registrationMethod: 'INVITATION_LINK',
    });

    return { email: user.email, status: 'PENDING_APPROVAL' as const };
  }

  // ── Internals ───────────────────────────────────────────────────────

  private async findUsable(token: string | undefined) {
    if (typeof token !== 'string' || !token.trim()) throw new GoneException(INVALID_LINK);
    const link = await this.prisma.staffInvitationLink.findUnique({ where: { tokenHash: hashToken(token.trim()) } });
    if (!link || linkState(link) !== 'active') throw new GoneException(INVALID_LINK);
    return link;
  }

  /** The service exists, is active, belongs to the level and maps to its role. */
  private async assertServiceInScope(serviceCode: string, level: LinkLevel): Promise<void> {
    const outOfScope = () => new BadRequestException("Ce service n'est pas couvert par ce lien.");
    const service = serviceCode ? await this.prisma.minefopService.findUnique({ where: { code: serviceCode } }) : null;
    if (!service || !service.isActive || service.roleMapping !== LEVEL_ROLE[level]) throw outOfScope();

    const root = LEVEL_ROOT[level];
    if (!root) {
      if (service.category !== 'CENTRALE' && service.category !== 'RATTACHE') throw outOfScope();
      return;
    }
    let current: { code: string; parentCode: string | null } | null = service;
    for (let step = 0; current && step < MAX_ANCESTOR_STEPS; step++) {
      if (current.code === root) return;
      current = current.parentCode
        ? await this.prisma.minefopService.findUnique({ where: { code: current.parentCode } })
        : null;
    }
    throw outOfScope();
  }

  private async positionTitle(serviceCode: string, positionType: string): Promise<string> {
    if (positionType === GENERIC_POSITION_TYPE) return GENERIC_POSITION_TITLE;
    const position = positionType
      ? await this.prisma.servicePosition.findFirst({
          where: { serviceCode, positionType, isActive: true },
          orderBy: { orderIndex: 'asc' },
        })
      : null;
    if (!position) throw new BadRequestException("Ce poste n'existe pas dans ce service.");
    return position.title;
  }

  private present(l: {
    id: string; label: string; level: string; region: string | null; department: string | null;
    maxUses: number; useCount: number; expiresAt: Date; revokedAt: Date | null; createdAt: Date;
  }) {
    return {
      id: l.id,
      label: l.label,
      level: l.level,
      role: LEVEL_ROLE[l.level as LinkLevel] ?? null,
      region: l.region,
      department: l.department,
      maxUses: l.maxUses,
      useCount: l.useCount,
      expiresAt: l.expiresAt.toISOString(),
      revokedAt: l.revokedAt ? l.revokedAt.toISOString() : null,
      createdAt: l.createdAt.toISOString(),
      state: linkState(l),
    };
  }

  private async audit(userId: string, action: string, resourceId: string, details: Record<string, unknown>) {
    await this.prisma.auditLog
      .create({ data: { userId, action, resourceType: 'StaffInvitationLink', resourceId, details: details as any } })
      .catch((error: any) => this.logger.error(`Audit log failed: ${error?.message ?? error}`));
  }
}
