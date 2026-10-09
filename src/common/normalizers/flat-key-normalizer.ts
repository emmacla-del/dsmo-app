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
 * @param entityType 'cooperative' | 'entreprise' | 'ctd' | 'ong' (lowercase French spelling -- matches normalizedEntityType.toLowerCase())
 * @returns          Flat object with schema-registry keys.
 */
export function normalizeFlatKeys(
    raw: Record<string, unknown>,
    entityType: string,
): Record<string, unknown> {

    const out: Record<string, unknown> = {
        // Left as-is (undefined unless the client explicitly sent one) —
        // filling it in with `new Date()` here would bake in whatever day
        // this happens to run, before the caller has a chance to derive
        // the real value from the submission's quarterCode/campaign
        // period. See pdf-data-mapper.service.ts's surveyYearFromQuarterCode
        // and questionnaires.service.ts's resolvedQuarterCode for where
        // that actually happens.
        surveyYear: raw['surveyYear'],
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
        case 'enterprise':
        case 'entreprise': normalizeEnterpriseS1(raw, out); break;
        case 'ctd': normalizeCtdS1(raw, out); break;
        case 'ong':
        case 'ngo': normalizeOngS1(raw, out); break;
        case 'administration': normalizeAdministrationS1(raw, out); break;
        case 'projectProgram':
        case 'project_program':
        case 'project': normalizeProjectProgramS1(raw, out); break;
        case 'vocationalTraining':
        case 'vocational_training':
        case 'vt':
        case 'vtc': normalizeVocationalTrainingS1(raw, out); break;
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
                const lower = k.toLowerCase();
                if (lower !== k && !(lower in out)) {
                    out[lower] = v;
                }
            }
        }
    }

    return out;
}

// ─── S1 Normalizers ───────────────────────────────────────────────────────────

