"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ApiError, getResetQuestions, verifyResetAnswers } from "@/lib/api-client";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";

type Question = { key: string; question: string };

// Ported from lib/screens/forgot_password_screen.dart: the live
// self-service reset flow is security-questions based, not the
// email-token /auth/forgot-password endpoint (which Flutter defines but
// never calls from any screen — see api-client.ts's getResetQuestions
// comment). Three steps: enter login -> answer questions + new password ->
// done.
export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [login, setLogin] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [obscure, setObscure] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchQuestions(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const resp = await getResetQuestions(login.trim());
      setQuestions(resp.questions);
      setAnswers({});
      setStep(1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAnswers(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError(t("forgotPasswordPage.passwordTooShortError"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("forgotPasswordPage.passwordMismatchError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verifyResetAnswers(login.trim(), answers, newPassword);
      setStep(2);
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
            <h1
              className="brand-name"
              style={{ fontSize: 18, marginBottom: 6, textAlign: "center" }}
            >
              {step === 2
                ? t("forgotPasswordPage.titleReset")
                : t("forgotPasswordPage.titleDefault")}
            </h1>
            <p
              className="brand-sub"
              style={{ textAlign: "center", marginBottom: 20 }}
            >
              {step === 0 && t("forgotPasswordPage.subtitleStep0")}
              {step === 1 && t("forgotPasswordPage.subtitleStep1")}
              {step === 2 && t("forgotPasswordPage.subtitleStep2")}
            </p>

            {step === 0 && (
              <form onSubmit={fetchQuestions}>
                <div className="field">
                  <label htmlFor="forgot-login">
                    {t("forgotPasswordPage.emailLabel")}
                  </label>
                  <div className="input-row">
                    <input
                      id="forgot-login"
                      type="email"
                      autoComplete="email"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {error && <div className="auth-error-box">{error}</div>}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? t("forgotPasswordPage.sendingButton")
                    : t("forgotPasswordPage.continueButton")}
                </button>
              </form>
            )}

            {step === 1 && (
              <form onSubmit={submitAnswers}>
                {questions.map((q) => (
                  <div className="field" key={q.key}>
                    <label htmlFor={`q-${q.key}`}>{q.question}</label>
                    <div className="input-row">
                      <input
                        id={`q-${q.key}`}
                        value={answers[q.key] ?? ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.key]: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>
                ))}
                <div className="field">
                  <label htmlFor="forgot-new-password">
                    {t("forgotPasswordPage.newPasswordLabel")}
                  </label>
                  <div className="input-row">
                    <input
                      id="forgot-new-password"
                      type={obscure ? "password" : "text"}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <PasswordVisibilityToggle
                      obscured={obscure}
                      onToggle={() => setObscure((v) => !v)}
                      showLabel={t("forgotPasswordPage.showButton")}
                      hideLabel={t("forgotPasswordPage.hideButton")}
                    />
                  </div>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: "var(--muted)",
                      margin: "4px 0 0",
                    }}
                  >
                    {t("forgotPasswordPage.visibilityAppliesToConfirmHint")}
                  </p>
                </div>
                <div className="field">
                  <label htmlFor="forgot-confirm-password">
                    {t("forgotPasswordPage.confirmPasswordLabel")}
                  </label>
                  <div className="input-row">
                    <input
                      id="forgot-confirm-password"
                      type={obscure ? "password" : "text"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {error && <div className="auth-error-box">{error}</div>}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? t("forgotPasswordPage.validatingButton")
                    : t("forgotPasswordPage.resetButton")}
                </button>
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStep(0)}
                  >
                    {t("forgotPasswordPage.backButton")}
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <Link href="/login" className="btn-primary">
                {t("forgotPasswordPage.loginButton")}
              </Link>
            )}
          </div>

          <div className="card-footer">
            <span className="create-account">
              <Link href="/login">{t("forgotPasswordPage.backToLoginLink")}</Link>
            </span>
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
