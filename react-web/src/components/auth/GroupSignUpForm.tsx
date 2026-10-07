"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import { PASSWORD_RULE_IDS, passwordRuleChecks, passwordStrength } from "@/lib/password-strength";
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
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState<string | null>(null);

  const rules = passwordRuleChecks(password);
  const link = linkQuery.data;
  const services = link && treeQuery.data ? servicesForLevel(treeQuery.data, link.level, locale) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!serviceCode || !positionType) return setError(t("groupPostRequired"));
    if (!email.trim().includes("@")) return setError(t("groupEmailRequired"));
    if (!firstName.trim() || !lastName.trim()) return setError(t("nameRequired"));
    if (password.length < MIN_LENGTH || passwordStrength(password) < MIN_STRENGTH) return setError(t("passwordTooWeak"));
    if (password !== confirm) return setError(t("passwordMismatch"));
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
      setError(err instanceof ApiError ? err.message : String(err));
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
              onChange={(e) => { setServiceCode(e.target.value); setPositionType(""); }}
              disabled={!treeQuery.isSuccess}
              required
            >
              <option value="" disabled>
                {treeQuery.isError ? t("groupTreeError") : treeQuery.isSuccess ? t("groupSelectService") : t("loading")}
              </option>
              {services.map((s) => (
                <option key={s.code} value={s.code}>{INDENT.repeat(s.depth * 2) + s.label}</option>
              ))}
            </select>
          </div>
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
              onChange={(e) => setPositionType(e.target.value)}
              disabled={!serviceCode || positionsQuery.isLoading}
              required
            >
              <option value="" disabled>{serviceCode ? t("groupSelectPost") : t("groupSelectServiceFirst")}</option>
              {(positionsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.positionType}>{locale === "en" && p.titleEn ? p.titleEn : p.title}</option>
              ))}
              {serviceCode && <option value={GENERIC_POSITION_TYPE}>{t("groupGenericPost")}</option>}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="group-email">{t("groupEmailLabel")}</label>
          <div className="input-row">
            <input id="group-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="group-first-name">{t("firstNameLabel")}</label>
          <div className="input-row">
            <input id="group-first-name" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="group-last-name">{t("lastNameLabel")}</label>
          <div className="input-row">
            <input id="group-last-name" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="group-matricule">{t("matriculeLabel")}</label>
          <div className="input-row">
            <input id="group-matricule" type="text" value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder={t("optional")} />
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
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <PasswordVisibilityToggle
              obscured={obscure}
              onToggle={() => setObscure((v) => !v)}
              showLabel={tRegister("showPasswordButton")}
              hideLabel={tRegister("hidePasswordButton")}
            />
          </div>
          <ul className="password-rules-list">
            {PASSWORD_RULE_IDS.map((ruleId) => (
              <li key={ruleId} className={`password-rule ${rules[ruleId] ? "is-met" : ""}`}>
                <span className="password-rule-mark" aria-hidden="true">{rules[ruleId] ? "✓" : "•"}</span>
                {tRegister(`passwordRule${ruleId.charAt(0).toUpperCase()}${ruleId.slice(1)}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="field">
          <label htmlFor="group-confirm">{t("confirmLabel")}</label>
          <div className="input-row">
            <input
              id="group-confirm"
              type={obscure ? "password" : "text"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <div className="auth-error-box" role="alert">{error}</div>}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? t("submitting") : t("groupSubmit")}
        </button>
      </form>
    </>
  );
}
