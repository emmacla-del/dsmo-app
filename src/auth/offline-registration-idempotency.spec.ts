import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService offline registration replay', () => {
  const requestId = '6dbd9a9f-8108-4e48-91bd-6a5fe79eb13d';
  const email = 'applicant@example.cm';
  const password = 'Offline-Password-123!';
  let prisma: any;
  let service: AuthService;

  beforeEach(async () => {
    const passwordHash = await bcrypt.hash(password, 4);
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email,
          passwordHash,
          status: 'PENDING_APPROVAL',
          registrationRequestId: requestId,
        }),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'company-1',
          userId: 'user-1',
          name: 'Offline Applicant Ltd',
          establishmentId: 'EN26000101',
          taxNumber: 'NIU-123',
          entityType: 'ENTREPRISE',
        }),
      },
    };
    service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);
    (service as any).login = jest.fn().mockResolvedValue({ access_token: 'token', user: { id: 'user-1' } });
  });

  it('returns the already-created account after an ambiguous network retry', async () => {
    const result = await service.registerCompany(email, password, {} as any, requestId);

    expect(result).toMatchObject({
      access_token: 'token',
      company: { id: 'company-1', establishmentId: 'EN26000101' },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { registrationRequestId: requestId } });
    expect(prisma.company.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(prisma.user.create).toBeUndefined();
    expect((service as any).login).toHaveBeenCalledTimes(1);
  });

  it('does not replay an idempotency key for a different email or password', async () => {
    await expect(service.registerCompany('someone-else@example.cm', password, {} as any, requestId))
      .rejects.toBeInstanceOf(ConflictException);
    await expect(service.registerCompany(email, 'wrong-password', {} as any, requestId))
      .rejects.toBeInstanceOf(ConflictException);
    expect((service as any).login).not.toHaveBeenCalled();
  });

  it('does not report success until the company row exists', async () => {
    prisma.company.findUnique.mockResolvedValue(null);
    await expect(service.registerCompany(email, password, {} as any, requestId))
      .rejects.toBeInstanceOf(ConflictException);
    expect((service as any).login).not.toHaveBeenCalled();
  });
});
