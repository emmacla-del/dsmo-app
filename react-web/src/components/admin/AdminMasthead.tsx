"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { useAuthStore } from "@/lib/auth-store";
import { adminHomeFor } from "@/lib/nav-profiles";

/**
 * The national coat of arms, vector (600×680), supplied by the owner on
 * 2026-11-08. It replaces nothing: the two raster files in public/images (a
 * blurred 360px copy and a watermarked stock preview) are not fit for an
 * official screen and are not used. If the file ever fails to load, the
 * masthead names the Republic in words alone.
 */
export const COAT_OF_ARMS_SRC = "/images/cameroon-coat-of-arms.svg";

export interface AdminMastheadProps {
  /** « Ressort : National », already worded. */
  scopeLabel: string;
  scopeTitle: string;
  /** The drawer toggle; shown below 1024px only (CSS). */
  menuButton?: ReactNode;
}

/**
 * Institutional header of every staff-console page (admin-layout-spec §2,
 * revision 3): the national tricolour, the Republic and ministry line with
 * the coat of arms, then the application bar (CAMLEAP, the console name, the
 * enforced territorial scope and notifications). The account menu stays in
 * the rail. Brand rule (docs/standards/brand.md): the State speaks in the
 * band, CAMLEAP is the product in the bar; no ONEFOP seal below 56px, so
 * ONEFOP is named in words.
 */
export function AdminMasthead({ scopeLabel, scopeTitle, menuButton }: AdminMastheadProps) {
  const t = useTranslations("adminLayout");
  const [armsAvailable, setArmsAvailable] = useState(true);
  const role = useAuthStore((s) => s.user?.role);

  return (
    <header className="cam-admin-masthead" aria-label={t("mastheadAriaLabel")}>
      <div className="cam-admin-masthead-gov">
        <div className="cam-admin-masthead-state">
          {armsAvailable && (
            // A plain <img>: next/image would route an SVG through the
            // optimiser, which refuses it, and the file is already vector.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={COAT_OF_ARMS_SRC}
              alt={t("coatOfArmsAlt")}
              className="cam-admin-masthead-arms"
              width={35}
              height={40}
              onError={() => setArmsAvailable(false)}
            />
          )}
          <span className="cam-admin-masthead-republic">
            <strong>{t("mastheadRepublic")}</strong>
            <span>{t("mastheadMotto")}</span>
          </span>
        </div>
        <span className="cam-admin-masthead-ministry">
          {t("mastheadMinistry")}
          <span aria-hidden="true"> · </span>
          {t("mastheadPlatform")}
        </span>
      </div>
      <div className="cam-admin-masthead-bar">
        {menuButton}
        <Link href={adminHomeFor(role)} className="cam-admin-masthead-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/camleap-logo.svg" alt="CAMLEAP" width={142} height={20} />
          <span className="cam-admin-masthead-console">{t("consoleName")}</span>
        </Link>
        <div className="cam-admin-masthead-actions">
          <span className="cam-admin-masthead-scope" title={scopeTitle}>
            <Lock size={14} aria-hidden="true" />
            {scopeLabel}
          </span>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
