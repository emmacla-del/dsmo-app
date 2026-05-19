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

    async getBilan(userId: string, year: number): Promise<BilanRhResponse> {
        // ── 1. Find the company for this user ─────────────────────
        const company = await (this.prisma as any).company.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!company) {
            throw new NotFoundException('Aucune entreprise trouvée pour cet utilisateur.');
        }

        // ── 2. Find the APPROVED submission for this year ─────────
        const submission = await (this.prisma as any).onefopSubmission.findFirst({
            where: {
                companyId: company.id,
                surveyYear: year,
                status: 'APPROVED',
            },
            orderBy: { createdAt: 'desc' },
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

        if (!submission) {
            // Return null — Flutter screen handles locked state
            throw new NotFoundException(
                `Aucune déclaration approuvée trouvée pour l'année ${year}.`,
            );
        }

        // ── 3. Extract permanentWorkers & vacancies from entity detail ──
        const detail =
            submission.enterpriseDetail ??
            submission.cooperativeDetail ??
            submission.ctdDetail ??
            submission.ongDetail;

        const permanentWorkers: number = detail?.permanentWorkers ?? 0;
        const vacancies: number = detail?.vacancies ?? 0;

        // ── 4. Build CSP recruitment tables ───────────────────────
        const permanent = zeroCspBreakdown();
        const temporary = zeroCspBreakdown();

        for (const row of submission.cspGenderAge) {
            // tableName is 's22q01' (permanent) or 's22q02' (temporary)
            const target = row.tableName === 's22q01' ? permanent : temporary;
            if (row.tableName !== 's22q01' && row.tableName !== 's22q02') continue;

            const csp = row.cspCategory === 'TOTAL' ? 'total' : cspKey[row.cspCategory];
            const g = genderKey[row.gender];
            if (!csp || !g) continue;

            // Only use TOTAL ageBand to avoid double-counting
            if (row.ageBand !== 'TOTAL') continue;

            if (csp === 'total') {
                target.total[g] += row.value;
            } else {
                target[csp][g] += row.value;
            }
        }

        const combined = addCspBreakdown(permanent, temporary);

        // ── 5. Build departures ────────────────────────────────────
        const departures: BilanRhResponse['departures'] = {
            dismissals: zeroCspGender(),
            resignations: zeroCspGender(),
            retirements: zeroCspGender(),
            others: zeroCspGender(),
            total: zeroCspGender(),
        };

        for (const row of submission.departureData) {
            if (row.cspCategory !== 'TOTAL') continue; // aggregate totals only
            const key = departureKey[row.departureType];
            const g = genderKey[row.gender];
            if (!g) continue;

            if (key) {
                departures[key][g] += row.value;
            }
            if (row.departureType === 'ENSEMBLE') {
                departures.total[g] += row.value;
            }
        }

        // ── 6. Build vulnerable workers ───────────────────────────
        const vulnerable: BilanRhResponse['vulnerableWorkers'] = {
            internalDisplaced: { permanent: 0, temporary: 0, total: 0 },
            refugees: { permanent: 0, temporary: 0, total: 0 },
            orphans: { permanent: 0, temporary: 0, total: 0 },
            total: 0,
        };

        for (const row of submission.vulnerableData) {
            const vKey = vulnerableKey[row.vulnerableType];
            if (!vKey) continue;
            if (row.gender !== 'TOTAL') continue; // use totals only

            const sKey = statusKey[row.status];
            if (sKey) {
                vulnerable[vKey][sKey] += row.value;
            }
            if (row.status === 'TOTAL') {
                vulnerable[vKey].total += row.value;
            }
        }
        vulnerable.total =
            vulnerable.internalDisplaced.total +
            vulnerable.refugees.total +
            vulnerable.orphans.total;

        // ── 7. Disabled recruitments ───────────────────────────────
        const disabled = { permanent: 0, temporary: 0, total: 0 };
        for (const row of submission.disabilityData) {
            if (row.cspCategory !== 'TOTAL') continue;
            if (row.gender !== 'TOTAL') continue;
            if (row.status === 'PERMANENT') disabled.permanent += row.value;
            if (row.status === 'TEMPORARY') disabled.temporary += row.value;
            if (row.status === 'TOTAL') disabled.total += row.value;
        }

        // ── 8. First-time workers ─────────────────────────────────
        const firstTime = { permanent: 0, temporary: 0, total: 0 };
        for (const row of submission.firstTimeWorkers) {
            if (row.cspCategory !== 'TOTAL') continue;
            if (row.gender !== 'TOTAL') continue;
            if (row.ageBand !== 'TOTAL') continue;
            if (row.contractType === 'PERMANENT') firstTime.permanent += row.value;
            if (row.contractType === 'TEMPORARY') firstTime.temporary += row.value;
            if (row.contractType === 'TOTAL') firstTime.total += row.value;
        }

        // ── 9. Internships ────────────────────────────────────────
        const internships: BilanRhResponse['internships'] = {
            holiday: 0,
            academic: 0,
            professional: 0,
            preWork: 0,
            total: 0,
        };
        for (const row of submission.internshipData) {
            if (row.gender !== 'TOTAL') continue;
            const iKey = internshipKey[row.internshipType];
            if (iKey) internships[iKey] += row.value;
            if (row.internshipType === 'TOTAL') internships.total += row.value;
        }

        // ── 10. Skills & Training ──────────────────────────────────
        const skillNeeds = submission.skillNeeds
            .filter((s: any) => s.skillDescription)
            .map((s: any) => ({
                index: s.skillIndex,
                description: s.skillDescription ?? '',
                totalCount: s.totalCount,
            }));

        const trainingNeeds = submission.trainingNeeds
            .filter((t: any) => t.trainingDomain)
            .map((t: any) => ({
                index: t.domainIndex,
                domain: t.trainingDomain ?? '',
                totalCount: t.totalCount,
            }));

        // ── 11. Dismissal reasons ──────────────────────────────────
        const dismissalReasons = submission.dismissalReasons
            .filter((r: any) => r.reasonText)
            .map((r: any) => ({
                index: r.reasonIndex,
                text: r.reasonText ?? '',
                male: r.maleCount,
                female: r.femaleCount,
                total: r.totalCount,
            }));

        // ── 12. Assemble response ──────────────────────────────────
        return {
            year,
            submissionId: submission.submissionId,
            entityType: submission.formType.toLowerCase(),
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