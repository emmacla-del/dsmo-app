// src/common/normalizers/flat-key-normalizer.ts
//
// ─── PURPOSE ──────────────────────────────────────────────────────────────────
//
// Single source of truth for converting Flutter camelCase keys into the
// schema-registry flat keys that every downstream consumer expects.
//
// This replaces:
//   - flat-to-nested.transformer.ts   (nested DTO builder — wrong output shape)
//   - generic-transformer.ts          (dead code — never imported)
//   - flat-index-builder.ts           (dead code — only used by generic-transformer)
//   - field-mappers.ts                (dead code — only used by flat-index-builder)
//   - field-schema.ts                 (dead code — only used by flat-index-builder)
//
// ─── OUTPUT CONTRACT ──────────────────────────────────────────────────────────
//
// normalizeFlatKeys() returns a FLAT object whose keys are schema-registry IDs:
//
//   S0Q01, S0Q02, S0Q03_TEL1, S0Q03_TEL2, S0Q03_EMAIL
//   COOP_S1Q01 … COOP_S1Q12
//   S1Q01 … S1Q12  (enterprise)
//   CTD_S1Q01 … CTD_S1Q10
//   ONG_S1Q01 … ONG_S1Q11
//   s21q01_cadres_male_15_24  … (all S2–S4 table keys pass through unchanged)
//
// ─── CONSUMERS ────────────────────────────────────────────────────────────────
//
//   1. pdf-data-mapper.service.ts
//        mapCooperativeData(normalized) / mapEnterpriseData(normalized) / …
//        Reads registry keys directly → builds *Rows / *Totals for Handlebars.
//
//   2. questionnaires.service.ts  — DB persistence path
//        a) buildNestedDto(normalized, entityType)
//           → plainToClass → class-validator → Prisma S0/S1 saves
//        b) flatInt(normalized, key) / flatStr(normalized, key)
//           → Prisma S2–S4 table saves (unchanged, keys already correct)
//
// ─── KEY ALIASING RULES ───────────────────────────────────────────────────────
//
//   Priority order (first non-empty value wins):
//     1. Flutter camelCase  (e.g. cooperativeName)
//     2. Snake_case legacy  (e.g. cooperative_name)
//     3. Schema registry    (e.g. COOP_S1Q01)  — pass-through if already correct
//
//   S2–S4 table keys (s21q01_cadres_male_15_24 etc.) are never renamed by
//   Flutter — they pass through the normalizer unchanged.

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * normalizeFlatKeys()
 *
 * Converts a Flutter flat form payload into a canonical flat object whose
 * keys are schema-registry IDs understood by both the PDF mapper and the
 * DB service.
 *
 * @param raw        The raw body.data object as received from Flutter.
 * @param entityType 'cooperative' | 'enterprise' | 'ctd' | 'ong'
 * @returns          Flat object with schema-registry keys.
 */
export function normalizeFlatKeys(
    raw: Record<string, unknown>,
    entityType: string,
): Record<string, unknown> {

    const out: Record<string, unknown> = {
        surveyYear: raw['surveyYear'] ?? new Date().getFullYear(),
        organizationType: entityType,
        formType: entityType,
    };

    // ── S0: Respondent ────────────────────────────────────────────────────────
    set(out, 'S0Q01', pick(raw, 'respondentName', 'S0Q01'));
    set(out, 'S0Q02', pick(raw, 'respondentFunction', 'S0Q02'));
    set(out, 'S0Q03_TEL1', pick(raw, 'respondentPhone1', 'S0Q03_TEL1'));
    set(out, 'S0Q03_TEL2', pick(raw, 'respondentPhone2', 'S0Q03_TEL2'));
    set(out, 'S0Q03_EMAIL', pick(raw, 'respondentEmail', 'S0Q03_EMAIL'));

    // ── S1: Entity identification ─────────────────────────────────────────────
    switch (entityType) {
        case 'cooperative': normalizeCooperativeS1(raw, out); break;
        case 'enterprise': normalizeEnterpriseS1(raw, out); break;
        case 'ctd': normalizeCtdS1(raw, out); break;
        case 'ong': normalizeOngS1(raw, out); break;
    }

    // ── S2–S4: Table keys pass through unchanged ──────────────────────────────
    // Flutter already sends these in registry format (s21q01_cadres_male_15_24).
    // We copy every key that is NOT a camelCase S0/S1 key.
    const s1CamelKeys = new Set(CAMEL_KEY_SET);
    for (const [k, v] of Object.entries(raw)) {
        if (!s1CamelKeys.has(k) && !(k in out)) {
            // Pass through as-is — covers all s21q01_*, s22q01_*, s3q01_*, etc.
            if (v !== undefined && v !== null && v !== '') {
                out[k] = v;
            }
        }
    }

    return out;
}

// ─── S1 Normalizers ───────────────────────────────────────────────────────────

