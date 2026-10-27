import { BadRequestException, NotFoundException } from '@nestjs/common';
import { assertTerritorialAuthority, type Territory } from './territory';

/** The agent a record is assigned to, as the lists show it. */
export interface AssigneeView {
  id: string;
  name: string;
}

/**
 * The columns read to validate an assignee. The territory columns are needed
 * for assertTerritorialAuthority; nothing else about the account leaves here.
 */
export const ASSIGNEE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  status: true,
  archivedAt: true,
  region: true,
  department: true,
} as const;

/** Trimmed first+last name, falling back to the address, as elsewhere. */
export function assigneeName(
  user: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined,
): string | null {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter((part) => part?.trim()).join(' ').trim();
  return name || user.email || null;
}

type UserReader = {
  user: { findFirst(args: any): Promise<any> };
};

/**
 * Resolves the agent a record should be assigned to, or null to release it.
 *
 * An assignee must be an active staff account of the module that owns the
 * record (allowedRoles), and must have jurisdiction over the record itself,
 * so a regional reviewer can never hand a file to an agent who could not
 * decide it. The caller passes its transaction client, and the assignment is
 * written in the same transaction.
 */
export async function resolveAssignee(
  prisma: UserReader,
  assigneeId: string | null | undefined,
  target: Territory,
  allowedRoles: readonly string[],
): Promise<AssigneeView | null> {
  if (assigneeId === undefined || assigneeId === null) return null;
  const id = typeof assigneeId === 'string' ? assigneeId.trim() : '';
  if (!id) return null;

  const user = await prisma.user.findFirst({
    where: { id, archivedAt: null },
    select: ASSIGNEE_SELECT,
  });
  if (!user) throw new NotFoundException('Agent destinataire introuvable.');
  if (user.role === 'COMPANY') {
    throw new BadRequestException('Un compte entreprise ne peut pas être affecté à l’instruction.');
  }
  if (!allowedRoles.includes(user.role)) {
    throw new BadRequestException('Ce compte n’est pas habilité à instruire ce type de dossier.');
  }
  if (!user.isActive || user.status !== 'ACTIVE') {
    throw new BadRequestException('Le destinataire de l’affectation doit être un compte actif.');
  }
  assertTerritorialAuthority(user as Territory, target);

  return { id: user.id, name: assigneeName(user) ?? user.email };
}
