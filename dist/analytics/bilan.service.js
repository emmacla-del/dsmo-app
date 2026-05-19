"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BilanService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function zeroCspGender() {
    return { male: 0, female: 0, total: 0 };
}
function zeroCspBreakdown() {
    return {
        executives: zeroCspGender(),
        foremen: zeroCspGender(),
        workers: zeroCspGender(),
        total: zeroCspGender(),
    };
}
function addCspGender(a, b) {
    return {
        male: a.male + b.male,
        female: a.female + b.female,
        total: a.total + b.total,
    };
}
function addCspBreakdown(a, b) {
    return {
        executives: addCspGender(a.executives, b.executives),
        foremen: addCspGender(a.foremen, b.foremen),
        workers: addCspGender(a.workers, b.workers),
        total: addCspGender(a.total, b.total),
    };
}
const cspKey = {
    CADRES: 'executives',
    FOREMEN: 'foremen',
    WORKERS: 'workers',
};
const genderKey = {
    MALE: 'male',
    FEMALE: 'female',
    TOTAL: 'total',
};
const vulnerableKey = {
    DEPLACES_INTERNES: 'internalDisplaced',
    REFUGIES: 'refugees',
    ORPHELINS: 'orphans',
};
const statusKey = {
    PERMANENT: 'permanent',
    TEMPORARY: 'temporary',
};
const departureKey = {
    DISMISSAL: 'dismissals',
    RESIGNATION: 'resignations',
    RETIREMENT: 'retirements',
    OTHER: 'others',
};
const internshipKey = {
    VACATION: 'holiday',
    ACADEMIC: 'academic',
    PROFESSIONAL: 'professional',
    PRE_EMPLOYMENT: 'preWork',
};
function pct(numerator, denominator) {
    if (denominator === 0)
        return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
}
let BilanService = class BilanService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBilan(userId, year) {
        const company = await this.prisma.company.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!company) {
            throw new common_1.NotFoundException('Aucune entreprise trouvée pour cet utilisateur.');
        }
        const submission = await this.prisma.onefopSubmission.findFirst({
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
            throw new common_1.NotFoundException(`Aucune déclaration approuvée trouvée pour l'année ${year}.`);
        }
        const detail = submission.enterpriseDetail ??
            submission.cooperativeDetail ??
            submission.ctdDetail ??
            submission.ongDetail;
        const permanentWorkers = detail?.permanentWorkers ?? 0;
        const vacancies = detail?.vacancies ?? 0;
        const permanent = zeroCspBreakdown();
        const temporary = zeroCspBreakdown();
        for (const row of submission.cspGenderAge) {
            const target = row.tableName === 's22q01' ? permanent : temporary;
            if (row.tableName !== 's22q01' && row.tableName !== 's22q02')
                continue;
            const csp = row.cspCategory === 'TOTAL' ? 'total' : cspKey[row.cspCategory];
            const g = genderKey[row.gender];
            if (!csp || !g)
                continue;
            if (row.ageBand !== 'TOTAL')
                continue;
            if (csp === 'total') {
                target.total[g] += row.value;
            }
            else {
                target[csp][g] += row.value;
            }
        }
        const combined = addCspBreakdown(permanent, temporary);
        const departures = {
            dismissals: zeroCspGender(),
            resignations: zeroCspGender(),
            retirements: zeroCspGender(),
            others: zeroCspGender(),
            total: zeroCspGender(),
        };
        for (const row of submission.departureData) {
            if (row.cspCategory !== 'TOTAL')
                continue;
            const key = departureKey[row.departureType];
            const g = genderKey[row.gender];
            if (!g)
                continue;
            if (key) {
                departures[key][g] += row.value;
            }
            if (row.departureType === 'ENSEMBLE') {
                departures.total[g] += row.value;
            }
        }
        const vulnerable = {
            internalDisplaced: { permanent: 0, temporary: 0, total: 0 },
            refugees: { permanent: 0, temporary: 0, total: 0 },
            orphans: { permanent: 0, temporary: 0, total: 0 },
            total: 0,
        };
        for (const row of submission.vulnerableData) {
            const vKey = vulnerableKey[row.vulnerableType];
            if (!vKey)
                continue;
            if (row.gender !== 'TOTAL')
                continue;
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
        const disabled = { permanent: 0, temporary: 0, total: 0 };
        for (const row of submission.disabilityData) {
            if (row.cspCategory !== 'TOTAL')
                continue;
            if (row.gender !== 'TOTAL')
                continue;
            if (row.status === 'PERMANENT')
                disabled.permanent += row.value;
            if (row.status === 'TEMPORARY')
                disabled.temporary += row.value;
            if (row.status === 'TOTAL')
                disabled.total += row.value;
        }
        const firstTime = { permanent: 0, temporary: 0, total: 0 };
        for (const row of submission.firstTimeWorkers) {
            if (row.cspCategory !== 'TOTAL')
                continue;
            if (row.gender !== 'TOTAL')
                continue;
            if (row.ageBand !== 'TOTAL')
                continue;
            if (row.contractType === 'PERMANENT')
                firstTime.permanent += row.value;
            if (row.contractType === 'TEMPORARY')
                firstTime.temporary += row.value;
            if (row.contractType === 'TOTAL')
                firstTime.total += row.value;
        }
        const internships = {
            holiday: 0,
            academic: 0,
            professional: 0,
            preWork: 0,
            total: 0,
        };
        for (const row of submission.internshipData) {
            if (row.gender !== 'TOTAL')
                continue;
            const iKey = internshipKey[row.internshipType];
            if (iKey)
                internships[iKey] += row.value;
            if (row.internshipType === 'TOTAL')
                internships.total += row.value;
        }
        const skillNeeds = submission.skillNeeds
            .filter((s) => s.skillDescription)
            .map((s) => ({
            index: s.skillIndex,
            description: s.skillDescription ?? '',
            totalCount: s.totalCount,
        }));
        const trainingNeeds = submission.trainingNeeds
            .filter((t) => t.trainingDomain)
            .map((t) => ({
            index: t.domainIndex,
            domain: t.trainingDomain ?? '',
            totalCount: t.totalCount,
        }));
        const dismissalReasons = submission.dismissalReasons
            .filter((r) => r.reasonText)
            .map((r) => ({
            index: r.reasonIndex,
            text: r.reasonText ?? '',
            male: r.maleCount,
            female: r.femaleCount,
            total: r.totalCount,
        }));
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
};
exports.BilanService = BilanService;
exports.BilanService = BilanService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BilanService);
//# sourceMappingURL=bilan.service.js.map