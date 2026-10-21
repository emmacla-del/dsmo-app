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

  const accountStatusKey = `adminEtablissementPage.accountStatus.${user?.status ?? "ACTIVE"}`;
  const accountStatus = t.has(accountStatusKey) ? t(accountStatusKey) : user?.status ?? "—";

  return (
    <div className="cam-home-page">
      <header className="cam-home-head">
        <div>
          <h1 className="cam-home-title">{company?.name || t("homeEstablishmentPage.pageTitle")}</h1>
          <p className="cam-home-lede">{t("homeEstablishmentPage.pageSubtitle")}</p>
        </div>
      </header>

      {/* The establishment's record, and the account's settings. */}
      <div className="cam-home-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "record"}
          onClick={() => setActiveTab("record")}
          className="cam-home-tab"
        >
          {t("homeEstablishmentPage.tabRecord")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
          className="cam-home-tab"
        >
          {t("homeEstablishmentPage.tabSettings")}
        </button>
      </div>

      {companyQuery.isLoading && <p className="cam-home-state">{t("common.loading")}</p>}

      {!companyQuery.isLoading && activeTab === "record" && (
        <>
          {/* The registration certificate: this page's one action. */}
          <section className="cam-home-section" aria-labelledby="etab-attestation-heading">
            <h2 id="etab-attestation-heading" className="cam-home-h2">{t("homeEstablishmentPage.attestationTitle")}</h2>
            <p className="cam-home-meta">{t("homeEstablishmentPage.attestationDesc")}</p>
            {attestationError && (
              <div className="cam-admin-notice cam-admin-notice--error" role="alert">
                <span>{attestationError}</span>
              </div>
            )}
            <div className="cam-home-actions">
              <button
                type="button"
                onClick={openAttestation}
                disabled={!canDownloadAttestation || attestationLoading}
                className="cam-button cam-button-primary"
              >
                {attestationLoading
                  ? t("homeEstablishmentPage.attestationLoading")
                  : t("homeEstablishmentPage.attestationDownload")}
              </button>
            </div>
          </section>

          <section className="cam-home-section" aria-labelledby="etab-identity-heading">
            <h2 id="etab-identity-heading" className="cam-home-h2">{t("homeEstablishmentPage.sectionIdentity")}</h2>
            <dl className="cam-home-facts">
              <dt>{t("homeEstablishmentPage.name")}</dt>
              <dd>{company?.name || "—"}</dd>
              <dt>{t("homeEstablishmentPage.entityType")}</dt>
              <dd>{typeLabel}</dd>
              {/* An administration and a project/programme are never asked
                  for a NIU; their row holds an internal `NA-<uuid>`
                  placeholder, which is not a number to show them (B6). */}
              {niu && (
                <>
                  <dt>{t("homeEstablishmentPage.taxNumber")}</dt>
                  <dd>{niu}</dd>
                </>
              )}
              {/* Registration asks for a CNPS number from the same five
                  types as the NIU, so an administration or a
                  project/programme read « Numéro CNPS — » for a question
                  they are never asked. The home header already hid it. */}
              {company?.cnpsNumber && (
                <>
                  <dt>{t("homeEstablishmentPage.cnpsNumber")}</dt>
                  <dd>{company.cnpsNumber}</dd>
                </>
              )}
              <dt>{t("homeEstablishmentPage.mainActivity")}</dt>
              <dd>{company?.mainActivity || "—"}</dd>
              {company?.secondaryActivity && (
                <>
                  <dt>{t("homeEstablishmentPage.secondaryActivity")}</dt>
                  <dd>{company.secondaryActivity}</dd>
                </>
              )}
              {/* The DSMO company profile's headcount. ONEFOP never asks for
                  it, so it stays at 0 and read « 0 déclarés » next to a
                  declaration of 12 (B6): shown only when entered. */}
              {workforce !== null && (
                <>
                  <dt>{t("homeEstablishmentPage.totalEmployees")}</dt>
                  <dd>{t("homeLandingPage.employeesCount", { count: workforce })}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="cam-home-section" aria-labelledby="etab-contact-heading">
            <h2 id="etab-contact-heading" className="cam-home-h2">{t("homeEstablishmentPage.sectionContact")}</h2>
            <dl className="cam-home-facts">
              <dt>{t("homeEstablishmentPage.address")}</dt>
              <dd>{company?.address || "—"}</dd>
              <dt>{t("homeEstablishmentPage.phone")}</dt>
              <dd>{(company?.phone as string | undefined) || "—"}</dd>
              <dt>{t("homeEstablishmentPage.email")}</dt>
              <dd>{(company?.email as string | undefined) || user?.email || "—"}</dd>
              {company?.fax && (
                <>
                  <dt>{t("homeEstablishmentPage.postalBox")}</dt>
                  <dd>{company.fax}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="cam-home-section" aria-labelledby="etab-supervision-heading">
            <h2 id="etab-supervision-heading" className="cam-home-h2">{t("homeEstablishmentPage.sectionSupervision")}</h2>
            <dl className="cam-home-facts">
              <dt>{t("homeEstablishmentPage.region")}</dt>
              <dd>{company?.region || t("homeEstablishmentPage.notSpecified")}</dd>
              <dt>{t("homeEstablishmentPage.department")}</dt>
              <dd>{company?.department || "—"}</dd>
              <dt>{t("homeEstablishmentPage.subdivision")}</dt>
              <dd>{company?.subdivision || "—"}</dd>
            </dl>
          </section>

          <section className="cam-home-section" aria-labelledby="etab-change-heading">
            <h2 id="etab-change-heading" className="cam-home-h2">{t("homeEstablishmentPage.requestChangeTitle")}</h2>
            <p className="cam-home-meta">{t("homeEstablishmentPage.requestChangeDesc")}</p>
            <div className="cam-home-actions">
              <a href={changeMailHref} className="cam-button cam-button-secondary cam-button-sm">
                {t("homeEstablishmentPage.requestChangeButton")}
              </a>
            </div>
          </section>
        </>
      )}

      {!companyQuery.isLoading && activeTab === "settings" && (
        <>
          <section className="cam-home-section" aria-labelledby="etab-password-heading">
            <h2 id="etab-password-heading" className="cam-home-h2">{t("homeEstablishmentPage.passwordHeading")}</h2>

            {passwordSuccess && (
              <div className="cam-admin-notice cam-admin-notice--success" role="status">
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="cam-admin-notice cam-admin-notice--error" role="alert">
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="cam-home-form">
              <div className="cam-field">
                <label className="cam-label" htmlFor="current-password">
                  {t("homeEstablishmentPage.currentPasswordLabel")}
                </label>
                <div className="cam-home-password">
                  <input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="cam-input"
                  />
                  <button type="button" onClick={() => setShowCurrentPassword((prev) => !prev)} className="cam-text-button">
                    {showCurrentPassword ? t("loginPage.hidePasswordButton") : t("loginPage.showPasswordButton")}
                  </button>
                </div>
              </div>

              <div className="cam-field">
                <label className="cam-label" htmlFor="new-password">
                  {t("homeEstablishmentPage.newPasswordLabel")}
                </label>
                <div className="cam-home-password">
                  <input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="cam-input"
                  />
                  <button type="button" onClick={() => setShowNewPassword((prev) => !prev)} className="cam-text-button">
                    {showNewPassword ? t("loginPage.hidePasswordButton") : t("loginPage.showPasswordButton")}
                  </button>
                </div>
              </div>

              <div className="cam-field">
                <label className="cam-label" htmlFor="confirm-password">
                  {t("homeEstablishmentPage.confirmPasswordLabel")}
                </label>
                <input
                  id="confirm-password"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="cam-input"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={passwordPending || !currentPassword || !newPassword || !confirmPassword}
                  className="cam-button cam-button-primary"
                >
                  {passwordPending
                    ? t("homeEstablishmentPage.updatingPassword")
                    : t("homeEstablishmentPage.changePasswordButton")}
                </button>
              </div>
            </form>
          </section>

          <section className="cam-home-section" aria-labelledby="etab-account-heading">
            <h2 id="etab-account-heading" className="cam-home-h2">{t("homeEstablishmentPage.accountSecurityHeading")}</h2>
            <dl className="cam-home-facts">
              <dt>{t("homeEstablishmentPage.loginEmailLabel")}</dt>
              <dd>{user?.email || "—"}</dd>
              <dt>{t("homeEstablishmentPage.accountStatusLabel")}</dt>
              <dd>{accountStatus}</dd>
              <dt>{t("homeEstablishmentPage.twoFactorHeading")}</dt>
              <dd>
                {user?.twoFactorEnabled
                  ? t("homeEstablishmentPage.twoFactorEnabled")
                  : t("homeEstablishmentPage.twoFactorDisabled")}
              </dd>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
