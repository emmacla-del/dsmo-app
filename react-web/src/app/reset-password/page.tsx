"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ApiError, resetPasswordWithToken } from "@/lib/api-client";

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
    <main className="cam-shell">
      <div className="cam-panel">
        <h1 className="cam-title">{t("resetPasswordPage.title")}</h1>

        {!token && (
          <>
            <div className="cam-error-box">{t("resetPasswordPage.invalidLinkError")}</div>
            <Link href="/login" className="cam-button cam-button-primary cam-button-block" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              {t("resetPasswordPage.backToSignInLink")}
            </Link>
          </>
        )}

        {token && done && (
          <>
            <div className="cam-success-box">
              {t("resetPasswordPage.successMessage")}
            </div>
            <Link href="/login" className="cam-button cam-button-primary cam-button-block" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              {t("resetPasswordPage.signInLink")}
            </Link>
          </>
        )}

        {token && !done && (
          <form onSubmit={submit}>
            <p className="cam-subtitle">{t("resetPasswordPage.subtitle")}</p>
            <div className="cam-field">
              <label className="cam-label" htmlFor="reset-password">
                {t("resetPasswordPage.newPasswordLabel")}
              </label>
              <div style={{ display: "flex", gap: "var(--cam-space-2)" }}>
                <input
                  id="reset-password"
                  className="cam-input"
                  type={obscure ? "password" : "text"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="cam-button cam-button-secondary"
                  onClick={() => setObscure((v) => !v)}
                >
                  {obscure ? t("resetPasswordPage.showPasswordButton") : t("resetPasswordPage.hidePasswordButton")}
                </button>
              </div>
            </div>
            <div className="cam-field">
              <label className="cam-label" htmlFor="reset-confirm-password">
                {t("resetPasswordPage.confirmPasswordLabel")}
              </label>
              <input
                id="reset-confirm-password"
                className="cam-input"
                type={obscure ? "password" : "text"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="cam-error-box">{error}</div>}
            <button
              type="submit"
              className="cam-button cam-button-primary cam-button-block"
              disabled={submitting}
            >
              {submitting ? t("resetPasswordPage.validatingLabel") : t("resetPasswordPage.resetButton")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
