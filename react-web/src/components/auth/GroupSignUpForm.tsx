"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import { passwordStrength } from "@/lib/password-strength";
import { PasswordRequirementHint } from "@/components/auth/PasswordRequirementHint";
import { asUiLocale } from "@/lib/register-i18n";
import { getValidDepartments, regionDisplayName, useTerritoryStructure } from "@/hooks/useTerritoryStructure";
import {
  GENERIC_POSITION_TYPE,
  getOrganigramme,
  getServicePositions,
  previewFixesPost,
  previewGroupLink,
  servicesForLevel,
  type OrgServiceNode,
  signUpWithGroupLink,
  territoryPhrase,
} from "@/lib/staff-invitations";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";

// The form behind a GROUP invitation link (/inscription-agent?lien=...).
//
// Nothing about the PERSON is fixed -- they give their own name, matricule,
// email and password -- but the post is: the link names the service and the
// post it was made for, and the form shows them, so an incoming officer
// confirms where they work instead of finding it in a 126-service
// organigramme. The account is created waiting for approval, which the
// success screen says plainly so nobody tries to sign in and thinks it
// failed.
//
// A link made before 2026-10-25 carries no post, and for it the service and
// post dropdowns remain. Both old and new links ask for the territory only
// when the chosen service requires it.

const MIN_LENGTH = 8;
const MIN_STRENGTH = 0.35;
// Enough to catch what `includes("@")` let through -- "a@" and "a@b" -- while
// leaving the authoritative check to the server, which owns the rule.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Reading order, so "the first thing to fix" is the first one on the page.
// The post fields are only on the page for a link that fixes no post, and
// the territory fields only appear when the selected service requires them.
const FIELD_ORDER = [
  "group-service",
  "group-position",
  "group-region",
  "group-department",
  "group-email",
  "group-first-name",
  "group-last-name",
  "group-matricule",
  "group-password",
  "group-confirm",
] as const;
const INDENT = "  ";

function findServiceNode(nodes: OrgServiceNode[] | undefined, code: string | null | undefined): OrgServiceNode | null {
  if (!nodes || !code) return null;
  for (const node of nodes) {
    if (node.code === code) return node;
    const child = findServiceNode(node.children, code);
    if (child) return child;
  }
  return null;
}

