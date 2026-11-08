"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { DIRECTORY_ROLES } from "@/lib/roles";
import {
  ENTITY_CONFIGS,
  isFieldVisible,
  pruneEntityDataForType,
  yearOptions,
  type EntityField,
  type EntityType,
} from "@/lib/register-constants";
import { asUiLocale, localized, type UiLocale } from "@/lib/register-i18n";
import { dateForCalendar, dateFromCalendar } from "@/lib/register-date";
import { branchesFor, dropUnofferedBranch, type BranchRow } from "@/lib/register-activity";
import { getSectors } from "@/lib/api-client";
import { sectorLabel } from "@/lib/display-labels";
import {
  useTerritoryDepartments,
  useTerritoryRegions,
  useTerritorySubdivisions,
} from "@/hooks/useTerritoryStructure";
import {
  adminRegisterCompany,
  buildAssistedRegistrationPayload,
  isValidSocialCapital,
  registrationTerritoryChoice,
  type AssistedRegistrationResult,
} from "@/lib/inscriptions";
import { useEmailAvailability } from "@/lib/use-email-availability";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { UnsavedNavigationGuard } from "@/components/auth/UnsavedNavigationGuard";
import { DataState } from "@/components/admin/DataState";
import { formatApiError } from "@/lib/pilotage-targets";
import { isValidCameroonPhone, normalizeCameroonPhone } from "@/lib/cameroon-phone";
import { RESPONDENT_FUNCTION_OTHER, functionFitsEntityType, getRespondentFunctionOptions } from "@/lib/register-options";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Organisation types in the order offered, with the public wizard's labels.
// Those avoid administrative codes (CTD/ONG/CFP) that ENTITY_CONFIGS titles
// carry; the two ambiguous types get the same short hint.
const ENTITY_OPTIONS: readonly { type: EntityType; labelKey: string; hintKey?: string }[] = [
  { type: "enterprise", labelKey: "registerPage.entityOptionEnterprise" },
  { type: "cooperative", labelKey: "registerPage.entityOptionCooperative" },
  { type: "ctd", labelKey: "registerPage.entityOptionCtd", hintKey: "registerPage.entityOptionCtdHint" },
  { type: "ong", labelKey: "registerPage.entityOptionOng" },
  {
    type: "administration",
    labelKey: "registerPage.entityOptionAdministration",
    hintKey: "registerPage.entityOptionAdministrationHint",
  },
  { type: "projectProgram", labelKey: "registerPage.entityOptionProjectProgram" },
  { type: "vocationalTraining", labelKey: "registerPage.entityOptionVocationalTraining" },
];

/**
 * The respondent block — the person the admin actually spoke to.
 *
 * Mirrors the register wizard's "respondent" step rather than re-deriving it:
 * the backend reads respondentFirstName/LastName as the account holder's name
 * and falls back to firstName/lastName, so both are sent from these fields.
 */
interface Respondent {
  firstName: string;
  lastName: string;
  email: string;
  /** A value of the public form's list for the chosen type, or « Autre ». */
  function: string;
  /** The typed title that goes with « Autre ». */
  functionOther: string;
  phone1: string;
  phone2: string;
}

const EMPTY_RESPONDENT: Respondent = {
  firstName: "",
  lastName: "",
  email: "",
  function: "",
  functionOther: "",
  phone1: "",
  phone2: "",
};

/** One unmet requirement: the field it belongs to and what to say under it. */
interface Problem {
  id: string;
  message: string;
}

/** Ids of the fields, so the error summary can link to each one. */
const FIELD_ID = {
  entityType: "assisted-entity-type",
  firstName: "assisted-first-name",
  lastName: "assisted-last-name",
  email: "assisted-email",
  function: "assisted-function",
  functionOther: "assisted-function-other",
  phone1: "assisted-phone1",
  phone2: "assisted-phone2",
  region: "assisted-region",
  department: "assisted-department",
  subdivision: "assisted-subdivision",
} as const;
const entityFieldId = (key: string) => `assisted-entity-${key}`;

