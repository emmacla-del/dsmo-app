// src/types/prisma.types.ts
// Prisma v5 enums live under the $Enums namespace inside @prisma/client.
// Re-export each one as both a const (for value access) and a type (for annotations)
// so they are the same type as what Prisma returns from queries.
import { $Enums } from '@prisma/client';

export const UserRole = $Enums.UserRole;
export type UserRole = $Enums.UserRole;

export const UserStatus = $Enums.UserStatus;
export type UserStatus = $Enums.UserStatus;

export const DeclarationStatus = $Enums.DeclarationStatus;
export type DeclarationStatus = $Enums.DeclarationStatus;

export const NotificationStatus = $Enums.NotificationStatus;
export type NotificationStatus = $Enums.NotificationStatus;

export const MovementType = $Enums.MovementType;
export type MovementType = $Enums.MovementType;

export const ValidationStepType = $Enums.ValidationStepType;
export type ValidationStepType = $Enums.ValidationStepType;

export const ServiceCategory = $Enums.ServiceCategory;
export type ServiceCategory = $Enums.ServiceCategory;

// NOTE: PositionType is defined in schema.prisma but not used as a field type
// on any model, so Prisma does not emit it into $Enums. Removed to fix TS2339.

export const OnefopEntityType = $Enums.OnefopEntityType;
export type OnefopEntityType = $Enums.OnefopEntityType;

export const OnefopStatus = $Enums.OnefopStatus;
export type OnefopStatus = $Enums.OnefopStatus;

export const CspCategory = $Enums.CspCategory;
export type CspCategory = $Enums.CspCategory;

export const Gender = $Enums.Gender;
export type Gender = $Enums.Gender;

export const AgeBand = $Enums.AgeBand;
export type AgeBand = $Enums.AgeBand;

export const ContractType = $Enums.ContractType;
export type ContractType = $Enums.ContractType;

export const DepartureType = $Enums.DepartureType;
export type DepartureType = $Enums.DepartureType;

export const InternshipType = $Enums.InternshipType;
export type InternshipType = $Enums.InternshipType;

export const DiplomaType = $Enums.DiplomaType;
export type DiplomaType = $Enums.DiplomaType;

export const DisabilityStatus = $Enums.DisabilityStatus;
export type DisabilityStatus = $Enums.DisabilityStatus;

export const DismissalUnemploymentType = $Enums.DismissalUnemploymentType;
export type DismissalUnemploymentType = $Enums.DismissalUnemploymentType;

export const VulnerableType = $Enums.VulnerableType;
export type VulnerableType = $Enums.VulnerableType;

export const RoundStatus = $Enums.RoundStatus;
export type RoundStatus = $Enums.RoundStatus;

export const CampaignStatus = $Enums.CampaignStatus;
export type CampaignStatus = $Enums.CampaignStatus;

export const SubmissionStatus = $Enums.SubmissionStatus;
export type SubmissionStatus = $Enums.SubmissionStatus;

export const ReportType = $Enums.ReportType;
export type ReportType = $Enums.ReportType;

export const ReportFormat = $Enums.ReportFormat;
export type ReportFormat = $Enums.ReportFormat;