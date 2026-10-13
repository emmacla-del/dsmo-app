"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PORTAL_DOORS, type PortalDoor } from "./portal-content";
import { PortalDialog } from "./PortalDialog";
import styles from "../portal.module.css";

// The Declare view: one frame holding the view's header, the routes into the
// collection, and the way on.
//
// Stacked rows rather than three cards side by side. The reference mockup
// stacks its actions, and the routes are not a menu to compare: they are three
// answers to "which one am I", and the one that applies is read, not weighed.
//
// Each row also opens a dialog with what that route actually involves — who it
// is for, what identifier it needs, what it returns. That detail belongs behind
// a disclosure rather than in the row: someone choosing a route needs the title
// and the action, and everything else competes with them.

export function PortalDeclare() {
  const t = useTranslations();
  const [openDoor, setOpenDoor] = useState<PortalDoor["key"] | null>(null);

  return (
    <section className={`${styles.section} ${styles.bandCream}`}>
      <div className={styles.wrap}>
        <div className={styles.flowFrame}>
          <div className={styles.flowHeader}>
            <p className={styles.eyebrow}>{t("portalPage.doorsEyebrow")}</p>
            <h1 className={styles.title}>{t("portalPage.doorsHeading")}</h1>
            <p className={styles.flowHint}>{t("portalPage.doorsIntro")}</p>
          </div>

          <div className={styles.flowPanel}>
            <h2 className={styles.heading}>{t("portalPage.declarePanelHeading")}</h2>
            <p className={styles.flowHint}>{t("portalPage.declarePanelHint")}</p>

            <ul className={styles.actionList}>
              {PORTAL_DOORS.map(({ key, href, variant }) => (
                <li key={key} className={styles.actionRow}>
                  <h3 className={styles.actionRowTitle}>{t(`portalPage.${key}Title`)}</h3>
                  <p className={styles.actionRowDesc}>{t(`portalPage.${key}Desc`)}</p>
                  <p className={styles.actionRowRequirement}>{t(`portalPage.${key}Requirement`)}</p>
                  <p className={styles.actionRowActions}>
                    <Link href={href} className={`cam-button cam-button-${variant}`}>
                      {t(`portalPage.${key}Action`)}
                    </Link>
                    <button
                      type="button"
                      className={styles.detailsButton}
                      onClick={() => setOpenDoor(key)}
                      // The visible label is the same on all three, so the
                      // accessible name names the route it belongs to.
                      aria-label={t("portalPage.dialogDetailsFor", {
                        door: t(`portalPage.${key}Title`),
                      })}
                    >
                      {t("portalPage.dialogDetails")}
                    </button>
                  </p>
                </li>
              ))}
            </ul>

            <div className={styles.notice}>
              <p>
                <span className={styles.noticeLabel}>{t("portalPage.helpAccountLabel")}</span>{" "}
                {t("portalPage.helpAccountBody")}
              </p>
            </div>
          </div>

          <div className={styles.flowDock}>
            <Link href="/" className="cam-button cam-button-secondary">
              {t("portalPage.declareBackAction")}
            </Link>
            <Link href="/assistance" className="cam-button cam-button-secondary">
              {t("portalPage.declareHelpAction")}
            </Link>
          </div>
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