export default function NouvelleInscriptionPage() {
  const { isLoading, forbidden, user } = useAdminScreenGuard(DIRECTORY_ROLES);
  const t = useTranslations();
  useEffect(() => {
    document.title = `${t("adminInscriptionsNouvellePage.title")} | CAMLEAP`;
  }, [t]);
  // The console locale (NEXT_LOCALE cookie, set from the sidebar switcher).
  // EntityConfig labels are {fr, en} data and are read in it too.
  const locale = asUiLocale(useLocale());

  // A territorial admin registers inside its own ressort. What it may still
  // choose differs by level, and follows what the server allows rather than
  // what its own posting names:
  //
  //   national         picks the region and the department;
  //   REGIONAL_ADMIN   has its region fixed and picks any department of it --
  //                    assertTerritorialAuthority admits the whole region,
  //                    and resolveStaffTerritory requires such an account's
  //                    department to be NULL, so locking the field to the
  //                    account's own department left the form unsubmittable;
  //   DIVISIONAL_ADMIN has both fixed by its posting.
  //
  // The server refuses anything outside the actor's ressort regardless of
  // what these pickers allow, so this is convenience only.
  const { choosesRegion, choosesDepartment } = registrationTerritoryChoice(user?.role);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [entityData, setEntityData] = useState<Record<string, string>>({});
  const [respondent, setRespondent] = useState<Respondent>(EMPTY_RESPONDENT);
  // Same debounced check as the public wizard; blocks submit when taken.
  const emailAvailable = useEmailAvailability(respondent.email);
  // Only the chooseable half is state. A fixed region or department is read
  // from `user` on every render instead of seeded into state: the auth store
  // starts at "loading" with no user, so a state initialiser -- which runs on
  // the first render only -- kept the empty string for the whole session on a
  // cold load, and the field stayed blank for the admin it was prefilled for.
  const [chosenRegion, setChosenRegion] = useState("");
  const [chosenDepartment, setChosenDepartment] = useState("");
  const region = choosesRegion ? chosenRegion : user?.region ?? "";
  const department = choosesDepartment ? chosenDepartment : user?.department ?? "";
  const [subdivision, setSubdivision] = useState("");
  // A refusal from the server (one message), and whether the officer has
  // tried to submit: field errors show from then on and follow the input.
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Bumped on every failed submit, so the same summary repeated still moves
  // focus back to it.
  const [errorAttempt, setErrorAttempt] = useState(0);
  function reportError(message: string | null) {
    setError(message);
    setErrorAttempt((n) => n + 1);
  }
  const [result, setResult] = useState<AssistedRegistrationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [credentialsAcknowledged, setCredentialsAcknowledged] = useState(false);
  const formHasUnsavedChanges = !result && (
    Boolean(entityType)
    || Object.values(entityData).some((value) => value.trim() !== "")
    || Object.values(respondent).some((value) => value.trim() !== "")
    || Boolean(subdivision)
    // Both are empty until the admin picks one, whatever its level: a fixed
    // region or department is not state and was never typed here.
    || Boolean(chosenRegion || chosenDepartment)
  );
  const credentialsAtRisk = Boolean(result) && !credentialsAcknowledged;
  const hasUnsavedChanges = formHasUnsavedChanges || credentialsAtRisk;

  const queryClient = useQueryClient();
  // The branches of activity (the `sectors` table), the same list and query
  // key as the public wizard.
  const sectorsQuery = useQuery({ queryKey: ["sectors"], queryFn: getSectors });
  const territoryQuery = useTerritoryRegions();
  const { regions } = territoryQuery;
  const { departments } = useTerritoryDepartments(region || null);
  const { subdivisions } = useTerritorySubdivisions(department || null, region || null);

  const config = entityType ? ENTITY_CONFIGS[entityType] : null;
  const sectorLookupRequired = Boolean(config?.fields.some((field) => field.kind === "branch"));
  const territoryLookupReady = regions.length > 0;
  const sectorLookupReady = !sectorLookupRequired || Boolean(sectorsQuery.data?.length);
  const requiredLookupsReady = territoryLookupReady && sectorLookupReady;
  const territoryLookupState = !territoryQuery.data && territoryQuery.isPending
    ? "loading"
    : territoryQuery.isError
      ? "error"
      : !territoryLookupReady
        ? "empty"
        : "ready";
  const sectorLookupState = !sectorsQuery.data && sectorsQuery.isPending
    ? "loading"
    : sectorsQuery.isError
      ? "error"
      : !sectorsQuery.data?.length
        ? "empty"
        : "ready";
  const visibleFields = useMemo(
    () => (config ? config.fields.filter((f) => isFieldVisible(f, entityData, config.fields)) : []),
    [config, entityData],
  );

  const mutation = useMutation({
    mutationFn: adminRegisterCompany,
    onSuccess: (data) => {
      setResult(data);
      setCredentialsAcknowledged(false);
      setError(null);
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: ["auth", "company-registrations"] });
    },
    onError: (e: unknown) => reportError(formatApiError(e, locale)),
  });

  // The error summary sits at the top of the form (government-form
  // convention). A failed submit moves focus to it, which also scrolls it into
  // view, so the message is never left off-screen above the submit button.
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errorAttempt > 0) errorRef.current?.focus();
  }, [errorAttempt]);

  function chooseEntityType(next: EntityType) {
    setEntityType(next);
    // A function the new type's list does not offer is cleared, as on the public form.
    setRespondent((current) => functionFitsEntityType(current.function, next) ? current : { ...current, function: "", functionOther: "" });
    // Fields the new type does not declare are dropped, so a half-filled form
    // cannot smuggle another type's answers into the payload.
    setEntityData((current) =>
      dropUnofferedBranch(pruneEntityDataForType(current, next), sectorsQuery.data, next),
    );
  }

  function setField(key: string, value: string) {
    // A new sector drops a branch that belongs to another one.
    setEntityData((current) =>
      dropUnofferedBranch({ ...current, [key]: value }, sectorsQuery.data, entityType),
    );
  }

  function resetForm() {
    setEntityType(null);
    setEntityData({});
    setRespondent(EMPTY_RESPONDENT);
    setChosenRegion("");
    setChosenDepartment("");
    setSubdivision("");
    setError(null);
    setSubmitAttempted(false);
    setResult(null);
    setCopied(false);
    setCredentialsAcknowledged(false);
  }

  function closeResult() {
    if (!credentialsAcknowledged) return;
    resetForm();
  }

  /**
   * Every unmet requirement, in the order of the form (audit N-1): each one
   * is said under its field and listed in the summary at the top. The rules
   * are the public form's (audit N-3): a function from the list, a valid
   * Cameroonian phone for the respondent.
   */
  function problems(): Problem[] {
    if (!requiredLookupsReady) return [];
    const list: Problem[] = [];
    const required = (id: string, label: string, value: string) => {
      if (!value.trim()) list.push({ id, message: t("adminInscriptionsNouvellePage.errorFieldRequired", { field: label }) });
    };
    if (!entityType || !config) list.push({ id: FIELD_ID.entityType, message: t("adminInscriptionsNouvellePage.errorEntityTypeRequired") });
    required(FIELD_ID.firstName, t("registerPage.firstNameLabel"), respondent.firstName);
    required(FIELD_ID.lastName, t("registerPage.lastNameLabel"), respondent.lastName);
    if (!respondent.email.trim()) list.push({ id: FIELD_ID.email, message: t("adminInscriptionsNouvellePage.errorEmailRequired") });
    else if (emailAvailable === false) list.push({ id: FIELD_ID.email, message: t("adminInscriptionsNouvellePage.errorEmailInUse") });
    required(FIELD_ID.function, t("registerPage.functionLabel"), respondent.function);
    if (respondent.function === RESPONDENT_FUNCTION_OTHER) required(FIELD_ID.functionOther, t("registerPage.functionOtherLabel"), respondent.functionOther);
    if (!respondent.phone1.trim()) list.push({ id: FIELD_ID.phone1, message: t("registerPage.errorPhoneRequired") });
    else if (!isValidCameroonPhone(respondent.phone1)) list.push({ id: FIELD_ID.phone1, message: t("registerPage.errorPhoneFormat") });
    if (respondent.phone2.trim() && !isValidCameroonPhone(respondent.phone2)) list.push({ id: FIELD_ID.phone2, message: t("registerPage.errorPhoneFormat") });
    for (const field of visibleFields) {
      const value = entityData[field.key] ?? "";
      if (field.required && !value.trim()) {
        list.push({ id: entityFieldId(field.key), message: t("adminInscriptionsNouvellePage.errorFieldRequired", { field: localized(field.label, locale) }) });
      } else if (field.kind === "tel" && value.trim() && !isValidCameroonPhone(value)) {
        list.push({ id: entityFieldId(field.key), message: t("registerPage.errorPhoneFormat") });
      }
    }
    if (config && !isValidSocialCapital(entityData.socialCapital)) {
      list.push({ id: entityFieldId("socialCapital"), message: t("adminInscriptionsNouvellePage.errorSocialCapitalInteger") });
    }
    if (choosesRegion) required(FIELD_ID.region, t("registerPage.regionLabel"), region);
    if (choosesDepartment) required(FIELD_ID.department, t("registerPage.departmentLabel"), department);
    required(FIELD_ID.subdivision, t("registerPage.subdivisionLabel"), subdivision);
    return list;
  }

  function submit() {
    if (!requiredLookupsReady) return;
    const list = problems();
    setSubmitAttempted(true);
    if (list.length > 0 || !entityType) {
      reportError(null);
      return;
    }
    // Hidden dependent fields must not reach the payload — the same gate the
    // public wizard applies (visibleEntityDataForType). Phones are stored
    // normalized, as the public form stores them.
    const phoneData = Object.fromEntries(visibleFields
      .filter((field) => field.kind === "tel" && entityData[field.key]?.trim())
      .map((field) => [field.key, normalizeCameroonPhone(entityData[field.key])]));
    mutation.mutate(
      buildAssistedRegistrationPayload({
        entityType,
        entityData: { ...entityData, ...phoneData },
        respondent: {
          ...respondent,
          function: respondent.function === RESPONDENT_FUNCTION_OTHER ? respondent.functionOther.trim() : respondent.function,
          phone1: normalizeCameroonPhone(respondent.phone1),
          phone2: respondent.phone2.trim() ? normalizeCameroonPhone(respondent.phone2) : "",
        },
        region,
        department,
        subdivision,
        branchName: entityData.branchId
          ? sectorsQuery.data?.find((b) => b.id === entityData.branchId)?.name
          : undefined,
      }),
    );
  }

  async function copyPassword() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
    } catch {
      // Clipboard is unavailable over plain HTTP and in some locked-down
      // browsers. The password stays on screen to be read out, so this is a
      // missing convenience, not a failure worth an alert.
      setCopied(false);
    }
  }

  if (isLoading || forbidden) {
    return (
      <div className="cam-admin-page">
        <AdminPageHeader
          breadcrumb={[
            { label: t("adminNav.hubs.inscriptions") },
            { label: t("adminNav.routes.inscriptions"), href: "/admin/inscriptions" },
            { label: t("adminNav.routes.nouvelleInscription") },
          ]}
          title={t("adminInscriptionsNouvellePage.title")}
          backHref="/admin/inscriptions"
        />
        <DataState
          state={isLoading ? "loading" : "forbidden"}
          resource={t("adminNav.routes.nouvelleInscription")}
          title={isLoading ? t("common.loading") : t("adminInscriptionsNouvellePage.accessDeniedMessage")}
        />
      </div>
    );
  }

  const entityOption = entityType ? ENTITY_OPTIONS.find((option) => option.type === entityType) : undefined;
  const selectPlaceholder = t("adminInscriptionsNouvellePage.selectPlaceholder");
  const currentProblems = problems();
  // Field errors show once a submit was tried, and follow the input from then on.
  const fieldError = (id: string) => (submitAttempted ? currentProblems.find((problem) => problem.id === id)?.message : undefined);
  const hasProblemIn = (ids: readonly string[]) => currentProblems.some((problem) => ids.includes(problem.id));
  const respondentIds = [FIELD_ID.firstName, FIELD_ID.lastName, FIELD_ID.email, FIELD_ID.function, FIELD_ID.functionOther, FIELD_ID.phone1, FIELD_ID.phone2];
  // Same order as the public form (audit N-3): type, respondent, organisation, location.
  const registrationSteps = [
    { id: "registration-step-entity", label: t("adminInscriptionsNouvellePage.stepEntity"), done: !!entityType && !!config },
    {
      id: "registration-step-respondent",
      label: t("adminInscriptionsNouvellePage.stepRespondent"),
      done: !!entityType && !hasProblemIn(respondentIds),
    },
    {
      id: "registration-step-identification",
      label: t("adminInscriptionsNouvellePage.stepIdentification"),
      done: !!config && !currentProblems.some((problem) => problem.id.startsWith("assisted-entity-") && problem.id !== FIELD_ID.entityType),
    },
    { id: "registration-step-location", label: t("adminInscriptionsNouvellePage.stepLocation"), done: !!region && !!department && !!subdivision },
  ];
  // The action bar says what is left, so a refused submit is never the first news.
  const stepsDone = registrationSteps.filter((step) => step.done).length;

  return (
    <div className="cam-admin-page cam-assisted-registration-page">
      <AdminPageHeader
        breadcrumb={[
          { label: t("adminNav.hubs.inscriptions") },
          { label: t("adminNav.routes.inscriptions"), href: "/admin/inscriptions" },
          { label: t("adminNav.routes.nouvelleInscription") },
        ]}
        title={t("adminInscriptionsNouvellePage.title")}
        backHref="/admin/inscriptions"
      />

      <p className="cam-admin-lede cam-assisted-registration-lede">{t("adminInscriptionsNouvellePage.lede")}</p>

      <div className="cam-record-form-layout">
      <nav className="cam-registration-steps" aria-label={t("adminInscriptionsNouvellePage.stepsAriaLabel")}>
        <ol>
          {registrationSteps.map(({ id, label, done }, index) => (
            <li key={id} data-done={done || undefined}>
              <a href={`#${id}`}>
                <span className="cam-registration-step-number" aria-hidden="true">{done ? "✓" : index + 1}</span>
                <span>{label}{done && <span className="cam-sr-only"> {t("adminInscriptionsNouvellePage.stepDoneLabel")}</span>}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>


      {/* noValidate: the form's own summary and field messages replace the
          browser's one-at-a-time bubbles (audit N-1). */}
      <form
        noValidate
        className="cam-assisted-registration-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {/* Error summary (government-form convention): every problem, each a
            link to its field; the same text is said under the field. */}
        {(error || (submitAttempted && currentProblems.length > 0)) && (
          <Alert ref={errorRef} tabIndex={-1} variant="destructive" className="cam-assisted-error-summary mb-6">
            <AlertDescription>
              {error ? <p>{error}</p> : <>
                <p className="font-semibold">{t("adminInscriptionsNouvellePage.errorSummaryTitle", { count: currentProblems.length })}</p>
                <ul>
                  {currentProblems.map((problem) => (
                    <li key={`${problem.id}-${problem.message}`}>
                      <a href={`#${problem.id}`} onClick={(event) => { event.preventDefault(); const target = document.getElementById(problem.id); target?.focus(); target?.scrollIntoView({ block: "center" }); }}>{problem.message}</a>
                    </li>
                  ))}
                </ul>
              </>}
            </AlertDescription>
          </Alert>
        )}
        <Section id="registration-step-entity" step={1} title={t("adminInscriptionsNouvellePage.entityTypeTitle")} description={t("adminInscriptionsNouvellePage.entityTypeDescription")}>
          {/* A plain list of radios, as on the public form (audit N-2; §9: no boxed options). */}
          <fieldset className="cam-assisted-choice-list" aria-describedby={fieldError(FIELD_ID.entityType) ? `${FIELD_ID.entityType}-error` : undefined}>
            <legend className="cam-sr-only">{t("adminInscriptionsNouvellePage.entityTypeTitle")}</legend>
            {ENTITY_OPTIONS.map(({ type, labelKey, hintKey }, index) => (
              <label key={type} className="cam-assisted-choice">
                <input
                  type="radio"
                  name="assisted-entity-type"
                  id={index === 0 ? FIELD_ID.entityType : `entity-${type}`}
                  value={type}
                  checked={entityType === type}
                  onChange={() => chooseEntityType(type)}
                />
                <span><span className="cam-assisted-choice-label">{t(labelKey)}</span>{hintKey && <span className="cam-assisted-choice-hint">{t(hintKey)}</span>}</span>
              </label>
            ))}
            <FieldError id={`${FIELD_ID.entityType}-error`} message={fieldError(FIELD_ID.entityType)} />
          </fieldset>
        </Section>

        <Section id="registration-step-respondent" step={2} title={t("registerPage.respondentTitle")} description={t("adminInscriptionsNouvellePage.respondentDescription")}>
          <FieldGrid>
            <Text id={FIELD_ID.firstName} error={fieldError(FIELD_ID.firstName)} label={t("registerPage.firstNameLabel")} required value={respondent.firstName} onChange={(v) => setRespondent((r) => ({ ...r, firstName: v }))} />
            <Text id={FIELD_ID.lastName} error={fieldError(FIELD_ID.lastName)} label={t("registerPage.lastNameLabel")} required value={respondent.lastName} onChange={(v) => setRespondent((r) => ({ ...r, lastName: v }))} />
            <NativeSelect
              id={FIELD_ID.function}
              error={fieldError(FIELD_ID.function)}
              label={t("registerPage.functionLabel")}
              placeholder={selectPlaceholder}
              required
              value={respondent.function}
              options={getRespondentFunctionOptions(entityType).map((option) => ({ value: option.value, label: localized(option.label, locale) }))}
              onChange={(v) => setRespondent((r) => ({ ...r, function: v, functionOther: v === RESPONDENT_FUNCTION_OTHER ? r.functionOther : "" }))}
            />
            {respondent.function === RESPONDENT_FUNCTION_OTHER && (
              <Text id={FIELD_ID.functionOther} error={fieldError(FIELD_ID.functionOther)} label={t("registerPage.functionOtherLabel")} required value={respondent.functionOther} onChange={(v) => setRespondent((r) => ({ ...r, functionOther: v }))} />
            )}
            <Text id={FIELD_ID.email} error={fieldError(FIELD_ID.email)} label={t("adminInscriptionsNouvellePage.emailLabel")} required type="email" value={respondent.email} onChange={(v) => setRespondent((r) => ({ ...r, email: v }))}
              hint={t("adminInscriptionsNouvellePage.emailRoleHint")}
              after={
                <span aria-live="polite" aria-atomic="true">
                  {emailAvailable === false && <span className="field-status is-error">⚠ {t("registerPage.emailUnavailable")}</span>}
                  {emailAvailable === true && <span className="field-status is-ok">✓ {t("registerPage.emailAvailable")}</span>}
                </span>
              }
            />
            <Text id={FIELD_ID.phone1} error={fieldError(FIELD_ID.phone1)} label={t("adminInscriptionsNouvellePage.phone1Label")} required type="tel" hint={t("registerPage.phoneHint")} value={respondent.phone1} onChange={(v) => setRespondent((r) => ({ ...r, phone1: v }))} />
            <Text id={FIELD_ID.phone2} error={fieldError(FIELD_ID.phone2)} label={t("registerPage.phone2Label")} type="tel" hint={t("registerPage.phoneHint")} value={respondent.phone2} onChange={(v) => setRespondent((r) => ({ ...r, phone2: v }))} />
          </FieldGrid>
        </Section>

        <Section
          id="registration-step-identification"
          step={3}
          title={config
            ? t("adminInscriptionsNouvellePage.identificationTitle", {
                entityType: entityOption ? t(entityOption.labelKey) : localized(config.title, locale),
              })
            : t("adminInscriptionsNouvellePage.identificationStepTitle")}
          description={t(config ? "adminInscriptionsNouvellePage.identificationDescription" : "adminInscriptionsNouvellePage.chooseEntityFirst")}
        >
          {config ? <>
            {sectorLookupState !== "ready" && sectorLookupRequired && (
              <DataState
                state={sectorLookupState}
                resource={t("adminInscriptionsNouvellePage.sectorLookupResource")}
                title={sectorLookupState === "loading"
                  ? t("adminInscriptionsNouvellePage.sectorLookupLoading")
                  : sectorLookupState === "error"
                    ? t("adminInscriptionsNouvellePage.sectorLookupError")
                    : t("adminInscriptionsNouvellePage.sectorLookupEmpty")}
                error={sectorsQuery.error}
                onRetry={sectorLookupState === "error" ? () => void sectorsQuery.refetch() : undefined}
              />
            )}
            <FieldGrid>
              {visibleFields.map((field) => (
                <EntityFieldInput
                  key={field.key}
                  id={entityFieldId(field.key)}
                  error={fieldError(entityFieldId(field.key))}
                  field={field}
                  locale={locale}
                  selectPlaceholder={selectPlaceholder}
                  branches={branchesFor(sectorsQuery.data, entityData.activitySector, entityType)}
                  value={entityData[field.key] ?? ""}
                  onChange={(v) => setField(field.key, v)}
                />
              ))}
            </FieldGrid>
          </> : null}
        </Section>


        <Section id="registration-step-location" step={4} title={t("registerPage.locationTitle")} description={t("adminInscriptionsNouvellePage.locationDescription")}>
          {territoryLookupState !== "ready" && (
            <DataState
              state={territoryLookupState}
              resource={t("adminInscriptionsNouvellePage.territoryLookupResource")}
              title={territoryLookupState === "loading"
                ? t("adminInscriptionsNouvellePage.territoryLookupLoading")
                : territoryLookupState === "error"
                  ? t("adminInscriptionsNouvellePage.territoryLookupError")
                  : t("adminInscriptionsNouvellePage.territoryLookupEmpty")}
              error={territoryQuery.error}
              onRetry={territoryLookupState === "error" ? () => void territoryQuery.refetch() : undefined}
            />
          )}
          {/* What the note says must match the fields below it: a regional
              admin is told its region is fixed, not its department. */}
          {!choosesRegion && (
            <p className="mb-4 text-sm text-muted-foreground">
              {t(choosesDepartment
                ? "adminInscriptionsNouvellePage.locationScopeNoteRegion"
                : "adminInscriptionsNouvellePage.locationScopeNote")}
            </p>
          )}
          <FieldGrid>
            {choosesRegion ? (
              <NativeSelect
                id={FIELD_ID.region}
                error={fieldError(FIELD_ID.region)}
                label={t("registerPage.regionLabel")}
                placeholder={selectPlaceholder}
                required
                value={region}
                options={regions.map((value) => ({ value, label: value }))}
                onChange={(v) => {
                  setChosenRegion(v);
                  setChosenDepartment("");
                  setSubdivision("");
                }}
              />
            ) : (
              <ReadOnlyLocation label={t("registerPage.regionLabel")} value={region} />
            )}
            {choosesDepartment ? (
              <NativeSelect
                id={FIELD_ID.department}
                error={fieldError(FIELD_ID.department)}
                label={t("registerPage.departmentLabel")}
                placeholder={selectPlaceholder}
                required
                value={department}
                options={departments.map((value) => ({ value, label: value }))}
                onChange={(v) => {
                  setChosenDepartment(v);
                  setSubdivision("");
                }}
              />
            ) : (
              <ReadOnlyLocation label={t("registerPage.departmentLabel")} value={department} />
            )}
            <NativeSelect id={FIELD_ID.subdivision} error={fieldError(FIELD_ID.subdivision)} label={t("registerPage.subdivisionLabel")} placeholder={selectPlaceholder} required value={subdivision} options={subdivisions.map((value) => ({ value, label: value }))} onChange={setSubdivision} />
          </FieldGrid>
        </Section>

        <div className="cam-registration-form-actions">
          <p className="cam-record-form-status" aria-live="polite">
            {stepsDone === registrationSteps.length
              ? t("adminInscriptionsNouvellePage.readyToSubmit")
              : t("adminInscriptionsNouvellePage.stepsProgress", { done: stepsDone, total: registrationSteps.length })}
          </p>
          <Button type="submit" disabled={mutation.isPending || !requiredLookupsReady}>
            {mutation.isPending
              ? t("adminInscriptionsNouvellePage.submittingButton")
              : t("adminInscriptionsNouvellePage.submitButton")}
          </Button>
          <Button asChild variant="outline"><Link href="/admin/inscriptions">{t("common.cancel")}</Link></Button>
        </div>
      </form>
      </div>

      <AdminDialog
        open={!!result}
        onClose={closeResult}
        dismissible={!result || credentialsAcknowledged}
        eyebrow={t("adminInscriptionsNouvellePage.successEyebrow")}
        title={result?.company.name ?? ""}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={closeResult}
              disabled={!credentialsAcknowledged}
            >
              {t("adminInscriptionsNouvellePage.title")}
            </Button>
            {credentialsAcknowledged ? (
              <Button asChild>
                <Link href="/admin/inscriptions">{t("adminInscriptionsNouvellePage.viewQueueLink")}</Link>
              </Button>
            ) : (
              <Button type="button" disabled>
                {t("adminInscriptionsNouvellePage.viewQueueLink")}
              </Button>
            )}
          </>
        }
      >
        {result && (
          <div>
            <p>{t("adminInscriptionsNouvellePage.successBody")}</p>
            <dl className="grid gap-3 sm:grid-cols-2 [&_dd]:font-mono [&_dd]:text-sm [&_dt]:text-sm [&_dt]:text-muted-foreground">
              <div>
                <dt>{t("adminInscriptionsNouvellePage.loginEmailLabel")}</dt>
                <dd>{result.user.email}</dd>
              </div>
              {result.company.establishmentId && (
                <div>
                  <dt>{t("adminInscriptionsNouvellePage.establishmentIdLabel")}</dt>
                  <dd>{result.company.establishmentId}</dd>
                </div>
              )}
              <div>
                <dt>{t("adminInscriptionsNouvellePage.temporaryPasswordLabel")}</dt>
                <dd>{result.temporaryPassword}</dd>
              </div>
            </dl>
            <p className="my-4 flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={copyPassword}>
                {t("adminInscriptionsNouvellePage.copyPasswordButton")}
              </Button>
              {copied && <span className="text-sm text-muted-foreground" role="status">{t("adminInscriptionsNouvellePage.copiedLabel")}</span>}
            </p>
            <Alert variant="warning" role="status"><AlertDescription>{t("adminInscriptionsNouvellePage.passwordShownOnceWarning")}</AlertDescription></Alert>
            <div className="mt-4 flex items-start gap-2">
              <Checkbox
                id="assisted-credentials-acknowledged"
                checked={credentialsAcknowledged}
                onCheckedChange={(checked) => setCredentialsAcknowledged(checked === true)}
              />
              <Label htmlFor="assisted-credentials-acknowledged" className="font-normal leading-snug">
                {t("adminInscriptionsNouvellePage.credentialsAcknowledged")}
              </Label>
            </div>
          </div>
        )}
      </AdminDialog>
      <UnsavedNavigationGuard
        active={hasUnsavedChanges}
        title={
          credentialsAtRisk
            ? t("adminInscriptionsNouvellePage.credentialsLeaveTitle")
            : t("adminInscriptionsNouvellePage.leaveTitle")
        }
        body={
          credentialsAtRisk
            ? t("adminInscriptionsNouvellePage.credentialsLeaveBody")
            : t("adminInscriptionsNouvellePage.leaveBody")
        }
        cancelLabel={t("adminInscriptionsNouvellePage.leaveCancel")}
        confirmLabel={
          credentialsAtRisk
            ? t("adminInscriptionsNouvellePage.credentialsLeaveConfirm")
            : t("adminInscriptionsNouvellePage.leaveConfirm")
        }
      />
    </div>
  );
}

