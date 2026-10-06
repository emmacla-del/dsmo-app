import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';

// The route's own pipe, so these assertions describe what the controller
// actually does with a body rather than what the DTO could allow.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
  skipMissingProperties: false,
});
const asBody: ArgumentMetadata = { type: 'body', metatype: ApproveRegistrationDto };

describe('ApproveRegistrationDto', () => {
  it('passes the five confirmations through as booleans', async () => {
    const body = {
      centralStructureConfirmed: true,
      nameVerified: true,
      phoneVerified: true,
      contactEmailVerified: false,
      cnpsVerified: true,
    };
    await expect(pipe.transform(body, asBody)).resolves.toMatchObject(body);
  });

  it('accepts an empty body: which flags are required is the service\'s decision', async () => {
    // A staff approval sends none, and the legacy Flutter approve sends no body.
    await expect(pipe.transform({}, asBody)).resolves.toEqual({});
    await expect(pipe.transform(undefined, asBody)).resolves.toBeDefined();
  });

  it.each(['true', 1, 'yes'])('refuses a non-boolean flag (%p) rather than reading it as checked', async (value) => {
    await expect(pipe.transform({ nameVerified: value }, asBody)).rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ centralStructureConfirmed: value }, asBody)).rejects.toThrow(BadRequestException);
  });

  it('strips keys it does not declare', async () => {
    // emailVerified is User.emailVerified, not a reviewer flag.
    const out = await pipe.transform({ nameVerified: true, emailVerified: true }, asBody);
    expect(out).not.toHaveProperty('emailVerified');
  });
});
