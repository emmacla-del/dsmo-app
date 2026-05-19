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
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const analytics_service_1 = require("./analytics.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let AnalyticsController = class AnalyticsController {
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    async getEmploymentByRegion(year) {
        return this.analyticsService.getEmploymentByRegion(year);
    }
    async getEmploymentTrends(startYear, endYear, region, granularity) {
        return this.analyticsService.getEmploymentTrends(startYear, endYear, region, granularity ?? 'year');
    }
    async getSectorDistribution(year, region) {
        return this.analyticsService.getSectorDistribution(year, region);
    }
    async getGenderDistribution(year, region) {
        return this.analyticsService.getGenderDistribution(year, region);
    }
    async getCategoryDistribution(year) {
        return this.analyticsService.getCategoryDistribution(year);
    }
    async getRecruitmentForecast(years, forecastYears) {
        return this.analyticsService.getRecruitmentForecast(years, forecastYears);
    }
    async getUnemploymentRiskRegions(year) {
        return this.analyticsService.getUnemploymentRiskRegions(year);
    }
    async getSectorLaborShortages(year) {
        return this.analyticsService.getSectorLaborShortages(year);
    }
    async getCompaniesWithRecruitmentPlans(year, limit) {
        return this.analyticsService.getCompaniesWithRecruitmentPlans(year, limit);
    }
    async getDashboardSummary(year, region) {
        return this.analyticsService.getDashboardSummary(year, region);
    }
    async exportData(startYear, endYear, region, format = 'csv', res) {
        const start = Number(startYear) || new Date().getFullYear() - 4;
        const end = Number(endYear) || new Date().getFullYear();
        const [trends, summary] = await Promise.all([
            this.analyticsService.getEmploymentTrends(start, end, region, 'year'),
            this.analyticsService.getDashboardSummary(end, region),
        ]);
        if (format === 'json') {
            return res.json({ trends, summary });
        }
        const lines = [
            'year,period,label,totalEmployees'
        ];
        for (const t of trends) {
            lines.push(`${t.year},"${t.period ?? ''}","${t.label ?? t.year}",${t.totalEmployees ?? 0}`);
        }
        const csv = lines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="dsmo_export_${start}-${end}.csv"`);
        res.send(csv);
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('employment-by-region'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getEmploymentByRegion", null);
__decorate([
    (0, common_1.Get)('employment-trends'),
    __param(0, (0, common_1.Query)('startYear')),
    __param(1, (0, common_1.Query)('endYear')),
    __param(2, (0, common_1.Query)('region')),
    __param(3, (0, common_1.Query)('granularity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getEmploymentTrends", null);
__decorate([
    (0, common_1.Get)('sector-distribution'),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('region')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getSectorDistribution", null);
__decorate([
    (0, common_1.Get)('gender-distribution'),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('region')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getGenderDistribution", null);
__decorate([
    (0, common_1.Get)('category-distribution'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getCategoryDistribution", null);
__decorate([
    (0, common_1.Get)('recruitment-forecast'),
    __param(0, (0, common_1.Query)('years')),
    __param(1, (0, common_1.Query)('forecastYears')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getRecruitmentForecast", null);
__decorate([
    (0, common_1.Get)('unemployment-risk-regions'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getUnemploymentRiskRegions", null);
__decorate([
    (0, common_1.Get)('sector-labor-shortages'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getSectorLaborShortages", null);
__decorate([
    (0, common_1.Get)('companies-with-recruitment-plans'),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getCompaniesWithRecruitmentPlans", null);
__decorate([
    (0, common_1.Get)('dashboard-summary'),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('region')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getDashboardSummary", null);
__decorate([
    (0, common_1.Get)('export'),
    __param(0, (0, common_1.Query)('startYear')),
    __param(1, (0, common_1.Query)('endYear')),
    __param(2, (0, common_1.Query)('region')),
    __param(3, (0, common_1.Query)('format')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, String, Object]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "exportData", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, common_1.Controller)('dsmo/analytics'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN'),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map