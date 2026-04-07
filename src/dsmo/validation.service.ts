import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationStepType } from '../types/prisma.types';

@Injectable()
export class ValidationService {
    constructor(private prisma: PrismaService) { }

    /**
     * Run all validation checks on a declaration
     */
    async validateDeclaration(declarationId: string): Promise<{ isValid: boolean; errors: string[] }> {
        const declaration = await this.prisma.declaration.findUnique({
            where: { id: declarationId },
            include: { employees: true, movements: true },
        });

        if (!declaration) throw new Error('Declaration not found');

        const errors: string[] = [];

        // 1. Gender sum validation
        const genderCheck = await this.validateGenderSum(declaration);
        if (!genderCheck.valid && genderCheck.message) errors.push(genderCheck.message);

        // 2. Category sum validation
        const categoryCheck = await this.validateCategorySum(declaration);
        if (!categoryCheck.valid && categoryCheck.message) errors.push(categoryCheck.message);

        // 3. Movement consistency
        const movementCheck = await this.validateMovementConsistency(declaration);
        if (!movementCheck.valid && movementCheck.message) errors.push(movementCheck.message);

        // 4. Workforce growth check
        const growthCheck = await this.validateWorkforceGrowth(declaration);
        if (!growthCheck.valid && growthCheck.message) errors.push(growthCheck.message);

        // 5. Employee data validation
        const employeeCheck = await this.validateEmployees(declaration);
        if (!employeeCheck.valid) errors.push(...employeeCheck.messages);

        // Log validation steps
        await this.logValidationSteps(declarationId, errors);

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    private async validateGenderSum(declaration: any): Promise<{ valid: boolean; message?: string }> {
        const employees = await this.prisma.employee.findMany({
            where: { declarationId: declaration.id },
        });

        const totalEmployees = employees.length;
        const males = employees.filter((e: any) => e.gender === 'M').length;
        const females = employees.filter((e: any) => e.gender === 'F').length;

        if (males + females !== totalEmployees && totalEmployees > 0) {
            return {
                valid: false,
                message: `Gender sum validation failed: Males (${males}) + Females (${females}) ≠ Total (${totalEmployees})`,
            };
        }

        return { valid: true };
    }

    private async validateCategorySum(declaration: any): Promise<{ valid: boolean; message?: string }> {
        const employees = await this.prisma.employee.findMany({
            where: { declarationId: declaration.id },
        });

        const totalEmployees = employees.length;
        const byCategory = {
            cat1_3: employees.filter((e: any) => e.salaryCategory === '1-3').length,
            cat4_6: employees.filter((e: any) => e.salaryCategory === '4-6').length,
            cat7_9: employees.filter((e: any) => e.salaryCategory === '7-9').length,
            cat10_12: employees.filter((e: any) => e.salaryCategory === '10-12').length,
            nonDeclared: employees.filter((e: any) => e.salaryCategory === 'non-declared').length,
        };

        const sum = Object.values(byCategory).reduce((a, b) => a + b, 0);

        if (sum !== totalEmployees && totalEmployees > 0) {
            return {
                valid: false,
                message: `Category sum validation failed: Sum of categories (${sum}) ≠ Total employees (${totalEmployees})`,
            };
        }

        return { valid: true };
    }

    private async validateMovementConsistency(declaration: any): Promise<{ valid: boolean; message?: string }> {
        const movements = await this.prisma.declarationMovement.findMany({
            where: { declarationId: declaration.id },
        });

        const dismissals = movements.find((m: any) => m.movementType === 'DISMISSAL');
        const recruitments = movements.find((m: any) => m.movementType === 'RECRUITMENT');

        const totalDismissals = dismissals
            ? dismissals.cat1_3 + dismissals.cat4_6 + dismissals.cat7_9 + dismissals.cat10_12 + dismissals.catNonDeclared
            : 0;
        const totalRecruitments = recruitments
            ? recruitments.cat1_3 + recruitments.cat4_6 + recruitments.cat7_9 + recruitments.cat10_12 + recruitments.catNonDeclared
            : 0;

        const employees = await this.prisma.employee.count({
            where: { declarationId: declaration.id },
        });

        // Movements should be reasonable relative to workforce size
        if (totalDismissals > employees * 2 || totalRecruitments > employees * 2) {
            return {
                valid: false,
                message: `Movement inconsistency: Total movements exceed 2x current workforce (${employees} employees)`,
            };
        }

        return { valid: true };
    }

    private async validateWorkforceGrowth(declaration: any): Promise<{ valid: boolean; message?: string }> {
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

        // Flag if growth exceeds 50% (should be reviewed)
        if (growthRate > 0.5) {
            return {
                valid: true, // Not invalid, but should be noted
                message: `Warning: Workforce growth is ${(growthRate * 100).toFixed(1)}% (may require review)`,
            };
        }

        return { valid: true };
    }

    private async validateEmployees(declaration: any): Promise<{ valid: boolean; messages: string[] }> {
        const employees = await this.prisma.employee.findMany({
            where: { declarationId: declaration.id },
        });

        const messages: string[] = [];

        for (const emp of employees) {
            if (!emp.fullName?.trim()) messages.push(`Employee record missing name`);
            if (!emp.gender) messages.push(`Employee ${emp.fullName} missing gender`);
            if (emp.age < 15 || emp.age > 100) messages.push(`Employee ${emp.fullName} has unrealistic age: ${emp.age}`);
            if (emp.seniority < 0) messages.push(`Employee ${emp.fullName} has negative seniority`);
        }

        return {
            valid: messages.length === 0,
            messages,
        };
    }

    private async logValidationSteps(declarationId: string, errors: string[]): Promise<void> {
        // Delete existing validation steps
        await this.prisma.validationStep.deleteMany({
            where: { declarationId },
        });

        // Log each validation step
        const steps = [
            { type: ValidationStepType.GENDER_SUM, hasError: errors.some((e) => e.includes('Gender')) },
            { type: ValidationStepType.CATEGORY_SUM, hasError: errors.some((e) => e.includes('Category')) },
            { type: ValidationStepType.MOVEMENT_CONSISTENCY, hasError: errors.some((e) => e.includes('Movement')) },
            { type: ValidationStepType.WORKFORCE_GROWTH, hasError: errors.some((e) => e.includes('growth')) },
            { type: ValidationStepType.EMPLOYEE_VALIDATION, hasError: errors.some((e) => e.includes('Employee')) },
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
}
