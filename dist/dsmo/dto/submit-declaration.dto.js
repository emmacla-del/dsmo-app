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
exports.SubmitDeclarationDto = exports.CreateQualitativeDto = exports.CreateMovementDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const create_company_dto_1 = require("./create-company.dto");
const create_employee_dto_1 = require("./create-employee.dto");
const prisma_types_1 = require("../../types/prisma.types");
class CreateMovementDto {
    constructor() {
        this.cat1_3 = 0;
        this.cat4_6 = 0;
        this.cat7_9 = 0;
        this.cat10_12 = 0;
        this.catNonDeclared = 0;
    }
}
exports.CreateMovementDto = CreateMovementDto;
__decorate([
    (0, class_validator_1.IsEnum)(prisma_types_1.MovementType),
    __metadata("design:type", String)
], CreateMovementDto.prototype, "movementType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMovementDto.prototype, "cat1_3", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMovementDto.prototype, "cat4_6", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMovementDto.prototype, "cat7_9", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMovementDto.prototype, "cat10_12", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMovementDto.prototype, "catNonDeclared", void 0);
class CreateQualitativeDto {
}
exports.CreateQualitativeDto = CreateQualitativeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateQualitativeDto.prototype, "hasTrainingCenter", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateQualitativeDto.prototype, "recruitmentPlansNext", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateQualitativeDto.prototype, "camerounisationPlan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateQualitativeDto.prototype, "usesTempAgencies", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQualitativeDto.prototype, "tempAgencyDetails", void 0);
class SubmitDeclarationDto {
    constructor() {
        this.language = 'fr';
    }
}
exports.SubmitDeclarationDto = SubmitDeclarationDto;
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => create_company_dto_1.CreateCompanyDto),
    __metadata("design:type", create_company_dto_1.CreateCompanyDto)
], SubmitDeclarationDto.prototype, "company", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1900),
    __metadata("design:type", Number)
], SubmitDeclarationDto.prototype, "year", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SubmitDeclarationDto.prototype, "fillingDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateMovementDto),
    __metadata("design:type", Array)
], SubmitDeclarationDto.prototype, "movements", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CreateQualitativeDto),
    __metadata("design:type", CreateQualitativeDto)
], SubmitDeclarationDto.prototype, "qualitative", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => create_employee_dto_1.CreateEmployeeDto),
    __metadata("design:type", Array)
], SubmitDeclarationDto.prototype, "employees", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SubmitDeclarationDto.prototype, "employeeCount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['fr', 'en']),
    __metadata("design:type", String)
], SubmitDeclarationDto.prototype, "language", void 0);
//# sourceMappingURL=submit-declaration.dto.js.map