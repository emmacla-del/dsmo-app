export declare class AgeBreakdownDto {
    age15_24?: number;
    age25_34?: number;
    age35plus?: number;
    total?: number;
}
export declare class GenderAgeBreakdownDto {
    male?: AgeBreakdownDto;
    female?: AgeBreakdownDto;
    total?: AgeBreakdownDto;
}
export declare class MFTCountDto {
    male?: number;
    female?: number;
    total?: number;
}
export declare class CspGenderAgeTableDto {
    executives?: GenderAgeBreakdownDto;
    foremen?: GenderAgeBreakdownDto;
    fieldWorkers?: GenderAgeBreakdownDto;
    total?: GenderAgeBreakdownDto;
}
export declare class RespondentDto {
    name: string;
    function: string;
    phone1: string;
    phone2?: string;
    email?: string;
}
export declare class PermTempRowDto {
    permanent?: MFTCountDto;
    temporary?: MFTCountDto;
    total?: MFTCountDto;
}
export declare class DiplomaGenderAgeRowDto {
    male?: AgeBreakdownDto;
    female?: AgeBreakdownDto;
    total?: AgeBreakdownDto;
}
export declare class DiplomaBreakdownDto {
    cepCepe?: DiplomaGenderAgeRowDto;
    bepcCap?: DiplomaGenderAgeRowDto;
    probatoire?: DiplomaGenderAgeRowDto;
    bac?: DiplomaGenderAgeRowDto;
    btsDut?: DiplomaGenderAgeRowDto;
    licence?: DiplomaGenderAgeRowDto;
    maitrise?: DiplomaGenderAgeRowDto;
    master?: DiplomaGenderAgeRowDto;
    dqp?: DiplomaGenderAgeRowDto;
    cqp?: DiplomaGenderAgeRowDto;
    autres?: DiplomaGenderAgeRowDto;
    sansDiplome?: DiplomaGenderAgeRowDto;
    total?: DiplomaGenderAgeRowDto;
}
export declare class DisabledRecruitmentsDto {
    executives?: PermTempRowDto;
    foremen?: PermTempRowDto;
    fieldWorkers?: PermTempRowDto;
    total?: PermTempRowDto;
}
export declare class VulnerableRecruitmentsEnterpriseDto {
    internalDisplaced?: PermTempRowDto;
    refugees?: PermTempRowDto;
    orphans?: PermTempRowDto;
    total?: PermTempRowDto;
}
export declare class VulnerableRecruitmentsCspDto {
    executives?: PermTempRowDto;
    foremen?: PermTempRowDto;
    fieldWorkers?: PermTempRowDto;
    total?: PermTempRowDto;
}
export declare class FirstTimeStatusDto {
    executives?: GenderAgeBreakdownDto;
    foremen?: GenderAgeBreakdownDto;
    fieldWorkers?: GenderAgeBreakdownDto;
    subtotal?: GenderAgeBreakdownDto;
}
export declare class FirstTimeRecruitmentsDto {
    permanent?: FirstTimeStatusDto;
    temporary?: FirstTimeStatusDto;
    total?: GenderAgeBreakdownDto;
}
export declare class DepartureRowDto {
    male?: number;
    female?: number;
    total?: number;
}
export declare class DeparturesByCspDto {
    dismissals?: DepartureRowDto;
    resignations?: DepartureRowDto;
    retirements?: DepartureRowDto;
    others?: DepartureRowDto;
    ensemble?: DepartureRowDto;
}
export declare class DeparturesTableDto {
    executives?: DeparturesByCspDto;
    foremen?: DeparturesByCspDto;
    fieldWorkers?: DeparturesByCspDto;
    total?: DeparturesByCspDto;
}
export declare class DismissalReasonDto {
    text?: string;
    male?: number;
    female?: number;
    total?: number;
}
export declare class DismissalTechUnempDto {
    dismissal?: MFTCountDto;
    technicalUnemployment?: MFTCountDto;
    total?: MFTCountDto;
}
export declare class DismissalTechUnempTableDto {
    executives?: DismissalTechUnempDto;
    foremen?: DismissalTechUnempDto;
    fieldWorkers?: DismissalTechUnempDto;
    total?: DismissalTechUnempDto;
}
export declare class InternshipRowDto {
    male?: number;
    female?: number;
    total?: number;
}
export declare class InternshipsDto {
    holiday?: InternshipRowDto;
    academic?: InternshipRowDto;
    professional?: InternshipRowDto;
    preWork?: InternshipRowDto;
    total?: InternshipRowDto;
}
export declare class SkillNeedDto {
    description?: string;
    male?: number;
    female?: number;
    total?: number;
}
export declare class TrainingNeedDto {
    domain?: string;
    male?: number;
    female?: number;
    total?: number;
}
export declare class EnterpriseIdentificationDto {
    legalStatus: number;
    name: string;
    area: number;
    region: string;
    department: string;
    subdivision: string;
    locality?: string;
    phone1: string;
    phone2?: string;
    poBox?: string;
    sector: number;
    branch?: string;
    mainActivity: string;
    headOffice?: string;
    permanentWorkers: number;
    vacancies?: number;
    size: number;
}
export declare class CooperativeIdentificationDto {
    name: string;
    headOffice?: string;
    yearCreated?: number;
    area?: 1 | 2;
    region?: string;
    department?: string;
    subdivision?: string;
    locality?: string;
    phone1?: string;
    phone2?: string;
    poBox?: string;
    sector?: 1 | 2 | 3;
    branch?: string;
    mainActivity?: string;
    type?: 1 | 2 | 3;
    typeOther?: string;
    permanentWorkers?: number;
    vacancies?: number;
}
export declare class CtdIdentificationDto {
    type: 1 | 2;
    councilType?: 1 | 2;
    yearCreated?: number;
    area?: 1 | 2;
    region?: string;
    department?: string;
    subdivision?: string;
    locality?: string;
    phone1?: string;
    phone2?: string;
    poBox?: string;
    sector?: 1 | 2 | 3;
    branch?: string;
    permanentWorkers?: number;
    vacancies?: number;
}
export declare class OngIdentificationDto {
    name: string;
    headOffice?: string;
    yearCreated?: number;
    area?: 1 | 2;
    region?: string;
    department?: string;
    subdivision?: string;
    locality?: string;
    phone1?: string;
    phone2?: string;
    poBox?: string;
    sector?: 1 | 2 | 3;
    branch?: string;
    mainMission?: string;
    permanentWorkers?: number;
    vacancies?: number;
}
export declare class SharedSectionsDto {
    jobApplications?: CspGenderAgeTableDto;
    recruitmentsPermanent?: CspGenderAgeTableDto;
    recruitmentsTemporary?: CspGenderAgeTableDto;
    recruitmentsByDiploma?: DiplomaBreakdownDto;
    disabledRecruitments?: DisabledRecruitmentsDto;
    vulnerableRecruitmentsEnterprise?: VulnerableRecruitmentsEnterpriseDto;
    vulnerableRecruitmentsCsp?: VulnerableRecruitmentsCspDto;
    firstTimeJobSeekers?: CspGenderAgeTableDto;
    firstTimeRecruitments?: FirstTimeRecruitmentsDto;
    departures?: DeparturesTableDto;
    dismissalReasons?: DismissalReasonDto[];
    dismissalTechUnemployment?: DismissalTechUnempTableDto;
    internships?: InternshipsDto;
    skillsNeeds?: SkillNeedDto[];
    trainingNeeds?: TrainingNeedDto[];
    surveyYear?: number;
    copy?: 1 | 2 | 3;
}
export declare abstract class BaseQuestionnaireDto extends SharedSectionsDto {
    abstract organizationType: string;
    respondent: RespondentDto;
}
export declare class EnterpriseQuestionnaireDto extends BaseQuestionnaireDto {
    organizationType: 'enterprise';
    enterprise: EnterpriseIdentificationDto;
}
export declare class CooperativeQuestionnaireDto extends BaseQuestionnaireDto {
    organizationType: 'cooperative';
    cooperative: CooperativeIdentificationDto;
}
export declare class CtdQuestionnaireDto extends BaseQuestionnaireDto {
    organizationType: 'ctd';
    ctd: CtdIdentificationDto;
}
export declare class OngQuestionnaireDto extends BaseQuestionnaireDto {
    organizationType: 'ong';
    ong: OngIdentificationDto;
}
export type AnyQuestionnaireDto = EnterpriseQuestionnaireDto | CooperativeQuestionnaireDto | CtdQuestionnaireDto | OngQuestionnaireDto;
