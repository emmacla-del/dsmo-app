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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnefopAnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const onefop_analytics_service_1 = require("./onefop-analytics.service");
function toInt(val) {
    const n = parseInt(val, 10);
    return isNaN(n) ? undefined : n;
}
let OnefopAnalyticsController = class OnefopAnalyticsController {
    constructor(analytics) {
        this.analytics = analytics;
    }
    getEmployment(q) {
        return this.analytics.getEmploymentByLocation({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            groupBy: q.groupBy || 'region',
        });
    }
    getRecruitmentTrends(q) {
        return this.analytics.getRecruitmentTrends({
            startYear: toInt(q.startYear),
            endYear: toInt(q.endYear),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            granularity: q.granularity || 'year',
        });
    }
    getHires(q) {
        return this.analytics.getHiresByDemographics({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            csp: q.csp,
            gender: q.gender,
            ageGroup: q.ageGroup,
        });
    }
    getHiresByDiploma(q) {
        return this.analytics.getHiresByDiploma({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            diploma: q.diploma,
            limit: toInt(q.limit),
        });
    }
    getVacancies(q) {
        return this.analytics.getVacanciesBySegment({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            groupBy: q.groupBy || 'companySize',
        });
    }
    getSkills(q) {
        return this.analytics.getSkillDemand({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            limit: toInt(q.limit),
        });
    }
    getTrainingGap(q) {
        return this.analytics.getTrainingGap({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }
    getGenderParity(q) {
        return this.analytics.getGenderParity({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }
    getYouthEmployment(q) {
        return this.analytics.getYouthEmployment({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }
    getInclusion(q) {
        return this.analytics.getInclusionMetrics({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
            breakdownBy: q.breakdownBy,
        });
    }
    getDashboard(q) {
        return this.analytics.getDashboardSummary({
            year: toInt(q.year),
            region: q.region,
            department: q.department,
            subdivision: q.subdivision,
        });
    }
};
exports.OnefopAnalyticsController = OnefopAnalyticsController;
__decorate([
    (0, common_1.Get)('employment'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getEmployment", null);
__decorate([
    (0, common_1.Get)('recruitment-trends'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getRecruitmentTrends", null);
__decorate([
    (0, common_1.Get)('hires'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getHires", null);
__decorate([
    (0, common_1.Get)('hires/diploma'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getHiresByDiploma", null);
__decorate([
    (0, common_1.Get)('vacancies'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getVacancies", null);
__decorate([
    (0, common_1.Get)('skills'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getSkills", null);
__decorate([
    (0, common_1.Get)('training-gap'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getTrainingGap", null);
__decorate([
    (0, common_1.Get)('gender-parity'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getGenderParity", null);
__decorate([
    (0, common_1.Get)('youth-employment'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getYouthEmployment", null);
__decorate([
    (0, common_1.Get)('inclusion'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getInclusion", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OnefopAnalyticsController.prototype, "getDashboard", null);
exports.OnefopAnalyticsController = OnefopAnalyticsController = __decorate([
    (0, common_1.Controller)('onefop-analytics'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN'),
    __metadata("design:paramtypes", [onefop_analytics_service_1.OnefopAnalyticsService])
], OnefopAnalyticsController);
//# sourceMappingURL=onefop-analytics.controller.js.map