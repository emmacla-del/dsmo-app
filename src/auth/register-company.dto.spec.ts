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
    cnpsNumber: '1234567890',
    // Only read when entityType is VOCATIONAL_TRAINING; @ValidateIf skips
    // them for every other type.
    cfpType: 'Public',
    educationSystem: 'Francophone',
    functionalStatus: 'Fonctionnelle',
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

describe('RegisterCompanyDto — cnpsNumber', () => {
  const CNPS_TYPES = ['ENTREPRISE', 'COOPERATIVE', 'CTD', 'ONG', 'VOCATIONAL_TRAINING'];

  it('refuses a missing cnpsNumber for each of the five types that collect it', async () => {
    for (const entityType of CNPS_TYPES) {
      await expect(
        pipe.transform(body({ entityType, cnpsNumber: undefined }), publicBody),
      ).rejects.toThrow(BadRequestException);
    }
  });

  it('refuses an empty cnpsNumber for each of the five types', async () => {
    for (const entityType of CNPS_TYPES) {
      await expect(pipe.transform(body({ entityType, cnpsNumber: '' }), publicBody)).rejects.toThrow(
        BadRequestException,
      );
    }
  });

  it('accepts a cnpsNumber for each of the five types', async () => {
    for (const entityType of CNPS_TYPES) {
      await expect(pipe.transform(body({ entityType }), publicBody)).resolves.toMatchObject({
        entityType,
        cnpsNumber: '1234567890',
      });
    }
  });

  it('accepts ADMINISTRATION and PROJECT_PROGRAM without a cnpsNumber', async () => {
    for (const entityType of ['ADMINISTRATION', 'PROJECT_PROGRAM']) {
      await expect(
        pipe.transform(body({ entityType, cnpsNumber: undefined }), publicBody),
      ).resolves.toMatchObject({ entityType });
    }
  });

  it('applies the same rule to the assisted route', async () => {
    await expect(
      pipe.transform(body({ cnpsNumber: undefined, password: undefined }), assistedBody),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform(
        body({ entityType: 'ADMINISTRATION', cnpsNumber: undefined, password: undefined }),
        assistedBody,
      ),
    ).resolves.toMatchObject({ entityType: 'ADMINISTRATION' });
  });
});

describe('RegisterCompanyDto — VOCATIONAL_TRAINING fields', () => {
  const vt = (o: Record<string, unknown> = {}) => body({ entityType: 'VOCATIONAL_TRAINING', ...o });

  it('refuses a VT registration missing or blanking any of the three required fields', async () => {
    for (const field of ['cfpType', 'educationSystem', 'functionalStatus']) {
      await expect(pipe.transform(vt({ [field]: undefined }), publicBody)).rejects.toThrow(
        BadRequestException,
      );
      await expect(pipe.transform(vt({ [field]: '' }), publicBody)).rejects.toThrow(
        BadRequestException,
      );
    }
  });

  it('requires nonFunctionalReason only when the centre is non-functional', async () => {
    await expect(
      pipe.transform(vt({ functionalStatus: 'Non-fonctionnelle' }), publicBody),
    ).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform(
        vt({ functionalStatus: 'Non-fonctionnelle', nonFunctionalReason: 'Manque de moyens' }),
        publicBody,
      ),
    ).resolves.toMatchObject({ nonFunctionalReason: 'Manque de moyens' });
  });

  it('requires nonFunctionalReasonOther only when the reason is Autres', async () => {
    const nonFunctional = { functionalStatus: 'Non-fonctionnelle', nonFunctionalReason: 'Autres' };
    await expect(pipe.transform(vt(nonFunctional), publicBody)).rejects.toThrow(BadRequestException);
    await expect(
      pipe.transform(vt({ ...nonFunctional, nonFunctionalReasonOther: 'Incendie' }), publicBody),
    ).resolves.toMatchObject({ nonFunctionalReasonOther: 'Incendie' });
  });

  it('does not require the VT fields for other types', async () => {
    await expect(
      pipe.transform(
        body({ cfpType: undefined, educationSystem: undefined, functionalStatus: undefined }),
        publicBody,
      ),
    ).resolves.toMatchObject({ entityType: 'ENTREPRISE' });
  });

  it('applies the same rule to the assisted route', async () => {
    await expect(
      pipe.transform(vt({ cfpType: undefined, password: undefined }), assistedBody),
    ).rejects.toThrow(BadRequestException);
  });
});
