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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const local_auth_guard_1 = require("./local-auth.guard");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const roles_guard_1 = require("./roles.guard");
const roles_decorator_1 = require("./roles.decorator");
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async login(req) {
        return this.authService.login(req.user);
    }
    async register(body) {
        try {
            const user = await this.authService.register(body.email, body.password, body.firstName, body.lastName, body.role, body.region, body.department, body.matricule, body.poste, body.serviceCode);
            if (body.role !== 'COMPANY') {
                return { message: "Inscription reçue. Votre compte est en attente d'approbation par un administrateur." };
            }
            return this.authService.login(user);
        }
        catch (error) {
            throw error;
        }
    }
    async registerCompany(body) {
        return this.authService.registerCompany(body.email, body.password, {
            name: body.companyName,
            parentCompany: body.parentCompany,
            mainActivity: body.mainActivity,
            secondaryActivity: body.secondaryActivity,
            region: body.region,
            department: body.department,
            subdivision: body.subdivision,
            address: body.address,
            taxNumber: body.taxNumber,
            cnpsNumber: body.cnpsNumber,
            socialCapital: body.socialCapital,
            contactName: body.contactName,
            entityType: body.entityType,
            area: body.area,
            sectorId: body.sectorId,
            phone: body.phone,
            phone2: body.phone2,
            poBox: body.poBox,
            legalStatus: body.legalStatus,
            cooperativeType: body.cooperativeType,
            ctdType: body.ctdType,
            yearOfCreation: body.yearOfCreation,
            mainMission: body.mainMission,
            registrationNumber: body.registrationNumber,
            trainingDomains: body.trainingDomains,
            respondentPhone: body.respondentPhone,
            respondentPhone2: body.respondentPhone2,
            respondentFunction: body.respondentFunction,
            respondentFirstName: body.respondentFirstName ?? body.firstName,
            respondentLastName: body.respondentLastName ?? body.lastName,
            branch: body.branch,
        });
    }
    async getPendingMinefopUsers() {
        return this.authService.getPendingMinefopUsers();
    }
    async approveUser(id) {
        return this.authService.approveUser(id);
    }
    async rejectUser(id, reason) {
        return this.authService.rejectUser(id);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.UseGuards)(local_auth_guard_1.LocalAuthGuard),
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('register-company'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "registerCompany", null);
__decorate([
    (0, common_1.Get)('pending-minefop'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getPendingMinefopUsers", null);
__decorate([
    (0, common_1.Patch)('approve-user/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "approveUser", null);
__decorate([
    (0, common_1.Patch)('reject-user/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "rejectUser", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map