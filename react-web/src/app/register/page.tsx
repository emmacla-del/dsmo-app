"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  advancesImmediately,
  isSectionComplete,
  type RegState,
  type SubdivisionsStatus,
} from "@/lib/register-completeness";
import {
  entityFieldGroups,
  lastEntityFieldKey,
} from "@/lib/register-entity-sections";
import { firstIncompleteWithin } from "@/lib/register-rail";
import {
  REGISTER_DRAFT_SAVE_DEBOUNCE_MS,
  clearStoredDraft,
  draftHasData,
  loadStoredDraft,
  restoredReached,
  saveStoredDraftJson,
  toDraft,
} from "@/lib/register-draft";
import { AREA_OPTIONS, RESPONDENT_FUNCTION_OPTIONS } from "@/lib/register-options";
import {
  PASSWORD_RULE_IDS,
  passwordRuleChecks,
  passwordStrength,
  passwordStrengthLabel,
  validatePassword,
} from "@/lib/password-strength";
import { sectionSummary, summaryRows, type SummaryState } from "@/lib/register-summary";
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
const LAST_INDEX = STEPS.length - 1;

// How long a reset notice stays on screen. Long enough to read a sentence,
// short enough not to sit over the form the respondent went back to.
const SNACKBAR_MS = 6000;