function normalizeCooperativeS1(raw: Record<string, unknown>, out: Record<string, unknown>): void {
    set(out, 'COOP_S1Q01', pick(raw, 'cooperativeName', 'name', 'cooperative_name', 'COOP_S1Q01'));  // ← Add 'name'
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

    set(out, 'S1Q02', pick(raw, 'companyName', 'enterpriseName', 'enterprise_name', 'S1Q02'));  // ← Add 'companyName'
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
    set(out, 'CTD_S1Q01_NAME', pick(raw, 'ctdName', 'name', 'CTD_S1Q01_NAME'));
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
    set(out, 'ONG_S1Q01', pick(raw, 'ongName', 'ngoName', 'name', 'ong_name', 'ONG_S1Q01'));  // ← Add 'ngoName' and 'name'
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
function normalizeAdministrationS1(raw: Record<string, unknown>, out: Record<string, unknown>): void {
    set(out, 'ADMIN_S1Q01', pick(raw, 'administrationName', 'name', 'ADMIN_S1Q01'));
    set(out, 'ADMIN_S1Q02', pick(raw, 'sigle', 'ADMIN_S1Q02'));
    set(out, 'ADMIN_S1Q03', pick(raw, 'area', 'ADMIN_S1Q03'));
    set(out, 'ADMIN_S1Q04_REGION', pick(raw, 'region', 'ADMIN_S1Q04_REGION'));
    set(out, 'ADMIN_S1Q04_DEPT', pick(raw, 'department', 'ADMIN_S1Q04_DEPT'));
    set(out, 'ADMIN_S1Q04_SUBDIV', pick(raw, 'subdivision', 'ADMIN_S1Q04_SUBDIV'));
    set(out, 'ADMIN_S1Q04_LOCALITY', pick(raw, 'locality', 'ADMIN_S1Q04_LOCALITY'));
    set(out, 'ADMIN_S1Q05_TEL1', pick(raw, 'phone1', 'ADMIN_S1Q05_TEL1'));
    set(out, 'ADMIN_S1Q05_TEL2', pick(raw, 'phone2', 'ADMIN_S1Q05_TEL2'));
    set(out, 'ADMIN_S1Q05_BP', pick(raw, 'poBox', 'ADMIN_S1Q05_BP'));
    set(out, 'ADMIN_S1Q06', pick(raw, 'businessSector', 'ADMIN_S1Q06'));
    set(out, 'ADMIN_S1Q07', pick(raw, 'branchActivity', 'branch', 'ADMIN_S1Q07'));
    set(out, 'ADMIN_S1Q08', pick(raw, 'mainMission', 'ADMIN_S1Q08'));
    set(out, 'ADMIN_S1Q09', pick(raw, 'hasProject', 'ADMIN_S1Q09'));
    set(out, 'ADMIN_S1Q10', pick(raw, 'projectCount', 'ADMIN_S1Q10'));
    set(out, 'ADMIN_S1Q11', pick(raw, 'hasSupervisedStructures', 'ADMIN_S1Q11'));
    set(out, 'ADMIN_S1Q12', pick(raw, 'supervisedStructureCount', 'ADMIN_S1Q12'));
}
function normalizeProjectProgramS1(raw: Record<string, unknown>, out: Record<string, unknown>): void {
    set(out, 'PP_S1Q01', pick(raw, 'nature', 'PP_S1Q01'));
    set(out, 'PP_S1Q02', pick(raw, 'projectProgramName', 'name', 'PP_S1Q02'));
    set(out, 'PP_S1Q03', pick(raw, 'sigle', 'PP_S1Q03'));
    set(out, 'PP_S1Q04', pick(raw, 'personInCharge', 'PP_S1Q04'));
    set(out, 'PP_S1Q05', pick(raw, 'area', 'PP_S1Q05'));
    set(out, 'PP_S1Q06_REGION', pick(raw, 'region', 'PP_S1Q06_REGION'));
    set(out, 'PP_S1Q06_DEPT', pick(raw, 'department', 'PP_S1Q06_DEPT'));
    set(out, 'PP_S1Q06_SUBDIV', pick(raw, 'subdivision', 'PP_S1Q06_SUBDIV'));
    set(out, 'PP_S1Q06_LOCALITY', pick(raw, 'locality', 'PP_S1Q06_LOCALITY'));
    set(out, 'PP_S1Q07_TEL1', pick(raw, 'phone1', 'PP_S1Q07_TEL1'));
    set(out, 'PP_S1Q07_TEL2', pick(raw, 'phone2', 'PP_S1Q07_TEL2'));
    set(out, 'PP_S1Q07_BP', pick(raw, 'poBox', 'PP_S1Q07_BP'));
    set(out, 'PP_S1Q08', pick(raw, 'sector', 'PP_S1Q08'));
    set(out, 'PP_S1Q09', pick(raw, 'branch', 'PP_S1Q09'));
    set(out, 'PP_S1Q10', pick(raw, 'mainMission', 'PP_S1Q10'));
    set(out, 'PP_S1Q11', pick(raw, 'headOffice', 'PP_S1Q11'));
    set(out, 'PP_S1Q12', pick(raw, 'supervisingMinistry', 'PP_S1Q12'));
    set(out, 'PP_S1Q13', pick(raw, 'status', 'PP_S1Q13'));
    set(out, 'PP_S1Q14', pick(raw, 'stopReason', 'PP_S1Q14'));
    set(out, 'PP_S1Q15', pick(raw, 'permanentWorkers', 'PP_S1Q15'));
    set(out, 'PP_S1Q16', pick(raw, 'vacancies', 'PP_S1Q16'));
}

// Vocational Training (VT-4). Unlike every other entity's S1 normalizer,
// this one does NOT rename its ~150 Detail-scalar AST ids into a
// separate canonical registry key — VT's own onefop_ast.dart ids
// (VT1_1, VT2_1, … VT9_4) already ARE stable, globally-unique keys (VT-2,
// frozen), so there is no legacy-alias canonicalization to do for them;
// they reach buildVocationalTrainingDto unchanged via the existing
// generic pass-through loop below (same mechanism that already carries
// every S2–S4 table key for the other six entities). The one thing that
// DOES need redirecting here is §1.15's respondent identification: VT's
// AST embeds it inside Section 1 (VT1_15_NAME/_FUNCTION/_TEL1/_TEL2/
// _EMAIL — design note §1 Decision 5, §11), not a separate S0 section,
// so it must be steered into the same S0Q01/S0Q02/S0Q03_* canonical keys
// every other entity's shared respondent block already reads — without
// this, buildNestedDto's entity-agnostic respondent block (below) would
// see nothing for a Vocational Training submission. respondentSex
// (VT1_15_SEX) is deliberately NOT included here — it stays on
// vocationalTrainingDetail only, never on respondent.* (Decision 5).
function normalizeVocationalTrainingS1(raw: Record<string, unknown>, out: Record<string, unknown>): void {
    set(out, 'S0Q01', pick(raw, 'VT1_15_NAME', 'VT1_15_NOM', 'S0Q01', 'respondentName'));
    set(out, 'S0Q02', pick(raw, 'VT1_15_FUNCTION', 'VT1_15_FONCTION', 'S0Q02', 'respondentFunction'));
    set(out, 'S0Q03_TEL1', pick(raw, 'VT1_15_TEL1', 'S0Q03_TEL1', 'respondentPhone1'));
    set(out, 'S0Q03_TEL2', pick(raw, 'VT1_15_TEL2', 'S0Q03_TEL2', 'respondentPhone2'));
    set(out, 'S0Q03_EMAIL', pick(raw, 'VT1_15_EMAIL', 'S0Q03_EMAIL', 'respondentEmail'));
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
        // See normalizeFlatKeys' surveyYear comment above — left undefined
        // unless normalized already carried an explicit value; the real
        // fallback happens in questionnaires.service.ts, which knows the
        // submission's quarterCode.
        surveyYear: normalized['surveyYear'],
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
        case 'enterprise':
        case 'entreprise': out['enterprise'] = buildEnterpriseDto(normalized); break;
        case 'ctd': out['ctd'] = buildCtdDto(normalized); break;
        case 'ong':
        case 'ngo': out['ong'] = buildOngDto(normalized); break;
        case 'administration': out['administration'] = buildAdministrationDto(normalized); break;
        case 'projectProgram':
        case 'project_program':
        case 'project': out['projectProgram'] = buildProjectProgramDto(normalized); break;
        case 'vocationalTraining':
        case 'vocational_training':
        case 'vt':
        case 'vtc': out['vocationalTraining'] = buildVocationalTrainingDto(normalized); break;
    }

    // Projects & Programs — dedicated Section 2/3/4 fields (not part of
    // SharedSectionsDto's S21Q01/S22Q01/S3Q01/S4Q02 shape, which belongs
    // to the enterprise-family questionnaire and doesn't apply here).
    if (entityType === 'projectProgram' || entityType === 'project_program' || entityType === 'project') {
        out['activities'] = buildProjectProgramActivities(normalized);
        out['outcomes'] = buildProjectProgramOutcomes(normalized);
        out['countedPermanent'] = buildCspTable(normalized, 'pp_s4q01');
        out['countedTemporary'] = buildCspTable(normalized, 'pp_s4q02');
        out['recruitedPermanent'] = buildCspTable(normalized, 'pp_s4q03');
        out['recruitedTemporary'] = buildCspTable(normalized, 'pp_s4q04');
        out['disabledRecruitments'] = buildPermTempTable(normalized, 'pp_s4q05');
        out['vulnerableRecruitments'] = buildPermTempTable(normalized, 'pp_s4q06');
        return out;
    }

    // Vocational Training (VT-4) — 12 dedicated child-row arrays, matching
    // VocationalTrainingQuestionnaireDto (VT-3) 1:1. VT has no economic-
    // sector/CSP concept (design note §2), so — like Project & Programs
    // above — it early-returns before the enterprise-family
    // SharedSectionsDto block below, which does not apply to it.
    if (entityType === 'vocationalTraining' || entityType === 'vocational_training' || entityType === 'vt' || entityType === 'vtc') {
        out['diplomaData'] = buildVtDiplomaDataRows(normalized);
        out['traineeAgeFlow'] = buildVtTraineeAgeFlowRows(normalized);
        out['trainerAge'] = buildVtTrainerAgeRows(normalized);
        out['educationLevelFlow'] = buildVtEducationLevelFlowRows(normalized);
        out['traineeVulnerable'] = buildVtTraineeVulnerableRows(normalized);
        out['trainerDisability'] = buildVtTrainerDisabilityRows(normalized);
        out['scholarship'] = buildVtScholarshipRows(normalized);
        out['specialtyRows'] = buildVtSpecialtyRows(normalized);
        out['curriculum'] = buildVtCurriculumRows(normalized);
        out['infrastructure'] = buildVtInfrastructureRows(normalized);
        out['furniture'] = buildVtFurnitureRows(normalized);
        out['trainerRoster'] = buildVtTrainerRosterRows(normalized);
        return out;
    }

    // Administration's S21Q01/S22Q01/S3Q01 use SFP status rows
    // (fonctionnaire/decisionnaire/contractuelle) instead of the CSP rows
    // (cadres/foremen/workers) the other four entity types use — mirrors
    // the same row-key parameterization applied to the frontend compiler's
    // _buildCspGenderAgeGrid/_buildDepartureGrid.
    const isAdministration = entityType === 'administration';
    const cspRowKeys = isAdministration
        ? ['fonctionnaire', 'decisionnaire', 'contractuelle']
        : ['cadres', 'foremen', 'workers'];
    const departureRowKeys = isAdministration
        ? ['fonctionnaire', 'decisionnaire', 'contractuelle', 'total']
        : ['cadres', 'foremen', 'workers', 'total'];

    // S2–S4 — kept as nested structures for DTO validation compatibility
    // (these mirror what FlatToNestedTransformer used to build)
    out['jobApplications'] = buildCspTable(normalized, 's21q01', cspRowKeys);
    // Administration's recruitment table is S21Q02 since the 2026-09-28
    // chronological renumbering (formerly its S22Q01).
    out['recruitmentsPermanent'] = buildCspTable(normalized, isAdministration ? 's21q02' : 's22q01', cspRowKeys);
    // S22Q02 (temporary recruitment) does not exist for Administration —
    // still built for shape-completeness (SharedSectionsDto is optional
    // for every field), but from flat keys that will never be present.
    out['recruitmentsTemporary'] = buildCspTable(normalized, 's22q02');
    const disabledRowKeyPairs = isAdministration
        ? [
            { dtoKey: 'civilServants', flatKey: 'fonctionnaire' },
            { dtoKey: 'decisionStaff', flatKey: 'decisionnaire' },
            { dtoKey: 'contractStaff', flatKey: 'contractuelle' },
            { dtoKey: 'total', flatKey: 'total' },
        ]
        : [
            { dtoKey: 'executives', flatKey: 'cadres' },
            { dtoKey: 'foremen', flatKey: 'foremen' },
            { dtoKey: 'fieldWorkers', flatKey: 'workers' },
            { dtoKey: 'total', flatKey: 'total' },
        ];
    // Administration: S21Q03 (catégorie × sexe) and S21Q04 (nature × sexe)
    // have no permanent/temporary status — values land in the `total` slot.
    out['disabledRecruitments'] = isAdministration
        ? buildStatuslessPermTempTable(normalized, 's21q03', disabledRowKeyPairs)
        : buildPermTempTable(normalized, 's22q04', disabledRowKeyPairs);
    out['vulnerableRecruitments'] = isAdministration
        ? buildStatuslessPermTempTable(normalized, 's21q04', VULNERABLE_ROW_KEY_PAIRS)
        : buildVulnerableTable(normalized, entityType);
    out['firstTimeJobSeekers'] = buildCspTable(normalized, 's23q01');
    out['firstTimeRecruitments'] = buildFirstTimeTable(normalized);
    out['departures'] = buildDeparturesTable(normalized, departureRowKeys);
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
    console.log('🔍 buildEnterpriseDto called');
    console.log('  S1Q01:', n['S1Q01']);
    console.log('  S1Q02:', n['S1Q02']);
    console.log('  S1Q04_REGION:', n['S1Q04_REGION']);
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

function buildAdministrationDto(n: Record<string, unknown>): Record<string, unknown> {
    const r: Record<string, unknown> = {};
    setIfPresent(r, 'name', n['ADMIN_S1Q01']);
    setIfPresent(r, 'sigle', n['ADMIN_S1Q02']);
    setNum(r, 'area', n['ADMIN_S1Q03'], mapArea);
    setIfPresent(r, 'region', n['ADMIN_S1Q04_REGION']);
    setIfPresent(r, 'department', n['ADMIN_S1Q04_DEPT']);
    setIfPresent(r, 'subdivision', n['ADMIN_S1Q04_SUBDIV']);
    setIfPresent(r, 'locality', n['ADMIN_S1Q04_LOCALITY']);
    setIfPresent(r, 'phone1', n['ADMIN_S1Q05_TEL1']);
    setIfPresent(r, 'phone2', n['ADMIN_S1Q05_TEL2']);
    setIfPresent(r, 'poBox', n['ADMIN_S1Q05_BP']);
    setNum(r, 'sector', n['ADMIN_S1Q06'], mapSector);
    setIfPresent(r, 'branch', n['ADMIN_S1Q07']);
    setIfPresent(r, 'mainMission', n['ADMIN_S1Q08']);
    setNum(r, 'hasProject', n['ADMIN_S1Q09'], mapYesNo);
    setNum(r, 'projectCount', n['ADMIN_S1Q10']);
    setNum(r, 'hasSupervisedStructures', n['ADMIN_S1Q11'], mapYesNo);
    setNum(r, 'supervisedStructureCount', n['ADMIN_S1Q12']);
    return r;
}

function buildProjectProgramDto(n: Record<string, unknown>): Record<string, unknown> {
    const r: Record<string, unknown> = {};
    setNum(r, 'nature', n['PP_S1Q01'], mapNature);
    setIfPresent(r, 'name', n['PP_S1Q02']);
    setIfPresent(r, 'sigle', n['PP_S1Q03']);
    setIfPresent(r, 'personInCharge', n['PP_S1Q04']);
    setNum(r, 'area', n['PP_S1Q05'], mapArea);
    setIfPresent(r, 'region', n['PP_S1Q06_REGION']);
    setIfPresent(r, 'department', n['PP_S1Q06_DEPT']);
    setIfPresent(r, 'subdivision', n['PP_S1Q06_SUBDIV']);
    setIfPresent(r, 'locality', n['PP_S1Q06_LOCALITY']);
    setIfPresent(r, 'phone1', n['PP_S1Q07_TEL1']);
    setIfPresent(r, 'phone2', n['PP_S1Q07_TEL2']);
    setIfPresent(r, 'poBox', n['PP_S1Q07_BP']);
    setNum(r, 'sector', n['PP_S1Q08'], mapSector);
    setIfPresent(r, 'branch', n['PP_S1Q09']);
    setIfPresent(r, 'mainMission', n['PP_S1Q10']);
    setIfPresent(r, 'headOffice', n['PP_S1Q11']);
    setIfPresent(r, 'supervisingMinistry', n['PP_S1Q12']);
    setNum(r, 'status', n['PP_S1Q13'], mapPPStatus);
    setNum(r, 'stopReason', n['PP_S1Q14'], mapStopReason);
    setNum(r, 'permanentWorkers', n['PP_S1Q15']);
    setNum(r, 'vacancies', n['PP_S1Q16']);
    return r;
}

// Section 2's activities table — a variable-count repeating collection
// (up to 13 rows on the paper form, see AstFieldType.repeatingTable).
// Rows where every field is empty are dropped rather than persisted as
// meaningless blank records (per the Phase 1 instruction).
function buildProjectProgramActivities(n: Record<string, unknown>): Record<string, unknown>[] {
    const fields = ['description', 'targetPopulation', 'supportType', 'scope', 'startDate', 'duration'] as const;
    const rows: Record<string, unknown>[] = [];
    for (let i = 1; i <= 13; i++) {
        const row: Record<string, unknown> = {};
        for (const f of fields) {
            const v = n[`s2_row${i}_${f}`];
            if (typeof v === 'string' && v.trim() !== '') row[f] = v.trim();
        }
        if (Object.keys(row).length > 0) rows.push(row);
    }
    return rows;
}

// Section 3's outcomes/perspectives KPI grid — 4 fixed rows x 3 period
// columns, all plain integers.
function buildProjectProgramOutcomes(n: Record<string, unknown>): Record<string, unknown> {
    const rows = [
        ['employed', 'employed'],
        ['self_employed', 'selfEmployed'],
        ['jobs_created', 'jobsCreated'],
        ['trained', 'trained'],
    ] as const;
    const periods = [
        ['current', 'current'],
        ['outlook_dec', 'outlookDec'],
        ['outlook_june', 'outlookJune'],
    ] as const;
    const out: Record<string, unknown> = {};
    for (const [flatRow, dtoRow] of rows) {
        const rowObj: Record<string, unknown> = {};
        for (const [flatPeriod, dtoPeriod] of periods) {
            setNum(rowObj, dtoPeriod, n[`s3kpi_${flatRow}_${flatPeriod}`]);
        }
        if (Object.keys(rowObj).length > 0) out[dtoRow] = rowObj;
    }
    return out;
}

// ─── Vocational Training (VT-4) ────────────────────────────────────────────────
//
// Sibling extension point cloned from Project & Programs: a dedicated
// entity-scalar builder (buildVocationalTrainingDto, mirrors
// buildProjectProgramDto) plus dedicated child-row array builders
// (mirrors buildProjectProgramActivities), wired through buildNestedDto's
// early-return block above — not the enterprise-family
// SharedSectionsDto/buildCspTable path, which does not apply to VT.
//
// Row-key vocabularies below are copied verbatim from
// lib/core/focus/compiler/onefop_ast.dart's _vtAcademicDiplomaRows /
// _vtProfessionalDiplomaRows / _vtAgeBandRows / _vtTrainerAgeBandRows /
// _vtEducationLevelRows / _vtVulnerableCategoryRows /
// _vtTrainerDisabilityRows / _vtInfrastructureRows / _vtFurnitureRows /
// _vtGenders / _vtFlowStatuses (VT-2, frozen) — the AST tableSpec
// "prefix" values are copied the same way. Every row key here is a
// lowercased Prisma enum member with underscores intact, so
// `.toUpperCase()` round-trips it back to the exact enum value
// (verified: e.g. "sans_diplome_academique" → "SANS_DIPLOME_ACADEMIQUE").

const VT_ACADEMIC_DIPLOMA_ROWS = [
    'doctorat', 'master2', 'maitrise', 'licence', 'deug_dut', 'bacc_general',
    'bacc_technique', 'probatoire', 'bepc', 'cep', 'sans_diplome_academique',
] as const;
const VT_PROFESSIONAL_DIPLOMA_ROWS = [
    'dipleg_dipes2', 'ingenieur_master_pro', 'dipceg_dipes1', 'licence_pro',
    'bts_hnd', 'bep_bp_bacpro', 'capieg', 'capiaeg', 'cap', 'dqp', 'cqp',
    'autres_pro', 'sans_diplome_professionnel',
] as const;
const VT_AGE_BAND_ROWS = [
    'under_14', 'age_14', 'age_15', 'age_16', 'age_17', 'age_18', 'age_19',
    'age_20', 'age_21', 'age_22', 'age_23', 'age_24', 'age_25', 'age_26',
    'age_27', 'age_28', 'age_29', 'age_30', 'age_31', 'age_32', 'age_33',
    'age_34', 'age_35', 'above_35',
] as const;
const VT_TRAINER_AGE_BAND_ROWS = ['age_18_24', 'age_25_39', 'age_40_59', 'age_60_plus'] as const;
const VT_EDUCATION_LEVEL_ROWS = [
    'non_alphabetise', 'primaire', 'premier_cycle_general',
    'premier_cycle_technique', 'second_cycle_general',
    'second_cycle_technique', 'enseignement_normal', 'enseignement_superieur',
] as const;
const VT_VULNERABLE_CATEGORY_ROWS = [
    'moteur', 'visuel', 'auditif', 'polyhandicapes', 'refugies',
    'orphelins_vulnerables', 'deplaces_internes', 'retournes', 'bororo',
    'baka', 'baguieli',
] as const;
const VT_TRAINER_DISABILITY_ROWS = ['moteur', 'visuel', 'auditif', 'polyhandicapes'] as const;
const VT_INFRASTRUCTURE_ROWS = [
    'salle_classe', 'ateliers_pratiques', 'laboratoires',
    'blocs_administratifs', 'salle_reunion', 'salle_formateurs', 'bureaux',
    'magasin', 'espaces_temporaires',
] as const;
const VT_FURNITURE_ROWS = [
    'banc_1_place', 'banc_2_places', 'banc_3_places', 'banc_4_places_plus',
    'chaises_formateurs', 'tables_formateurs', 'armoires', 'tableaux',
] as const;
const VT_GENDER_ROWS = ['male', 'female', 'total'] as const;
const VT_FLOW_STATUS_ROWS = ['entrant', 'sortant', 'abandon'] as const;

// Matches VocationalTrainingIdentificationDto (VT-3) / OnefopVocationalTrainingDetail
// (VT-1) field-for-field. `name` aside, every field is optional on both —
// no blanket-required behavior is added here. Boolean fields read the
// same "Oui/ Yes"/"Non/ No" AST option values as every other entity's
// Yes/No questions (see _vtYesNoOptions in onefop_ast.dart), converted
// with setBool rather than mapYesNo/setNum because
// VocationalTrainingIdentificationDto types these fields as native
// boolean, not the six-entity numeric-code convention (1/2) — VT-3 froze
// that shape; this function targets it as given, not the older
// convention. The 18 String[] fields (§2/§3/§6/§7/§9, including all five
// §7.1.3 comms-channel fields) always resolve to [] when absent, never
// omitted/null, via setStrArray.
function buildVocationalTrainingDto(n: Record<string, unknown>): Record<string, unknown> {
    const r: Record<string, unknown> = {};

    // §1 — identification
    setIfPresent(r, 'structureCode', n['VT1_1']);
    setIfPresent(r, 'name', n['VT1_2']);
    setIfPresent(r, 'sigle', n['VT1_3']);
    setIfPresent(r, 'region', n['VT1_4']);
    setIfPresent(r, 'department', n['VT1_5']);
    setIfPresent(r, 'subdivision', n['VT1_6']);
    setIfPresent(r, 'commune', n['VT1_7']);
    setIfPresent(r, 'locality', n['VT1_8']);
    setIfPresent(r, 'area', n['VT1_9']);
    setIfPresent(r, 'educationSystem', n['VT1_10']);
    setIfPresent(r, 'cfpType', n['VT1_11']);
    setIfPresent(r, 'functionalStatus', n['VT1_12']);
    setIfPresent(r, 'nonFunctionalReason', n['VT1_13']);
    setIfPresent(r, 'nonFunctionalReasonOther', n['VT1_13_OTHER']);
    setNum(r, 'yearOfEstablishment', n['VT1_14']);
    // Critical rule: respondentSex → vocationalTrainingDetail.respondentSex
    // only (design note §1 Decision 5) — never onto respondent.*.
    setIfPresent(r, 'respondentSex', n['VT1_15_SEX']);
    setIfPresent(r, 'promoterName', n['VT1_16_NAME']);
    setIfPresent(r, 'promoterSex', n['VT1_16_SEX']);
    setIfPresent(r, 'promoterPhone1', n['VT1_16_TEL1']);
    setIfPresent(r, 'promoterPhone2', n['VT1_16_TEL2']);
    setIfPresent(r, 'promoterEmail', n['VT1_16_EMAIL']);

    // §2 — general information
    setBool(r, 'hasStateAgreement', n['VT2_1']);
    setStrArray(r, 'agreementTypes', n['VT2_2']);
    setNum(r, 'siteCount', n['VT2_3']);
    setBool(r, 'sharesInfrastructure', n['VT2_4']);
    setIfPresent(r, 'sharedWithSchoolName', n['VT2_5']);
    setBool(r, 'hasSpecialNeedsTrainers', n['VT2_6']);
    setNum(r, 'specialNeedsTrainerTotal', n['VT2_7']);
    setNum(r, 'specialNeedsTrainerFemale', n['VT2_8']);
    setBool(r, 'hasAccessRamps', n['VT2_9']);
    setBool(r, 'hasDirectorOffice', n['VT2_10']);
    setIfPresent(r, 'poBox', n['VT2_11']);
    setIfPresent(r, 'poBoxCity', n['VT2_11_CITY']);
    setIfPresent(r, 'email', n['VT2_12']);
    setIfPresent(r, 'website', n['VT2_13']);
    setBool(r, 'isAccredited', n['VT2_14']);
    setNum(r, 'lastAccreditationYear', n['VT2_15']);
    setIfPresent(r, 'accreditationOrderNumber', n['VT2_16']);
    setIfPresent(r, 'accreditationOrderDate', n['VT2_17']);
    setStrArray(r, 'trainingTypesOffered', n['VT2_18']);
    setNum(r, 'totalTraineesDeclared', n['VT2_19']);
    setNum(r, 'totalTrainersDeclared', n['VT2_20']);
    setNum(r, 'traineesFromLowerSecondary', n['VT2_21']);
    setNum(r, 'traineesFromUpperSecondary', n['VT2_22']);
    setBool(r, 'hasEnergySource', n['VT2_23']);
    setBool(r, 'isEnergySourceFunctional', n['VT2_24']);
    setStrArray(r, 'energySourceTypes', n['VT2_25']);
    setBool(r, 'hasWaterSource', n['VT2_26']);
    setStrArray(r, 'waterSourceTypes', n['VT2_27']);
    setBool(r, 'hasHandwashingDevice', n['VT2_28']);
    setBool(r, 'hasReceivedHealthCampaign', n['VT2_29']);
    setBool(r, 'hasFirstAidBox', n['VT2_30']);
    setBool(r, 'hasDispensary', n['VT2_31']);
    setBool(r, 'hasFunctionalLibrary', n['VT2_32']);
    setIfPresent(r, 'fenceStatus', n['VT2_33']);
    setBool(r, 'hasSchoolCouncil', n['VT2_34']);
    setBool(r, 'hasLevelCouncil', n['VT2_35']);
    setBool(r, 'hasDisciplinaryCouncil', n['VT2_36']);
    setBool(r, 'hasFunctionalLatrines', n['VT2_37']);
    setStrArray(r, 'latrineTypes', n['VT2_38']);
    setBool(r, 'latrinesSeparateByGender', n['VT2_39']);
    setBool(r, 'latrinesSeparateFromStaff', n['VT2_40']);
    setBool(r, 'hasPlayground', n['VT2_41']);
    setStrArray(r, 'playgroundTypes', n['VT2_42']);
    setBool(r, 'hasIctTools', n['VT2_43']);
    setNum(r, 'ictToolsForTrainersCount', n['VT2_44']);
    setNum(r, 'ictToolsInternetCount', n['VT2_45']);
    setBool(r, 'trainersIctTrained', n['VT2_46']);
    setNum(r, 'trainersIctTrainedTotal', n['VT2_47']);
    setNum(r, 'trainersIctTrainedFemale', n['VT2_48']);
    setBool(r, 'trainersViolenceTraining', n['VT2_49']);
    setBool(r, 'trainersPssTraining', n['VT2_50']);
    setBool(r, 'hasBoarding', n['VT2_51']);
    setBool(r, 'hasGbvMechanism', n['VT2_52']);
    setBool(r, 'hasCanteen', n['VT2_53']);

    // §3 — education in emergencies
    setBool(r, 'facedCrisis', n['VT3_1']);
    setStrArray(r, 'crisisTypes', n['VT3_2']);
    setBool(r, 'crisisClosedCenter', n['VT3_3']);
    setNum(r, 'closureDurationWeeks', n['VT3_4']);
    setBool(r, 'siteRelocated', n['VT3_5']);
    setIfPresent(r, 'relocationLocality', n['VT3_6']);
    setBool(r, 'traineesReassigned', n['VT3_7']);
    setIfPresent(r, 'reassignedTo', n['VT3_8']);
    setBool(r, 'hasEarlyWarningSystem', n['VT3_9']);
    setIfPresent(r, 'earlyWarningDescription', n['VT3_10']);
    setBool(r, 'earlyWarningFunctional', n['VT3_11']);
    setBool(r, 'trainersInnovativePedagogyTrained', n['VT3_12']);
    setNum(r, 'trainersInnovativePedagogyMale', n['VT3_13']);
    setNum(r, 'trainersInnovativePedagogyFemale', n['VT3_14']);
    setBool(r, 'trainersCrisisPedagogyTrained', n['VT3_15']);
    setNum(r, 'trainersCrisisPedagogyMale', n['VT3_16']);
    setNum(r, 'trainersCrisisPedagogyFemale', n['VT3_17']);
    setBool(r, 'trainersDrrmTrained', n['VT3_18']);
    setNum(r, 'trainersDrrmMale', n['VT3_19']);
    setNum(r, 'trainersDrrmFemale', n['VT3_20']);
    setBool(r, 'trainersEvacuationDrillTrained', n['VT3_21']);
    setNum(r, 'trainersEvacuationDrillMale', n['VT3_22']);
    setNum(r, 'trainersEvacuationDrillFemale', n['VT3_23']);
    setBool(r, 'trainersOtherEmergencyTrained', n['VT3_24']);
    setNum(r, 'trainersOtherEmergencyMale', n['VT3_25']);
    setNum(r, 'trainersOtherEmergencyFemale', n['VT3_26']);
    setBool(r, 'hasStudentRecordsSecurity', n['VT3_27']);
    setBool(r, 'hasTextbookSecurity', n['VT3_28']);
    setBool(r, 'hasContingencyPlan', n['VT3_29']);
    setBool(r, 'traineesTrainedOnProtection', n['VT3_30']);

    // §5.1 — study guides
    setBool(r, 'hasTraineeStudyGuides', n['VT5_1']);
    setNum(r, 'traineeStudyGuideCount', n['VT5_2']);
    setBool(r, 'hasTrainerStudyGuides', n['VT5_3']);
    setNum(r, 'trainerStudyGuideCount', n['VT5_4']);

    // §6 — orientation / post-training follow-up
    setBool(r, 'hasCareerGuidanceService', n['VT6_1']);
    setStrArray(r, 'careerGuidanceTimings', n['VT6_2']);
    // 6.1.2 — two Detail booleans (design note Decision 4, frozen).
    setBool(r, 'traineesChooseWithSupport', n['VT6_3']);
    setBool(r, 'collaboratesWithCiopCosup', n['VT6_4']);
    setStrArray(r, 'guidanceSupportTypes', n['VT6_5']);
    setIfPresent(r, 'guidanceSupportOther', n['VT6_6']);
    setBool(r, 'hasPostTrainingFollowUp', n['VT6_7']);
    setStrArray(r, 'followUpMechanisms', n['VT6_8']);
    setIfPresent(r, 'followUpMechanismOther', n['VT6_9']);
    setBool(r, 'hasInsertionSupportUnit', n['VT6_10']);
    setBool(r, 'hasTraineeDatabaseTool', n['VT6_11']);
    setBool(r, 'hasJobSearchSupportTool', n['VT6_12']);
    // No 6.1.2 code exists for §7.3 or §4.12 — see below; VT6_13 (§6.3)
    // is a specialty-row table, handled by buildVtSpecialtyRows, not here.

    // §7 — cross-cutting themes. No §7.3 key exists anywhere in this
    // function (design note Decision 4, frozen) — the printed instrument's
    // own numbering jumps 7.2 → 7.4, and no substitute field is invented.
    setBool(r, 'hasHivAidsRules', n['VT7_1']);
    setBool(r, 'hivRulesCoverSafety', n['VT7_2']);
    setBool(r, 'hivRulesCoverStigmaHiv', n['VT7_3']);
    setBool(r, 'hivRulesCoverStigmaOther', n['VT7_4']);
    setBool(r, 'hivRulesCoverHarassment', n['VT7_5']);
    setBool(r, 'hasDisciplinaryProcedures', n['VT7_6']);
    setBool(r, 'stakeholdersInformed', n['VT7_6_INFORMED']);
    // 7.1.3 — five string[] fields, always [] when absent, never null,
    // no channel enum (design note Decision 2, frozen).
    setStrArray(r, 'pupilsCommsChannels', n['VT7_7']);
    setStrArray(r, 'teachingStaffCommsChannels', n['VT7_8']);
    setStrArray(r, 'nonTeachingStaffCommsChannels', n['VT7_9']);
    setStrArray(r, 'parentsCommsChannels', n['VT7_10']);
    setStrArray(r, 'schoolCouncilCommsChannels', n['VT7_11']);
    setBool(r, 'addressesIstIssues', n['VT7_12']);
    setBool(r, 'traineesReceivedFullSexEd', n['VT7_13']);
    setBool(r, 'genericLifeSkillsInSyllabus', n['VT7_14']);
    setBool(r, 'genericLifeSkillsExtracurricular', n['VT7_15']);
    setBool(r, 'reproHealthEdInSyllabus', n['VT7_16']);
    setBool(r, 'reproHealthEdExtracurricular', n['VT7_17']);
    setBool(r, 'hivTransmissionEdInSyllabus', n['VT7_18']);
    setBool(r, 'hivTransmissionEdExtracurricular', n['VT7_19']);
    setBool(r, 'trainersDeliveredSexEd', n['VT7_20']);
    setStrArray(r, 'trainersSexEdDomains', n['VT7_20_DOMAINS']);
    setBool(r, 'trainersPassedOnToStudents', n['VT7_21']);
    setBool(r, 'heldParentOrientationSessions', n['VT7_22']);

    // §8.5 — trainer occupational status: the six exact Detail integers,
    // NOT a child/fact table (design note: "embedded not normalized").
    setNum(r, 'vacataireProfMale', n['VT8_5_VP_M']);
    setNum(r, 'vacataireProfFemale', n['VT8_5_VP_F']);
    setNum(r, 'vacataireNonProfMale', n['VT8_5_VNP_M']);
    setNum(r, 'vacataireNonProfFemale', n['VT8_5_VNP_F']);
    setNum(r, 'permanentMale', n['VT8_5_PERM_M']);
    setNum(r, 'permanentFemale', n['VT8_5_PERM_F']);

    // §9 — difficulties and perspectives. No §4.12 key exists anywhere in
    // this function (design note Decision 1, frozen) — leftover number
    // under table 4.11, nothing to collect, no substitute field invented.
    setBool(r, 'facesDifficulties', n['VT9_1']);
    setStrArray(r, 'difficultyTypes', n['VT9_2']);
    setStrArray(r, 'difficultyOtherTexts', n['VT9_3']);
    setStrArray(r, 'perspectives', n['VT9_4']);

    return r;
}

// 4.1/4.2/8.1/8.2 → OnefopVtDiplomaData. Flat key: `${prefix}_${diplomaRow}_${gender}`.
// Only cells the client actually sent become rows (no zero-filled rows
// manufactured for untouched cells); once a cell is sent, its numeric
// value defaults to 0 via toInt.
function buildVtDiplomaDataRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const specs = [
        { prefix: 's4q1', personType: 'TRAINEE', diplomaKind: 'ACADEMIC', rows: VT_ACADEMIC_DIPLOMA_ROWS },
        { prefix: 's4q2', personType: 'TRAINEE', diplomaKind: 'PROFESSIONAL', rows: VT_PROFESSIONAL_DIPLOMA_ROWS },
        { prefix: 's8q1', personType: 'TRAINER', diplomaKind: 'ACADEMIC', rows: VT_ACADEMIC_DIPLOMA_ROWS },
        { prefix: 's8q2', personType: 'TRAINER', diplomaKind: 'PROFESSIONAL', rows: VT_PROFESSIONAL_DIPLOMA_ROWS },
    ] as const;
    const out: Record<string, unknown>[] = [];
    for (const { prefix, personType, diplomaKind, rows } of specs) {
        for (const diploma of rows) {
            for (const gender of VT_GENDER_ROWS) {
                const raw = n[`${prefix}_${diploma}_${gender}`];
                if (raw === undefined || raw === null || raw === '') continue;
                out.push({
                    personType,
                    diplomaKind,
                    diploma: diploma.toUpperCase(),
                    gender: gender.toUpperCase(),
                    value: toInt(raw),
                });
            }
        }
    }
    return out;
}