function normalizeCooperativeS1(raw: Record<string, unknown>, out: Record<string, unknown>): void {
    set(out, 'COOP_S1Q01', pick(raw, 'cooperativeName', 'cooperative_name', 'COOP_S1Q01'));
    set(out, 'COOP_S1Q02', pick(raw, 'cooperativeHeadOffice', 'cooperative_head_office', 'COOP_S1Q02'));
    set(out, 'COOP_S1Q03', pick(raw, 'yearCreated', 'cooperativeYearCreated', 'COOP_S1Q03'));
    set(out, 'COOP_S1Q04', pick(raw, 'area', 'COOP_S1Q04'));
    set(out, 'COOP_S1Q05_REGION', pick(raw, 'region', 'cooperative_region', 'COOP_S1Q05_REGION'));
    set(out, 'COOP_S1Q05_DEPT', pick(raw, 'department', 'cooperative_dept', 'COOP_S1Q05_DEPT'));
    set(out, 'COOP_S1Q05_SUBDIV', pick(raw, 'subdivision', 'cooperative_subdiv', 'COOP_S1Q05_SUBDIV'));
    set(out, 'COOP_S1Q05_LOCALITY', pick(raw, 'locality', 'cooperative_locality', 'COOP_S1Q05_LOCALITY'));
    set(out, 'COOP_S1Q06_TEL1', pick(raw, 'phone1', 'COOP_S1Q06_TEL1'));
    set(out, 'COOP_S1Q06_TEL2', pick(raw, 'phone2', 'COOP_S1Q06_TEL2'));
    set(out, 'COOP_S1Q06_BP', pick(raw, 'poBox', 'COOP_S1Q06_BP'));
    set(out, 'COOP_S1Q07', pick(raw, 'businessSector', 'COOP_S1Q07'));
    set(out, 'COOP_S1Q08', pick(raw, 'branchActivity', 'branch', 'COOP_S1Q08'));
    set(out, 'COOP_S1Q09', pick(raw, 'cooperativeMainActivity', 'mainActivity', 'COOP_S1Q09'));
    set(out, 'COOP_S1Q10', pick(raw, 'cooperativeType', 'cooperative_type', 'COOP_S1Q10'));
    set(out, 'COOP_S1Q10_OTHER', pick(raw, 'cooperativeTypeOther', 'typeOther', 'COOP_S1Q10_OTHER'));
    set(out, 'COOP_S1Q11', pick(raw, 'permanentWorkers', 'COOP_S1Q11'));
    set(out, 'COOP_S1Q12', pick(raw, 'vacancies', 'COOP_S1Q12'));
}

function normalizeEnterpriseS1(raw: Record<string, unknown>, out: Record<string, unknown>): void {
    set(out, 'S1Q01', pick(raw, 'legalStatus', 'S1Q01'));
    set(out, 'S1Q02', pick(raw, 'enterpriseName', 'enterprise_name', 'S1Q02'));
    set(out, 'S1Q03', pick(raw, 'area', 'S1Q03'));
    set(out, 'S1Q04_REGION', pick(raw, 'region', 'S1Q04_REGION'));
    set(out, 'S1Q04_DEPT', pick(raw, 'department', 'S1Q04_DEPT'));
    set(out, 'S1Q04_SUBDIV', pick(raw, 'subdivision', 'S1Q04_SUBDIV'));
    set(out, 'S1Q04_LOCALITY', pick(raw, 'locality', 'S1Q04_LOCALITY'));
    set(out, 'S1Q05_TEL1', pick(raw, 'phone1', 'S1Q05_TEL1'));
    set(out, 'S1Q05_TEL2', pick(raw, 'phone2', 'S1Q05_TEL2'));
    set(out, 'S1Q05_BP', pick(raw, 'poBox', 'S1Q05_BP'));
    set(out, 'S1Q06', pick(raw, 'businessSector', 'S1Q06'));
    set(out, 'S1Q07', pick(raw, 'branchActivity', 'branch', 'S1Q07'));
    set(out, 'S1Q08', pick(raw, 'mainActivity', 'S1Q08'));
    set(out, 'S1Q09', pick(raw, 'enterpriseHeadOffice', 'headOffice', 'S1Q09'));
    set(out, 'S1Q10', pick(raw, 'permanentWorkers', 'S1Q10'));
    set(out, 'S1Q11', pick(raw, 'vacancies', 'S1Q11'));
    set(out, 'S1Q12', pick(raw, 'enterpriseSize', 'size', 'S1Q12'));
}

