// src/analytics/bilan.service.ts
//
// Returns a company's own HR analytics derived from their approved
// ONEFOP submission. No external data — purely their own stored records.
//
// Called by: GET /dsmo/analytics/bilan?year=YYYY
// Auth: the userId comes from the JWT guard on the controller.

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────
// RESPONSE SHAPE  (mirrors what the Flutter screen expects)
// ─────────────────────────────────────────────────────────────

export interface CspGenderCount {
    male: number;
    female: number;
    total: number;
}

export interface CspBreakdown {
    executives: CspGenderCount;
    foremen: CspGenderCount;
    workers: CspGenderCount;
    total: CspGenderCount;
}

export interface VulnerableGroup {
    permanent: number;
    temporary: number;
    total: number;
}

export interface BilanRhResponse {
    year: number;
    submissionId: string;
    entityType: string;
    companyName: string;
    // Number of approved ONEFOP submissions (quarters) this response
    // aggregates. ONEFOP is filed quarterly; a company filing on that
    // cadence can have up to 4 approved submissions in one surveyYear.
    // Flow metrics below (recruitments, departures, ...) are summed across
    // all of them; permanentWorkers/vacancies are a snapshot from the
    // most recently approved one. quarterCount > 1 means the response is
    // a genuine annual aggregate, not a single quarter's numbers.
    quarterCount: number;

    // ── Workforce snapshot ──────────────────────────────────────
    permanentWorkers: number;
    vacancies: number;
    vacancyRate: number;          // vacancies / permanentWorkers * 100

    // ── Recruitments (S22Q01 permanent + S22Q02 temporary) ─────
    recruitments: {
        permanent: CspBreakdown;
        temporary: CspBreakdown;
        combined: CspBreakdown;     // permanent + temporary
    };

    // ── Departures (S3Q01) ──────────────────────────────────────
    departures: {
        dismissals: CspGenderCount;
        resignations: CspGenderCount;
        retirements: CspGenderCount;
        others: CspGenderCount;
        total: CspGenderCount;
    };
    turnoverRate: number;         // total departures / permanentWorkers * 100

    // ── Vulnerable workers (S22Q05) ────────────────────────────
    vulnerableWorkers: {
        internalDisplaced: VulnerableGroup;
        refugees: VulnerableGroup;
        orphans: VulnerableGroup;
        total: number;
    };

    // ── Disabled recruitments (S22Q04) ─────────────────────────
    disabledRecruitments: {
        permanent: number;
        temporary: number;
        total: number;
    };

    // ── First-time workers (S23Q02) ────────────────────────────
    firstTimeWorkers: {
        permanent: number;
        temporary: number;
        total: number;
    };

    // ── Internships (S4Q01) ────────────────────────────────────
    internships: {
        holiday: number;
        academic: number;
        professional: number;
        preWork: number;
        total: number;
    };

    // ── Skills & Training (S4Q02 / S4Q03) ─────────────────────
    skillNeeds: Array<{
        index: number;
        description: string;
        totalCount: number;
    }>;
    trainingNeeds: Array<{
        index: number;
        domain: string;
        totalCount: number;
    }>;

    // ── Dismissal reasons (S3Q02) ──────────────────────────────
    dismissalReasons: Array<{
        index: number;
        text: string;
        male: number;
        female: number;
        total: number;
    }>;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function zeroCspGender(): CspGenderCount {
    return { male: 0, female: 0, total: 0 };
}

function zeroCspBreakdown(): CspBreakdown {
    return {
        executives: zeroCspGender(),
        foremen: zeroCspGender(),
        workers: zeroCspGender(),
        total: zeroCspGender(),
    };
}

function addCspGender(a: CspGenderCount, b: CspGenderCount): CspGenderCount {
    return {
        male: a.male + b.male,
        female: a.female + b.female,
        total: a.total + b.total,
    };
}

function addCspBreakdown(a: CspBreakdown, b: CspBreakdown): CspBreakdown {
    return {
        executives: addCspGender(a.executives, b.executives),
        foremen: addCspGender(a.foremen, b.foremen),
        workers: addCspGender(a.workers, b.workers),
        total: addCspGender(a.total, b.total),
    };
}

// Map DB CspCategory string → CspBreakdown key
const cspKey: Record<string, keyof Omit<CspBreakdown, 'total'>> = {
    CADRES: 'executives',
    FOREMEN: 'foremen',
    WORKERS: 'workers',
};

// Map DB Gender string → CspGenderCount key
const genderKey: Record<string, keyof CspGenderCount> = {
    MALE: 'male',
    FEMALE: 'female',
    TOTAL: 'total',
};

// Map DB VulnerableType → BilanRhResponse key
const vulnerableKey: Record<string, keyof Omit<BilanRhResponse['vulnerableWorkers'], 'total'>> = {
    DEPLACES_INTERNES: 'internalDisplaced',
    REFUGIES: 'refugees',
    ORPHELINS: 'orphans',
};

// Map DB DisabilityStatus → VulnerableGroup key
const statusKey: Record<string, keyof Omit<VulnerableGroup, 'total'>> = {
    PERMANENT: 'permanent',
    TEMPORARY: 'temporary',
};

// Map DB DepartureType → departures key
const departureKey: Record<string, keyof Omit<BilanRhResponse['departures'], 'total'>> = {
    DISMISSAL: 'dismissals',
    RESIGNATION: 'resignations',
    RETIREMENT: 'retirements',
    OTHER: 'others',
};

// Map DB InternshipType → internships key
const internshipKey: Record<string, keyof Omit<BilanRhResponse['internships'], 'total'>> = {
    VACATION: 'holiday',
    ACADEMIC: 'academic',
    PROFESSIONAL: 'professional',
    PRE_EMPLOYMENT: 'preWork',
};

function pct(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10; // 1 decimal
}

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

@Injectable()
export class BilanService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Years for which this company has an APPROVED ONEFOP submission,
     * most recent first. Backs the Flutter Bilan RH year selector so it
     * only ever offers years getBilan() can actually serve.
     */
    async getAvailableYears(userId: string): Promise<number[]> {
        const company = await (this.prisma as any).company.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!company) return [];