// 4.7 → OnefopVtTraineeAgeFlow. Flat key: `${prefix}_${ageBand}_${flowStatus}_${gender}`.
function buildVtTraineeAgeFlowRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const ageBand of VT_AGE_BAND_ROWS) {
        for (const flowStatus of VT_FLOW_STATUS_ROWS) {
            for (const gender of VT_GENDER_ROWS) {
                const raw = n[`s4q7_${ageBand}_${flowStatus}_${gender}`];
                if (raw === undefined || raw === null || raw === '') continue;
                out.push({
                    ageBand: ageBand.toUpperCase(),
                    flowStatus: flowStatus.toUpperCase(),
                    gender: gender.toUpperCase(),
                    value: toInt(raw),
                });
            }
        }
    }
    return out;
}

// 8.3 → OnefopVtTrainerAge. Flat key: `s8q3_${ageBand}_${gender}` (no flowStatus dimension).
function buildVtTrainerAgeRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const ageBand of VT_TRAINER_AGE_BAND_ROWS) {
        for (const gender of VT_GENDER_ROWS) {
            const raw = n[`s8q3_${ageBand}_${gender}`];
            if (raw === undefined || raw === null || raw === '') continue;
            out.push({ ageBand: ageBand.toUpperCase(), gender: gender.toUpperCase(), value: toInt(raw) });
        }
    }
    return out;
}

