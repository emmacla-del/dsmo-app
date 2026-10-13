"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PORTAL_REGISTRATIONS, type PortalRegistration } from "./portal-content";
import { PortalDialog } from "./PortalDialog";
import styles from "../portal.module.css";

// The Declare view: a start page, not a menu.
//
// No entity submits anything without registering first, so the page says that
// before it offers anything, and then branches on the only question that
// actually divides its visitors: is this your first declaration, or do you
// already have an account. Signing in used to sit here as a third pathway
// beside the two registrations, titled as though it were a different kind of
// journey; it is one line and the masthead's button.
//
// Each registration route opens a dialog with what it involves — who it is
// for, what identifier it needs, what it returns. That detail belongs behind a
// disclosure: someone choosing a route needs the title and the action, and
// everything else competes with them.

export function PortalDeclare() {
  const t = useTranslations();
  const [openRoute, setOpenRoute] = useState<PortalRegistration["key"] | null>(null);

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
            {/* The prerequisite, before anything is offered. */}
            <p className={styles.declareRequirement}>{t("portalPage.heroRequirement")}</p>

            <div className={styles.branch}>
              <h2 className={styles.heading}>{t("portalPage.declareBranchNewHeading")}</h2>
              <p className={styles.flowHint}>{t("portalPage.declarePanelHint")}</p>

              <ul className={styles.actionList}>
                {PORTAL_REGISTRATIONS.map(({ key, href }) => (
                  <li key={key} className={styles.actionRow}>
                    <h3 className={styles.actionRowTitle}>{t(`portalPage.${key}Title`)}</h3>
                    <p className={styles.actionRowDesc}>{t(`portalPage.${key}Desc`)}</p>
                    <p className={styles.actionRowRequirement}>{t(`portalPage.${key}Requirement`)}</p>
                    <p className={styles.actionRowActions}>
                      <Link href={href} className="cam-button cam-button-primary">
                        {t(`portalPage.${key}Action`)}
                      </Link>
                      <button
                        type="button"
                        className={styles.detailsButton}
                        onClick={() => setOpenRoute(key)}
                        // The visible label is the same on both, so the
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
            </div>

            <div className={styles.branch}>
              <h2 className={styles.heading}>{t("portalPage.declareBranchReturningHeading")}</h2>
              <p className={styles.flowHint}>{t("portalPage.declareBranchReturningBody")}</p>
              <p className={styles.actionRowActions}>
                <Link href="/login" className="cam-button cam-button-secondary">
                  {t("portalPage.signInAction")}
                </Link>
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

      {PORTAL_REGISTRATIONS.map(({ key }) => (
        <PortalDialog
          key={key}
          open={openRoute === key}
          onClose={() => setOpenRoute(null)}
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
