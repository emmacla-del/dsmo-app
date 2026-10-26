"use client";

import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { DIRECTORY_ROLES } from "@/lib/roles";
import {
  ENTITY_CONFIGS,
  entityApiValue,
  isFieldVisible,
  pruneEntityDataForType,
  resolveAddress,
  resolveCompanyName,
  resolveMainActivity,
  visibleEntityDataForType,
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
import { adminRegisterCompany, registrationTerritoryChoice, type AssistedRegistrationResult } from "@/lib/inscriptions";
import { useEmailAvailability } from "@/lib/use-email-availability";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { UnsavedNavigationGuard } from "@/components/auth/UnsavedNavigationGuard";
import { DataState } from "@/components/admin/DataState";
import { formatApiError } from "@/lib/pilotage-targets";
import { ALL, fromAll, toAll } from "@/lib/select-sentinel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  function: string;
  phone1: string;
  phone2: string;
}

const EMPTY_RESPONDENT: Respondent = {
  firstName: "",
  lastName: "",
  email: "",
  function: "",
  phone1: "",
  phone2: "",
};

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
  const [error, setError] = useState<string | null>(null);
  // Bumped on every failed submit, so the same message repeated still moves
  // focus back to the summary.
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
  const { regions } = useTerritoryRegions();
  const { departments } = useTerritoryDepartments(region || null);
  const { subdivisions } = useTerritorySubdivisions(department || null, region || null);

  const config = entityType ? ENTITY_CONFIGS[entityType] : null;
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
    if (error) errorRef.current?.focus();
  }, [error, errorAttempt]);

  function chooseEntityType(next: EntityType) {
    setEntityType(next);
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
    setResult(null);
    setCopied(false);
    setCredentialsAcknowledged(false);
  }

  function closeResult() {
    if (!credentialsAcknowledged) return;
    resetForm();
  }

  /** The first unmet requirement, or null when the form may be sent. */
  function firstProblem(): string | null {
    if (!entityType || !config) return t("adminInscriptionsNouvellePage.errorEntityTypeRequired");
    if (!respondent.firstName.trim() || !respondent.lastName.trim()) {
      return t("adminInscriptionsNouvellePage.errorRespondentNameRequired");
    }
    if (!respondent.email.trim()) return t("adminInscriptionsNouvellePage.errorEmailRequired");
    if (emailAvailable === false) return t("adminInscriptionsNouvellePage.errorEmailInUse");
    if (!region || !department || !subdivision) {
      return t("adminInscriptionsNouvellePage.errorLocationRequired");
    }
    for (const field of visibleFields) {
      if (field.required && !entityData[field.key]?.trim()) {
        return t("adminInscriptionsNouvellePage.errorFieldRequired", { field: localized(field.label, locale) });
      }
    }
    return null;
  }

  function submit() {
    const problem = firstProblem();
    if (problem || !entityType) {
      reportError(problem);
      return;
    }
    // Hidden dependent fields must not reach the payload — the same gate the
    // public wizard applies (visibleEntityDataForType).
    const data = visibleEntityDataForType(entityData, entityType);
    const fallbackName = `${respondent.firstName} ${respondent.lastName}`.trim();

    mutation.mutate({
      email: respondent.email.trim(),
      firstName: respondent.firstName.trim(),
      lastName: respondent.lastName.trim(),
      companyName: resolveCompanyName(data, fallbackName),
      address: resolveAddress(data),
      mainActivity: resolveMainActivity(data),
      region,
      department,
      subdivision,
      entityType: entityApiValue(entityType),
      taxNumber: data.taxNumber,
      parentCompany: data.parentCompany,
      secondaryActivity: data.secondaryActivity,
      cnpsNumber: data.cnpsNumber,
      socialCapital: data.socialCapital ? Number(data.socialCapital) : undefined,
      legalStatus: data.legalStatus,
      cooperativeType: data.cooperativeType,
      yearOfCreation: data.yearOfCreation,
      ctdType: data.ctdType,
      projectNature: data.projectNature,
      mainMission: data.mainMission,
      registrationNumber: data.registrationNumber,
      // The branch's id (Company.sectorId) and French name (Company.branch).
      sectorId: data.branchId || undefined,
      branch: data.branchId
        ? sectorsQuery.data?.find((b) => b.id === data.branchId)?.name
        : undefined,
      poBox: data.poBox,
      phone: data.phone,
      phone2: data.phone2,
      sigle: data.sigle,
      cfpType: data.cfpType,
      educationSystem: data.educationSystem,
      functionalStatus: data.functionalStatus,
      nonFunctionalReason: data.nonFunctionalReason,
      nonFunctionalReasonOther: data.nonFunctionalReasonOther,
      promoterName: data.promoterName,
      promoterSex: data.promoterSex,
      promoterPhone1: data.promoterPhone1,
      promoterPhone2: data.promoterPhone2,
      respondentFirstName: respondent.firstName.trim(),
      respondentLastName: respondent.lastName.trim(),
      respondentFunction: respondent.function || undefined,
      respondentPhone: respondent.phone1 || undefined,
      respondentPhone2: respondent.phone2 || undefined,
    });
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

      <p className="cam-admin-lede">{t("adminInscriptionsNouvellePage.lede")}</p>

      {error && (
        <Alert ref={errorRef} tabIndex={-1} variant="destructive" className="mb-6 flex items-center justify-between gap-4">
          <AlertDescription>{error}</AlertDescription>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("adminInscriptionsNouvellePage.closeAriaLabel")} onClick={() => setError(null)}>×</Button>
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Section title={t("adminInscriptionsNouvellePage.entityTypeTitle")}>
          <RadioGroup aria-label={t("adminInscriptionsNouvellePage.entityTypeTitle")} value={entityType ?? ""} onValueChange={(value) => chooseEntityType(value as EntityType)} className="grid gap-x-6 sm:grid-cols-2">
            {ENTITY_OPTIONS.map(({ type, labelKey, hintKey }) => (
              <Label key={type} htmlFor={`entity-${type}`} className="flex cursor-pointer items-start gap-3 py-2 font-normal">
                <RadioGroupItem id={`entity-${type}`} value={type} />
                <span className="grid gap-1"><span className="font-medium">{t(labelKey)}</span>{hintKey && <span className="text-sm text-muted-foreground">{t(hintKey)}</span>}</span>
              </Label>
            ))}
          </RadioGroup>
        </Section>

        <Section title={t("registerPage.respondentTitle")}>
          <FieldGrid>
            <Text label={t("registerPage.firstNameLabel")} required value={respondent.firstName} onChange={(v) => setRespondent((r) => ({ ...r, firstName: v }))} />
            <Text label={t("registerPage.lastNameLabel")} required value={respondent.lastName} onChange={(v) => setRespondent((r) => ({ ...r, lastName: v }))} />
            <Text label={t("adminInscriptionsNouvellePage.emailLabel")} required type="email" value={respondent.email} onChange={(v) => setRespondent((r) => ({ ...r, email: v }))}
              hint={t("adminInscriptionsNouvellePage.emailRoleHint")}
              after={
                <span aria-live="polite" aria-atomic="true">
                  {emailAvailable === false && <span className="field-status is-error">⚠ {t("registerPage.emailUnavailable")}</span>}
                  {emailAvailable === true && <span className="field-status is-ok">✓ {t("registerPage.emailAvailable")}</span>}
                </span>
              }
            />
            <Text label={t("registerPage.functionLabel")} value={respondent.function} onChange={(v) => setRespondent((r) => ({ ...r, function: v }))} />
            <Text label={t("adminInscriptionsNouvellePage.phone1Label")} type="tel" value={respondent.phone1} onChange={(v) => setRespondent((r) => ({ ...r, phone1: v }))} />
            <Text label={t("registerPage.phone2Label")} type="tel" value={respondent.phone2} onChange={(v) => setRespondent((r) => ({ ...r, phone2: v }))} />
          </FieldGrid>
        </Section>

        {config && (
          <Section
            title={t("adminInscriptionsNouvellePage.identificationTitle", {
              entityType: entityOption ? t(entityOption.labelKey) : localized(config.title, locale),
            })}
          >
            <FieldGrid>
              {visibleFields.map((field) => (
                <EntityFieldInput
                  key={field.key}
                  field={field}
                  locale={locale}
                  selectPlaceholder={selectPlaceholder}
                  branches={branchesFor(sectorsQuery.data, entityData.activitySector, entityType)}
                  value={entityData[field.key] ?? ""}
                  onChange={(v) => setField(field.key, v)}
                />
              ))}
            </FieldGrid>
          </Section>
        )}

        <Section title={t("registerPage.locationTitle")}>
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
              <Select
                label={t("registerPage.regionLabel")}
                placeholder={selectPlaceholder}
                required
                value={region}
                options={regions}
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
              <Select
                label={t("registerPage.departmentLabel")}
                placeholder={selectPlaceholder}
                required
                value={department}
                options={departments}
                onChange={(v) => {
                  setChosenDepartment(v);
                  setSubdivision("");
                }}
              />
            ) : (
              <ReadOnlyLocation label={t("registerPage.departmentLabel")} value={department} />
            )}
            <Select label={t("registerPage.subdivisionLabel")} placeholder={selectPlaceholder} required value={subdivision} options={subdivisions} onChange={setSubdivision} />
          </FieldGrid>
        </Section>

        <div className="mb-10 mt-2 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? t("adminInscriptionsNouvellePage.submittingButton")
              : t("adminInscriptionsNouvellePage.submitButton")}
          </Button>
          <Button asChild variant="outline"><Link href="/admin/inscriptions">{t("common.cancel")}</Link></Button>
        </div>
      </form>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cam-admin-section mb-6">
      <div className="cam-admin-section-head">
        <h2 className="cam-admin-h2">{title}</h2>
      </div>
      <div className="cam-admin-section-body">{children}</div>
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-4">
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

