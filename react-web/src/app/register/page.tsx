"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
  REGISTRATION_STEPS,
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
import { asUiLocale, localized } from "@/lib/register-i18n";
import { firstIncompleteWithin } from "@/lib/register-rail";
import {
  lastFieldId,
  missingFieldsToReport,
  missingRequiredFields,
  type NameResolvers,
} from "@/lib/register-required";
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
import { saveLoginIdentifier } from "@/lib/login-handoff";
import { isValidCameroonPhone, normalizeCameroonPhone } from "@/lib/cameroon-phone";
import {
  PASSWORD_RULE_IDS,
  passwordRuleChecks,
  passwordStrength,
  passwordStrengthLabel,
  validatePassword,
} from "@/lib/password-strength";
import { sectionSummary, summaryRows, type SummaryState } from "@/lib/register-summary";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { FormRow, type FieldSize } from "@/components/auth/FormRow";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";
import { RegistrationProgress } from "@/components/auth/RegistrationProgress";
import { RegistrationReview } from "@/components/auth/RegistrationReview";
import { RegistrationStepList } from "@/components/auth/RegistrationStepList";
import { WizardRail } from "@/components/wizard/WizardRail";
import { StepHeader } from "@/components/auth/StepHeader";
import { OfficialLogo } from "@/components/landing/OfficialLogo";

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

// The pinned "Il reste n champs obligatoires" notice, which the first missing
// control points at with aria-describedby.
const MISSING_NOTICE_ID = "reg-missing-notice";

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

// A control the respondent types or picks a value in -- as opposed to the
// continue link, the eye toggle or the rail. Focus moving from a section's
// last field to one of these is still work inside the section.
function isFormField(el: Element): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

