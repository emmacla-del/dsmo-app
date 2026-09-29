import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface UserListFilterParams {
  search?: string;
  role?: string;
  /** Comma-separated role list, e.g. "REGIONAL,DIVISIONAL". */
  roles?: string;
  region?: string;
  status?: string;
  isActive?: string;
  /**
   * Server-side ceiling on visible roles (the caller's administrative
   * scope). Never taken from the request; requested roles are intersected
   * with it, so a filter can only narrow the list, never widen it.
   */
  allowedRoles?: readonly string[] | null;
}

const KNOWN_ROLES = new Set<string>(Object.values(UserRole));

/**
 * Builds the Prisma `where` for GET /auth/users. COMPANY accounts are never
 * listed. `roles` (multi) and `role` (single, legacy) may both be given; the
 * result is their intersection so a client can never widen `role` by adding
 * `roles`. Unknown role names are rejected with a 400 instead of reaching
 * Prisma as an invalid enum value.
 */
export function buildUserListWhere(params: UserListFilterParams): Record<string, any> {
  const requested = (params.roles ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  for (const r of [...requested, ...(params.role ? [params.role] : [])]) {
    if (!KNOWN_ROLES.has(r)) {
      throw new BadRequestException(`Rôle inconnu : ${r}`);
    }
  }

  let roles: string[] | null = requested.length > 0 ? requested : null;
  if (params.role) {
    roles = roles ? roles.filter((r) => r === params.role) : [params.role];
  }
  if (roles) roles = roles.filter((r) => r !== UserRole.COMPANY);
  if (params.allowedRoles) {
    const ceiling = params.allowedRoles;
    roles = (roles ?? [...ceiling]).filter((r) => ceiling.includes(r));
  }

  const where: Record<string, any> = {
    role: roles ? { in: roles } : { not: UserRole.COMPANY },
  };
  if (params.region?.trim()) {
    where.region = { equals: params.region.trim(), mode: 'insensitive' };
  }
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
  return where;
}
