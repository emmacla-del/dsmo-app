// Mirrors lib/models/user.dart and prisma UserRole — kept as a thin type
// layer, not a redefinition of business rules (those stay server-side).

export type { UserRole } from "./roles";

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
  // No rejectionReason. A rejected registration gets a fixed login message
  // that carries no reviewer reason (see src/common/registration-messages.ts),
  // so nothing company-facing shows it any more and /auth/me no longer
  // returns it. The column and the staff-side review queue keep it — see
  // CompanyRegistrationItem in user-directory.ts. This is the registration
  // field; AdminDossier.rejectionReason in api-client.ts is the unrelated
  // DSMO declaration one and stays.
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

export interface LocationSubdivision {
  id: string;
  name: string;
  code?: string | null;
}

export interface LocationDepartment {
  id: string;
  name: string;
  subdivisions: LocationSubdivision[];
}

export interface LocationRegion {
  id: string;
  name: string;
  departments: LocationDepartment[];
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