function normalizeCtdS1(raw: Record<string, unknown>, out: Record<string, unknown>): void {
    set(out, 'CTD_S1Q01', pick(raw, 'ctdType', 'ctd_type', 'CTD_S1Q01'));
    set(out, 'CTD_S1Q02', pick(raw, 'councilType', 'council_type', 'CTD_S1Q02'));
    set(out, 'CTD_S1Q03', pick(raw, 'yearCreated', 'ctdYearCreated', 'CTD_S1Q03'));
    set(out, 'CTD_S1Q04', pick(raw, 'area', 'CTD_S1Q04'));
    set(out, 'CTD_S1Q05_REGION', pick(raw, 'region', 'CTD_S1Q05_REGION'));
    set(out, 'CTD_S1Q05_DEPT', pick(raw, 'department', 'CTD_S1Q05_DEPT'));
    set(out, 'CTD_S1Q05_SUBDIV', pick(raw, 'subdivision', 'CTD_S1Q05_SUBDIV'));
    set(out, 'CTD_S1Q05_LOCALITY', pick(raw, 'locality', 'CTD_S1Q05_LOCALITY'));
    set(out, 'CTD_S1Q06_TEL1', pick(raw, 'phone1', 'CTD_S1Q06_TEL1'));
    set(out, 'CTD_S1Q06_TEL2', pick(raw, 'phone2', 'CTD_S1Q06_TEL2'));
    set(out, 'CTD_S1Q06_BP', pick(raw, 'poBox', 'CTD_S1Q06_BP'));
    set(out, 'CTD_S1Q07', pick(raw, 'businessSector', 'CTD_S1Q07'));
    set(out, 'CTD_S1Q08', pick(raw, 'branchActivity', 'branch', 'CTD_S1Q08'));
    set(out, 'CTD_S1Q09', pick(raw, 'permanentWorkers', 'CTD_S1Q09'));
    set(out, 'CTD_S1Q10', pick(raw, 'vacancies', 'CTD_S1Q10'));
}

function normalizeOngS1(raw: Record<string, unknown>, out: Record<string, unknown>): void {
    set(out, 'ONG_S1Q01', pick(raw, 'ongName', 'ong_name', 'ONG_S1Q01'));
    set(out, 'ONG_S1Q02', pick(raw, 'ongHeadOffice', 'headOffice', 'ONG_S1Q02'));
    set(out, 'ONG_S1Q03', pick(raw, 'yearCreated', 'ongYearCreated', 'ONG_S1Q03'));
    set(out, 'ONG_S1Q04', pick(raw, 'area', 'ONG_S1Q04'));
    set(out, 'ONG_S1Q05_REGION', pick(raw, 'region', 'ONG_S1Q05_REGION'));
    set(out, 'ONG_S1Q05_DEPT', pick(raw, 'department', 'ONG_S1Q05_DEPT'));
    set(out, 'ONG_S1Q05_SUBDIV', pick(raw, 'subdivision', 'ONG_S1Q05_SUBDIV'));
    set(out, 'ONG_S1Q05_LOCALITY', pick(raw, 'locality', 'ONG_S1Q05_LOCALITY'));
    set(out, 'ONG_S1Q06_TEL1', pick(raw, 'phone1', 'ONG_S1Q06_TEL1'));
    set(out, 'ONG_S1Q06_TEL2', pick(raw, 'phone2', 'ONG_S1Q06_TEL2'));
    set(out, 'ONG_S1Q06_BP', pick(raw, 'poBox', 'ONG_S1Q06_BP'));
    set(out, 'ONG_S1Q07', pick(raw, 'businessSector', 'ONG_S1Q07'));
    set(out, 'ONG_S1Q08', pick(raw, 'branchActivity', 'branch', 'ONG_S1Q08'));
    set(out, 'ONG_S1Q09', pick(raw, 'ongMainMission', 'mainMission', 'ONG_S1Q09'));
    set(out, 'ONG_S1Q10', pick(raw, 'permanentWorkers', 'ONG_S1Q10'));
    set(out, 'ONG_S1Q11', pick(raw, 'vacancies', 'ONG_S1Q11'));
}

// ─── buildNestedDto ───────────────────────────────────────────────────────────
//
// Converts the normalized flat object into the nested shape that
// plainToClass(CooperativeQuestionnaireDto, …) expects.
//
// This replaces the S0/S1 logic that was in FlatToNestedTransformer.
// Called only by questionnaires.service.ts before DB persistence.

