import { Prisma, User } from '@prisma/client';

/**
 * The user columns that may leave the server. This is an ALLOWLIST: a column
 * added to the User model later is withheld until it is listed here, so a new
 * secret cannot leak by default. public-user.spec.ts fails until every User
 * column is classified either here or in SECRET_USER_FIELDS.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  region: true,
  department: true,
  subdivision: true,
  matricule: true,
  poste: true,
  serviceCode: true,
  positionType: true,
  positionTitle: true,
  isActive: true,
  rejectedAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  mustChangePassword: true,
  emailVerified: true,
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: true,
  weeklyDigestEnabled: true,
  smsNotificationsEnabled: true,
  twoFactorEnabled: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  // Phase 1 (territorial admin monitoring): how the account came into
  // existence and which admin created it. Public so the admin console can
  // show attribution ("Enregistre par", method badge). assigneeId stays
  // secret until the monitoring dashboard needs it.
  createdBy: true,
  registrationMethod: true,
} satisfies Prisma.UserSelect;

/** Columns that must never be returned to a client. */
export const SECRET_USER_FIELDS = [
  'passwordHash',
  'passwordResetTokenHash',
  'passwordResetExpires',
  'emailVerificationTokenHash',
  'emailVerificationExpires',
  'twoFactorCodeHash',
  'twoFactorCodeExpires',
  // Admin rebuild B1 (user & registration): internal tracking and review
  // fields. Nothing reads these from a client-facing user yet; move one to
  // PUBLIC_USER_SELECT only when a screen needs it.
  'lastLoginAt',
  'approvedAt',
  'tokenVersion',
  'registrationNumber',
  'assigneeId',
  'lastReminderAt',
  'approvalComment',
  'perAgentTarget',
  // R.1: the registration rejection reason is reviewer-facing. The company
  // is told of the decision by email and sees a fixed message at login, so
  // nothing client-facing reads it any more. The staff review queue selects
  // it explicitly (AuthService.listCompanyRegistrations) rather than through
  // this allowlist.
  'rejectionReason',
] as const;

/** A user row as clients may see it. Reading a secret column is a type error. */
export type PublicUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;

const PUBLIC_USER_KEYS = Object.keys(PUBLIC_USER_SELECT) as (keyof PublicUser)[];

/** Copies only the allowlisted columns of a user row. */
export function toPublicUser(user: User): PublicUser {
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_USER_KEYS) out[key] = user[key];
  return out as PublicUser;
}
