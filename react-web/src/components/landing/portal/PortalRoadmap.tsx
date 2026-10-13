"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PORTAL_PHASES, type PortalPhaseState } from "./portal-content";
import { PortalStatus } from "./PortalStatus";
import styles from "../portal.module.css";

// The programme's four phases, each carrying the state it is actually in, on
// the one dark ground in the page body — the reference mockup's own treatment
// for this view.
//
// The phases are cards rather than accordions: there are four of them and
// three lines each, so hiding the text behind a disclosure buys nothing and
// costs a click. The filter narrows them to one state at a time. Filtering is
// a visual change with no visible control of its own to announce, so the count
// goes through a live region — otherwise a screen-reader user presses
// "Planifiées" and nothing is said at all.

type Filter = "all" | PortalPhaseState;

const FILTERS: { value: Filter; labelKey: string }[] = [
  { value: "all", labelKey: "portalPage.filterAll" },
  { value: "live", labelKey: "portalPage.filterLive" },
  { value: "next", labelKey: "portalPage.filterNext" },
  { value: "planned", labelKey: "portalPage.filterPlanned" },
];

export function PortalRoadmap() {
  const t = useTranslations();
  const [filter, setFilter] = useState<Filter>("all");

  const shown = PORTAL_PHASES.filter((phase) => filter === "all" || phase.state === filter);
  const activeLabel = FILTERS.find((entry) => entry.value === filter)?.labelKey;

  return (
    <section className={`${styles.section} ${styles.bandInk}`}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{t("portalPage.roadmapEyebrow")}</p>
        <h1 className={styles.title}>{t("portalPage.roadmapHeading")}</h1>
        <p className={styles.intro}>{t("portalPage.roadmapIntro")}</p>

        <div className={styles.roadmapIntroRow}>
          <div className={`${styles.notice} ${styles.noticeCurrent}`}>
            <p className={styles.eyebrow}>{t("portalPage.roadmapCurrentLabel")}</p>
            <p className={styles.phaseTitle}>{t("portalPage.roadmapCurrentTitle")}</p>
            <p className={styles.phaseDesc}>{t("portalPage.roadmapCurrentBody")}</p>
          </div>

          <p className={styles.oversight}>
            <span className={styles.noticeLabel}>{t("portalPage.roadmapOversightLabel")}</span>{" "}
            {t("portalPage.roadmapOversightBody")}
          </p>
        </div>

        <div className={styles.console}>
          <div className={styles.filters} role="group" aria-label={t("portalPage.filterLabel")}>
            {FILTERS.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                className={styles.filter}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <p className={styles.filterNote} role="status">
            {filter === "all"
              ? t("portalPage.filterAllNote")
              : t("portalPage.filterNote", {
                  count: shown.length,
                  stage: activeLabel ? t(activeLabel) : "",
                })}
          </p>

          <ul className={styles.roadmap} aria-label={t("portalPage.roadmapListLabel")}>
            {shown.map(({ key, state }) => (
              <li key={key} className={styles.phase}>
                <p className={styles.phaseIndex}>
                  {String(PORTAL_PHASES.findIndex((phase) => phase.key === key) + 1).padStart(2, "0")}
                </p>
                <h2 className={styles.phaseTitle}>{t(`portalPage.${key}Title`)}</h2>
                <p className={styles.phaseDesc}>{t(`portalPage.${key}Desc`)}</p>
                <PortalStatus state={state}>{t(`portalPage.${key}Status`)}</PortalStatus>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
