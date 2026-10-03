"use client";

import { useEffect, useRef, useState } from "react";
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
  REGISTRATION_STEP_IDS,
  entityApiValue,
  isFieldVisible as checkFieldVisible,
  pruneEntityDataForType,
  resolveAddress,
  resolveCompanyName,
  resolveMainActivity,
  visibleEntityDataForType,
  type EntityField,
  type EntityType,
  type RegistrationStepId,
} from "@/lib/register-constants";
import {
  isSectionComplete,
  type RegState,
  type SubdivisionsStatus,
} from "@/lib/register-completeness";
import { AREA_OPTIONS, RESPONDENT_FUNCTION_OPTIONS } from "@/lib/register-options";
import {
  PASSWORD_RULE_IDS,
  passwordRuleChecks,
  passwordStrength,
  passwordStrengthLabel,
  validatePassword,
} from "@/lib/password-strength";
import { resetScroll } from "@/lib/reset-scroll";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { FormRow } from "@/components/auth/FormRow";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";
import { RegistrationProgress } from "@/components/auth/RegistrationProgress";
import { RegistrationReview } from "@/components/auth/RegistrationReview";
import { StepHeader } from "@/components/auth/StepHeader";

// CAM-LEAP Official Administrative Registration Wizard
// 6-step architecture: entityType -> respondent -> entityInfo -> location -> security -> review
// Visual standard: Serious, structured national administrative interface with emerald administrative frame

// Single source of truth lives in register-constants.ts, shared with
// RegistrationProgress so the navigation order and the rail labels cannot drift.
const STEPS = REGISTRATION_STEP_IDS;
type Step = RegistrationStepId;

interface RespondentState {
  firstName: string;
  lastName: string;
  function: string;
  email: string;
  phone1: string;
  phone2: string;
}