export function buildNestedDto(
    normalized: Record<string, unknown>,
    entityType: string,
): Record<string, unknown> {

    const out: Record<string, unknown> = {
        organizationType: entityType,
        formType: entityType,
        surveyYear: normalized['surveyYear'] ?? new Date().getFullYear(),
    };

    // S0 — respondent
    const respondent: Record<string, unknown> = {};
    setIfPresent(respondent, 'name', normalized['S0Q01']);
    setIfPresent(respondent, 'function', normalized['S0Q02']);
    setIfPresent(respondent, 'phone1', normalized['S0Q03_TEL1']);
    setIfPresent(respondent, 'phone2', normalized['S0Q03_TEL2']);
    setIfPresent(respondent, 'email', normalized['S0Q03_EMAIL']);
    if (Object.keys(respondent).length > 0) out['respondent'] = respondent;

    // S1 — entity identification (nested DTO shape)
    switch (entityType) {
        case 'cooperative': out['cooperative'] = buildCooperativeDto(normalized); break;
        case 'enterprise': out['enterprise'] = buildEnterpriseDto(normalized); break;
        case 'ctd': out['ctd'] = buildCtdDto(normalized); break;
        case 'ong': out['ong'] = buildOngDto(normalized); break;
    }

    // S2–S4 — kept as nested structures for DTO validation compatibility
    // (these mirror what FlatToNestedTransformer used to build)
    out['jobApplications'] = buildCspTable(normalized, 's21q01');
    out['recruitmentsPermanent'] = buildCspTable(normalized, 's22q01');
    out['recruitmentsTemporary'] = buildCspTable(normalized, 's22q02');
    out['recruitmentsByDiploma'] = buildDiplomaTable(normalized);
    out['disabledRecruitments'] = buildPermTempTable(normalized, 's22q04');
    out['vulnerableRecruitments'] = buildVulnerableTable(normalized, entityType);
    out['firstTimeJobSeekers'] = buildCspTable(normalized, 's23q01');
    out['firstTimeRecruitments'] = buildFirstTimeTable(normalized);
    out['departures'] = buildDeparturesTable(normalized);
    out['dismissalReasons'] = buildDismissalReasons(normalized);
    out['dismissalTechUnemployment'] = buildDismissalTechTable(normalized);
    out['internships'] = buildInternshipsTable(normalized);
    out['skillsNeeds'] = buildSkillsNeeds(normalized);
    out['trainingNeeds'] = buildTrainingNeeds(normalized);

    return out;
}

// ─── Nested DTO builders (S1) ─────────────────────────────────────────────────

function buildCooperativeDto(n: Record<string, unknown>): Record<string, unknown> {
    const r: Record<string, unknown> = {};
    setIfPresent(r, 'name', n['COOP_S1Q01']);
    setIfPresent(r, 'headOffice', n['COOP_S1Q02']);
    setNum(r, 'yearCreated', n['COOP_S1Q03']);
    setNum(r, 'area', n['COOP_S1Q04'], mapArea);
    setIfPresent(r, 'region', n['COOP_S1Q05_REGION']);
    setIfPresent(r, 'department', n['COOP_S1Q05_DEPT']);
    setIfPresent(r, 'subdivision', n['COOP_S1Q05_SUBDIV']);
    setIfPresent(r, 'locality', n['COOP_S1Q05_LOCALITY']);
    setIfPresent(r, 'phone1', n['COOP_S1Q06_TEL1']);
    setIfPresent(r, 'phone2', n['COOP_S1Q06_TEL2']);
    setIfPresent(r, 'poBox', n['COOP_S1Q06_BP']);
    setNum(r, 'sector', n['COOP_S1Q07'], mapSector);
    setIfPresent(r, 'branch', n['COOP_S1Q08']);
    setIfPresent(r, 'mainActivity', n['COOP_S1Q09']);
    setNum(r, 'type', n['COOP_S1Q10'], mapCooperativeType);
    setIfPresent(r, 'typeOther', n['COOP_S1Q10_OTHER']);
    setNum(r, 'permanentWorkers', n['COOP_S1Q11']);
    setNum(r, 'vacancies', n['COOP_S1Q12']);
    return r;
}

function buildEnterpriseDto(n: Record<string, unknown>): Record<string, unknown> {
    const r: Record<string, unknown> = {};
    setNum(r, 'legalStatus', n['S1Q01'], mapLegalStatus);
    setIfPresent(r, 'name', n['S1Q02']);
    setNum(r, 'area', n['S1Q03'], mapArea);
    setIfPresent(r, 'region', n['S1Q04_REGION']);
    setIfPresent(r, 'department', n['S1Q04_DEPT']);
    setIfPresent(r, 'subdivision', n['S1Q04_SUBDIV']);
    setIfPresent(r, 'locality', n['S1Q04_LOCALITY']);
    setIfPresent(r, 'phone1', n['S1Q05_TEL1']);
    setIfPresent(r, 'phone2', n['S1Q05_TEL2']);
    setIfPresent(r, 'poBox', n['S1Q05_BP']);
    setNum(r, 'sector', n['S1Q06'], mapSector);
    setIfPresent(r, 'branch', n['S1Q07']);
    setIfPresent(r, 'mainActivity', n['S1Q08']);
    setIfPresent(r, 'headOffice', n['S1Q09']);
    setNum(r, 'permanentWorkers', n['S1Q10']);
    setNum(r, 'vacancies', n['S1Q11']);
    setNum(r, 'size', n['S1Q12'], mapSize);
    return r;
}

