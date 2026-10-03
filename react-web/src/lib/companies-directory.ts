// src/lib/companies-directory.ts
//
// GET /companies (src/companies/companies.controller.ts, guarded to
// DIRECTORY_ROLES — SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN,
// DIVISIONAL_ADMIN, with the rows territory-scoped server-side) — read
// directly from the controller + dsmo.service.ts's listCompanies() to get
// the real query params and response shape, not guessed from the Flutter UI
// alone. Both routes lived under the /dsmo prefix until the register moved
// out of DsmoController.
import { apiFetch } from "./api-client";

export interface CompanyUser {
  id: string;
  email: string;
  isActive: boolean;
  status: string;
}

export interface Company {
  id: string;
  name: string | null;
  taxNumber: string | null;
  establishmentId: string | null;
  region: string | null;
  department: string | null;
  subdivision: string | null;
  address: string | null;
  phone: string | null;
  mainActivity: string | null;
  totalEmployees: number | null;
  entityType: string | null;
  createdAt: string;
  sector: { name: string } | null;
  respondentFirstName: string | null;
  respondentLastName: string | null;
  respondentFunction: string | null;
  respondentPhone: string | null;
  legalStatus: string | null;
  registrationNumber: string | null;
  cnpsNumber: string | null;
  yearOfCreation: string | null;
  enterpriseSize: string | null;
  menCount: number | null;
  womenCount: number | null;
  lastYearTotal: number | null;
  lastYearMenCount: number | null;
  lastYearWomenCount: number | null;
  user: CompanyUser | null;
}

export interface ListCompaniesResult {
  companies: Company[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CompanyStats {
  total: number;
  active: number;
  pendingValidation: number;
  rejected: number;
  suspended: number;
}

export function getCompanyStats() {
  return apiFetch<CompanyStats>("/companies/stats");
}

export function listCompanies(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  region?: string;
}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.status) query.set("status", params.status);
  if (params.region) query.set("region", params.region);
  const qs = query.toString();
  return apiFetch<ListCompaniesResult>(`/companies${qs ? `?${qs}` : ""}`);
}

// Ported labels — CompaniesScreen's _entityTypeLabel (companies_screen.dart).
const ENTITY_TYPE_LABELS: Record<string, string> = {
  ENTREPRISE: "Entreprise",
  COOPERATIVE: "Coopérative",
  CTD: "CTD",
  ONG: "ONG",
  ADMINISTRATION: "Administration",
  PROJECT_PROGRAM: "Projet / Programme",
  VOCATIONAL_TRAINING: "Centre de formation professionnelle",
};

export function entityTypeLabel(type: string | null): string {
  if (!type) return "";
  return ENTITY_TYPE_LABELS[type.toUpperCase()] ?? type;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

// Flutter's _contactValue checks company.respondentEmail first, but
// dsmo.service.ts's listCompanies() select never includes that field (only
// respondentFirstName/LastName/Function/Phone + user.email) — confirmed by
// reading the actual Prisma select, not assumed. That fallback is
// unreachable in the real backend response, so this always resolves to
// user.email in practice; matching real behavior rather than porting the
// dead branch too.
export function contactValue(company: Company): string {
  return company.user?.email ?? "";
}

export function genderBreakdown(men: number | null, women: number | null): string | null {
  if (men === null && women === null) return null;
  const parts: string[] = [];
  if (men !== null) parts.push(`${men} hommes`);
  if (women !== null) parts.push(`${women} femmes`);
  return parts.join(" · ");
}
