import { AuthController } from './auth.controller';

describe('AuthController.adminRegisterCompany', () => {
  it('forwards the request IP address and user-agent to the service', async () => {
    const authService = {
      adminRegisterCompany: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new AuthController(authService as any, {} as any, {} as any);
    const req = {
      ip: '203.0.113.24',
      headers: { 'user-agent': 'Assisted registration test client' },
      user: {
        id: 'admin-user-1',
        role: 'SUPER_ADMIN',
        region: null,
        department: null,
      },
    };

    await controller.adminRegisterCompany(req, {
      clientRequestId: '2b8e7096-2210-4a75-ae7d-e13a1669fc6c',
      email: 'declarant@example.cm',
      companyName: 'Test organization',
      region: 'Centre',
      department: 'Mfoundi',
      subdivision: 'Yaounde I',
      address: 'Test address',
      entityType: 'ENTREPRISE',
    } as any);

    expect(authService.adminRegisterCompany).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'declarant@example.cm' }),
      expect.objectContaining({ id: 'admin-user-1' }),
      {
        ipAddress: '203.0.113.24',
        userAgent: 'Assisted registration test client',
        clientRequestId: '2b8e7096-2210-4a75-ae7d-e13a1669fc6c',
      },
    );
  });
});