function buildCtdDto(n: Record<string, unknown>): Record<string, unknown> {
    const r: Record<string, unknown> = {};
    setNum(r, 'type', n['CTD_S1Q01'], mapCtdType);
    setNum(r, 'councilType', n['CTD_S1Q02'], mapCouncilType);
    setNum(r, 'yearCreated', n['CTD_S1Q03']);
    setNum(r, 'area', n['CTD_S1Q04'], mapArea);
    setIfPresent(r, 'region', n['CTD_S1Q05_REGION']);
    setIfPresent(r, 'department', n['CTD_S1Q05_DEPT']);
    setIfPresent(r, 'subdivision', n['CTD_S1Q05_SUBDIV']);
    setIfPresent(r, 'locality', n['CTD_S1Q05_LOCALITY']);
    setIfPresent(r, 'phone1', n['CTD_S1Q06_TEL1']);
    setIfPresent(r, 'phone2', n['CTD_S1Q06_TEL2']);
    setIfPresent(r, 'poBox', n['CTD_S1Q06_BP']);
    setNum(r, 'sector', n['CTD_S1Q07'], mapSector);
    setIfPresent(r, 'branch', n['CTD_S1Q08']);
    setNum(r, 'permanentWorkers', n['CTD_S1Q09']);
    setNum(r, 'vacancies', n['CTD_S1Q10']);
    return r;
}

function buildOngDto(n: Record<string, unknown>): Record<string, unknown> {
    const r: Record<string, unknown> = {};
    setIfPresent(r, 'name', n['ONG_S1Q01']);
    setIfPresent(r, 'headOffice', n['ONG_S1Q02']);
    setNum(r, 'yearCreated', n['ONG_S1Q03']);
    setNum(r, 'area', n['ONG_S1Q04'], mapArea);
    setIfPresent(r, 'region', n['ONG_S1Q05_REGION']);
    setIfPresent(r, 'department', n['ONG_S1Q05_DEPT']);
    setIfPresent(r, 'subdivision', n['ONG_S1Q05_SUBDIV']);
    setIfPresent(r, 'locality', n['ONG_S1Q05_LOCALITY']);
    setIfPresent(r, 'phone1', n['ONG_S1Q06_TEL1']);
    setIfPresent(r, 'phone2', n['ONG_S1Q06_TEL2']);
    setIfPresent(r, 'poBox', n['ONG_S1Q06_BP']);
    setNum(r, 'sector', n['ONG_S1Q07'], mapSector);
    setIfPresent(r, 'branch', n['ONG_S1Q08']);
    setIfPresent(r, 'mainMission', n['ONG_S1Q09']);
    setNum(r, 'permanentWorkers', n['ONG_S1Q10']);
    setNum(r, 'vacancies', n['ONG_S1Q11']);
    return r;
}

// ─── Nested DTO builders (S2–S4) ──────────────────────────────────────────────
// Mirror the shape FlatToNestedTransformer used to produce for DTO validation.

function buildCspTable(n: Record<string, unknown>, prefix: string): Record<string, unknown> {
    const rows = ['executives', 'foremen', 'fieldWorkers'] as const;
    const rowKeys = ['cadres', 'foremen', 'workers'] as const;
    const genders = ['male', 'female', 'total'] as const;
    const ageBands = [
        { flatKey: '15_24', dtoKey: 'age15_24' },
        { flatKey: '25_34', dtoKey: 'age25_34' },
        { flatKey: '35_plus', dtoKey: 'age35plus' },
    ];
    const result: Record<string, unknown> = {};

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowKey = rowKeys[i];
        const rowObj: Record<string, unknown> = {};
        for (const gender of genders) {
            const genderObj: Record<string, unknown> = {};
            for (const { flatKey, dtoKey } of ageBands) {
                genderObj[dtoKey] = toInt(n[`${prefix}_${rowKey}_${gender}_${flatKey}`]);
            }
            genderObj['total'] = toInt(n[`${prefix}_${rowKey}_${gender}_total`]);
            rowObj[gender] = genderObj;
        }
        result[row] = rowObj;
    }

    // Grand total row
    const totalObj: Record<string, unknown> = {};
    for (const gender of genders) {
        const genderObj: Record<string, unknown> = {};
        for (const { flatKey, dtoKey } of ageBands) {
            genderObj[dtoKey] = toInt(n[`${prefix}_total_${gender}_${flatKey}`]);
        }
        genderObj['total'] = toInt(n[`${prefix}_total_${gender}_total`]);
        totalObj[gender] = genderObj;
    }
    result['total'] = totalObj;

    return result;
}

function buildDiplomaTable(n: Record<string, unknown>): Record<string, unknown> {
    const diplomas = [
        { key: 'cepCepe', flatKey: 'cep' },
        { key: 'bepcCap', flatKey: 'bepc' },
        { key: 'probatoire', flatKey: 'probatoire' },
        { key: 'bac', flatKey: 'bac' },
        { key: 'btsDut', flatKey: 'bts' },
        { key: 'licence', flatKey: 'licence' },
        { key: 'maitrise', flatKey: 'maitrise' },
        { key: 'master', flatKey: 'master' },
        { key: 'dqp', flatKey: 'dqp' },
        { key: 'cqp', flatKey: 'cqp' },
        { key: 'autres', flatKey: 'autres' },
        { key: 'sansDiplome', flatKey: 'sans_diplome' },
    ];
    const genders = ['male', 'female', 'total'] as const;
    const ageBands = [
        { flatKey: '15_24', dtoKey: 'age15_24' },
        { flatKey: '25_34', dtoKey: 'age25_34' },
        { flatKey: '35_plus', dtoKey: 'age35plus' },
    ];
    const prefix = 's22q03';
    const result: Record<string, unknown> = {};

    for (const diploma of diplomas) {
        const diplomaObj: Record<string, unknown> = {};
        for (const gender of genders) {
            const genderObj: Record<string, unknown> = {};
            for (const { flatKey, dtoKey } of ageBands) {
                genderObj[dtoKey] = toInt(n[`${prefix}_${diploma.flatKey}_${gender}_${flatKey}`]);
            }
            genderObj['total'] = toInt(n[`${prefix}_${diploma.flatKey}_${gender}_total`]);
            diplomaObj[gender] = genderObj;
        }
        result[diploma.key] = diplomaObj;
    }
    return result;
}

