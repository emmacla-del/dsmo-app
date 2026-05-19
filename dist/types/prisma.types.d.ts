import { $Enums } from '@prisma/client';
export declare const UserRole: {
    COMPANY: "COMPANY";
    DIVISIONAL: "DIVISIONAL";
    REGIONAL: "REGIONAL";
    CENTRAL: "CENTRAL";
    SUPER_ADMIN: "SUPER_ADMIN";
};
export type UserRole = $Enums.UserRole;
export declare const DeclarationStatus: {
    DRAFT: "DRAFT";
    SUBMITTED: "SUBMITTED";
    DIVISION_APPROVED: "DIVISION_APPROVED";
    REGION_APPROVED: "REGION_APPROVED";
    FINAL_APPROVED: "FINAL_APPROVED";
    REJECTED: "REJECTED";
};
export type DeclarationStatus = $Enums.DeclarationStatus;
export declare const NotificationStatus: {
    SENT: "SENT";
    OPENED: "OPENED";
    CLICKED: "CLICKED";
    FAILED: "FAILED";
};
export type NotificationStatus = $Enums.NotificationStatus;
export declare const MovementType: {
    RECRUITMENT: "RECRUITMENT";
    PROMOTION: "PROMOTION";
    DISMISSAL: "DISMISSAL";
    RETIREMENT: "RETIREMENT";
    DEATH: "DEATH";
};
export type MovementType = $Enums.MovementType;
export declare const ValidationStepType: {
    IDENTIFICATION: "IDENTIFICATION";
    CSP_TABLES: "CSP_TABLES";
    DIPLOMA_TABLES: "DIPLOMA_TABLES";
    DISABILITY_TABLES: "DISABILITY_TABLES";
    VULNERABLE_TABLES: "VULNERABLE_TABLES";
    FIRST_TIME_TABLES: "FIRST_TIME_TABLES";
    DEPARTURE_TABLES: "DEPARTURE_TABLES";
    SKILLS_TABLES: "SKILLS_TABLES";
    TRAINING_TABLES: "TRAINING_TABLES";
    FINAL_VALIDATION: "FINAL_VALIDATION";
    GENDER_SUM: "GENDER_SUM";
    CATEGORY_SUM: "CATEGORY_SUM";
    MOVEMENT_CONSISTENCY: "MOVEMENT_CONSISTENCY";
    WORKFORCE_GROWTH: "WORKFORCE_GROWTH";
    EMPLOYEE_VALIDATION: "EMPLOYEE_VALIDATION";
};
export type ValidationStepType = $Enums.ValidationStepType;
