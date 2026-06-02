type FlatData = Record<string, unknown>;
type EntityType = 'enterprise' | 'cooperative' | 'ctd' | 'ong';
interface AgeBreakdown {
    age15_24: number;
    age25_34: number;
    age35plus: number;
    total: number;
}
interface CspAgeRow {
    label: string;
    male: AgeBreakdown;
    female: AgeBreakdown;
    total: AgeBreakdown;
}
interface MFT {
    male: number;
    female: number;
    total: number;
}
interface PermTempRow {
    label: string;
    permanent: MFT;
    temporary: MFT;
    total: MFT;
}
interface PermTempTotals {
    label: string;
    permanent: MFT;
    temporary: MFT;
    total: MFT;
}
interface DepartureRow {
    label: string;
    dismissals: MFT;
    resignations: MFT;
    retirements: MFT;
    others: MFT;
    ensemble: MFT;
}
interface DepartureTotals {
    label: string;
    dismissals: MFT;
    resignations: MFT;
    retirements: MFT;
    others: MFT;
    ensemble: MFT;
}
interface DismissalTechRow {
    label: string;
    dismissal: MFT;
    technicalUnemployment: MFT;
    total: MFT;
}
interface DismissalTechTotals {
    label: string;
    dismissal: MFT;
    technicalUnemployment: MFT;
    total: MFT;
}
interface DismissalReason {
    index: number;
    text: string;
    male: number;
    female: number;
    total: number;
}
interface ListTotals {
    label: string;
    male: number;
    female: number;
    total: number;
}
interface InternshipRow {
    label: string;
    male: number;
    female: number;
    total: number;
}
interface SkillRow {
    index: number;
    description: string;
    male: number;
    female: number;
    total: number;
}
interface TrainingRow {
    index: number;
    domain: string;
    male: number;
    female: number;
    total: number;
}
interface S23Q02Result {
    permanent: CspAgeRow[];
    permanentTotals: CspAgeRow;
    temporary: CspAgeRow[];
    temporaryTotals: CspAgeRow;
    grandTotals: CspAgeRow;
}
export declare function mapEnterpriseData(f: FlatData): {
    surveyYear: unknown;
    copy: string;
    jobApplicationsRows: CspAgeRow[];
    jobApplicationsTotals: CspAgeRow;
    recruitmentsPermanentRows: CspAgeRow[];
    recruitmentsPermanentTotals: CspAgeRow;
    recruitmentsTemporaryRows: CspAgeRow[];
    recruitmentsTemporaryTotals: CspAgeRow;
    recruitmentsByDiplomaRows: CspAgeRow[];
    recruitmentsByDiplomaTotals: CspAgeRow;
    disabledRecruitmentsRows: PermTempRow[];
    disabledRecruitmentsTotals: PermTempTotals;
    vulnerableRecruitmentsRows: PermTempRow[];
    vulnerableRecruitmentsTotals: PermTempTotals;
    firstTimeJobSeekerRows: CspAgeRow[];
    firstTimeJobSeekerTotals: CspAgeRow;
    s23q02: S23Q02Result;
    departuresRows: DepartureRow[];
    departuresTotals: DepartureTotals;
    dismissalReasons: DismissalReason[];
    dismissalReasonsTotals: ListTotals;
    dismissalTechUnemploymentRows: DismissalTechRow[];
    dismissalTechUnemploymentTotals: DismissalTechTotals;
    internshipsRows: InternshipRow[];
    internshipsTotals: ListTotals;
    skills: SkillRow[];
    skillsTotals: ListTotals;
    trainingNeeds: TrainingRow[];
    trainingNeedsTotals: ListTotals;
    respondentName: string;
    respondentFunction: string;
    respondentPhone1: string;
    respondentPhone2: string;
    respondentEmail: string;
    legalStatus: number;
    companyName: string;
    area: number;
    region: string;
    department: string;
    subdivision: string;
    locality: string;
    phone1: string;
    phone2: string;
    poBox: string;
    businessSector: number;
    branchActivity: string;
    mainActivity: string;
    headOffice: string;
    permanentWorkers: string;
    vacancies: string;
    enterpriseSize: number;
};
export declare function mapCooperativeData(f: FlatData): {
    surveyYear: unknown;
    copy: string;
    jobApplicationsRows: CspAgeRow[];
    jobApplicationsTotals: CspAgeRow;
    recruitmentsPermanentRows: CspAgeRow[];
    recruitmentsPermanentTotals: CspAgeRow;
    recruitmentsTemporaryRows: CspAgeRow[];
    recruitmentsTemporaryTotals: CspAgeRow;
    recruitmentsByDiplomaRows: CspAgeRow[];
    recruitmentsByDiplomaTotals: CspAgeRow;
    disabledRecruitmentsRows: PermTempRow[];
    disabledRecruitmentsTotals: PermTempTotals;
    vulnerableRecruitmentsRows: PermTempRow[];
    vulnerableRecruitmentsTotals: PermTempTotals;
    firstTimeJobSeekerRows: CspAgeRow[];
    firstTimeJobSeekerTotals: CspAgeRow;
    s23q02: S23Q02Result;
    departuresRows: DepartureRow[];
    departuresTotals: DepartureTotals;
    dismissalReasons: DismissalReason[];
    dismissalReasonsTotals: ListTotals;
    dismissalTechUnemploymentRows: DismissalTechRow[];
    dismissalTechUnemploymentTotals: DismissalTechTotals;
    internshipsRows: InternshipRow[];
    internshipsTotals: ListTotals;
    skills: SkillRow[];
    skillsTotals: ListTotals;
    trainingNeeds: TrainingRow[];
    trainingNeedsTotals: ListTotals;
    respondentName: string;
    respondentFunction: string;
    respondentPhone1: string;
    respondentPhone2: string;
    respondentEmail: string;
    cooperativeName: string;
    cooperativeHeadOffice: string;
    yearOfCreation: string;
    area: number;
    region: string;
    department: string;
    subdivision: string;
    locality: string;
    phone1: string;
    phone2: string;
    poBox: string;
    businessSector: number;
    branchActivity: string;
    cooperativeMainActivity: string;
    cooperativeType: number;
    cooperativeTypeOther: string;
    permanentWorkers: string;
    vacancies: string;
};
export declare function mapCtdData(f: FlatData): {
    surveyYear: unknown;
    copy: string;
    jobApplicationsRows: CspAgeRow[];
    jobApplicationsTotals: CspAgeRow;
    recruitmentsPermanentRows: CspAgeRow[];
    recruitmentsPermanentTotals: CspAgeRow;
    recruitmentsTemporaryRows: CspAgeRow[];
    recruitmentsTemporaryTotals: CspAgeRow;
    recruitmentsByDiplomaRows: CspAgeRow[];
    recruitmentsByDiplomaTotals: CspAgeRow;
    disabledRecruitmentsRows: PermTempRow[];
    disabledRecruitmentsTotals: PermTempTotals;
    vulnerableRecruitmentsRows: PermTempRow[];
    vulnerableRecruitmentsTotals: PermTempTotals;
    firstTimeJobSeekerRows: CspAgeRow[];
    firstTimeJobSeekerTotals: CspAgeRow;
    s23q02: S23Q02Result;
    departuresRows: DepartureRow[];
    departuresTotals: DepartureTotals;
    dismissalReasons: DismissalReason[];
    dismissalReasonsTotals: ListTotals;
    dismissalTechUnemploymentRows: DismissalTechRow[];
    dismissalTechUnemploymentTotals: DismissalTechTotals;
    internshipsRows: InternshipRow[];
    internshipsTotals: ListTotals;
    skills: SkillRow[];
    skillsTotals: ListTotals;
    trainingNeeds: TrainingRow[];
    trainingNeedsTotals: ListTotals;
    respondentName: string;
    respondentFunction: string;
    respondentPhone1: string;
    respondentPhone2: string;
    respondentEmail: string;
    ctdType: number;
    councilType: number;
    yearOfCreation: string;
    area: number;
    region: string;
    department: string;
    subdivision: string;
    locality: string;
    phone1: string;
    phone2: string;
    poBox: string;
    businessSector: number;
    branchActivity: string;
    permanentWorkers: string;
    vacancies: string;
};
export declare function mapOngData(f: FlatData): {
    surveyYear: unknown;
    copy: string;
    jobApplicationsRows: CspAgeRow[];
    jobApplicationsTotals: CspAgeRow;
    recruitmentsPermanentRows: CspAgeRow[];
    recruitmentsPermanentTotals: CspAgeRow;
    recruitmentsTemporaryRows: CspAgeRow[];
    recruitmentsTemporaryTotals: CspAgeRow;
    recruitmentsByDiplomaRows: CspAgeRow[];
    recruitmentsByDiplomaTotals: CspAgeRow;
    disabledRecruitmentsRows: PermTempRow[];
    disabledRecruitmentsTotals: PermTempTotals;
    vulnerableRecruitmentsRows: PermTempRow[];
    vulnerableRecruitmentsTotals: PermTempTotals;
    firstTimeJobSeekerRows: CspAgeRow[];
    firstTimeJobSeekerTotals: CspAgeRow;
    s23q02: S23Q02Result;
    departuresRows: DepartureRow[];
    departuresTotals: DepartureTotals;
    dismissalReasons: DismissalReason[];
    dismissalReasonsTotals: ListTotals;
    dismissalTechUnemploymentRows: DismissalTechRow[];
    dismissalTechUnemploymentTotals: DismissalTechTotals;
    internshipsRows: InternshipRow[];
    internshipsTotals: ListTotals;
    skills: SkillRow[];
    skillsTotals: ListTotals;
    trainingNeeds: TrainingRow[];
    trainingNeedsTotals: ListTotals;
    respondentName: string;
    respondentFunction: string;
    respondentPhone1: string;
    respondentPhone2: string;
    respondentEmail: string;
    ongName: string;
    headOffice: string;
    yearOfCreation: string;
    area: number;
    region: string;
    department: string;
    subdivision: string;
    locality: string;
    phone1: string;
    phone2: string;
    poBox: string;
    businessSector: number;
    branchActivity: string;
    mainMission: string;
    permanentWorkers: string;
    vacancies: string;
};
export declare function diagnoseMappingKeys(f: FlatData, entityType?: EntityType): void;
declare const _default: {};
export default _default;
