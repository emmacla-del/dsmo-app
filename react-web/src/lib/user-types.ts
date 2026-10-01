// Mirrors lib/models/user.dart and prisma UserRole — kept as a thin type
// layer, not a redefinition of business rules (those stay server-side).

export type UserRole =
  | "COMPANY"
  | "DIVISIONAL"
  | "REGIONAL"
  | "CENTRAL"
  | "SUPER_ADMIN"
  | "SUPER_ADMIN_DSMO"
  | "SUPER_ADMIN_ONEFOP"
  | "DATA_MANAGER"
  | "CAMPAIGN_MANAGER"
  | "ANALYST"
  | "AUDITOR";

export interface UserFeatures {
  onefopBasicAnalytics: boolean;
  onefopBenchmarking: boolean;
  onefopSubmissionStatus?: string | null;
  onefopSurveyYear?: number | null;
  onefopSubmissionDate?: string | null;
  onefopHasDraft: boolean;
  onefopRejectionReason?: string | null;
}

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  stream?: string | null;
  region?: string | null;
  department?: string | null;
  subdivision?: string | null;
  matricule?: string | null;
  serviceCode?: string | null;
  positionType?: string | null;
  positionTitle?: string | null;
  isActive: boolean;
  emailVerified: boolean;
  mustChangePassword: boolean;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  weeklyDigestEnabled: boolean;
  smsNotificationsEnabled: boolean;
  twoFactorEnabled: boolean;
  status?: string | null;
  approvalComment?: string | null;
  rejectionReason?: string | null;
  features: UserFeatures;
}

export interface Sector {
  id: string;
  name: string;
  code?: string | null;
  category?: string | null;
  nameEn?: string | null;
}

// Region/Department/Subdivision — cascading location pickers used by
// registration (src/locations/locations.controller.ts). Names are the
// value actually sent to /auth/register-company (region/department/
// subdivision are plain name strings there, not ids — see
// register_screen.dart's _submitCompany).
export interface Region {
  id: string;
  name: string;
  code?: string | null;
  nameEn?: string | null;
}

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  nameEn?: string | null;
  regionId: string;
}

export interface Subdivision {
  id: string;
  name: string;
  code?: string | null;
  nameEn?: string | null;
  departmentId: string;
}

export interface RegisterCompanyResult {
  access_token: string;
  user: User;
  company: {
    id: string;
    name: string;
    establishmentId?: string | null;
    taxNumber?: string | null;
    entityType?: string | null;
    attestationUrl?: string | null;
  };
}