export default function RegisterPage() {
  const t = useTranslations();
  // The language the questionnaire's own strings are read in -- field labels,
  // hints, option answers and the entity type's name. They are {fr, en} data
  // in register-constants.ts / register-options.ts rather than catalogue
  // keys (see register-i18n.ts), so they need the locale, not just `t`.
  // Source of truth: the NEXT_LOCALE cookie, read server-side in
  // src/i18n/request.ts and handed down by NextIntlClientProvider.
  const locale = asUiLocale(useLocale());
  const router = useRouter();
  // `reached` is the highest revealed section index: everything past it is
  // locked on the rail. `current` is the one section the frame shows. Both
  // are needed, and neither derives from the other -- the rail lets the
  // respondent go back to an answered section without un-revealing the ones
  // after it.
  const [reached, setReached] = useState(0);
  const [current, setCurrent] = useState(0);
  const [certified, setCertified] = useState(false);
  // Set when Soumettre is pressed with the box unticked. The error it shows
  // is re-derived from `certified`, so ticking the box clears it.
  const [certifyFlagged, setCertifyFlagged] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // Item 6: the rail only becomes a navigation once something on it is
  // clickable, so the line explaining that appears when the first circle
  // turns green and never again after the respondent has used it.
  const [railHintDismissed, setRailHintDismissed] = useState(false);
  // Item 11: the DOM ids of the fields a trigger has flagged. Only a FLAG is
  // stored, never an error message -- whether a flagged field still shows one
  // is re-derived from its value on every render, so an error clears the
  // moment the field is filled without anything having to remember to clear
  // it. Nothing is flagged until a trigger fires, which is what keeps errors
  // off fields the respondent has not reached yet.
  const [flaggedIds, setFlaggedIds] = useState<readonly string[]>([]);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [pendingEntityType, setPendingEntityType] = useState<EntityType | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  // Set once the respondent has changed the LAST field of a section that has
  // optional fields -- the signal that they are done with it and the next one
  // may open. Re-evaluated on every field change rather than latched, so
  // going back to an earlier field in the same section disarms it again.
  const [advanceArmed, setAdvanceArmed] = useState(false);
  // Focus on a section change. The section being left is `hidden`, so
  // whatever had focus inside it drops to <body> and a keyboard or
  // screen-reader user is nowhere. Every navigation that changes the section
  // sets this flag, and the effect after the auto-advance one moves focus to
  // the new section's heading once it is on screen -- which also has the
  // screen reader announce where the respondent now is.
  //
  // A ref, not state: it must not cause a render. Navigation that has to
  // focus a specific control instead (a failed submit lands on the failing
  // field) leaves it false. Set only when `current` actually changes, since
  // the effect only runs then -- a flag left set would steal focus later.
  const headingFocusPendingRef = useRef(false);
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
  // The availability check could not be made (network, server). Shown as a
  // neutral note, never as an error: it blocks nothing, and the server
  // still refuses a duplicate address at submission.
  const [emailCheckFailed, setEmailCheckFailed] = useState(false);
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
  const [result, setResult] = useState<{
    establishmentId?: string | null;
    companyName: string;
    status?: string | null;
    // Client time at the moment the server accepted the file -- the
    // response carries no timestamp, and Flutter's receipt does the same.
    registeredAt: Date;
  } | null>(null);
  const [idCopied, setIdCopied] = useState(false);
  // The receipt's title, focused when the receipt replaces the wizard: the
  // submit button that had focus is gone, and nothing else would tell a
  // screen-reader user the registration went through.
  const receiptTitleRef = useRef<HTMLHeadingElement>(null);

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
      setEmailCheckFailed(false);
      if (!email || !email.includes("@")) {
        setEmailAvailable(null);
        return;
      }
      checkEmailAvailable(email)
        .then((r) => setEmailAvailable(r.available))
        .catch(() => {
          setEmailAvailable(null);
          setEmailCheckFailed(true);
        });
    }, 400);
    return () => clearTimeout(handle);
  }, [respondent.email]);

  // ── Advance arming ─────────────────────────────────────────────────────
  // A section with optional fields must not open the next one the instant its
  // required fields are satisfied, or the optional ones (phone 2, P.O. box) would
  // be pulled away mid-entry. What says "I am done here" instead is LEAVING
  // the section's last field after changing it -- not the change itself.
  // Arming on the change pulled a text field away after its first keystroke:
  // typing "6" into Téléphone 2 opened the next section and the rest of the
  // number went nowhere. A select is no different for a keyboard user, whose
  // arrow keys change its value one option at a time.
  //
  // So a change only records whether it was the last field that changed; the
  // section's onBlurCapture is what arms, and Enter on the last field and the
  // continue link advance directly. Recomputed on every change rather than
  // latched: going back up to an earlier field in the same section disarms it.
  const lastFieldEditedRef = useRef(false);

  function armFromField(isLast: boolean) {
    lastFieldEditedRef.current = isLast;
    setAdvanceArmed(false);
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
    gateLabel?: string,
    optional = false
  ): string {
    if (gateLabel) return gateLabel;
    if (query.isFetching) return t("registerPage.loadingOptions");
    if (query.isError) return t("registerPage.loadErrorOptions");
    if ((query.data?.length ?? 0) === 0) return t("registerPage.noOptions");
    // An optional select says so in its own empty option, which is where the
    // respondent is looking when deciding whether to answer it -- the label
    // no longer carries an "(optionnel)" suffix.
    return optional
      ? t("registerPage.optionalPlaceholder")
      : t("registerPage.selectPlaceholder");
  }

  // A list that failed to load is a dead end unless the respondent can ask
  // for it again: the select alone only says "Échec du chargement". Shown
  // under the select, and only once the failed request has settled.
  function loadRetry(query: { isError: boolean; isFetching: boolean; refetch: () => unknown }) {
    if (!query.isError || query.isFetching) return null;
    return (
      <p className="field-hint" role="alert">
        {t("registerPage.loadErrorHint")}{" "}
        <button
          type="button"
          className="load-retry-button"
          onClick={() => void query.refetch()}
        >
          {t("registerPage.retryButton")}
        </button>
      </p>
    );
  }

  // Which codes are long enough to need the middle width. Named by key
  // rather than inferred, because "it is a number written as text" describes
  // the NIU and the CNPS number but also the P.O. box, which is short.
  const CODE_FIELD_KEYS = new Set(["taxNumber", "cnpsNumber", "registrationNumber"]);

  function entityFieldSize(field: EntityField): FieldSize {
    if (CODE_FIELD_KEYS.has(field.key)) return "medium";
    // tel covers every phone; number covers the year of creation and the
    // share capital. None of them is wider than a few characters, and a
    // select always gets the full column because its options can be long.
    if (field.kind === "tel" || field.kind === "number") return "short";
    return "full";
  }

  // One renderer for all three field kinds in step 3, used by both the
  // per-entity subsections and the unmapped-field fallback below them, which
  // carried a second copy of this JSX.
  function renderEntityField(field: EntityField) {
    const id = `reg-entity-${field.key}`;
    // Optionality lives in the control, not in a "(optionnel)" suffix on the
    // label -- see FormRow. A required field shows nothing here unless its
    // own hint carries an example.
    const optionalPlaceholder = field.required
      ? undefined
      : t("registerPage.optionalPlaceholder");
    const invalid = invalidProps(id);
    // A year or an amount is digits only. Not type="number": that adds
    // spinner arrows, lets the mouse wheel change a value the respondent has
    // scrolled past, and accepts "e", "-" and "1e3". A text input with a
    // numeric keypad and the non-digits filtered out keeps what is typed.
    const digitsOnly = field.kind === "number";
    const controlProps = {
      id,
      "aria-required": field.required ? true : undefined,
      ...invalid,
      value: entityData[field.key] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setEntityField(
          field.key,
          digitsOnly ? e.target.value.replace(/\D/g, "") : e.target.value
        ),
    };

    return (
      <FormRow
        key={field.key}
        htmlFor={id}
        label={localized(field.label, locale)}
        required={field.required}
        hint={field.hint ? localized(field.hint, locale) : undefined}
        size={entityFieldSize(field)}
      >
        <div className="input-row">
          {field.kind === "select" ? (
            <select {...controlProps}>
              <option value="">
                {optionalPlaceholder ?? t("registerPage.selectPlaceholder")}
              </option>
              {field.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {localized(o.label, locale)}
                </option>
              ))}
            </select>
          ) : (
            <input
              {...controlProps}
              type={field.kind === "tel" ? "tel" : "text"}
              inputMode={digitsOnly ? "numeric" : undefined}
              maxLength={field.key === "yearOfCreation" ? 4 : undefined}
              placeholder={
                field.placeholder ? localized(field.placeholder, locale) : optionalPlaceholder
              }
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
    // A phone that is given must be a Cameroonian number the declaration
    // wizards will accept (cameroon-phone.ts) — optional ones included.
    for (const [focusId, value] of [
      ["reg-phone1", respondent.phone1],
      ["reg-phone2", respondent.phone2],
    ] as const) {
      if (value.trim() && !isValidCameroonPhone(value)) {
        return { index: respondentIndex, message: t("registerPage.errorPhoneFormat"), focusId };
      }
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
      for (const field of config.fields) {
        const value = entityData[field.key]?.trim();
        if (field.kind === "tel" && isFieldVisible(field) && value && !isValidCameroonPhone(value)) {
          return {
            index: STEPS.indexOf("entityInfo"),
            message: t("registerPage.errorPhoneFormat"),
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
    // The failing control takes focus below, not the section heading.
    headingFocusPendingRef.current = false;
    setCurrent(failure.index);
    setAdvanceArmed(false);
    requestAnimationFrame(() => {
      // The frame swaps to the failing section; put the page back to the top
      // so the error banner above the section is the first thing on screen,
      // then let focusing the control scroll the page the rest of the way if
      // the field sits below the fold (section 3 runs to thirteen rows).
      scrollPageTop();
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
    } else if (target.id && target.id === currentLastFieldId) {
      // Trigger (c). Enter on the section's last field is the keyboard way of
      // saying "done here": if something required is missing it says so, and
      // if not it moves on, which is what the respondent asked for. Reading
      // currentLastFieldId straight from the render closure is safe -- a
      // keydown can only arrive after the component body has finished.
      if (!promptMissing() && current < LAST_INDEX) {
        advanceFrom(current);
      }
    }
  };

  const resolvedRegionName = regionName || regionsQuery.data?.find((r) => r.id === regionId)?.name;
  const resolvedDepartmentName = departmentName || departmentsQuery.data?.find((d) => d.id === departmentId)?.name;
  const resolvedSubdivisionName = subdivisionName || subdivisionsQuery.data?.find((s) => s.id === subdivisionId)?.name;
  const resolvedSectorName = sectorName || sectorsQuery.data?.find((s) => s.id === sectorId)?.name;

  async function submit() {
    if (!entityType || !config) {
      setSubmitError(t("registerPage.errorEntityTypeMissing"));
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
        setSubmitError(t("registerPage.errorLocationNamesMissing"));
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
        phone: visibleData.phone ? normalizeCameroonPhone(visibleData.phone) : visibleData.phone,
        phone2: visibleData.phone2 ? normalizeCameroonPhone(visibleData.phone2) : visibleData.phone2,
        sigle: visibleData.sigle,
        cfpType: visibleData.cfpType,
        educationSystem: visibleData.educationSystem,
        functionalStatus: visibleData.functionalStatus,
        nonFunctionalReason: visibleData.nonFunctionalReason,
        nonFunctionalReasonOther: visibleData.nonFunctionalReasonOther,
        promoterName: visibleData.promoterName,
        promoterSex: visibleData.promoterSex,
        promoterPhone1: visibleData.promoterPhone1 ? normalizeCameroonPhone(visibleData.promoterPhone1) : visibleData.promoterPhone1,
        promoterPhone2: visibleData.promoterPhone2 ? normalizeCameroonPhone(visibleData.promoterPhone2) : visibleData.promoterPhone2,
        sectorId: sectorId || undefined,
        respondentFunction: respondent.function,
        respondentPhone: normalizeCameroonPhone(respondent.phone1),
        respondentPhone2: respondent.phone2 ? normalizeCameroonPhone(respondent.phone2) : undefined,
      };

      const response = await registerCompany(payload);
      setResult({
        establishmentId: response.company.establishmentId,
        companyName: response.company.name ?? companyName,
        status: response.user.status,
        registeredAt: new Date(),
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
    sectionSummary(summaryRows(id, summaryState, (k) => t(k), locale))
  );

  // ── Navigation ─────────────────────────────────────────────────────────
  // The DOCUMENT is the only scroll container (no scroller inside the frame --
  // owner's decision, 2026-10-10), so "go to a section" is a scroll of the
  // page back to its top. Instant, not smooth: the frame's content is swapped
  // at the same moment, so there is nothing to animate past.
  function scrollPageTop() {
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // Called by the rail. A locked section is not reachable -- the rail renders
  // it as a disabled button, and this is the second line of that defence.
  function goToSection(index: number) {
    // Dismissed on the first click of ANY rail item, enabled or not: the
    // respondent has shown they know the circles are controls, which is the
    // only thing the hint was there to say.
    setRailHintDismissed(true);
    // Trigger (d): a locked item is a question, not a dead end. The rail
    // renders it aria-disabled rather than disabled precisely so the click
    // lands here and can say WHY it is locked.
    if (index < 0 || index > reached) {
      promptMissing();
      return;
    }
    clearFlags();
    setAdvanceArmed(false);
    lastFieldEditedRef.current = false;
    if (index !== current) headingFocusPendingRef.current = true;
    setCurrent(index);
    requestAnimationFrame(scrollPageTop);
  }

  // Move forward from `index`, revealing the next section if it was locked.
  function advanceFrom(index: number) {
    const next = Math.min(index + 1, LAST_INDEX);
    if (next === index) return;
    clearFlags();
    setAdvanceArmed(false);
    lastFieldEditedRef.current = false;
    headingFocusPendingRef.current = true;
    setReached((prev) => Math.max(prev, next));
    setCurrent(next);
    requestAnimationFrame(scrollPageTop);
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
      if (current !== infoIndex) headingFocusPendingRef.current = true;
      setCurrent(infoIndex);
      setAdvanceArmed(false);
      lastFieldEditedRef.current = false;
      requestAnimationFrame(scrollPageTop);
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
  // respondent to say so, by leaving its last field after changing it,
  // pressing Enter on it, or following the "continue" link -- see
  // armFromField.
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
    lastFieldEditedRef.current = false;
    headingFocusPendingRef.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- see above */
    setAdvanceArmed(false);
    setReached(next);
    setCurrent(next);
    /* eslint-enable react-hooks/set-state-in-effect */
    requestAnimationFrame(scrollPageTop);
  }, [frontierComplete, frontierImmediate, advanceArmed, reached]);

  // Moves focus to the new section's heading -- see headingFocusPendingRef.
  // Declared after every effect and handler that sets the flag.
  useEffect(() => {
    if (!headingFocusPendingRef.current) return;
    headingFocusPendingRef.current = false;
    // preventScroll: the page is put back to its top by the navigation
    // itself, and the heading is the first thing in the frame.
    document
      .getElementById(`reg-section-title-${STEPS[current]}`)
      ?.focus({ preventScroll: true });
  }, [current]);

  // ── Missing required fields ────────────────────────────────────────────
  // The names a field is reported by. entityLabel is the one resolver that
  // does not go through the catalogue: section 3's names come from the
  // questionnaire's own field set.
  const nameResolvers: NameResolvers = {
    t: (key) => t(key),
    entityLabel: (field) => localized(field.label, locale),
  };

  const currentStep = STEPS[current];
  const currentLastFieldId = lastFieldId(currentStep, entityType, entityData);

  // Re-derived every render from the values, never stored: a flagged field
  // drops out of the notice the moment it is filled, with nothing to clear.
  // missingNow is everything still blocking the section (Continuer's state);
  // shownErrors is what the notice names -- see missingFieldsToReport for
  // why a cascade field waiting on its parent is not named.
  const missingNow = missingRequiredFields(currentStep, regState, nameResolvers);
  const shownErrors = missingFieldsToReport(currentStep, regState, nameResolvers).filter((f) =>
    flaggedIds.includes(f.id)
  );

  // The four triggers in item 11 all call this. Returns true when it actually
  // stopped something, so a caller can use it as a guard.
  function promptMissing(): boolean {
    const missing = missingFieldsToReport(currentStep, regState, nameResolvers);
    if (missing.length === 0) return false;
    setFlaggedIds(missing.map((f) => f.id));
    requestAnimationFrame(() => focusField(missing[0].id));
    return true;
  }

  // Focuses a field by id and brings it into view. Used by promptMissing for
  // the first gap, and by the summary's links for any of them.
  function focusField(id: string) {
    {
      const first = document.getElementById(id);
      // The type list's "field" is a <fieldset>, which carries the id but
      // cannot take focus, so the first radio stands in for it. Checking the
      // element kind rather than the id keeps this true if another group
      // field is ever added.
      const focusable =
        first instanceof HTMLInputElement ||
        first instanceof HTMLSelectElement ||
        first instanceof HTMLTextAreaElement
          ? first
          : firstEntityRadioRef.current;
      // Default scroll behaviour on purpose: the page scrolls the minimum
      // needed to reveal the control.
      focusable?.focus();
      if (first && first !== focusable) {
        first.scrollIntoView({ block: "nearest" });
      }
    }
  }

  // Clearing happens per field as it is fixed, which the derivation above
  // already does. This only drops the flags wholesale when the respondent
  // moves to another section, so yesterday's errors do not greet them on
  // their way back in.
  function clearFlags() {
    if (flaggedIds.length > 0) setFlaggedIds([]);
  }

  // One message, not one per field. The pinned notice names every missing
  // field; only the FIRST of them is marked invalid -- the red border on the
  // control that also has focus, which says "start here" -- and it points at
  // that notice. Marking every field red and repeating "Champ obligatoire"
  // under each turned a section with three gaps into a red page.
  function invalidProps(id: string) {
    if (shownErrors[0]?.id !== id) return {};
    return { "aria-invalid": true, "aria-describedby": MISSING_NOTICE_ID } as const;
  }

  // ── Continue ───────────────────────────────────────────────────────────
  // Shown at the bottom of the section whenever that section is the furthest
  // revealed one, complete or not. Styled as available and aria-disabled
  // while incomplete: a control that vanishes until the form is correct
  // cannot tell anyone what is wrong with the form, which is the one thing
  // the respondent needs at that moment.
  //
  // It is also the required-only path forward. A section with optional fields
  // auto-advances when its LAST field is changed and left -- and in every such section
  // that last field is itself optional (phone2, poBox, promoterPhone2, the
  // activity sector), so a respondent who fills only what is required never
  // triggers it. This link is what they use instead, and it never asks them
  // to touch an optional field.
  const showContinueLink = current < LAST_INDEX && current === reached;
  const continueBlocked = missingNow.length > 0;

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
    // The notice used to sit at the top of the frame, above the section, and
    // cost the Declarant step a scrollbar at 1366x680 for a sentence that was
    // only true once. It is two separate facts, each delivered where it is
    // relevant: "your draft came back" is a transient event, so it goes
    // through the snackbar the page already has; "your password did not come
    // back" is about one section, so it waits inside that section.
    setSnackbar(t("registerPage.draftRestoredNotice"));
    setDraftRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // `t` is in the deps because the snackbar text above is translated. It
    // cannot cause a second restore: draftLoadedRef short-circuits the body
    // on every run after the first.
  }, [t]);

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
    if (result) receiptTitleRef.current?.focus({ preventScroll: true });
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
    const isActive = result.status === "ACTIVE";
    const establishmentId = result.establishmentId;
    const copyEstablishmentId = async () => {
      if (!establishmentId) return;
      try {
        await navigator.clipboard.writeText(establishmentId);
        setIdCopied(true);
      } catch {
        // Clipboard is unavailable over plain HTTP and in some locked-down
        // browsers. The ID stays on screen and selectable, so this is a
        // missing convenience, not a failure worth an alert.
        setIdCopied(false);
      }
    };

    return (
      <main className="cam-auth-page">
        <div className="wrap-wide">
          <AuthHeader />
          <div className="card card--admin">
            <div className="card-body">
              <div className="receipt-hero">
                <div className="receipt-disc" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                {/* Every file now has its ID at registration, so the wording follows
                    the account status: only an active account is "registered". */}
                <h1 className="brand-name receipt-title" ref={receiptTitleRef} tabIndex={-1}>
                  {isActive ? t("registerPage.successTitle") : t("registerPage.pendingTitle")}
                </h1>
                <p className="brand-sub receipt-subtitle">
                  {isActive
                    ? t("registerPage.receiptSubtitleActive")
                    : t("registerPage.receiptSubtitlePending")}
                </p>
              </div>

              {/* The ID is the one thing on this screen the respondent has to
                  keep, so it stands on its own above the table, large and
                  copyable, as on the Flutter receipt. */}
              {establishmentId && (
                <div className="receipt-id-block">
                  <span className="receipt-id-label" id="receipt-id-label">
                    {t("registerPage.receiptEstablishmentIdLabel")}
                  </span>
                  <span className="receipt-id receipt-id--hero" aria-labelledby="receipt-id-label">
                    {establishmentId}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary receipt-copy"
                    onClick={copyEstablishmentId}
                  >
                    {idCopied ? `✓ ${t("registerPage.receiptIdCopied")}` : t("registerPage.receiptCopyId")}
                  </button>
                  <span className="sr-only" aria-live="polite">
                    {idCopied ? t("registerPage.receiptIdCopied") : ""}
                  </span>
                  <p className="receipt-note">{t("registerPage.receiptKeepIdNote")}</p>
                </div>
              )}

              <table className="table-official">
                <tbody>
                  <tr>
                    <td className="label-cell">{t("registerPage.receiptCompanyLabel")}</td>
                    <td className="value-cell value-cell--bold">{result.companyName}</td>
                  </tr>
                  {config && (
                    <tr>
                      <td className="label-cell">
                        {t("registerPage.summaryEntityTypeLabel")}
                      </td>
                      <td className="value-cell">{localized(config.title, locale)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="label-cell">{t("registerPage.receiptRespondentLabel")}</td>
                    <td className="value-cell">{respondent.firstName} {respondent.lastName} ({respondent.email})</td>
                  </tr>
                  <tr>
                    <td className="label-cell">{t("registerPage.receiptDateLabel")}</td>
                    <td className="value-cell">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(
                        result.registeredAt
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="label-cell">{t("registerPage.receiptStatusLabel")}</td>
                    {isActive ? (
                      <td className="value-cell value-cell--ready">
                        {t("registerPage.receiptStatusActive")}
                      </td>
                    ) : (
                      <td className="value-cell value-cell--strong">
                        {t("registerPage.receiptStatusPending")}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>

              {/* What happens next. A pending file waits for a reviewer, and
                  its attestation PDF is only produced on approval; an active
                  one can fetch its attestation from the home space. */}
              <p className="receipt-note">
                {isActive
                  ? t("registerPage.receiptActiveAttestationNote")
                  : t("registerPage.receiptPendingNote")}
              </p>

              {/* The one way on. The registration response's token is not
                  kept, so the respondent signs in -- with the email they
                  just registered already in the identifier field. A pending
                  account is sent on to its status page by the home layout. */}
              <div style={{ marginTop: "24px" }}>
                <Link
                  href="/login"
                  className="btn-primary"
                  onClick={() => saveLoginIdentifier(respondent.email.trim())}
                >
                  {isActive ? t("registerPage.signInLink") : t("registerPage.receiptFollowButton")}
                </Link>
              </div>
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
              title={t("registerPage.stepEntityType")}
              subtitle={t("registerPage.entityTypeSubtitle")}
            />

            {/* As in the Flutter app (register_steps.dart StepEntityType):
                the title and subtitle, then the choices -- no field label,
                which only repeated the title. The fieldset is named by the
                step title.

                The fieldset also carries the id the missing-fields prompt
                points at; the prompt focuses the first radio through
                firstEntityRadioRef. */}
            <fieldset
              id="reg-entity-type"
              className="entity-type-list"
              aria-labelledby="reg-section-title-entityType"
              {...invalidProps("reg-entity-type")}
            >
              {ENTITY_TYPE_OPTIONS.map((option, idx) => (
                <label key={option.type} className="entity-type-option">
                  <input
                    ref={idx === 0 ? firstEntityRadioRef : undefined}
                    type="radio"
                    name="entityType"
                    value={option.type}
                    checked={entityType === option.type}
                    onChange={() => requestEntityType(option.type)}
                    aria-describedby={option.hintKey ? `reg-entity-hint-${option.type}` : undefined}
                  />
                  <span className="entity-type-option-label">
                    {t(option.labelKey)}
                    {option.hintKey && (
                      <span
                        id={`reg-entity-hint-${option.type}`}
                        className="entity-type-option-hint"
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
                    {...invalidProps("reg-first-name")}
                    value={respondent.firstName}
                    onChange={(e) => setRespondentField("firstName", e.target.value)}
                    placeholder={t("registerPage.firstNamePlaceholder")}
                  />
                </div>
              </FormRow>

              <FormRow htmlFor="reg-last-name" label={t("registerPage.lastNameLabel")} required>
                <div className="input-row">
                  <input
                    id="reg-last-name"
                    type="text"
                    aria-required={true}
                    {...invalidProps("reg-last-name")}
                    value={respondent.lastName}
                    onChange={(e) => setRespondentField("lastName", e.target.value)}
                    placeholder={t("registerPage.lastNamePlaceholder")}
                  />
                </div>
              </FormRow>

              <FormRow htmlFor="reg-function" label={t("registerPage.functionLabel")} required>
                <div className="input-row">
                  <select
                    id="reg-function"
                    aria-required={true}
                    {...invalidProps("reg-function")}
                    value={respondent.function}
                    onChange={(e) => setRespondentField("function", e.target.value)}
                  >
                    <option value="">{t("registerPage.selectPlaceholder")}</option>
                    {RESPONDENT_FUNCTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {localized(o.label, locale)}
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
                    {...invalidProps("reg-email")}
                    type="email"
                    value={respondent.email}
                    onChange={(e) => setRespondentField("email", e.target.value)}
                    placeholder={t("registerPage.emailPlaceholder")}
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
                  {emailCheckFailed && (
                    <span className="field-status is-muted">
                      {t("registerPage.emailCheckFailed")}
                    </span>
                  )}
                </div>
              </FormRow>

              <FormRow htmlFor="reg-phone1" label={t("registerPage.phone1Label")} required size="short">
                <div className="input-row">
                  <input
                    id="reg-phone1"
                    aria-required={true}
                    {...invalidProps("reg-phone1")}
                    type="tel"
                    value={respondent.phone1}
                    onChange={(e) => setRespondentField("phone1", e.target.value)}
                    placeholder={t("registerPage.phonePlaceholder")}
                  />
                </div>
              </FormRow>

              <FormRow htmlFor="reg-phone2" label={t("registerPage.phone2Label")} size="short">
                <div className="input-row">
                  <input
                    id="reg-phone2"
                    type="tel"
                    value={respondent.phone2}
                    onChange={(e) => setRespondentField("phone2", e.target.value)}
                    placeholder={t("registerPage.optionalPlaceholder")}
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
              title={localized(config.title, locale)}
              subtitle={localized(config.identification, locale)}
            />

            {/* The grouping and the field order both come from
                entityFieldGroups, which is also what lastEntityFieldKey
                reads: the field the wizard treats as "the last one in this
                section" is by construction the last one rendered here. */}
            {/* ONE grid for the whole section, not one per block. The label
                column is a grid track sized to the longest label in it, so a
                grid per block would give each block its own column width and
                the inputs would start at a different x after every heading.
                The headings are grid items spanning both columns instead. */}
            <div className="form-single-column">
              {entityFieldGroups(entityType, entityData).map((group) => (
                <Fragment key={group.title.fr}>
                  <div className="admin-section-header">
                    {localized(group.title, locale)}
                  </div>
                  {group.fields.map(renderEntityField)}
                </Fragment>
              ))}
            </div>
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
                    {...invalidProps("reg-region")}
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
                {loadRetry(regionsQuery)}
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
                    {...invalidProps("reg-department")}
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
                {loadRetry(departmentsQuery)}
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
                    {...invalidProps("reg-subdivision")}
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
                {loadRetry(subdivisionsQuery)}
              </FormRow>

              <FormRow htmlFor="reg-area" label={t("registerPage.areaLabel")} required>
                <div className="input-row">
                  <select
                    id="reg-area"
                    aria-required={true}
                    {...invalidProps("reg-area")}
                    value={area}
                    onChange={(e) => {
                      armFromField(false);
                      setArea(e.target.value);
                    }}
                  >
                    <option value="">{t("registerPage.urbanRuralPlaceholder")}</option>
                    {AREA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {localized(o.label, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              </FormRow>

              <FormRow htmlFor="reg-sector" label={t("registerPage.sectorLabel")}>
                <div className="input-row">
                  <select
                    id="reg-sector"
                    value={sectorId}
                    onChange={(e) => {
                      const id = e.target.value;
                      // The activity sector is the section's last field, and
                      // the only optional one: leaving it after changing it
                      // says the respondent is done with the location.
                      armFromField(true);
                      setSectorId(id);
                      setSectorName(sectorsQuery.data?.find((s) => s.id === id)?.name || "");
                    }}
                  >
                    <option value="">
                      {selectStatusLabel(sectorsQuery, undefined, true)}
                    </option>
                    {sectorsQuery.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                {loadRetry(sectorsQuery)}
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

            {/* The half of the restore notice that belongs to this section.
                It appears when the section opens rather than at the top of
                the flow, and goes as soon as there is a password to speak
                of -- a standing reminder to type something the respondent
                has just typed is noise. */}
            {draftRestored && !password && (
              <p className="section-notice" role="status">
                {t("registerPage.draftPasswordReminder")}
              </p>
            )}

            <div className="form-single-column">
              <FormRow htmlFor="reg-password" label={t("registerPage.passwordLabel")} required>
                <div className="input-row">
                  <input
                    id="reg-password"
                    aria-required={true}
                    {...invalidProps("reg-password")}
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
                    {...invalidProps("reg-confirm-password")}
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

            {/* The certification, made once by ticking the box. The submit
                button it gates is pinned in the frame footer, where every
                other step keeps its primary action. No "Déclaration sur
                l'honneur" prefix: this is the inscription, not a
                declaration. */}
            <label className="certify-row">
              <input
                id="reg-certify"
                type="checkbox"
                checked={certified}
                aria-invalid={certifyFlagged && !certified ? true : undefined}
                aria-describedby={certifyFlagged && !certified ? "reg-certify-error" : undefined}
                onChange={(e) => setCertified(e.target.checked)}
              />
              <span>{t("registerPage.certifyLabel")}</span>
            </label>
            {certifyFlagged && !certified && (
              <p className="field-error certify-error" id="reg-certify-error">
                {t("registerPage.certifyRequiredError")}
              </p>
            )}
          </>
        );
    }
  }

  // The way out of the wizard and the help contact. Rendered twice -- in the
  // dossier panel on a wide screen, under the frame on a narrow one -- and
  // CSS shows one of the two, so each sits where that layout keeps its chrome.
  const exitLinks = (
    <>
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
    </>
  );

  // One frame, one section, one scrollbar -- the page's own.
  //
  // Owner's decision, 2026-10-10: the DOCUMENT scrolls, never a region inside
  // the frame (CLAUDE.md section 13). On a wide screen the page is two
  // columns: the dossier panel -- identity, the six steps with what each
  // holds, the way out -- sticky beside a body holding a single bordered
  // frame. On a narrow screen the panel is not shown and the page is a column
  // of the header that carries the rail, the body and a one-line footer.
  // Either way a long section makes the page longer, and the frame's dock
  // (notices, Retour, Continuer) is position: sticky to the bottom of the
  // viewport so the step's actions stay on screen.
  //
  // Every revealed section stays MOUNTED and is merely hidden: a section the
  // respondent has left keeps its state and its in-flight requests, and the
  // email-availability check running when they moved on still lands.
  return (
    <main className="cam-auth-page cam-auth-page--wizard">
      {/* Narrow screens only. Sticky by structure, not by position: this is
          a fixed-size row of the page's flex column, so nothing can scroll
          underneath it. */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <AuthHeader />
          <RegistrationProgress
            currentIndex={current}
            reached={reached}
            completed={completed}
            summaries={railSummaries}
            onSelect={goToSection}
            hint={
              !railHintDismissed && completed.some((c, i) => c && i !== current)
                ? t("registerPage.railEditHintLine")
                : null
            }
          />
        </div>
      </header>

      {/* The step announcement, outside both navigations: on a wide screen
          the rail above is not rendered and on a narrow one the panel below
          is not, and a live region that is not rendered announces nothing.
          Visually hidden, so it is in the tree at every width. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t("registerPage.stepIndicator", { current: current + 1, total: STEPS.length })}
        {" — "}
        {t(`registerPage.${REGISTRATION_STEPS[current].labelKey}`)}
      </p>

      <div className="flow-split">
        {/* Wide screens only: the dossier panel. */}
        <WizardRail
          className="flow-panel"
          head={
            <div className="flow-panel-identity">
              <span className="flow-panel-emblem">
                <OfficialLogo label={t("landingPage.emblemLabel")} />
              </span>
              <div>
                <div className="flow-panel-wordmark">{t("authShared.wordmark")}</div>
                <p className="flow-panel-sub">{t("authShared.subtitle")}</p>
              </div>
            </div>
          }
          foot={<div className="flow-panel-foot">{exitLinks}</div>}
        >
          <RegistrationStepList
            currentIndex={current}
            reached={reached}
            completed={completed}
            summaries={railSummaries}
            onSelect={goToSection}
          />
        </WizardRail>

        <div className="flow-body">
          {/* The frame: the one bordered element in the body. */}
          <div className="flow-frame">
            <div className="flow-frame-content">
              {/* Reset and restore notices. Announced, because the change they
                  report happened somewhere the respondent may not be looking. */}
              <div className="wizard-snackbar-region" role="status" aria-live="polite">
                {snackbar && <div className="wizard-snackbar">{snackbar}</div>}
              </div>

              {/* Error summary at the top of the section, the convention for
                  government forms: it names every missing field and each name
                  links to its control. The first missing control is also
                  focused and points here (aria-describedby). */}
              {shownErrors.length > 0 && (
                <div className="flow-missing-notice" id={MISSING_NOTICE_ID} role="alert">
                  {t("registerPage.missingFieldsLead", { count: shownErrors.length })}{" "}
                  {shownErrors.map((f, i) => (
                    <span key={f.id}>
                      {i > 0 && ", "}
                      <a
                        href={`#${f.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          focusField(f.id);
                        }}
                      >
                        {f.name}
                      </a>
                    </span>
                  ))}
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
                    // Trigger (a): focus leaving the section's LAST field for
                    // somewhere outside the section. Capture, because blur does
                    // not bubble. relatedTarget is what distinguishes "moved on"
                    // from "moved to another field in here" -- tabbing between
                    // the section's own fields must never raise errors, and a
                    // null relatedTarget (clicked the page chrome, switched
                    // windows) is deliberately NOT treated as leaving.
                    //
                    // The same blur is what arms the advance once the last field
                    // has been changed (see armFromField): leaving the field for
                    // the continue button, or for anywhere outside the section,
                    // says the respondent is done with it.
                    onBlurCapture={(e) => {
                      if (idx !== current) return;
                      if (!currentLastFieldId) return;
                      if ((e.target as HTMLElement).id !== currentLastFieldId) return;
                      const next = e.relatedTarget as HTMLElement | null;
                      if (!next) return;
                      // The frame footer's Retour and Continuer are in the
                      // dock below the content, outside this <section>
                      // in the DOM, but they are still this section's own
                      // controls. Only moving to Continuer says "done here":
                      // a respondent heading for Retour must not be pushed
                      // forward on the way.
                      const toBack = next.closest("[data-flow-back]");
                      if (e.currentTarget.contains(next) || toBack || next.closest("[data-flow-continue]")) {
                        if (lastFieldEditedRef.current && !isFormField(next) && !toBack) {
                          setAdvanceArmed(true);
                        }
                        return;
                      }
                      if (lastFieldEditedRef.current) setAdvanceArmed(true);
                      promptMissing();
                    }}
                  >
                    {renderSection(id)}
                  </section>
                ))}
              </form>
            </div>

            {/* The frame footer: Retour / Continuer at the end of the form,
                where respondents finish the section. Not pinned: a sticky bar
                covered the field being filled (WCAG 2.2, 2.4.11) and, on a
                phone, sat on the keyboard. Owner's decision, 2026-10-10. */}
            <div className="flow-frame-dock">
              {/* Retour: every section but the first. The step list (or the
                  rail) can jump anywhere already revealed; this is the plain
                  one-step-back respondents look for at the bottom of a form.

                  Continuer: the step's one primary action, on every section
                  but the review. At the frontier it is trigger (b) -- shown
                  whether or not the section is complete, because a control
                  that disappears until the form is correct cannot tell anyone
                  what is wrong with the form. On a section the respondent has
                  come back to, it moves on to the next revealed one, which
                  nothing on screen used to offer. The class name is kept from
                  the text link this replaced, which the layout test selects
                  by. */}
              <div className="flow-frame-foot">
                {current > 0 && (
                  <button
                    type="button"
                    className="btn-secondary flow-back"
                    data-flow-back
                    onClick={() => goToSection(current - 1)}
                  >
                    <span aria-hidden="true">←</span>
                    {t("registerPage.backButton")}
                  </button>
                )}
                {current < LAST_INDEX && (
                  <button
                    type="button"
                    className="btn-primary btn-primary--inline flow-continue-link"
                    data-flow-continue
                    aria-disabled={(showContinueLink && continueBlocked) || undefined}
                    // Never the `disabled` attribute: a disabled button
                    // swallows the click, and the click is how the
                    // respondent asks what is missing.
                    onClick={() => {
                      if (!showContinueLink) {
                        goToSection(current + 1);
                        return;
                      }
                      if (promptMissing()) return;
                      advanceFrom(current);
                    }}
                  >
                    {t("registerPage.continueButton")}
                    <span aria-hidden="true">→</span>
                  </button>
                )}
                {/* Soumettre: the review's primary action, in the same place
                    as Continuer on every other step. aria-disabled rather
                    than disabled until the box is ticked, for the same reason
                    as Continuer: the click is how the respondent learns what
                    is still missing. Truly disabled only while in flight. */}
                {current === LAST_INDEX && (
                  <button
                    type="button"
                    className="btn-primary btn-primary--inline btn-primary--submit"
                    aria-disabled={!certified || undefined}
                    aria-busy={submitting || undefined}
                    disabled={submitting}
                    onClick={() => {
                      if (!certified) {
                        setCertifyFlagged(true);
                        const box = document.getElementById("reg-certify");
                        box?.focus();
                        box?.scrollIntoView({ block: "nearest" });
                        return;
                      }
                      handleSubmitPress();
                    }}
                  >
                    {submitting
                      ? t("registerPage.submittingLabel")
                      : t("registerPage.submitButton")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Narrow screens only; the panel carries these on a wide one. */}
      <div className="flow-footer">{exitLinks}</div>

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
                className="btn-primary btn-primary--inline"
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
                className="btn-primary btn-primary--inline"
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
