// analytics/core/analytics-types.ts

import {
    AgeBand,
    CspCategory,
    DepartureType,
    DiplomaFlag,
    EntityType,
    Gender,
    InternshipType,
    StatusFlag,
    SubmissionStatus,
    TableName,
    ContractType,
} from './analytics-enums';

// ─────────────────────────────────────────────────────────────
// FILTER INTERFACES
// ─────────────────────────────────────────────────────────────

export interface AnalyticsScope {
    surveyYear?: number;
    quarterCode?: string;
    region?: string;
    department?: string;
    subdivision?: string;
    fromQuarter?: string;
    toQuarter?: string;
    startDate?: Date;
    endDate?: Date;
}

export interface AnalyticsFilter extends AnalyticsScope {
    entityType?: EntityType;
    /** S1Q07 business sector — free text on the entity-detail tables, not on OnefopSubmission itself. */
    sector?: string;
    submissionId?: string;
    _ids?: readonly string[];
}

export type TrendGranularity = 'year' | 'quarter' | 'semester' | 'month';

export interface TrendFilter extends AnalyticsFilter {
    startYear?: number;
    endYear?: number;
    granularity?: TrendGranularity;
}

export interface SubmissionListFilter extends AnalyticsFilter {
    status?: SubmissionStatus;
    limit?: number;
    offset?: number;
}

export interface LaborMarketTensionFilter extends AnalyticsFilter {
    granularity?: 'annual' | 'quarter' | 'semester';
}

export interface RecruitmentTrendFilter extends AnalyticsFilter {
    startYear: number;
    endYear: number;
    granularity: 'year' | 'quarter' | 'semester' | 'month';
}

// ─────────────────────────────────────────────────────────────
// INTERNAL DB ROW SHAPES
// ─────────────────────────────────────────────────────────────

export interface SubmissionMeta {
    id: string;
    surveyYear: number;
    quarterCode: string | null;
    region: string | null;
    department: string | null;
    subdivision: string | null;
    formType: string;
    createdAt: Date;
}

export interface PrismaAggregateResult {
    _sum: { value: number | null };
}

export interface CspGenderAgeGroupRow {
    tableName: TableName;
    cspCategory: CspCategory;
    gender: Gender;
    ageBand: AgeBand;
    _sum: { value: number | null };
}

export interface GenderGroupRow {
    gender: Gender;
    _sum: { value: number | null };
}

export interface CspGroupRow {
    cspCategory: CspCategory;
    _sum: { value: number | null };
}

export interface DiplomaGroupRow {
    diploma: DiplomaFlag | string;
    gender: Gender;
    ageBand: AgeBand;
    _sum: { value: number | null };
}

export interface DiplomaSummaryGroupRow {
    diploma: DiplomaFlag | string;
    _sum: { value: number | null };
}

export interface DisabilityGroupRow {
    cspCategory: CspCategory;
    status: StatusFlag | string;
    gender: Gender;
    _sum: { value: number | null };
}

export interface VulnerableGroupRow {
    vulnerableType: string;
    status: StatusFlag | string;
    gender: Gender;
    _sum: { value: number | null };
}

export interface DisabledByCspGroupRow {
    cspCategory: CspCategory;
    _sum: { value: number | null };
}

export interface VulnerableByTypeGroupRow {
    vulnerableType: string;
    _sum: { value: number | null };
}

export interface FirstTimeWorkerGroupRow {
    contractType: string;
    cspCategory: CspCategory;
    gender: Gender;
    ageBand: AgeBand;
    _sum: { value: number | null };
}

export interface DepartureGroupRow {
    cspCategory: CspCategory;
    departureType: DepartureType;
    gender: Gender;
    _sum: { value: number | null };
}

export interface DepartureSummaryGroupRow {
    departureType: DepartureType;
    _sum: { value: number | null };
}

export interface DismissalReasonDbRow {
    reasonIndex: number;
    reasonText: string | null;
    maleCount: number | null;
    femaleCount: number | null;
    totalCount: number | null;
}

export interface DismissalUnemploymentGroupRow {
    cspCategory: CspCategory;
    type: string;
    gender: Gender;
    _sum: { value: number | null };
}

export interface InternshipGroupRow {
    internshipType: InternshipType | string;
    gender: Gender;
    _sum: { value: number | null };
}

export interface SkillNeedDbRow {
    skillDescription: string | null;
    maleCount: number | null;
    femaleCount: number | null;
    totalCount: number | null;
}

export interface TrainingNeedDbRow {
    trainingDomain: string | null;
    maleCount: number | null;
    femaleCount: number | null;
    totalCount: number | null;
}

export interface RecruitmentDbRow {
    submissionId: string;
    value: number | null;
}

export interface EnterpriseDetailDbRow {
    enterpriseSize: string | null;
    sector: string | null;
    sectorId: string | null;
    vacancies: number | null;
}

export interface LocationTotalDbRow {
    submissionId: string;
    value: number | null;
}