function buildPermTempTable(n: Record<string, unknown>, prefix: string): Record<string, unknown> {
    const rows = ['executives', 'foremen', 'fieldWorkers', 'total'] as const;
    const rowKeys = ['cadres', 'foremen', 'workers', 'total'] as const;
    const statuses = ['permanent', 'temporary', 'total'] as const;
    const genders = ['male', 'female', 'total'] as const;
    const result: Record<string, unknown> = {};

    for (let i = 0; i < rows.length; i++) {
        const rowObj: Record<string, unknown> = {};
        for (const status of statuses) {
            const statusObj: Record<string, unknown> = {};
            for (const gender of genders) {
                statusObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${status}_${gender}`]);
            }
            rowObj[status] = statusObj;
        }
        result[rows[i]] = rowObj;
    }
    return result;
}

function buildVulnerableTable(n: Record<string, unknown>, entityType: string): Record<string, unknown> {
    const prefix = entityType === 'enterprise' ? 's22q05_ent' : 's22q05_oth';
    const rows = ['internalDisplaced', 'refugees', 'orphans', 'total'] as const;
    const rowKeys = ['deplaces_internes', 'refugies', 'orphelins', 'total'] as const;
    const statuses = ['permanent', 'temporary', 'total'] as const;
    const genders = ['male', 'female', 'total'] as const;
    const result: Record<string, unknown> = {};

    for (let i = 0; i < rows.length; i++) {
        const rowObj: Record<string, unknown> = {};
        for (const status of statuses) {
            const statusObj: Record<string, unknown> = {};
            for (const gender of genders) {
                statusObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${status}_${gender}`]);
            }
            rowObj[status] = statusObj;
        }
        result[rows[i]] = rowObj;
    }
    return result;
}

function buildFirstTimeTable(n: Record<string, unknown>): Record<string, unknown> {
    const prefix = 's23q02';
    const contracts = ['permanent', 'temporary'] as const;
    const rows = ['executives', 'foremen', 'fieldWorkers'] as const;
    const rowKeys = ['cadres', 'foremen', 'workers'] as const;
    const genders = ['male', 'female', 'total'] as const;
    const ageBands = [
        { flatKey: '15_24', dtoKey: 'age15_24' },
        { flatKey: '25_34', dtoKey: 'age25_34' },
        { flatKey: '35_plus', dtoKey: 'age35plus' },
    ];
    const result: Record<string, unknown> = {};

    for (const contract of contracts) {
        const contractObj: Record<string, unknown> = {};
        for (let i = 0; i < rows.length; i++) {
            const rowObj: Record<string, unknown> = {};
            for (const gender of genders) {
                const genderObj: Record<string, unknown> = {};
                for (const { flatKey, dtoKey } of ageBands) {
                    genderObj[dtoKey] = toInt(n[`${prefix}_${contract}_${rowKeys[i]}_${gender}_${flatKey}`]);
                }
                genderObj['total'] = toInt(n[`${prefix}_${contract}_${rowKeys[i]}_${gender}_total`]);
                rowObj[gender] = genderObj;
            }
            contractObj[rows[i]] = rowObj;
        }
        // subtotal per contract
        const subObj: Record<string, unknown> = {};
        for (const gender of genders) {
            const genderObj: Record<string, unknown> = {};
            for (const { flatKey, dtoKey } of ageBands) {
                genderObj[dtoKey] = toInt(n[`${prefix}_${contract}_subtotal_${gender}_${flatKey}`]);
            }
            genderObj['total'] = toInt(n[`${prefix}_${contract}_subtotal_${gender}_total`]);
            subObj[gender] = genderObj;
        }
        contractObj['subtotal'] = subObj;
        result[contract] = contractObj;
    }

    // Grand total — key is 'grandtotal' in flat, 'total' in DTO
    const totalObj: Record<string, unknown> = {};
    for (const gender of genders) {
        const genderObj: Record<string, unknown> = {};
        for (const { flatKey, dtoKey } of ageBands) {
            genderObj[dtoKey] = toInt(n[`${prefix}_grandtotal_${gender}_${flatKey}`]);
        }
        genderObj['total'] = toInt(n[`${prefix}_grandtotal_${gender}_total`]);
        totalObj[gender] = genderObj;
    }
    result['total'] = totalObj;

    return result;
}

