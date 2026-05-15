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
exports.DsmoController = void 0;
const common_1 = require("@nestjs/common");
const dsmo_service_1 = require("./dsmo.service");
const notification_service_1 = require("./notification.service");
const analytics_service_1 = require("./analytics.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const submit_declaration_dto_1 = require("./dto/submit-declaration.dto");
const register_company_profile_dto_1 = require("./dto/register-company-profile.dto");
const prisma_types_1 = require("../types/prisma.types");
let DsmoController = class DsmoController {
    constructor(dsmoService, notificationService, analyticsService) {
        this.dsmoService = dsmoService;
        this.notificationService = notificationService;
        this.analyticsService = analyticsService;
    }
    async getMyCompany(req) {
        const company = await this.dsmoService.getMyCompany(req.user.id);
        if (!company)
            throw new common_1.NotFoundException('Aucun profil entreprise trouvé.');
        return company;
    }
    async saveCompanyProfile(req, dto) {
        return this.dsmoService.saveCompanyProfile(req.user.id, dto);
    }
    async submitDeclaration(req, dto) {
        return this.dsmoService.submitDeclaration(req.user.id, dto);
    }
    async getPending(req) {
        return this.dsmoService.getPendingDeclarations(req.user);
    }
    async validate(id, req, accept, rejectionReason) {
        return this.dsmoService.validateDeclaration(id, req.user.id, accept, rejectionReason);
    }
    async getDeclarations(req, year, status, region, department) {
        return this.dsmoService.getDeclarationsForUser(req.user.id, {
            year: year ? parseInt(year, 10) : undefined,
            status,
            region,
            department,
        });
    }
    async getDeclaration(id, req) {
        return this.dsmoService.getDeclarationWithAccess(req.user.id, id);
    }
    async getDeclarationStats(year, region, department) {
        return this.dsmoService.getDeclarationStats(year, region, department);
    }
    async sendNotification(req, subject, message, filters) {
        return this.notificationService.sendNotification(req.user.id, subject, message, filters);
    }
    async getNotifications(req, page = 1, limit = 20) {
        return this.notificationService.getNotifications(req.user.id, page, limit);
    }
    async getEmploymentByRegion(year) {
        return this.analyticsService.getEmploymentByRegion(year);
    }
    async getGenderDistribution(year, region) {
        return this.analyticsService.getGenderDistribution(year, region);
    }
    async getDashboardSummary(year, region) {
        return this.analyticsService.getDashboardSummary(year, region);
    }
    async getEmploymentTrends(startYear, endYear, region) {
        return this.analyticsService.getEmploymentTrends(startYear, endYear, region);
    }
    async getSectorDistribution(year, region) {
        return this.analyticsService.getSectorDistribution(year, region);
    }
    async downloadPdf(id, copy, req, res) {
        const url = await this.dsmoService.getPdfPath(id, req.user.id, copy);
        res.redirect(url);
    }
};
exports.DsmoController = DsmoController;
__decorate([
    (0, common_1.Get)('company'),
    (0, roles_decorator_1.Roles)('COMPANY'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getMyCompany", null);
__decorate([
    (0, common_1.Post)('company'),
    (0, roles_decorator_1.Roles)('COMPANY'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, register_company_profile_dto_1.RegisterCompanyProfileDto]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "saveCompanyProfile", null);
__decorate([
    (0, common_1.Post)('declaration'),
    (0, roles_decorator_1.Roles)('COMPANY'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, submit_declaration_dto_1.SubmitDeclarationDto]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "submitDeclaration", null);
__decorate([
    (0, common_1.Get)('declarations/pending'),
    (0, roles_decorator_1.Roles)('DIVISIONAL', 'REGIONAL', 'CENTRAL', 'SUPER_ADMIN'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getPending", null);
__decorate([
    (0, common_1.Patch)('declarations/:id/validate'),
    (0, roles_decorator_1.Roles)('DIVISIONAL', 'REGIONAL', 'CENTRAL'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Body)('accept')),
    __param(3, (0, common_1.Body)('rejectionReason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Boolean, String]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "validate", null);
__decorate([
    (0, common_1.Get)('declarations'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('year')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('region')),
    __param(4, (0, common_1.Query)('department')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getDeclarations", null);
__decorate([
    (0, common_1.Get)('declarations/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getDeclaration", null);
__decorate([
    (0, common_1.Get)('stats/summary'),
    (0, roles_decorator_1.Roles)('DIVISIONAL', 'REGIONAL', 'CENTRAL'),
    __param(0, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('region')),
    __param(2, (0, common_1.Query)('department')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getDeclarationStats", null);
__decorate([
    (0, common_1.Post)('notifications/send'),
    (0, roles_decorator_1.Roles)('DIVISIONAL', 'REGIONAL', 'CENTRAL'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)('subject')),
    __param(2, (0, common_1.Body)('message')),
    __param(3, (0, common_1.Body)('filters')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "sendNotification", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getNotifications", null);
__decorate([
    (0, roles_decorator_1.Roles)('CENTRAL', 'SUPER_ADMIN'),
    (0, common_1.Get)('analytics/employment-by-region'),
    __param(0, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getEmploymentByRegion", null);
__decorate([
    (0, roles_decorator_1.Roles)('CENTRAL', 'SUPER_ADMIN'),
    (0, common_1.Get)('analytics/gender-distribution'),
    __param(0, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('region')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getGenderDistribution", null);
__decorate([
    (0, roles_decorator_1.Roles)('CENTRAL', 'REGIONAL', 'SUPER_ADMIN'),
    (0, common_1.Get)('analytics/dashboard-summary'),
    __param(0, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('region')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getDashboardSummary", null);
__decorate([
    (0, roles_decorator_1.Roles)('CENTRAL', 'REGIONAL', 'SUPER_ADMIN'),
    (0, common_1.Get)('analytics/employment-trends'),
    __param(0, (0, common_1.Query)('startYear', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('endYear', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('region')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getEmploymentTrends", null);
__decorate([
    (0, roles_decorator_1.Roles)('CENTRAL', 'REGIONAL', 'SUPER_ADMIN'),
    (0, common_1.Get)('analytics/sector-distribution'),
    __param(0, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('region')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "getSectorDistribution", null);
__decorate([
    (0, common_1.Get)('declarations/:id/pdf/:copy'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('copy', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], DsmoController.prototype, "downloadPdf", null);
exports.DsmoController = DsmoController = __decorate([
    (0, common_1.Controller)('dsmo'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [dsmo_service_1.DsmoService,
        notification_service_1.NotificationService,
        analytics_service_1.AnalyticsService])
], DsmoController);
//# sourceMappingURL=dsmo.controller.js.map