import { PrismaService } from '../prisma/prisma.service';
export declare class ValidationService {
    private prisma;
    constructor(prisma: PrismaService);
    validateDeclaration(declarationId: string): Promise<{
        isValid: boolean;
        errors: string[];
    }>;
    private validateGenderSum;
    private validateCategorySum;
    private validateMovementConsistency;
    private validateWorkforceGrowth;
    private validateEmployees;
    private logValidationSteps;
}