// 4.8 → OnefopVtEducationLevelFlow. Flat key: `s4q8_${educationLevel}_${flowStatus}_${gender}`.
function buildVtEducationLevelFlowRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const educationLevel of VT_EDUCATION_LEVEL_ROWS) {
        for (const flowStatus of VT_FLOW_STATUS_ROWS) {
            for (const gender of VT_GENDER_ROWS) {
                const raw = n[`s4q8_${educationLevel}_${flowStatus}_${gender}`];
                if (raw === undefined || raw === null || raw === '') continue;
                out.push({
                    educationLevel: educationLevel.toUpperCase(),
                    flowStatus: flowStatus.toUpperCase(),
                    gender: gender.toUpperCase(),
                    value: toInt(raw),
                });
            }
        }
    }
    return out;
}

// 4.9 → OnefopVtTraineeVulnerable. Flat key: `s4q9_${category}_${flowStatus}_${gender}`.
function buildVtTraineeVulnerableRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const category of VT_VULNERABLE_CATEGORY_ROWS) {
        for (const flowStatus of VT_FLOW_STATUS_ROWS) {
            for (const gender of VT_GENDER_ROWS) {
                const raw = n[`s4q9_${category}_${flowStatus}_${gender}`];
                if (raw === undefined || raw === null || raw === '') continue;
                out.push({
                    category: category.toUpperCase(),
                    flowStatus: flowStatus.toUpperCase(),
                    gender: gender.toUpperCase(),
                    value: toInt(raw),
                });
            }
        }
    }
    return out;
}

