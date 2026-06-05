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

export enum DepartureType {
    RESIGNATION = 'RESIGNATION',
    DISMISSAL = 'DISMISSAL',
    RETIREMENT = 'RETIREMENT',
    OTHER = 'OTHER',
    ENSEMBLE = 'ENSEMBLE',
}

export enum StatusFlag {
    TOTAL = 'TOTAL',
}

export enum InternshipType {
    TOTAL = 'TOTAL',
}

export enum DiplomaFlag {
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