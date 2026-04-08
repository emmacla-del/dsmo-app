// Prisma v5 enums live under the $Enums namespace inside @prisma/client.
// Re-export each one as both a const (for value access) and a type (for annotations)
// so they are the same type as what Prisma returns from queries.
import { $Enums } from '@prisma/client';

export const UserRole = $Enums.UserRole;
export type UserRole = $Enums.UserRole;

export const DeclarationStatus = $Enums.DeclarationStatus;
export type DeclarationStatus = $Enums.DeclarationStatus;

export const NotificationStatus = $Enums.NotificationStatus;
export type NotificationStatus = $Enums.NotificationStatus;

export const MovementType = $Enums.MovementType;
export type MovementType = $Enums.MovementType;

export const ValidationStepType = $Enums.ValidationStepType;
export type ValidationStepType = $Enums.ValidationStepType;
