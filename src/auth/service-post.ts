// src/auth/service-post.ts
//
// A post in the MINEFOP organigramme, and who may hold it.
//
// `ServicePosition` is unique per (serviceCode, positionType), and the
// organigramme is a TEMPLATE -- one DREFOP, one DDEFOP, one of each central
// service -- so a named post exists once per service and, with the account's
// territory, once per territory: one Délégué Régional per region, one Chef du
// Service de la Promotion de l'Emploi per region, one Délégué Départemental
// per division. The exception is the generic post every service offers,
// "Cadre", which any number of officers hold.
//
// That matters beyond tidiness since 2026-10-26: the holder of a délégué post
// approves their territory's staff accounts, so a second person arriving on
// that post would be a second person holding that authority. The check below
// is what keeps a singular post singular, and it runs on every path that
// creates an account on a post -- the group link and the one-person
// invitation alike.
import { ConflictException } from '@nestjs/common';

/**
 * "Cadre": an officer who holds none of a service's head posts. Every
 * service offers it, and it is the one post that is not singular.
 */
export const GENERIC_POSITION_TYPE = 'STAFF';

export const POST_ALREADY_HELD = 'Ce poste est déjà occupé dans ce territoire. Contactez votre délégation.';

/**
 * Statuses that count as holding the post. A REJECTED account never held it,
 * and the review states of a company file cannot reach a post at all. An
 * account still PENDING_APPROVAL does count: two people must not be able to
 * queue for the same post and leave the approver to discover it.
 */
const HOLDING_STATUSES = ['ACTIVE', 'PENDING_APPROVAL'] as const;

/** Every post but the generic one is held by exactly one officer. */
export function isSingularPost(positionType: string | null | undefined): boolean {
  return typeof positionType === 'string' && positionType.trim() !== '' && positionType !== GENERIC_POSITION_TYPE;
}

/** The slice of Prisma this needs, so the rule is testable without a database. */
export interface PostHolderStore {
  user: {
    findFirst(args: any): Promise<{ id: string } | null>;
  };
}

export interface PostIdentity {
  serviceCode: string;
  positionType: string;
  region: string | null;
  department: string | null;
}

/**
 * Refuses the post when someone already holds it in this territory.
 *
 * The territory is part of the identity: the same `CHEF_SERVICE` of the same
 * `DREFOP-SPE` is a different post in every region, because the organigramme
 * carries one template and the region lives on the account. A central post
 * carries no territory, and null matches null.
 *
 * Does nothing for the generic post, which is not singular.
 */
export async function assertPostIsVacant(prisma: PostHolderStore, post: PostIdentity): Promise<void> {
  if (!isSingularPost(post.positionType)) return;
  const territory = (value: string | null) =>
    value ? { equals: value, mode: 'insensitive' as const } : null;
  const holder = await prisma.user.findFirst({
    where: {
      serviceCode: post.serviceCode,
      positionType: post.positionType,
      region: territory(post.region),
      department: territory(post.department),
      status: { in: [...HOLDING_STATUSES] },
    },
    select: { id: true },
  });
  if (holder) throw new ConflictException(POST_ALREADY_HELD);
}
