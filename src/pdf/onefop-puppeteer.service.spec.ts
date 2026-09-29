import { isVocationalTrainingFormType } from './onefop-puppeteer.service';

// VT-7 Finding 2 regression coverage. The VT-specific PDF footer ("Page X
// sur Y") and 18mm bottom margin in OnefopPuppeteerService.htmlToPdf are
// gated on this predicate. Before this fix it compared formType against
// the SCREAMING_SNAKE_CASE Prisma enum spelling ('VOCATIONAL_TRAINING'),
// but every real call site (onefop-submission-pdf.service.ts's MAPPERS
// dispatch, questionnaires.controller.ts's preview path) passes the
// camelCase dispatch value ('vocationalTraining') — so the condition could
// never be true on a real VT PDF.
describe('isVocationalTrainingFormType', () => {
  it('is true for the real camelCase dispatch value', () => {
    expect(isVocationalTrainingFormType('vocationalTraining')).toBe(true);
  });

  it('is also true for the SCREAMING_SNAKE_CASE Prisma enum spelling', () => {
    expect(isVocationalTrainingFormType('VOCATIONAL_TRAINING')).toBe(true);
  });

  it('is false for the other six entity types', () => {
    for (const formType of ['enterprise', 'cooperative', 'ctd', 'ong', 'administration', 'projectProgram']) {
      expect(isVocationalTrainingFormType(formType)).toBe(false);
    }
  });

  it('is false for undefined/empty formType', () => {
    expect(isVocationalTrainingFormType(undefined)).toBe(false);
    expect(isVocationalTrainingFormType('')).toBe(false);
  });
});