// 8.6 → OnefopVtTrainerDisability. Flat key: `s8q6_${category}_${gender}` (no flowStatus).
function buildVtTrainerDisabilityRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const category of VT_TRAINER_DISABILITY_ROWS) {
        for (const gender of VT_GENDER_ROWS) {
            const raw = n[`s8q6_${category}_${gender}`];
            if (raw === undefined || raw === null || raw === '') continue;
            out.push({ category: category.toUpperCase(), gender: gender.toUpperCase(), value: toInt(raw) });
        }
    }
    return out;
}

// 4.11 → OnefopVtScholarship. Flat key: `s4q11_${category}_${status}_${gender}`.
function buildVtScholarshipRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const categories = ['other_admin', 'international'] as const;
    const statuses = ['granted', 'received'] as const;
    const out: Record<string, unknown>[] = [];
    for (const category of categories) {
        for (const status of statuses) {
            for (const gender of VT_GENDER_ROWS) {
                const raw = n[`s4q11_${category}_${status}_${gender}`];
                if (raw === undefined || raw === null || raw === '') continue;
                out.push({
                    category: category.toUpperCase(),
                    status: status.toUpperCase(),
                    gender: gender.toUpperCase(),
                    value: toInt(raw),
                });
            }
        }
    }
    return out;
}

