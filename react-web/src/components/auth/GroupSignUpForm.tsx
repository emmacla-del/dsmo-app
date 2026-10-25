"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import { passwordStrength } from "@/lib/password-strength";
import { PasswordRequirementHint } from "@/components/auth/PasswordRequirementHint";
import { asUiLocale } from "@/lib/register-i18n";
import {
  GENERIC_POSITION_TYPE,
  getOrganigramme,
  getServicePositions,
  previewGroupLink,
  servicesForLevel,
  signUpWithGroupLink,
  territoryPhrase,
} from "@/lib/staff-invitations";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";

// The form behind a GROUP invitation link (/inscription-agent?lien=...).
//
// Unlike the one-person link, nothing about the person is fixed: the link
// fixes only the scope -- the level and, for a delegation, the territory --
// and the person chooses their service and post inside it from the
// organigramme, then gives their email, name and password. The account is
// created waiting for approval, which the success screen says plainly so
// nobody tries to sign in and thinks it failed.

const MIN_LENGTH = 8;
const MIN_STRENGTH = 0.35;
// Enough to catch what `includes("@")` let through -- "a@" and "a@b" -- while
// leaving the authoritative check to the server, which owns the rule.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Reading order, so "the first thing to fix" is the first one on the page.
const FIELD_ORDER = [
  "group-service",
  "group-position",
  "group-email",
  "group-first-name",
  "group-last-name",
  "group-password",
  "group-confirm",
] as const;
const INDENT = "  ";

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
  const treeQuery = useQuery({
    queryKey: ["minefop-services", "tree"],
    queryFn: getOrganigramme,
    enabled: linkQuery.isSuccess,
  });

  const [serviceCode, setServiceCode] = useState("");
  const [positionType, setPositionType] = useState("");
  const positionsQuery = useQuery({
    queryKey: ["minefop-services", serviceCode, "positions"],
    queryFn: () => getServicePositions(serviceCode),
    enabled: !!serviceCode,
  });

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matricule, setMatricule] = useState("");
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Every field is judged, not only the first that fails, so the officer
    // sees everything needing attention in one pass instead of discovering
    // it one submission at a time.
    const found: Record<string, string> = {};
    if (!serviceCode) found["group-service"] = t("groupServiceRequired");
    if (!positionType) found["group-position"] = t("groupPostRequired");
    if (!EMAIL_PATTERN.test(email.trim())) found["group-email"] = t("groupEmailRequired");
    if (!firstName.trim()) found["group-first-name"] = t("groupFirstNameRequired");
    if (!lastName.trim()) found["group-last-name"] = t("groupLastNameRequired");
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
        serviceCode,
        positionType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        matricule: matricule.trim() || undefined,
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
      <p className="brand-sub receipt-subtitle">{t("groupSubtitle")}</p>

      <table className="table-official">
        <tbody>
          <tr>
            <td className="label-cell">{t("groupLabel")}</td>
            <td className="value-cell value-cell--bold">{link.label}</td>
          </tr>
          <tr>
            <td className="label-cell">{t("groupLevelLabel")}</td>
            <td className="value-cell">{t(`groupLevel.${link.level}`)}</td>
          </tr>
          {where && (
            <tr>
              <td className="label-cell">{t("territoryLabel")}</td>
              <td className="value-cell">{where}</td>
            </tr>
          )}
        </tbody>
      </table>

      <form onSubmit={submit} noValidate>
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
          {/* The one field that is not required, so the label says so. A
              placeholder reading "Optional" vanishes the moment anyone types,
              and is not the field's name -- the register wizard puts it in
              the label for the same reason. */}
          <label htmlFor="group-matricule">
            {t("matriculeLabel")} ({t("optional").toLocaleLowerCase(locale)})
          </label>
          <div className="input-row">
            <input id="group-matricule" type="text" value={matricule} onChange={(e) => setMatricule(e.target.value)} />
          </div>
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
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? t("submitting") : t("groupSubmit")}
        </button>
      </form>
    </>
  );
}
