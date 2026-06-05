// analytics/core/analytics-types.ts

// ─────────────────────────────────────────────────────────────
// FILTER INTERFACES
// ─────────────────────────────────────────────────────────────

export interface AnalyticsScope {
    surveyYear?: number;
    quarterCode?: string;
    region?: string;
    department?: string;
    subdivision?: string;
    // Period range filters - these are used by buildPeriodWhere helper
    fromQuarter?: string;
    toQuarter?: string;
    startDate?: Date;
    endDate?: Date;
}

export interface AnalyticsFilter extends AnalyticsScope {
    entityType?: string;   // 'ENTREPRISE' | 'COOPERATIVE' | 'CTD' | 'ONG'
    submissionId?: string;   // internal UUID
    /** Pre-resolved submission IDs — set by facade to avoid repeated DB lookups */
    _ids?: string[];
}

export interface SubmissionListFilter extends AnalyticsFilter {
    status?: string;
    limit?: number;
    offset?: number;
}

export interface LaborMarketTensionFilter extends AnalyticsFilter {
    /**
     * Controls how tension is aggregated when the filter spans multiple periods.
     * - 'annual'   — sum all matching submissions into one result (default)
     * - 'quarter'  — one result per quarter (e.g. 2024-T1, 2024-T2)
     * - 'semester' — one result per semester (e.g. 2024-S1, 2024-S2)
     */
    granularity?: 'annual' | 'quarter' | 'semester';
}

export interface RecruitmentTrendFilter extends AnalyticsFilter {
    startYear: number;
    endYear: number;
    granularity: 'year' | 'quarter' | 'semester' | 'month';
}

// ─────────────────────────────────────────────────────────────
// INTERNAL DB ROW SHAPES  (used only within domain services)
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
    tableName: string;
    cspCategory: string;
    gender: string;
    ageBand: string;
    _sum: { value: number | null };
}

export interface GenderGroupRow {
    gender: string;
    _sum: { value: number | null };
}

export interface CspGroupRow {
    cspCategory: string;
    _sum: { value: number | null };
}

export interface DiplomaGroupRow {
    diploma: string;
    gender: string;
    ageBand: string;
    _sum: { value: number | null };
}

export interface DiplomaSummaryGroupRow {
    diploma: string;
    _sum: { value: number | null };
}

export interface DisabilityGroupRow {
    cspCategory: string;
    status: string;
    gender: string;
    _sum: { value: number | null };
}

export interface VulnerableGroupRow {
    vulnerableType: string;
    status: string;
    gender: string;
    _sum: { value: number | null };
}

export interface DisabledByCspGroupRow {
    cspCategory: string;
    _sum: { value: number | null };
}

export interface VulnerableByTypeGroupRow {
    vulnerableType: string;
    _sum: { value: number | null };
}

export interface FirstTimeWorkerGroupRow {
    contractType: string;
    cspCategory: string;
    gender: string;
    ageBand: string;
    _sum: { value: number | null };
}

export interface DepartureGroupRow {
    cspCategory: string;
    departureType: string;
    gender: string;
    _sum: { value: number | null };
}

export interface DepartureSummaryGroupRow {
    departureType: string;
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
    cspCategory: string;
    type: string;
    gender: string;
    _sum: { value: number | null };
}

export interface InternshipGroupRow {
    internshipType: string;
    gender: string;
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
    vacancies: number | null;
}

export interface LocationTotalDbRow {
    submissionId: string;
    value: number | null;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC RETURN TYPES
// ─────────────────────────────────────────────────────────────

export interface GenderCount {
    gender: string;
    count: number;
}

export interface CspCount {
    cspCategory: string;
    count: number;
}

export interface EmploymentSummary {
    totalEmployees: number;
    byGender: GenderCount[];
    byCsp: CspCount[];
}

export interface EmploymentByCspRow {
    tableName: string;
    cspCategory: string;
    gender: string;
    ageBand: string;
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
    cspCategory: string;
    gender: string;
    ageBand: string;
    count: number;
}

export interface YouthEmploymentResult {
    youthHires: number;
    totalHires: number;
    youthPercentage: number;
}

export interface DiplomaDistributionRow {
    diploma: string;
    gender: string;
    ageBand: string;
    count: number;
}

export interface DiplomaSummaryRow {
    diploma: string;
    total: number;
}

export interface DisabilityRow {
    cspCategory: string;
    status: string;
    gender: string;
    count: number;
}

export interface VulnerableWorkerRow {
    vulnerableType: string;
    status: string;
    gender: string;
    count: number;
}

export interface DisabledByCsp {
    cspCategory: string;
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
    cspCategory: string;
    gender: string;
    ageBand: string;
    count: number;
}

export interface DepartureRow {
    cspCategory: string;
    departureType: string;
    gender: string;
    count: number;
}

export interface DepartureSummaryRow {
    departureType: string;
    total: number;
}

export interface DismissalReason {
    reason: string;
    maleCount: number;
    femaleCount: number;
    totalCount: number;
}

export interface DismissalUnemploymentRow {
    cspCategory: string;
    type: string;
    gender: string;
    count: number;
}

export interface InternshipRow {
    internshipType: string;
    gender: string;
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
    averageAge: number;
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

export interface InclusionDashboard {
    disabilityRate: number;
    vulnerableRate: number;
    femaleLeadershipRate: number;
    disabledCount: number;
    vulnerableCount: number;
}

// ─────────────────────────────────────────────────────────────
// LABOR MARKET TENSION
// ─────────────────────────────────────────────────────────────

/**
 * CSP-level tension row.
 * `vacancies` is always null here — the survey captures vacancies at enterprise
 * level only, not broken down by CSP. The row exists so the frontend can display
 * hires per category alongside the aggregate vacancy total.
 */
export interface LaborMarketCspRow {
    cspCategory: string;
    /** Actual hires (permanent + temporary) for this CSP category */
    hires: number;
    /** Always null — vacancy data is not available at CSP granularity */
    vacancies: null;
    /** Hire share of total hires, as a percentage */
    hireSharePct: number;
}

export interface LaborMarketTension {
    /** Total declared unfilled positions (from onefopEnterpriseDetail.vacancies) */
    totalVacancies: number;
    /** Total actual hires (permanent + temporary, all CSP, s22q01 + s22q02) */
    totalRecruitments: number;
    /** totalVacancies − totalRecruitments  (positive = more openings than fills) */
    gap: number;
    /** totalRecruitments / totalVacancies × 100, or null when vacancies = 0 */
    absorptionRate: number | null;
    /** Hires broken down by CSP — vacancies not available at this granularity */
    byCsp: LaborMarketCspRow[];
}

/** Raw vacancy total row used internally */
export interface VacancyTotalDbRow {
    vacancies: number | null;
}

/** One period slice when granularity is quarter or semester */
export interface LaborMarketTensionByPeriod {
    period: string;   // e.g. '2024-T1', '2024-S2', '2024'
    tension: LaborMarketTension;
}