// 4.3, 4.4, 4.5, 4.6, 4.10, 6.3, 8.4, 8.7 → OnefopVtSpecialtyRow. Flat key:
// `${prefix}_row${i}_${field}`. tableCode/rowIndex/specialtyText plus only
// the named columns each table actually uses (design note §13.1, frozen)
// — never cell1..cell4. 4.3/4.4/4.5 keep three distinct tableCode values,
// never merged. A row is skipped when specialtyText is empty AND no
// numeric value was supplied for it (matches the "skip empty specialty
// row" requirement).
function buildVtSpecialtyRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const specs = [
        { prefix: 's4q3', tableCode: '4.3', rows: 12, fields: ['fiMale', 'fiFemale', 'fcMale', 'fcFemale'] },
        { prefix: 's4q4', tableCode: '4.4', rows: 12, fields: ['fiMale', 'fiFemale', 'fcMale', 'fcFemale'] },
        { prefix: 's4q5', tableCode: '4.5', rows: 12, fields: ['fiMale', 'fiFemale', 'fcMale', 'fcFemale'] },
        { prefix: 's4q6', tableCode: '4.6', rows: 12, fields: ['year1Male', 'year1Female', 'year2Male', 'year2Female'] },
        { prefix: 's4q10', tableCode: '4.10', rows: 10, fields: ['male', 'female', 'total'] },
        { prefix: 's6q3', tableCode: '6.3', rows: 10, fields: ['male', 'female', 'total'] },
        { prefix: 's8q4', tableCode: '8.4', rows: 10, fields: ['fiMale', 'fiFemale', 'fcMale', 'fcFemale'] },
        { prefix: 's8q7', tableCode: '8.7', rows: 10, fields: ['fiCount', 'fcCount'] },
    ] as const;
    const out: Record<string, unknown>[] = [];
    for (const { prefix, tableCode, rows, fields } of specs) {
        for (let i = 1; i <= rows; i++) {
            const specialtyTextRaw = n[`${prefix}_row${i}_specialtyText`];
            const hasText = typeof specialtyTextRaw === 'string' && specialtyTextRaw.trim() !== '';
            const cells: Record<string, unknown> = {};
            let hasNumeric = false;
            for (const f of fields) {
                const raw = n[`${prefix}_row${i}_${f}`];
                if (raw !== undefined && raw !== null && raw !== '') {
                    cells[f] = toInt(raw);
                    hasNumeric = true;
                }
            }
            if (!hasText && !hasNumeric) continue;
            const row: Record<string, unknown> = { tableCode, rowIndex: i, ...cells };
            if (hasText) row['specialtyText'] = (specialtyTextRaw as string).trim();
            out.push(row);
        }
    }
    return out;
}

// 5.2 → OnefopVtCurriculum. Flat key: `s5q2_row${i}_${field}`, 15 rows.
function buildVtCurriculumRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (let i = 1; i <= 15; i++) {
        const specialtyTextRaw = n[`s5q2_row${i}_specialtyText`];
        const hasText = typeof specialtyTextRaw === 'string' && specialtyTextRaw.trim() !== '';
        const hasCurriculum = toBoolFromYesNo(n[`s5q2_row${i}_hasCurriculum`]);
        const isApproved = toBoolFromYesNo(n[`s5q2_row${i}_isApproved`]);
        if (!hasText && hasCurriculum === undefined && isApproved === undefined) continue;
        const row: Record<string, unknown> = { rowIndex: i };
        if (hasText) row['specialtyText'] = (specialtyTextRaw as string).trim();
        if (hasCurriculum !== undefined) row['hasCurriculum'] = hasCurriculum;
        if (isApproved !== undefined) row['isApproved'] = isApproved;
        out.push(row);
    }
    return out;
}

// 5.3 → OnefopVtInfrastructure. Flat key: `s5q3_${infrastructureType}_${column}`.
function buildVtInfrastructureRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const columns = ['totalCount', 'permanentGoodCount', 'permanentBadCount', 'temporaryCount'] as const;
    const out: Record<string, unknown>[] = [];
    for (const type of VT_INFRASTRUCTURE_ROWS) {
        const row: Record<string, unknown> = {};
        let any = false;
        for (const col of columns) {
            const raw = n[`s5q3_${type}_${col}`];
            if (raw !== undefined && raw !== null && raw !== '') {
                row[col] = toInt(raw);
                any = true;
            }
        }
        if (!any) continue;
        row['infrastructureType'] = type.toUpperCase();
        out.push(row);
    }
    return out;
}

// 5.4 → OnefopVtFurniture. Flat key: `s5q4_${furnitureType}_${column}`.
function buildVtFurnitureRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const columns = ['goodCount', 'badCount'] as const;
    const out: Record<string, unknown>[] = [];
    for (const type of VT_FURNITURE_ROWS) {
        const row: Record<string, unknown> = {};
        let any = false;
        for (const col of columns) {
            const raw = n[`s5q4_${type}_${col}`];
            if (raw !== undefined && raw !== null && raw !== '') {
                row[col] = toInt(raw);
                any = true;
            }
        }
        if (!any) continue;
        row['furnitureType'] = type.toUpperCase();
        out.push(row);
    }
    return out;
}

