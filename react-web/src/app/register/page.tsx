"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  ApiError,
  checkEmailAvailable,
  getDepartmentsByRegion,
  getRegions,
  getSectors,
  getSubdivisionsByDepartment,
  registerCompany,
  type RegisterCompanyPayload,
} from "@/lib/api-client";
import {
  ENTITY_CONFIGS,
  ENTITY_TYPES_BY_STATUS,
  entityApiValue,
  isFieldVisible as checkFieldVisible,
  resolveAddress,
  resolveCompanyName,
  resolveMainActivity,
  type EntityType,
  type InstitutionStatus,
} from "@/lib/register-constants";
import { AREA_OPTIONS, RESPONDENT_FUNCTION_OPTIONS } from "@/lib/register-options";
import { passwordStrength, passwordStrengthLabel, validatePassword } from "@/lib/password-strength";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";
import { RegistrationProgress } from "@/components/auth/RegistrationProgress";
import { RegistrationReview } from "@/components/auth/RegistrationReview";

// CAM-LEAP Official Administrative Registration Wizard
// 6-step architecture: entityType -> respondent -> entityInfo -> location -> security -> review
// Visual standard: Serious, structured national administrative interface with emerald administrative frame

const STEPS = ["entityType", "respondent", "entityInfo", "location", "security", "review"] as const;
type Step = (typeof STEPS)[number];

interface RespondentState {
  firstName: string;
  lastName: string;
  function: string;
  email: string;
  phone1: string;
  phone2: string;
}

const ENTITY_DESCRIPTIONS: Record<EntityType, string> = {
  enterprise: "Société commerciale (SARL, SA, SAS), établissement privé, entreprise individuelle",
  cooperative: "Société coopérative avec ou sans conseil d'administration (Loi OHADA)",
  ctd: "Collectivités Territoriales Décentralisées (Régions, Communes, Communautés urbaines)",
  ong: "Organisation non gouvernementale, association agréée, fondation",
  administration: "Ministère, organisme public, établissement public administratif",
  projectProgram: "Projet ou programme de développement sous tutelle administrative",
  vocationalTraining: "Centre de formation professionnelle public ou privé (enquête ONEFOP)",
};

const ENTITY_TYPE_TRANSLATION_KEYS: Record<EntityType, { title: string; desc: string }> = {
  administration: {
    title: "registerPage.entityTypeAdministration",
    desc: "registerPage.entityDescAdministration",
  },
  ctd: {
    title: "registerPage.entityTypeCtd",
    desc: "registerPage.entityDescCtd",
  },
  projectProgram: {
    title: "registerPage.entityTypeProjectProgram",
    desc: "registerPage.entityDescProjectProgram",
  },
  enterprise: {
    title: "registerPage.entityTypeEnterprise",
    desc: "registerPage.entityDescEnterprise",
  },
  cooperative: {
    title: "registerPage.entityTypeCooperative",
    desc: "registerPage.entityDescCooperative",
  },
  ong: {
    title: "registerPage.entityTypeOng",
    desc: "registerPage.entityDescOng",
  },
  vocationalTraining: {
    title: "registerPage.entityTypeVocationalTraining",
    desc: "registerPage.entityDescVocationalTraining",
  },
};