function buildDeparturesTable(n: Record<string, unknown>): Record<string, unknown> {
    const prefix = 's3q01';
    const rows = ['executives', 'foremen', 'fieldWorkers', 'total'] as const;
    const rowKeys = ['cadres', 'foremen', 'workers', 'total'] as const;
    const types = ['dismissals', 'resignations', 'retirements', 'others', 'ensemble'] as const;
    const typeKeys = ['dismissal', 'resignation', 'retirement', 'other', 'ensemble'] as const;
    const genders = ['male', 'female', 'total'] as const;
    const result: Record<string, unknown> = {};

    for (let i = 0; i < rows.length; i++) {
        const rowObj: Record<string, unknown> = {};
        for (let t = 0; t < types.length; t++) {
            const typeObj: Record<string, unknown> = {};
            for (const gender of genders) {
                typeObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${typeKeys[t]}_${gender}`]);
            }
            rowObj[types[t]] = typeObj;
        }
        result[rows[i]] = rowObj;
    }
    return result;
}

function buildDismissalReasons(n: Record<string, unknown>): unknown[] {
    const reasons: unknown[] = [];
    for (let i = 1; i <= 3; i++) {
        const text = n[`s3q02_reason_${i}_text`];
        const male = toInt(n[`s3q02_reason_${i}_male`]);
        const female = toInt(n[`s3q02_reason_${i}_female`]);
        const total = toInt(n[`s3q02_reason_${i}_total`]);
        const r: Record<string, unknown> = {};
        if (text) r['text'] = text;
        if (male !== 0) r['male'] = male;
        if (female !== 0) r['female'] = female;
        if (total !== 0) r['total'] = total;
        if (Object.keys(r).length > 0) reasons.push(r);
    }
    return reasons;
}

function buildDismissalTechTable(n: Record<string, unknown>): Record<string, unknown> {
    const prefix = 's3q03';
    const rows = ['executives', 'foremen', 'fieldWorkers', 'total'] as const;
    const rowKeys = ['cadres', 'foremen', 'workers', 'total'] as const;
    const types = ['dismissal', 'technicalUnemployment', 'total'] as const;
    const typeKeys = ['dismissal', 'technical_unemployment', 'total'] as const;
    const genders = ['male', 'female', 'total'] as const;
    const result: Record<string, unknown> = {};

    for (let i = 0; i < rows.length; i++) {
        const rowObj: Record<string, unknown> = {};
        for (let t = 0; t < types.length; t++) {
            const typeObj: Record<string, unknown> = {};
            for (const gender of genders) {
                typeObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${typeKeys[t]}_${gender}`]);
            }
            rowObj[types[t]] = typeObj;
        }
        result[rows[i]] = rowObj;
    }
    return result;
}

