"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ApiError, verifyEmailToken } from "@/lib/api-client";
import { AuthHeader } from "@/components/auth/AuthHeader";

// Ported from lib/screens/verify_email_screen.dart. Flutter routes a
// successful verification to '/home'.
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const t = useTranslations();
  const token = useSearchParams().get("token");
  const [loading, setLoading] = useState(() => !!token);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    verifyEmailToken(token)
      .then((resp) => {
        setSuccess(true);
        setMessage(resp.message);
      })
      .catch((e) => {
        setSuccess(false);
        setMessage(e instanceof ApiError ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <main className="cam-auth-page">
      <div className="wrap">
        <AuthHeader />
        <div className="card">
          <div className="card-body" style={{ textAlign: "center" }}>
            {loading ? (
              <p style={{ color: "var(--muted)", margin: "16px 0" }}>
                {t("verifyEmailPage.verifyingMessage")}
              </p>
            ) : (
              <>
                <span
                  className={`status-pill ${
                    success ? "status-pill--success" : "status-pill--error"
                  }`}
                >
                  {success
                    ? t("verifyEmailPage.successBadge")
                    : t("verifyEmailPage.failureBadge")}
                </span>
                <h1
                  className="brand-name"
                  style={{ fontSize: 18, marginBottom: 8, textAlign: "center" }}
                >
                  {success
                    ? t("verifyEmailPage.successTitle")
                    : t("verifyEmailPage.failureTitle")}
                </h1>
                <p
                  className="brand-sub"
                  style={{ textAlign: "center", marginBottom: 20 }}
                >
                  {message ??
                    (success ? "" : t("verifyEmailPage.invalidLinkMessage"))}
                </p>
                <Link
                  href={success ? "/home" : "/login"}
                  className="btn-primary"
                >
                  {success
                    ? t("verifyEmailPage.continueButton")
                    : t("verifyEmailPage.backToSignInLink")}
                </Link>
              </>
            )}
          </div>
          <div className="card-footer">
            <span className="create-account">
              <Link href="/login">{t("verifyEmailPage.backToSignInLink")}</Link>
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
