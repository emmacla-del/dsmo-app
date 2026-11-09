"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Foot of every console page (canvas boards, 2026-11-08): who runs the
 * platform, and where to find help and the data-protection notice. There is
 * no accessibility statement page yet, so the board's « Accessibilité » link
 * is left out rather than pointed at nothing.
 */
export function AdminFooter() {
  const t = useTranslations("adminLayout");
  const year = new Date().getFullYear();
  return (
    <footer className="cam-admin-footer">
      <span>{t("footerOwner", { year })}</span>
      <span className="cam-admin-footer-links">
        <Link href="/assistance#confidentialite">{t("footerPrivacy")}</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/assistance">{t("footerHelp")}</Link>
      </span>
    </footer>
  );
}
