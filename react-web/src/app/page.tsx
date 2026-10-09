"use client";

// The landing page, served at "/". It is also where people sign in: /login
// redirects here (see src/app/login/page.tsx).
//
// Port of lib/screens/login_portal_screen.dart.
// The sign-in card sits inside LandingShell, which adds the official bar, the
// CAM-LEAP identity (emblem, wordmark, both names) and the notices around it.
// Two-tab layout: "Connexion" (sign in) | "Retrouver mon identifiant" (Forgot ID).
// Also adds "Pas de compte ? Créer un compte →" link matching Flutter's register prompt.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { findIdentifier } from "@/lib/api-client";
import { takeLoginIdentifier } from "@/lib/login-handoff";
import { LandingShell } from "@/components/landing/LandingShell";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";
import { ADMIN_ROLES, hasRole } from "@/lib/roles";

type Tab = "login" | "forgot";

export default function LandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const submitting = useAuthStore((s) => s.submitting);
  const error = useAuthStore((s) => s.error);
  const twoFactorChallengeToken = useAuthStore((s) => s.twoFactorChallengeToken);
  const login = useAuthStore((s) => s.login);
  const verifyTwoFactorCode = useAuthStore((s) => s.verifyTwoFactorCode);
  const cancelTwoFactorChallenge = useAuthStore((s) => s.cancelTwoFactorChallenge);

  const [activeTab, setActiveTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [obscure, setObscure] = useState(true);
  const [code, setCode] = useState("");

  // Forgot-ID pane state (mirrors _ForgotPane in Flutter)
  const [forgotCompanyName, setForgotCompanyName] = useState("");
  const [forgotTaxNumber, setForgotTaxNumber] = useState("");
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotResult, setForgotResult] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      if (hasRole(user?.role, ADMIN_ROLES)) {
        router.replace("/admin/pilotage");
      } else if (
        user?.role === "COMPANY" &&
        (user.status === "PENDING_APPROVAL" || user.status === "COMPLEMENTS_REQUESTED")
      ) {
        router.replace("/home/inscription-en-attente");
      } else {
        router.replace("/home");
      }
    }
  }, [status, user, router]);

  // Arriving from the registration receipt: the email just registered is
  // waiting in sessionStorage (see login-handoff.ts). Read after mount
  // rather than in a lazy useState initializer, because sessionStorage does
  // not exist during the server render and the two markups would disagree.
  useEffect(() => {
    const handedOver = takeLoginIdentifier();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser-only storage, see above
    if (handedOver) setEmail(handedOver);
  }, []);

  if (status === "loading") {
    return (
      <main className="cam-auth-page">
        <p style={{ color: "var(--cam-text-muted)" }}>{t("common.loading")}</p>
      </main>
    );
  }

  // ── 2FA step ────────────────────────────────────────────────────────────────
  if (twoFactorChallengeToken) {
    return (
      <LandingShell>
        <div className="wrap">
          <div className="card">
            <div className="card-body">
              <h1 className="brand-name" style={{ fontSize: "var(--cam-font-size-lg)", marginBottom: "var(--cam-space-2)", textAlign: "center" }}>
                {t("loginPage.twoFactorTitle")}
              </h1>
              <p className="brand-sub" style={{ textAlign: "center", marginBottom: "var(--cam-space-5)" }}>
                {t("loginPage.twoFactorSubtitle")}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verifyTwoFactorCode(code.trim());
                }}
              >
                <div className="field">
                  <label htmlFor="twofactor-code">
                    {t("loginPage.verificationCodeLabel")}
                  </label>
                  <div className="input-row">
                    <input
                      id="twofactor-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
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
                  {submitting ? t("loginPage.verifyingInProgress") : t("loginPage.validateButton")}
                </button>
              </form>
            </div>
            <div className="card-footer">
              <span className="create-account">
                <button
                  type="button"
                  onClick={cancelTwoFactorChallenge}
                  style={{ background: "none", border: "none", color: "var(--cam-text)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  {t("loginPage.cancelTwoFactorLink")}
                </button>
              </span>
            </div>
          </div>
          <p className="help">
            {t("loginPage.needHelpText")}{" "}
            <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
              {t("loginPage.whatsappLink")}
            </a>
          </p>
        </div>
      </LandingShell>
    );
  }

  // ── Forgot-ID handler ────────────────────────────────────────────────────────
  async function handleFindIdentifier(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    setForgotResult(null);
    setCopiedId(false);
    try {
      const res = await findIdentifier({
        companyName: forgotCompanyName.trim(),
        taxNumber: forgotTaxNumber.trim(),
        phone: forgotPhone.trim(),
      });
      const id = res.establishmentId ?? res.matricule ?? JSON.stringify(res);
      setForgotResult(id);
    } catch (err: unknown) {
      setForgotError(
        err instanceof Error ? err.message : t("loginPage.identifierNotFoundError")
      );
    } finally {
      setForgotLoading(false);
    }
  }

  function copyId() {
    if (!forgotResult) return;
    navigator.clipboard.writeText(forgotResult).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }).catch(() => {});
  }

  return (
    <LandingShell wordmarkAs="h1">
      <div className="wrap">
        <div className="card">
          <div className="card-body">
            {/* Tab bar */}
            <div className="tabs">
              <button
                className={`tab ${activeTab === "login" ? "active" : ""}`}
                type="button"
                onClick={() => setActiveTab("login")}
              >
                {t("loginPage.tabLogin")}
              </button>
              <button
                className={`tab ${activeTab === "forgot" ? "active" : ""}`}
                type="button"
                onClick={() => setActiveTab("forgot")}
              >
                {t("loginPage.tabForgot")}
              </button>
            </div>

            {/* ── Sign-in tab ── */}
            {activeTab === "login" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  login(email.trim(), password, remember);
                }}
              >
                <div className="field">
                  <label htmlFor="email">{t("loginPage.emailLabel")}</label>
                  <div className="input-row">
                    <input
                      id="email"
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={t("loginPage.identifierPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="password">{t("loginPage.passwordLabel")}</label>
                  <div className="input-row">
                    <input
                      id="password"
                      type={obscure ? "password" : "text"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <PasswordVisibilityToggle
                      obscured={obscure}
                      onToggle={() => setObscure((v) => !v)}
                      showLabel={t("loginPage.showPasswordButton")}
                      hideLabel={t("loginPage.hidePasswordButton")}
                      showAriaLabel={t("loginPage.showPasswordAria")}
                      hideAriaLabel={t("loginPage.hidePasswordAria")}
                    />
                  </div>
                </div>

                <div className="sub-row">
                  <label className="stay-signed-in">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    {t("loginPage.rememberMeLabel")}
                  </label>
                  <Link className="forgot" href="/forgot-password">
                    {t("loginPage.forgotPasswordLink")}
                  </Link>
                </div>

                {error && <div className="auth-error-box">{error}</div>}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? t("loginPage.loggingInProgress") : t("loginPage.loginButton")}
                </button>
              </form>
            )}

            {/* ── Forgot-ID tab — port of _ForgotPane ── */}
            {activeTab === "forgot" && (
              <div>
                <p style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-4)", lineHeight: 1.5 }}>
                  {t("loginPage.forgotIntro")}
                </p>
                {!forgotResult ? (
                  <form onSubmit={handleFindIdentifier}>
                    <div className="field">
                      <label htmlFor="forgot-company">
                        {t("loginPage.companyNameLabel")}
                      </label>
                      <div className="input-row">
                        <input
                          id="forgot-company"
                          value={forgotCompanyName}
                          onChange={(e) => setForgotCompanyName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="forgot-niu">
                        {t("loginPage.taxNumberLabel")}
                      </label>
                      <div className="input-row">
                        <input
                          id="forgot-niu"
                          value={forgotTaxNumber}
                          onChange={(e) => setForgotTaxNumber(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="forgot-phone">
                        {t("loginPage.phoneLabel")}
                      </label>
                      <div className="input-row">
                        <input
                          id="forgot-phone"
                          type="tel"
                          value={forgotPhone}
                          onChange={(e) => setForgotPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    {forgotError && <div className="auth-error-box">{forgotError}</div>}
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? t("loginPage.searchingInProgress") : t("loginPage.tabForgot")}
                    </button>
                  </form>
                ) : (
                  /* Result card */
                  <div style={{ background: "var(--cam-surface-subtle)", border: "var(--cam-border-width) solid var(--cam-green)", borderRadius: "var(--cam-radius-control)", padding: "var(--cam-space-4)", textAlign: "center" }}>
                    <div style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: 6 }}>
                      {t("loginPage.identifierResultLabel")}
                    </div>
                    <div style={{ fontFamily: "var(--cam-font-mono)", fontSize: "var(--cam-font-size-lg)", fontWeight: 700, color: "var(--cam-green-dark)", letterSpacing: "0.06em", marginBottom: "var(--cam-space-3)" }}>
                      {forgotResult}
                    </div>
                    <div style={{ display: "flex", gap: "var(--cam-space-2)", justifyContent: "center" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={copyId}
                      >
                        {copiedId ? t("loginPage.copiedLabel") : t("loginPage.copyButton")}
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ width: "auto", padding: "10px 18px", fontSize: "var(--cam-font-size-base)" }}
                        onClick={() => { setForgotResult(null); setActiveTab("login"); }}
                      >
                        {t("loginPage.loginButton")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card-footer">
            <span className="create-account">
              {t("loginPage.noAccountText")}{" "}
              <Link href="/register">{t("loginPage.createAccountLink")}</Link>
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
    </LandingShell>
  );
}