        const rows = await (this.prisma as any).onefopSubmission.findMany({
            where: { companyId: company.id, status: 'APPROVED' },
            select: { surveyYear: true },
            distinct: ['surveyYear'],
            orderBy: { surveyYear: 'desc' },
        });
        return rows.map((r: any) => r.surveyYear as number);
    }

    async getBilan(userId: string, year: number): Promise<BilanRhResponse> {
        // ── 1. Find the company for this user ─────────────────────
        const company = await (this.prisma as any).company.findUnique({
            where: { userId },
            select: { id: true, name: true },
        });
        if (!company) {
            throw new NotFoundException('Aucune entreprise trouvée pour cet utilisateur.');
        }

        // ── 2. Find every APPROVED submission for this year ────────
        // ONEFOP is quarterly — a company filing every quarter can have up
        // to 4 approved submissions in one surveyYear. Previously this
        // took only the single most-recently-created one (findFirst),
        // silently discarding the others: "Bilan RH {year}" is meant to
        // read as an annual report, but was really just whichever quarter
        // happened to be approved last.
        const submissions = await (this.prisma as any).onefopSubmission.findMany({
            where: {
                companyId: company.id,
                surveyYear: year,
                status: 'APPROVED',
            },
            orderBy: { createdAt: 'desc' }, // [0] = most recently approved
            include: {
                enterpriseDetail: true,
                cooperativeDetail: true,
                ctdDetail: true,
                ongDetail: true,
                cspGenderAge: true,
                departureData: true,
                vulnerableData: true,
                disabilityData: true,
                firstTimeWorkers: true,
                internshipData: true,
                skillNeeds: { orderBy: { skillIndex: 'asc' } },
                trainingNeeds: { orderBy: { domainIndex: 'asc' } },
                dismissalReasons: { orderBy: { reasonIndex: 'asc' } },
            },
        });

        if (submissions.length === 0) {
            // Return null — Flutter screen handles locked state
            throw new NotFoundException(
                `Aucune déclaration approuvée trouvée pour l'année ${year}.`,
            );
        }

        const latest = submissions[0];

        // ── 3. Stock metrics: snapshot from the latest approved quarter ──
        // permanentWorkers/vacancies are a headcount AT a point in time,
        // not a flow — summing them across quarters would multiply the
        // apparent headcount by ~the number of quarters filed instead of
        // reporting it, so only the most recent snapshot is used here.
        const latestDetail =
            latest.enterpriseDetail ??
            latest.cooperativeDetail ??
            latest.ctdDetail ??
            latest.ongDetail;

        const permanentWorkers: number = latestDetail?.permanentWorkers ?? 0;
        const vacancies: number = latestDetail?.vacancies ?? 0;

        // ── 4-11. Flow metrics: summed across every approved quarter ────
        let permanent = zeroCspBreakdown();
        let temporary = zeroCspBreakdown();
        let departures: BilanRhResponse['departures'] = {
            dismissals: zeroCspGender(),
            resignations: zeroCspGender(),
            retirements: zeroCspGender(),
            others: zeroCspGender(),
            total: zeroCspGender(),
        };
        let vulnerable: BilanRhResponse['vulnerableWorkers'] = {
            internalDisplaced: { permanent: 0, temporary: 0, total: 0 },
            refugees: { permanent: 0, temporary: 0, total: 0 },
            orphans: { permanent: 0, temporary: 0, total: 0 },
            total: 0,
        };
        let disabled = { permanent: 0, temporary: 0, total: 0 };
        let firstTime = { permanent: 0, temporary: 0, total: 0 };
        let internships: BilanRhResponse['internships'] = {
            holiday: 0,
            academic: 0,
            professional: 0,
            preWork: 0,
            total: 0,
        };
        // Skill/training needs are free text, independently numbered
        // 1..N per submission — merged here by matching text so the same
        // need mentioned in multiple quarters shows once with a combined
        // count rather than as repeated "#1, #1, #1" rows.
        const skillByText = new Map<string, { description: string; totalCount: number }>();
        const trainingByText = new Map<string, { domain: string; totalCount: number }>();
        const dismissalReasonsRaw: Array<{ text: string; male: number; female: number; total: number }> = [];

        for (const submission of submissions) {
            for (const row of submission.cspGenderAge) {
                const target = row.tableName === 's22q01' ? permanent : temporary;
                if (row.tableName !== 's22q01' && row.tableName !== 's22q02') continue;

                const csp = row.cspCategory === 'TOTAL' ? 'total' : cspKey[row.cspCategory];
                const g = genderKey[row.gender];
                if (!csp || !g) continue;
                if (row.ageBand !== 'TOTAL') continue; // avoid double-counting

                if (csp === 'total') {
                    target.total[g] += row.value;
                } else {
                    target[csp][g] += row.value;
                }
            }

            for (const row of submission.departureData) {
                if (row.cspCategory !== 'TOTAL') continue;
                const key = departureKey[row.departureType];
                const g = genderKey[row.gender];
                if (!g) continue;
                if (key) departures[key][g] += row.value;
                if (row.departureType === 'ENSEMBLE') departures.total[g] += row.value;
            }

            for (const row of submission.vulnerableData) {
                const vKey = vulnerableKey[row.vulnerableType];
                if (!vKey) continue;
                if (row.gender !== 'TOTAL') continue;
                const sKey = statusKey[row.status];
                if (sKey) vulnerable[vKey][sKey] += row.value;
                if (row.status === 'TOTAL') vulnerable[vKey].total += row.value;
            }

            for (const row of submission.disabilityData) {
                if (row.cspCategory !== 'TOTAL') continue;
                if (row.gender !== 'TOTAL') continue;
                if (row.status === 'PERMANENT') disabled.permanent += row.value;
                if (row.status === 'TEMPORARY') disabled.temporary += row.value;
                if (row.status === 'TOTAL') disabled.total += row.value;
            }

            for (const row of submission.firstTimeWorkers) {
                if (row.cspCategory !== 'TOTAL') continue;
                if (row.gender !== 'TOTAL') continue;
                if (row.ageBand !== 'TOTAL') continue;
                if (row.contractType === 'PERMANENT') firstTime.permanent += row.value;
                if (row.contractType === 'TEMPORARY') firstTime.temporary += row.value;
                if (row.contractType === 'TOTAL') firstTime.total += row.value;
            }

            for (const row of submission.internshipData) {
                if (row.gender !== 'TOTAL') continue;
                const iKey = internshipKey[row.internshipType];
                if (iKey) internships[iKey] += row.value;
                if (row.internshipType === 'TOTAL') internships.total += row.value;
            }

            for (const s of submission.skillNeeds) {
                if (!s.skillDescription) continue;
                const key = s.skillDescription.trim().toLowerCase();
                const existing = skillByText.get(key);
                if (existing) {
                    existing.totalCount += s.totalCount;
                } else {
                    skillByText.set(key, { description: s.skillDescription, totalCount: s.totalCount });
                }
            }

            for (const t of submission.trainingNeeds) {
                if (!t.trainingDomain) continue;
                const key = t.trainingDomain.trim().toLowerCase();
                const existing = trainingByText.get(key);
                if (existing) {
                    existing.totalCount += t.totalCount;
                } else {
                    trainingByText.set(key, { domain: t.trainingDomain, totalCount: t.totalCount });
                }
            }

            for (const r of submission.dismissalReasons) {
                if (!r.reasonText) continue;
                dismissalReasonsRaw.push({
                    text: r.reasonText,
                    male: r.maleCount,
                    female: r.femaleCount,
                    total: r.totalCount,
                });
            }
        }

        vulnerable.total =
            vulnerable.internalDisplaced.total +
            vulnerable.refugees.total +
            vulnerable.orphans.total;

        const combined = addCspBreakdown(permanent, temporary);

        const skillNeeds = Array.from(skillByText.values()).map((s, i) => ({
            index: i + 1,
            description: s.description,
            totalCount: s.totalCount,
        }));
        const trainingNeeds = Array.from(trainingByText.values()).map((t, i) => ({
            index: i + 1,
            domain: t.domain,
            totalCount: t.totalCount,
        }));
        const dismissalReasons = dismissalReasonsRaw.map((r, i) => ({ index: i + 1, ...r }));

        // ── 12. Assemble response ──────────────────────────────────
        return {
            year,
            submissionId: latest.submissionId,
            entityType: latest.formType.toLowerCase(),
            companyName: company.name,
            quarterCount: submissions.length,
            permanentWorkers,
            vacancies,
            vacancyRate: pct(vacancies, permanentWorkers),
            recruitments: { permanent, temporary, combined },
            departures,
            turnoverRate: pct(departures.total.total, permanentWorkers),
            vulnerableWorkers: vulnerable,
            disabledRecruitments: disabled,
            firstTimeWorkers: firstTime,
            internships,
            skillNeeds,
            trainingNeeds,
            dismissalReasons,
        };
    }
}