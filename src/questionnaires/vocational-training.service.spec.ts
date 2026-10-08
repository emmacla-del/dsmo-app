import { normalizeFlatKeys, buildNestedDto } from '../common/normalizers/flat-key-normalizer';

// VT-4 structural coverage — normalizer round-trip only. Mirrors
// project-program.service.spec.ts's "flat-key-normalizer — Projects &
// Programs" describe block: exercises normalizeFlatKeys -> buildNestedDto
// directly, not QuestionnairesService/persistence (out of scope for VT-4).
describe('flat-key-normalizer — Vocational Training', () => {
  // A. Detail smoke test — representative flat keys across several
  // sections map to the correct vocationalTrainingDetail fields, and the
  // critical respondentSex/respondent.* split holds.
  it('maps representative VT flat keys to vocationalTrainingDetail, with respondentSex on Detail only', () => {
    const raw = {
      VT1_1: 'CFP-001',
      VT1_2: 'Centre Test',
      VT1_9: 'Urbain/ Urban',
      VT1_15_NAME: 'Jean Dupont',
      VT1_15_FUNCTION: 'Directeur',
      VT1_15_TEL1: '677123456',
      VT1_15_EMAIL: 'jean@test.cm',
      VT1_15_SEX: 'Féminin',
      VT2_1: 'Oui/ Yes',
      VT6_3: 'Oui/ Yes',
      VT6_4: 'Non/ No',
    };
    const normalized = normalizeFlatKeys(raw, 'vocationalTraining');
    const nested = buildNestedDto(normalized, 'vocationalTraining');
    const detail = nested['vocationalTraining'] as Record<string, unknown>;

    expect(detail['structureCode']).toBe('CFP-001');
    expect(detail['name']).toBe('Centre Test');
    expect(detail['area']).toBe('Urbain/ Urban');
    expect(detail['hasStateAgreement']).toBe(true);

    // Critical rule: respondentSex -> vocationalTrainingDetail.respondentSex only.
    expect(detail['respondentSex']).toBe('Féminin');

    // §1.15 name/function/phones go through the shared respondent.* path,
    // NOT vocationalTrainingDetail — same OnefopRespondent target every
    // other entity uses.
    expect(detail['respondentSex']).not.toBe('Jean Dupont');
    const respondent = nested['respondent'] as Record<string, unknown>;
    expect(respondent).toEqual({
      name: 'Jean Dupont',
      function: 'Directeur',
      phone1: '677123456',
      email: 'jean@test.cm',
    });

    // 6.1.2 -> the two frozen Detail booleans.
    expect(detail['traineesChooseWithSupport']).toBe(true);
    expect(detail['collaboratesWithCiopCosup']).toBe(false);
  });

  // Items printed on the ASFOP 2025-2026 form that were added to the
  // questionnaire: 2.1.10 Ville, the 7.1.3 Oui/Non and the 7.6 domains.
  it('maps the 2.1.10 city, the 7.1.3 Oui/Non and the 7.6 domains to the Detail', () => {
    const raw = {
      VT2_11: '1234',
      VT2_11_CITY: 'Bafoussam',
      VT7_1: 'Oui/ Yes',
      VT7_6_INFORMED: 'Oui/ Yes',
      VT7_20: 'Oui/ Yes',
      VT7_20_DOMAINS: ['Scolaire/ School', 'Professionnel/ Professional'],
    };
    const detail = buildNestedDto(normalizeFlatKeys(raw, 'vocationalTraining'), 'vocationalTraining')[
      'vocationalTraining'
    ] as Record<string, unknown>;
    expect(detail['poBox']).toBe('1234');
    expect(detail['poBoxCity']).toBe('Bafoussam');
    expect(detail['stakeholdersInformed']).toBe(true);
    expect(detail['trainersSexEdDomains']).toEqual(['Scolaire/ School', 'Professionnel/ Professional']);

    const empty = buildNestedDto(normalizeFlatKeys({}, 'vocationalTraining'), 'vocationalTraining')[
      'vocationalTraining'
    ] as Record<string, unknown>;
    expect(empty['stakeholdersInformed']).toBeUndefined();
    expect(empty['trainersSexEdDomains']).toEqual([]);
  });

  // §7.1.3 — missing/unselected ticks produce [], never null/omitted.
  it('defaults all five §7.1.3 comms-channel fields to [] when nothing was sent, no channel enum', () => {
    const nested = buildNestedDto(normalizeFlatKeys({}, 'vocationalTraining'), 'vocationalTraining');
    const detail = nested['vocationalTraining'] as Record<string, unknown>;
    expect(detail['pupilsCommsChannels']).toEqual([]);
    expect(detail['teachingStaffCommsChannels']).toEqual([]);
    expect(detail['nonTeachingStaffCommsChannels']).toEqual([]);
    expect(detail['parentsCommsChannels']).toEqual([]);
    expect(detail['schoolCouncilCommsChannels']).toEqual([]);
  });

  // B. One diploma grid — 4.1 (trainee academic diplomas).
  it('normalizes a 4.1 diploma cell into a correct OnefopVtDiplomaData row', () => {
    const raw = { s4q1_licence_male: '7' };
    const normalized = normalizeFlatKeys(raw, 'vocationalTraining');
    const nested = buildNestedDto(normalized, 'vocationalTraining');
    const diplomaData = nested['diplomaData'] as Record<string, unknown>[];
    expect(diplomaData).toEqual([
      { personType: 'TRAINEE', diplomaKind: 'ACADEMIC', diploma: 'LICENCE', gender: 'MALE', value: 7 },
    ]);
  });

  // C. One specialty table — 4.3, three tableCodes never merged, named
  // columns only, no cell1..cell4.
  it('normalizes a 4.3 specialty row with the correct tableCode, specialtyText, and named columns', () => {
    const raw = {
      s4q3_row1_specialtyText: 'Coupe-Couture',
      s4q3_row1_fiMale: '5',
      s4q3_row1_fiFemale: '8',
    };
    const normalized = normalizeFlatKeys(raw, 'vocationalTraining');
    const nested = buildNestedDto(normalized, 'vocationalTraining');
    const specialtyRows = nested['specialtyRows'] as Record<string, unknown>[];
    expect(specialtyRows).toEqual([
      { tableCode: '4.3', rowIndex: 1, fiMale: 5, fiFemale: 8, specialtyText: 'Coupe-Couture' },
    ]);
    expect(specialtyRows[0]).not.toHaveProperty('cell1');
    expect(specialtyRows[0]).not.toHaveProperty('cell2');
    expect(specialtyRows[0]).not.toHaveProperty('cell3');
    expect(specialtyRows[0]).not.toHaveProperty('cell4');
  });

  it('4.3, 4.4 and 4.5 remain three distinct tableCodes, never merged, even with identical row shape', () => {
    const raw = {
      s4q3_row1_fiMale: '1',
      s4q4_row1_fiMale: '2',
      s4q5_row1_fiMale: '3',
    };
    const normalized = normalizeFlatKeys(raw, 'vocationalTraining');
    const nested = buildNestedDto(normalized, 'vocationalTraining');
    const tableCodes = (nested['specialtyRows'] as Record<string, unknown>[]).map((r) => r['tableCode']);
    expect(tableCodes.sort()).toEqual(['4.3', '4.4', '4.5']);
  });

  it('skips an empty specialty row (no specialtyText, no numeric value)', () => {
    const raw = { s4q3_row2_specialtyText: '   ' };
    const normalized = normalizeFlatKeys(raw, 'vocationalTraining');
    const nested = buildNestedDto(normalized, 'vocationalTraining');
    expect(nested['specialtyRows']).toEqual([]);
  });

  // D. Empty roster rows are skipped; a filled row keeps its rowIndex and
  // named-person shape. A row is persistable only when it has a usable
  // name (VT-7 Finding 1) — VtTrainerRosterDto/OnefopVtTrainerRoster both
  // require lastName/firstName (Prisma NOT NULL), so a row with other
  // cells filled but no name can never actually be created; it must be
  // dropped here rather than reach createMany (previously this asserted
  // the opposite — that a nameless {rowIndex, sex} row survived, which is
  // exactly the shape that used to 400 a final submission or throw an
  // unhandled Prisma error on a draft).
  it('skips empty 8.8 roster rows and keeps filled ones with 1-based rowIndex', () => {
    const raw = {
      s8q8_row1_lastName: 'Ateba',
      s8q8_row1_firstName: 'Paul',
      s8q8_row1_academicDiploma: 'LICENCE',
      // row 2 entirely empty — must be dropped
      s8q8_row3_sex: 'M', // no name — must also be dropped
    };
    const normalized = normalizeFlatKeys(raw, 'vocationalTraining');
    const nested = buildNestedDto(normalized, 'vocationalTraining');
    const roster = nested['trainerRoster'] as Record<string, unknown>[];
    expect(roster.length).toBe(1);
    expect(roster[0]).toEqual({ rowIndex: 1, lastName: 'Ateba', firstName: 'Paul', academicDiploma: 'LICENCE' });
  });

  it('drops a roster row that has other cells filled but no usable name, while a '
    + 'named row in the same submission still persists (VT-7 Finding 1)', () => {
    const raw = {
      // row 1: sex/status/diploma filled, both names blank — must be dropped.
      s8q8_row1_sex: 'F',
      s8q8_row1_trainerStatus: '3',
      s8q8_row1_isAdminPersonnel: 'Non',
      s8q8_row1_professionalDiploma: 'CAP',
      // row 2: only firstName set — a usable name, so this must survive.
      s8q8_row2_firstName: 'Marie',
    };
    const normalized = normalizeFlatKeys(raw, 'vocationalTraining');
    const nested = buildNestedDto(normalized, 'vocationalTraining');
    const roster = nested['trainerRoster'] as Record<string, unknown>[];
    expect(roster).toEqual([{ rowIndex: 2, firstName: 'Marie' }]);
  });

  it('drops an 8.8 roster row whose academicDiploma or professionalDiploma is TOTAL', () => {
    const raw = {
      s8q8_row1_lastName: 'Ateba',
      s8q8_row1_academicDiploma: 'TOTAL',
      s8q8_row2_lastName: 'Biya',
      s8q8_row2_professionalDiploma: 'TOTAL',
    };
    const normalized = normalizeFlatKeys(raw, 'vocationalTraining');
    const nested = buildNestedDto(normalized, 'vocationalTraining');
    expect(nested['trainerRoster']).toEqual([]);
  });

  // E. §4.12 is absent — no field anywhere in this codebase's Prisma
  // schema, DTOs, or AST exists for it (design note Decision 1, frozen),
  // so no normalizer mapping targets it either, under any input shape.
  it('never produces a 4.12 mapping or output, regardless of input', () => {
    const raw = {
      '4.12': 'stray value',
      VT4_12: 'stray value',
      s4q12_anything: 'stray value',
    };
    const normalized = normalizeFlatKeys(raw, 'vocationalTraining');
    const nested = buildNestedDto(normalized, 'vocationalTraining');
    const detail = nested['vocationalTraining'] as Record<string, unknown>;

    // No field on the built Detail payload is derived from, or named
    // after, 4.12 — the normalizer has no code path that reads these keys.
    expect(Object.keys(detail).some((k) => k.toLowerCase().includes('412'))).toBe(false);
    expect(detail).not.toHaveProperty('4.12');

    // Nor does any child-table array contain a 4.12-tagged row.
    expect(nested['specialtyRows']).toEqual([]);
  });

  it('regression: administration/enterprise normalization unaffected', () => {
    const normalized = normalizeFlatKeys({ hasProject: 'Oui/ Yes' }, 'administration');
    expect(normalized['ADMIN_S1Q09']).toBe('Oui/ Yes');
    const nested = buildNestedDto(normalized, 'administration');
    expect((nested['administration'] as any).hasProject).toBe(1);
  });

  it('regression: projectProgram normalization unaffected', () => {
    const normalized = normalizeFlatKeys({ nature: '2', projectProgramName: 'Programme Test' }, 'projectProgram');
    expect(normalized['PP_S1Q02']).toBe('Programme Test');
    const nested = buildNestedDto(normalized, 'projectProgram');
    expect((nested['projectProgram'] as any).name).toBe('Programme Test');
  });
});
