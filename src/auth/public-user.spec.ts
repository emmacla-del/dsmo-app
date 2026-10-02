import { Prisma, User } from '@prisma/client';
import { PUBLIC_USER_SELECT, PublicUser, SECRET_USER_FIELDS, toPublicUser } from './public-user';

const SECRETS: Record<(typeof SECRET_USER_FIELDS)[number], unknown> = {
  passwordHash: '$2b$10$hash',
  passwordResetTokenHash: 'reset-hash',
  passwordResetExpires: new Date(),
  emailVerificationTokenHash: 'verify-hash',
  emailVerificationExpires: new Date(),
  twoFactorCodeHash: '2fa-hash',
  twoFactorCodeExpires: new Date(),
  lastLoginAt: new Date(),
  approvedAt: new Date(),
  createdBy: 'admin-1',
  registrationMethod: 'SELF_REGISTRATION',
  tokenVersion: 0,
  registrationNumber: 'INS-2026-0847',
  assigneeId: 'agent-1',
  lastReminderAt: new Date(),
  approvalComment: 'reviewer note',
  perAgentTarget: 25,
  rejectionReason: 'Documents illisibles',
};

function fullUser(): User {
  return {
    id: 'u1',
    email: 'agent@minefop.cm',
    firstName: 'Marie',
    lastName: 'Ebanda',
    role: 'DIVISIONAL',
    region: 'Centre',
    department: 'Mfoundi',
    isActive: true,
    status: 'ACTIVE',
    ...SECRETS,
  } as unknown as User;
}

describe('public user allowlist', () => {
  it('classifies every User column as public or secret, never both', () => {
    // Fails when a column is added to the User model: decide which list it
    // belongs to before it can be returned.
    const publicKeys = Object.keys(PUBLIC_USER_SELECT);
    const secretKeys: string[] = [...SECRET_USER_FIELDS];
    for (const column of Object.values(Prisma.UserScalarFieldEnum)) {
      expect({ column, classified: publicKeys.includes(column) !== secretKeys.includes(column) }).toEqual({
        column,
        classified: true,
      });
    }
  });

  it('never copies a secret column', () => {
    const out = toPublicUser(fullUser()) as Record<string, unknown>;
    for (const secret of SECRET_USER_FIELDS) {
      expect(out).not.toHaveProperty(secret);
    }
    expect(out).toMatchObject({ id: 'u1', email: 'agent@minefop.cm', role: 'DIVISIONAL', region: 'Centre' });
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