function Section({ id, step, title, description, children }: { id: string; step: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="cam-admin-section cam-registration-form-section" aria-labelledby={`${id}-title`}>
      <div className="cam-admin-section-head">
        <span className="cam-registration-section-number" aria-hidden="true">{step}</span>
        <div className="cam-registration-section-heading">
          <h2 id={`${id}-title`} className="cam-admin-h2">{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div className="cam-admin-section-body">{children}</div>
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="cam-assisted-field-grid grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-4">
      {children}
    </div>
  );
}

function ReadOnlyLocation({ label, value }: { label: string; value: string }) {
  return (
    <dl className="cam-admin-kv mb-4">
      <div>
        <dt>{label} <span aria-hidden="true">*</span></dt>
        <dd>{value || "—"}</dd>
      </div>
    </dl>
  );
}

/** The error said under a field; also listed in the summary at the top. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <span id={id} className="cam-assisted-field-error">{message}</span>;
}

function Text({
  id,
  error,
  label,
  value,
  onChange,
  required,
  type = "text",
  step,
  min,
  hint,
  after,
}: {
  id: string;
  error?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "email" | "tel" | "number";
  step?: number;
  min?: number;
  hint?: string;
  /** Rendered under the input, before the hint (e.g. a live status line). */
  after?: ReactNode;
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mb-4 grid gap-2 text-sm font-medium">
      <Label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</Label>
      <Input
        id={id}
        type={type}
        step={step}
        min={min}
        value={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      {after}
      {hint && <span id={`${id}-hint`} className="text-xs font-normal text-muted-foreground">{hint}</span>}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/**
 * A native select, as on the public form and in the queue's filters: the
 * phone's own picker, and typing jumps to an option (audit N-1 notes).
 */
function NativeSelect({
  id,
  error,
  label,
  placeholder,
  value,
  options,
  onChange,
  required,
  disabled,
  hint,
}: {
  id: string;
  error?: string;
  label: string;
  /** Text of the empty first option. */
  placeholder: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mb-4 grid gap-2 text-sm font-medium">
      <Label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</Label>
      <select
        id={id}
        className="cam-admin-input w-full"
        value={value}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {hint && <span id={`${id}-hint`} className="text-xs font-normal text-muted-foreground">{hint}</span>}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function EntityFieldInput({
  id,
  error,
  field,
  locale,
  selectPlaceholder,
  branches,
  value,
  onChange,
}: {
  id: string;
  error?: string;
  field: EntityField;
  locale: UiLocale;
  selectPlaceholder: string;
  // The branches offered for the chosen sector; read by a "branch" field only.
  branches: readonly BranchRow[];
  value: string;
  onChange: (value: string) => void;
}) {
  const label = localized(field.label, locale);
  const hint = field.hint ? localized(field.hint, locale) : undefined;

  if (field.kind === "radio") {
    const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
    return (
      <fieldset className="mb-4 grid gap-2 text-sm font-medium" aria-describedby={describedBy}>
        <legend>
          {label}
          {field.required && <span aria-hidden="true"> *</span>}
        </legend>
        <div className="cam-assisted-choice-list is-inline">
          {(field.options ?? []).map((option, index) => (
            <label key={option.value} className="cam-assisted-choice">
              <input
                type="radio"
                name={id}
                id={index === 0 ? id : `${id}-${index}`}
                value={option.value}
                checked={value === option.value}
                required={field.required}
                onChange={() => onChange(option.value)}
              />
              <span className="cam-assisted-choice-label">{localized(option.label, locale)}</span>
            </label>
          ))}
        </div>
        {hint && <span id={`${id}-hint`} className="text-xs font-normal text-muted-foreground">{hint}</span>}
        <FieldError id={`${id}-error`} message={error} />
      </fieldset>
    );
  }

  if (field.kind === "date") {
    const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
    return (
      <div className="mb-4 grid gap-2 text-sm font-medium">
        <Label htmlFor={id}>
          {label}
          {field.required && <span aria-hidden="true"> *</span>}
        </Label>
        <Input
          id={id}
          type="date"
          value={dateForCalendar(value)}
          required={field.required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(dateFromCalendar(event.target.value))}
        />
        {hint && <span id={`${id}-hint`} className="text-xs font-normal text-muted-foreground">{hint}</span>}
        <FieldError id={`${id}-error`} message={error} />
      </div>
    );
  }

  if (field.kind === "year") {
    return (
      <NativeSelect
        id={id}
        error={error}
        label={label}
        placeholder={selectPlaceholder}
        required={field.required}
        value={value}
        options={yearOptions(value).map((year) => ({ value: year, label: year }))}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "branch") {
    return (
      <NativeSelect
        id={id}
        error={error}
        label={label}
        placeholder={selectPlaceholder}
        required={field.required}
        disabled={branches.length === 0}
        value={value}
        options={branches.map((branch) => ({ value: branch.id, label: sectorLabel(branch, locale) }))}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "select") {
    return (
      <NativeSelect
        id={id}
        error={error}
        label={label}
        placeholder={selectPlaceholder}
        required={field.required}
        value={value}
        options={(field.options ?? []).map((option) => ({ value: option.value, label: localized(option.label, locale) }))}
        onChange={onChange}
        hint={hint}
      />
    );
  }

  return (
    <Text
      id={id}
      error={error}
      label={label}
      value={value}
      onChange={onChange}
      required={field.required}
      type={field.kind === "number" ? "number" : field.kind === "tel" ? "tel" : "text"}
      step={field.kind === "number" ? 1 : undefined}
      min={field.kind === "number" ? 0 : undefined}
      hint={field.kind === "tel" ? hint ?? undefined : hint}
    />
  );
}