// The last field of each section that has optional fields: changing it is
// what tells the wizard the respondent is done with the section. Section 3's
// own last field is data-driven (see lastEntityFieldKey).
const LAST_RESPONDENT_FIELD: keyof RespondentState = "phone2";

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

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  // `reached` is the highest revealed section index: everything past it is
  // locked on the rail. `current` is the one section the frame shows. Both
  // are needed, and neither derives from the other -- the rail lets the
  // respondent go back to an answered section without un-revealing the ones
  // after it.
  const [reached, setReached] = useState(0);
  const [current, setCurrent] = useState(0);
  const [certified, setCertified] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [pendingEntityType, setPendingEntityType] = useState<EntityType | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  // Set once the respondent has changed the LAST field of a section that has
  // optional fields -- the signal that they are done with it and the next one
  // may open. Re-evaluated on every field change rather than latched, so
  // going back to an earlier field in the same section disarms it again.
  const [advanceArmed, setAdvanceArmed] = useState(false);
  // The only scroll container on the page. A section change puts it back to
  // the top; nothing else scrolls.
  const frameScrollRef = useRef<HTMLDivElement>(null);
  // Set when a change must reach storage now rather than after the debounce.
  const forceSaveRef = useRef(false);
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

  // ── Advance arming ─────────────────────────────────────────────────────
  // A section with optional fields must not open the next one the instant its
  // required fields are satisfied, or the optional ones (phone 2, CNPS) would
  // be pulled away mid-entry. What says "I am done here" instead is a change
  // to the section's LAST field. Every setter below reports which field it
  // changed, so the flag is recomputed -- never latched: going back up to an
  // earlier field in the same section disarms it again.
  function armFromField(isLast: boolean) {
    setAdvanceArmed(isLast);
  }

  function setEntityField(key: string, value: string) {
    const next = { ...entityData, [key]: value };
    armFromField(entityType ? lastEntityFieldKey(entityType, next) === key : false);
    setEntityData(next);
  }

  function setRespondentField(key: keyof RespondentState, value: string) {
    armFromField(key === LAST_RESPONDENT_FIELD);
    setRespondent((r) => ({ ...r, [key]: value }));
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

  // The one validation pass, run when the respondent submits.
  //
  // It replaces the per-step switch the old Suivant button ran. Every message
  // is the one that step already produced, so the wording the respondent sees
  // on a failure has not changed -- only when they see it. isSectionComplete
  // decides when a section *opens*; this decides whether the form may be
  // *sent*, which is why the two are separate and why this one may surface
  // errors.
  function firstFailure(): { index: number; message: string; focusId?: string } | null {
    if (!entityType) {
      return {
        index: STEPS.indexOf("entityType"),
        message: t("registerPage.errorEntityTypeRequired"),
      };
    }

    const respondentIndex = STEPS.indexOf("respondent");
    const respondentFields: [string, string][] = [
      ["reg-first-name", respondent.firstName],
      ["reg-last-name", respondent.lastName],
      ["reg-function", respondent.function],
      ["reg-email", respondent.email],
      ["reg-phone1", respondent.phone1],
    ];
    for (const [focusId, value] of respondentFields) {
      if (!value.trim()) {
        return { index: respondentIndex, message: t("registerPage.errorRequiredFields"), focusId };
      }
    }
    if (emailAvailable === false) {
      return { index: respondentIndex, message: t("registerPage.errorEmailInUse"), focusId: "reg-email" };
    }

    if (config) {
      for (const field of config.fields) {
        if (field.required && isFieldVisible(field) && !entityData[field.key]?.trim()) {
          return {
            index: STEPS.indexOf("entityInfo"),
            message: t("registerPage.errorRequiredFields"),
            focusId: `reg-entity-${field.key}`,
          };
        }
      }
    }

    const locationIndex = STEPS.indexOf("location");
    if (!regionId) {
      return { index: locationIndex, message: t("registerPage.errorSelectRegion"), focusId: "reg-region" };
    }
    if (!departmentId) {
      return { index: locationIndex, message: t("registerPage.errorSelectDepartment"), focusId: "reg-department" };
    }
    // An arrondissement is still required, except where the department has
    // none to offer -- see SubdivisionsStatus.
    if (!subdivisionId && subdivisionsStatus !== "empty") {
      return { index: locationIndex, message: t("registerPage.errorSelectSubdivision"), focusId: "reg-subdivision" };
    }
    if (!area) {
      return { index: locationIndex, message: t("registerPage.errorSelectArea"), focusId: "reg-area" };
    }

    const securityIndex = STEPS.indexOf("security");
    const pwError = validatePassword(password);
    if (pwError) {
      return { index: securityIndex, message: pwError, focusId: "reg-password" };
    }
    if (password !== confirmPassword) {
      return {
        index: securityIndex,
        message: t("registerPage.errorPasswordMismatch"),
        focusId: "reg-confirm-password",
      };
    }

    return null;
  }

  async function handleSubmitPress() {
    setSubmitError(null);
    const failure = firstFailure();
    if (!failure) {
      await submit();
      return;
    }

    setSubmitError(failure.message);
    // The failing section may not be revealed yet (a restored draft can reach
    // review with an earlier gap), so open it before showing it.
    setReached((prev) => Math.max(prev, failure.index));
    setCurrent(failure.index);
    setAdvanceArmed(false);
    requestAnimationFrame(() => {
      // The frame swaps to the failing section; put it back to the top so the
      // error banner above the section is the first thing on screen, then let
      // focusing the control scroll the frame the rest of the way if the
      // field sits below the fold (section 3 runs to thirteen rows).
      scrollFrameTop();
      const control = failure.focusId ? document.getElementById(failure.focusId) : null;
      if (control) {
        control.focus();
      } else {
        firstEntityRadioRef.current?.focus();
      }
    });
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

    // Renamed from currentIndex: that name now belongs to the revealed-section
    // cursor below, and shadowing it here read as a bug.
    const fieldIndex = formFields.indexOf(target);
    if (fieldIndex === -1) return;

    e.preventDefault();

    if (e.shiftKey) {
      if (fieldIndex > 0) {
        formFields[fieldIndex - 1].focus();
      }
    } else if (fieldIndex < formFields.length - 1) {
      formFields[fieldIndex + 1].focus();
    }
    // On the last field, Enter does nothing. There is no next step to
    // advance to, and the single submit button is deliberately reached
    // on purpose rather than by pressing Enter in a text field.
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

  // ── Progressive disclosure ─────────────────────────────────────────────
  const completed = STEPS.map((id) => isSectionComplete(id, regState));

  const hasEnteredData = draftHasData(regState);

  // regState plus the administrative names: the snapshot the review card and
  // the rail's per-section summaries are both built from.
  const summaryState: SummaryState = {
    ...regState,
    regionName: resolvedRegionName || "",
    departmentName: resolvedDepartmentName || "",
    subdivisionName: resolvedSubdivisionName || "",
    sectorName: resolvedSectorName || "",
  };

  // One line per section for the rail's tooltips, from the same rows the
  // review card prints. Derived at render time, never cached, so an edit
  // elsewhere cannot leave a stale line on a circle.
  const railSummaries = STEPS.map((id) =>
    sectionSummary(summaryRows(id, summaryState, (k) => t(k)))
  );

  // ── Navigation ─────────────────────────────────────────────────────────
  // The frame is the only scroll container, so "go to a section" is a scroll
  // of that one element rather than of the document. Instant, not smooth: the
  // frame's content is swapped at the same moment, so there is nothing to
  // animate past.
  function scrollFrameTop() {
    frameScrollRef.current?.scrollTo({ top: 0 });
  }

  // Called by the rail. A locked section is not reachable -- the rail renders
  // it as a disabled button, and this is the second line of that defence.
  function goToSection(index: number) {
    if (index < 0 || index > reached) return;
    setAdvanceArmed(false);
    setCurrent(index);
    requestAnimationFrame(scrollFrameTop);
  }

  // Move forward from `index`, revealing the next section if it was locked.
  function advanceFrom(index: number) {
    const next = Math.min(index + 1, LAST_INDEX);
    if (next === index) return;
    setAdvanceArmed(false);
    setReached((prev) => Math.max(prev, next));
    setCurrent(next);
    requestAnimationFrame(scrollFrameTop);
  }

  // ── Entity-type change ─────────────────────────────────────────────────
  const entityInfoAnswered = Object.values(entityData).some((v) => v.trim());

  function requestEntityType(next: EntityType) {
    if (next === entityType) return;
    // Nothing to lose: switch without asking.
    if (!entityInfoAnswered) {
      applyEntityType(next, false);
      return;
    }
    setPendingEntityType(next);
  }

  function applyEntityType(next: EntityType, clearEntityData: boolean) {
    if (clearEntityData) {
      setEntityData({});
      // Only section 3 is reset. The respondent's own details, the location
      // and the password do not depend on the entity type, so they -- and
      // the sections holding them -- stay exactly as they were; what changes
      // is where the respondent now is, which is the section that just
      // emptied.
      const infoIndex = STEPS.indexOf("entityInfo");
      setReached((prev) => Math.max(prev, infoIndex));
      setCurrent(infoIndex);
      setAdvanceArmed(false);
      requestAnimationFrame(scrollFrameTop);
      setSnackbar(t("registerPage.entityChangeSnackbar", { step: t("registerPage.stepEntityInfo") }));
      forceSaveRef.current = true;
    } else {
      // Changing type strands the previous type's answers in entityData —
      // drop the ones the new type does not declare so the respondent's
      // visible answers and the stored state agree. submit() filters again
      // via visibleEntityDataForType; this keeps state clean at the source
      // rather than relying on that alone.
      setEntityData((prev) => pruneEntityDataForType(prev, next));
    }
    setEntityType(next);
    setSubmitError(null);
  }

  // ── Auto-advance ───────────────────────────────────────────────────────
  // The frame moves on by itself only at the frontier: when the section being
  // shown is also the furthest revealed one and it is complete. Going back to
  // an answered section must never shove the respondent forward again, which
  // is what `current === reached` guarantees.
  //
  // A section with no optional fields (the type list, the password) moves on
  // the instant it is complete. One with optional fields waits for the
  // respondent to say so, by changing its last field or following the
  // "continue" link -- see armFromField.
  const frontierComplete = current === reached && completed[reached];
  const frontierImmediate = advancesImmediately(STEPS[reached], entityType);

  useEffect(() => {
    if (!frontierComplete || reached >= LAST_INDEX) return;
    if (!frontierImmediate && !advanceArmed) return;
    const next = reached + 1;
    // Advancing IS a state change derived from the answers, and no event
    // carries it: completeness is recomputed from state after every keystroke
    // rather than asserted by a Suivant button, so the moment a section
    // becomes complete is a render, not a click. The three writes settle in
    // one pass -- the guards above are false on the next run.
    /* eslint-disable react-hooks/set-state-in-effect -- see above */
    setAdvanceArmed(false);
    setReached(next);
    setCurrent(next);
    /* eslint-enable react-hooks/set-state-in-effect */
    requestAnimationFrame(() => frameScrollRef.current?.scrollTo({ top: 0 }));
  }, [frontierComplete, frontierImmediate, advanceArmed, reached]);

  // Whether the section in hand offers the "continue" link. A frontier
  // section that advances by itself never shows one -- it would be gone
  // before it could be read -- but a section the respondent has navigated
  // BACK to shows it, so the rail is not the only way forward.
  const showContinueLink =
    current < LAST_INDEX &&
    completed[current] &&
    !(current === reached && advancesImmediately(STEPS[current], entityType));

  // ── Draft ──────────────────────────────────────────────────────────────
  const draftLoadedRef = useRef(false);

  // Restores persisted answers after mount. This cannot be a lazy useState
  // initializer: sessionStorage does not exist during the server render, so
  // seeding state from it would make the server and client markup disagree
  // and break hydration. The ref guard makes it run exactly once, so the
  // cascading-render the rule warns about happens at most one time, on a
  // returning respondent.
  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    const draft = loadStoredDraft();
    if (!draft) return;

    /* eslint-disable react-hooks/set-state-in-effect -- see above */
    setEntityType(draft.entityType);
    setRespondent(draft.respondent);
    setEntityData(draft.entityData);
    setRegionId(draft.regionId);
    setRegionName(draft.regionName);
    setDepartmentId(draft.departmentId);
    setDepartmentName(draft.departmentName);
    setSubdivisionId(draft.subdivisionId);
    setSubdivisionName(draft.subdivisionName);
    setArea(draft.area);
    setSectorId(draft.sectorId);
    setSectorName(draft.sectorName);

    // Recomputed from the restored answers rather than taken from the draft
    // alone: the password is never stored, so security comes back incomplete
    // whatever position was saved.
    const restoredState: RegState = {
      entityType: draft.entityType,
      respondent: draft.respondent,
      emailAvailable: null,
      entityData: draft.entityData,
      regionId: draft.regionId,
      departmentId: draft.departmentId,
      subdivisionId: draft.subdivisionId,
      subdivisionsStatus: "idle",
      area: draft.area,
      sectorId: draft.sectorId,
      password: "",
      confirmPassword: "",
    };
    const restored = restoredReached(draft.step, restoredState);
    setReached(restored);
    // Land on the first thing still missing rather than on the furthest
    // section reached: with the password gone, that is almost always the
    // security section, which is exactly where the work resumes.
    setCurrent(
      firstIncompleteWithin(STEPS, restored, (step) =>
        isSectionComplete(step, restoredState)
      )
    );
    setDraftRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Serialized once per render and used both as the effect's dependency and
  // as what gets written: an unrelated re-render produces the same string and
  // so does not reschedule the save, and nothing has to hold the draft object
  // in a ref across renders.
  const draftJson = JSON.stringify(
    toDraft(regState, reached, {
      regionName: resolvedRegionName || "",
      departmentName: resolvedDepartmentName || "",
      subdivisionName: resolvedSubdivisionName || "",
      sectorName: resolvedSectorName || "",
    })
  );

  useEffect(() => {
    if (!draftLoadedRef.current) return;
    if (result) return;
    if (!hasEnteredData) return;
    // A destructive change (an entity-type switch that cleared answers) is
    // written straight away: if the tab closed during the debounce the draft
    // would otherwise still describe the old type's data.
    const immediate = forceSaveRef.current;
    forceSaveRef.current = false;
    const timer = setTimeout(
      () => saveStoredDraftJson(draftJson),
      immediate ? 0 : REGISTER_DRAFT_SAVE_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [draftJson, hasEnteredData, result]);

  // The draft's only job is to survive an interruption before submission.
  useEffect(() => {
    if (result) clearStoredDraft();
  }, [result]);

  useEffect(() => {
    if (!snackbar) return;
    const timer = setTimeout(() => setSnackbar(null), SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [snackbar]);

  // Browser-level leave guard. The wording is the browser's own -- a page
  // cannot supply it -- so the in-page dialog at the bottom of this file
  // covers navigation that happens inside the app, where it can.
  useEffect(() => {
    if (!hasEnteredData || result) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasEnteredData, result]);

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

  // One section body per step id. Sections are rendered by the column below
  // for every index up to `reached` and are never unmounted once revealed, so
  // each keeps its own state and its in-flight requests while scrolled away.
  function renderSection(id: RegistrationStepId) {
    switch (id) {
      case "entityType":
        return (
          <>
            <StepHeader
              titleId="reg-section-title-entityType"
              title={t("registerPage.entityTypeQuestion")}
            />

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
                    onChange={() => requestEntityType(option.type)}
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
          </>
        );

      case "respondent":
        return (
          <>
            <StepHeader
              titleId="reg-section-title-respondent"
              title={t("registerPage.respondentTitle")}
              subtitle={t("registerPage.respondentSubtitle")}
            />

            <div className="form-single-column">
              <FormRow htmlFor="reg-first-name" label={t("registerPage.firstNameLabel")} required>
                <div className="input-row">
                  {/* type="text" is not a default to be left implicit: the
                      wizard's control rule selects input[type="text"], so an
                      input with no type attribute at all matched nothing and
                      rendered borderless at the browser's own ~33px. The CSS
                      now carries an input:not([type]) safety net too, but the
                      attribute is the fix. */}
                  <input
                    id="reg-first-name"
                    type="text"
                    aria-required={true}
                    value={respondent.firstName}
                    onChange={(e) => setRespondentField("firstName", e.target.value)}
                    placeholder="Ex: Emmanuel"
                  />
                </div>
              </FormRow>

              <FormRow htmlFor="reg-last-name" label={t("registerPage.lastNameLabel")} required>
                <div className="input-row">
                  <input
                    id="reg-last-name"
                    type="text"
                    aria-required={true}
                    value={respondent.lastName}
                    onChange={(e) => setRespondentField("lastName", e.target.value)}
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
                    onChange={(e) => setRespondentField("function", e.target.value)}
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
                    onChange={(e) => setRespondentField("email", e.target.value)}
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
                    onChange={(e) => setRespondentField("phone1", e.target.value)}
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
                    onChange={(e) => setRespondentField("phone2", e.target.value)}
                    placeholder="6XXXXXXXX / 2XXXXXXXX"
                  />
                </div>
              </FormRow>
            </div>
          </>
        );

      case "entityInfo":
        if (!config || !entityType) return null;
        return (
          <>
            <StepHeader
              titleId="reg-section-title-entityInfo"
              title={config.title}
              subtitle={t("registerPage.entityInfoSubtitle")}
            />

            {/* The grouping and the field order both come from
                entityFieldGroups, which is also what lastEntityFieldKey
                reads: the field the wizard treats as "the last one in this
                section" is by construction the last one rendered here. */}
            {entityFieldGroups(entityType, entityData).map((group) => (
              <div key={group.title}>
                <div className="admin-section-header">{group.title}</div>
                <div className="form-single-column">
                  {group.fields.map(renderEntityField)}
                </div>
              </div>
            ))}
          </>
        );

      case "location":
        return (
          <>
            <StepHeader
              titleId="reg-section-title-location"
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
                      armFromField(false);
                      // A new region invalidates the two fields below it.
                      // That already happened silently; now it says so,
                      // because a respondent who had answered them would
                      // otherwise find them blank with no explanation.
                      if (departmentId || subdivisionId) {
                        setSnackbar(t("registerPage.locationResetSnackbar"));
                      }
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
                      armFromField(false);
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
                // An arrondissement cannot be required of a department the
                // server has none for; the row says so instead of looking
                // like an empty dropdown the respondent failed to use.
                hint={subdivisionsStatus === "empty" ? t("registerPage.noSubdivisionHint") : undefined}
              >
                <div className="input-row">
                  <select
                    id="reg-subdivision"
                    aria-required={true}
                    value={subdivisionId}
                    disabled={!departmentId || subdivisionsStatus === "empty"}
                    onChange={(e) => {
                      const id = e.target.value;
                      armFromField(false);
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
                    onChange={(e) => {
                      armFromField(false);
                      setArea(e.target.value);
                    }}
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
                      // The activity sector is the section's last field, and
                      // the only optional one: changing it says the
                      // respondent is done with the location.
                      armFromField(true);
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
          </>
        );

      case "security":
        return (
          <>
            <StepHeader
              titleId="reg-section-title-security"
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
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
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
                    {PASSWORD_RULE_IDS.map((ruleId) => {
                      const met = pwRules[ruleId];
                      return (
                        <li key={ruleId} className={`password-rule ${met ? "is-met" : ""}`}>
                          <span className="password-rule-mark" aria-hidden="true">
                            {met ? "✓" : "•"}
                          </span>
                          {t(`registerPage.passwordRule${ruleId.charAt(0).toUpperCase()}${ruleId.slice(1)}`)}
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
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                    }}
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
          </>
        );

      case "review":
        if (!config || !entityType) return null;
        return (
          <>
            <StepHeader
              titleId="reg-section-title-review"
              title={t("registerPage.reviewTitle")}
              subtitle={t("registerPage.reviewSubtitle")}
            />

            {/* The error banner is NOT rendered here: a failure sends the
                respondent to the section that failed, and an error message
                left behind in the review would go with it. It lives at the
                top of the frame instead -- see the main return below. */}

            <RegistrationReview
              state={summaryState}
              onEdit={(targetStep) => goToSection(STEPS.indexOf(targetStep))}
            />

            {/* The flow's single primary action, gated on an explicit
                certification rather than on having scrolled this far. */}
            <label className="certify-row">
              <input
                type="checkbox"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
              />
              <span>{t("registerPage.certifyLabel")}</span>
            </label>

            <div className="submit-row">
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto", minWidth: "160px", padding: "10px 22px" }}
                onClick={handleSubmitPress}
                disabled={!certified || submitting}
              >
                {submitting
                  ? t("registerPage.submittingLabel")
                  : t("registerPage.submitButton")}
              </button>
            </div>
          </>
        );
    }
  }

  // One screen, one frame, one section, one scrollbar.
  //
  // The page itself does not scroll: it is a 100dvh flex column of the
  // national stripe, the header that carries the rail, and a body that gives
  // every remaining pixel to a single bordered frame. The frame's inner
  // region is the only scroll container on the route, so a long section
  // scrolls inside the frame while the rail -- the navigation -- stays put
  // without needing position: sticky to do it.
  //
  // Every revealed section stays MOUNTED and is merely hidden: a section the
  // respondent has left keeps its state and its in-flight requests, and the
  // email-availability check running when they moved on still lands.
  return (
    <main className="cam-auth-page cam-auth-page--wizard">
      <div className="flow-stripe" aria-hidden="true" />

      {/* Sticky by structure, not by position: this is a fixed-size row of
          the page's flex column, so nothing can scroll underneath it. */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <AuthHeader />
          <RegistrationProgress
            currentIndex={current}
            reached={reached}
            completed={completed}
            summaries={railSummaries}
            onSelect={goToSection}
          />
        </div>
      </header>

      <div className="flow-body">
        {/* The frame: the one bordered element on the page, and the query
            container the side-by-side field layout measures. */}
        <div className="flow-frame">
          <div className="flow-frame-scroll" ref={frameScrollRef}>
            {draftRestored && (
              <div className="draft-restored-notice" role="status">
                {t("registerPage.draftRestoredNotice")}
              </div>
            )}

            {/* Above the section rather than inside the review: a failure
                sends the respondent to the section that failed, and the
                message has to travel with them. */}
            {submitError && (
              <div className="auth-error-box" role="alert">
                {submitError}
              </div>
            )}

            <form
              className="cam-form-flow"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitPress();
              }}
              onKeyDown={handleFormKeyDown}
            >
              {STEPS.slice(0, reached + 1).map((id, idx) => (
                <section
                  key={id}
                  className="wizard-section"
                  hidden={idx !== current}
                  aria-labelledby={`reg-section-title-${id}`}
                >
                  {renderSection(id)}

                  {/* A text link, not a button bar: moving on is the normal
                      consequence of finishing a section, and the sections
                      that cannot move on by themselves are exactly the ones
                      with an optional field still worth offering. */}
                  {idx === current && showContinueLink && (
                    <p className="flow-continue">
                      <button
                        type="button"
                        className="flow-continue-link"
                        onClick={() => advanceFrom(current)}
                      >
                        {t("registerPage.continueToNextStep")}
                        <span aria-hidden="true"> →</span>
                      </button>
                    </p>
                  )}
                </section>
              ))}
            </form>
          </div>
        </div>
      </div>

      <div className="flow-footer">
        <a
          href="/login"
          onClick={(e) => {
            // An in-app navigation away from a part-filled form is
            // confirmable; see the dialog below.
            if (!hasEnteredData) return;
            e.preventDefault();
            setLeaveTo("/login");
          }}
        >
          {reached === 0
            ? t("registerPage.alreadyRegisteredSignIn")
            : t("registerPage.backToSignInLink")}
        </a>
        <span className="flow-footer-sep" aria-hidden="true">·</span>
        {t("loginPage.needHelpText")}{" "}
        <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
          {t("loginPage.whatsappLink")}
        </a>
      </div>

      {/* Entity-type change confirmation. Only raised when there is
          something to lose: with step 3 still empty the type switches
          silently. */}
      {pendingEntityType && (
        <div
          className="leave-dialog-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingEntityType(null);
          }}
        >
          <div
            className="leave-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reg-entity-change-title"
          >
            <h2 id="reg-entity-change-title">{t("registerPage.entityChangeTitle")}</h2>
            <p>{t("registerPage.entityChangeBody")}</p>
            <div className="leave-dialog-actions">
              <button
                type="button"
                className="btn-secondary"
                // Cancel keeps the old type and its data: the radio is
                // controlled by `entityType`, which nothing has changed yet.
                onClick={() => setPendingEntityType(null)}
              >
                {t("registerPage.entityChangeCancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto", padding: "10px 22px" }}
                onClick={() => {
                  const next = pendingEntityType;
                  setPendingEntityType(null);
                  if (next) applyEntityType(next, true);
                }}
              >
                {t("registerPage.entityChangeConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset notices. Announced, because the change they report happened
          somewhere the respondent may not be looking. */}
      <div className="wizard-snackbar-region" role="status" aria-live="polite">
        {snackbar && <div className="wizard-snackbar">{snackbar}</div>}
      </div>

      {/* Leave confirmation. Only reachable with data entered, and only for
          navigation that happens inside the app -- a real browser unload
          cannot carry custom wording, so beforeunload shows the browser's own
          dialog instead (see the effect above). */}
      {leaveTo && (
        <div
          className="leave-dialog-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLeaveTo(null);
          }}
        >
          <div
            className="leave-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reg-leave-title"
          >
            <h2 id="reg-leave-title">{t("registerPage.leaveTitle")}</h2>
            <p>{t("registerPage.leaveBody")}</p>
            <div className="leave-dialog-actions">
              <button type="button" className="btn-secondary" onClick={() => setLeaveTo(null)}>
                {t("registerPage.leaveCancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto", padding: "10px 22px" }}
                onClick={() => {
                  const href = leaveTo;
                  setLeaveTo(null);
                  if (href) router.push(href);
                }}
              >
                {t("registerPage.leaveConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
