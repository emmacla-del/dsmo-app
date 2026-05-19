"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFlatKeys = normalizeFlatKeys;
exports.buildNestedDto = buildNestedDto;
function normalizeFlatKeys(raw, entityType) {
    const out = {
        surveyYear: raw['surveyYear'] ?? new Date().getFullYear(),
        organizationType: entityType,
        formType: entityType,
    };
    set(out, 'S0Q01', pick(raw, 'respondentName', 'S0Q01'));
    set(out, 'S0Q02', pick(raw, 'respondentFunction', 'S0Q02'));
    set(out, 'S0Q03_TEL1', pick(raw, 'respondentPhone1', 'S0Q03_TEL1'));
    set(out, 'S0Q03_TEL2', pick(raw, 'respondentPhone2', 'S0Q03_TEL2'));
    set(out, 'S0Q03_EMAIL', pick(raw, 'respondentEmail', 'S0Q03_EMAIL'));
    switch (entityType) {
        case 'cooperative':
            normalizeCooperativeS1(raw, out);
            break;
        case 'enterprise':
            normalizeEnterpriseS1(raw, out);
            break;
        case 'ctd':
            normalizeCtdS1(raw, out);
            break;
        case 'ong':
            normalizeOngS1(raw, out);
            break;
    }
    const s1CamelKeys = new Set(CAMEL_KEY_SET);
    for (const [k, v] of Object.entries(raw)) {
        if (!s1CamelKeys.has(k) && !(k in out)) {
            if (v !== undefined && v !== null && v !== '') {
                out[k] = v;
            }
        }
    }
    return out;
}
function normalizeCooperativeS1(raw, out) {
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
function normalizeEnterpriseS1(raw, out) {
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
function normalizeCtdS1(raw, out) {
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
function normalizeOngS1(raw, out) {
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
function buildNestedDto(normalized, entityType) {
    const out = {
        organizationType: entityType,
        formType: entityType,
        surveyYear: normalized['surveyYear'] ?? new Date().getFullYear(),
    };
    const respondent = {};
    setIfPresent(respondent, 'name', normalized['S0Q01']);
    setIfPresent(respondent, 'function', normalized['S0Q02']);
    setIfPresent(respondent, 'phone1', normalized['S0Q03_TEL1']);
    setIfPresent(respondent, 'phone2', normalized['S0Q03_TEL2']);
    setIfPresent(respondent, 'email', normalized['S0Q03_EMAIL']);
    if (Object.keys(respondent).length > 0)
        out['respondent'] = respondent;
    switch (entityType) {
        case 'cooperative':
            out['cooperative'] = buildCooperativeDto(normalized);
            break;
        case 'enterprise':
            out['enterprise'] = buildEnterpriseDto(normalized);
            break;
        case 'ctd':
            out['ctd'] = buildCtdDto(normalized);
            break;
        case 'ong':
            out['ong'] = buildOngDto(normalized);
            break;
    }
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
function buildCooperativeDto(n) {
    const r = {};
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
function buildEnterpriseDto(n) {
    const r = {};
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
function buildCtdDto(n) {
    const r = {};
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
function buildOngDto(n) {
    const r = {};
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
function buildCspTable(n, prefix) {
    const rows = ['executives', 'foremen', 'fieldWorkers'];
    const rowKeys = ['cadres', 'foremen', 'workers'];
    const genders = ['male', 'female', 'total'];
    const ageBands = [
        { flatKey: '15_24', dtoKey: 'age15_24' },
        { flatKey: '25_34', dtoKey: 'age25_34' },
        { flatKey: '35_plus', dtoKey: 'age35plus' },
    ];
    const result = {};
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowKey = rowKeys[i];
        const rowObj = {};
        for (const gender of genders) {
            const genderObj = {};
            for (const { flatKey, dtoKey } of ageBands) {
                genderObj[dtoKey] = toInt(n[`${prefix}_${rowKey}_${gender}_${flatKey}`]);
            }
            genderObj['total'] = toInt(n[`${prefix}_${rowKey}_${gender}_total`]);
            rowObj[gender] = genderObj;
        }
        result[row] = rowObj;
    }
    const totalObj = {};
    for (const gender of genders) {
        const genderObj = {};
        for (const { flatKey, dtoKey } of ageBands) {
            genderObj[dtoKey] = toInt(n[`${prefix}_total_${gender}_${flatKey}`]);
        }
        genderObj['total'] = toInt(n[`${prefix}_total_${gender}_total`]);
        totalObj[gender] = genderObj;
    }
    result['total'] = totalObj;
    return result;
}
function buildDiplomaTable(n) {
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
    const genders = ['male', 'female', 'total'];
    const ageBands = [
        { flatKey: '15_24', dtoKey: 'age15_24' },
        { flatKey: '25_34', dtoKey: 'age25_34' },
        { flatKey: '35_plus', dtoKey: 'age35plus' },
    ];
    const prefix = 's22q03';
    const result = {};
    for (const diploma of diplomas) {
        const diplomaObj = {};
        for (const gender of genders) {
            const genderObj = {};
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
function buildPermTempTable(n, prefix) {
    const rows = ['executives', 'foremen', 'fieldWorkers', 'total'];
    const rowKeys = ['cadres', 'foremen', 'workers', 'total'];
    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const result = {};
    for (let i = 0; i < rows.length; i++) {
        const rowObj = {};
        for (const status of statuses) {
            const statusObj = {};
            for (const gender of genders) {
                statusObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${status}_${gender}`]);
            }
            rowObj[status] = statusObj;
        }
        result[rows[i]] = rowObj;
    }
    return result;
}
function buildVulnerableTable(n, entityType) {
    const prefix = entityType === 'enterprise' ? 's22q05_ent' : 's22q05_oth';
    const rows = ['internalDisplaced', 'refugees', 'orphans', 'total'];
    const rowKeys = ['deplaces_internes', 'refugies', 'orphelins', 'total'];
    const statuses = ['permanent', 'temporary', 'total'];
    const genders = ['male', 'female', 'total'];
    const result = {};
    for (let i = 0; i < rows.length; i++) {
        const rowObj = {};
        for (const status of statuses) {
            const statusObj = {};
            for (const gender of genders) {
                statusObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${status}_${gender}`]);
            }
            rowObj[status] = statusObj;
        }
        result[rows[i]] = rowObj;
    }
    return result;
}
function buildFirstTimeTable(n) {
    const prefix = 's23q02';
    const contracts = ['permanent', 'temporary'];
    const rows = ['executives', 'foremen', 'fieldWorkers'];
    const rowKeys = ['cadres', 'foremen', 'workers'];
    const genders = ['male', 'female', 'total'];
    const ageBands = [
        { flatKey: '15_24', dtoKey: 'age15_24' },
        { flatKey: '25_34', dtoKey: 'age25_34' },
        { flatKey: '35_plus', dtoKey: 'age35plus' },
    ];
    const result = {};
    for (const contract of contracts) {
        const contractObj = {};
        for (let i = 0; i < rows.length; i++) {
            const rowObj = {};
            for (const gender of genders) {
                const genderObj = {};
                for (const { flatKey, dtoKey } of ageBands) {
                    genderObj[dtoKey] = toInt(n[`${prefix}_${contract}_${rowKeys[i]}_${gender}_${flatKey}`]);
                }
                genderObj['total'] = toInt(n[`${prefix}_${contract}_${rowKeys[i]}_${gender}_total`]);
                rowObj[gender] = genderObj;
            }
            contractObj[rows[i]] = rowObj;
        }
        const subObj = {};
        for (const gender of genders) {
            const genderObj = {};
            for (const { flatKey, dtoKey } of ageBands) {
                genderObj[dtoKey] = toInt(n[`${prefix}_${contract}_subtotal_${gender}_${flatKey}`]);
            }
            genderObj['total'] = toInt(n[`${prefix}_${contract}_subtotal_${gender}_total`]);
            subObj[gender] = genderObj;
        }
        contractObj['subtotal'] = subObj;
        result[contract] = contractObj;
    }
    const totalObj = {};
    for (const gender of genders) {
        const genderObj = {};
        for (const { flatKey, dtoKey } of ageBands) {
            genderObj[dtoKey] = toInt(n[`${prefix}_grandtotal_${gender}_${flatKey}`]);
        }
        genderObj['total'] = toInt(n[`${prefix}_grandtotal_${gender}_total`]);
        totalObj[gender] = genderObj;
    }
    result['total'] = totalObj;
    return result;
}
function buildDeparturesTable(n) {
    const prefix = 's3q01';
    const rows = ['executives', 'foremen', 'fieldWorkers', 'total'];
    const rowKeys = ['cadres', 'foremen', 'workers', 'total'];
    const types = ['dismissals', 'resignations', 'retirements', 'others', 'ensemble'];
    const typeKeys = ['dismissal', 'resignation', 'retirement', 'other', 'ensemble'];
    const genders = ['male', 'female', 'total'];
    const result = {};
    for (let i = 0; i < rows.length; i++) {
        const rowObj = {};
        for (let t = 0; t < types.length; t++) {
            const typeObj = {};
            for (const gender of genders) {
                typeObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${typeKeys[t]}_${gender}`]);
            }
            rowObj[types[t]] = typeObj;
        }
        result[rows[i]] = rowObj;
    }
    return result;
}
function buildDismissalReasons(n) {
    const reasons = [];
    for (let i = 1; i <= 3; i++) {
        const text = n[`s3q02_reason_${i}_text`];
        const male = toInt(n[`s3q02_reason_${i}_male`]);
        const female = toInt(n[`s3q02_reason_${i}_female`]);
        const total = toInt(n[`s3q02_reason_${i}_total`]);
        const r = {};
        if (text)
            r['text'] = text;
        if (male !== 0)
            r['male'] = male;
        if (female !== 0)
            r['female'] = female;
        if (total !== 0)
            r['total'] = total;
        if (Object.keys(r).length > 0)
            reasons.push(r);
    }
    return reasons;
}
function buildDismissalTechTable(n) {
    const prefix = 's3q03';
    const rows = ['executives', 'foremen', 'fieldWorkers', 'total'];
    const rowKeys = ['cadres', 'foremen', 'workers', 'total'];
    const types = ['dismissal', 'technicalUnemployment', 'total'];
    const typeKeys = ['dismissal', 'technical_unemployment', 'total'];
    const genders = ['male', 'female', 'total'];
    const result = {};
    for (let i = 0; i < rows.length; i++) {
        const rowObj = {};
        for (let t = 0; t < types.length; t++) {
            const typeObj = {};
            for (const gender of genders) {
                typeObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${typeKeys[t]}_${gender}`]);
            }
            rowObj[types[t]] = typeObj;
        }
        result[rows[i]] = rowObj;
    }
    return result;
}
function buildInternshipsTable(n) {
    const prefix = 's4q01';
    const rows = ['holiday', 'academic', 'professional', 'preWork', 'total'];
    const rowKeys = ['vacation', 'academic', 'professional', 'pre_employment', 'total'];
    const genders = ['male', 'female', 'total'];
    const result = {};
    for (let i = 0; i < rows.length; i++) {
        const rowObj = {};
        for (const gender of genders) {
            rowObj[gender] = toInt(n[`${prefix}_${rowKeys[i]}_${gender}`]);
        }
        result[rows[i]] = rowObj;
    }
    return result;
}
function buildSkillsNeeds(n) {
    const skills = [];
    for (let i = 1; i <= 3; i++) {
        const description = n[`s4q02_skill_${i}_text`];
        const male = toInt(n[`s4q02_skill_${i}_male`]);
        const female = toInt(n[`s4q02_skill_${i}_female`]);
        const total = toInt(n[`s4q02_skill_${i}_total`]);
        const s = {};
        if (description)
            s['description'] = description;
        if (male !== 0)
            s['male'] = male;
        if (female !== 0)
            s['female'] = female;
        if (total !== 0)
            s['total'] = total;
        if (Object.keys(s).length > 0)
            skills.push(s);
    }
    return skills;
}
function buildTrainingNeeds(n) {
    const trainings = [];
    for (let i = 1; i <= 3; i++) {
        const domain = n[`s4q03_domain_${i}_text`];
        const male = toInt(n[`s4q03_domain_${i}_male`]);
        const female = toInt(n[`s4q03_domain_${i}_female`]);
        const total = toInt(n[`s4q03_domain_${i}_total`]);
        const t = {};
        if (domain)
            t['domain'] = domain;
        if (male !== 0)
            t['male'] = male;
        if (female !== 0)
            t['female'] = female;
        if (total !== 0)
            t['total'] = total;
        if (Object.keys(t).length > 0)
            trainings.push(t);
    }
    return trainings;
}
function mapLegalStatus(v) {
    if (!v)
        return 0;
    if (v.includes('unipersonnelle'))
        return 1;
    if (v.includes('SARL'))
        return 2;
    if (v.includes('SA'))
        return 3;
    if (v.includes('Autres'))
        return 4;
    return 0;
}
function mapArea(v) {
    if (!v)
        return 0;
    const lv = v.toLowerCase();
    if (lv.includes('urbain') || lv.includes('urban'))
        return 1;
    if (lv.includes('rural'))
        return 2;
    return 0;
}
function mapSector(v) {
    if (!v)
        return 0;
    const lv = v.toLowerCase();
    if (lv === '1' || lv.includes('primaire') || lv.includes('primary'))
        return 1;
    if (lv === '2' || lv.includes('secondaire') || lv.includes('secondary'))
        return 2;
    if (lv === '3' || lv.includes('tertiaire') || lv.includes('tertiary'))
        return 3;
    return 0;
}
function mapSize(v) {
    if (!v)
        return 0;
    if (v.includes('TPE'))
        return 1;
    if (v.includes('GE'))
        return 4;
    if (v.includes('ME'))
        return 3;
    if (v.includes('PE'))
        return 2;
    return 0;
}
function mapCooperativeType(v) {
    if (!v)
        return 0;
    if (v === '1' || v.includes('simplifiée'))
        return 1;
    if (v === '2' || v.includes("conseil d'administration"))
        return 2;
    if (v === '3' || v.includes('Autre'))
        return 3;
    return 0;
}
function mapCtdType(v) {
    if (!v)
        return 0;
    if (v.includes('Commune'))
        return 2;
    if (v.includes('Région'))
        return 1;
    return 0;
}
function mapCouncilType(v) {
    if (!v)
        return 0;
    if (v.includes('Arrondissement'))
        return 1;
    if (v.includes('Urbaine'))
        return 2;
    return 0;
}
function pick(raw, ...keys) {
    for (const key of keys) {
        const v = raw[key];
        if (v !== undefined && v !== null && v !== '')
            return v;
    }
    return undefined;
}
function set(out, key, value) {
    if (value !== undefined && value !== null && value !== '') {
        out[key] = value;
    }
}
function setIfPresent(out, key, value) {
    set(out, key, value);
}
function setNum(out, key, value, mapper) {
    if (value === undefined || value === null)
        return;
    let n;
    if (typeof value === 'number') {
        n = value;
    }
    else if (mapper && typeof value === 'string') {
        n = mapper(value);
    }
    else {
        n = parseInt(String(value), 10);
        if (isNaN(n))
            return;
    }
    if (n !== 0)
        out[key] = n;
}
function toInt(value) {
    if (typeof value === 'number')
        return value;
    if (value === undefined || value === null || value === '')
        return 0;
    const n = parseInt(String(value), 10);
    return isNaN(n) ? 0 : n;
}
const CAMEL_KEY_SET = new Set([
    'respondentName', 'respondentFunction', 'respondentPhone1',
    'respondentPhone2', 'respondentEmail',
    'region', 'department', 'subdivision', 'locality',
    'phone1', 'phone2', 'poBox', 'businessSector',
    'branchActivity', 'branch', 'area', 'yearCreated',
    'permanentWorkers', 'vacancies',
    'legalStatus', 'enterpriseName', 'enterprise_name',
    'mainActivity', 'enterpriseHeadOffice', 'headOffice',
    'enterpriseSize', 'size',
    'cooperativeName', 'cooperative_name',
    'cooperativeHeadOffice', 'cooperative_head_office',
    'cooperativeMainActivity', 'cooperativeYearCreated',
    'cooperativeType', 'cooperative_type',
    'cooperativeTypeOther', 'typeOther',
    'cooperative_region', 'cooperative_dept',
    'cooperative_subdiv', 'cooperative_locality',
    'ctdType', 'ctd_type', 'councilType', 'council_type', 'ctdYearCreated',
    'ongName', 'ong_name', 'ongHeadOffice', 'ongMainMission',
    'mainMission', 'ongYearCreated',
    'surveyYear', 'organizationType', 'formType', 'entityType',
    'isDraft', 'userId', 'formId',
]);
//# sourceMappingURL=flat-key-normalizer.js.map