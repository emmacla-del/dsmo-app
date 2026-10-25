// src/auth/staff-invitation-link.service.ts
//
// Shared invitation links for GROUPS of MINEFOP staff (Phase B; the
// one-person link is staff-invitation.service.ts).
//
// An administrator creates a link for one POST -- a service and a position
// type -- inside a scope: a level (regional delegation, departmental
// delegation, central services) and, for a delegation, its intended
// territory. The link is posted in a WhatsApp group, and everyone who opens
// it holds that same post: typically the generic "Cadre" of one unit, which
// is what most of a delegation's staff are. They provide identity, choose any
// territory required by that service, and set a password, then get
// an account that WAITS FOR APPROVAL: unlike the one-person link, nobody
// vouched for this individual, and the email is not verified (outbound mail
// is unreliable), so an approver checks name and post before the account
// opens. Approval is the existing PATCH /auth/approve-user/:id.
//
// The post is required on every link created from 2026-10-25. Links created
// before then carry none (serviceCode and positionType are null) and still
// work exactly as they did: their holders choose their own service and post,
// in the form and here. That fallback is permanent -- an old link stays
// valid until it expires -- and it is why the two columns are nullable.
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
//  - the role comes from the level; the post comes from the link when set;
//  - the officer chooses the territory required by the service, and it is
//    validated against the geography;
//  - when a link carries a post, the service and
//    post in the sign-up request are ignored, and the link's pair is checked
//    again at sign-up, so an organigramme change since cannot let an account
//    through on a service that has left the level.
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
import { normalizeTerritoryName, resolveStaffTerritory } from '../territory/territory-resolver';
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
const SERVICE_REQUIRED = "Choisissez le service auquel ce lien donne accès.";
const POSITION_REQUIRED = "Choisissez le poste auquel ce lien donne accès.";
const MATRICULE_REQUIRED = 'Le matricule est obligatoire.';
// Both out-of-scope refusals, passed in: at creation there is no link yet to
// be "not covered by", so the level is named instead. error-messages.spec.ts
// checks the two strings by value (the `message` argument is on its
// RESOLVED_ELSEWHERE list, as boundedInt's already was).
const SERVICE_OUT_OF_LINK = "Ce service n'est pas couvert par ce lien.";
const SERVICE_OUT_OF_LEVEL = "Ce service n'est pas couvert par ce niveau.";

export interface CreateLinkInput {
  label?: string;
  level?: string;
  region?: string;
  department?: string;
  serviceCode?: string;
  positionType?: string;
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
  region?: string;
  department?: string;
  password?: string;
}

export type LinkState = 'active' | 'expired' | 'revoked' | 'full';

/** The columns `presented` reads off a link row. */
interface LinkRow {
  id: string;
  label: string;
  level: string;
  region: string | null;
  department: string | null;
  serviceCode: string | null;
  positionType: string | null;
  maxUses: number;
  useCount: number;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

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

    // The post the link is for. Required: an administrator knows which unit
    // and which post they are inviting, and the holder should not have to
    // find themselves in a 126-service organigramme.
    const serviceCode = trimmed(input.serviceCode);
    if (!serviceCode) throw new BadRequestException(SERVICE_REQUIRED);
    await this.assertServiceInScope(serviceCode, level, SERVICE_OUT_OF_LEVEL);
    const positionType = trimmed(input.positionType);
    if (!positionType) throw new BadRequestException(POSITION_REQUIRED);
    // Refuses a post the service does not offer, and resolves its title.
    await this.positionTitle(serviceCode, positionType);

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const link = await this.prisma.staffInvitationLink.create({
      data: {
        tokenHash: hashToken(token),
        label,
        level,
        region: territory.region,
        department: territory.department,
        serviceCode,
        positionType,
        maxUses,
        expiresAt,
        createdBy: actor.id,
      },
    });

    await this.audit(actor.id, 'STAFF_INVITATION_LINK_CREATED', link.id, {
      label, level, ...territory, serviceCode, positionType, maxUses, expiresAt: expiresAt.toISOString(),
    });

