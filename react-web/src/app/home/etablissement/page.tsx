"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ApiError, getCachedUser, getMyAttestation, changePassword } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { myCompanyQueryOptions, meQueryOptions } from "@/lib/shared-queries";
import { declaredWorkforce, respondentNiu, respondentTypeLabel } from "@/lib/respondent-identity";
import { asUiLocale } from "@/lib/register-i18n";
import { SITE_CONTACT } from "@/components/landing/site/site-content";

export default function HomeEstablishmentPage() {
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "settings" ? "settings" : "record";
  const [activeTab, setActiveTab] = useState<"record" | "settings">(initialTab);

  const authUser = useAuthStore((s) => s.user);

  const meQuery = useQuery({
    ...meQueryOptions,
    initialData: authUser ?? getCachedUser() ?? undefined,
  });
  const user = meQuery.data ?? authUser ?? getCachedUser();

  const companyQuery = useQuery({
    ...myCompanyQueryOptions,
    enabled: user?.role === "COMPANY",
  });
  const company = companyQuery.data;
  // The establishment record shows only what this account declared (B6).
  const niu = respondentNiu(company?.taxNumber);
  const workforce = declaredWorkforce(company);

  // Attestation state
  const [attestationLoading, setAttestationLoading] = useState(false);
  const [attestationError, setAttestationError] = useState<string | null>(null);

  // Password change form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordPending, startPasswordTransition] = useTransition();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const canDownloadAttestation = user?.role === "COMPANY" && user.status === "ACTIVE";

  async function openAttestation() {
    setAttestationError(null);
    setAttestationLoading(true);
    const tab = window.open("", "_blank");
    try {
      const { url } = await getMyAttestation();
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (e) {
      tab?.close();
      setAttestationError(
        e instanceof ApiError && e.status === 400
          ? t("homeEstablishmentPage.attestationUnavailable")
          : t("homeEstablishmentPage.attestationOpenError")
      );
    } finally {
      setAttestationLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError(t("homeEstablishmentPage.passwordLengthError"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("homeEstablishmentPage.passwordMismatchError"));
      return;
    }

    startPasswordTransition(async () => {
      try {
        const res = await changePassword(currentPassword, newPassword);
        setPasswordSuccess(res.message || t("homeEstablishmentPage.passwordChangedSuccess"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (err: unknown) {
        setPasswordError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const typeLabel = respondentTypeLabel(company?.entityType, locale) || t("homeEstablishmentPage.notSpecified");
  const changeMailSubject = encodeURIComponent(
    locale === "fr"
      ? `Demande de modification d'informations - ${company?.name || user?.email || ""}`
      : `Request for information update - ${company?.name || user?.email || ""}`
  );
  const changeMailHref = `mailto:${SITE_CONTACT.email}?subject=${changeMailSubject}`;

  return (
    <div style={{ maxWidth: "var(--vt-content-max)", margin: "0 auto", padding: "var(--cam-space-5) var(--cam-space-4)", display: "flex", flexDirection: "column", gap: "var(--cam-space-5)" }}>
      {/* Page Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)", flexWrap: "wrap", marginBottom: "var(--cam-space-1)" }}>
          <h1 style={{ margin: 0, fontSize: "var(--cam-font-size-2xl)", fontWeight: 700, color: "var(--cam-text)" }}>
            {company?.name || t("homeEstablishmentPage.pageTitle")}
          </h1>
          <span className="cam-badge cam-badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "var(--cam-space-1)" }}>
            <span aria-hidden="true">✓</span>
            <span>{t("homeLandingPage.verifiedAccount")}</span>
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
          {t("homeEstablishmentPage.pageSubtitle")}
        </p>
      </div>

      {/* Sub-navigation tabs: Fiche d'immatriculation vs Paramètres & Sécurité */}
      <div style={{ display: "flex", gap: "var(--cam-space-2)", borderBottom: "var(--cam-border-width) solid var(--cam-border)", paddingBottom: "var(--cam-space-2)" }}>
        <button
          type="button"
          onClick={() => setActiveTab("record")}
          className={`cam-button ${activeTab === "record" ? "cam-button-primary" : "cam-button-secondary"} cam-button-sm`}
          style={{ borderRadius: "var(--cam-radius-full)", padding: "var(--cam-space-1) var(--cam-space-3)" }}
        >
          <span>🏢</span> {t("homeEstablishmentPage.tabRecord")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`cam-button ${activeTab === "settings" ? "cam-button-primary" : "cam-button-secondary"} cam-button-sm`}
          style={{ borderRadius: "var(--cam-radius-full)", padding: "var(--cam-space-1) var(--cam-space-3)" }}
        >
          <span>⚙️</span> {t("homeEstablishmentPage.tabSettings")}
        </button>
      </div>

      {companyQuery.isLoading && (
        <div style={{ padding: "var(--cam-space-6)", color: "var(--cam-text-muted)", textAlign: "center" }}>
          {t("common.loading")}
        </div>
      )}

      {!companyQuery.isLoading && activeTab === "record" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-6)" }}>
          {/* Section: Official Attestation Download Card */}
          <section
            style={{
              background: "var(--cam-surface)",
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderLeft: "4px solid var(--cam-primary)",
              borderRadius: "var(--cam-radius-lg)",
              padding: "var(--cam-space-5) var(--cam-space-6)",
              boxShadow: "var(--cam-shadow-sm)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--cam-space-4)",
            }}
          >
            <div style={{ flex: "1 1 20rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-1)" }}>
                <span aria-hidden="true" style={{ fontSize: "var(--cam-font-size-lg)" }}>📜</span>
                <h2 style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, margin: 0, color: "var(--cam-text)" }}>
                  {t("homeEstablishmentPage.attestationTitle")}
                </h2>
              </div>
              <p style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", lineHeight: "var(--cam-line-height-base)" }}>
                {t("homeEstablishmentPage.attestationDesc")}
              </p>
              {attestationError && (
                <p role="alert" style={{ color: "var(--cam-error)", fontSize: "var(--cam-font-size-xs)", margin: "var(--cam-space-2) 0 0" }}>
                  {attestationError}
                </p>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={openAttestation}
                disabled={!canDownloadAttestation || attestationLoading}
                className="cam-button cam-button-primary"
                style={{ padding: "var(--cam-space-2) var(--cam-space-4)", fontSize: "var(--cam-font-size-sm)", display: "inline-flex", alignItems: "center", gap: "var(--cam-space-2)" }}
              >
                <span>📥</span>
                <span>
                  {attestationLoading
                    ? t("homeEstablishmentPage.attestationLoading")
                    : t("homeEstablishmentPage.attestationDownload")}
                </span>
              </button>
            </div>
          </section>

          {/* Section: Establishment Identity */}
          <section
            style={{
              background: "var(--cam-surface)",
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderRadius: "var(--cam-radius-lg)",
              padding: "var(--cam-space-5) var(--cam-space-6)",
              boxShadow: "var(--cam-shadow-sm)",
            }}
          >
            <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: "0 0 var(--cam-space-4)", color: "var(--cam-text)" }}>
              {t("homeEstablishmentPage.sectionIdentity")}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))", gap: "var(--cam-space-4)" }}>
              <div>
                <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                  {t("homeEstablishmentPage.name")}
                </dt>
                <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text)" }}>
                  {company?.name || "—"}
                </dd>
              </div>

              <div>
                <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                  {t("homeEstablishmentPage.entityType")}
                </dt>
                <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text)" }}>
                  {typeLabel}
                </dd>
              </div>

              {/* An administration and a project/programme are never asked
                  for a NIU; their row holds an internal `NA-<uuid>`
                  placeholder, which is not a number to show them (B6). */}
              {niu && (
                <div>
                  <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                    {t("homeEstablishmentPage.taxNumber")}
                  </dt>
                  <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text)" }}>
                    {niu}
                  </dd>
                </div>
              )}

              {/* Registration asks for a CNPS number from the same five
                  types as the NIU, so an administration or a
                  project/programme read « Numéro CNPS — » for a question
                  they are never asked. The home header already hid it. */}
              {company?.cnpsNumber && (
                <div>
                  <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                    {t("homeEstablishmentPage.cnpsNumber")}
                  </dt>
                  <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text)" }}>
                    {company.cnpsNumber}
                  </dd>
                </div>
              )}

              <div>
                <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                  {t("homeEstablishmentPage.mainActivity")}
                </dt>
                <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
                  {company?.mainActivity || "—"}
                </dd>
              </div>

              {company?.secondaryActivity && (
                <div>
                  <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                    {t("homeEstablishmentPage.secondaryActivity")}
                  </dt>
                  <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
                    {company.secondaryActivity}
                  </dd>
                </div>
              )}

              {/* The DSMO company profile's headcount. ONEFOP never asks for
                  it, so it stays at 0 and read « 0 déclarés » next to a
                  declaration of 12 (B6): shown only when entered. */}
              {workforce !== null && (
                <div>
                  <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                    {t("homeEstablishmentPage.totalEmployees")}
                  </dt>
                  <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text)" }}>
                    {t("homeLandingPage.employeesCount", { count: workforce })}
                  </dd>
                </div>
              )}
            </div>
          </section>

          {/* Section: Contact & Location */}
          <section
            style={{
              background: "var(--cam-surface)",
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderRadius: "var(--cam-radius-lg)",
              padding: "var(--cam-space-5) var(--cam-space-6)",
              boxShadow: "var(--cam-shadow-sm)",
            }}
          >
            <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: "0 0 var(--cam-space-4)", color: "var(--cam-text)" }}>
              {t("homeEstablishmentPage.sectionContact")}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))", gap: "var(--cam-space-4)" }}>
              <div>
                <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                  {t("homeEstablishmentPage.address")}
                </dt>
                <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
                  {company?.address || "—"}
                </dd>
              </div>

              <div>
                <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                  {t("homeEstablishmentPage.phone")}
                </dt>
                <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
                  {(company?.phone as string | undefined) || "—"}
                </dd>
              </div>

              <div>
                <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                  {t("homeEstablishmentPage.email")}
                </dt>
                <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
                  {(company?.email as string | undefined) || user?.email || "—"}
                </dd>
              </div>

              {company?.fax && (
                <div>
                  <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                    {t("homeEstablishmentPage.postalBox")}
                  </dt>
                  <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
                    {company.fax}
                  </dd>
                </div>
              )}
            </div>
          </section>

          {/* Section: Administrative Supervision */}
          <section
            style={{
              background: "var(--cam-surface)",
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderRadius: "var(--cam-radius-lg)",
              padding: "var(--cam-space-5) var(--cam-space-6)",
              boxShadow: "var(--cam-shadow-sm)",
            }}
          >
            <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: "0 0 var(--cam-space-4)", color: "var(--cam-text)" }}>
              {t("homeEstablishmentPage.sectionSupervision")}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))", gap: "var(--cam-space-4)" }}>
              <div>
                <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                  {t("homeEstablishmentPage.region")}
                </dt>
                <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text)" }}>
                  {company?.region || t("homeEstablishmentPage.notSpecified")}
                </dd>
              </div>

              <div>
                <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                  {t("homeEstablishmentPage.department")}
                </dt>
                <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text)" }}>
                  {company?.department || "—"}
                </dd>
              </div>

              <div>
                <dt style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", marginBottom: "var(--cam-space-1)" }}>
                  {t("homeEstablishmentPage.subdivision")}
                </dt>
                <dd style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
                  {company?.subdivision || "—"}
                </dd>
              </div>
            </div>
          </section>

          {/* Section: Request a Change Callout */}
          <section
            style={{
              background: "var(--cam-surface-subtle)",
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderRadius: "var(--cam-radius-lg)",
              padding: "var(--cam-space-5) var(--cam-space-6)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--cam-space-4)",
            }}
          >
            <div style={{ flex: "1 1 20rem" }}>
              <h3 style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: 700, margin: "0 0 var(--cam-space-1)", color: "var(--cam-text)" }}>
                {t("homeEstablishmentPage.requestChangeTitle")}
              </h3>
              <p style={{ margin: 0, fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", lineHeight: "var(--cam-line-height-base)" }}>
                {t("homeEstablishmentPage.requestChangeDesc")}
              </p>
            </div>

            <div>
              <a
                href={changeMailHref}
                className="cam-button cam-button-secondary cam-button-sm"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "var(--cam-space-1)" }}
              >
                <span>✉</span>
                <span>{t("homeEstablishmentPage.requestChangeButton")}</span>
              </a>
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: Settings & Security */}
      {!companyQuery.isLoading && activeTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-6)" }}>
          {/* Change Password Card */}
          <section
            style={{
              background: "var(--cam-surface)",
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderRadius: "var(--cam-radius-lg)",
              padding: "var(--cam-space-5) var(--cam-space-6)",
              boxShadow: "var(--cam-shadow-sm)",
              maxWidth: "36rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-3)" }}>
              <span aria-hidden="true" style={{ fontSize: "var(--cam-font-size-lg)" }}>🔑</span>
              <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: 0, color: "var(--cam-text)" }}>
                {t("homeEstablishmentPage.passwordHeading")}
              </h2>
            </div>

            {passwordSuccess && (
              <div
                role="status"
                style={{
                  background: "var(--cam-green-wash)",
                  color: "var(--cam-green)",
                  padding: "var(--cam-space-3) var(--cam-space-4)",
                  borderRadius: "var(--cam-radius-md)",
                  fontSize: "var(--cam-font-size-sm)",
                  marginBottom: "var(--cam-space-4)",
                }}
              >
                ✓ {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div
                role="alert"
                style={{
                  background: "var(--cam-error-bg)",
                  color: "var(--cam-error)",
                  padding: "var(--cam-space-3) var(--cam-space-4)",
                  borderRadius: "var(--cam-radius-md)",
                  fontSize: "var(--cam-font-size-sm)",
                  marginBottom: "var(--cam-space-4)",
                }}
              >
                ⚠️ {passwordError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-4)" }}>
              <div>
                <label
                  htmlFor="current-password"
                  style={{ display: "block", fontSize: "var(--cam-font-size-xs)", fontWeight: 600, color: "var(--cam-text)", marginBottom: "var(--cam-space-1)" }}
                >
                  {t("homeEstablishmentPage.currentPasswordLabel")}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="cam-input"
                    style={{ width: "100%", paddingRight: "4rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="cam-text-button"
                    style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", fontSize: "var(--cam-font-size-2xs)" }}
                  >
                    {showCurrentPassword ? t("loginPage.hidePasswordButton") : t("loginPage.showPasswordButton")}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="new-password"
                  style={{ display: "block", fontSize: "var(--cam-font-size-xs)", fontWeight: 600, color: "var(--cam-text)", marginBottom: "var(--cam-space-1)" }}
                >
                  {t("homeEstablishmentPage.newPasswordLabel")}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="cam-input"
                    style={{ width: "100%", paddingRight: "4rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="cam-text-button"
                    style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", fontSize: "var(--cam-font-size-2xs)" }}
                  >
                    {showNewPassword ? t("loginPage.hidePasswordButton") : t("loginPage.showPasswordButton")}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  style={{ display: "block", fontSize: "var(--cam-font-size-xs)", fontWeight: 600, color: "var(--cam-text)", marginBottom: "var(--cam-space-1)" }}
                >
                  {t("homeEstablishmentPage.confirmPasswordLabel")}
                </label>
                <input
                  id="confirm-password"
                  type={showNewPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="cam-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={passwordPending || !currentPassword || !newPassword || !confirmPassword}
                  className="cam-button cam-button-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {passwordPending
                    ? t("homeEstablishmentPage.updatingPassword")
                    : t("homeEstablishmentPage.changePasswordButton")}
                </button>
              </div>
            </form>
          </section>

          {/* Account Details & Security Information */}
          <section
            style={{
              background: "var(--cam-surface)",
              border: "var(--cam-border-width) solid var(--cam-border)",
              borderRadius: "var(--cam-radius-lg)",
              padding: "var(--cam-space-5) var(--cam-space-6)",
              boxShadow: "var(--cam-shadow-sm)",
              maxWidth: "36rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)", marginBottom: "var(--cam-space-4)" }}>
              <span aria-hidden="true" style={{ fontSize: "var(--cam-font-size-lg)" }}>🛡️</span>
              <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: 0, color: "var(--cam-text)" }}>
                {t("homeEstablishmentPage.accountSecurityHeading")}
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "var(--cam-border-width) solid var(--cam-border)", paddingBottom: "var(--cam-space-2)" }}>
                <span style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}>
                  {t("homeEstablishmentPage.loginEmailLabel")}
                </span>
                <span style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: 600, color: "var(--cam-text)" }}>
                  {user?.email || "—"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "var(--cam-border-width) solid var(--cam-border)", paddingBottom: "var(--cam-space-2)" }}>
                <span style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}>
                  {t("homeEstablishmentPage.accountStatusLabel")}
                </span>
                <span className="cam-badge cam-badge-success" style={{ fontSize: "var(--cam-font-size-2xs)" }}>
                  {user?.status || "ACTIVE"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}>
                  {t("homeEstablishmentPage.twoFactorHeading")}
                </span>
                <span className={`cam-badge ${user?.twoFactorEnabled ? "cam-badge-success" : "cam-badge-neutral"}`} style={{ fontSize: "var(--cam-font-size-2xs)" }}>
                  {user?.twoFactorEnabled ? t("homeEstablishmentPage.twoFactorEnabled") : t("homeEstablishmentPage.twoFactorDisabled")}
                </span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
