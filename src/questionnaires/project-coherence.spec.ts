import { QuestionnairesService } from './questionnaires.service';

/**
 * The project/programme form carried no coherence edit at all: every rule in
 * checkCoherence is keyed to the employer forms' s22q0x / s3q0x cells, which
 * a project file never holds, so 4.5 handicap > 4.3 permanents recruited was
 * stored with no flag while the identical mistake on an enterprise was
 * flagged. All three rules are advisory (CLAUDE.md §7; owner's decision of
 * 2026-10-19), stored as non-blocking WARNING anomalies like every other.
 */
describe('QuestionnairesService — project/programme coherence', () => {
  const prisma = new Proxy({}, { get: () => { throw new Error('the preview touched the database'); } });
  const service = new QuestionnairesService(prisma as any);

  const codes = (data: Record<string, unknown>) =>
    service.previewCoherence('PROJECT_PROGRAM', data).map((f) => f.code).sort();

  it('flags 4.5 handicap above the permanents recruited in 4.3', () => {
    const flags = service.previewCoherence('PROJECT_PROGRAM', {
      pp_s4q03_total_male_total: 3,
      pp_s4q05_total_permanent_male: 5,
    });
    expect(flags.map((f) => f.code)).toEqual(['PP_S4Q05_PERMANENT_EXCEEDS_TOTAL']);
    expect(flags[0].message).toContain('(4.5: 5, male)');
    expect(flags[0].message).toContain('(4.3: 3, male)');
  });

  it('flags 4.6 vulnerable above the temporaries recruited in 4.4', () => {
    expect(codes({ pp_s4q04_total_female_total: 1, pp_s4q06_total_temporary_female: 4 }))
      .toEqual(['PP_S4Q06_TEMPORARY_EXCEEDS_TOTAL']);
  });

  it('says nothing when each subset sits inside its total', () => {
    expect(codes({
      pp_s4q03_total_male_total: 9,
      pp_s4q04_total_male_total: 4,
      pp_s4q05_total_permanent_male: 2,
      pp_s4q06_total_temporary_male: 4,
    })).toEqual([]);
  });

  it('compares 4.1 with the permanent headcount of section 1, once 4.1 is complete', () => {
    const flags = service.previewCoherence('PROJECT_PROGRAM', {
      pp_s4q01_total_total_total: 12,
      PP_S1Q15: 15,
    });
    expect(flags.map((f) => f.code)).toEqual(['PP_S4Q01_HEADCOUNT_MISMATCH']);
    expect(flags[0].message).toContain('(4.1: 12)');
    expect(flags[0].message).toContain('(S1Q15: 15)');

    expect(codes({ pp_s4q01_total_total_total: 15, PP_S1Q15: 15 })).toEqual([]);
    // 4.1 still being filled: its grand total is blank while any cell is.
    expect(codes({ PP_S1Q15: 15 })).toEqual([]);
    // The headcount not yet answered.
    expect(codes({ pp_s4q01_total_total_total: 12 })).toEqual([]);
  });

  it('catches a stray digit in a project\'s permanent headcount', () => {
    // headlineWorkers read enterprise/cooperative/CTD/NGO only, so a project
    // reached not even this ceiling.
    expect(codes({ PP_S1Q15: 60000 })).toContain('PERMANENT_WORKERS_IMPLAUSIBLE');
    expect(codes({ PP_S1Q16: 60000 })).toContain('VACANCIES_IMPLAUSIBLE');
  });

  it('leaves the employer rules exactly as they were', () => {
    const enterprise = service
      .previewCoherence('ENTREPRISE', { s22q01_total_male_total: 3, s22q04_total_permanent_male: 5 })
      .map((f) => f.code);
    expect(enterprise).toContain('S22Q04_PERMANENT_EXCEEDS_TOTAL');
    // A project's cells never trip a rule written for the employer forms.
    expect(service.previewCoherence('ENTREPRISE', {
      pp_s4q03_total_male_total: 3,
      pp_s4q05_total_permanent_male: 5,
    })).toEqual([]);
  });
});