export function GroupSignUpForm({ token }: { token: string }) {
  const t = useTranslations("inscriptionAgentPage");
  const tRegister = useTranslations("registerPage");
  const locale = asUiLocale(useLocale());

  const linkQuery = useQuery({
    queryKey: ["staff-invitation-link", token],
    queryFn: () => previewGroupLink(token),
    retry: false,
    refetchOnWindowFocus: false,
  });
  // The organigramme also tells the form which territory fields the chosen
  // service requires, including when the link fixes the post.
  const fixedPost = !!linkQuery.data && previewFixesPost(linkQuery.data);
  const treeQuery = useQuery({
    queryKey: ["minefop-services", "tree"],
    queryFn: getOrganigramme,
    enabled: linkQuery.isSuccess,
  });
  const territoryQuery = useTerritoryStructure(linkQuery.isSuccess);

  const [serviceCode, setServiceCode] = useState("");
  const [positionType, setPositionType] = useState("");
  const positionsQuery = useQuery({
    queryKey: ["minefop-services", serviceCode, "positions"],
    queryFn: () => getServicePositions(serviceCode),
    enabled: !!serviceCode && !fixedPost,
  });

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matricule, setMatricule] = useState("");
  const [region, setRegion] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [obscure, setObscure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Two kinds of problem, shown in two places. A field's own message sits
  // under that field, keyed by its control id; `error` is kept for what no
  // single field owns -- the request itself failing.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState<string | null>(null);

  /** Drops a field's message as soon as the officer starts fixing it. */
  function clearError(id: string) {
    setFieldErrors((prev) => (prev[id] ? { ...prev, [id]: "" } : prev));
  }

  /**
   * Marks the control and points it at its message. `describedBy` is for the
   * one field that already has something to say about it -- the password and
   * its rules -- so the error joins that rather than replacing it.
   */
  function fieldProps(id: string, describedBy?: string) {
    const ids = [describedBy, fieldErrors[id] ? `${id}-error` : null].filter(Boolean).join(" ");
    return {
      "aria-required": true as const,
      ...(fieldErrors[id] ? { "aria-invalid": true as const } : {}),
      ...(ids ? { "aria-describedby": ids } : {}),
    };
  }

  function errorLine(id: string) {
    if (!fieldErrors[id]) return null;
    return (
      <p className="field-error" id={`${id}-error`}>
        {fieldErrors[id]}
      </p>
    );
  }

  const link = linkQuery.data;
  const services = link && treeQuery.data ? servicesForLevel(treeQuery.data, link.level, locale) : [];
  const selectedServiceCode = fixedPost ? link?.serviceCode : serviceCode;
  const selectedService = findServiceNode(treeQuery.data, selectedServiceCode);
  const needsRegion = !!selectedService && (selectedService.requiresRegion || selectedService.requiresDepartment);
  const needsDepartment = !!selectedService?.requiresDepartment;
  const regions = territoryQuery.data ?? [];
  const departments = getValidDepartments(territoryQuery.data, region);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Every field is judged, not only the first that fails, so the officer
    // sees everything needing attention in one pass instead of discovering
    // it one submission at a time.
    const found: Record<string, string> = {};
    if (!fixedPost && !serviceCode) found["group-service"] = t("groupServiceRequired");
    if (!fixedPost && !positionType) found["group-position"] = t("groupPostRequired");
    if (needsRegion && !region) found["group-region"] = t("groupRegionRequired");
    if (needsDepartment && !department) found["group-department"] = t("groupDepartmentRequired");
    if (!EMAIL_PATTERN.test(email.trim())) found["group-email"] = t("groupEmailRequired");
    if (!firstName.trim()) found["group-first-name"] = t("groupFirstNameRequired");
    if (!lastName.trim()) found["group-last-name"] = t("groupLastNameRequired");
    if (!matricule.trim()) found["group-matricule"] = t("groupMatriculeRequired");
    if (password.length < MIN_LENGTH || passwordStrength(password) < MIN_STRENGTH) {
      found["group-password"] = t("passwordTooWeak");
    }
    // Judged on its own, so a weak password does not hide a mismatch.
    if (password !== confirm) found["group-confirm"] = t("passwordMismatch");
    setFieldErrors(found);
    const firstInvalid = FIELD_ORDER.find((id) => found[id]);
    if (firstInvalid) {
      // Focus lands on what must be fixed, so the correction starts there
      // instead of at the top of an eight-field form.
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await signUpWithGroupLink({
        token,
        email: email.trim(),
        // Left out when the link carries the post: it is the link's, and the
        // server reads it from there.
        ...(fixedPost ? {} : { serviceCode, positionType }),
        ...(needsRegion ? { region } : {}),
        ...(needsDepartment ? { department } : {}),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        matricule: matricule.trim(),
        password,
      });
      setRequested(res.email);
    } catch (err) {
      // Anything that is not an ApiError is a transport failure, not
      // something to quote back: "TypeError: Failed to fetch" tells an
      // officer nothing they can act on.
      setError(err instanceof ApiError ? err.message : t("groupSubmitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const status = linkQuery.error instanceof ApiError ? linkQuery.error.status : null;

  if (status === 410) {
    return (
      <>
        <h1 className="brand-name receipt-title">{t("invalidTitle")}</h1>
        <p className="brand-sub receipt-subtitle">{t("groupInvalidBody")}</p>
      </>
    );
  }
  if (linkQuery.isError) {
    return (
      <>
        <div className="auth-error-box" role="alert">
          {linkQuery.error instanceof Error ? linkQuery.error.message : String(linkQuery.error)}
        </div>
        <button type="button" className="btn-primary" onClick={() => linkQuery.refetch()}>{t("retry")}</button>
      </>
    );
  }
  if (!link) {
    return <p className="brand-sub receipt-subtitle" role="status">{t("loading")}</p>;
  }
  if (requested) {
    return (
      <>
        <h1 className="brand-name receipt-title">{t("groupRequestedTitle")}</h1>
        <p className="brand-sub receipt-subtitle">{t("groupRequestedBody", { email: requested })}</p>
      </>
    );
  }

  const where = territoryPhrase(link.region, link.department);
  return (
    <>
      <h1 className="brand-name receipt-title">{t("groupTitle")}</h1>
      <p className="brand-sub receipt-subtitle">{fixedPost ? t("groupSubtitleFixedPost") : t("groupSubtitle")}</p>

      <table className="table-official">
        <tbody>
          <tr>
            <td className="label-cell">{t("groupLabel")}</td>
            <td className="value-cell value-cell--bold">{link.label}</td>
          </tr>
          {/* The post the link fixes, stated with the rest of what it
              carries, not offered as a choice: it is not the officer's to
              change, and a select they cannot change is a worse way of
              saying so than a plain line. */}
          {fixedPost && (
            <tr>
              <td className="label-cell">{t("postLabel")}</td>
              <td className="value-cell value-cell--bold">{link.positionTitle}</td>
            </tr>
          )}
          {fixedPost && link.serviceName && (
            <tr>
              <td className="label-cell">{t("serviceLabel")}</td>
              <td className="value-cell">{link.serviceName}</td>
            </tr>
          )}
          <tr>
            <td className="label-cell">{t("groupLevelLabel")}</td>
            <td className="value-cell">{t(`groupLevel.${link.level}`)}</td>
          </tr>
          {where && (
            <tr>
              <td className="label-cell">{t("groupLinkTerritoryLabel")}</td>
              <td className="value-cell">{where}</td>
            </tr>
          )}
        </tbody>
      </table>

      <form onSubmit={submit} noValidate>
        {treeQuery.isError && (
          <div className="field" role="alert">
            <p className="field-error">{t("groupTreeError")}</p>
            <button type="button" className="btn-secondary" onClick={() => treeQuery.refetch()}>{t("retry")}</button>
          </div>
        )}
        {/* Only a link that fixes no post asks for one. */}
        {!fixedPost && (
          <>
            <div className="field">
              <label htmlFor="group-service">{t("serviceLabel")}</label>
              <div className="input-row">
                <select
                  id="group-service"
                  value={serviceCode}
                  onChange={(e) => {
                    clearError("group-service");
                    setServiceCode(e.target.value);
                    setPositionType("");
                    setRegion("");
                    setDepartment("");
                    clearError("group-region");
                    clearError("group-department");
                  }}
                  disabled={!treeQuery.isSuccess}
                  required
                  {...fieldProps("group-service")}
                >
                  <option value="" disabled hidden>
                    {treeQuery.isError ? t("groupTreeError") : treeQuery.isSuccess ? t("groupSelectService") : t("loading")}
                  </option>
                  {services.map((s) => (
                    <option key={s.code} value={s.code}>{INDENT.repeat(s.depth * 2) + s.label}</option>
                  ))}
                </select>
              </div>
              {errorLine("group-service")}
              {treeQuery.isError && (
                <button type="button" className="btn-secondary" onClick={() => treeQuery.refetch()}>{t("retry")}</button>
              )}
            </div>
            <div className="field">
              <label htmlFor="group-position">{t("postLabel")}</label>
              <div className="input-row">
                <select
                  id="group-position"
                  value={positionType}
                  onChange={(e) => {
                    clearError("group-position");
                    setPositionType(e.target.value);
                  }}
                  disabled={!serviceCode || positionsQuery.isLoading}
                  required
                  {...fieldProps("group-position")}
                >
                  <option value="" disabled hidden>{serviceCode ? t("groupSelectPost") : t("groupSelectServiceFirst")}</option>
                  {(positionsQuery.data ?? []).map((p) => (
                    <option key={p.id} value={p.positionType}>{locale === "en" && p.titleEn ? p.titleEn : p.title}</option>
                  ))}
                  {serviceCode && <option value={GENERIC_POSITION_TYPE}>{t("groupGenericPost")}</option>}
                </select>
              </div>
              {errorLine("group-position")}
            </div>
          </>
        )}
        {needsRegion && (
          <div className="field">
            <label htmlFor="group-region">{t("groupRegionLabel")}</label>
            <div className="input-row">
              <select
                id="group-region"
                value={region}
                onChange={(e) => {
                  clearError("group-region");
                  setRegion(e.target.value);
                  setDepartment("");
                  clearError("group-department");
                }}
                disabled={territoryQuery.isLoading || territoryQuery.isError}
                required
                {...fieldProps("group-region")}
              >
                <option value="" disabled hidden>{territoryQuery.isError ? t("groupTerritoryError") : t("groupSelectRegion")}</option>
                {regions.map((item) => (
                  <option key={item.id} value={item.name}>{regionDisplayName(item.name, locale)}</option>
                ))}
              </select>
            </div>
            {errorLine("group-region")}
          </div>
        )}
        {needsDepartment && (
          <div className="field">
            <label htmlFor="group-department">{t("groupDepartmentLabel")}</label>
            <div className="input-row">
              <select
                id="group-department"
                value={department}
                onChange={(e) => {
                  clearError("group-department");
                  setDepartment(e.target.value);
                }}
                disabled={!region || territoryQuery.isLoading || territoryQuery.isError}
                required
                {...fieldProps("group-department")}
              >
                <option value="" disabled hidden>{territoryQuery.isError ? t("groupTerritoryError") : region ? t("groupSelectDepartment") : t("groupSelectRegionFirst")}</option>
                {departments.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            {errorLine("group-department")}
          </div>
        )}
        <div className="field">
          <label htmlFor="group-email">{t("groupEmailLabel")}</label>
          <div className="input-row">
            <input
              id="group-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                clearError("group-email");
                setEmail(e.target.value);
              }}
              required
              {...fieldProps("group-email")}
            />
          </div>
          {errorLine("group-email")}
        </div>
        <div className="field">
          <label htmlFor="group-first-name">{t("firstNameLabel")}</label>
          <div className="input-row">
            <input
              id="group-first-name"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => {
                clearError("group-first-name");
                setFirstName(e.target.value);
              }}
              required
              {...fieldProps("group-first-name")}
            />
          </div>
          {errorLine("group-first-name")}
        </div>
        <div className="field">
          <label htmlFor="group-last-name">{t("lastNameLabel")}</label>
          <div className="input-row">
            <input
              id="group-last-name"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => {
                clearError("group-last-name");
                setLastName(e.target.value);
              }}
              required
              {...fieldProps("group-last-name")}
            />
          </div>
          {errorLine("group-last-name")}
        </div>
        <div className="field">
          {/* Asked for, not offered: a staff account is identified by its
              matricule in every MINEFOP register, and an approver checks it
              against the service's own list. It was optional until
              2026-10-25. */}
          <label htmlFor="group-matricule">{t("matriculeLabel")}</label>
          <div className="input-row">
            <input
              id="group-matricule"
              type="text"
              value={matricule}
              onChange={(e) => {
                clearError("group-matricule");
                setMatricule(e.target.value);
              }}
              required
              {...fieldProps("group-matricule")}
            />
          </div>
          {errorLine("group-matricule")}
        </div>
        <div className="field">
          <label htmlFor="group-password">{t("passwordLabel")}</label>
          <div className="input-row">
            <input
              id="group-password"
              type={obscure ? "password" : "text"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                clearError("group-password");
                clearError("group-confirm");
                setPassword(e.target.value);
              }}
              required
              {...fieldProps("group-password", "group-password-rules")}
            />
            <PasswordVisibilityToggle
              obscured={obscure}
              onToggle={() => setObscure((v) => !v)}
              showLabel={tRegister("showPasswordButton")}
              hideLabel={tRegister("hidePasswordButton")}
            />
          </div>
          <PasswordRequirementHint id="group-password-rules" password={password} />
          {errorLine("group-password")}
        </div>
        <div className="field">
          <label htmlFor="group-confirm">{t("confirmLabel")}</label>
          <div className="input-row">
            <input
              id="group-confirm"
              type={obscure ? "password" : "text"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                clearError("group-confirm");
                setConfirm(e.target.value);
              }}
              required
              {...fieldProps("group-confirm")}
            />
          </div>
          {errorLine("group-confirm")}
        </div>
        {error && <div className="auth-error-box" role="alert">{error}</div>}
        {needsRegion && territoryQuery.isError && (
          <div className="field" role="alert">
            <p className="field-error">{t("groupTerritoryError")}</p>
            <button type="button" className="btn-secondary" onClick={() => territoryQuery.refetch()}>{t("retry")}</button>
          </div>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || !treeQuery.isSuccess || (needsRegion && !territoryQuery.isSuccess)}
        >
          {submitting ? t("submitting") : t("groupSubmit")}
        </button>
      </form>
    </>
  );
}