const ENTITY_SECTIONS: Record<EntityType, { title: string; keys: string[] }[]> = {
  enterprise: [
    { title: "Identité juridique / Legal Identity", keys: ["companyName", "legalStatus", "socialCapital", "parentCompany"] },
    { title: "Fiscalité & Affiliation / Tax & Social", keys: ["taxNumber", "cnpsNumber"] },
    { title: "Activité économique / Economic Activity", keys: ["mainActivity", "secondaryActivity", "branch"] },
    { title: "Siège social & Coordonnées / Registered Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  cooperative: [
    { title: "Identité de la coopérative / Cooperative Legal Identity", keys: ["cooperativeName", "cooperativeType", "yearOfCreation", "taxNumber"] },
    { title: "Activité / Activity", keys: ["mainActivity", "branch"] },
    { title: "Siège social & Coordonnées / Registered Office & Contact", keys: ["cooperativeHeadOffice", "phone", "phone2", "poBox"] },
  ],
  ctd: [
    { title: "Identification de la CTD / RLA Identification", keys: ["ctdType", "ctdName", "yearOfCreation", "taxNumber"] },
    { title: "Siège & Coordonnées / Head Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  ong: [
    { title: "Enregistrement & Mission / NGO Registration & Mission", keys: ["ngoName", "registrationNumber", "taxNumber", "yearOfCreation", "mainMission"] },
    { title: "Siège social & Coordonnées / Registered Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  administration: [
    { title: "Identification administrative / Administrative Identity", keys: ["administrationName", "sigle", "mainMission"] },
    { title: "Siège & Coordonnées / Head Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  projectProgram: [
    { title: "Identification du projet / Project Identification", keys: ["projectProgramName", "sigle", "mainMission"] },
    { title: "Siège & Coordonnées / Head Office & Contact", keys: ["address", "phone", "phone2", "poBox"] },
  ],
  vocationalTraining: [
    { title: "Identification du Centre (CFP) / VTC Identification", keys: ["centerName", "sigle", "taxNumber", "yearOfCreation", "cfpType", "educationSystem"] },
    { title: "Situation opérationnelle / Operational Status", keys: ["functionalStatus", "nonFunctionalReason", "nonFunctionalReasonOther"] },
    { title: "Localisation & Coordonnées / Location & Contact", keys: ["address", "phone", "phone2", "poBox"] },
    { title: "Direction & Promoteur / Direction & Promoter", keys: ["promoterName", "promoterSex", "promoterPhone1", "promoterPhone2"] },
  ],
};

export default function RegisterPage() {
  const t = useTranslations();
  const [step, setStep] = useState<Step>("entityType");
  const [institutionStatus, setInstitutionStatus] = useState<InstitutionStatus | null>(null);
  const [isSelectingStatus, setIsSelectingStatus] = useState(true);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [respondent, setRespondent] = useState<RespondentState>({
    firstName: "",
    lastName: "",
    function: "",
    email: "",
    phone1: "",
    phone2: "",
  });
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [entityData, setEntityData] = useState<Record<string, string>>({});
  const [regionId, setRegionId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [subdivisionId, setSubdivisionId] = useState("");
  const [area, setArea] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [obscurePassword, setObscurePassword] = useState(true);
  const [obscureConfirm, setObscureConfirm] = useState(true);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ establishmentId?: string | null; companyName: string; attestationUrl?: string | null } | null>(null);

  const config = entityType ? ENTITY_CONFIGS[entityType] : null;

  const regionsQuery = useQuery({ queryKey: ["locations", "regions"], queryFn: getRegions, enabled: step === "location" });
  const departmentsQuery = useQuery({
    queryKey: ["locations", "departments", regionId],
    queryFn: () => getDepartmentsByRegion(regionId),
    enabled: step === "location" && !!regionId,
  });
  const subdivisionsQuery = useQuery({
    queryKey: ["locations", "subdivisions", departmentId],
    queryFn: () => getSubdivisionsByDepartment(departmentId),
    enabled: step === "location" && !!departmentId,
  });
  const sectorsQuery = useQuery({ queryKey: ["sectors"], queryFn: getSectors, enabled: step === "location" });

  // Debounced email availability check
  useEffect(() => {
    const email = respondent.email.trim();
    const handle = setTimeout(() => {
      if (!email || !email.includes("@")) {
        setEmailAvailable(null);
        return;
      }
      checkEmailAvailable(email)
        .then((r) => setEmailAvailable(r.available))
        .catch(() => setEmailAvailable(null));
    }, 400);
    return () => clearTimeout(handle);
  }, [respondent.email]);

  function setEntityField(key: string, value: string) {
    setEntityData((prev) => ({ ...prev, [key]: value }));
  }

  function isFieldVisible(field: { key?: string; dependsOn?: string; dependsValue?: string }): boolean {
    return checkFieldVisible(field as import("@/lib/register-constants").EntityField, entityData, config?.fields);
  }

  const showStatusSelection = isSelectingStatus || !institutionStatus;

  function handleSelectStatus(status: InstitutionStatus) {
    if (status !== institutionStatus) {
      setInstitutionStatus(status);
      // Clear the selected entity type if it is no longer valid under the newly selected status
      if (entityType && !ENTITY_TYPES_BY_STATUS[status].includes(entityType)) {
        setEntityType(null);
      }
    }
    setIsSelectingStatus(false);
    setStepError(null);
  }

  function goNext() {
    setStepError(null);
    const idx = STEPS.indexOf(step);

    if (step === "entityType") {
      if (showStatusSelection) {
        if (!institutionStatus) {
          setStepError(t("registerPage.errorInstitutionStatusRequired"));
          return;
        }
        setIsSelectingStatus(false);
        return;
      }
      if (!entityType || !ENTITY_TYPES_BY_STATUS[institutionStatus].includes(entityType)) {
        setStepError(t("registerPage.errorEntityTypeRequired"));
        return;
      }
    }
    if (step === "respondent") {
      const { firstName, lastName, function: fn, email, phone1 } = respondent;
      if (!firstName.trim() || !lastName.trim() || !fn || !email.trim() || !phone1.trim()) {
        setStepError(t("registerPage.errorRequiredFields"));
        return;
      }
      if (emailAvailable === false) {
        setStepError(t("registerPage.errorEmailInUse"));
        return;
      }
    }
    if (step === "entityInfo" && config) {
      for (const field of config.fields) {
        if (field.required && isFieldVisible(field) && !entityData[field.key]?.trim()) {
          setStepError(t("registerPage.errorRequiredFields"));
          return;
        }
      }
    }
    if (step === "location") {
      if (!regionId) {
        setStepError(t("registerPage.errorSelectRegion"));
        return;
      }
      if (!departmentId) {
        setStepError(t("registerPage.errorSelectDepartment"));
        return;
      }
      if (!subdivisionId) {
        setStepError(t("registerPage.errorSelectSubdivision"));
        return;
      }
      if (!area) {
        setStepError(t("registerPage.errorSelectArea"));
        return;
      }
    }
    if (step === "security") {
      const pwError = validatePassword(password);
      if (pwError) {
        setStepError(pwError);
        return;
      }
      if (password !== confirmPassword) {
        setStepError(t("registerPage.errorPasswordMismatch"));
        return;
      }
    }

    setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  }

  function goBack() {
    setStepError(null);
    const idx = STEPS.indexOf(step);
    setStep(STEPS[Math.max(idx - 1, 0)]);
  }

  // Intercept Enter key to navigate sequentially between form fields
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return;

    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tagName = target.tagName.toLowerCase();
    // Allow default behavior for buttons and textareas
    if (tagName === "button" || tagName === "textarea" || (target as HTMLInputElement).type === "submit") {
      return;
    }

    const form = e.currentTarget;
    const selector = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';
    const formFields = Array.from(form.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => el.offsetParent !== null && !el.hasAttribute("aria-hidden") && el.tabIndex !== -1
    );

    const currentIndex = formFields.indexOf(target);
    if (currentIndex === -1) return;

    e.preventDefault();

    if (e.shiftKey) {
      if (currentIndex > 0) {
        formFields[currentIndex - 1].focus();
      }
    } else {
      if (currentIndex < formFields.length - 1) {
        formFields[currentIndex + 1].focus();
      } else {
        goNext();
      }
    }
  };

  const regionName = regionsQuery.data?.find((r) => r.id === regionId)?.name;
  const departmentName = departmentsQuery.data?.find((d) => d.id === departmentId)?.name;
  const subdivisionName = subdivisionsQuery.data?.find((s) => s.id === subdivisionId)?.name;
  const sectorName = sectorsQuery.data?.find((s) => s.id === sectorId)?.name;

  async function submit() {
    if (!entityType || !config) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const companyName = resolveCompanyName(entityData, `${respondent.firstName} ${respondent.lastName}`);
      const address = resolveAddress(entityData);
      const mainActivity = resolveMainActivity(entityData);

      const payload: RegisterCompanyPayload = {
        email: respondent.email.trim(),
        password,
        firstName: respondent.firstName.trim(),
        lastName: respondent.lastName.trim(),
        role: "COMPANY",
        region: regionName,
        department: departmentName,
        subdivision: subdivisionName,
        regionId: regionId || undefined,
        departmentId: departmentId || undefined,
        subdivisionId: subdivisionId || undefined,
        area,
        entityType: entityApiValue(entityType),
        companyName,
        taxNumber: entityData.taxNumber ?? "",
        mainActivity,
        address,
        parentCompany: entityData.parentCompany,
        secondaryActivity: entityData.secondaryActivity,
        cnpsNumber: entityData.cnpsNumber,
        socialCapital: entityData.socialCapital ? Number(entityData.socialCapital) : undefined,
        legalStatus: entityData.legalStatus,
        cooperativeType: entityData.cooperativeType,
        yearOfCreation: entityData.yearOfCreation,
        ctdType: entityData.ctdType,
        mainMission: entityData.mainMission,
        registrationNumber: entityData.registrationNumber,
        trainingDomains: entityData.trainingDomains,
        branch: entityData.branch,
        poBox: entityData.poBox,
        phone: entityData.phone,
        phone2: entityData.phone2,
        sigle: entityData.sigle,
        cfpType: entityData.cfpType,
        educationSystem: entityData.educationSystem,
        functionalStatus: entityData.functionalStatus,
        nonFunctionalReason: entityData.nonFunctionalReason,
        nonFunctionalReasonOther: entityData.nonFunctionalReasonOther,
        promoterName: entityData.promoterName,
        promoterSex: entityData.promoterSex,
        promoterPhone1: entityData.promoterPhone1,
        promoterPhone2: entityData.promoterPhone2,
        sectorId: sectorId || undefined,
        respondentFunction: respondent.function,
        respondentPhone: respondent.phone1,
        respondentPhone2: respondent.phone2 || undefined,
      };

      const response = await registerCompany(payload);
      setResult({
        establishmentId: response.company.establishmentId,
        companyName: response.company.name ?? companyName,
        attestationUrl: response.company.attestationUrl,
      });
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Password strength calculations
  const pwScore = passwordStrength(password);
  const pwSegments = password ? (pwScore >= 0.9 ? 4 : pwScore >= 0.65 ? 3 : pwScore >= 0.35 ? 2 : 1) : 0;

  // Render receipt screen on success
  if (result) {
    return (
      <main className="cam-auth-page">
        <div className="wrap-wide">
          <AuthHeader />
          <div className="card card--admin">
            <div className="stripe" aria-hidden="true" />
            <div className="card-body">
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "rgba(30, 107, 58, 0.1)",
                    color: "var(--cam-green)",
                    marginBottom: "12px",
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h1 className="brand-name" style={{ fontSize: 20, marginBottom: 4 }}>
                  {t("registerPage.successTitle")}
                </h1>
                <p className="brand-sub" style={{ fontSize: 13 }}>
                  Attestation officielle d&apos;enregistrement au système national CAM-LEAP
                </p>
              </div>

              <table className="table-official">
                <tbody>
                  <tr>
                    <td className="label-cell">Dénomination / Organisation</td>
                    <td className="value-cell" style={{ fontWeight: 700 }}>{result.companyName}</td>
                  </tr>
                  {config && (
                    <tr>
                      <td className="label-cell">Catégorie d&apos;entité / Type</td>
                      <td className="value-cell">{config.title}</td>
                    </tr>
                  )}
                  {result.establishmentId && (
                    <tr>
                      <td className="label-cell">Identifiant d&apos;établissement</td>
                      <td className="value-cell">
                        <span
                          style={{
                            fontFamily: "var(--cam-font-mono, monospace)",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "var(--cam-green-dark)",
                            background: "rgba(30, 107, 58, 0.08)",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            display: "inline-block",
                          }}
                        >
                          {result.establishmentId}
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="label-cell">Déclarant habilité / Respondent</td>
                    <td className="value-cell">{respondent.firstName} {respondent.lastName} ({respondent.email})</td>
                  </tr>
                  <tr>
                    <td className="label-cell">Statut de validation / Status</td>
                    <td className="value-cell" style={{ color: "var(--cam-green-dark)", fontWeight: 600 }}>
                      Enregistré / Compte opérationnel
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: "24px" }}>
                <Link href="/login" className="btn-primary">
                  {t("registerPage.signInLink")}
                </Link>
              </div>
            </div>
            <div className="card-footer">
              <span className="create-account">
                <Link href="/login">{t("registerPage.backToSignInLink")}</Link>
              </span>
            </div>
          </div>
          <p className="help">
            {t("loginPage.needHelpText")}{" "}
            <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
              {t("loginPage.whatsappLink")}
            </a>
          </p>
        </div>
      </main>
    );
  }

  // Registration wizard steps
  return (
    <main className="cam-auth-page">
      <div className="wrap-wide">
        <AuthHeader />

        <div className="card card--admin">
          <div className="stripe" aria-hidden="true" />
          <div className="card-body">
            {/* Desktop and mobile progress rails */}
            <RegistrationProgress currentStep={step} />

            {/* STEP 1: ENTITY TYPE (Progressive Two-State Classification Flow) */}
            {step === "entityType" && (
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cam-green-dark)", margin: "0 0 4px" }}>
                    {t("registerPage.entityTypeLegend")}
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--cam-text-muted)", margin: 0 }}>
                    {t("registerPage.entityTypeSubtitle")}
                  </p>
                </div>

                {/* STATE 1: Institution Status (Single Card) */}
                {showStatusSelection && (
                  <fieldset
                    style={{
                      background: "var(--cam-surface)",
                      border: "1px solid var(--cam-border)",
                      borderRadius: "var(--cam-radius-card, 8px)",
                      padding: "18px 20px",
                      margin: 0,
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
                    }}
                  >
                    <legend
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--cam-text)",
                        margin: "0 0 14px 0",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        width: "100%",
                      }}
                    >
                      <span>{t("registerPage.institutionStatusQuestion")}</span>
                      <span style={{ color: "var(--cam-error)" }} aria-hidden="true">*</span>
                    </legend>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {/* Option: Public */}
                      <label
                        onClick={() => handleSelectStatus("public")}
                        style={{
                          border: institutionStatus === "public" ? "2px solid var(--cam-green)" : "1px solid var(--cam-border)",
                          borderRadius: "var(--cam-radius-control, 6px)",
                          padding: "14px 16px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          background: institutionStatus === "public" ? "rgba(30, 107, 58, 0.04)" : "var(--cam-surface)",
                          boxShadow: institutionStatus === "public" ? "0 1px 3px rgba(30, 107, 58, 0.08)" : "none",
                          transition: "border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease",
                        }}
                      >
                        <input
                          type="radio"
                          name="institutionStatus"
                          value="public"
                          checked={institutionStatus === "public"}
                          onChange={() => handleSelectStatus("public")}
                          style={{
                            accentColor: "var(--cam-green)",
                            width: 17,
                            height: 17,
                            marginTop: 2,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: institutionStatus === "public" ? 700 : 600, color: "var(--cam-text)" }}>
                            {t("registerPage.institutionStatusPublic")}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--cam-text-muted)", marginTop: 2, lineHeight: 1.35 }}>
                            {t("registerPage.institutionStatusPublicDesc")}
                          </div>
                        </div>
                      </label>

                      {/* Option: Privé */}
                      <label
                        onClick={() => handleSelectStatus("private")}
                        style={{
                          border: institutionStatus === "private" ? "2px solid var(--cam-green)" : "1px solid var(--cam-border)",
                          borderRadius: "var(--cam-radius-control, 6px)",
                          padding: "14px 16px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          background: institutionStatus === "private" ? "rgba(30, 107, 58, 0.04)" : "var(--cam-surface)",
                          boxShadow: institutionStatus === "private" ? "0 1px 3px rgba(30, 107, 58, 0.08)" : "none",
                          transition: "border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease",
                        }}
                      >
                        <input
                          type="radio"
                          name="institutionStatus"
                          value="private"
                          checked={institutionStatus === "private"}
                          onChange={() => handleSelectStatus("private")}
                          style={{
                            accentColor: "var(--cam-green)",
                            width: 17,
                            height: 17,
                            marginTop: 2,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "14px", fontWeight: institutionStatus === "private" ? 700 : 600, color: "var(--cam-text)" }}>
                            {t("registerPage.institutionStatusPrivate")}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--cam-text-muted)", marginTop: 2, lineHeight: 1.35 }}>
                            {t("registerPage.institutionStatusPrivateDesc")}
                          </div>
                        </div>
                      </label>
                    </div>
                  </fieldset>
                )}

                {/* STATE 2: Entity Type Selection (Replaces Card 1 completely) */}
                {!showStatusSelection && institutionStatus && (
                  <div>
                    {/* Secondary contextual control to modify status */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "8px",
                        marginBottom: "12px",
                        padding: "8px 12px",
                        background: "var(--cam-surface-subtle, #f5f7f4)",
                        border: "1px solid var(--cam-border)",
                        borderRadius: "var(--cam-radius-control, 6px)",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ color: "var(--cam-text-muted)" }}>
                        {t("registerPage.selectedStatusLabel")} :{" "}
                        <strong style={{ color: "var(--cam-text)", fontWeight: 700 }}>
                          {institutionStatus === "public"
                            ? t("registerPage.institutionStatusPublic")
                            : t("registerPage.institutionStatusPrivate")}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSelectingStatus(true);
                          setStepError(null);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--cam-green)",
                          fontWeight: 600,
                          fontSize: "12px",
                          cursor: "pointer",
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          textDecoration: "underline",
                        }}
                      >
                        ← {t("registerPage.changeStatusAction")}
                      </button>
                    </div>

                    {/* Compact Filtered Entity Type Card with Dropdown */}
                    <div
                      style={{
                        background: "var(--cam-surface)",
                        border: "1px solid var(--cam-border)",
                        borderLeft: "4px solid var(--cam-green)",
                        borderRadius: "var(--cam-radius-card, 8px)",
                        padding: "16px 18px",
                        margin: 0,
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
                      }}
                    >
                      <label
                        htmlFor="reg-entity-type-select"
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--cam-text)",
                          marginBottom: "10px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span>{t("registerPage.selectEntityTypeHeading")}</span>
                        <span style={{ color: "var(--cam-error)" }} aria-hidden="true">*</span>
                      </label>

                      <div className="input-row">
                        <select
                          id="reg-entity-type-select"
                          aria-required={true}
                          value={entityType ?? ""}
                          onChange={(e) => {
                            setEntityType((e.target.value as EntityType) || null);
                            setStepError(null);
                          }}
                          style={{
                            height: "44px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: entityType ? 600 : 400,
                          }}
                        >
                          <option value="">{t("registerPage.selectEntityTypePlaceholder")}</option>
                          {ENTITY_TYPES_BY_STATUS[institutionStatus].map((type) => {
                            const keys = ENTITY_TYPE_TRANSLATION_KEYS[type];
                            const title = keys?.title ? t(keys.title) : ENTITY_CONFIGS[type]?.title;
                            return (
                              <option key={type} value={type}>
                                {title}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Display the contextual description of the selected type */}
                      {entityType && (
                        <div
                          style={{
                            marginTop: "12px",
                            padding: "9px 12px",
                            background: "rgba(30, 107, 58, 0.04)",
                            border: "1px solid rgba(30, 107, 58, 0.15)",
                            borderRadius: "var(--cam-radius-control, 6px)",
                            fontSize: "12px",
                            color: "var(--cam-text-muted)",
                            lineHeight: 1.4,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "var(--cam-text)" }}>
                            {ENTITY_TYPE_TRANSLATION_KEYS[entityType]?.title
                              ? t(ENTITY_TYPE_TRANSLATION_KEYS[entityType].title)
                              : ENTITY_CONFIGS[entityType]?.title} :{" "}
                          </span>
                          {ENTITY_TYPE_TRANSLATION_KEYS[entityType]?.desc
                            ? t(ENTITY_TYPE_TRANSLATION_KEYS[entityType].desc)
                            : (ENTITY_DESCRIPTIONS[entityType] ?? "")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: RESPONDENT */}
            {step === "respondent" && (
              <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleFormKeyDown}>
                <div style={{ marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cam-green-dark)", margin: "0 0 4px" }}>
                    {t("registerPage.respondentTitle")} — Habilitation officielle
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--cam-text-muted)", margin: 0 }}>
                    Coordonnées de la personne habilitée à effectuer les déclarations officielles pour l&apos;établissement.
                  </p>
                </div>

                <div className="form-single-column">
                  <div className="field">
                    <label htmlFor="reg-first-name">
                      {t("registerPage.firstNameLabel")} <span style={{ color: "var(--cam-error)" }}>*</span>
                    </label>
                    <div className="input-row">
                      <input
                        id="reg-first-name"
                        aria-required={true}
                        value={respondent.firstName}
                        onChange={(e) => setRespondent((r) => ({ ...r, firstName: e.target.value }))}
                        placeholder="Ex: Emmanuel"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="reg-last-name">
                      {t("registerPage.lastNameLabel")} <span style={{ color: "var(--cam-error)" }}>*</span>
                    </label>
                    <div className="input-row">
                      <input
                        id="reg-last-name"
                        aria-required={true}
                        value={respondent.lastName}
                        onChange={(e) => setRespondent((r) => ({ ...r, lastName: e.target.value }))}
                        placeholder="Ex: Biya"
                      />
                    </div>
                  </div>

                  <div className="field" style={{ width: "100%" }}>
                    <label htmlFor="reg-function">
                      {t("registerPage.functionLabel")} <span style={{ color: "var(--cam-error)" }}>*</span>
                    </label>
                    <div className="input-row">
                      <select
                        id="reg-function"
                        aria-required={true}
                        value={respondent.function}
                        onChange={(e) => setRespondent((r) => ({ ...r, function: e.target.value }))}
                      >
                        <option value="">{t("registerPage.selectPlaceholder")}</option>
                        {RESPONDENT_FUNCTION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field" style={{ width: "100%" }}>
                    <label htmlFor="reg-email">
                      {t("registerPage.professionalEmailLabel")} <span style={{ color: "var(--cam-error)" }}>*</span>
                    </label>
                    <div className="input-row">
                      <input
                        id="reg-email"
                        aria-required={true}
                        type="email"
                        value={respondent.email}
                        onChange={(e) => setRespondent((r) => ({ ...r, email: e.target.value }))}
                        placeholder="contact@organisation.cm"
                      />
                    </div>
                    {emailAvailable === false && (
                      <span style={{ color: "var(--cam-error)", fontSize: 12, fontWeight: 600, marginTop: 4, display: "block" }}>
                        ⚠ {t("registerPage.emailUnavailable")}
                      </span>
                    )}
                    {emailAvailable === true && (
                      <span style={{ color: "var(--cam-green)", fontSize: 12, fontWeight: 600, marginTop: 4, display: "block" }}>
                        ✓ {t("registerPage.emailAvailable")}
                      </span>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="reg-phone1">
                      {t("registerPage.phone1Label")} <span style={{ color: "var(--cam-error)" }}>*</span>
                    </label>
                    <div className="input-row">
                      <input
                        id="reg-phone1"
                        aria-required={true}
                        type="tel"
                        value={respondent.phone1}
                        onChange={(e) => setRespondent((r) => ({ ...r, phone1: e.target.value }))}
                        placeholder="6XXXXXXXX"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="reg-phone2">
                      {t("registerPage.phone2Label")} (optionnel)
                    </label>
                    <div className="input-row">
                      <input
                        id="reg-phone2"
                        type="tel"
                        value={respondent.phone2}
                        onChange={(e) => setRespondent((r) => ({ ...r, phone2: e.target.value }))}
                        placeholder="6XXXXXXXX / 2XXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 3: ENTITY INFORMATION */}
            {step === "entityInfo" && config && entityType && (
              <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleFormKeyDown}>
                <div style={{ marginBottom: "14px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cam-green-dark)", margin: "0 0 4px" }}>
                    {config.title}
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--cam-text-muted)", margin: 0 }}>
                    Renseignez les données administratives et statutaires de votre structure.
                  </p>
                </div>

                {/* Subsections per entity type */}
                {(() => {
                  const sections = ENTITY_SECTIONS[entityType] ?? [
                    { title: "Informations générales / General Information", keys: config.fields.map((f) => f.key) },
                  ];

                  // Track rendered field keys to ensure all config fields are rendered
                  const renderedKeys = new Set<string>();

                  return (
                    <>
                      {sections.map((sec, secIdx) => {
                        const secFields = config.fields.filter(
                          (f) => sec.keys.includes(f.key) && isFieldVisible(f)
                        );
                        if (secFields.length === 0) return null;

                        secFields.forEach((f) => renderedKeys.add(f.key));

                        return (
                          <div key={secIdx}>
                            <div className="admin-section-header">{sec.title}</div>
                            <div className="form-single-column">
                              {secFields.map((field) => (
                                <div key={field.key} className="field">
                                  <label htmlFor={`reg-entity-${field.key}`}>
                                    {field.label}
                                    {field.required && <span style={{ color: "var(--cam-error)" }}> *</span>}
                                    {field.hint && (
                                      <span style={{ fontWeight: 400, color: "var(--cam-text-muted)" }}>
                                        {" "}({field.hint})
                                      </span>
                                    )}
                                  </label>
                                  <div className="input-row">
                                    {field.kind === "select" ? (
                                      <select
                                        id={`reg-entity-${field.key}`}
                                        aria-required={field.required ? true : undefined}
                                        value={entityData[field.key] ?? ""}
                                        onChange={(e) => setEntityField(field.key, e.target.value)}
                                      >
                                        <option value="">{t("registerPage.selectPlaceholder")}</option>
                                        {field.options?.map((o) => (
                                          <option key={o.value} value={o.value}>
                                            {o.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        id={`reg-entity-${field.key}`}
                                        aria-required={field.required ? true : undefined}
                                        type={field.kind === "tel" ? "tel" : field.kind === "number" ? "number" : "text"}
                                        value={entityData[field.key] ?? ""}
                                        onChange={(e) => setEntityField(field.key, e.target.value)}
                                      />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Fallback for any field not explicitly mapped to a section */}
                      {(() => {
                        const remainingFields = config.fields.filter(
                          (f) => !renderedKeys.has(f.key) && isFieldVisible(f)
                        );
                        if (remainingFields.length === 0) return null;

                        return (
                          <div>
                            <div className="admin-section-header">Informations complémentaires</div>
                            <div className="form-single-column">
                              {remainingFields.map((field) => (
                                <div key={field.key} className="field">
                                  <label htmlFor={`reg-entity-${field.key}`}>
                                    {field.label}
                                    {field.required && <span style={{ color: "var(--cam-error)" }}> *</span>}
                                  </label>
                                  <div className="input-row">
                                    {field.kind === "select" ? (
                                      <select
                                        id={`reg-entity-${field.key}`}
                                        aria-required={field.required ? true : undefined}
                                        value={entityData[field.key] ?? ""}
                                        onChange={(e) => setEntityField(field.key, e.target.value)}
                                      >
                                        <option value="">{t("registerPage.selectPlaceholder")}</option>
                                        {field.options?.map((o) => (
                                          <option key={o.value} value={o.value}>
                                            {o.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        id={`reg-entity-${field.key}`}
                                        aria-required={field.required ? true : undefined}
                                        type={field.kind === "tel" ? "tel" : field.kind === "number" ? "number" : "text"}
                                        value={entityData[field.key] ?? ""}
                                        onChange={(e) => setEntityField(field.key, e.target.value)}
                                      />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </form>
            )}

            {/* STEP 4: LOCATION */}
            {step === "location" && (
              <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleFormKeyDown}>
                <div style={{ marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cam-green-dark)", margin: "0 0 4px" }}>
                    {t("registerPage.locationTitle")} — Rattachement territorial
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--cam-text-muted)", margin: 0 }}>
                    Précisez le découpage administratif et le secteur d&apos;activité de votre établissement.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="field" style={{ width: "100%" }}>
                    <label htmlFor="reg-area">
                      {t("registerPage.areaLabel")} <span style={{ color: "var(--cam-error)" }}>*</span>
                    </label>
                    <div className="input-row">
                      <select
                        id="reg-area"
                        aria-required={true}
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                      >
                        <option value="">{t("registerPage.urbanRuralPlaceholder")}</option>
                        {AREA_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ paddingTop: "14px", borderTop: "1px solid var(--cam-border)" }}>
                    <div style={{ fontSize: "12px", color: "var(--cam-text-muted)", marginBottom: "8px", fontStyle: "italic" }}>
                      Chaque champ dépend du précédent
                    </div>

                    <div className="field">
                      <label htmlFor="reg-region">
                        {t("registerPage.regionLabel")} <span style={{ color: "var(--cam-error)" }}>*</span>
                      </label>
                      <div className="input-row">
                        <select
                          id="reg-region"
                          aria-required={true}
                          value={regionId}
                          onChange={(e) => {
                            setRegionId(e.target.value);
                            setDepartmentId("");
                            setSubdivisionId("");
                          }}
                        >
                          <option value="">{t("registerPage.selectPlaceholder")}</option>
                          {regionsQuery.data?.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ marginTop: "12px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span style={{ fontSize: "16px", color: !regionId ? "#cbd5e1" : "#64748b", marginTop: "28px", userSelect: "none" }} aria-hidden="true">
                        ↳
                      </span>
                      <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                        <label htmlFor="reg-department" style={{ color: !regionId ? "var(--cam-text-muted)" : undefined }}>
                          {t("registerPage.departmentLabel")}
                        </label>
                        <div className="input-row">
                          <select
                            id="reg-department"
                            value={departmentId}
                            disabled={!regionId}
                            onChange={(e) => {
                              setDepartmentId(e.target.value);
                              setSubdivisionId("");
                            }}
                          >
                            <option value="">
                              {regionId ? t("registerPage.selectPlaceholder") : t("registerPage.selectRegionFirst")}
                            </option>
                            {departmentsQuery.data?.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "12px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span style={{ fontSize: "16px", color: !departmentId ? "#cbd5e1" : "#64748b", marginTop: "28px", userSelect: "none" }} aria-hidden="true">
                        ↳
                      </span>
                      <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                        <label htmlFor="reg-subdivision" style={{ color: !departmentId ? "var(--cam-text-muted)" : undefined }}>
                          {t("registerPage.subdivisionLabel")}
                        </label>
                        <div className="input-row">
                          <select
                            id="reg-subdivision"
                            value={subdivisionId}
                            disabled={!departmentId}
                            onChange={(e) => setSubdivisionId(e.target.value)}
                          >
                            <option value="">
                              {departmentId ? t("registerPage.selectPlaceholder") : t("registerPage.selectDepartmentFirst")}
                            </option>
                            {subdivisionsQuery.data?.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="field" style={{ width: "100%", marginTop: "6px" }}>
                    <label htmlFor="reg-sector">
                      {t("registerPage.sectorLabel")}
                    </label>
                    <div className="input-row">
                      <select
                        id="reg-sector"
                        value={sectorId}
                        onChange={(e) => setSectorId(e.target.value)}
                      >
                        <option value="">{t("registerPage.selectPlaceholder")}</option>
                        {sectorsQuery.data?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 5: SECURITY */}
            {step === "security" && (
              <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleFormKeyDown}>
                <div style={{ marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cam-green-dark)", margin: "0 0 4px" }}>
                    {t("registerPage.securityTitle")} — Paramètres d&apos;accès
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--cam-text-muted)", margin: 0 }}>
                    Définissez un mot de passe robuste pour sécuriser l&apos;accès à votre espace déclarant.
                  </p>
                </div>

                <div className="form-single-column">
                  <div className="field">
                    <label htmlFor="reg-password">
                      {t("registerPage.passwordLabel")} <span style={{ color: "var(--cam-error)" }}>*</span>
                    </label>
                    <div className="input-row">
                      <input
                        id="reg-password"
                        aria-required={true}
                        type={obscurePassword ? "password" : "text"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                      />
                      <PasswordVisibilityToggle
                        obscured={obscurePassword}
                        onToggle={() => setObscurePassword((v) => !v)}
                        showLabel={t("registerPage.showPasswordButton")}
                        hideLabel={t("registerPage.hidePasswordButton")}
                      />
                    </div>

                    {/* Segmented strength meter */}
                    {password && (
                      <div style={{ marginTop: "6px" }}>
                        <div className="password-strength-meter">
                          {[1, 2, 3, 4].map((seg) => (
                            <div
                              key={seg}
                              className={`password-strength-seg ${seg <= pwSegments ? `active-${pwSegments}` : ""}`}
                            />
                          ))}
                        </div>
                        <span style={{ fontSize: "11px", color: "var(--cam-text-muted)", marginTop: "4px", display: "block" }}>
                          Robustesse : <strong>{passwordStrengthLabel(pwScore)}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="reg-confirm-password">
                      {t("registerPage.confirmPasswordLabel")} <span style={{ color: "var(--cam-error)" }}>*</span>
                    </label>
                    <div className="input-row">
                      <input
                        id="reg-confirm-password"
                        aria-required={true}
                        type={obscureConfirm ? "password" : "text"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                      />
                      <PasswordVisibilityToggle
                        obscured={obscureConfirm}
                        onToggle={() => setObscureConfirm((v) => !v)}
                        showLabel={t("registerPage.showPasswordButton")}
                        hideLabel={t("registerPage.hidePasswordButton")}
                      />
                    </div>
                    {confirmPassword && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          marginTop: "4px",
                          display: "block",
                          color: password === confirmPassword ? "var(--cam-green)" : "var(--cam-error)",
                        }}
                      >
                        {password === confirmPassword
                          ? "✓ Les mots de passe correspondent"
                          : "⚠ Les mots de passe ne correspondent pas"}
                      </span>
                    )}
                  </div>

                  {/* Password guidelines box */}
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      background: "var(--cam-surface-subtle)",
                      border: "1px solid var(--cam-border)",
                      borderRadius: "var(--cam-radius-sm)",
                      padding: "10px 14px",
                      fontSize: "12px",
                      color: "var(--cam-text-muted)",
                      marginTop: "4px",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "var(--cam-text)", display: "block", marginBottom: 2 }}>
                      Critères de sécurité administrative :
                    </span>
                    Minimum 8 caractères, comprenant idéalement au moins une majuscule, un chiffre et un caractère spécial.
                  </div>
                </div>
              </form>
            )}

            {/* STEP 6: REVIEW */}
            {step === "review" && config && entityType && (
              <div>
                <div style={{ marginBottom: "12px" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cam-green-dark)", margin: "0 0 4px" }}>
                    {t("registerPage.reviewTitle")} — Contrôle avant transmission
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--cam-text-muted)", margin: 0 }}>
                    Vérifiez l&apos;exactitude des données enregistrées avant de confirmer la création officielle du compte.
                  </p>
                </div>

                {submitError && (
                  <div className="auth-error-box" role="alert" style={{ marginBottom: "14px" }}>
                    {submitError}
                  </div>
                )}

                <RegistrationReview
                  entityType={entityType}
                  config={config}
                  respondent={respondent}
                  entityData={entityData}
                  regionName={regionName}
                  departmentName={departmentName}
                  subdivisionName={subdivisionName}
                  area={area}
                  sectorName={sectorName}
                  onEdit={(targetStep) => setStep(targetStep)}
                />
              </div>
            )}

            {/* Step error banner */}
            {stepError && (
              <div className="auth-error-box" role="alert" style={{ marginTop: "16px" }}>
                {stepError}
              </div>
            )}

            {/* Wizard action buttons */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "24px",
                paddingTop: "16px",
                borderTop: "1px solid var(--cam-border)",
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={goBack}
                disabled={step === "entityType" || submitting}
              >
                ← {t("registerPage.backButton")}
              </button>

              {step === "review" ? (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: "auto", minWidth: "160px", padding: "10px 22px" }}
                  onClick={submit}
                  disabled={submitting}
                >
                  {submitting
                    ? t("registerPage.submittingLabel")
                    : t("registerPage.submitButton")}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: "auto", minWidth: "120px", padding: "10px 22px" }}
                  onClick={goNext}
                >
                  {t("registerPage.nextButton")} →
                </button>
              )}
            </div>
          </div>

          <div className="card-footer">
            <span className="create-account">
              <Link href="/login">{t("registerPage.backToSignInLink")}</Link>
            </span>
          </div>
        </div>

        <p className="help">
          {t("loginPage.needHelpText")}{" "}
          <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
            {t("loginPage.whatsappLink")}
          </a>
        </p>
      </div>
    </main>
  );
}
