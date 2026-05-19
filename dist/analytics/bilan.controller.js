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
exports.BilanController = void 0;
const common_1 = require("@nestjs/common");
const bilan_service_1 = require("./bilan.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let BilanController = class BilanController {
    constructor(bilanService) {
        this.bilanService = bilanService;
    }
    async getBilan(req, year) {
        return this.bilanService.getBilan(req.user.id, year);
    }
};
exports.BilanController = BilanController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('bilan'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('year', new common_1.DefaultValuePipe(new Date().getFullYear()), common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], BilanController.prototype, "getBilan", null);
exports.BilanController = BilanController = __decorate([
    (0, common_1.Controller)('dsmo/analytics'),
    __metadata("design:paramtypes", [bilan_service_1.BilanService])
], BilanController);
//# sourceMappingURL=bilan.controller.js.map