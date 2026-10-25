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
  entityFieldLabel,
  pruneEntityDataForType,
  resolveAddress,
  resolveCompanyName,
  resolveMainActivity,
  visibleEntityDataForType,
  yearOptions,
  type EntityField,
  type EntityType,
  type RegistrationStepId,
} from "@/lib/register-constants";
import {
  isPlausibleEmail,
  isSectionComplete,
  type RegRespondentState,
  type RegState,
  type SubdivisionsStatus,
} from "@/lib/register-completeness";
import {
  optionalEntityFields,
  requiredEntityGroups,
} from "@/lib/register-entity-sections";
import { asUiLocale, localized } from "@/lib/register-i18n";
import { sectorLabel } from "@/lib/display-labels";
import { branchesFor, dropUnofferedBranch } from "@/lib/register-activity";
import { firstIncompleteWithin } from "@/lib/register-rail";
import {
  lastFieldId,
  missingFieldsToReport,
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
import {
  AREA_OPTIONS,
  RESPONDENT_FUNCTION_OTHER,
  functionFitsEntityType,
  getRespondentFunctionOptions,
} from "@/lib/register-options";
import { saveLoginIdentifier } from "@/lib/login-handoff";
import { isValidCameroonPhone, normalizeCameroonPhone } from "@/lib/cameroon-phone";
import {
  passwordStrength,
  passwordStrengthBand,
  validatePassword,
} from "@/lib/password-strength";
import { sectionSummary, summaryRows, type SummaryState } from "@/lib/register-summary";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { BlankOption } from "@/components/auth/BlankOption";
import { ConfirmDialog } from "@/components/auth/ConfirmDialog";
import { FormRow, type FieldSize } from "@/components/auth/FormRow";
import { PasswordRequirementHint } from "@/components/auth/PasswordRequirementHint";
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

// validatePassword returns a code. The sentence the respondent reads is the
// catalogue's, in the active language.
// The longest option list shown as radio buttons rather than a dropdown.
// Beyond five, the list pushes the rest of the step down more than a
// dropdown costs in clicks.
const MAX_RADIO_OPTIONS = 5;

const PASSWORD_ERROR_KEY = {
  required: "registerPage.errorPasswordRequired",
  tooShort: "registerPage.errorPasswordTooShort",
  tooWeak: "registerPage.errorPasswordTooWeak",
} as const;

const PASSWORD_STRENGTH_KEY = {
  weak: "registerPage.passwordStrengthWeak",
  medium: "registerPage.passwordStrengthMedium",
  strong: "registerPage.passwordStrengthStrong",
  veryStrong: "registerPage.passwordStrengthVeryStrong",
} as const;

// The notice for an answer that is present but in the wrong shape (an email
// without a domain, a phone that is not 9 digits), shown by Continuer.
const FORMAT_NOTICE_ID = "reg-format-notice";
// Controls answered by picking rather than typing; a missing one asks for a
// choice. Step-3 fields are told apart by their kind (isChoiceField).
const CHOICE_FIELD_IDS = new Set([
  "reg-entity-type",
  "reg-function",
  "reg-region",
  "reg-department",
  "reg-subdivision",
  "reg-area",
]);

// Step 1 radio list: one row per structure type, in respondent-facing order.
// Labels avoid administrative codes (CTD/ONG/CFP); the two types whose plain
// label is ambiguous carry a short hint. Replaces the former public/private
// two-state classification flow, which was UI-only and never reached the payload.
// No hint line under any option: the wizard carries no hints (owner,
// 2026-10-15). The labels have to stand on their own.
const ENTITY_TYPE_OPTIONS: { type: EntityType; labelKey: string }[] = [
  { type: "enterprise", labelKey: "registerPage.entityOptionEnterprise" },
  { type: "cooperative", labelKey: "registerPage.entityOptionCooperative" },
  { type: "ong", labelKey: "registerPage.entityOptionOng" },
  { type: "administration", labelKey: "registerPage.entityOptionAdministration" },
  { type: "ctd", labelKey: "registerPage.entityOptionCtd" },
  { type: "projectProgram", labelKey: "registerPage.entityOptionProjectProgram" },
  { type: "vocationalTraining", labelKey: "registerPage.entityOptionVocationalTraining" },
];

// A field inside the optional disclosure is not focusable while that
// disclosure is closed. Open it before focusing, so an invalid optional
// phone can still be reached from the error path.
function openDetailsAround(el: Element | null) {
  const details = el?.closest("details");
  if (details instanceof HTMLDetailsElement && !details.open) details.open = true;
}

// A control the respondent types or picks a value in -- as opposed to the
// continue button, the eye toggle or the rail. Leaving one is what lets its
// format rule speak (see leftFieldError).
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
  // Item 11: the DOM ids of the fields a trigger has flagged. Only a FLAG is
  // stored, never an error message -- whether a flagged field still shows one
  // is re-derived from its value on every render, so an error clears the
  // moment the field is filled without anything having to remember to clear
  // it. Nothing is flagged until a trigger fires, which is what keeps errors
  // off fields the respondent has not reached yet.
  const [flaggedIds, setFlaggedIds] = useState<readonly string[]>([]);
  // The control Continuer last found in the wrong shape. Like flaggedIds, a
  // flag only: the message is re-derived from the values (formatFailure), so
  // it goes the moment the answer is corrected.
  const [formatFlagId, setFormatFlagId] = useState<string | null>(null);
  // How many fields Continuer found missing, for the one sentence a screen
  // reader hears when it is pressed. Set by the click, not derived: the
  // sentence must not be re-announced each time one of the fields is filled.
  const [missingAnnounced, setMissingAnnounced] = useState(0);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [pendingEntityType, setPendingEntityType] = useState<EntityType | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  // The DOM ids of the fields the respondent has left at least once. A field
  // with a format rule (email, phones) says what is wrong with its answer
  // under the control as soon as it is left, rather than waiting for
  // Continuer. A flag only, like flaggedIds: the message is re-derived from
  // the value, so it goes the moment the answer is corrected.
  const [leftIds, setLeftIds] = useState<readonly string[]>([]);
  // Focus on a section change. The section being left is `hidden`, so
  // whatever had focus inside it drops to <body> and a keyboard or
  // screen-reader user is nowhere. Every navigation that changes the section
  // sets this flag, and an effect below moves focus to
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
  // The optional-details disclosure on the organisation step. Closed until
  // the respondent opens it, or until a restored answer is sitting inside it.
  const optionalDetailsRef = useRef<HTMLDetailsElement>(null);
  const optionalClosedByUser = useRef(false);
  const optionalTypeSeen = useRef<EntityType | null>(null);
  const [respondent, setRespondent] = useState<RegRespondentState>({
    firstName: "",
    lastName: "",
    function: "",
    functionOther: "",
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
  // When the receipt was printed, for its footer line: taken as the print
  // dialog opens, so a receipt printed later carries the later time.
  const [printedAt, setPrintedAt] = useState(() => new Date());
  useEffect(() => {
    const onBeforePrint = () => setPrintedAt(new Date());
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  const config = entityType ? ENTITY_CONFIGS[entityType] : null;

  const [regionName, setRegionName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [subdivisionName, setSubdivisionName] = useState("");
  // The chosen branch's names, kept for a restored draft whose branch list
  // has not loaded yet. The English one so the review can show the branch in
  // the reader's language, as the picker does (B10).
  const [branchName, setBranchName] = useState("");
  const [branchNameEn, setBranchNameEn] = useState("");

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
    password,
    confirmPassword,
  };

  // Debounced email availability check
  useEffect(() => {
    const email = respondent.email.trim();
    const handle = setTimeout(() => {
      setEmailCheckFailed(false);
      // Only an address that could exist is worth asking about: a "✓
      // available" next to "name@domain" without its ".cm" read as approval.
      if (!isPlausibleEmail(email)) {
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

  function setEntityField(key: string, value: string) {
    // A new sector drops a branch that belongs to another one.
    setEntityData((prev) =>
      dropUnofferedBranch({ ...prev, [key]: value }, sectorsQuery.data, entityType)
    );
    if (key === "branchId") {
      const picked = sectorsQuery.data?.find((s) => s.id === value);
      setBranchName(picked?.name || "");
      setBranchNameEn(picked?.nameEn || "");
    }
  }

  function setRespondentField(key: keyof RegRespondentState, value: string) {
    setRespondent((r) => ({ ...r, [key]: value }));
  }

  function isFieldVisible(field: { key?: string; dependsOn?: string; dependsValue?: string }): boolean {
    return checkFieldVisible(field as import("@/lib/register-constants").EntityField, entityData, config?.fields);
  }

  // Text for the empty <option> of a select whose list comes from the API.
  // Normally nothing: the box's arrow already says "dropdown", so no
  // "— Sélectionner —" (owner, 2026-10-15). Only a state the respondent must
  // know about is written there -- still loading, nothing to choose, or the
  // request failed. A cascade field whose parent is unanswered (`gated`) is
  // disabled and greyed, which says enough, so it stays empty too.
  function selectStatusLabel(
    query: { isFetching: boolean; isError: boolean; data?: readonly unknown[] },
    gated = false
  ): string {
    if (gated) return "";
    if (query.isFetching) return t("registerPage.loadingOptions");
    if (query.isError) return t("registerPage.loadErrorOptions");
    if ((query.data?.length ?? 0) === 0) return t("registerPage.noOptions");
    return "";
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

  /**
   * One level of the location cascade. The three rows -- region, department,
   * arrondissement -- differ only in their label, the query behind them, the
   * level above that gates them, and what a new answer clears below it; every
   * other part of the row was written out three times.
   *
   * `gatedBy` is "the level above is unanswered": it greys the row, keeps the
   * prompt empty (selectStatusLabel says nothing about a list nobody can
   * reach yet) and, unless `disabled` says otherwise, disables the control.
   * A function rather than a component on purpose -- it closes over this
   * render's helpers, and a component declared here would be a new type on
   * every render, remounting the select and losing its focus.
   */
  function locationRow({
    id,
    label,
    query,
    value,
    gatedBy,
    disabled,
    hint,
    onSelect,
  }: {
    id: string;
    label: string;
    query: {
      isFetching: boolean;
      isError: boolean;
      refetch: () => unknown;
      data?: { id: string; name: string }[];
    };
    value: string;
    gatedBy?: boolean;
    disabled?: boolean;
    hint?: string;
    /** The chosen id, and its name, which the review step reads back. */
    onSelect: (id: string, name: string) => void;
  }) {
    return (
      <FormRow
        htmlFor={id}
        label={label}
        required
        gated={gatedBy}
        error={fieldErrorLine(id)}
        hint={hint}
      >
        <div className="input-row">
          <select
            id={id}
            aria-required={true}
            {...invalidProps(id)}
            value={value}
            disabled={disabled ?? gatedBy}
            onChange={(e) => {
              const next = e.target.value;
              onSelect(next, query.data?.find((item) => item.id === next)?.name || "");
            }}
          >
            <BlankOption label={selectStatusLabel(query, gatedBy)} />
            {query.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        {loadRetry(query)}
      </FormRow>
    );
  }

  // Which codes are long enough to need the middle width. Named by key
  // rather than inferred, because "it is a number written as text" describes
  // the NIU and the CNPS number but also the P.O. box, which is short.
  const CODE_FIELD_KEYS = new Set(["taxNumber", "cnpsNumber", "registrationNumber"]);

  // The organisation's own name and address. Every other field in step 3 is
  // "off": the establishment's phone is not the respondent's, and a browser
  // offering the respondent's number there would be offering the wrong one.
  const ENTITY_AUTOCOMPLETE: Record<string, string> = {
    companyName: "organization",
    address: "street-address",
  };

  function entityFieldSize(field: EntityField): FieldSize {
    if (CODE_FIELD_KEYS.has(field.key)) return "medium";
    // tel covers every phone, year the year of creation, number the share
    // capital. None of them is wider than a few characters, and a select
    // always gets the full column because its options can be long.
    if (field.kind === "tel" || field.kind === "number" || field.kind === "year") return "short";
    return "full";
  }

  // One renderer for all three field kinds in step 3, used by both the
  // per-entity subsections and the unmapped-field fallback below them, which
  // carried a second copy of this JSX.
  function renderEntityField(field: EntityField) {
    const id = `reg-entity-${field.key}`;
    const invalid = invalidProps(id);
    // A year or an amount is digits only. Not type="number": that adds
    // spinner arrows, lets the mouse wheel change a value the respondent has
    // scrolled past, and accepts "e", "-" and "1e3". A text input with a
    // numeric keypad and the non-digits filtered out keeps what is typed.
    const digitsOnly = field.kind === "number";
    const controlProps = {
      id,
      "aria-required": field.required ? true : undefined,
      ...invalidProps(id, ...(field.kind === "tel" || field.hint ? [`${id}-hint`] : [])),
      value: entityData[field.key] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setEntityField(
          field.key,
          digitsOnly ? e.target.value.replace(/\D/g, "") : e.target.value
        ),
    };

    // One choice among a few options: radio buttons in a fieldset named by
    // its legend, no option pre-selected (defect 19 of the 2026-10-16 VT run:
    // the promoter's sex was a two-option select). A select whose list is
    // short enough to read at a glance is shown the same way -- every answer
    // visible, one click -- and only a longer list stays a dropdown.
    const asRadios =
      field.kind === "radio" ||
      (field.kind === "select" &&
        !field.dropdown &&
        (field.options?.length ?? 0) <= MAX_RADIO_OPTIONS);
    if (asRadios) {
      // Two answers sit on one line; a longer list reads down the page.
      const inline = (field.options?.length ?? 0) <= 2;
      return (
        <fieldset
          key={field.key}
          id={id}
          className="field choice-fieldset"
          aria-required={field.required ? true : undefined}
          {...invalid}
        >
          <legend>
            {localized(field.label, locale)}
            {!field.required && <span className="field-optional-mark"> ({t("registerPage.optionalLabel")})</span>}
          </legend>
          <div className={inline ? "choice-list choice-list--inline" : "choice-list"}>
            {field.options?.map((o) => (
              <label key={o.value} className="choice-option">
                <input
                  type="radio"
                  name={id}
                  value={o.value}
                  checked={entityData[field.key] === o.value}
                  onChange={() => setEntityField(field.key, o.value)}
                />
                <span>{localized(o.label, locale)}</span>
              </label>
            ))}
          </div>
          {fieldErrorLine(id)}
        </fieldset>
      );
    }

    // A phone carries the same format hint and +237 prefix as the
    // respondent's own; any other field shows the hint its definition gives.
    const isTel = field.kind === "tel";
    const hint = isTel
      ? t("registerPage.phoneHint")
      : field.hint
        ? localized(field.hint, locale)
        : undefined;
    const hintId = hint ? `${id}-hint` : undefined;
    return (
      <FormRow
        key={field.key}
        htmlFor={id}
        label={localized(entityFieldLabel(field, entityData), locale)}
        required={field.required}
        optionalLabel={field.required ? undefined : t("registerPage.optionalLabel")}
        size={entityFieldSize(field)}
        hint={hint}
        hintId={hintId}
        error={fieldErrorLine(id)}
      >
        <div className={isTel ? "input-row input-row--phone" : "input-row"}>
          {isTel && (
            <span className="input-prefix" aria-hidden="true">+237</span>
          )}
          {field.kind === "year" ? (
            <select {...controlProps}>
              <BlankOption />
              {yearOptions(entityData[field.key]).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : field.kind === "branch" ? (
            // Disabled until a sector is chosen, like the department before
            // a region: the list is that sector's branches.
            <select {...controlProps} disabled={!entityData.activitySector}>
              <BlankOption label={selectStatusLabel(sectorsQuery, !entityData.activitySector)} />
              {branchesFor(sectorsQuery.data, entityData.activitySector, entityType).map((b) => (
                <option key={b.id} value={b.id}>
                  {sectorLabel(b, locale)}
                </option>
              ))}
            </select>
          ) : field.kind === "select" ? (
            <select {...controlProps}>
              {/* Keep required choices unanswered by default while omitting
                  the blank option from every opened dropdown in this wizard. */}
              <BlankOption />
              {field.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {localized(o.label, locale)}
                </option>
              ))}
            </select>
          ) : (
            <input
              {...controlProps}
              type={isTel ? "tel" : "text"}
              autoComplete={ENTITY_AUTOCOMPLETE[field.key] ?? "off"}
              inputMode={digitsOnly ? "numeric" : isTel ? "tel" : undefined}
            />
          )}
        </div>
        {field.kind === "branch" && loadRetry(sectorsQuery)}
      </FormRow>
    );
  }

  // An answer that is there but cannot be accepted, per section: the shape
  // checks isSectionComplete applies, put into words. Asked by Continuer once
  // nothing is missing, and by the submit pass, so the step and the final
  // check say the same thing. Null when the section has nothing to object to.
  function formatFailure(step: RegistrationStepId): { message: string; focusId: string } | null {
    switch (step) {
      case "respondent": {
        if (emailAvailable === false) {
          return { message: t("registerPage.errorEmailInUse"), focusId: "reg-email" };
        }
        if (respondent.email.trim() && !isPlausibleEmail(respondent.email)) {
          return { message: t("registerPage.errorEmailFormat"), focusId: "reg-email" };
        }
        // A phone that is given must be a Cameroonian number the declaration
        // wizards will accept (cameroon-phone.ts) -- optional ones included.
        for (const [focusId, value] of [
          ["reg-phone1", respondent.phone1],
          ["reg-phone2", respondent.phone2],
        ] as const) {
          if (value.trim() && !isValidCameroonPhone(value)) {
            return { message: t("registerPage.errorPhoneFormat"), focusId };
          }
        }
        return null;
      }
      case "entityInfo": {
        for (const field of config?.fields ?? []) {
          const value = entityData[field.key]?.trim();
          if (field.kind === "tel" && isFieldVisible(field) && value && !isValidCameroonPhone(value)) {
            return { message: t("registerPage.errorPhoneFormat"), focusId: `reg-entity-${field.key}` };
          }
        }
        return null;
      }
      case "location":
        // The server needs an arrondissement, and this department's list has
        // none. Focus goes to the department, the answer that can change.
        if (departmentId && !subdivisionId && subdivisionsStatus === "empty") {
          return { message: t("registerPage.errorNoSubdivision"), focusId: "reg-department" };
        }
        return null;
      case "security": {
        const code = validatePassword(password);
        if (code) return { message: t(PASSWORD_ERROR_KEY[code]), focusId: "reg-password" };
        if (password !== confirmPassword) {
          return { message: t("registerPage.errorPasswordMismatch"), focusId: "reg-confirm-password" };
        }
        return null;
      }
      default:
        return null;
    }
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
      ...(respondent.function === RESPONDENT_FUNCTION_OTHER
        ? [["reg-function-other", respondent.functionOther] as [string, string]]
        : []),
      ["reg-email", respondent.email],
      ["reg-phone1", respondent.phone1],
    ];
    for (const [focusId, value] of respondentFields) {
      if (!value.trim()) {
        return { index: respondentIndex, message: t("registerPage.errorRequiredFields"), focusId };
      }
    }
    const respondentFormat = formatFailure("respondent");
    if (respondentFormat) return { index: respondentIndex, ...respondentFormat };

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
      const entityFormat = formatFailure("entityInfo");
      if (entityFormat) return { index: STEPS.indexOf("entityInfo"), ...entityFormat };
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
    if (!subdivisionId) {
      const noList = formatFailure("location");
      return noList
        ? { index: locationIndex, ...noList }
        : { index: locationIndex, message: t("registerPage.errorSelectSubdivision"), focusId: "reg-subdivision" };
    }
    if (!area) {
      return { index: locationIndex, message: t("registerPage.errorSelectArea"), focusId: "reg-area" };
    }

    const securityIndex = STEPS.indexOf("security");
    const pwError = validatePassword(password);
    if (pwError) {
      return { index: securityIndex, message: t(PASSWORD_ERROR_KEY[pwError]), focusId: "reg-password" };
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
    requestAnimationFrame(() => {
      // The frame swaps to the failing section; put the page back to the top
      // so the error banner above the section is the first thing on screen,
      // then let focusing the control scroll the page the rest of the way if
      // the field sits below the fold.
      scrollPageTop();
      const control = failure.focusId ? document.getElementById(failure.focusId) : null;
      openDetailsAround(control);
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
      if (current < LAST_INDEX) tryContinue();
    }
  };

  const resolvedRegionName = regionName || regionsQuery.data?.find((r) => r.id === regionId)?.name;
  const resolvedDepartmentName = departmentName || departmentsQuery.data?.find((d) => d.id === departmentId)?.name;
  const resolvedSubdivisionName = subdivisionName || subdivisionsQuery.data?.find((s) => s.id === subdivisionId)?.name;
  const branchId = entityData.branchId ?? "";
  const pickedBranch = branchId ? sectorsQuery.data?.find((s) => s.id === branchId) : undefined;
  const resolvedBranchName = branchId ? pickedBranch?.name || branchName : "";
  const resolvedBranchNameEn = branchId ? pickedBranch?.nameEn || branchNameEn : "";

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
      const mainActivity = resolveMainActivity(visibleData, entityType);

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
        projectNature: visibleData.projectNature,
        mainMission: visibleData.mainMission,
        registrationNumber: visibleData.registrationNumber,
        // The branch is sent twice: the row's id (Company.sectorId) and its
        // French name (Company.branch), which pre-fills the form's « Branche
        // d'activité ». Neither for VT, which does not ask it.
        branch: visibleData.branchId ? resolvedBranchName || undefined : undefined,
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
        sectorId: visibleData.branchId || undefined,
        respondentFunction:
          respondent.function === RESPONDENT_FUNCTION_OTHER
            ? respondent.functionOther.trim()
            : respondent.function,
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
      // A refusal the server explains (an address already taken, a field it
      // rejects) is shown in its own words. A connection that never reached
      // it, a server error, or anything that is not an API answer at all is
      // said plainly instead, with what matters: nothing typed is lost.
      const explained = e instanceof ApiError && e.status >= 400 && e.status < 500;
      setSubmitError(explained ? e.message : t("registerPage.submitConnectionError"));
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
    branchName: resolvedBranchName,
    branchNameEn: resolvedBranchNameEn,
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
    // Trigger (d): a locked item is a question, not a dead end. The rail
    // renders it aria-disabled rather than disabled precisely so the click
    // lands here and can say WHY it is locked.
    if (index < 0 || index > reached) {
      promptMissing();
      return;
    }
    clearFlags();
    if (index !== current) headingFocusPendingRef.current = true;
    setCurrent(index);
    requestAnimationFrame(scrollPageTop);
  }

  // Move forward from `index`, revealing the next section if it was locked.
  function advanceFrom(index: number) {
    const next = Math.min(index + 1, LAST_INDEX);
    if (next === index) return;
    clearFlags();
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
      requestAnimationFrame(scrollPageTop);
      setSnackbar(t("registerPage.entityChangeSnackbar", { step: t("registerPage.stepEntityInfo") }));
      forceSaveRef.current = true;
    } else {
      // Changing type strands the previous type's answers in entityData —
      // drop the ones the new type does not declare so the respondent's
      // visible answers and the stored state agree. submit() filters again
      // via visibleEntityDataForType; this keeps state clean at the source
      // rather than relying on that alone.
      // A branch the new type is not offered goes too.
      setEntityData((prev) =>
        dropUnofferedBranch(pruneEntityDataForType(prev, next), sectorsQuery.data, next)
      );
    }
    setEntityType(next);
    // Each type has its own list of functions: a title the new type does not
    // offer is cleared, not left selected in a list that no longer shows it.
    setRespondent((prev) =>
      functionFitsEntityType(prev.function, next)
        ? prev
        : { ...prev, function: "", functionOther: "" },
    );
    setSubmitError(null);
  }

  // The portal's two declaration doors link here with the establishment kind
  // already chosen (/register?type=enterprise, ?type=vocationalTraining), so
  // step 1 does not ask again for what the visitor has just answered. The
  // value is read off the URL rather than through useSearchParams: it is
  // wanted once, after mount, exactly like the draft below, and
  // useSearchParams would put this whole page behind a Suspense boundary for
  // something no render reads. An absent or unrecognised value leaves step 1
  // untouched, so a stale or hand-edited link degrades to the normal flow.
  function applyEntityTypeFromLink() {
    const requested = new URLSearchParams(window.location.search).get("type");
    const match = ENTITY_TYPE_OPTIONS.find((option) => option.type === requested);
    if (match) applyEntityType(match.type, false);
  }

  // ── No auto-advance ────────────────────────────────────────────────────
  // A section never moves on by itself. Continuer (or Enter on the section's
  // last field) is the one way forward, so the page only changes when the
  // respondent asks for it. Moving on the moment a section looked complete,
  // or when its last field was left, pulled the form away from people who
  // were still correcting an optional answer.

  // A restored draft, or a second phone kept across an organisation-type
  // change, can already hold an optional answer before this section is on
  // screen. Open the disclosure so that answer is visible. Once the
  // respondent closes it, leave it closed until the organisation type
  // changes. `reached` is a dependency because the disclosure is not in the
  // document until the organisation step has been revealed.
  useEffect(() => {
    if (optionalTypeSeen.current !== entityType) {
      optionalTypeSeen.current = entityType;
      optionalClosedByUser.current = false;
    }
    if (!entityType || optionalClosedByUser.current) return;
    const filled = optionalEntityFields(entityType, entityData).some(
      (field) => (entityData[field.key] ?? "").trim() !== ""
    );
    const details = optionalDetailsRef.current;
    if (!filled || !details || details.open) return;
    details.open = true;
  }, [entityType, entityData, reached]);

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
    entityLabel: (field) => localized(entityFieldLabel(field, entityData), locale),
  };

  const currentStep = STEPS[current];
  const currentLastFieldId = lastFieldId(currentStep, entityType, entityData);

  // Re-derived every render from the values, never stored: a flagged field
  // loses its error line the moment it is filled, with nothing to clear.
  // These are the fields that say so under themselves -- see
  // missingFieldsToReport for why a cascade field waiting on its parent is
  // not one. Continuer asks the same question when it is clicked.
  const shownMissingIds = new Set(
    missingFieldsToReport(currentStep, regState, nameResolvers)
      .filter((f) => flaggedIds.includes(f.id))
      .map((f) => f.id)
  );

  // Shown while the control Continuer flagged is still the one at fault.
  const currentFormatFailure = formatFailure(currentStep);
  const shownFormatError =
    formatFlagId && currentFormatFailure?.focusId === formatFlagId ? currentFormatFailure : null;

  // The four triggers in item 11 all call this. Returns true when it actually
  // stopped something, so a caller can use it as a guard.
  function promptMissing(): boolean {
    const missing = missingFieldsToReport(currentStep, regState, nameResolvers);
    if (missing.length === 0) return false;
    setFlaggedIds(missing.map((f) => f.id));
    setMissingAnnounced(missing.length);
    requestAnimationFrame(() => focusField(missing[0].id));
    return true;
  }

  // Focuses a field by id and brings it into view. Used by promptMissing for
  // the first gap, and by the format notice's link.
  function focusField(id: string) {
    {
      const first = document.getElementById(id);
      openDetailsAround(first);
      // The type list's "field" is a <fieldset>, which carries the id but
      // cannot take focus, so the first radio stands in for it. Checking the
      // element kind rather than the id keeps this true if another group
      // field is ever added.
      const focusable =
        first instanceof HTMLInputElement ||
        first instanceof HTMLSelectElement ||
        first instanceof HTMLTextAreaElement
          ? first
          : first?.querySelector<HTMLInputElement>("input") ?? firstEntityRadioRef.current;
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
    if (missingAnnounced > 0) setMissingAnnounced(0);
    if (formatFlagId) setFormatFlagId(null);
    if (leftIds.length > 0) setLeftIds([]);
  }

  // Each missing field says so under itself, and the first takes focus. This
  // replaced a "Il y a un problème" box above the section that listed the
  // same fields again just over them (owner, 2026-10-21). A screen reader
  // hears the count once, from the status line at the top of the section.
  //
  // `describedBy` names the control's own hint or rules, kept beside the
  // error reference rather than overwritten by it.
  function invalidProps(id: string, ...describedBy: string[]) {
    const errorRef =
      shownFormatError?.focusId === id
        ? FORMAT_NOTICE_ID
        : fieldError(id)
          ? `${id}-error`
          : null;
    const ids = [errorRef, ...describedBy].filter(Boolean).join(" ");
    return {
      ...(errorRef ? { "aria-invalid": true as const } : {}),
      ...(ids ? { "aria-describedby": ids } : {}),
    };
  }

  // The format rule of one control, put into words: null when the answer is
  // empty (a missing answer is fieldError's business) or acceptable. The
  // same rules formatFailure applies when Continuer is pressed.
  function fieldFormatError(id: string): string | null {
    if (id === "reg-email") {
      const email = respondent.email.trim();
      return email && !isPlausibleEmail(email) ? t("registerPage.errorEmailFormat") : null;
    }
    const phone =
      id === "reg-phone1"
        ? respondent.phone1
        : id === "reg-phone2"
          ? respondent.phone2
          : id.startsWith("reg-entity-") &&
              config?.fields.some((f) => f.kind === "tel" && `reg-entity-${f.key}` === id)
            ? entityData[id.slice("reg-entity-".length)] ?? ""
            : null;
    if (phone === null || !phone.trim()) return null;
    return isValidCameroonPhone(phone) ? null : t("registerPage.errorPhoneFormat");
  }

  // Shown once the field has been left, never while it is first being typed.
  function leftFieldError(id: string): string | null {
    return leftIds.includes(id) ? fieldFormatError(id) : null;
  }

  function markLeft(id: string) {
    setLeftIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  // Picked, not typed: the location cascade, the function, the type list,
  // and every step-3 field that is not a text box.
  function isChoiceField(id: string): boolean {
    if (CHOICE_FIELD_IDS.has(id)) return true;
    const field = config?.fields.find((f) => `reg-entity-${f.key}` === id);
    return field ? ["select", "radio", "year", "branch"].includes(field.kind) : false;
  }

  // What a control says under itself: missing after Continuer, or left with
  // an answer in the wrong shape.
  function fieldError(id: string): string | null {
    if (shownMissingIds.has(id)) {
      return t(isChoiceField(id) ? "registerPage.missingChoiceError" : "registerPage.missingEntryError");
    }
    return leftFieldError(id);
  }

  // The line under the control. Its id is what invalidProps points the
  // control at.
  function fieldErrorLine(id: string) {
    const message = fieldError(id);
    return message ? (
      <p className="field-error" id={`${id}-error`}>
        {message}
      </p>
    ) : undefined;
  }

  // ── Continue ───────────────────────────────────────────────────────────
  // Shown at the bottom of the section whenever that section is the furthest
  // revealed one, complete or not. It stays a real button, with no
  // aria-disabled: that attribute hides the control from a screen reader and
  // from automation, and the click is how anyone learns which fields are
  // missing. Do not put aria-disabled back on Continuer. (Soumettre is a
  // different control and keeps it until the certification box is ticked.)
  //
  // It is the one way forward: no section moves on by itself.
  const showContinueLink = current < LAST_INDEX && current === reached;

  // Continuer, and Enter on a section's last field. Missing answers first
  // (the notice names them all), then an answer in the wrong shape, which
  // the step explains here rather than leaving it to Submit steps later.
  // On a section the respondent came back to, the same checks run before
  // moving on: going back to fix one answer must not be a way to leave
  // another one broken.
  function tryContinue() {
    if (promptMissing()) return;
    const failure = formatFailure(STEPS[current]);
    if (failure && !isSectionComplete(STEPS[current], regState)) {
      setFormatFlagId(failure.focusId);
      requestAnimationFrame(() => focusField(failure.focusId));
      return;
    }
    setSubmitError(null);
    if (showContinueLink) advanceFrom(current);
    else goToSection(current + 1);
  }

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

    /* eslint-disable react-hooks/set-state-in-effect -- see above */
    // No draft: a link may still say which kind of establishment this is.
    // A draft wins over the link — the respondent's own saved answer beats
    // a URL they followed, which may be a bookmark from another session.
    if (!draft) {
      applyEntityTypeFromLink();
      return;
    }

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
    setBranchName(draft.branchName);
    setBranchNameEn(draft.branchNameEn ?? "");

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
    // applyEntityTypeFromLink is redeclared every render, so listing it would
    // reschedule this effect each time; draftLoadedRef already makes the body
    // run exactly once, and it reads only the URL, which does not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
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
      branchName: resolvedBranchName,
      branchNameEn: resolvedBranchNameEn,
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
        setTimeout(() => setIdCopied(false), 3000);
      } catch {
        // Clipboard is unavailable over plain HTTP and in some locked-down
        // browsers. The ID stays on screen and selectable, so this is a
        // missing convenience, not a failure worth an alert.
        setIdCopied(false);
      }
    };

    return (
      <main className="cam-auth-page cam-auth-page--receipt">
        <div className="wrap" style={{ maxWidth: "560px", margin: "0 auto" }}>
          <AuthHeader />
          {/* Confirmation-page pattern (owner's decision, 2026-10-20): one
              solid panel with the title and the ID, the one value to keep.
              Every file has its ID at registration, so the wording follows
              the account status: only an active account is "complete". */}
          <div className="receipt-panel">
            <h1 className="receipt-panel-title" ref={receiptTitleRef} tabIndex={-1}>
              {isActive ? t("registerPage.successTitle") : t("registerPage.pendingTitle")}
            </h1>
            {establishmentId && (
              <>
                <p className="receipt-panel-label" id="receipt-id-label">
                  {t("registerPage.receiptEstablishmentIdLabel")}
                </p>
                <p className="receipt-panel-id" aria-labelledby="receipt-id-label">
                  {establishmentId}
                </p>
              </>
            )}
          </div>
          {establishmentId && (
            <p className="receipt-keep">
              {t("registerPage.receiptKeepIdNote")}{" "}
              <button type="button" className="receipt-link" onClick={copyEstablishmentId}>
                {idCopied ? t("registerPage.receiptIdCopied") : t("registerPage.receiptCopyId")}
              </button>
              <span className="sr-only" role="status">
                {idCopied ? t("registerPage.receiptIdCopied") : ""}
              </span>
            </p>
          )}

          <dl className="receipt-list">
            <div className="receipt-list-row">
              <dt>{t("registerPage.receiptCompanyLabel")}</dt>
              <dd>
                {result.companyName}
                {config && <span className="receipt-muted"> — {localized(config.title, locale)}</span>}
              </dd>
            </div>
            <div className="receipt-list-row">
              <dt>{t("registerPage.receiptRespondentLabel")}</dt>
              <dd>
                {respondent.firstName} {respondent.lastName}
                <br />
                <span className="receipt-muted">{respondent.email}</span>
              </dd>
            </div>
            <div className="receipt-list-row">
              <dt>{t("registerPage.receiptDateLabel")}</dt>
              <dd>
                {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(
                  result.registeredAt
                )}
              </dd>
            </div>
            <div className="receipt-list-row">
              <dt>{t("registerPage.receiptStatusLabel")}</dt>
              <dd>
                <span className={`receipt-tag ${isActive ? "receipt-tag--active" : "receipt-tag--pending"}`}>
                  {isActive ? t("registerPage.receiptStatusActive") : t("registerPage.receiptStatusPending")}
                </span>
              </dd>
            </div>
          </dl>

          <h2 className="receipt-next-title">{t("registerPage.receiptNextTitle")}</h2>
          <p className="receipt-next-body">
            {isActive
              ? t("registerPage.receiptActiveAttestationNote")
              : t("registerPage.receiptPendingNote", { email: respondent.email.trim() })}
          </p>

          {/* The one way forward, and a printed copy of the acknowledgement. */}
          <div className="receipt-actions">
            <Link
              href="/login"
              className="btn-primary"
              onClick={() => saveLoginIdentifier(respondent.email.trim())}
            >
              {isActive ? t("registerPage.signInLink") : t("registerPage.receiptFollowButton")}
            </Link>
            <button type="button" className="receipt-link" onClick={() => window.print()}>
              {t("registerPage.receiptPrint")}
            </button>
          </div>

          <div className="receipt-footer">
            <span>
              {t("loginPage.needHelpText")}{" "}
              <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
                {t("loginPage.whatsappLink")}
              </a>
            </span>
            <Link href="/">{t("common.backToPortal")}</Link>
          </div>

          {/* Printed in place of the browser's own header and footer (date,
              tab title, URL), which a zero page margin leaves no room for.
              Rendered with the receipt only, so other pages print as before. */}
          <p className="receipt-print-footer">
            {t("registerPage.receiptPrintFooter", {
              date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(printedAt),
            })}
          </p>
          <style>{"@media print { @page { margin: 0; } }"}</style>
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

            {/* The approval-wait notice is not here: before anything is
                answered it read as an obstacle, and it belongs where the
                respondent certifies and sends -- the review (owner,
                2026-10-15).

                As in the Flutter app (register_steps.dart StepEntityType):
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
                  />
                  <span className="entity-type-option-label">{t(option.labelKey)}</span>
                </label>
              ))}
              {fieldErrorLine("reg-entity-type")}
            </fieldset>
          </>
        );

      case "respondent":
        return (
          <>
            <StepHeader
              titleId="reg-section-title-respondent"
              title={t("registerPage.stepRespondent")}
              subtitle={t("registerPage.respondentSubtitle")}
            />

            <div className="form-single-column">
              <FormRow
                htmlFor="reg-first-name"
                label={t("registerPage.firstNameLabel")}
                required
                error={fieldErrorLine("reg-first-name")}
              >
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
                    autoComplete="given-name"
                    aria-required={true}
                    {...invalidProps("reg-first-name")}
                    value={respondent.firstName}
                    onChange={(e) => setRespondentField("firstName", e.target.value)}
                  />
                </div>
              </FormRow>

              <FormRow
                htmlFor="reg-last-name"
                label={t("registerPage.lastNameLabel")}
                required
                error={fieldErrorLine("reg-last-name")}
              >
                <div className="input-row">
                  <input
                    id="reg-last-name"
                    type="text"
                    autoComplete="family-name"
                    aria-required={true}
                    {...invalidProps("reg-last-name")}
                    value={respondent.lastName}
                    onChange={(e) => setRespondentField("lastName", e.target.value)}
                  />
                </div>
              </FormRow>

              <FormRow
                htmlFor="reg-function"
                label={t("registerPage.functionLabel")}
                required
                error={fieldErrorLine("reg-function")}
              >
                <div className="input-row">
                  <select
                    id="reg-function"
                    aria-required={true}
                    {...invalidProps("reg-function")}
                    value={respondent.function}
                    onChange={(e) => setRespondentField("function", e.target.value)}
                  >
                    <BlankOption />
                    {getRespondentFunctionOptions(entityType).map((o) => (
                      <option key={o.value} value={o.value}>
                        {localized(o.label, locale)}
                      </option>
                    ))}
                  </select>
                </div>
              </FormRow>

              {respondent.function === RESPONDENT_FUNCTION_OTHER && (
                <FormRow
                  htmlFor="reg-function-other"
                  label={t("registerPage.functionOtherLabel")}
                  required
                  error={fieldErrorLine("reg-function-other")}
                >
                  <div className="input-row">
                    <input
                      id="reg-function-other"
                      type="text"
                      aria-required={true}
                      {...invalidProps("reg-function-other")}
                      value={respondent.functionOther}
                      onChange={(e) => setRespondentField("functionOther", e.target.value)}
                    />
                  </div>
                </FormRow>
              )}

              <FormRow
                htmlFor="reg-email"
                label={t("registerPage.professionalEmailLabel")}
                required
                hint={t("registerPage.emailHint")}
                hintId="reg-email-hint"
                error={fieldErrorLine("reg-email")}
              >
                <div className="input-row">
                  <input
                    id="reg-email"
                    aria-required={true}
                    {...invalidProps("reg-email", "reg-email-hint")}
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={respondent.email}
                    onChange={(e) => setRespondentField("email", e.target.value)}
                  />
                </div>
                <div aria-live="polite" aria-atomic="true">
                  {emailAvailable === false && (
                    <span className="field-status is-error">
                      {t("registerPage.emailUnavailable")} {emailInUseActions}
                    </span>
                  )}
                  {emailAvailable === true && (
                    <span className="field-status is-ok">
                      ✓ {t("registerPage.emailAvailable")}
                    </span>
                  )}
                  {emailCheckFailed && (
                    <span className="field-status is-warn">
                      {t("registerPage.emailCheckFailed")}
                    </span>
                  )}
                </div>
              </FormRow>

              <FormRow
                htmlFor="reg-phone1"
                label={t("registerPage.phone1Label")}
                required
                size="short"
                hint={t("registerPage.phoneHint")}
                hintId="reg-phone1-hint"
                error={fieldErrorLine("reg-phone1")}
              >
                <div className="input-row input-row--phone">
                  <span className="input-prefix" aria-hidden="true">+237</span>
                  <input
                    id="reg-phone1"
                    aria-required={true}
                    {...invalidProps("reg-phone1", "reg-phone1-hint")}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={respondent.phone1}
                    onChange={(e) => setRespondentField("phone1", e.target.value)}
                  />
                </div>
              </FormRow>

              <FormRow
                htmlFor="reg-phone2"
                label={t("registerPage.phone2Label")}
                optionalLabel={t("registerPage.optionalLabel")}
                size="short"
                error={fieldErrorLine("reg-phone2")}
              >
                <div className="input-row input-row--phone">
                  <span className="input-prefix" aria-hidden="true">+237</span>
                  <input
                    id="reg-phone2"
                    type="tel"
                    inputMode="tel"
                    {...invalidProps("reg-phone2", "reg-phone1-hint")}
                    value={respondent.phone2}
                    onChange={(e) => setRespondentField("phone2", e.target.value)}
                  />
                </div>
              </FormRow>
            </div>
          </>
        );

      case "entityInfo": {
        if (!config || !entityType) return null;
        const optionalFields = optionalEntityFields(entityType, entityData);
        return (
          <>
            <StepHeader
              titleId="reg-section-title-entityInfo"
              title={t("registerPage.stepEntityInfo")}
              subtitle={localized(config.identification, locale)}
            />

            {/* Required groups first, then one closed disclosure for the
                optional fields. Continuer stays in the dock under this, so
                it follows the last required field while the disclosure is
                shut. lastEntityFieldKey reads the same order: required
                groups, then the optional list. */}
            <div className="form-single-column">
              {requiredEntityGroups(entityType, entityData).map((group) => (
                <Fragment key={group.title.fr}>
                  <h2 className="admin-section-header">
                    {localized(group.title, locale)}
                  </h2>
                  {group.fields.map(renderEntityField)}
                </Fragment>
              ))}
              {optionalFields.length > 0 && (
                <details
                  ref={optionalDetailsRef}
                  className="optional-details"
                  onToggle={(event) => {
                    if (!event.currentTarget.open) optionalClosedByUser.current = true;
                  }}
                >
                  <summary>{t("registerPage.optionalDetailsSummary")}</summary>
                  <div className="optional-details-fields">
                    {optionalFields.map(renderEntityField)}
                  </div>
                </details>
              )}
            </div>
          </>
        );
      }

      case "location":
        return (
          <>
            <StepHeader
              titleId="reg-section-title-location"
              title={t("registerPage.locationTitle")}
              subtitle={t("registerPage.locationSubtitle")}
            />

            <div className="form-single-column">
              {locationRow({
                id: "reg-region",
                label: t("registerPage.regionLabel"),
                query: regionsQuery,
                value: regionId,
                onSelect: (id, name) => {
                  // A new region invalidates the two fields below it. That
                  // already happened silently; now it says so, because a
                  // respondent who had answered them would otherwise find
                  // them blank with no explanation.
                  if (departmentId || subdivisionId) {
                    setSnackbar(t("registerPage.locationResetSnackbar"));
                  }
                  setRegionId(id);
                  setRegionName(name);
                  setDepartmentId("");
                  setDepartmentName("");
                  setSubdivisionId("");
                  setSubdivisionName("");
                },
              })}

              {locationRow({
                id: "reg-department",
                label: t("registerPage.departmentLabel"),
                query: departmentsQuery,
                value: departmentId,
                gatedBy: !regionId,
                onSelect: (id, name) => {
                  setDepartmentId(id);
                  setDepartmentName(name);
                  setSubdivisionId("");
                  setSubdivisionName("");
                },
              })}

              {locationRow({
                id: "reg-subdivision",
                label: t("registerPage.subdivisionLabel"),
                query: subdivisionsQuery,
                value: subdivisionId,
                gatedBy: !departmentId,
                // An arrondissement cannot be required of a department the
                // server has none for; the row says so instead of looking
                // like an empty dropdown the respondent failed to use.
                disabled: !departmentId || subdivisionsStatus === "empty",
                hint:
                  subdivisionsStatus === "empty"
                    ? t("registerPage.noSubdivisionHint")
                    : undefined,
                onSelect: (id, name) => {
                  setSubdivisionId(id);
                  setSubdivisionName(name);
                },
              })}

              {/* Two answers, one choice: radios, not a dropdown (CLAUDE.md
                  section 9). A fieldset named by its legend; the id the
                  missing-fields notice points at is the fieldset's, and
                  focusField moves focus to its first radio. Nothing is
                  pre-selected: unanswered stays unanswered. */}
              <fieldset
                id="reg-area"
                className="field choice-fieldset"
                aria-required={true}
                {...invalidProps("reg-area")}
              >
                <legend>
                  {t("registerPage.areaLabel")}
                </legend>
                <div className="choice-list choice-list--inline">
                  {AREA_OPTIONS.map((o) => (
                    <label key={o.value} className="choice-option">
                      <input
                        type="radio"
                        name="reg-area"
                        value={o.value}
                        checked={area === o.value}
                        onChange={() => {
                              setArea(o.value);
                        }}
                      />
                      <span>{localized(o.label, locale)}</span>
                    </label>
                  ))}
                </div>
                {fieldErrorLine("reg-area")}
              </fieldset>

            </div>
          </>
        );

      case "security":
        return (
          <>
            {/* After a restored draft, the half of the restore notice that
                belongs to this section takes the subtitle's place instead
                of a callout of its own: one line under the heading, not a
                ruled note stacked on top of the instruction. */}
            <StepHeader
              titleId="reg-section-title-security"
              title={t("registerPage.stepSecurity")}
              subtitle={
                draftRestored
                  ? t("registerPage.draftPasswordReminder")
                  : t("registerPage.securitySubtitle")
              }
            />

            <div className="form-single-column">
              <FormRow
                htmlFor="reg-password"
                label={t("registerPage.passwordLabel")}
                required
                error={fieldErrorLine("reg-password")}
              >
                <div className="input-row">
                  <input
                    id="reg-password"
                    aria-required={true}
                    // The rules, plus the error notice when this field is
                    // the one at fault.
                    {...invalidProps("reg-password", "reg-password-rules")}
                    type={obscurePassword ? "password" : "text"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
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
                      {t("registerPage.passwordStrengthPrefix")}{" "}
                      <strong>{t(PASSWORD_STRENGTH_KEY[passwordStrengthBand(pwScore)])}</strong>
                    </span>
                  </div>
                )}

                {/* What is still missing, said only while it is missing. */}
                <PasswordRequirementHint id="reg-password-rules" password={password} />
              </FormRow>

              <FormRow
                htmlFor="reg-confirm-password"
                label={t("registerPage.confirmPasswordLabel")}
                required
                error={fieldErrorLine("reg-confirm-password")}
              >
                <div className="input-row">
                  <input
                    id="reg-confirm-password"
                    aria-required={true}
                    {...invalidProps("reg-confirm-password")}
                    type={obscureConfirm ? "password" : "text"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                    }}
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

            {/* The same wait the first step states, repeated where the
                respondent certifies and sends. */}
            <p className="section-notice">{t("registerPage.approvalWaitNotice")}</p>

            {/* The certification, made once by ticking the box. The submit
                button it gates sits at the end of the frame, where every
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
  // An in-app navigation away from a part-filled form is confirmable; see
  // the dialog below. Every link out of the wizard goes through this,
  // including the masthead logo on narrow screens.
  const guardLeave = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!hasEnteredData) return;
    e.preventDefault();
    setLeaveTo(href);
  };

  // The two ways on from an address that already has an account, shown
  // beside "already in use" under the field and in the step's notice.
  const emailInUseActions = (
    <span className="field-status-actions">
      <Link href="/login" onClick={guardLeave("/login")}>
        {t("registerPage.emailInUseSignIn")}
      </Link>
      {" · "}
      <Link href="/forgot-password" onClick={guardLeave("/forgot-password")}>
        {t("registerPage.emailInUseReset")}
      </Link>
    </span>
  );

  // The one way out the wizard keeps at the foot: help (owner, 2026-10-15).
  // Signing in and the portal are one click away through the logo; the
  // language link sits beside the logo. The number is not printed: the link
  // opens the WhatsApp conversation, and its accessible name says so.
  const helpLink = (
    <a
      className="flow-help-link"
      href="https://wa.me/237651965905"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("registerPage.helpLinkAria")}
    >
      {t("loginPage.needHelpText")}
    </a>
  );

  // One frame, one section, one scrollbar -- the page's own.
  //
  // Owner's decision, 2026-10-10: the DOCUMENT scrolls, never a region inside
  // the frame (CLAUDE.md section 13). At every width the page is a column:
  // the header that carries the logo and the rail, the body holding the
  // frame, and a one-line footer. On a wide screen the header is one row,
  // pinned, and the form scrolls under it (owner, 2026-10-22: it replaced
  // the dossier side panel). A long section makes the page longer. Retour and Continuer
  // stay at the end of the frame, not pinned (owner, 2026-10-10).
  //
  // Every revealed section stays MOUNTED and is merely hidden: a section the
  // respondent has left keeps its state and its in-flight requests, and the
  // email-availability check running when they moved on still lands.
  return (
    <main className="cam-auth-page cam-auth-page--wizard">
      {/* The logo and the rail. Scrolls away on a narrow screen; pinned on a
          wide one (globals.css). */}
      <header className="flow-header">
        <div className="flow-header-inner">
          <AuthHeader onHomeClick={guardLeave("/")} />
          <RegistrationProgress
            currentIndex={current}
            reached={reached}
            completed={completed}
            summaries={railSummaries}
            onSelect={goToSection}
          />
        </div>
      </header>

      {/* The step announcement, outside the rail: the rail's caption is
          aria-hidden, and this live region is what says the step changed.
          Visually hidden, so it is in the tree at every width. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t("registerPage.stepIndicator", { current: current + 1, total: STEPS.length })}
        {" — "}
        {t(`registerPage.${REGISTRATION_STEPS[current].labelKey}`)}
      </p>

      <div className="flow-split">
        <div className="flow-body">
          {/* The frame: the section and its buttons, in one column. */}
          <div className="flow-frame">
            <div className="flow-frame-content">
              {/* Reset and restore notices. Announced, because the change they
                  report happened somewhere the respondent may not be looking. */}
              <div className="wizard-snackbar-region" role="status" aria-live="polite">
                {snackbar && <div className="wizard-snackbar">{snackbar}</div>}
              </div>

              {/* No box for missing fields: each one says so under itself
                  (fieldError). This line gives a screen reader the count once,
                  when Continuer is pressed; nothing is shown. */}
              <p className="sr-only" role="status" aria-live="polite">
                {missingAnnounced > 0 &&
                  shownMissingIds.size > 0 &&
                  t("registerPage.missingFieldsAnnounce", { count: missingAnnounced })}
              </p>

              {shownFormatError && (
                <div
                  className="flow-missing-notice"
                  id={FORMAT_NOTICE_ID}
                  role="alert"
                  aria-labelledby={`${FORMAT_NOTICE_ID}-title`}
                >
                  <h2 className="flow-missing-notice-title" id={`${FORMAT_NOTICE_ID}-title`}>
                    {t("registerPage.errorSummaryTitle")}
                  </h2>
                  <ul>
                    <li>
                      <a
                        href={`#${shownFormatError.focusId}`}
                        onClick={(e) => {
                          e.preventDefault();
                          focusField(shownFormatError.focusId);
                        }}
                      >
                        {shownFormatError.message}
                      </a>
                      {/* A taken address is not a typo: the way on is the
                          account that already has it. */}
                      {shownFormatError.focusId === "reg-email" && emailAvailable === false && (
                        <> {emailInUseActions}</>
                      )}
                    </li>
                  </ul>
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
                    onBlurCapture={(e) => {
                      if (idx !== current) return;
                      const target = e.target as HTMLElement;
                      // Any control left with an answer in the wrong shape
                      // says so under itself from now on (leftFieldError).
                      if (target.id && isFormField(target)) markLeft(target.id);
                      if (!currentLastFieldId) return;
                      if (target.id !== currentLastFieldId) return;
                      const next = e.relatedTarget as HTMLElement | null;
                      if (!next) return;
                      // The frame footer's Retour and Continuer are in the
                      // dock below the content, outside this <section> in
                      // the DOM, but they are still this section's own
                      // controls: Continuer runs its own check, and a
                      // respondent heading for Retour must not be stopped.
                      if (
                        e.currentTarget.contains(next) ||
                        next.closest("[data-flow-back]") ||
                        next.closest("[data-flow-continue]")
                      ) {
                        return;
                      }
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
                    // No aria-disabled and no disabled attribute. Either one
                    // swallows the click, and the click is how the respondent
                    // asks what is missing. A screen reader must be able to
                    // reach this button too.
                    onClick={tryContinue}
                  >
                    {t("registerPage.continueButton")}
                    <span aria-hidden="true">→</span>
                  </button>
                )}
                {/* Soumettre: the review's primary action, in the same place
                    as Continuer on every other step. aria-disabled until the
                    box is ticked, so a screen reader does not offer a submit
                    the click would only refuse. Continuer does not use
                    aria-disabled; do not copy this attribute onto it.
                    Truly disabled only while in flight. */}
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
      <div className="flow-footer">{helpLink}</div>

      {/* Entity-type change confirmation. Only raised when there is
          something to lose: with step 3 still empty the type switches
          silently. Cancel keeps the old type and its data: the radio is
          controlled by `entityType`, which nothing has changed yet. */}
      {pendingEntityType && (
        <ConfirmDialog
          id="reg-entity-change"
          title={t("registerPage.entityChangeTitle")}
          body={t("registerPage.entityChangeBody")}
          cancelLabel={t("registerPage.entityChangeCancel")}
          confirmLabel={t("registerPage.entityChangeConfirm")}
          onCancel={() => setPendingEntityType(null)}
          onConfirm={() => {
            const next = pendingEntityType;
            setPendingEntityType(null);
            applyEntityType(next, true);
          }}
        />
      )}

      {/* Leave confirmation. Only reachable with data entered, and only for
          navigation that happens inside the app -- a real browser unload
          cannot carry custom wording, so beforeunload shows the browser's own
          dialog instead (see the effect above). */}
      {leaveTo && (
        <ConfirmDialog
          id="reg-leave"
          title={t("registerPage.leaveTitle")}
          body={t("registerPage.leaveBody")}
          cancelLabel={t("registerPage.leaveCancel")}
          confirmLabel={t("registerPage.leaveConfirm")}
          onCancel={() => setLeaveTo(null)}
          onConfirm={() => {
            const href = leaveTo;
            setLeaveTo(null);
            router.push(href);
          }}
        />
      )}
    </main>
  );
}
