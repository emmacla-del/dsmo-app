// react-web/src/lib/onefop-autofill.ts
//
// Automatically maps company registration and account creation data
// into ONEFOP form wizard initial identification fields for both:
//   1. Vocational Training (VT) Form Wizard (Section 1: §1.1 - §1.16)
//   2. Modern Jobs Form Wizard (Section 0: Respondent, Section 1: Entity details)
//      for Enterprise, Cooperative, CTD, ONG, Administration, Project/Program.

import type { FormData } from "./onefop-schema";
import type { CompanyProfile } from "./api-client";
import type { User } from "./user-types";

function setIfPresent(data: FormData, key: string, value: unknown) {
  if (value === null || value === undefined) return;
  const s = String(value).trim();
  if (s.length > 0) {
    data[key] = s;
  }
}

export function mapActivityToSector(activity?: string | null): string {
  if (!activity) return "Tertiaire/ Tertiary";
  const a = activity.toLowerCase();
  if (
    a.includes("agriculture") ||
    a.includes("elevage") ||
    a.includes("peche") ||
    a.includes("mine") ||
    a.includes("foret") ||
    a.includes("farming") ||
    a.includes("agro") ||
    a.includes("forestier")
  ) {
    return "Primaire/ Primary";
  }
  if (
    a.includes("industrie") ||
    a.includes("fabrication") ||
    a.includes("construction") ||
    a.includes("manufacturing") ||
    a.includes("batiment") ||
    a.includes("travaux")
  ) {
    return "Secondaire/ Secondary";
  }
  return "Tertiaire/ Tertiary";
}

export function mapLegalStatus(status?: string | null): string | undefined {
  if (!status) return undefined;
  const s = status.trim().toUpperCase();
  if (s.includes("UNIPERSONNELLE")) {
    return "Société unipersonnelle/ Single-member company";
  }
  if (s === "SARL") {
    return "SARL/ LLC";
  }
  if (s === "SA") {
    return "SA/ PLC";
  }
  if (s.includes("AUTRE") || s.includes("OTHER")) {
    return "Autres/ Others";
  }
  return status.trim();
}

export function mapEnterpriseSize(size?: string | null): string | undefined {
  if (!size) return undefined;
  const s = size.trim().toUpperCase();
  if (s === "TPE") return "TPE/ Very small enterprise";
  if (s === "PE") return "PE/ Small enterprise";
  if (s === "ME") return "ME/ Medium-sized enterprise";
  if (s === "GE") return "GE/ Large enterprise";
  return size.trim();
}

export function mapArea(area?: unknown): string | undefined {
  if (area === null || area === undefined) return undefined;
  const s = String(area).toLowerCase();
  if (s.includes("urbain") || s === "1") return "Urbain/ Urban";
  if (s.includes("rural") || s === "2") return "Rural/ Rural";
  return String(area).trim();
}

export function mapCtdType(ctdType?: string | null): string | undefined {
  if (!ctdType) return undefined;
  const s = ctdType.trim().toLowerCase();
  if (s.includes("urbaine") || s.includes("urban")) {
    return "Communauté Urbaine/ Urban Council";
  }
  if (s.includes("commune") || s.includes("council") || s.includes("municipality")) {
    return "Commune/ Council";
  }
  return ctdType.trim();
}

export function mapCooperativeType(coopType?: string | null): string | undefined {
  if (!coopType) return undefined;
  const s = coopType.trim().toLowerCase();
  if (s.includes("simplifiée") || s.includes("simplifiee")) {
    return "Coopérative à comptabilité simplifiée";
  }
  if (s.includes("conseil") || s.includes("administration") || s.includes("board")) {
    return "Coopérative avec conseil d'administration";
  }
  if (s.includes("autre") || s.includes("other")) {
    return "Autre (à préciser)/ Other (specify)";
  }
  return coopType.trim();
}

export function mapEducationSystem(edSystem?: string | null): string | undefined {
  if (!edSystem) return undefined;
  const s = edSystem.trim().toLowerCase();
  if (s.includes("confessionnel") || s.includes("denominational")) {
    return "Privé confessionnel/ Private denominational";
  }
  if (s.includes("laïc") || s.includes("laic") || s.includes("lay")) {
    return "Privé laïc/ Lay private";
  }
  if (s.includes("public")) {
    return "Public/ Public";
  }
  return edSystem.trim();
}

