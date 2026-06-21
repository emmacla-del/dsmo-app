const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

import { EmailService, EmailSendError } from './email.service';

describe('EmailService.sendPasswordResetLink', () => {
  const toEmail = 'user@example.com';
  const resetLink = 'https://dsmo-digital.com/reset-password?token=abc123';

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockReset();
  });

  it('sends from the correct address, to the correct recipient, with the link in the HTML body', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    const service = new EmailService();
    await service.sendPasswordResetLink(toEmail, resetLink);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0];
    expect(payload.from).toBe('DSMO Digital <noreply@dsmo-digital.com>');
    expect(payload.to).toBe(toEmail);
    expect(payload.html).toContain(resetLink);
  });

  it('throws when Resend returns an error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: 'invalid_api_key', message: 'API key is invalid', statusCode: 401 },
    });

    const service = new EmailService();

    await expect(
      service.sendPasswordResetLink(toEmail, resetLink),
    ).rejects.toThrow(EmailSendError);
  });

  it('throws without calling Resend when RESEND_API_KEY is not configured', async () => {
    delete process.env.RESEND_API_KEY;

    const service = new EmailService();

    await expect(
      service.sendPasswordResetLink(toEmail, resetLink),
    ).rejects.toThrow(EmailSendError);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
