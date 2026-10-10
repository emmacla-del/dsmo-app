"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ApiError, resetPasswordWithToken } from "@/lib/api-client";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";

// Ported from lib/screens/reset_password_screen.dart: consumes the token a
// SUPER_ADMIN emailed via POST /auth/admin/reset-password. Wrapped in
// Suspense because useSearchParams() requires it in the app router.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const t = useTranslations();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [obscure, setObscure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("resetPasswordPage.errorPasswordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("resetPasswordPage.errorPasswordMismatch"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPasswordWithToken(token!, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="cam-auth-page">
      <div className="wrap">
        <AuthHeader />

        <div className="card">
          <div className="card-body">
            <h1 className="brand-name receipt-title">{t("resetPasswordPage.title")}</h1>

            {!token && (
              <>
                <div className="auth-error-box" role="alert">{t("resetPasswordPage.invalidLinkError")}</div>
                <Link href="/login" className="btn-primary">
                  {t("resetPasswordPage.backToSignInLink")}
                </Link>
              </>
            )}

            {token && done && (
              <>
                <div className="auth-success-box" role="status">
                  {t("resetPasswordPage.successMessage")}
                </div>
                <Link href="/login" className="btn-primary">
                  {t("resetPasswordPage.signInLink")}
                </Link>
              </>
            )}

            {token && !done && (
              <form onSubmit={submit}>
                <p className="brand-sub receipt-subtitle">{t("resetPasswordPage.subtitle")}</p>
                <div className="field">
                  <label htmlFor="reset-password">
                    {t("resetPasswordPage.newPasswordLabel")}
                  </label>
                  <div className="input-row">
                    <input
                      id="reset-password"
                      type={obscure ? "password" : "text"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <PasswordVisibilityToggle
                      obscured={obscure}
                      onToggle={() => setObscure((v) => !v)}
                      showLabel={t("resetPasswordPage.showPasswordButton")}
                      hideLabel={t("resetPasswordPage.hidePasswordButton")}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="reset-confirm-password">
                    {t("resetPasswordPage.confirmPasswordLabel")}
                  </label>
                  <div className="input-row">
                    <input
                      id="reset-confirm-password"
                      type={obscure ? "password" : "text"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {error && <div className="auth-error-box" role="alert">{error}</div>}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? t("resetPasswordPage.validatingLabel") : t("resetPasswordPage.resetButton")}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="help">
          {t("loginPage.needHelpText")}{" "}
          <a
            href="https://wa.me/237651965905"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("loginPage.whatsappLink")}
          </a>
        </p>
      </div>
    </main>
  );
}