// 8.8 → OnefopVtTrainerRoster. Flat key: `s8q8_row${i}_${field}`, 14 rows.
// trainerStatus stays the literal string sent ('1'/'2'/'3' expected, not
// VtTrainerStatus — DTO validation, not this normalizer, enforces the
// exact accepted values). A row is persistable only when it has a usable
// name (lastName or firstName, non-empty trimmed) — VtTrainerRosterDto and
// OnefopVtTrainerRoster both require lastName/firstName (Prisma NOT NULL),
// so a row with e.g. only `sex` filled but no name can never actually be
// created; dropping it here (same treatment as an empty specialty row)
// means createMany never receives a row missing a required name, and a
// final submission is never rejected over one incomplete roster row
// (VT-6 Finding 1). A row whose academicDiploma or professionalDiploma is
// 'TOTAL' is dropped outright — TOTAL is not a valid value for a person's
// diploma (design note §13.2/§13.3).
function buildVtTrainerRosterRows(n: Record<string, unknown>): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (let i = 1; i <= 14; i++) {
        const lastNameRaw = n[`s8q8_row${i}_lastName`];
        const firstNameRaw = n[`s8q8_row${i}_firstName`];
        const sexRaw = n[`s8q8_row${i}_sex`];
        const trainerStatusRaw = n[`s8q8_row${i}_trainerStatus`];
        const isAdminPersonnelRaw = n[`s8q8_row${i}_isAdminPersonnel`];
        const academicDiplomaRaw = n[`s8q8_row${i}_academicDiploma`];
        const professionalDiplomaRaw = n[`s8q8_row${i}_professionalDiploma`];

        const hasLastName = typeof lastNameRaw === 'string' && lastNameRaw.trim() !== '';
        const hasFirstName = typeof firstNameRaw === 'string' && firstNameRaw.trim() !== '';
        if (!hasLastName && !hasFirstName) continue;

        const academicDiploma = typeof academicDiplomaRaw === 'string' ? academicDiplomaRaw.trim().toUpperCase() : undefined;
        const professionalDiploma = typeof professionalDiplomaRaw === 'string' ? professionalDiplomaRaw.trim().toUpperCase() : undefined;
        if (academicDiploma === 'TOTAL' || professionalDiploma === 'TOTAL') continue;

        const row: Record<string, unknown> = { rowIndex: i };
        if (hasLastName) row['lastName'] = (lastNameRaw as string).trim();
        if (hasFirstName) row['firstName'] = (firstNameRaw as string).trim();
        if (typeof sexRaw === 'string' && sexRaw.trim() !== '') row['sex'] = sexRaw.trim();
        if (typeof trainerStatusRaw === 'string' && trainerStatusRaw.trim() !== '') row['trainerStatus'] = trainerStatusRaw.trim();
        const isAdminPersonnel = toBoolFromYesNo(isAdminPersonnelRaw);
        if (isAdminPersonnel !== undefined) row['isAdminPersonnel'] = isAdminPersonnel;
        if (academicDiploma) row['academicDiploma'] = academicDiploma;
        if (professionalDiploma) row['professionalDiploma'] = professionalDiploma;
        out.push(row);
    }
    return out;
}

// ─── Nested DTO builders (S2–S4) ──────────────────────────────────────────────
// Mirror the shape FlatToNestedTransformer used to produce for DTO validation.

// rowKeys defaults to the CSP flat-key set (cadres/foremen/workers) used by
// Enterprise/Cooperative/CTD/ONG. Administration's S21Q01/S22Q01 use SFP
// status rows instead (fonctionnaire/decisionnaire/contractuelle) — see
// buildNestedDto's entityType-aware calls below. The `rows` output keys
// (executives/foremen/fieldWorkers) are internal DTO field names and stay
// the same either way; only the flat-key lookup side changes.
function buildCspTable(
    n: Record<string, unknown>,
    prefix: string,
    rowKeys: readonly string[] = ['cadres', 'foremen', 'workers'],
): Record<string, unknown> {
    const rows = ['executives', 'foremen', 'fieldWorkers'] as const;
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
    const csps = ['cadres', 'foremen', 'workers'];
    const prefix = 's22q03';
    const has4D = Object.keys(n).some((k) =>
        k.startsWith(`${prefix}_cadres_`) ||
        k.startsWith(`${prefix}_foremen_`) ||
        k.startsWith(`${prefix}_workers_`)
    );

    const result: Record<string, unknown> = {};

    for (const diploma of diplomas) {
        const diplomaObj: Record<string, unknown> = {};
        for (const gender of genders) {
            const genderObj: Record<string, unknown> = {};
            for (const { flatKey, dtoKey } of ageBands) {
                if (has4D) {
                    let sum = 0;
                    for (const csp of csps) {
                        sum += toInt(n[`${prefix}_${csp}_${diploma.flatKey}_${gender}_${flatKey}`]);
                    }
                    genderObj[dtoKey] = sum;
                } else {
                    genderObj[dtoKey] = toInt(n[`${prefix}_${diploma.flatKey}_${gender}_${flatKey}`]);
                }
            }
            if (has4D) {
                let sumTotal = 0;
                for (const csp of csps) {
                    sumTotal += toInt(n[`${prefix}_${csp}_${diploma.flatKey}_${gender}_total`]);
                }
                genderObj['total'] = sumTotal;
            } else {
                genderObj['total'] = toInt(n[`${prefix}_${diploma.flatKey}_${gender}_total`]);
            }
            diplomaObj[gender] = genderObj;
        }
        result[diploma.key] = diplomaObj;
    }

    const totalObj: Record<string, unknown> = {};
    for (const gender of genders) {
        const genderObj: Record<string, unknown> = {};
        for (const { flatKey, dtoKey } of ageBands) {
            if (has4D) {
                let sum = 0;
                for (const csp of csps) {
                    sum += toInt(n[`${prefix}_${csp}_total_${gender}_${flatKey}`]);
                }
                genderObj[dtoKey] = sum;
            } else {
                genderObj[dtoKey] = toInt(n[`${prefix}_total_${gender}_${flatKey}`]);
            }
        }
        if (has4D) {
            let sumTotal = 0;
            for (const csp of csps) {
                sumTotal += toInt(n[`${prefix}_${csp}_total_${gender}_total`]);
            }
            genderObj['total'] = sumTotal;
        } else {
            genderObj['total'] = toInt(n[`${prefix}_total_${gender}_total`]);
        }
        totalObj[gender] = genderObj;
    }
    result['total'] = totalObj;

    return result;
}

function buildPermTempTable(
    n: Record<string, unknown>,
    prefix: string,
    rowKeyPairs: { dtoKey: string; flatKey: string }[] = [
        { dtoKey: 'executives', flatKey: 'cadres' },
        { dtoKey: 'foremen', flatKey: 'foremen' },
        { dtoKey: 'fieldWorkers', flatKey: 'workers' },
        { dtoKey: 'total', flatKey: 'total' },
    ],
): Record<string, unknown> {
    const statuses = ['permanent', 'temporary', 'total'] as const;
    const genders = ['male', 'female', 'total'] as const;
    const result: Record<string, unknown> = {};

    for (const { dtoKey, flatKey } of rowKeyPairs) {
        const rowObj: Record<string, unknown> = {};
        for (const status of statuses) {
            const statusObj: Record<string, unknown> = {};
            for (const gender of genders) {
                statusObj[gender] = toInt(n[`${prefix}_${flatKey}_${status}_${gender}`]);
            }
            rowObj[status] = statusObj;
        }
        result[dtoKey] = rowObj;
    }
    return result;
}

const VULNERABLE_ROW_KEY_PAIRS = [
    { dtoKey: 'internalDisplaced', flatKey: 'deplaces_internes' },
    { dtoKey: 'refugees', flatKey: 'refugies' },
    { dtoKey: 'orphans', flatKey: 'orphelins' },
    { dtoKey: 'total', flatKey: 'total' },
];

// Same DTO shape as buildPermTempTable, for a table without a status
// dimension (flat keys `${prefix}_${row}_${gender}`): the values fill the
// `total` status; `permanent` / `temporary` are omitted.
function buildStatuslessPermTempTable(
    n: Record<string, unknown>,
    prefix: string,
    rowKeyPairs: { dtoKey: string; flatKey: string }[],
): Record<string, unknown> {
    const genders = ['male', 'female', 'total'] as const;
    const result: Record<string, unknown> = {};
    for (const { dtoKey, flatKey } of rowKeyPairs) {
        const totalObj: Record<string, unknown> = {};
        for (const gender of genders) totalObj[gender] = toInt(n[`${prefix}_${flatKey}_${gender}`]);
        result[dtoKey] = { total: totalObj };
    }
    return result;
}