function Text({
  label,
  value,
  onChange,
  required,
  type = "text",
  hint,
  after,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "email" | "tel" | "number";
  hint?: string;
  /** Rendered under the input, before the hint (e.g. a live status line). */
  after?: ReactNode;
}) {
  return (
    <label className="mb-4 grid gap-2 text-sm font-medium">
      <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {after}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Select({
  label,
  placeholder,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  /** Text of the empty first option. */
  placeholder: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="mb-4 grid gap-2 text-sm font-medium">
      <Label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</Label>
      <ShadcnSelect value={toAll(value)} onValueChange={(v) => onChange(fromAll(v))} required={required}>
        <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>{option}</SelectItem>
        ))}
        </SelectContent>
      </ShadcnSelect>
    </div>
  );
}

/** One EntityConfig field, rendered by its declared `kind`. */
function EntityFieldInput({
  field,
  locale,
  selectPlaceholder,
  branches,
  value,
  onChange,
}: {
  field: EntityField;
  locale: UiLocale;
  selectPlaceholder: string;
  // The branches offered for the chosen sector; read by a "branch" field only.
  branches: readonly BranchRow[];
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = useId();
  const label = localized(field.label, locale);
  const hint = field.hint ? localized(field.hint, locale) : undefined;

  if (field.kind === "radio") {
    const hintId = hint ? `${fieldId}-hint` : undefined;
    return (
      <fieldset className="mb-4 grid gap-2 text-sm font-medium" aria-describedby={hintId}>
        <legend>
          {label}
          {field.required && <span aria-hidden="true"> *</span>}
        </legend>
        <RadioGroup
          value={value}
          onValueChange={onChange}
          required={field.required}
          aria-required={field.required || undefined}
          className="gap-2"
        >
          {(field.options ?? []).map((option, index) => {
            const optionId = `${fieldId}-${index}`;
            return (
              <div key={option.value} className="flex items-center gap-2">
                <RadioGroupItem id={optionId} value={option.value} />
                <Label htmlFor={optionId} className="font-normal">
                  {localized(option.label, locale)}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
        {hint && (
          <span id={hintId} className="text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </fieldset>
    );
  }

  if (field.kind === "date") {
    const hintId = hint ? `${fieldId}-hint` : undefined;
    return (
      <div className="mb-4 grid gap-2 text-sm font-medium">
        <Label htmlFor={fieldId}>
          {label}
          {field.required && <span aria-hidden="true"> *</span>}
        </Label>
        <Input
          id={fieldId}
          type="date"
          value={dateForCalendar(value)}
          required={field.required}
          aria-describedby={hintId}
          onChange={(event) => onChange(dateFromCalendar(event.target.value))}
        />
        {hint && (
          <span id={hintId} className="text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
    );
  }

  if (field.kind === "year") {
    return (
      <Select
        label={label}
        placeholder={selectPlaceholder}
        required={field.required}
        value={value}
        options={yearOptions(value)}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "branch") {
    return (
      <div className="mb-4 grid gap-2 text-sm font-medium">
        <Label htmlFor={fieldId}>{label}{field.required && <span aria-hidden="true"> *</span>}</Label>
        <ShadcnSelect value={toAll(value)} onValueChange={(v) => onChange(fromAll(v))} required={field.required} disabled={branches.length === 0}>
          <SelectTrigger id={fieldId} className="w-full"><SelectValue placeholder={selectPlaceholder} /></SelectTrigger>
          <SelectContent>
          <SelectItem value={ALL}>{selectPlaceholder}</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>{sectorLabel(branch, locale)}</SelectItem>
          ))}
          </SelectContent>
        </ShadcnSelect>
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <div className="mb-4 grid gap-2 text-sm font-medium">
        <Label htmlFor={fieldId}>{label}{field.required && <span aria-hidden="true"> *</span>}</Label>
        <ShadcnSelect value={toAll(value)} onValueChange={(v) => onChange(fromAll(v))} required={field.required}>
          <SelectTrigger id={fieldId} className="w-full"><SelectValue placeholder={selectPlaceholder} /></SelectTrigger>
          <SelectContent>
          <SelectItem value={ALL}>{selectPlaceholder}</SelectItem>
          {(field.options ?? []).map((option) => (
            <SelectItem key={option.value} value={option.value}>{localized(option.label, locale)}</SelectItem>
          ))}
          </SelectContent>
        </ShadcnSelect>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </div>
    );
  }

  return (
    <Text
      label={label}
      value={value}
      onChange={onChange}
      required={field.required}
      type={field.kind === "number" ? "number" : field.kind === "tel" ? "tel" : "text"}
      hint={hint}
    />
  );
}
