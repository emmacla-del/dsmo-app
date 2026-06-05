// analytics/core/analytics-enums.ts

export enum TableName {
    WORKFORCE = 's21q01',
    PERMANENT_HIRE = 's22q01',
    TEMP_HIRE = 's22q02',
}

export enum Gender {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    TOTAL = 'TOTAL',
}

export enum CspCategory {
    CADRES = 'CADRES',
    FOREMEN = 'FOREMEN',
    WORKERS = 'WORKERS',
    TOTAL = 'TOTAL',
}

export enum AgeBand {
    AGE_15_24 = 'AGE_15_24',
    AGE_25_34 = 'AGE_25_34',
    AGE_35_PLUS = 'AGE_35_PLUS',
    TOTAL = 'TOTAL',
}

export enum ContractType {
    PERMANENT = 'PERMANENT',
    TEMPORARY = 'TEMPORARY',
    TOTAL = 'TOTAL',
}

export enum DepartureType {
    DISMISSAL = 'DISMISSAL',
    RESIGNATION = 'RESIGNATION',
    RETIREMENT = 'RETIREMENT',
    OTHER = 'OTHER',
    ENSEMBLE = 'ENSEMBLE',
}

export enum InternshipType {
    VACATION = 'VACATION',
    ACADEMIC = 'ACADEMIC',
    PROFESSIONAL = 'PROFESSIONAL',
    PRE_EMPLOYMENT = 'PRE_EMPLOYMENT',
    TOTAL = 'TOTAL',
}

export enum DiplomaFlag {
    CEP = 'CEP',
    PROBATOIRE = 'PROBATOIRE',
    BAC = 'BAC',
    BTS = 'BTS',
    LICENCE = 'LICENCE',
    MAITRISE = 'MAITRISE',
    MASTER = 'MASTER',
    DQP = 'DQP',
    CQP = 'CQP',
    AUTRES = 'AUTRES',
    SANS_DIPLOME = 'SANS_DIPLOME',
    BEPC = 'BEPC',
    TOTAL = 'TOTAL',
}

export enum DisabilityStatus {
    PERMANENT = 'PERMANENT',
    TEMPORARY = 'TEMPORARY',
    TOTAL = 'TOTAL',
}

export enum VulnerableType {
    DEPLACES_INTERNES = 'DEPLACES_INTERNES',
    REFUGIES = 'REFUGIES',
    ORPHELINS = 'ORPHELINS',
    CADRES_VULN = 'CADRES_VULN',
    FOREMEN_VULN = 'FOREMEN_VULN',
    WORKERS_VULN = 'WORKERS_VULN',
    TOTAL_VULN = 'TOTAL_VULN',
}

export enum DismissalUnemploymentType {
    DISMISSAL = 'DISMISSAL',
    TECHNICAL_UNEMPLOYMENT = 'TECHNICAL_UNEMPLOYMENT',
    TOTAL = 'TOTAL',
}

export enum StatusFlag {
    PERMANENT = 'PERMANENT',
    TEMPORARY = 'TEMPORARY',
    TOTAL = 'TOTAL',
}

export enum SubmissionStatus {
    APPROVED = 'APPROVED',
    PENDING = 'PENDING',
    REJECTED = 'REJECTED',
}

export enum EntityType {
    ENTREPRISE = 'ENTREPRISE',
    COOPERATIVE = 'COOPERATIVE',
    CTD = 'CTD',
    ONG = 'ONG',
}