export function mapCfpType(cfpType?: string | null): string | undefined {
  if (!cfpType) return undefined;
  const s = cfpType.trim();
  const lower = s.toLowerCase();
  if (lower.includes("sar/sm") || lower.includes("hec")) {
    return "SAR/SM/ RA/HECs";
  }
  if (lower.includes("rapide") || lower.includes("cfpr") || lower.includes("ivtc")) {
    return "Centre de Formation Professionnelle Rapide (CFPR)/ Intensive Vocational Training Centre (IVTC)";
  }
  if (lower.includes("privé") || lower.includes("prive") || lower.includes("cfpp") || lower.includes("pvtc")) {
    return "Centre de Formation Professionnelle Privé (CFPP)/ Private Vocational Training Centre (PVTC)";
  }
  if (lower.includes("métiers") || lower.includes("metiers") || lower.includes("cfm") || lower.includes("ttc")) {
    return "Centre de Formation aux Métiers (CFM)/ Trades Training Centre (TTC)";
  }
  if (lower.includes("excellence") || lower.includes("cfpe") || lower.includes("avtc")) {
    return "Centre de Formation Professionnelle d'Excellence (CFPE)/ Advanced Vocational Training Centre (AVTC)";
  }
  if (lower.includes("sectorielles") || lower.includes("sectoriel") || lower.includes("cfps") || lower.includes("svtc")) {
    return "Centre de Formation Professionnelle Sectorielles (CFPS)/ Sectoral Vocational Training Centre (SVTC)";
  }
  if (lower.includes("formateurs") || lower.includes("cnffdp") || lower.includes("nivtpd")) {
    return "Centre National de Formation des Formateurs et de Développement des Programmes (CNFFDP)/ National Institute of Vocational Trainers and Programme Development (NIVTPD)";
  }
  return s;
}

export function mapFunctionalStatus(status?: string | null): string | undefined {
  if (!status) return undefined;
  const lower = status.trim().toLowerCase();
  if (lower.includes("non-fonctionnelle") || lower.includes("non-functional")) {
    return "Non-fonctionnelle/ Non-functional";
  }
  if (lower.includes("fermée") || lower.includes("fermee") || lower.includes("closed")) {
    return "Fermée/ Closed";
  }
  if (lower.includes("fonctionnelle") || lower.includes("functional")) {
    return "Fonctionnelle/ Functional";
  }
  return status.trim();
}

export function mapNonFunctionalReason(reason?: string | null): string | undefined {
  if (!reason) return undefined;
  const lower = reason.trim().toLowerCase();
  if (lower.includes("apprenant") || lower.includes("trainee")) {
    return "Manque d'apprenants/ Lack of trainees";
  }
  if (lower.includes("formateur") || lower.includes("trainer")) {
    return "Manque de formateur/ Lack of trainers";
  }
  if (lower.includes("insécurité") || lower.includes("insecurite") || lower.includes("insecurity")) {
    return "Raison d'insécurité/ Insecurity";
  }
  if (lower.includes("agrément") || lower.includes("agrement") || lower.includes("accreditation")) {
    return "Agrément non valide/ Invalid accreditation";
  }
  if (lower.includes("autre") || lower.includes("other")) {
    return "Autres/ Others";
  }
  return reason.trim();
}

/**
 * Builds the initial autofill Form Data dictionary for the given entity type
 * using data captured during company registration and account creation.
 */
