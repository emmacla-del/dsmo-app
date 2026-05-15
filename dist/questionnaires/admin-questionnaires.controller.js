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
exports.AdminQuestionnairesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const questionnaires_service_1 = require("./questionnaires.service");
let AdminQuestionnairesController = class AdminQuestionnairesController {
    constructor(service) {
        this.service = service;
    }
    async getPending(limit, offset) {
        return this.service.listByStatus('PENDING_REVIEW', limit ?? 100, offset ?? 0);
    }
    async getCorrectionRequested(limit, offset) {
        return this.service.listByStatus('CORRECTION_REQUESTED', limit ?? 100, offset ?? 0);
    }
    async getOne(id) {
        return this.service.getById(id);
    }
    async approve(id, req) {
        return this.service.approve(id, req.user?.sub);
    }
    async reject(id, reason, req) {
        return this.service.reject(id, reason, req.user?.sub);
    }
    async requestCorrection(id, comments, req) {
        return this.service.requestCorrection(id, comments, req.user?.sub);
    }
};
exports.AdminQuestionnairesController = AdminQuestionnairesController;
__decorate([
    (0, common_1.Get)('pending'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], AdminQuestionnairesController.prototype, "getPending", null);
__decorate([
    (0, common_1.Get)('correction-requested'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], AdminQuestionnairesController.prototype, "getCorrectionRequested", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminQuestionnairesController.prototype, "getOne", null);
__decorate([
    (0, common_1.Patch)(':id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminQuestionnairesController.prototype, "approve", null);
__decorate([
    (0, common_1.Patch)(':id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('reason')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminQuestionnairesController.prototype, "reject", null);
__decorate([
    (0, common_1.Patch)(':id/request-correction'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('comments')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminQuestionnairesController.prototype, "requestCorrection", null);
exports.AdminQuestionnairesController = AdminQuestionnairesController = __decorate([
    (0, common_1.Controller)('admin/questionnaires'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('CENTRAL', 'REGIONAL', 'DIVISIONAL', 'SUPER_ADMIN'),
    __metadata("design:paramtypes", [questionnaires_service_1.QuestionnairesService])
], AdminQuestionnairesController);
//# sourceMappingURL=admin-questionnaires.controller.js.map