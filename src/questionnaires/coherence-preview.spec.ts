import { QuestionnairesService } from './questionnaires.service';

/**
 * Defect 25 (2026-10-16 VT run): the respondent never saw the advisory
 * coherence flags. previewCoherence computes the same flags a final
 * submission stores, without touching the database, so the wizard can show
 * them before the respondent submits. They stay advisory (CLAUDE.md §7).
 */
describe('QuestionnairesService.previewCoherence', () => {
  // A Prisma stand-in that fails on any use: the preview must not need one.
  const prisma = new Proxy({}, { get: () => { throw new Error('the preview touched the database'); } });
  const service = new QuestionnairesService(prisma as any);

  it('returns the VT flags a final submission would store', () => {
    const flags = service.previewCoherence('VOCATIONAL_TRAINING', {
      s4q1_licence_male: 12,
      s4q2_cap_male: 10,
    });
    expect(flags.map((f) => f.code)).toContain('VT_DIPLOMA_ACADEMIC_PRO_MISMATCH');
    expect(flags.find((f) => f.code === 'VT_DIPLOMA_ACADEMIC_PRO_MISMATCH')!.message).toContain('(4.1: 12, hommes)');
  });

  it('returns nothing when the totals agree', () => {
    const flags = service.previewCoherence('vocationalTraining', { s4q1_licence_male: 3, s4q2_cap_male: 3 });
    expect(flags.filter((f) => f.code === 'VT_DIPLOMA_ACADEMIC_PRO_MISMATCH')).toEqual([]);
  });

  it('accepts a missing or malformed body as no answers', () => {
    expect(service.previewCoherence('VOCATIONAL_TRAINING', null)).toEqual([]);
    expect(service.previewCoherence('VOCATIONAL_TRAINING', ['x'])).toEqual([]);
  });

  it('refuses an unknown questionnaire type', () => {
    expect(() => service.previewCoherence('UNKNOWN', {})).toThrow(/Unsupported entity type/);
  });
});