    const [presented] = await this.presented([link]);
    return { ...presented, token };
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
    const presented = await this.presented(links);
    return presented.map((p, i) => {
      const user = links[i].createdByUser;
      return {
        ...p,
        createdByName: user
          ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
          : null,
      };
    });
  }

  async revoke(id: string, actor: { id: string; role: string }) {
    const link = await this.prisma.staffInvitationLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Lien introuvable.');
    assertCanManageLinks(actor.role, link.level as LinkLevel);
    if (link.revokedAt) return (await this.presented([link]))[0];
    const updated = await this.prisma.staffInvitationLink.update({
      where: { id },
      data: { revokedAt: new Date(), revokedBy: actor.id },
    });
    await this.audit(actor.id, 'STAFF_INVITATION_LINK_REVOKED', id, { label: link.label, useCount: link.useCount });
    return (await this.presented([updated]))[0];
  }

  // ── Public: the person holding the link ─────────────────────────────

  /** What the link allows, for the sign-up form. */
  async preview(token: string | undefined) {
    const link = await this.findUsable(token);
    // The post the link fixes, named, so the form can SHOW it instead of
    // asking for it. Null on a link made before 2026-10-25, whose form still
    // asks. Nothing about the link's creator is exposed here.
    const [named] = await this.presented([link]);
    return {
      label: link.label,
      level: link.level,
      role: LEVEL_ROLE[link.level as LinkLevel],
      region: link.region,
      department: link.department,
      serviceCode: named.serviceCode,
      serviceName: named.serviceName,
      positionType: named.positionType,
      positionTitle: named.positionTitle,
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
    // A staff account is identified by its matricule in every MINEFOP
    // register, so it is asked for, not offered. Accounts created before
    // 2026-10-25 may have none; nothing here changes them.
    const matricule = trimmed(input.matricule);
    if (!matricule) throw new BadRequestException(MATRICULE_REQUIRED);
    const password = typeof input.password === 'string' ? input.password : '';
    const { passwordMinLength } = await this.systemSettings.getSettings();
    if (password.length < passwordMinLength) {
      throw new BadRequestException(`Le mot de passe doit contenir au moins ${passwordMinLength} caractères`);
    }

    // The post comes from the LINK when it carries one. Like the role,
    // it is not the holder's to choose: a request that still
    // sends a service and a post -- a page open since before the link was
    // made, or a crafted one -- is ignored here, not trusted. It is checked
    // again all the same, because the organigramme can change after a link
    // is created: a service since deactivated or moved out of the level
    // stops the sign-up instead of producing an account on a dead service.
    const fixedPost = !!(link.serviceCode && link.positionType);
    const serviceCode = fixedPost ? link.serviceCode! : trimmed(input.serviceCode);
    const positionType = fixedPost ? link.positionType! : trimmed(input.positionType);
    const service = await this.assertServiceInScope(serviceCode, level, SERVICE_OUT_OF_LINK);
    const positionTitle = await this.positionTitle(serviceCode, positionType);
    const territory = await this.resolveSignupTerritory(service, input.region, input.department);

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
            region: territory.region,
            department: territory.department,
            serviceCode,
            positionType,
            poste: positionTitle,
            matricule,
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
      email, role, ...territory, serviceCode, positionType,
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
  private async assertServiceInScope(
    serviceCode: string,
    level: LinkLevel,
    message: string,
  ): Promise<{ requiresRegion: boolean; requiresDepartment: boolean }> {
    const outOfScope = () => new BadRequestException(message);
    const service = serviceCode ? await this.prisma.minefopService.findUnique({ where: { code: serviceCode } }) : null;
    if (!service || !service.isActive || service.roleMapping !== LEVEL_ROLE[level]) throw outOfScope();

    const root = LEVEL_ROOT[level];
    if (!root) {
      if (service.category !== 'CENTRALE' && service.category !== 'RATTACHE') throw outOfScope();
      return service;
    }
    let current: { code: string; parentCode: string | null } | null = service;
    for (let step = 0; current && step < MAX_ANCESTOR_STEPS; step++) {
      if (current.code === root) return service;
      current = current.parentCode
        ? await this.prisma.minefopService.findUnique({ where: { code: current.parentCode } })
        : null;
    }
    throw outOfScope();
  }

  /** The service, rather than the invitation link, determines signup territory. */
  private async resolveSignupTerritory(
    service: { requiresRegion: boolean; requiresDepartment: boolean },
    regionValue: unknown,
    departmentValue: unknown,
  ): Promise<{ region: string | null; department: string | null }> {
    const needsRegion = service.requiresRegion || service.requiresDepartment;
    if (!needsRegion) return { region: null, department: null };

    const regionInput = trimmed(regionValue);
    if (!regionInput) throw new BadRequestException('Choisissez une région.');
    const regions = await this.prisma.region.findMany({ select: { id: true, name: true } });
    const normalizedRegion = normalizeTerritoryName(regionInput);
    const region = regions.find((candidate: { id: string; name: string }) =>
      candidate.id === regionInput || normalizeTerritoryName(candidate.name) === normalizedRegion,
    );
    if (!region) throw new BadRequestException('Choisissez une région valide.');
    if (!service.requiresDepartment) return { region: region.name, department: null };

    const departmentInput = trimmed(departmentValue);
    if (!departmentInput) throw new BadRequestException('Choisissez un département.');
    const departments = await this.prisma.department.findMany({
      where: { regionId: region.id },
      select: { id: true, name: true, regionId: true },
    });
    const normalizedDepartment = normalizeTerritoryName(departmentInput);
    const department = departments.find((candidate: { id: string; name: string }) =>
      candidate.id === departmentInput || normalizeTerritoryName(candidate.name) === normalizedDepartment,
    );
    if (!department) throw new BadRequestException('Choisissez un département valide pour la région sélectionnée.');
    return { region: region.name, department: department.name };
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

  /**
   * The links as the administration screen reads them, with the post named:
   * `serviceCode` and `positionType` are codes, so each link also carries the
   * service name and the post title the holder will see. Batched -- one query
   * for the services and one for their posts, whatever the number of links --
   * so listing 50 does not become 100 round trips. A link with no post (made
   * before 2026-10-25) carries four nulls.
   */
  private async presented(links: LinkRow[]) {
    const codes = [...new Set(links.map((l) => l.serviceCode).filter((c): c is string => !!c))];
    const services = codes.length
      ? await this.prisma.minefopService.findMany({ where: { code: { in: codes } }, select: { code: true, name: true } })
      : [];
    const positions = codes.length
      ? await this.prisma.servicePosition.findMany({
          where: { serviceCode: { in: codes }, isActive: true },
          select: { serviceCode: true, positionType: true, title: true },
        })
      : [];
    const serviceName = new Map(services.map((s) => [s.code, s.name]));
    const postTitle = new Map(positions.map((p) => [`${p.serviceCode}\u0000${p.positionType}`, p.title]));

    return links.map((l) => ({
      id: l.id,
      label: l.label,
      level: l.level,
      role: LEVEL_ROLE[l.level as LinkLevel] ?? null,
      region: l.region,
      department: l.department,
      serviceCode: l.serviceCode,
      serviceName: l.serviceCode ? serviceName.get(l.serviceCode) ?? null : null,
      positionType: l.positionType,
      positionTitle: !l.serviceCode || !l.positionType
        ? null
        : l.positionType === GENERIC_POSITION_TYPE
          ? GENERIC_POSITION_TITLE
          : postTitle.get(`${l.serviceCode}\u0000${l.positionType}`) ?? null,
      maxUses: l.maxUses,
      useCount: l.useCount,
      expiresAt: l.expiresAt.toISOString(),
      revokedAt: l.revokedAt ? l.revokedAt.toISOString() : null,
      createdAt: l.createdAt.toISOString(),
      state: linkState(l),
    }));
  }

  private async audit(userId: string, action: string, resourceId: string, details: Record<string, unknown>) {
    await this.prisma.auditLog
      .create({ data: { userId, action, resourceType: 'StaffInvitationLink', resourceId, details: details as any } })
      .catch((error: any) => this.logger.error(`Audit log failed: ${error?.message ?? error}`));
  }
}