export function companyToInitialData(
  company: Partial<CompanyProfile> | null | undefined,
  entityType: string,
  user?: User | null,
): FormData {
  const data: FormData = {};
  if (!company && !user) return data;

  const comp = company ?? {};

  // Resolve respondent data
  let respFirst = comp.respondentFirstName ?? "";
  let respLast = comp.respondentLastName ?? "";
  if (!respFirst && user?.firstName) respFirst = user.firstName;
  if (!respLast && user?.lastName) respLast = user.lastName;

  const fullName = [respFirst, respLast].filter(Boolean).join(" ");
  const fn =
    comp.respondentFunction ||
    (comp as Record<string, unknown>).positionTitle ||
    user?.positionTitle ||
    "";
  const userEmail =
    user?.email ||
    (comp as Record<string, unknown>).email ||
    ((comp as Record<string, unknown>).user as Record<string, unknown> | undefined)?.email ||
    "";

  const phone1 = comp.respondentPhone || comp.phone || "";
  const phone2 = comp.respondentPhone2 || comp.phone2 || "";

  // S0Q01 - S0Q03: Shared respondent block (Enterprise, Cooperative, CTD, ONG, Administration, Project)
  if (fullName) data["S0Q01"] = fullName;
  if (fn) data["S0Q02"] = fn;
  if (phone1) data["S0Q03_TEL1"] = phone1;
  if (phone2) data["S0Q03_TEL2"] = phone2;
  if (userEmail) data["S0Q03_EMAIL"] = String(userEmail);

  const lowerType = entityType.toLowerCase();

  switch (lowerType) {
    case "vocationaltraining":
    case "vt":
    case "vtc": {
      setIfPresent(data, "VT1_1", comp.establishmentId);
      setIfPresent(data, "VT1_2", (comp as Record<string, unknown>).centerName ?? comp.name);
      setIfPresent(data, "VT1_3", comp.sigle);
      setIfPresent(data, "VT1_4", comp.region);
      setIfPresent(data, "VT1_5", comp.department);
      setIfPresent(data, "VT1_6", comp.subdivision);
      setIfPresent(data, "VT1_8", comp.address);

      const aVt = mapArea(comp.area);
      if (aVt) data["VT1_9"] = aVt;

      const edSystem = mapEducationSystem(comp.educationSystem as string);
      if (edSystem) data["VT1_10"] = edSystem;

      const cfpType = mapCfpType(comp.cfpType as string);
      if (cfpType) data["VT1_11"] = cfpType;

      const fStatus = mapFunctionalStatus(comp.functionalStatus as string);
      if (fStatus) data["VT1_12"] = fStatus;

      const nfReason = mapNonFunctionalReason(comp.nonFunctionalReason as string);
      if (nfReason) data["VT1_13"] = nfReason;

      setIfPresent(data, "VT1_13_OTHER", comp.nonFunctionalReasonOther);
      setIfPresent(data, "VT1_14", comp.yearOfCreation);

      // Section 1.15: Respondent block for VT
      if (fullName) data["VT1_15_NAME"] = fullName;
      if (fn) data["VT1_15_FUNCTION"] = fn;
      if (phone1) data["VT1_15_TEL1"] = phone1;
      if (phone2) data["VT1_15_TEL2"] = phone2;
      if (userEmail) data["VT1_15_EMAIL"] = String(userEmail);

      // Section 1.16: Promoter / Director
      setIfPresent(data, "VT1_16_NAME", comp.promoterName);
      setIfPresent(data, "VT1_16_SEX", comp.promoterSex);
      setIfPresent(data, "VT1_16_TEL1", comp.promoterPhone1);
      setIfPresent(data, "VT1_16_TEL2", comp.promoterPhone2);
      break;
    }

    case "enterprise": {
      const legalStatus = mapLegalStatus(comp.legalStatus as string);
      if (legalStatus) data["S1Q01"] = legalStatus;

      setIfPresent(data, "S1Q02", (comp as Record<string, unknown>).companyName ?? comp.name);

      const aEnt = mapArea(comp.area);
      if (aEnt) data["S1Q03"] = aEnt;

      setIfPresent(data, "S1Q04_REGION", comp.region);
      setIfPresent(data, "S1Q04_DEPT", comp.department);
      setIfPresent(data, "S1Q04_SUBDIV", comp.subdivision);
      setIfPresent(data, "S1Q04_LOCALITY", comp.address);

      setIfPresent(data, "S1Q05_TEL1", comp.phone);
      setIfPresent(data, "S1Q05_TEL2", comp.phone2);
      setIfPresent(data, "S1Q05_BP", comp.poBox);

      const act = ((comp.mainActivity as string) ?? "").trim();
      const br = ((comp.branch as string) ?? "").trim();
      if (act) {
        data["S1Q06"] = mapActivityToSector(act);
        data["S1Q08"] = act;
      }
      if (br) data["S1Q07"] = br;

      setIfPresent(data, "S1Q09", comp.address);

      if (comp.totalEmployees !== null && comp.totalEmployees !== undefined) {
        data["S1Q10"] = String(comp.totalEmployees);
      }

      const size = mapEnterpriseSize(comp.enterpriseSize as string);
      if (size) data["S1Q12"] = size;
      break;
    }

    case "cooperative": {
      setIfPresent(data, "COOP_S1Q01", (comp as Record<string, unknown>).cooperativeName ?? comp.name);
      setIfPresent(
        data,
        "COOP_S1Q02",
        (comp as Record<string, unknown>).cooperativeHeadOffice ?? comp.address,
      );
      setIfPresent(data, "COOP_S1Q03", comp.yearOfCreation);

      const aCoop = mapArea(comp.area);
      if (aCoop) data["COOP_S1Q04"] = aCoop;

      setIfPresent(data, "COOP_S1Q05_REGION", comp.region);
      setIfPresent(data, "COOP_S1Q05_DEPT", comp.department);
      setIfPresent(data, "COOP_S1Q05_SUBDIV", comp.subdivision);
      setIfPresent(
        data,
        "COOP_S1Q05_LOCALITY",
        (comp as Record<string, unknown>).cooperativeHeadOffice ?? comp.address,
      );

      setIfPresent(data, "COOP_S1Q06_TEL1", comp.phone);
      setIfPresent(data, "COOP_S1Q06_TEL2", comp.phone2);
      setIfPresent(data, "COOP_S1Q06_BP", comp.poBox);

      const coopAct = ((comp.mainActivity as string) ?? "").trim();
      const coopBr = ((comp.branch as string) ?? "").trim();
      if (coopAct) {
        data["COOP_S1Q07"] = mapActivityToSector(coopAct);
        data["COOP_S1Q09"] = coopAct;
      }
      if (coopBr) data["COOP_S1Q08"] = coopBr;

      const coopType = mapCooperativeType(comp.cooperativeType as string);
      if (coopType) data["COOP_S1Q10"] = coopType;

      setIfPresent(data, "COOP_S1Q10_OTHER", (comp as Record<string, unknown>).cooperativeTypeOther);

      if (comp.totalEmployees !== null && comp.totalEmployees !== undefined) {
        data["COOP_S1Q11"] = String(comp.totalEmployees);
      }
      break;
    }

    case "ctd": {
      const ctdType = mapCtdType(comp.ctdType as string);
      if (ctdType) data["CTD_S1Q01"] = ctdType;

      setIfPresent(data, "CTD_S1Q01_NAME", (comp as Record<string, unknown>).ctdName ?? comp.name);
      setIfPresent(data, "CTD_S1Q02", (comp as Record<string, unknown>).councilType);
      setIfPresent(data, "CTD_S1Q03", comp.yearOfCreation);

      const aCtd = mapArea(comp.area);
      if (aCtd) data["CTD_S1Q04"] = aCtd;

      setIfPresent(data, "CTD_S1Q05_REGION", comp.region);
      setIfPresent(data, "CTD_S1Q05_DEPT", comp.department);
      setIfPresent(data, "CTD_S1Q05_SUBDIV", comp.subdivision);
      setIfPresent(data, "CTD_S1Q05_LOCALITY", comp.address);

      setIfPresent(data, "CTD_S1Q06_TEL1", comp.phone);
      setIfPresent(data, "CTD_S1Q06_TEL2", comp.phone2);
      setIfPresent(data, "CTD_S1Q06_BP", comp.poBox);

      const ctdAct = ((comp.mainActivity as string) ?? "").trim();
      const ctdBr = ((comp.branch as string) ?? "").trim();
      if (ctdAct) data["CTD_S1Q07"] = mapActivityToSector(ctdAct);
      if (ctdBr) data["CTD_S1Q08"] = ctdBr;

      if (comp.totalEmployees !== null && comp.totalEmployees !== undefined) {
        data["CTD_S1Q09"] = String(comp.totalEmployees);
      }
      break;
    }

    case "ong": {
      setIfPresent(data, "ONG_S1Q01", (comp as Record<string, unknown>).ngoName ?? comp.name);
      setIfPresent(data, "ONG_S1Q02", comp.address);
      setIfPresent(data, "ONG_S1Q03", comp.yearOfCreation);

      const aOng = mapArea(comp.area);
      if (aOng) data["ONG_S1Q04"] = aOng;

      setIfPresent(data, "ONG_S1Q05_REGION", comp.region);
      setIfPresent(data, "ONG_S1Q05_DEPT", comp.department);
      setIfPresent(data, "ONG_S1Q05_SUBDIV", comp.subdivision);
      setIfPresent(data, "ONG_S1Q05_LOCALITY", comp.address);

      setIfPresent(data, "ONG_S1Q06_TEL1", comp.phone);
      setIfPresent(data, "ONG_S1Q06_TEL2", comp.phone2);
      setIfPresent(data, "ONG_S1Q06_BP", comp.poBox);

      const ongAct = ((comp.mainActivity as string) ?? "").trim();
      const ongBr = ((comp.branch as string) ?? "").trim();
      if (ongAct) data["ONG_S1Q07"] = mapActivityToSector(ongAct);
      if (ongBr) data["ONG_S1Q08"] = ongBr;

      setIfPresent(data, "ONG_S1Q09", comp.mainMission);

      if (comp.totalEmployees !== null && comp.totalEmployees !== undefined) {
        data["ONG_S1Q10"] = String(comp.totalEmployees);
      }
      break;
    }

    case "administration": {
      setIfPresent(
        data,
        "ADMIN_S1Q01",
        (comp as Record<string, unknown>).administrationName ?? comp.name,
      );
      setIfPresent(
        data,
        "ADMIN_S1Q02",
        comp.sigle ?? (comp as Record<string, unknown>).shortName,
      );

      const aAdmin = mapArea(comp.area);
      if (aAdmin) data["ADMIN_S1Q03"] = aAdmin;

      setIfPresent(data, "ADMIN_S1Q04_REGION", comp.region);
      setIfPresent(data, "ADMIN_S1Q04_DEPT", comp.department);
      setIfPresent(data, "ADMIN_S1Q04_SUBDIV", comp.subdivision);
      setIfPresent(data, "ADMIN_S1Q04_LOCALITY", comp.address);

      setIfPresent(data, "ADMIN_S1Q05_TEL1", comp.phone);
      setIfPresent(data, "ADMIN_S1Q05_TEL2", comp.phone2);
      setIfPresent(data, "ADMIN_S1Q05_BP", comp.poBox);

      const adminAct = ((comp.mainActivity as string) ?? "").trim();
      const adminBr = ((comp.branch as string) ?? "").trim();
      if (adminAct) data["ADMIN_S1Q06"] = mapActivityToSector(adminAct);
      if (adminBr) data["ADMIN_S1Q07"] = adminBr;

      setIfPresent(data, "ADMIN_S1Q08", comp.mainMission);
      break;
    }

    case "projectprogram":
    case "project_program":
    case "project": {
      setIfPresent(
        data,
        "PP_S1Q02",
        (comp as Record<string, unknown>).projectProgramName ??
          (comp as Record<string, unknown>).projectName ??
          comp.name,
      );
      setIfPresent(
        data,
        "PP_S1Q03",
        comp.sigle ?? (comp as Record<string, unknown>).shortName,
      );
      setIfPresent(data, "PP_S1Q04", comp.promoterName ?? (fullName || undefined));

      const aPp = mapArea(comp.area);
      if (aPp) data["PP_S1Q05"] = aPp;

      setIfPresent(data, "PP_S1Q06_REGION", comp.region);
      setIfPresent(data, "PP_S1Q06_DEPT", comp.department);
      setIfPresent(data, "PP_S1Q06_SUBDIV", comp.subdivision);
      setIfPresent(data, "PP_S1Q06_LOCALITY", comp.address);

      setIfPresent(data, "PP_S1Q07_TEL1", comp.phone);
      setIfPresent(data, "PP_S1Q07_TEL2", comp.phone2);
      setIfPresent(data, "PP_S1Q07_BP", comp.poBox);

      const ppAct = ((comp.mainActivity as string) ?? "").trim();
      const ppBr = ((comp.branch as string) ?? "").trim();
      if (ppAct) data["PP_S1Q08"] = mapActivityToSector(ppAct);
      if (ppBr) data["PP_S1Q09"] = ppBr;

      setIfPresent(data, "PP_S1Q10", comp.mainMission);
      setIfPresent(data, "PP_S1Q11", comp.address);

      if (comp.totalEmployees !== null && comp.totalEmployees !== undefined) {
        data["PP_S1Q15"] = String(comp.totalEmployees);
      }
      break;
    }
  }

  return data;
}

/**
 * Merges a loaded draft with account registration autofill data.
 *
 * The form's own answer wins over registration: if a field already has a value
 * in formData (whether identification or statistical, including explicit 0),
 * that value is strictly preserved. Registration autofill only populates fields
 * that are absent, null, or empty in formData.
 */
export function mergeWithAutofill(formData: FormData, initialData: FormData): FormData {
  const result: FormData = { ...formData };
  for (const [key, val] of Object.entries(initialData)) {
    if (val === undefined || val === null || val === "") continue;

    // The form's own answer wins over registration — autofill only populates absent fields
    if (result[key] === undefined || result[key] === null || result[key] === "") {
      result[key] = val;
    }
  }
  return result;
}