function buildInternshipsTable(n: Record<string, unknown>): Record<string, unknown> {
    const prefix = 's4q01';
    const rows = ['holiday', 'academic', 'professional', 'preWork', 'total'] as const;
    const rowKeys = ['vacation', 'academic', 'professional', 'pre_employment', 'total'] as const;
    const genders = ['male', 'female', 'total'] as const;
    const result: Record<string, unknown> = {};

    for (let i = 0; i < rows.length; i++) {
        const rowObj: Record<string, unknown> = {};
        for (const gender of genders) {
            rowObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${gender}`]);
        }
        result[rows[i]] = rowObj;
    }
    return result;
}

function buildSkillsNeeds(n: Record<string, unknown>): unknown[] {
    const skills: unknown[] = [];
    for (let i = 1; i <= 3; i++) {
        const description = n[`s4q02_skill_${i}_text`];
        const male = toInt(n[`s4q02_skill_${i}_male`]);
        const female = toInt(n[`s4q02_skill_${i}_female`]);
        const total = toInt(n[`s4q02_skill_${i}_total`]);
        const s: Record<string, unknown> = {};
        if (description) s['description'] = description;
        if (male !== 0) s['male'] = male;
        if (female !== 0) s['female'] = female;
        if (total !== 0) s['total'] = total;
        if (Object.keys(s).length > 0) skills.push(s);
    }
    return skills;
}

function buildTrainingNeeds(n: Record<string, unknown>): unknown[] {
    const trainings: unknown[] = [];
    for (let i = 1; i <= 3; i++) {
        const domain = n[`s4q03_domain_${i}_text`];
        const male = toInt(n[`s4q03_domain_${i}_male`]);
        const female = toInt(n[`s4q03_domain_${i}_female`]);
        const total = toInt(n[`s4q03_domain_${i}_total`]);
        const t: Record<string, unknown> = {};
        if (domain) t['domain'] = domain;
        if (male !== 0) t['male'] = male;
        if (female !== 0) t['female'] = female;
        if (total !== 0) t['total'] = total;
        if (Object.keys(t).length > 0) trainings.push(t);
    }
    return trainings;
}

// ─── Enum mappers ─────────────────────────────────────────────────────────────

function mapLegalStatus(v: string): number {
    if (!v) return 0;
    if (v.includes('unipersonnelle')) return 1;
    if (v.includes('SARL')) return 2;
    if (v.includes('SA')) return 3;
    if (v.includes('Autres')) return 4;
    return 0;
}

function mapArea(v: string): number {
    if (!v) return 0;
    const lv = v.toLowerCase();
    if (lv.includes('urbain') || lv.includes('urban')) return 1;
    if (lv.includes('rural')) return 2;
    return 0;
}

function mapSector(v: string): number {
    if (!v) return 0;
    const lv = v.toLowerCase();
    if (lv === '1' || lv.includes('primaire') || lv.includes('primary')) return 1;
    if (lv === '2' || lv.includes('secondaire') || lv.includes('secondary')) return 2;
    if (lv === '3' || lv.includes('tertiaire') || lv.includes('tertiary')) return 3;
    return 0;
}

function mapSize(v: string): number {
    if (!v) return 0;
    if (v.includes('TPE')) return 1;
    if (v.includes('GE')) return 4;
    if (v.includes('ME')) return 3;
    if (v.includes('PE')) return 2;
    return 0;
}

function mapCooperativeType(v: string): number {
    if (!v) return 0;
    if (v === '1' || v.includes('simplifiée')) return 1;
    if (v === '2' || v.includes("conseil d'administration")) return 2;
    if (v === '3' || v.includes('Autre')) return 3;
    return 0;
}

function mapCtdType(v: string): number {
    if (!v) return 0;
    if (v.includes('Commune')) return 2;
    if (v.includes('Région')) return 1;
    return 0;
}

function mapCouncilType(v: string): number {
    if (!v) return 0;
    if (v.includes('Arrondissement')) return 1;
    if (v.includes('Urbaine')) return 2;
    return 0;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Returns the first non-empty value from the given keys in order. */
function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
    for (const key of keys) {
        const v = raw[key];
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
}

/** Writes value to out[key] only if value is non-empty. */
function set(out: Record<string, unknown>, key: string, value: unknown): void {
    if (value !== undefined && value !== null && value !== '') {
        out[key] = value;
    }
}

/** Writes value to out[key] only if value is non-empty (alias for readability). */
function setIfPresent(out: Record<string, unknown>, key: string, value: unknown): void {
    set(out, key, value);
}

/** Converts value to number via optional mapper, writes only if result !== 0. */
function setNum(
    out: Record<string, unknown>,
    key: string,
    value: unknown,
    mapper?: (s: string) => number,
): void {
    if (value === undefined || value === null) return;
    let n: number;
    if (typeof value === 'number') {
        n = value;
    } else if (mapper && typeof value === 'string') {
        n = mapper(value);
    } else {
        n = parseInt(String(value), 10);
        if (isNaN(n)) return;
    }
    if (n !== 0) out[key] = n;
}

/** Coerces any value to a non-negative integer, defaulting to 0. */
function toInt(value: unknown): number {
    if (typeof value === 'number') return value;
    if (value === undefined || value === null || value === '') return 0;
    const n = parseInt(String(value), 10);
    return isNaN(n) ? 0 : n;
}

/**
 * All Flutter camelCase / snake_case S0–S1 field names.
 * Used by the pass-through loop to avoid duplicating them
 * as raw table keys in the output.
 */
const CAMEL_KEY_SET = new Set([
    // S0
    'respondentName', 'respondentFunction', 'respondentPhone1',
    'respondentPhone2', 'respondentEmail',
    // S1 shared
    'region', 'department', 'subdivision', 'locality',
    'phone1', 'phone2', 'poBox', 'businessSector',
    'branchActivity', 'branch', 'area', 'yearCreated',
    'permanentWorkers', 'vacancies',
    // Enterprise
    'legalStatus', 'enterpriseName', 'enterprise_name',
    'mainActivity', 'enterpriseHeadOffice', 'headOffice',
    'enterpriseSize', 'size',
    // Cooperative
    'cooperativeName', 'cooperative_name',
    'cooperativeHeadOffice', 'cooperative_head_office',
    'cooperativeMainActivity', 'cooperativeYearCreated',
    'cooperativeType', 'cooperative_type',
    'cooperativeTypeOther', 'typeOther',
    'cooperative_region', 'cooperative_dept',
    'cooperative_subdiv', 'cooperative_locality',
    // CTD
    'ctdType', 'ctd_type', 'councilType', 'council_type', 'ctdYearCreated',
    // ONG
    'ongName', 'ong_name', 'ongHeadOffice', 'ongMainMission',
    'mainMission', 'ongYearCreated',
    // Meta
    'surveyYear', 'organizationType', 'formType', 'entityType',
    'isDraft', 'userId', 'formId',
]);