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
exports.SectorsController = void 0;
const common_1 = require("@nestjs/common");
const sectors_service_1 = require("./sectors.service");
let SectorsController = class SectorsController {
    constructor(sectorsService) {
        this.sectorsService = sectorsService;
    }
    async getAllSectors() {
        return this.sectorsService.getAllSectors();
    }
    async getSectorById(id) {
        return this.sectorsService.getSectorById(id);
    }
    async getSectorsByCategory(category) {
        return this.sectorsService.getSectorsByCategory(category);
    }
};
exports.SectorsController = SectorsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SectorsController.prototype, "getAllSectors", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SectorsController.prototype, "getSectorById", null);
__decorate([
    (0, common_1.Get)('category/:category'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SectorsController.prototype, "getSectorsByCategory", null);
exports.SectorsController = SectorsController = __decorate([
    (0, common_1.Controller)('sectors'),
    __metadata("design:paramtypes", [sectors_service_1.SectorsService])
], SectorsController);
//# sourceMappingURL=sectors.controller.js.map