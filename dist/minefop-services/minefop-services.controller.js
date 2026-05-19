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
exports.MinefopServicesController = void 0;
const common_1 = require("@nestjs/common");
const minefop_services_service_1 = require("./minefop-services.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const client_1 = require("@prisma/client");
const dto_1 = require("./dto");
let MinefopServicesController = class MinefopServicesController {
    constructor(svc) {
        this.svc = svc;
    }
    async findAll(category) {
        return this.svc.findAll(category);
    }
    async getTree(category) {
        return this.svc.getTree(category);
    }
    async getRoots(category) {
        return this.svc.getRoots(category);
    }
    async getChildren(parentCode) {
        if (!parentCode) {
            throw new common_1.BadRequestException('parentCode query parameter is required');
        }
        return this.svc.getChildren(parentCode);
    }
    async getStats() {
        return this.svc.getServiceStats();
    }
    async getRegionRequiredServices() {
        return this.svc.getServicesByRegion();
    }
    async createService(createServiceDto) {
        return this.svc.createService(createServiceDto);
    }
    async createPosition(createPositionDto) {
        return this.svc.createPosition(createPositionDto);
    }
    async updatePosition(id, updatePositionDto) {
        return this.svc.updatePosition(id, updatePositionDto);
    }
    async deletePosition(id) {
        await this.svc.deletePosition(id);
    }
    async getByCode(code) {
        return this.svc.getServiceByCode(code);
    }
    async getByRole(role) {
        return this.svc.getServicesByRole(role);
    }
    async getPositions(code) {
        return this.svc.getPositionsByService(code);
    }
    async getHierarchyPath(code) {
        return this.svc.getServiceHierarchyPath(code);
    }
    async updateService(code, updateServiceDto) {
        return this.svc.updateService(code, updateServiceDto);
    }
    async hardDeleteService(code) {
        await this.svc.hardDeleteService(code);
    }
    async deleteService(code) {
        await this.svc.deleteService(code);
    }
    async getById(id) {
        return this.svc.getServiceById(id);
    }
};
exports.MinefopServicesController = MinefopServicesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('category', new common_1.ParseEnumPipe(client_1.$Enums.ServiceCategory, { optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('tree'),
    __param(0, (0, common_1.Query)('category', new common_1.ParseEnumPipe(client_1.$Enums.ServiceCategory, { optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getTree", null);
__decorate([
    (0, common_1.Get)('roots'),
    __param(0, (0, common_1.Query)('category', new common_1.ParseEnumPipe(client_1.$Enums.ServiceCategory, { optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getRoots", null);
__decorate([
    (0, common_1.Get)('children'),
    __param(0, (0, common_1.Query)('parentCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getChildren", null);
__decorate([
    (0, common_1.Get)('stats/summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('region-required/list'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getRegionRequiredServices", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateServiceDto]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "createService", null);
__decorate([
    (0, common_1.Post)('positions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreatePositionDto]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "createPosition", null);
__decorate([
    (0, common_1.Patch)('positions/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdatePositionDto]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "updatePosition", null);
__decorate([
    (0, common_1.Delete)('positions/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "deletePosition", null);
__decorate([
    (0, common_1.Get)('code/:code'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getByCode", null);
__decorate([
    (0, common_1.Get)('role/:role'),
    __param(0, (0, common_1.Param)('role', new common_1.ParseEnumPipe(client_1.$Enums.UserRole))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getByRole", null);
__decorate([
    (0, common_1.Get)(':code/positions'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getPositions", null);
__decorate([
    (0, common_1.Get)(':code/hierarchy-path'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getHierarchyPath", null);
__decorate([
    (0, common_1.Patch)(':code'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.UpdateServiceDto]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "updateService", null);
__decorate([
    (0, common_1.Delete)(':code/hard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "hardDeleteService", null);
__decorate([
    (0, common_1.Delete)(':code'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "deleteService", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MinefopServicesController.prototype, "getById", null);
exports.MinefopServicesController = MinefopServicesController = __decorate([
    (0, common_1.Controller)('minefop-services'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    __metadata("design:paramtypes", [minefop_services_service_1.MinefopServicesService])
], MinefopServicesController);
//# sourceMappingURL=minefop-services.controller.js.map