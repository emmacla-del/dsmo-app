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
exports.OnefopExportDto = void 0;
const class_validator_1 = require("class-validator");
class OnefopExportDto {
    constructor() {
        this.exportType = 'detailed';
        this.language = 'fr';
    }
}
exports.OnefopExportDto = OnefopExportDto;
__decorate([
    (0, class_validator_1.IsIn)(['csv', 'excel', 'json']),
    __metadata("design:type", String)
], OnefopExportDto.prototype, "format", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], OnefopExportDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], OnefopExportDto.prototype, "endDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['enterprise', 'cooperative', 'ctd', 'ong']),
    __metadata("design:type", String)
], OnefopExportDto.prototype, "entityType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['summary', 'detailed', 'raw']),
    __metadata("design:type", String)
], OnefopExportDto.prototype, "exportType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['fr', 'en']),
    __metadata("design:type", String)
], OnefopExportDto.prototype, "language", void 0);
//# sourceMappingURL=onefop-export.dto.js.map