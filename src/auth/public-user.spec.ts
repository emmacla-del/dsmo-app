import { Prisma, User } from '@prisma/client';
import { PUBLIC_USER_SELECT, PublicUser, SECRET_USER_FIELDS, toPublicUser } from './public-user';

// Administrative audit columns added after the allowlist was written. They
// stay out of PUBLIC_USER_SELECT (toPublicUser copies allowlisted keys only),
// so the spec classifies them here as secret/admin-only until a screen needs
// them and the production allowlist is deliberately widened.
const ADMIN_ONLY_FIELDS = ['rejectedBy', 'archivedAt', 'archivedBy', 'archiveReason'] as const;

const SECRET_COLUMNS: readonly string[] = [...SECRET_USER_FIELDS, ...ADMIN_ONLY_FIELDS];

const SECRETS: Record<string, unknown> = {
  passwordHash: '$2b$10$hash',
  passwordResetTokenHash: 'reset-hash',
  passwordResetExpires: new Date(),
  emailVerificationTokenHash: 'verify-hash',
  emailVerificationExpires: new Date(),
  twoFactorCodeHash: '2fa-hash',
  twoFactorCodeExpires: new Date(),
  lastLoginAt: new Date(),
  approvedAt: new Date(),
  approvedBy: 'delegate-1',
  tokenVersion: 0,
  registrationNumber: 'INS-2026-0847',
  registrationRequestId: 'req-1',
  assigneeId: 'agent-1',
  lastReminderAt: new Date(),
  approvalComment: 'reviewer note',
  perAgentTarget: 25,
  rejectionReason: 'Documents illisibles',
  rejectedBy: 'reviewer-1',
  archivedAt: new Date('2026-10-27T10:00:00.000Z'),
  archivedBy: 'owner-1',
  archiveReason: 'Doublon',
};

function fullUser(): User {
  return {
    id: 'u1',
    email: 'agent@minefop.cm',
    firstName: 'Marie',
    lastName: 'Ebanda',
    role: 'DIVISIONAL_ADMIN',
    region: 'Centre',
    department: 'Mfoundi',
    isActive: true,
    status: 'ACTIVE',
    // Phase 1 moved these two out of SECRET_USER_FIELDS and into the
    // allowlist, so they belong on the public side of the fixture now.
    createdBy: 'admin-1',
    registrationMethod: 'SELF_REGISTRATION',
    ...SECRETS,
  } as unknown as User;
}

describe('public user allowlist', () => {
  it('classifies every User column as public or secret, never both', () => {
    // Fails when a column is added to the User model: decide which list it
    // belongs to before it can be returned.
    const publicKeys = Object.keys(PUBLIC_USER_SELECT);
    const secretKeys: string[] = [...SECRET_COLUMNS];
    for (const column of Object.values(Prisma.UserScalarFieldEnum)) {
      expect({ column, classified: publicKeys.includes(column) !== secretKeys.includes(column) }).toEqual({
        column,
        classified: true,
      });
    }
  });

  it('never copies a secret column', () => {
    const out = toPublicUser(fullUser()) as Record<string, unknown>;
    for (const secret of SECRET_COLUMNS) {
      expect(out).not.toHaveProperty(secret);
    }
    expect(out).toMatchObject({ id: 'u1', email: 'agent@minefop.cm', role: 'DIVISIONAL_ADMIN', region: 'Centre' });
    // And the two newly public attribution columns do come through.
    expect(out).toMatchObject({ createdBy: 'admin-1', registrationMethod: 'SELF_REGISTRATION' });
  });

  it('withholds columns it does not know about', () => {
    const row = { ...fullUser(), someFutureSecret: 'x' } as unknown as User;
    expect(toPublicUser(row)).not.toHaveProperty('someFutureSecret');
  });

  it('makes reading a secret column a type error', () => {
    const user: PublicUser = toPublicUser(fullUser());
    // Each line must fail typecheck; tsc --noEmit covers this spec.
    // @ts-expect-error passwordHash is not public
    void user.passwordHash;
    // @ts-expect-error passwordResetTokenHash is not public
    void user.passwordResetTokenHash;
    // @ts-expect-error passwordResetExpires is not public
    void user.passwordResetExpires;
    // @ts-expect-error emailVerificationTokenHash is not public
    void user.emailVerificationTokenHash;
    // @ts-expect-error emailVerificationExpires is not public
    void user.emailVerificationExpires;
    // @ts-expect-error twoFactorCodeHash is not public
    void user.twoFactorCodeHash;
    // @ts-expect-error twoFactorCodeExpires is not public
    void user.twoFactorCodeExpires;
    expect(user.id).toBe('u1');
  });
});
