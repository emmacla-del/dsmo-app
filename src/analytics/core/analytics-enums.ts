// analytics/core/analytics-enums.ts

export enum TableName {
    // S22Q01 — permanent recruits by CSP × gender × age band
    PERMANENT_HIRE = 's22q01',
    // S22Q02 — temporary recruits by CSP × gender × age band
    TEMP_HIRE = 's22q02',
    /** @deprecated Use TEMP_HIRE */
    TEMPORARY_HIRE = 's22q02',
    /**
     * @deprecated WORKFORCE was removed — there is no CSP×gender×age workforce
     * table. Permanent employee stock is a scalar in entity detail models.
     * Replace callers with EmploymentAnalyticsService.getPermanentEmployeeSummary().
     * Temporarily aliased to PERMANENT_HIRE so existing code compiles.
     */
    WORKFORCE = 's22q01',
    // NOTE: S21Q01 (job applications) is stored in onefopJobApplicationData,
    // not in onefopCspGenderAge — there is no TableName entry for it.
    // Permanent employee stock (S1Q10) is a scalar in entity detail models —
    // it has no CSP×gender×age breakdown and no TableName entry.
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
    // Used for ENTREPRISE submissions (S22Q05 rows by nature of vulnerability)
    DEPLACES_INTERNES = 'DEPLACES_INTERNES',
    REFUGIES = 'REFUGIES',
    ORPHELINS = 'ORPHELINS',
    // Used for COOPERATIVE / CTD / ONG submissions (S22Q05 rows by CSP)
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