// Step 1 radio list: one row per structure type, in respondent-facing order.
// Labels avoid administrative codes (CTD/ONG/CFP); the two types whose plain
// label is ambiguous carry a short hint. Replaces the former public/private
// two-state classification flow, which was UI-only and never reached the payload.
const ENTITY_TYPE_OPTIONS: { type: EntityType; labelKey: string; hintKey?: string }[] = [
  { type: "enterprise", labelKey: "registerPage.entityOptionEnterprise" },
  { type: "cooperative", labelKey: "registerPage.entityOptionCooperative" },
  { type: "ong", labelKey: "registerPage.entityOptionOng" },
  {
    type: "administration",
    labelKey: "registerPage.entityOptionAdministration",
    hintKey: "registerPage.entityOptionAdministrationHint",
  },
  {
    type: "ctd",
    labelKey: "registerPage.entityOptionCtd",
    hintKey: "registerPage.entityOptionCtdHint",
  },
  { type: "projectProgram", labelKey: "registerPage.entityOptionProjectProgram" },
  { type: "vocationalTraining", labelKey: "registerPage.entityOptionVocationalTraining" },
];

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
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const firstEntityRadioRef = useRef<HTMLInputElement>(null);
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

  const [regionName, setRegionName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [subdivisionName, setSubdivisionName] = useState("");
  const [sectorName, setSectorName] = useState("");

  const regionsQuery = useQuery({ queryKey: ["locations", "regions"], queryFn: getRegions });
  const departmentsQuery = useQuery({
    queryKey: ["locations", "departments", regionId],
    queryFn: () => getDepartmentsByRegion(regionId),
    enabled: !!regionId,
  });
  const subdivisionsQuery = useQuery({
    queryKey: ["locations", "subdivisions", departmentId],
    queryFn: () => getSubdivisionsByDepartment(departmentId),
    enabled: !!departmentId,
  });
  const sectorsQuery = useQuery({ queryKey: ["sectors"], queryFn: getSectors });

  // The subdivision list's four distinct states. "No subdivision selected" and
  // "this department has no subdivisions to select" must not collapse into one
  // another: the first has to block, the second must not, or a department the
  // server has no arrondissements for would strand the respondent here. See
  // SubdivisionsStatus for the full reasoning.
  const subdivisionsStatus: SubdivisionsStatus = !departmentId
    ? "idle"
    : subdivisionsQuery.isFetching
      ? "loading"
      : subdivisionsQuery.isError
        ? "error"
        : (subdivisionsQuery.data?.length ?? 0) === 0
          ? "empty"
          : "ready";

  // Immutable snapshot handed to the pure completeness checks. Assembled here
  // rather than inside isSectionComplete so that function never touches a hook.
  const regState: RegState = {
    entityType,
    respondent,
    emailAvailable,
    entityData,
    regionId,
    departmentId,
    subdivisionId,
    subdivisionsStatus,
    area,
    sectorId,
    password,
    confirmPassword,
  };

  const currentSectionComplete = isSectionComplete(step, regState);

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

  // Text for the empty <option> of a select whose list comes from the API, so
  // "still loading", "nothing to choose" and "the request failed" are all
  // distinguishable instead of every one of them reading as an empty dropdown.
  // `gateLabel`, when given, wins: a cascade field whose parent is still
  // unanswered has not requested anything yet.
  function selectStatusLabel(
    query: { isFetching: boolean; isError: boolean; data?: readonly unknown[] },
    gateLabel?: string
  ): string {
    if (gateLabel) return gateLabel;
    if (query.isFetching) return t("registerPage.loadingOptions");
    if (query.isError) return t("registerPage.loadErrorOptions");
    if ((query.data?.length ?? 0) === 0) return t("registerPage.noOptions");
    return t("registerPage.selectPlaceholder");
  }

  // One renderer for all three field kinds in step 3, used by both the
  // per-entity subsections and the unmapped-field fallback below them, which
  // carried a second copy of this JSX.
  function renderEntityField(field: EntityField) {
    const id = `reg-entity-${field.key}`;
    const controlProps = {
      id,
      "aria-required": field.required ? true : undefined,
      value: entityData[field.key] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setEntityField(field.key, e.target.value),
    };

    return (
      <FormRow
        key={field.key}
        htmlFor={id}
        label={field.label}
        required={field.required}
        hint={field.hint}
      >
        <div className="input-row">
          {field.kind === "select" ? (
            <select {...controlProps}>
              <option value="">{t("registerPage.selectPlaceholder")}</option>
              {field.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              {...controlProps}
              type={field.kind === "tel" ? "tel" : field.kind === "number" ? "number" : "text"}
            />
          )}
        </div>
      </FormRow>
    );
  }

  function goNext() {
    setStepError(null);
    const idx = STEPS.indexOf(step);

    if (step === "entityType") {
      if (!entityType) {
        setStepError(t("registerPage.errorEntityTypeRequired"));
        firstEntityRadioRef.current?.focus();
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

    resetScroll(0);
    setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  }

  function goBack() {
    setStepError(null);
    const idx = STEPS.indexOf(step);
    resetScroll(0);
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

  const resolvedRegionName = regionName || regionsQuery.data?.find((r) => r.id === regionId)?.name;
  const resolvedDepartmentName = departmentName || departmentsQuery.data?.find((d) => d.id === departmentId)?.name;
  const resolvedSubdivisionName = subdivisionName || subdivisionsQuery.data?.find((s) => s.id === subdivisionId)?.name;
  const resolvedSectorName = sectorName || sectorsQuery.data?.find((s) => s.id === sectorId)?.name;

  async function submit() {
    if (!entityType || !config) {
      setSubmitError("Type d'entité non sélectionné. Veuillez reprendre l'enregistrement.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Hidden dependent fields must not reach the payload -- see
      // visibleEntityDataForType. Every read below goes through this copy.
      const visibleData = visibleEntityDataForType(entityData, entityType);

      const companyName = resolveCompanyName(visibleData, `${respondent.firstName} ${respondent.lastName}`);
      const address = resolveAddress(visibleData);
      const mainActivity = resolveMainActivity(visibleData);

      const rName = resolvedRegionName || "";
      const dName = resolvedDepartmentName || "";
      const sName = resolvedSubdivisionName || "";

      if (!rName || !dName || !sName) {
        setSubmitError("Région, département et arrondissement sont requis pour l'enregistrement officiel.");
        setSubmitting(false);
        return;
      }

      const payload: RegisterCompanyPayload = {
        email: respondent.email.trim(),
        password,
        firstName: respondent.firstName.trim(),
        lastName: respondent.lastName.trim(),
        role: "COMPANY",
        region: rName,
        department: dName,
        subdivision: sName,
        regionId: regionId || undefined,
        departmentId: departmentId || undefined,
        subdivisionId: subdivisionId || undefined,
        area,
        entityType: entityApiValue(entityType),
        companyName,
        // Omitted entirely for the two types whose config does not declare it
        // (administration, projectProgram) rather than sent as "".
        taxNumber: visibleData.taxNumber,
        mainActivity,
        address,
        parentCompany: visibleData.parentCompany,
        secondaryActivity: visibleData.secondaryActivity,
        cnpsNumber: visibleData.cnpsNumber,
        socialCapital: visibleData.socialCapital ? Number(visibleData.socialCapital) : undefined,
        legalStatus: visibleData.legalStatus,
        cooperativeType: visibleData.cooperativeType,
        yearOfCreation: visibleData.yearOfCreation,
        ctdType: visibleData.ctdType,
        mainMission: visibleData.mainMission,
        registrationNumber: visibleData.registrationNumber,
        branch: visibleData.branch,
        poBox: visibleData.poBox,
        phone: visibleData.phone,
        phone2: visibleData.phone2,
        sigle: visibleData.sigle,
        cfpType: visibleData.cfpType,
        educationSystem: visibleData.educationSystem,
        functionalStatus: visibleData.functionalStatus,
        nonFunctionalReason: visibleData.nonFunctionalReason,
        nonFunctionalReasonOther: visibleData.nonFunctionalReasonOther,
        promoterName: visibleData.promoterName,
        promoterSex: visibleData.promoterSex,
        promoterPhone1: visibleData.promoterPhone1,
        promoterPhone2: visibleData.promoterPhone2,
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
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      setSubmitError(msg);
      if (typeof window !== "undefined") {
        setTimeout(() => {
          const errEl = document.querySelector(".auth-error-box");
          errEl?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Password strength calculations
  const pwScore = passwordStrength(password);
  const pwSegments = password ? (pwScore >= 0.9 ? 4 : pwScore >= 0.65 ? 3 : pwScore >= 0.35 ? 2 : 1) : 0;
  // Which of the four requirements are met, for the tips under the input.
  const pwRules = passwordRuleChecks(password);

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
    <main className="cam-auth-page cam-auth-page--wizard">
      <div className="wrap-wide">
        <AuthHeader />

        <div className="card card--admin">
          <div className="stripe" aria-hidden="true" />
          {/* Rigid header: stays put while the form body scrolls under it */}
          <div className="card-header">
            {/* Desktop and mobile progress rails */}
            <RegistrationProgress currentStep={step} />
          </div>

          {/* The only scroll region in the flow, and the query container the
              field layout measures (see globals.css) */}
          <div className="card-body-scroll">
            {/* STEP 1: ENTITY TYPE — single radio list */}
            {step === "entityType" && (
              <form onSubmit={(e) => { e.preventDefault(); goNext(); }}>
                <StepHeader title={t("registerPage.entityTypeQuestion")} />

                <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
                  <legend
                    style={{
                      position: "absolute",
                      width: "1px",
                      height: "1px",
                      padding: 0,
                      margin: "-1px",
                      overflow: "hidden",
                      clip: "rect(0 0 0 0)",
                      whiteSpace: "nowrap",
                      border: 0,
                    }}
                  >
                    {t("registerPage.entityTypeQuestion")}
                  </legend>

                  {ENTITY_TYPE_OPTIONS.map((option, idx) => (
                    <label
                      key={option.type}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "var(--cam-space-3)",
                        padding: "var(--cam-space-3) 0",
                        borderTop: idx === 0 ? "none" : "1px solid var(--cam-border)",
                        cursor: "pointer",
                        margin: 0,
                      }}
                    >
                      <input
                        ref={idx === 0 ? firstEntityRadioRef : undefined}
                        type="radio"
                        name="entityType"
                        value={option.type}
                        checked={entityType === option.type}
                        onChange={() => {
                          // Changing type strands the previous type's answers in
                          // entityData — drop the ones the new type does not
                          // declare so the respondent's visible answers and the
                          // stored state agree. submit() filters again via
                          // visibleEntityDataForType; this keeps state clean at
                          // the source rather than relying on that alone.
                          setEntityData((prev) => pruneEntityDataForType(prev, option.type));
                          setEntityType(option.type);
                          setStepError(null);
                        }}
                        aria-describedby={option.hintKey ? `reg-entity-hint-${option.type}` : undefined}
                        style={{
                          accentColor: "var(--cam-green)",
                          width: "17px",
                          height: "17px",
                          flex: "0 0 auto",
                          cursor: "pointer",
                          alignSelf: "center",
                        }}
                      />
                      <span style={{ fontSize: "14px", color: "var(--cam-text)", lineHeight: 1.45 }}>
                        {t(option.labelKey)}
                        {option.hintKey && (
                          <span
                            id={`reg-entity-hint-${option.type}`}
                            style={{
                              fontSize: "12px",
                              color: "var(--cam-text-muted)",
                              marginLeft: "var(--cam-space-2)",
                            }}
                          >
                            {t(option.hintKey)}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </fieldset>

                {/* Submit target for Enter; the visible primary action lives in the wizard footer */}
                <button type="submit" style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
              </form>
            )}


            {/* STEP 2: RESPONDENT */}
            {step === "respondent" && (
              <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleFormKeyDown}>
                <StepHeader
                  title={t("registerPage.respondentTitle")}
                  subtitle={t("registerPage.respondentSubtitle")}
                />

                <div className="form-single-column">
                  <FormRow htmlFor="reg-first-name" label={t("registerPage.firstNameLabel")} required>
                    <div className="input-row">
                      <input
                        id="reg-first-name"
                        aria-required={true}
                        value={respondent.firstName}
                        onChange={(e) => setRespondent((r) => ({ ...r, firstName: e.target.value }))}
                        placeholder="Ex: Emmanuel"
                      />
                    </div>
                  </FormRow>

                  <FormRow htmlFor="reg-last-name" label={t("registerPage.lastNameLabel")} required>
                    <div className="input-row">
                      <input
                        id="reg-last-name"
                        aria-required={true}
                        value={respondent.lastName}
                        onChange={(e) => setRespondent((r) => ({ ...r, lastName: e.target.value }))}
                        placeholder="Ex: Biya"
                      />
                    </div>
                  </FormRow>

                  <FormRow htmlFor="reg-function" label={t("registerPage.functionLabel")} required>
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
                  </FormRow>

                  <FormRow
                    htmlFor="reg-email"
                    label={t("registerPage.professionalEmailLabel")}
                    required
                  >
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
                    <div aria-live="polite" aria-atomic="true">
                      {emailAvailable === false && (
                        <span className="field-status is-error">
                          ⚠ {t("registerPage.emailUnavailable")}
                        </span>
                      )}
                      {emailAvailable === true && (
                        <span className="field-status is-ok">
                          ✓ {t("registerPage.emailAvailable")}
                        </span>
                      )}
                    </div>
                  </FormRow>

                  <FormRow htmlFor="reg-phone1" label={t("registerPage.phone1Label")} required>
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
                  </FormRow>

                  <FormRow
                    htmlFor="reg-phone2"
                    label={t("registerPage.phone2Label")}
                    optionalLabel={t("registerPage.optionalMarker")}
                  >
                    <div className="input-row">
                      <input
                        id="reg-phone2"
                        type="tel"
                        value={respondent.phone2}
                        onChange={(e) => setRespondent((r) => ({ ...r, phone2: e.target.value }))}
                        placeholder="6XXXXXXXX / 2XXXXXXXX"
                      />
                    </div>
                  </FormRow>
                </div>
              </form>
            )}

            {/* STEP 3: ENTITY INFORMATION */}
            {step === "entityInfo" && config && entityType && (
              <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleFormKeyDown}>
                <StepHeader
                  title={config.title}
                  subtitle={t("registerPage.entityInfoSubtitle")}
                />

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
                              {secFields.map(renderEntityField)}
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
                              {remainingFields.map(renderEntityField)}
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
                <StepHeader
                  title={t("registerPage.locationTitle")}
                  subtitle={t("registerPage.locationSubtitle")}
                />

                {/* The cascade affordance: the ↳ markers and the gated
                    placeholders say it per field, this says it once up front. */}
                <p className="cascade-note">{t("registerPage.cascadeNote")}</p>

                <div className="form-single-column">
                  <FormRow htmlFor="reg-region" label={t("registerPage.regionLabel")} required>
                    <div className="input-row">
                      <select
                        id="reg-region"
                        aria-required={true}
                        value={regionId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setRegionId(id);
                          setRegionName(regionsQuery.data?.find((r) => r.id === id)?.name || "");
                          setDepartmentId("");
                          setDepartmentName("");
                          setSubdivisionId("");
                          setSubdivisionName("");
                        }}
                      >
                        <option value="">{selectStatusLabel(regionsQuery)}</option>
                        {regionsQuery.data?.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </FormRow>

                  <FormRow
                    htmlFor="reg-department"
                    label={t("registerPage.departmentLabel")}
                    labelPrefix={<span className="cascade-arrow" aria-hidden="true">↳</span>}
                    gated={!regionId}
                    required
                  >
                    <div className="input-row">
                      <select
                        id="reg-department"
                        aria-required={true}
                        value={departmentId}
                        disabled={!regionId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setDepartmentId(id);
                          setDepartmentName(departmentsQuery.data?.find((d) => d.id === id)?.name || "");
                          setSubdivisionId("");
                          setSubdivisionName("");
                        }}
                      >
                        <option value="">
                          {selectStatusLabel(
                            departmentsQuery,
                            regionId ? undefined : t("registerPage.selectRegionFirst")
                          )}
                        </option>
                        {departmentsQuery.data?.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </FormRow>

                  <FormRow
                    htmlFor="reg-subdivision"
                    label={t("registerPage.subdivisionLabel")}
                    labelPrefix={<span className="cascade-arrow" aria-hidden="true">↳</span>}
                    gated={!departmentId}
                    required
                  >
                    <div className="input-row">
                      <select
                        id="reg-subdivision"
                        aria-required={true}
                        value={subdivisionId}
                        disabled={!departmentId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSubdivisionId(id);
                          setSubdivisionName(subdivisionsQuery.data?.find((s) => s.id === id)?.name || "");
                        }}
                      >
                        <option value="">
                          {selectStatusLabel(
                            subdivisionsQuery,
                            departmentId ? undefined : t("registerPage.selectDepartmentFirst")
                          )}
                        </option>
                        {subdivisionsQuery.data?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </FormRow>

                  <FormRow htmlFor="reg-area" label={t("registerPage.areaLabel")} required>
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
                  </FormRow>

                  <FormRow
                    htmlFor="reg-sector"
                    label={t("registerPage.sectorLabel")}
                    optionalLabel={t("registerPage.optionalMarker")}
                  >
                    <div className="input-row">
                      <select
                        id="reg-sector"
                        value={sectorId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSectorId(id);
                          setSectorName(sectorsQuery.data?.find((s) => s.id === id)?.name || "");
                        }}
                      >
                        <option value="">{selectStatusLabel(sectorsQuery)}</option>
                        {sectorsQuery.data?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </FormRow>
                </div>
              </form>
            )}

            {/* STEP 5: SECURITY */}
            {step === "security" && (
              <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleFormKeyDown}>
                <StepHeader
                  title={t("registerPage.securityTitle")}
                  subtitle={t("registerPage.securitySubtitle")}
                />

                <div className="form-single-column">
                  <FormRow htmlFor="reg-password" label={t("registerPage.passwordLabel")} required>
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

                    {/* Segmented strength meter. Sits in the input column
                        because it belongs to the value, not to the label. */}
                    {password && (
                      <div className="password-strength-block">
                        <div className="password-strength-meter">
                          {[1, 2, 3, 4].map((seg) => (
                            <div
                              key={seg}
                              className={`password-strength-seg ${seg <= pwSegments ? `active-${pwSegments}` : ""}`}
                            />
                          ))}
                        </div>
                        <span className="password-strength-label">
                          {t("registerPage.passwordStrengthPrefix")} :{" "}
                          <strong>{passwordStrengthLabel(pwScore)}</strong>
                        </span>
                      </div>
                    )}

                    {/* The four requirements the score is built from, each
                        ticking off as it is met, instead of one static
                        sentence listing them all. */}
                    <div className="password-rules">
                      <span className="password-rules-title">
                        {t("registerPage.passwordRulesTitle")}
                      </span>
                      <ul className="password-rules-list">
                        {PASSWORD_RULE_IDS.map((id) => {
                          const met = pwRules[id];
                          return (
                            <li
                              key={id}
                              className={`password-rule ${met ? "is-met" : ""}`}
                            >
                              <span className="password-rule-mark" aria-hidden="true">
                                {met ? "✓" : "•"}
                              </span>
                              {t(`registerPage.passwordRule${id.charAt(0).toUpperCase()}${id.slice(1)}`)}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </FormRow>

                  <FormRow
                    htmlFor="reg-confirm-password"
                    label={t("registerPage.confirmPasswordLabel")}
                    required
                  >
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
                    <div aria-live="polite" aria-atomic="true">
                      {confirmPassword && (
                        <span
                          className={`field-status ${password === confirmPassword ? "is-ok" : "is-error"}`}
                        >
                          {password === confirmPassword
                            ? `✓ ${t("registerPage.passwordsMatch")}`
                            : `⚠ ${t("registerPage.passwordsDoNotMatch")}`}
                        </span>
                      )}
                    </div>
                  </FormRow>
                </div>
              </form>
            )}

            {/* STEP 6: REVIEW */}
            {step === "review" && config && entityType && (
              <div>
                <StepHeader
                  title={t("registerPage.reviewTitle")}
                  subtitle={t("registerPage.reviewSubtitle")}
                />

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
                  regionName={resolvedRegionName}
                  departmentName={resolvedDepartmentName}
                  subdivisionName={resolvedSubdivisionName}
                  area={area}
                  sectorName={resolvedSectorName}
                  onEdit={(targetStep) => setStep(targetStep)}
                />
              </div>
            )}
          </div>

          <div className="card-footer">
            {/* Step-validation errors only. submitError has its own banner in
                the review block; rendering it here as well printed every
                submission failure twice. */}
            {stepError && (
              <div
                className="auth-error-box"
                role="alert"
                style={{ marginBottom: "var(--cam-space-3)", whiteSpace: "pre-line" }}
              >
                {stepError}
              </div>
            )}

            {/* Wizard action buttons. The footer supplies the rule and the
                padding that this row used to carry itself. */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {/* Step 1 has no previous step: omit the control rather than showing it disabled */}
              {step === "entityType" ? (
                <span />
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={goBack}
                  disabled={submitting}
                >
                  ← {t("registerPage.backButton")}
                </button>
              )}

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
                  // Enabled exactly while the current section is complete, and
                  // disabled again the moment it stops being. isSectionComplete
                  // reads state only, so this never surfaces an error message
                  // for a field the respondent has not finished typing.
                  disabled={!currentSectionComplete}
                >
                  {step === "entityType"
                    ? t("registerPage.continueButton")
                    : `${t("registerPage.nextButton")} →`}
                </button>
              )}
            </div>

            <span className="create-account" style={{ display: "block", marginTop: "var(--cam-space-3)" }}>
              <Link href="/login">
                {step === "entityType"
                  ? t("registerPage.alreadyRegisteredSignIn")
                  : t("registerPage.backToSignInLink")}
              </Link>
            </span>
          </div>
        </div>
      </div>

      {/* Shell strip, not document flow: under the card's overflow: hidden a
          trailing element inside .wrap-wide is clipped or pushed off-screen. */}
      <div className="wizard-legal-line">
        {t("loginPage.needHelpText")}{" "}
        <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
          {t("loginPage.whatsappLink")}
        </a>
      </div>
    </main>
  );
}
