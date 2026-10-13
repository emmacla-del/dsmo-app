"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PORTAL_DOORS, type PortalDoor } from "./portal-content";
import { PortalDialog } from "./PortalDialog";
import styles from "../portal.module.css";

// The three routes a visitor can take, as parallel alternatives. Each is
// bounded because the border is what makes them read as a choice; the two
// declaration doors lead, the third is secondary because following an
// existing dossier is not what most arrivals are here to do.
//
// Each door also opens a dialog with what it actually involves — who it is
// for, what identifier it needs, what it returns. That detail belongs behind
// a disclosure rather than in the card: a visitor choosing a door needs the
// title and the action, and everything else competes with them.

const TONE: Record<PortalDoor["tone"], string> = {
  plain: styles.doorPlain,
  soft: styles.doorSoft,
  ink: styles.doorInk,
};

export function PortalDoors() {
  const t = useTranslations();
  const [openDoor, setOpenDoor] = useState<PortalDoor["key"] | null>(null);

  return (
    <section id="parcours" className={`${styles.section} ${styles.bandWhite}`}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("portalPage.doorsEyebrow")}</p>
        <h1 className={styles.title}>{t("portalPage.doorsHeading")}</h1>
        <p className={styles.intro}>{t("portalPage.doorsIntro")}</p>

        <div className={styles.doors}>
          {PORTAL_DOORS.map(({ key, href, variant, tone }) => (
            <section key={key} className={`${styles.door} ${TONE[tone]}`}>
              <div className={styles.doorBody}>
                <p className={styles.doorEyebrow}>{t(`portalPage.${key}Eyebrow`)}</p>
                <h3 className={styles.doorTitle}>{t(`portalPage.${key}Title`)}</h3>
                <p className={styles.doorDesc}>{t(`portalPage.${key}Desc`)}</p>
                <p className={styles.doorRequirement}>{t(`portalPage.${key}Requirement`)}</p>
              </div>
              <div className={styles.doorAction}>
                <Link
                  href={href}
                  className={`cam-button cam-button-${variant} cam-button-block`}
                >
                  {t(`portalPage.${key}Action`)}
                </Link>
                <p className={styles.doorDetails}>
                  <button
                    type="button"
                    className={styles.detailsButton}
                    onClick={() => setOpenDoor(key)}
                    // The visible label is the same on all three, so the
                    // accessible name names the door it belongs to.
                    aria-label={t("portalPage.dialogDetailsFor", {
                      door: t(`portalPage.${key}Title`),
                    })}
                  >
                    {t("portalPage.dialogDetails")}
                  </button>
                </p>
              </div>
            </section>
          ))}
        </div>
      </div>

      {PORTAL_DOORS.map(({ key }) => (
        <PortalDialog
          key={key}
          open={openDoor === key}
          onClose={() => setOpenDoor(null)}
          titleId={`portal-dialog-${key}`}
        >
          <h2 id={`portal-dialog-${key}`} className={styles.dialogTitle}>
            {t(`portalPage.${key}Title`)}
          </h2>
          <p className={styles.dialogRow}>
            <span className={styles.noticeLabel}>{t("portalPage.dialogAudienceLabel")}</span>{" "}
            {t(`portalPage.${key}Audience`)}
          </p>
          <p className={styles.dialogRow}>
            <span className={styles.noticeLabel}>{t("portalPage.dialogRequirementLabel")}</span>{" "}
            {t(`portalPage.${key}Requirement`)}
          </p>
          <p className={styles.dialogRow}>
            <span className={styles.noticeLabel}>{t("portalPage.dialogOutcomeLabel")}</span>{" "}
            {t(`portalPage.${key}Outcome`)}
          </p>
        </PortalDialog>
      ))}
    </section>
  );
}
