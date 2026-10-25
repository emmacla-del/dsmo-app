// src/lib/sector-nomenclature.ts
//
// GENERATED -- do not edit by hand. Regenerate with `npm run sync:reference-data`
// after changing the referential in /admin/sectors.
//
// The « Branche d'activité » list, bundled so the registration form offers it
// with no network call, as it already does for the sector and the year. The
// live referential still wins whenever it answers: this copy is what the form
// starts from and what it keeps when the API is asleep or unreachable.
// Source: GET /sectors (19 branches, snapshot of 2026-10-25).
import type { BranchRow } from "./register-activity";

export const SECTOR_NOMENCLATURE: readonly BranchRow[] = [
  { id: "7bed5a8e-d71f-4f6c-bf38-7a8709640567", name: "Activités financières et d'assurance", nameEn: "Financial and insurance activities", category: "Tertiary" },
  { id: "31b2f106-6a81-4109-9b8d-3c6bd00fb286", name: "Activités immobilières", nameEn: "Real estate activities", category: "Tertiary" },
  { id: "0fcf99d6-2453-4246-a783-d8107a076102", name: "Activités juridiques, comptables et de conseil", nameEn: "Legal, accounting and consulting activities", category: "Tertiary" },
  { id: "654bb89a-97c2-4462-a6a6-443536e6bb5e", name: "Administration publique et défense", nameEn: "Public administration and defence", category: "Public" },
  { id: "6412c42e-aa00-4260-822b-91d11efe2984", name: "Agriculture, élevage, sylviculture et pêche", nameEn: "Agriculture, livestock, forestry and fishing", category: "Primary" },
  { id: "4b840577-3584-477f-8a2a-c0d94828daec", name: "Arts, spectacles et loisirs", nameEn: "Arts, entertainment and recreation", category: "Tertiary" },
  { id: "265020c3-a3bd-4525-958c-23c4fe8ba814", name: "Autres activités de services", nameEn: "Other service activities", category: "Tertiary" },
  { id: "ec1b554a-91a5-4413-9566-ced775a7a8bd", name: "Commerce de gros et de détail", nameEn: "Wholesale and retail trade", category: "Tertiary" },
  { id: "edf6b531-3fc6-4737-817d-7af10e61849a", name: "Construction et BTP", nameEn: "Construction and public works", category: "Secondary" },
  { id: "087ade17-a1d2-4751-8ea7-e1d7e2e08079", name: "Enseignement", nameEn: "Education", category: "Tertiary" },
  { id: "742deb00-b28a-4078-a966-b632fd3f590f", name: "Hôtellerie et restauration", nameEn: "Accommodation and food services", category: "Tertiary" },
  { id: "f1c693ed-77fb-4674-8efc-7b1f5691d442", name: "Industrie manufacturière", nameEn: "Manufacturing", category: "Secondary" },
  { id: "72225835-b7b4-4c5d-bb68-d4d1bcc5f63d", name: "Industries extractives", nameEn: "Mining and quarrying", category: "Primary" },
  { id: "766e9cb9-8900-430a-9ecc-a8a38a4ec894", name: "Information et communication", nameEn: "Information and communication", category: "Tertiary" },
  { id: "caa30e0d-e4d8-490f-bb71-b7dd84167d6f", name: "Organismes extraterritoriaux", nameEn: "Extraterritorial organisations", category: "Public" },
  { id: "9e6dded9-8ad0-4765-b6b9-9ad21f8fe5c0", name: "Production et distribution d'eau, électricité et gaz", nameEn: "Water, electricity and gas supply", category: "Secondary" },
  { id: "2ab1f356-0f95-421f-bcab-a3f2e4bc21bf", name: "Recherche et développement", nameEn: "Research and development", category: "Tertiary" },
  { id: "ec1f89e8-d041-4119-b884-2acdd7afc8d8", name: "Santé humaine et action sociale", nameEn: "Human health and social work", category: "Tertiary" },
  { id: "e22a5a31-2625-4f43-8d5e-e0519e24d52b", name: "Transport et entreposage", nameEn: "Transport and storage", category: "Tertiary" },
];
