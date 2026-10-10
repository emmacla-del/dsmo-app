"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useAdminScreenGuard } from "@/lib/use-admin-screen-guard";
import { DIRECTORY_ROLES, NATIONAL_ROLES, hasRole } from "@/lib/roles";
import {
  ENTITY_CONFIGS,
  entityApiValue,
  isFieldVisible,
  pruneEntityDataForType,
  resolveAddress,
  resolveCompanyName,
  resolveMainActivity,
  visibleEntityDataForType,
  type EntityField,
  type EntityType,
} from "@/lib/register-constants";
import { asUiLocale, localized, type UiLocale } from "@/lib/register-i18n";
import {
  useTerritoryDepartments,
  useTerritoryRegions,
  useTerritorySubdivisions,
} from "@/hooks/useTerritoryStructure";
import { adminRegisterCompany, type AssistedRegistrationResult } from "@/lib/inscriptions";
import { useEmailAvailability } from "@/lib/use-email-availability";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminHeaderActions } from "@/components/admin/AdminHeaderActions";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { DataState } from "@/components/admin/DataState";
import { formatApiError } from "@/lib/pilotage-targets";

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
  // The console locale (NEXT_LOCALE cookie, set from the sidebar switcher).
  // EntityConfig labels are {fr, en} data and are read in it too.
  const locale = asUiLocale(useLocale());

  // A territorial admin registers inside its own ressort, so its assignment is
  // the starting point. A national role starts empty and picks. The server
  // refuses anything outside the actor's ressort regardless of what these
  // pickers allow (assertTerritorialAuthority), so this is convenience only.
  const isNational = hasRole(user?.role, NATIONAL_ROLES);
  const [entityType, setEntityType] = useState<EntityType | null>(null);
  const [entityData, setEntityData] = useState<Record<string, string>>({});
  const [respondent, setRespondent] = useState<Respondent>(EMPTY_RESPONDENT);
  // Same debounced check as the public wizard; blocks submit when taken.
  const emailAvailable = useEmailAvailability(respondent.email);
  const [region, setRegion] = useState(isNational ? "" : user?.region ?? "");
  const [department, setDepartment] = useState(isNational ? "" : user?.department ?? "");
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
      setError(null);
      setCopied(false);
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
    setEntityData((current) => pruneEntityDataForType(current, next));
  }

  function setField(key: string, value: string) {
    setEntityData((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEntityType(null);
    setEntityData({});
    setRespondent(EMPTY_RESPONDENT);
    setRegion(isNational ? "" : user?.region ?? "");
    setDepartment(isNational ? "" : user?.department ?? "");
    setSubdivision("");
    setError(null);
    setResult(null);
    setCopied(false);
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
      mainMission: data.mainMission,
      registrationNumber: data.registrationNumber,
      branch: data.branch,
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
            { label: t("adminNav.hubs.declarants") },
            { label: t("adminNav.routes.inscriptions"), href: "/admin/inscriptions" },
            { label: t("adminNav.routes.nouvelleInscription") },
          ]}
          title={t("adminInscriptionsNouvellePage.title")}
          backHref="/admin/inscriptions"
          actions={<AdminHeaderActions showCampaignPill={false} />}
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
          { label: t("adminNav.hubs.declarants") },
          { label: t("adminNav.routes.inscriptions"), href: "/admin/inscriptions" },
          { label: t("adminNav.routes.nouvelleInscription") },
        ]}
        title={t("adminInscriptionsNouvellePage.title")}
        backHref="/admin/inscriptions"
        actions={<AdminHeaderActions showCampaignPill={false} />}
      />

      <p className="cam-admin-lede">{t("adminInscriptionsNouvellePage.lede")}</p>

      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="cam-admin-notice cam-admin-notice--error">
          <span>{error}</span>
          <button type="button" className="cam-admin-notice-close" aria-label={t("adminInscriptionsNouvellePage.closeAriaLabel")} onClick={() => setError(null)}>×</button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Section title={t("adminInscriptionsNouvellePage.entityTypeTitle")}>
          <div role="radiogroup" aria-label={t("adminInscriptionsNouvellePage.entityTypeTitle")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--cam-space-3)" }}>
            {ENTITY_OPTIONS.map(({ type, labelKey, hintKey }) => (
              <label key={type} className="cam-admin-choice">
                <input
                  type="radio"
                  name="entityType"
                  checked={entityType === type}
                  onChange={() => chooseEntityType(type)}
                />
                <span>
                  {t(labelKey)}
                  {hintKey && <span className="cam-admin-choice-hint">{t(hintKey)}</span>}
                </span>
              </label>
            ))}
          </div>
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
                  value={entityData[field.key] ?? ""}
                  onChange={(v) => setField(field.key, v)}
                />
              ))}
            </FieldGrid>
          </Section>
        )}

        <Section title={t("registerPage.locationTitle")}>
          {!isNational && (
            <p className="cam-admin-lede" style={{ marginTop: 0 }}>
              {t("adminInscriptionsNouvellePage.locationScopeNote")}
            </p>
          )}
          <FieldGrid>
            <Select
              label={t("registerPage.regionLabel")}
              placeholder={selectPlaceholder}
              required
              value={region}
              options={regions}
              onChange={(v) => {
                setRegion(v);
                setDepartment("");
                setSubdivision("");
              }}
            />
            <Select
              label={t("registerPage.departmentLabel")}
              placeholder={selectPlaceholder}
              required
              value={department}
              options={departments}
              onChange={(v) => {
                setDepartment(v);
                setSubdivision("");
              }}
            />
            <Select label={t("registerPage.subdivisionLabel")} placeholder={selectPlaceholder} required value={subdivision} options={subdivisions} onChange={setSubdivision} />
          </FieldGrid>
        </Section>

        <div style={{ display: "flex", gap: "var(--cam-space-3)", alignItems: "center", margin: "var(--cam-space-2) 0 var(--cam-space-6)" }}>
          <button type="submit" className="cam-button cam-button-primary" disabled={mutation.isPending}>
            {mutation.isPending
              ? t("adminInscriptionsNouvellePage.submittingButton")
              : t("adminInscriptionsNouvellePage.submitButton")}
          </button>
          <Link href="/admin/inscriptions" className="cam-button cam-button-secondary">{t("common.cancel")}</Link>
        </div>
      </form>

      <AdminDialog
        open={!!result}
        onClose={resetForm}
        eyebrow={t("adminInscriptionsNouvellePage.successEyebrow")}
        title={result?.company.name ?? ""}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary" onClick={resetForm}>{t("adminInscriptionsNouvellePage.title")}</button>
            <Link href="/admin/inscriptions" className="cam-button cam-button-primary">{t("adminInscriptionsNouvellePage.viewQueueLink")}</Link>
          </>
        }
      >
        {result && (
          <div>
            <p>{t("adminInscriptionsNouvellePage.successBody")}</p>
            <dl className="cam-admin-kv">
              <div>
                <dt>{t("adminInscriptionsNouvellePage.loginEmailLabel")}</dt>
                <dd><span className="cam-admin-code">{result.user.email}</span></dd>
              </div>
              {result.company.establishmentId && (
                <div>
                  <dt>{t("adminInscriptionsNouvellePage.establishmentIdLabel")}</dt>
                  <dd><span className="cam-admin-code">{result.company.establishmentId}</span></dd>
                </div>
              )}
              <div>
                <dt>{t("adminInscriptionsNouvellePage.temporaryPasswordLabel")}</dt>
                <dd><span className="cam-admin-code">{result.temporaryPassword}</span></dd>
              </div>
            </dl>
            <p style={{ display: "flex", gap: "var(--cam-space-3)", alignItems: "center" }}>
              <button type="button" className="cam-button cam-button-secondary cam-button-sm" onClick={copyPassword}>
                {t("adminInscriptionsNouvellePage.copyPasswordButton")}
              </button>
              {copied && <span className="cam-admin-meta" role="status">{t("adminInscriptionsNouvellePage.copiedLabel")}</span>}
            </p>
            <div className="cam-admin-notice cam-admin-notice--warn" role="status">
              {t("adminInscriptionsNouvellePage.passwordShownOnceWarning")}
            </div>
          </div>
        )}
      </AdminDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--cam-space-6)" }}>
      <h2 className="cam-admin-h2" style={{ marginBottom: "var(--cam-space-3)" }}>{title}</h2>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 var(--cam-space-4)" }}>
      {children}
    </div>
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
    <label className="cam-field">
      <span className="cam-admin-label">{label}{required && <span aria-hidden="true"> *</span>}</span>
      <input
        className="cam-input"
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
      {after}
      {hint && <span className="cam-admin-choice-hint">{hint}</span>}
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
  return (
    <label className="cam-field">
      <span className="cam-admin-label">{label}{required && <span aria-hidden="true"> *</span>}</span>
      <select className="cam-select" value={value} required={required} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

/** One EntityConfig field, rendered by its declared `kind`. */
function EntityFieldInput({
  field,
  locale,
  selectPlaceholder,
  value,
  onChange,
}: {
  field: EntityField;
  locale: UiLocale;
  selectPlaceholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = localized(field.label, locale);
  const hint = field.hint ? localized(field.hint, locale) : undefined;

  if (field.kind === "select") {
    return (
      <label className="cam-field">
        <span className="cam-admin-label">{label}{field.required && <span aria-hidden="true"> *</span>}</span>
        <select className="cam-select" value={value} required={field.required} onChange={(e) => onChange(e.target.value)}>
          <option value="">{selectPlaceholder}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{localized(option.label, locale)}</option>
          ))}
        </select>
        {hint && <span className="cam-admin-choice-hint">{hint}</span>}
      </label>
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
