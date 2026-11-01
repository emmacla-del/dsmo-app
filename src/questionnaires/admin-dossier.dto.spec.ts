import { ValidationPipe } from '@nestjs/common';
import { AnomalyResolutionType } from '@prisma/client';
import { ResolveAnomalyDto, SaveReviewProgressDto } from '../dto/admin-dossier.dto';

describe('ResolveAnomalyDto API contract', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    skipMissingProperties: false,
  });

  const metadata = { type: 'body' as const, metatype: ResolveAnomalyDto };
  const validBody = {
    resolutionType: AnomalyResolutionType.DECLARANT_CORRECTION,
    resolutionNote: 'Les pièces justificatives confirment la déclaration.',
    expectedRevision: 7,
  };

  it('requires expectedRevision for anomaly resolution requests', async () => {
    const { expectedRevision: _ignored, ...body } = validBody;
    await expect(pipe.transform(body, metadata)).rejects.toThrow();
  });

  it('accepts a nonnegative integer revision and rejects malformed values', async () => {
    await expect(pipe.transform(validBody, metadata)).resolves.toMatchObject(validBody);
    for (const expectedRevision of ['7', 'not-a-number', -1, 1.5, 2147483648]) {
      await expect(pipe.transform({ ...validBody, expectedRevision }, metadata)).rejects.toThrow();
    }
  });
});

describe('SaveReviewProgressDto API contract', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const metadata = { type: 'body' as const, metatype: SaveReviewProgressDto };
  const validBody = { note: 'A sufficiently detailed progress note.', expectedRevision: 0 };

  it('requires a nonnegative integer revision for progress writes', async () => {
    await expect(pipe.transform(validBody, metadata)).resolves.toMatchObject(validBody);
    const { expectedRevision: _ignored, ...missing } = validBody;
    await expect(pipe.transform(missing, metadata)).rejects.toThrow();
    for (const expectedRevision of ['0', -1, 1.5, 2147483648]) {
      await expect(pipe.transform({ ...validBody, expectedRevision }, metadata)).rejects.toThrow();
    }
  });
});
