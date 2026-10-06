import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { AssistedRegistrationDto } from './dto/assisted-registration.dto';

// The global pipe from main.ts, options copied verbatim. skipMissingProperties
// is the reason entityType needs @IsDefined: without it a missing key skips
// every other check on the field.
const pipe = new ValidationPipe({
  transform: false,
  whitelist: true,
  forbidNonWhitelisted: false,
  skipMissingProperties: true,
});
const publicBody: ArgumentMetadata = { type: 'body', metatype: RegisterCompanyDto };
const assistedBody: ArgumentMetadata = { type: 'body', metatype: AssistedRegistrationDto };

function body(overrides: Record<string, unknown> = {}) {
  const b: Record<string, unknown> = {
    email: 'contact@societe.cm',
    companyName: 'Societe Test',
    region: 'Littoral',
    department: 'Wouri',
    subdivision: 'Douala 1',
    address: 'BP 1234 Douala',
    password: 'Secret123!',
    entityType: 'ENTREPRISE',
    ...overrides,
  };
  for (const k of Object.keys(b)) if (b[k] === undefined) delete b[k];
  return b;
}

describe('RegisterCompanyDto — entityType', () => {
  it('refuses a registration with no entityType', async () => {
    await expect(pipe.transform(body({ entityType: undefined }), publicBody)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses an empty entityType', async () => {
    await expect(pipe.transform(body({ entityType: '' }), publicBody)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses a value the establishment ID generator has no prefix for', async () => {
    for (const entityType of ['ENTERPRISE', 'entreprise', 'VOCATIONAL_TRAINING_CENTER']) {
      await expect(pipe.transform(body({ entityType }), publicBody)).rejects.toThrow(
        BadRequestException,
      );
    }
  });

  it('accepts each of the seven registrable types', async () => {
    for (const entityType of [
      'ENTREPRISE',
      'COOPERATIVE',
      'CTD',
      'ONG',
      'ADMINISTRATION',
      'PROJECT_PROGRAM',
      'VOCATIONAL_TRAINING',
    ]) {
      await expect(pipe.transform(body({ entityType }), publicBody)).resolves.toMatchObject({
        entityType,
      });
    }
  });

  it('applies the same rule to the assisted route, which shares the fields', async () => {
    await expect(
      pipe.transform(body({ entityType: undefined, password: undefined }), assistedBody),
    ).rejects.toThrow(BadRequestException);
  });
});
