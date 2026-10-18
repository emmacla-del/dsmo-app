import { QuestionnairesService } from './questionnaires.service';

// C1–C3 of the 2026-10-18 enterprise run. A reported table must have every
// cell filled, but the check has to ask for the cells the wizard actually
// writes — and must not treat the zeros an untouched table opens with as a
// respondent's answer.
describe('QuestionnairesService — cells required of a REPORTED table', () => {
  const service = Object.create(QuestionnairesService.prototype) as QuestionnairesService;
  const expected = (statusField: string, flat: Record<string, unknown> = {}, entity = 'enterprise') =>
    (service as any).getExpectedMatrixCellKeys(statusField, flat, entity) as string[];

  it('S3Q01 asks for the departure keys the wizard writes, not French ones', () => {
    const keys = expected('S3Q01_RESPONSE_STATUS');
    // buildDepartureRows() reads exactly these.
    expect(keys).toContain('s3q01_cadres_resignation_male');
    expect(keys).toContain('s3q01_workers_dismissal_female');
    expect(keys).toContain('s3q01_foremen_retirement_male');
    expect(keys).toContain('s3q01_cadres_other_female');
    for (const dead of ['licenciement', 'demission', 'retraite', 'deces', 'fin_contrat', 'autres']) {
      expect(keys.filter((k) => k.includes(dead))).toEqual([]);
    }
    // 3 categories x 4 reasons x 2 sexes; 'ensemble' is a computed total.
    expect(keys).toHaveLength(24);
    expect(keys.filter((k) => k.includes('ensemble'))).toEqual([]);
  });

  it('S4Q01 asks for the internship keys the wizard writes', () => {
    const keys = expected('S4Q01_RESPONSE_STATUS');
    expect(keys).toEqual([
      's4q01_vacation_male', 's4q01_vacation_female',
      's4q01_academic_male', 's4q01_academic_female',
      's4q01_professional_male', 's4q01_professional_female',
      's4q01_pre_employment_male', 's4q01_pre_employment_female',
    ]);
  });

  it.each([
    ['S4Q02_RESPONSE_STATUS', 's4q02', 'skill'],
    ['S4Q03_RESPONSE_STATUS', 's4q03', 'training'],
  ])('%s: a slot left at zero needs no description', (statusField, prefix, alias) => {
    // The table opens with every count at 0 and only slot 1 named.
    const flat: Record<string, unknown> = {
      [`${prefix}_${alias}_1_male`]: 2, [`${prefix}_${alias}_1_female`]: 0, [`${prefix}_${alias}_1_total`]: 2,
      [`${prefix}_domain_1_text`]: 'Maconnerie',
      [`${prefix}_${alias}_2_male`]: 0, [`${prefix}_${alias}_2_female`]: 0, [`${prefix}_${alias}_2_total`]: 0,
      [`${prefix}_${alias}_3_male`]: 0, [`${prefix}_${alias}_3_female`]: 0, [`${prefix}_${alias}_3_total`]: 0,
    };
    const keys = expected(statusField, flat);
    expect(keys.filter((k) => k.includes('slot2'))).toEqual([]);
    expect(keys.filter((k) => k.includes('slot3'))).toEqual([]);
    expect(keys).toContain(`${prefix}_slot1_desc`);
  });

  it('S4Q02: a slot with a real figure still needs its description', () => {
    const flat = { s4q02_skill_2_male: 3, s4q02_skill_2_female: 0, s4q02_skill_2_total: 3 };
    expect(expected('S4Q02_RESPONSE_STATUS', flat)).toContain('s4q02_slot2_desc');
  });

  it('S4Q02: a slot that is named but not counted still needs its description', () => {
    const flat = { s4q02_domain_3_text: 'Soudure', s4q02_skill_3_total: 0 };
    expect(expected('S4Q02_RESPONSE_STATUS', flat)).toContain('s4q02_slot3_desc');
  });

  it('S21Q01, which was already right, is unchanged', () => {
    const keys = expected('S21Q01_RESPONSE_STATUS');
    expect(keys).toContain('s21q01_cadres_male_15_24');
    expect(keys).toHaveLength(18);
  });
});
