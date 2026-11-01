import { QuestionnairesService } from './questionnaires.service';

/**
 * S22Q03_DIPLOMA_MISMATCH compares recruitment by diploma with permanent +
 * temporary recruitment. The wizard stores the diploma table per staff
 * category (`s22q03_<csp>_total_<g>_total`) with no overall total key, and
 * the server read only the overall key, so a file whose figures reconciled
 * (5 permanent, 0 temporary, 5 by diploma) was still flagged. Advisory either
 * way (CLAUDE.md §7); this pins which keys the rule reads.
 */
describe('QuestionnairesService — S22Q03 diploma coherence', () => {
  const prisma = new Proxy({}, { get: () => { throw new Error('the preview touched the database'); } });
  const service = new QuestionnairesService(prisma as any);

  const codes = (data: Record<string, unknown>) =>
    service.previewCoherence('ENTERPRISE', data).map((f) => f.code);

  it('adds up the per-category totals the wizard stores', () => {
    expect(codes({
      s22q01_total_male_total: 3, s22q01_total_female_total: 2, s22q01_total_total_total: 5,
      s22q02_total_male_total: 0, s22q02_total_female_total: 0, s22q02_total_total_total: 0,
      s22q03_cadres_total_male_total: 1, s22q03_cadres_total_female_total: 1, s22q03_cadres_total_total_total: 2,
      s22q03_workers_total_male_total: 2, s22q03_workers_total_female_total: 1, s22q03_workers_total_total_total: 3,
    })).not.toContain('S22Q03_DIPLOMA_MISMATCH');
  });

  it('still flags a real disagreement between the two breakdowns', () => {
    const flags = service.previewCoherence('ENTERPRISE', {
      s22q01_total_male_total: 3, s22q01_total_total_total: 3,
      s22q03_cadres_total_male_total: 1, s22q03_cadres_total_total_total: 1,
      s22q03_foremen_total_male_total: 1, s22q03_foremen_total_total_total: 1,
    }).filter((f) => f.code === 'S22Q03_DIPLOMA_MISMATCH');
    expect(flags.length).toBe(2);
    expect(flags[0].message).toContain('(S22Q03: 2, male)');
    expect(flags[0].message).toContain('(S22Q01+S22Q02: 3, male)');
  });

  it('reads the overall key when no category total exists', () => {
    expect(codes({
      s22q01_total_male_total: 4, s22q01_total_total_total: 4,
      s22q03_total_male_total: 4, s22q03_total_total_total: 4,
    })).not.toContain('S22Q03_DIPLOMA_MISMATCH');
  });
});