export interface VacancyTotalDbRow {
    vacancies: number | null;
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 1: JOB APPLICATIONS (S21Q01)
// ─────────────────────────────────────────────────────────────

export interface JobApplicationRow {
    cspCategory: CspCategory;
    gender: Gender;
    ageBand: AgeBand | null;
    count: number;
}

export interface JobApplicationSummary {
    totalApplications: number;
    byGender: { gender: Gender; count: number }[];
    byCsp: { cspCategory: CspCategory; count: number }[];
}

export interface ApplicationConversionResult {
    totalApplications: number;
    totalHires: number;
    conversionRate: number | null;
    byCsp: {
        cspCategory: CspCategory;
        applications: number;
        hires: number;
        conversionRate: number | null;
    }[];
}

export interface ApplicationTrend {
    period: string;
    totalApplications: number;
    totalHires: number;
    conversionRate: number | null;
}

export interface JobApplicationGroupRow {
    cspCategory: CspCategory;
    gender: Gender;
    ageBand: AgeBand | null;
    _sum: { value: number | null };
}

export interface JobApplicationCspGroupRow {
    cspCategory: CspCategory;
    _sum: { value: number | null };
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 1: REGISTERED FIRST-TIME SEEKERS (S23Q01)
// ─────────────────────────────────────────────────────────────

export interface RegisteredSeekerRow {
    contractType: ContractType;
    cspCategory: CspCategory;
    gender: Gender;
    ageBand: AgeBand | null;
    count: number;
}

export interface FirstTimeLaborGapResult {
    registered: number;
    recruited: number;
    absorptionRate: number | null;
    byCsp: {
        cspCategory: CspCategory;
        registered: number;
        recruited: number;
        absorptionRate: number | null;
    }[];
}

export interface RegisteredSeekerGroupRow {
    contractType: ContractType;
    cspCategory: CspCategory;
    gender: Gender;
    ageBand: AgeBand | null;
    _sum: { value: number | null };
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 2: ENTERPRISE PROFILE BREAKDOWN
// ─────────────────────────────────────────────────────────────

export type EnterpriseProfileDimension =
    | 'legalStatus'
    | 'area'
    | 'branch'
    | 'mainActivity'
    | 'sector'
    | 'enterpriseSize';

export interface EnterpriseProfileSegment {
    segment: string;
    companyCount: number;
    totalEmployees: number;
    totalVacancies: number;
    avgEmployeesPerCompany: number;
}

export interface EnterpriseProfileDbRow {
    legalStatus: string | null;
    area: string | null;
    branch: string | null;
    mainActivity: string | null;
    sector: string | null;
    enterpriseSize: string | null;
    permanentWorkers: number | null;
    vacancies: number | null;
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 2: GENDER PARITY BY CSP
// ─────────────────────────────────────────────────────────────

export interface GenderParityByCspRow {
    cspCategory: CspCategory;
    maleCount: number;
    femaleCount: number;
    malePercentage: number;
    femalePercentage: number;
    ratioFemaleToMale: number | null;
}

export interface CspGenderGroupRow {
    cspCategory: CspCategory;
    gender: Gender;
    _sum: { value: number | null };
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 2: LOCATION DRILL-DOWN
// ─────────────────────────────────────────────────────────────

export interface RecruitmentByLocationRow {
    name: string;
    permanentHires: number;
    temporaryHires: number;
    totalHires: number;
    companyCount: number;
}

export interface DeparturesByLocationRow {
    name: string;
    totalDepartures: number;
    resignations: number;
    dismissals: number;
    companyCount: number;
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 2: YOUTH IN WORKFORCE (STOCK)
// ─────────────────────────────────────────────────────────────

export interface WorkforceYouthResult {
    youthCount: number;
    totalEmployees: number;
    youthRate: number;
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 3: SKILL TRENDS OVER TIME
// ─────────────────────────────────────────────────────────────

export interface SkillTrendPeriod {
    period: string;
    topSkills: { skill: string; totalCount: number }[];
    topTrainingDomains: { domain: string; totalCount: number }[];
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 3: INCLUSION TRENDS OVER TIME
// ─────────────────────────────────────────────────────────────

export interface InclusionTrendPeriod {
    period: string;
    disabledCount: number;
    vulnerableCount: number;
    /** Total hires in this period (denominator for inclusion rates) */
    totalHires: number;
    /** Disabled hires / total hires × 100 */
    disabilityHireRate: number;
    /** Vulnerable hires / total hires × 100 */
    vulnerableHireRate: number;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC RETURN TYPES
// ─────────────────────────────────────────────────────────────

export interface GenderCount {
    gender: Gender;
    count: number;
}

export interface CspCount {
    cspCategory: CspCategory;
    count: number;
}

export interface EmploymentSummary {
    totalEmployees: number;
    byGender: GenderCount[];
    byCsp: CspCount[];
}

export interface EmploymentByCspRow {
    tableName: TableName;
    cspCategory: CspCategory;
    gender: Gender;
    ageBand: AgeBand;
    total: number;
}

export interface EmploymentLocation {
    name: string;
    totalEmployees: number;
    companyCount: number;
    avgEmployeesPerCompany: number;
}

export interface GenderParityResult {
    maleCount: number;
    femaleCount: number;
    malePercentage: number;
    femalePercentage: number;
    ratioFemaleToMale: number | null;
}

export interface RecruitmentTrend {
    period: string;
    permanentRecruitments: number;
    temporaryRecruitments: number;
    totalRecruitments: number;
}

export interface HireDemographicsRow {
    cspCategory: CspCategory;
    gender: Gender;
    ageBand: AgeBand;
    count: number;
}

export interface YouthEmploymentResult {
    youthHires: number;
    totalHires: number;
    /** Share of all recruits aged 15-24. Not a true employment rate. */
    youthSharePct: number;
}

export interface DiplomaDistributionRow {
    diploma: DiplomaFlag | string;
    gender: Gender;
    ageBand: AgeBand;
    count: number;
}

export interface DiplomaSummaryRow {
    diploma: DiplomaFlag | string;
    total: number;
}

export interface DisabilityRow {
    cspCategory: CspCategory;
    status: StatusFlag | string;
    gender: Gender;
    count: number;
}

export interface VulnerableWorkerRow {
    vulnerableType: string;
    status: StatusFlag | string;
    gender: Gender;
    count: number;
}

export interface DisabledByCsp {
    cspCategory: CspCategory;
    count: number;
}

export interface VulnerableByType {
    vulnerableType: string;
    count: number;
}

export interface InclusionMetricsResult {
    disabled: number;
    vulnerable: number;
    totalHires: number;
    disabledByCsp: DisabledByCsp[];
    vulnerableByType: VulnerableByType[];
}

export interface FirstTimeWorkerRow {
    contractType: string;
    cspCategory: CspCategory;
    gender: Gender;
    ageBand: AgeBand;
    count: number;
}

export interface DepartureRow {
    cspCategory: CspCategory;
    departureType: DepartureType;
    gender: Gender;
    count: number;
}

export interface DepartureSummaryRow {
    departureType: DepartureType;
    total: number;
}

export interface DismissalReason {
    reason: string;
    maleCount: number;
    femaleCount: number;
    totalCount: number;
}

export interface DismissalUnemploymentRow {
    cspCategory: CspCategory;
    type: string;
    gender: Gender;
    count: number;
}

export interface InternshipRow {
    internshipType: InternshipType | string;
    gender: Gender;
    count: number;
}

export interface SkillNeedRow {
    skill: string;
    maleCount: number;
    femaleCount: number;
    totalCount: number;
}

export interface TrainingNeedRow {
    domain: string;
    maleCount: number;
    femaleCount: number;
    totalCount: number;
}

export interface SkillGapItem {
    skill: string;
    demand: number;
    supply: number;
    gap: number;
}

export interface TrainingGapResult {
    skillsInDemand: SkillGapItem[];
    skillsInSurplus: SkillGapItem[];
    balanced: SkillGapItem[];
}

export interface VacancySegment {
    segment: string;
    totalVacancies: number;
    companyCount: number;
    avgVacanciesPerCompany: number;
}

// ─────────────────────────────────────────────────────────────
// AGGREGATE / DASHBOARD TYPES
// ─────────────────────────────────────────────────────────────

export interface SkillItem {
    skill: string;
    totalCount: number;
}

export interface TrainingDomainItem {
    domain: string;
    totalCount: number;
}

export interface WorkforceSnapshot {
    totalEmployees: number;
    cadres: number;
    foremen: number;
    workers: number;
    male: number;
    female: number;
    youth: number;
    youthRate: number;
    averageAge: number | null;
}

export interface MobilityDashboard {
    totalEmployees: number;
    totalDepartures: number;
    resignationRate: number;
    dismissalRate: number;
    retirementRate: number;
    turnoverRate: number;
    retentionRate: number;
}

export interface SkillsDashboard {
    topSkills: SkillItem[];
    topTrainingDomains: TrainingDomainItem[];
    biggestSkillGaps: SkillGapItem[];
}

// InclusionDashboard is defined and exported by InclusionAnalyticsService.
// Import it from '../domain/inclusion.analytics.service', not from here.
// The fields it exposes reflect hire-flow rates (not stock rates):
//   disabilityHireRate, vulnerableHireRate, femaleExecutiveHireRate,
//   disabledHireCount, vulnerableHireCount, permanentHires, temporaryHires, totalHires

// ─────────────────────────────────────────────────────────────
// VACANCY FULFILMENT (formerly Labor Market Tension)
// Measures how well employers fill their declared vacancies.
// Not true labour market tension (requires job-seeker denominator).
// ─────────────────────────────────────────────────────────────

export interface LaborMarketCspRow {
    cspCategory: CspCategory;
    hires: number;
    vacancies: null;
    hireSharePct: number;
}

export interface LaborMarketTension {
    totalVacancies: number;
    totalRecruitments: number;
    gap: number;
    /** Fraction of vacancies filled: totalRecruitments / totalVacancies × 100 */
    vacancyFulfilmentRate: number | null;
    /** Occupational demand structure — hire share per CSP (not CSP-level tension) */
    occupationalDemand: LaborMarketCspRow[];
}

export interface LaborMarketTensionByPeriod {
    period: string;
    tension: LaborMarketTension;
}