function buildVulnerableTable(n: Record<string, unknown>, entityType: string): Record<string, unknown> {
    const prefix = entityType === 'entreprise' ? 's22q05_ent' : 's22q05_oth';
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

// rowKeys defaults to the CSP flat-key set; Administration's S3Q01 uses
// SFP status rows instead — see buildNestedDto's entityType-aware call.
function buildDeparturesTable(
    n: Record<string, unknown>,
    rowKeys: readonly string[] = ['cadres', 'foremen', 'workers', 'total'],
): Record<string, unknown> {
    const prefix = 's3q01';
    const rows = ['executives', 'foremen', 'fieldWorkers', 'total'] as const;
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

export function mapLegalStatus(v: string): number {
    if (!v) return 0;
    if (v.includes('unipersonnelle')) return 1;
    if (v.includes('SARL')) return 2;
    if (v.includes('SA')) return 3;
    if (v.includes('Autres')) return 4;
    return 0;
}

export function mapArea(v: string): number {
    if (!v) return 0;
    const lv = v.toLowerCase();
    if (lv.includes('urbain') || lv.includes('urban')) return 1;
    if (lv.includes('rural')) return 2;
    return 0;
}

export function mapSector(v: string): number {
    if (!v) return 0;
    const lv = v.toLowerCase();
    if (lv === '1' || lv.includes('primaire') || lv.includes('primary')) return 1;
    if (lv === '2' || lv.includes('secondaire') || lv.includes('secondary')) return 2;
    if (lv === '3' || lv.includes('tertiaire') || lv.includes('tertiary')) return 3;
    return 0;
}

// Administration's S1Q09/S1Q11 (Oui/Non) — matches
// AdministrationIdentificationDto's hasProject/hasSupervisedStructures
// numeric-code convention (1=Oui, 2=Non), same pattern as mapArea/mapSector.
export function mapYesNo(v: string): number {
    if (!v) return 0;
    const lv = v.toLowerCase();
    if (lv.includes('oui') || lv.includes('yes')) return 1;
    if (lv.includes('non') || lv.includes('no')) return 2;
    return 0;
}

// Projects & Programs — PP_S1Q01 "Nature de la structure" (matches
// ProjectProgramIdentificationDto's nature: @IsIn([1,2,3,4])).
export function mapNature(v: string): number {
    if (!v) return 0;
    const lv = v.toLowerCase();
    if (lv.includes('projet') || lv.includes('project')) return 1;
    if (lv.includes('programme') || lv.includes('program')) return 2;
    if (lv.includes('sous-tutelle') || lv.includes('supervision')) return 3;
    if (lv.includes('autre') || lv.includes('other')) return 4;
    return 0;
}

// PP_S1Q13 "Situation du Projet / Programme" (matches status: @IsIn([1,2,3])).
export function mapPPStatus(v: string): number {
    if (!v) return 0;
    const lv = v.toLowerCase();
    if (lv.includes('arrêt') || lv.includes('stopped')) return 1;
    if (lv.includes('actif') || lv.includes('active')) return 2;
    if (lv.includes('démarrage') || lv.includes('starting')) return 3;
    return 0;
}

// PP_S1Q14 "Si en arrêt, quel est le principal motif ?" (matches
// stopReason: @IsIn([1,2,3,4]), only sent when status = Stopped).
export function mapStopReason(v: string): number {
    if (!v) return 0;
    const lv = v.toLowerCase();
    if (lv.includes('terme') || lv.includes('expired')) return 1;
    if (lv.includes('fonds') || lv.includes('funds')) return 2;
    if (lv.includes('insuffisant') || lv.includes('insufficient')) return 3;
    if (lv.includes('autre') || lv.includes('other')) return 4;
    return 0;
}

export function mapSize(v: string): number {
    if (!v) return 0;
    if (v.includes('TPE')) return 1;
    if (v.includes('GE')) return 4;
    if (v.includes('ME')) return 3;
    if (v.includes('PE')) return 2;
    return 0;
}

export function mapCooperativeType(v: string): number {
    if (!v) return 0;
    if (v === '1' || v.includes('simplifiée')) return 1;
    if (v === '2' || v.includes("conseil d'administration")) return 2;
    if (v === '3' || v.includes('Autre')) return 3;
    return 0;
}

export function mapCtdType(v: string): number {
    if (!v) return 0;
    if (v.includes('Commune')) return 2;
    if (v.includes('Région')) return 1;
    return 0;
}

export function mapCouncilType(v: string): number {
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

/** Converts value to number via optional mapper, writes when result is a valid number. */
function setNum(
    out: Record<string, unknown>,
    key: string,
    value: unknown,
    mapper?: (s: string) => number,
): void {
    if (value === undefined || value === null || value === '') return;
    let n: number;
    if (typeof value === 'number') {
        n = value;
    } else if (mapper && typeof value === 'string') {
        n = mapper(value);
    } else {
        n = parseInt(String(value), 10);
        if (isNaN(n)) return;
    }
    out[key] = n;
}

/** Coerces any value to a non-negative integer, defaulting to 0. */
function toInt(value: unknown): number {
    if (typeof value === 'number') return value;
    if (value === undefined || value === null || value === '') return 0;
    const n = parseInt(String(value), 10);
    return isNaN(n) ? 0 : n;
}

// Vocational Training (VT-4) helpers — VocationalTrainingIdentificationDto
// (VT-3) types boolean/string[] fields natively (not the six-entity
// numeric-code convention mapYesNo/setNum target), so these are new,
// narrowly-scoped helpers rather than reuses of the existing ones.

/** Same "Oui/ Yes"/"Non/ No" string matching as mapYesNo, returning a real
 *  boolean instead of a numeric code (matches VocationalTrainingIdentificationDto's
 *  native boolean fields). Already-boolean input passes through unchanged. */
function toBoolFromYesNo(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;
    const lv = value.toLowerCase();
    if (lv.includes('oui') || lv.includes('yes')) return true;
    if (lv.includes('non') || lv.includes('no')) return false;
    return undefined;
}

/** Writes a boolean to out[key] only if value resolves to true/false. */
function setBool(out: Record<string, unknown>, key: string, value: unknown): void {
    const b = toBoolFromYesNo(value);
    if (b !== undefined) out[key] = b;
}

/** Coerces value to a string[], defaulting to [] — never omitted, never
 *  null. Matches every VT String[] Detail column's Prisma default ([]),
 *  and explicitly the §7.1.3 requirement that missing/unselected ticks
 *  produce [] rather than null or an omitted key. */
function toStrArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((v) => String(v));
    if (typeof value === 'string' && value.trim() !== '') return [value];
    return [];
}

/** Always writes out[key], even to [] — unlike set()/setIfPresent(), which
 *  omit the key entirely when the source value is absent. */
function setStrArray(out: Record<string, unknown>, key: string, value: unknown): void {
    out[key] = toStrArray(value);
}

/**
 * All Flutter camelCase / snake_case S0–S1 field names.
 * Used by the pass-through loop to avoid duplicating them
 * as raw table keys in the output.
 */const CAMEL_KEY_SET = new Set([
    // S0
    'respondentName', 'respondentFunction', 'respondentPhone1',
    'respondentPhone2', 'respondentEmail',
    // S1 shared
    'region', 'department', 'subdivision', 'locality',
    'phone1', 'phone2', 'poBox', 'businessSector',
    'branchActivity', 'branch', 'area', 'yearCreated',
    'permanentWorkers', 'vacancies',

    // Enterprise
    'companyName',
    'legalStatus', 'enterpriseName', 'enterprise_name',
    'mainActivity', 'enterpriseHeadOffice', 'headOffice',
    'enterpriseSize', 'size',
    // Cooperative
    'cooperativeName', 'name',
    'cooperativeName', 'cooperative_name',
    'cooperativeHeadOffice', 'cooperative_head_office',
    'cooperativeMainActivity', 'cooperativeYearCreated',
    'cooperativeType', 'cooperative_type',
    'cooperativeTypeOther', 'typeOther',
    'cooperative_region', 'cooperative_dept',
    'cooperative_subdiv', 'cooperative_locality',
    // CTD
    'ctdName',
    'ctdType', 'ctd_type', 'councilType', 'council_type', 'ctdYearCreated',
    'CTD_S1Q02', // ← ADD: prevents conditional field leaking into passthrough loop
    // ONG
    'ongName', 'ngoName', 'name',
    'ongName', 'ong_name', 'ongHeadOffice', 'ongMainMission',
    'mainMission', 'ongYearCreated',
    // Administration
    'administrationName', 'sigle',
    'hasProject', 'projectCount',
    'hasSupervisedStructures', 'supervisedStructureCount',
    // Projects & Programs
    'nature', 'projectProgramName', 'personInCharge', 'sector',
    'status', 'stopReason', 'supervisingMinistry',
    // Meta
    'surveyYear', 'organizationType', 'formType', 'entityType',
    'isDraft', 'userId', 'formId',
]);