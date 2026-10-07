"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import { saveLoginIdentifier } from "@/lib/login-handoff";
import { PASSWORD_RULE_IDS, passwordRuleChecks, passwordStrength } from "@/lib/password-strength";
import { asUiLocale } from "@/lib/register-i18n";
import {
  acceptStaffInvitation,
  previewStaffInvitation,
  territoryPhrase,
} from "@/lib/staff-invitations";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { GroupSignUpForm } from "@/components/auth/GroupSignUpForm";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";

// The invited agent's page (src/lib/staff-invitations.ts).
//
// Reached from the link an administrator sent over WhatsApp. What the
// invitation fixes -- post, service, territory, email -- is shown, not
// editable: the server takes all of it from the signed token and ignores
// anything else. The agent adds their name, optionally their matricule, and
// chooses a password. The account is ACTIVE on creation, so the way on is
// signing in, with the email already in the identifier field.
export default function InscriptionAgentPage() {
  return (
    <Suspense fallback={null}>
      <InscriptionAgentContent />
    </Suspense>
  );
}

// Password floor the server enforces by default (SystemSettings
// passwordMinLength) and the strength the company wizard asks for.
const MIN_LENGTH = 8;
const MIN_STRENGTH = 0.35;

function InscriptionAgentContent() {
  const t = useTranslations("inscriptionAgentPage");
  const tRegister = useTranslations("registerPage");
  const tLogin = useTranslations("loginPage");
  const locale = asUiLocale(useLocale());
  const searchParams = useSearchParams();
  const token = searchParams.get("invitation") ?? "";
  // A group link (?lien=) opens the group form instead: the person chooses
  // their own service and post, and the account waits for approval.
  const groupToken = searchParams.get("lien") ?? "";

  const previewQuery = useQuery({
    queryKey: ["staff-invitation", token],
    queryFn: () => previewStaffInvitation(token),
    enabled: !!token && !groupToken,
    retry: false,
    // The preview is a one-off read of a signed token; refetching on focus
    // would only re-ask the same question.
    refetchOnWindowFocus: false,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [matricule, setMatricule] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [obscure, setObscure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  const rules = passwordRuleChecks(password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (password.length < MIN_LENGTH || passwordStrength(password) < MIN_STRENGTH) {
      setError(t("passwordTooWeak"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await acceptStaffInvitation({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        matricule: matricule.trim() || undefined,
        password,
      });
      setCreatedEmail(res.user.email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const invitation = previewQuery.data;
  // 410: invalid, tampered or expired. 409: already used. Anything else is
  // the network or the server, which a retry may fix.
  const previewStatus = previewQuery.error instanceof ApiError ? previewQuery.error.status : null;

  let body: React.ReactNode;
  if (groupToken) {
    body = <GroupSignUpForm token={groupToken} />;
  } else if (!token || previewStatus === 410) {
    body = (
      <>
        <h1 className="brand-name receipt-title">{t("invalidTitle")}</h1>
        <p className="brand-sub receipt-subtitle">{t("invalidBody")}</p>
      </>
    );
  } else if (previewStatus === 409) {
    body = (
      <>
        <h1 className="brand-name receipt-title">{t("usedTitle")}</h1>
        <p className="brand-sub receipt-subtitle">{t("usedBody")}</p>
        <Link href="/login" className="btn-primary">{t("signIn")}</Link>
      </>
    );
  } else if (previewQuery.isError) {
    body = (
      <>
        <div className="auth-error-box" role="alert">
          {previewQuery.error instanceof Error ? previewQuery.error.message : String(previewQuery.error)}
        </div>
        <button type="button" className="btn-primary" onClick={() => previewQuery.refetch()}>
          {t("retry")}
        </button>
      </>
    );
  } else if (!invitation) {
    body = <p className="brand-sub receipt-subtitle" role="status">{t("loading")}</p>;
  } else if (createdEmail) {
    body = (
      <>
        <h1 className="brand-name receipt-title">{t("createdTitle")}</h1>
        <p className="brand-sub receipt-subtitle">{t("createdBody")}</p>
        <Link href="/login" className="btn-primary" onClick={() => saveLoginIdentifier(createdEmail)}>
          {t("signIn")}
        </Link>
      </>
    );
  } else {
    const where = territoryPhrase(invitation.region, invitation.department);
    body = (
      <>
        <h1 className="brand-name receipt-title">{t("title")}</h1>
        <p className="brand-sub receipt-subtitle">{t("subtitle")}</p>

        <table className="table-official">
          <tbody>
            <tr>
              <td className="label-cell">{t("postLabel")}</td>
              <td className="value-cell value-cell--bold">{invitation.positionTitle}</td>
            </tr>
            {invitation.serviceName && (
              <tr>
                <td className="label-cell">{t("serviceLabel")}</td>
                <td className="value-cell">{invitation.serviceName}</td>
              </tr>
            )}
            {where && (
              <tr>
                <td className="label-cell">{t("territoryLabel")}</td>
                <td className="value-cell">{where}</td>
              </tr>
            )}
            <tr>
              <td className="label-cell">{t("emailLabel")}</td>
              <td className="value-cell">{invitation.email}</td>
            </tr>
            {invitation.expiresAt && (
              <tr>
                <td className="label-cell">{t("expiresLabel")}</td>
                <td className="value-cell">
                  {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(invitation.expiresAt))}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="agent-first-name">{t("firstNameLabel")}</label>
            <div className="input-row">
              <input id="agent-first-name" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="agent-last-name">{t("lastNameLabel")}</label>
            <div className="input-row">
              <input id="agent-last-name" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="agent-matricule">{t("matriculeLabel")}</label>
            <div className="input-row">
              <input id="agent-matricule" type="text" value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder={t("optional")} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="agent-password">{t("passwordLabel")}</label>
            <div className="input-row">
              <input
                id="agent-password"
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
            <label htmlFor="agent-confirm">{t("confirmLabel")}</label>
            <div className="input-row">
              <input
                id="agent-confirm"
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
            {submitting ? t("submitting") : t("submit")}
          </button>
        </form>
      </>
    );
  }

  return (
    <main className="cam-auth-page">
      <div className="wrap">
        <AuthHeader />
        <div className="card">
          <div className="card-body">{body}</div>
        </div>
        <p className="help">
          {tLogin("needHelpText")}{" "}
          <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
            {tLogin("whatsappLink")}
          </a>
        </p>
      </div>
    </main>
  );
}
