"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlatToNestedTransformer = void 0;
class FlatToNestedTransformer {
    static transform(flatData, entityType) {
        const result = {
            organizationType: entityType,
            formType: entityType,
            surveyYear: flatData.surveyYear || new Date().getFullYear(),
        };
        const respondent = {};
        const addResp = (key, value) => {
            if (value !== undefined && value !== null && value !== '') {
                respondent[key] = value;
            }
        };
        addResp('name', flatData['respondentName'] || flatData['S0Q01']);
        addResp('function', flatData['respondentFunction'] || flatData['S0Q02']);
        addResp('phone1', flatData['respondentPhone1'] || flatData['S0Q03_TEL1']);
        addResp('phone2', flatData['respondentPhone2'] || flatData['S0Q03_TEL2']);
        addResp('email', flatData['respondentEmail'] || flatData['S0Q03_EMAIL']);
        result.respondent = Object.keys(respondent).length > 0 ? respondent : null;
        switch (entityType) {
            case 'enterprise':
                result.enterprise = this.transformEnterprise(flatData);
                break;
            case 'cooperative':
                result.cooperative = this.transformCooperative(flatData);
                break;
            case 'ctd':
                result.ctd = this.transformCtd(flatData);
                break;
            case 'ong':
                result.ong = this.transformOng(flatData);
                break;
        }
        result.jobApplications = this.transformCspTable(flatData, 's21q01');
        result.recruitmentsPermanent = this.transformCspTable(flatData, 's22q01');
        result.recruitmentsTemporary = this.transformCspTable(flatData, 's22q02');
        result.recruitmentsByDiploma = this.transformDiplomaTable(flatData);
        result.disabledRecruitments = this.transformDisabledTable(flatData);
        result.vulnerableRecruitments = this.transformVulnerableTable(flatData, entityType);
        result.firstTimeJobSeekers = this.transformCspTable(flatData, 's23q01');
        result.firstTimeRecruitments = this.transformFirstTimeTable(flatData);
        result.departures = this.transformDeparturesTable(flatData);
        result.dismissalReasons = this.transformDismissalReasons(flatData);
        result.dismissalTechUnemployment = this.transformDismissalTechTable(flatData);
        result.internships = this.transformInternshipsTable(flatData);
        result.skillsNeeds = this.transformSkillsNeeds(flatData);
        result.trainingNeeds = this.transformTrainingNeeds(flatData);
        return result;
    }
    static transformEnterprise(flat) {
        const result = {};
        const add = (key, value) => {
            if (value !== undefined && value !== null && value !== '')
                result[key] = value;
        };
        const addNum = (key, value) => {
            if (value !== undefined && value !== null && !isNaN(value))
                result[key] = value;
        };
        add('name', flat['enterpriseName'] || flat['S1Q02'] || flat['enterprise_name']);
        add('headOffice', flat['enterpriseHeadOffice'] || flat['S1Q09'] || flat['headOffice']);
        add('region', flat['region'] || flat['S1Q04_REGION']);
        add('department', flat['department'] || flat['S1Q04_DEPT']);
        add('subdivision', flat['subdivision'] || flat['S1Q04_SUBDIV']);
        add('locality', flat['locality'] || flat['S1Q04_LOCALITY']);
        add('phone1', flat['phone1'] || flat['S1Q05_TEL1']);
        add('phone2', flat['phone2'] || flat['S1Q05_TEL2']);
        add('poBox', flat['poBox'] || flat['S1Q05_BP']);
        add('branch', flat['branchActivity'] || flat['branch'] || flat['S1Q07']);
        add('mainActivity', flat['mainActivity'] || flat['S1Q08'] || '');
        const legalStatus = this.toNumber(flat['legalStatus'] || flat['S1Q01'], this.mapLegalStatus);
        if (legalStatus !== 0)
            addNum('legalStatus', legalStatus);
        const area = this.toNumber(flat['area'] || flat['S1Q03'], this.mapArea);
        if (area !== 0)
            addNum('area', area);
        const sector = this.toNumber(flat['businessSector'] || flat['S1Q06'], this.mapSector);
        if (sector !== 0)
            addNum('sector', sector);
        const size = this.toNumber(flat['enterpriseSize'] || flat['size'] || flat['S1Q12'], this.mapSize);
        if (size !== 0)
            addNum('size', size);
        const permanentWorkers = this.toNumber(flat['permanentWorkers'] || flat['S1Q10']);
        if (permanentWorkers !== 0)
            addNum('permanentWorkers', permanentWorkers);
        const vacancies = this.toNumber(flat['vacancies'] || flat['S1Q11']);
        if (vacancies !== 0)
            addNum('vacancies', vacancies);
        return Object.keys(result).length > 0 ? result : null;
    }
    static transformCooperative(flat) {
        const result = {};
        const add = (key, value) => {
            if (value !== undefined && value !== null && value !== '')
                result[key] = value;
        };
        const addNum = (key, value) => {
            if (value !== undefined && value !== null && !isNaN(value))
                result[key] = value;
        };
        add('name', flat['cooperativeName'] || flat['cooperative_name'] || flat['COOP_S1Q01']);
        add('headOffice', flat['cooperativeHeadOffice'] || flat['cooperative_head_office'] || flat['COOP_S1Q02']);
        add('region', flat['region'] || flat['COOP_S1Q05_REGION']);
        add('department', flat['department'] || flat['COOP_S1Q05_DEPT']);
        add('subdivision', flat['subdivision'] || flat['COOP_S1Q05_SUBDIV']);
        add('locality', flat['locality'] || flat['COOP_S1Q05_LOCALITY']);
        add('phone1', flat['phone1'] || flat['COOP_S1Q06_TEL1']);
        add('phone2', flat['phone2'] || flat['COOP_S1Q06_TEL2']);
        add('poBox', flat['poBox'] || flat['COOP_S1Q06_BP']);
        add('branch', flat['branchActivity'] || flat['branch'] || flat['COOP_S1Q08']);
        add('mainActivity', flat['cooperativeMainActivity'] || flat['mainActivity'] || flat['COOP_S1Q09']);
        add('typeOther', flat['cooperativeTypeOther'] || flat['typeOther'] || flat['COOP_S1Q10_OTHER']);
        const yearCreated = this.toNumber(flat['yearCreated'] ?? flat['cooperativeYearCreated'] ?? flat['COOP_S1Q03']);
        if (yearCreated !== 0)
            addNum('yearCreated', yearCreated);
        const area = this.toNumber(flat['area'] ?? flat['COOP_S1Q04'], this.mapArea);
        if (area !== 0)
            addNum('area', area);
        const sector = this.toNumber(flat['businessSector'] ?? flat['COOP_S1Q07'], this.mapSector);
        if (sector !== 0)
            addNum('sector', sector);
        const type = this.toNumber(flat['cooperativeType'] ?? flat['cooperative_type'] ?? flat['COOP_S1Q10'], this.mapCooperativeType);
        if (type !== 0)
            addNum('type', type);
        const permanentWorkers = this.toNumber(flat['permanentWorkers'] ?? flat['COOP_S1Q11']);
        if (permanentWorkers !== 0)
            addNum('permanentWorkers', permanentWorkers);
        const vacancies = this.toNumber(flat['vacancies'] ?? flat['COOP_S1Q12']);
        if (vacancies !== 0)
            addNum('vacancies', vacancies);
        return Object.keys(result).length > 0 ? result : null;
    }
    static transformCtd(flat) {
        const result = {};
        const add = (key, value) => {
            if (value !== undefined && value !== null && value !== '')
                result[key] = value;
        };
        const addNum = (key, value) => {
            if (value !== undefined && value !== null && !isNaN(value))
                result[key] = value;
        };
        add('region', flat['region'] || flat['CTD_S1Q05_REGION']);
        add('department', flat['department'] || flat['CTD_S1Q05_DEPT']);
        add('subdivision', flat['subdivision'] || flat['CTD_S1Q05_SUBDIV']);
        add('locality', flat['locality'] || flat['CTD_S1Q05_LOCALITY']);
        add('phone1', flat['phone1'] || flat['CTD_S1Q06_TEL1']);
        add('phone2', flat['phone2'] || flat['CTD_S1Q06_TEL2']);
        add('poBox', flat['poBox'] || flat['CTD_S1Q06_BP']);
        add('branch', flat['branchActivity'] || flat['branch'] || flat['CTD_S1Q08']);
        const type = this.toNumber(flat['ctdType'] ?? flat['ctd_type'] ?? flat['CTD_S1Q01'], this.mapCtdType);
        if (type !== 0)
            addNum('type', type);
        const councilTypeRaw = flat['councilType'] ?? flat['council_type'] ?? flat['CTD_S1Q02'];
        if (councilTypeRaw) {
            const ct = this.toNumber(councilTypeRaw, this.mapCouncilType);
            if (ct !== 0)
                addNum('councilType', ct);
        }
        const yearCreated = this.toNumber(flat['yearCreated'] ?? flat['ctdYearCreated'] ?? flat['CTD_S1Q03']);
        if (yearCreated !== 0)
            addNum('yearCreated', yearCreated);
        const area = this.toNumber(flat['area'] ?? flat['CTD_S1Q04'], this.mapArea);
        if (area !== 0)
            addNum('area', area);
        const sector = this.toNumber(flat['businessSector'] ?? flat['CTD_S1Q07'], this.mapSector);
        if (sector !== 0)
            addNum('sector', sector);
        const permanentWorkers = this.toNumber(flat['permanentWorkers'] ?? flat['CTD_S1Q09']);
        if (permanentWorkers !== 0)
            addNum('permanentWorkers', permanentWorkers);
        const vacancies = this.toNumber(flat['vacancies'] ?? flat['CTD_S1Q10']);
        if (vacancies !== 0)
            addNum('vacancies', vacancies);
        return Object.keys(result).length > 0 ? result : null;
    }
    static transformOng(flat) {
        const result = {};
        const add = (key, value) => {
            if (value !== undefined && value !== null && value !== '')
                result[key] = value;
        };
        const addNum = (key, value) => {
            if (value !== undefined && value !== null && !isNaN(value))
                result[key] = value;
        };
        add('name', flat['ongName'] || flat['ong_name'] || flat['ONG_S1Q01']);
        add('headOffice', flat['ongHeadOffice'] || flat['headOffice'] || flat['ONG_S1Q02']);
        add('region', flat['region'] || flat['ONG_S1Q05_REGION']);
        add('department', flat['department'] || flat['ONG_S1Q05_DEPT']);
        add('subdivision', flat['subdivision'] || flat['ONG_S1Q05_SUBDIV']);
        add('locality', flat['locality'] || flat['ONG_S1Q05_LOCALITY']);
        add('phone1', flat['phone1'] || flat['ONG_S1Q06_TEL1']);
        add('phone2', flat['phone2'] || flat['ONG_S1Q06_TEL2']);
        add('poBox', flat['poBox'] || flat['ONG_S1Q06_BP']);
        add('branch', flat['branchActivity'] || flat['branch'] || flat['ONG_S1Q08']);
        add('mainMission', flat['ongMainMission'] || flat['mainMission'] || flat['ONG_S1Q09']);
        const yearCreated = this.toNumber(flat['yearCreated'] ?? flat['ongYearCreated'] ?? flat['ONG_S1Q03']);
        if (yearCreated !== 0)
            addNum('yearCreated', yearCreated);
        const area = this.toNumber(flat['area'] ?? flat['ONG_S1Q04'], this.mapArea);
        if (area !== 0)
            addNum('area', area);
        const sector = this.toNumber(flat['businessSector'] ?? flat['ONG_S1Q07'], this.mapSector);
        if (sector !== 0)
            addNum('sector', sector);
        const permanentWorkers = this.toNumber(flat['permanentWorkers'] ?? flat['ONG_S1Q10']);
        if (permanentWorkers !== 0)
            addNum('permanentWorkers', permanentWorkers);
        const vacancies = this.toNumber(flat['vacancies'] ?? flat['ONG_S1Q11']);
        if (vacancies !== 0)
            addNum('vacancies', vacancies);
        return Object.keys(result).length > 0 ? result : null;
    }
    static transformCspTable(flat, prefix) {
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
            result[row] = {};
            for (const gender of genders) {
                result[row][gender] = {};
                for (const { flatKey, dtoKey } of ageBands) {
                    result[row][gender][dtoKey] = flat[`${prefix}_${rowKey}_${gender}_${flatKey}`] ?? 0;
                }
                result[row][gender].total = flat[`${prefix}_${rowKey}_${gender}_total`] ?? 0;
            }
        }
        result['total'] = {};
        for (const gender of genders) {
            result['total'][gender] = {};
            for (const { flatKey, dtoKey } of ageBands) {
                result['total'][gender][dtoKey] = flat[`${prefix}_total_${gender}_${flatKey}`] ?? 0;
            }
            result['total'][gender].total = flat[`${prefix}_total_${gender}_total`] ?? 0;
        }
        return result;
    }
    static transformDiplomaTable(flat) {
        const diplomas = [
            { key: 'cepCepe', flatKey: 'cep' },
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
            { key: 'total', flatKey: 'total' },
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
            result[diploma.key] = {};
            for (const gender of genders) {
                result[diploma.key][gender] = {};
                for (const { flatKey, dtoKey } of ageBands) {
                    result[diploma.key][gender][dtoKey] =
                        flat[`${prefix}_${diploma.flatKey}_${gender}_${flatKey}`] ?? 0;
                }
                result[diploma.key][gender].total =
                    flat[`${prefix}_${diploma.flatKey}_${gender}_total`] ?? 0;
            }
        }
        return result;
    }
    static transformDisabledTable(flat) {
        const rows = ['executives', 'foremen', 'fieldWorkers', 'total'];
        const rowKeys = ['cadres', 'foremen', 'workers', 'total'];
        const statuses = ['permanent', 'temporary', 'total'];
        const genders = ['male', 'female', 'total'];
        const prefix = 's22q04';
        const result = {};
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowKey = rowKeys[i];
            result[row] = {};
            for (const status of statuses) {
                result[row][status] = {};
                for (const gender of genders) {
                    result[row][status][gender] = flat[`${prefix}_${rowKey}_${status}_${gender}`] ?? 0;
                }
            }
        }
        return result;
    }
    static transformVulnerableTable(flat, entityType) {
        const prefix = entityType === 'enterprise' ? 's22q05_ent' : 's22q05_oth';
        const rows = entityType === 'enterprise'
            ? ['internalDisplaced', 'refugees', 'orphans', 'total']
            : ['executives', 'foremen', 'fieldWorkers', 'total'];
        const rowKeys = entityType === 'enterprise'
            ? ['deplaces_internes', 'refugies', 'orphelins', 'total']
            : ['cadres', 'foremen', 'workers', 'total'];
        const statuses = ['permanent', 'temporary', 'total'];
        const genders = ['male', 'female', 'total'];
        const result = {};
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowKey = rowKeys[i];
            result[row] = {};
            for (const status of statuses) {
                result[row][status] = {};
                for (const gender of genders) {
                    result[row][status][gender] = flat[`${prefix}_${rowKey}_${status}_${gender}`] ?? 0;
                }
            }
        }
        return result;
    }
    static transformFirstTimeTable(flat) {
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
            result[contract] = {};
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowKey = rowKeys[i];
                result[contract][row] = {};
                for (const gender of genders) {
                    result[contract][row][gender] = {};
                    for (const { flatKey, dtoKey } of ageBands) {
                        result[contract][row][gender][dtoKey] =
                            flat[`${prefix}_${contract}_${rowKey}_${gender}_${flatKey}`] ?? 0;
                    }
                    result[contract][row][gender].total =
                        flat[`${prefix}_${contract}_${rowKey}_${gender}_total`] ?? 0;
                }
            }
            result[contract].subtotal = {};
            for (const gender of genders) {
                result[contract].subtotal[gender] = {};
                for (const { flatKey, dtoKey } of ageBands) {
                    result[contract].subtotal[gender][dtoKey] =
                        flat[`${prefix}_${contract}_subtotal_${gender}_${flatKey}`] ?? 0;
                }
                result[contract].subtotal[gender].total =
                    flat[`${prefix}_${contract}_subtotal_${gender}_total`] ?? 0;
            }
        }
        result.total = {};
        for (const gender of genders) {
            result.total[gender] = {};
            for (const { flatKey, dtoKey } of ageBands) {
                result.total[gender][dtoKey] =
                    flat[`${prefix}_grandtotal_${gender}_${flatKey}`] ?? 0;
            }
            result.total[gender].total =
                flat[`${prefix}_grandtotal_${gender}_total`] ?? 0;
        }
        return result;
    }
    static transformDeparturesTable(flat) {
        const prefix = 's3q01';
        const rows = ['executives', 'foremen', 'fieldWorkers', 'total'];
        const rowKeys = ['cadres', 'foremen', 'workers', 'total'];
        const types = ['dismissals', 'resignations', 'retirements', 'others', 'ensemble'];
        const typeKeys = ['dismissal', 'resignation', 'retirement', 'other', 'ensemble'];
        const genders = ['male', 'female', 'total'];
        const result = {};
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowKey = rowKeys[i];
            result[row] = {};
            for (let t = 0; t < types.length; t++) {
                result[row][types[t]] = {};
                for (const gender of genders) {
                    result[row][types[t]][gender] =
                        flat[`${prefix}_${rowKey}_${typeKeys[t]}_${gender}`] ?? 0;
                }
            }
        }
        return result;
    }
    static transformDismissalReasons(flat) {
        const reasons = [];
        for (let i = 1; i <= 3; i++) {
            const reason = {};
            const text = flat[`s3q02_reason_${i}_text`];
            if (text && text !== '')
                reason.text = text;
            const male = flat[`s3q02_reason_${i}_male`] ?? 0;
            const female = flat[`s3q02_reason_${i}_female`] ?? 0;
            const total = flat[`s3q02_reason_${i}_total`] ?? 0;
            if (male !== 0)
                reason.male = male;
            if (female !== 0)
                reason.female = female;
            if (total !== 0)
                reason.total = total;
            if (Object.keys(reason).length > 0)
                reasons.push(reason);
        }
        return reasons;
    }
    static transformDismissalTechTable(flat) {
        const prefix = 's3q03';
        const rows = ['executives', 'foremen', 'fieldWorkers', 'total'];
        const rowKeys = ['cadres', 'foremen', 'workers', 'total'];
        const types = ['dismissal', 'technicalUnemployment', 'total'];
        const typeKeys = ['dismissal', 'technical_unemployment', 'total'];
        const genders = ['male', 'female', 'total'];
        const result = {};
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowKey = rowKeys[i];
            result[row] = {};
            for (let t = 0; t < types.length; t++) {
                result[row][types[t]] = {};
                for (const gender of genders) {
                    result[row][types[t]][gender] =
                        flat[`${prefix}_${rowKey}_${typeKeys[t]}_${gender}`] ?? 0;
                }
            }
        }
        return result;
    }
    static transformInternshipsTable(flat) {
        const prefix = 's4q01';
        const rows = ['holiday', 'academic', 'professional', 'preWork', 'total'];
        const rowKeys = ['vacation', 'academic', 'professional', 'pre_employment', 'total'];
        const genders = ['male', 'female', 'total'];
        const result = {};
        for (let i = 0; i < rows.length; i++) {
            result[rows[i]] = {};
            for (const gender of genders) {
                result[rows[i]][gender] = flat[`${prefix}_${rowKeys[i]}_${gender}`] ?? 0;
            }
        }
        return result;
    }
    static transformSkillsNeeds(flat) {
        const skills = [];
        for (let i = 1; i <= 3; i++) {
            const skill = {};
            const description = flat[`s4q02_skill_${i}_text`];
            if (description && description !== '')
                skill.description = description;
            const male = flat[`s4q02_skill_${i}_male`] ?? 0;
            const female = flat[`s4q02_skill_${i}_female`] ?? 0;
            const total = flat[`s4q02_skill_${i}_total`] ?? 0;
            if (male !== 0)
                skill.male = male;
            if (female !== 0)
                skill.female = female;
            if (total !== 0)
                skill.total = total;
            if (Object.keys(skill).length > 0)
                skills.push(skill);
        }
        return skills;
    }
    static transformTrainingNeeds(flat) {
        const trainings = [];
        for (let i = 1; i <= 3; i++) {
            const training = {};
            const domain = flat[`s4q03_domain_${i}_text`];
            if (domain && domain !== '')
                training.domain = domain;
            const male = flat[`s4q03_domain_${i}_male`] ?? 0;
            const female = flat[`s4q03_domain_${i}_female`] ?? 0;
            const total = flat[`s4q03_domain_${i}_total`] ?? 0;
            if (male !== 0)
                training.male = male;
            if (female !== 0)
                training.female = female;
            if (total !== 0)
                training.total = total;
            if (Object.keys(training).length > 0)
                trainings.push(training);
        }
        return trainings;
    }
    static toNumber(value, mapper) {
        if (typeof value === 'number')
            return value;
        if (mapper && typeof value === 'string')
            return mapper(value);
        if (value === undefined || value === null)
            return 0;
        const parsed = parseInt(String(value), 10);
        return isNaN(parsed) ? 0 : parsed;
    }
    static mapLegalStatus(str) {
        if (!str)
            return 0;
        if (str.includes('unipersonnelle'))
            return 1;
        if (str.includes('SARL'))
            return 2;
        if (str.includes('SA'))
            return 3;
        if (str.includes('Autres'))
            return 4;
        return 0;
    }
    static mapArea(str) {
        if (!str)
            return 0;
        if (str.includes('Urbain'))
            return 1;
        if (str.includes('Rural'))
            return 2;
        return 0;
    }
    static mapSector(str) {
        if (!str)
            return 0;
        if (str.includes('Primaire'))
            return 1;
        if (str.includes('Secondaire'))
            return 2;
        if (str.includes('Tertiaire'))
            return 3;
        return 0;
    }
    static mapSize(str) {
        if (!str)
            return 0;
        if (str.includes('TPE'))
            return 1;
        if (str.includes('GE'))
            return 4;
        if (str.includes('ME'))
            return 3;
        if (str.includes('PE'))
            return 2;
        return 0;
    }
    static mapCooperativeType(str) {
        if (!str)
            return 0;
        if (str.includes('simplifiée'))
            return 1;
        if (str.includes("conseil d'administration"))
            return 2;
        if (str.includes('Autre'))
            return 3;
        return 0;
    }
    static mapCtdType(str) {
        if (!str)
            return 0;
        if (str.includes('Commune'))
            return 2;
        if (str.includes('Région'))
            return 1;
        return 0;
    }
    static mapCouncilType(str) {
        if (!str)
            return 0;
        if (str.includes('Arrondissement'))
            return 1;
        if (str.includes('Urbaine'))
            return 2;
        return 0;
    }
}
exports.FlatToNestedTransformer = FlatToNestedTransformer;
//# sourceMappingURL=flat-to-nested.transformer.js.map