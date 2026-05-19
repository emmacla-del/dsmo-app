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
exports.ValidationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const prisma_types_1 = require("../types/prisma.types");
let ValidationService = class ValidationService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async validateDeclaration(declarationId) {
        const declaration = await this.prisma.declaration.findUnique({
            where: { id: declarationId },
            include: { employees: true, movements: true },
        });
        if (!declaration)
            throw new Error('Declaration not found');
        const errors = [];
        const genderCheck = await this.validateGenderSum(declaration);
        if (!genderCheck.valid && genderCheck.message)
            errors.push(genderCheck.message);
        const categoryCheck = await this.validateCategorySum(declaration);
        if (!categoryCheck.valid && categoryCheck.message)
            errors.push(categoryCheck.message);
        const movementCheck = await this.validateMovementConsistency(declaration);
        if (!movementCheck.valid && movementCheck.message)
            errors.push(movementCheck.message);
        const growthCheck = await this.validateWorkforceGrowth(declaration);
        if (!growthCheck.valid && growthCheck.message)
            errors.push(growthCheck.message);
        const employeeCheck = await this.validateEmployees(declaration);
        if (!employeeCheck.valid)
            errors.push(...employeeCheck.messages);
        await this.logValidationSteps(declarationId, errors);
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    async validateGenderSum(declaration) {
        const employees = await this.prisma.employee.findMany({
            where: { declarationId: declaration.id },
        });
        const totalEmployees = employees.length;
        const males = employees.filter((e) => e.gender === 'M').length;
        const females = employees.filter((e) => e.gender === 'F').length;
        if (males + females !== totalEmployees && totalEmployees > 0) {
            return {
                valid: false,
                message: `Gender sum validation failed: Males (${males}) + Females (${females}) ≠ Total (${totalEmployees})`,
            };
        }
        return { valid: true };
    }
    async validateCategorySum(declaration) {
        const employees = await this.prisma.employee.findMany({
            where: { declarationId: declaration.id },
        });
        const totalEmployees = employees.length;
        if (totalEmployees === 0)
            return { valid: true };
        const knownCategories = new Set(['1-3', '4-6', '7-9', '10-12', 'non-declared']);
        const counted = employees.filter((e) => e.salaryCategory && knownCategories.has(e.salaryCategory)).length;
        const legacy = employees.filter((e) => !e.salaryCategory || !knownCategories.has(e.salaryCategory)).length;
        if (counted + legacy !== totalEmployees) {
            return {
                valid: false,
                message: `Category sum validation failed: Sum of categories (${counted + legacy}) ≠ Total employees (${totalEmployees})`,
            };
        }
        return { valid: true };
    }
    async validateMovementConsistency(declaration) {
        const movements = await this.prisma.declarationMovement.findMany({
            where: { declarationId: declaration.id },
        });
        const dismissals = movements.find((m) => m.movementType === 'DISMISSAL');
        const recruitments = movements.find((m) => m.movementType === 'RECRUITMENT');
        const totalDismissals = dismissals
            ? dismissals.cat1_3 + dismissals.cat4_6 + dismissals.cat7_9 + dismissals.cat10_12 + dismissals.catNonDeclared
            : 0;
        const totalRecruitments = recruitments
            ? recruitments.cat1_3 + recruitments.cat4_6 + recruitments.cat7_9 + recruitments.cat10_12 + recruitments.catNonDeclared
            : 0;
        const employees = await this.prisma.employee.count({
            where: { declarationId: declaration.id },
        });
        if (totalDismissals > employees * 2 || totalRecruitments > employees * 2) {
            return {
                valid: false,
                message: `Movement inconsistency: Total movements exceed 2x current workforce (${employees} employees)`,
            };
        }
        return { valid: true };
    }
    async validateWorkforceGrowth(declaration) {
        const company = await this.prisma.company.findUnique({
            where: { id: declaration.companyId },
        });
        if (!company || !company.lastYearTotal) {
            return { valid: true };
        }
        const currentEmployees = await this.prisma.employee.count({
            where: { declarationId: declaration.id },
        });
        const growthRate = Math.abs(currentEmployees - company.lastYearTotal) / company.lastYearTotal;
        if (growthRate > 0.5) {
            return {
                valid: true,
                message: `Warning: Workforce growth is ${(growthRate * 100).toFixed(1)}% (may require review)`,
            };
        }
        return { valid: true };
    }
    async validateEmployees(declaration) {
        const employees = await this.prisma.employee.findMany({
            where: { declarationId: declaration.id },
        });
        const messages = [];
        for (const emp of employees) {
            if (!emp.fullName?.trim())
                messages.push(`Employee record missing name`);
            if (!emp.gender)
                messages.push(`Employee ${emp.fullName} missing gender`);
            if (emp.age < 15 || emp.age > 100)
                messages.push(`Employee ${emp.fullName} has unrealistic age: ${emp.age}`);
            if (emp.seniority < 0)
                messages.push(`Employee ${emp.fullName} has negative seniority`);
        }
        return {
            valid: messages.length === 0,
            messages,
        };
    }
    async logValidationSteps(declarationId, errors) {
        await this.prisma.validationStep.deleteMany({
            where: { declarationId },
        });
        const steps = [
            { type: prisma_types_1.ValidationStepType.GENDER_SUM, hasError: errors.some((e) => e.includes('Gender')) },
            { type: prisma_types_1.ValidationStepType.CATEGORY_SUM, hasError: errors.some((e) => e.includes('Category')) },
            { type: prisma_types_1.ValidationStepType.MOVEMENT_CONSISTENCY, hasError: errors.some((e) => e.includes('Movement')) },
            { type: prisma_types_1.ValidationStepType.WORKFORCE_GROWTH, hasError: errors.some((e) => e.includes('growth')) },
            { type: prisma_types_1.ValidationStepType.EMPLOYEE_VALIDATION, hasError: errors.some((e) => e.includes('Employee')) },
        ];
        for (const step of steps) {
            await this.prisma.validationStep.create({
                data: {
                    declarationId,
                    stepType: step.type,
                    isValid: !step.hasError,
                    message: step.hasError ? errors.find((e) => e.includes(step.type)) : undefined,
                },
            });
        }
    }
};
exports.ValidationService = ValidationService;
exports.ValidationService = ValidationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ValidationService);
//# sourceMappingURL=validation.service.js.map