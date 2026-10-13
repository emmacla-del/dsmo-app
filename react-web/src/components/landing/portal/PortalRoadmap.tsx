"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PORTAL_PHASES, type PortalPhaseState } from "./portal-content";
import { PortalStatus } from "./PortalStatus";
import styles from "../portal.module.css";

// The programme's four phases, each with the state it is actually in. This
// sits below the doors on purpose: a declarant under a deadline should not
// have to scroll past the roadmap to reach their declaration.
//
// The phases are <details> rather than a plain list so the four titles can be
// scanned without four paragraphs in the way, and the filter narrows them to
// one state at a time. Filtering is a visual change with no visible control
// to announce it, so the count goes through a live region — otherwise a
// screen-reader user presses "Planifiées" and nothing is said at all.

type Filter = "all" | PortalPhaseState;

const FILTERS: { value: Filter; labelKey: string }[] = [
  { value: "all", labelKey: "portalPage.filterAll" },
  { value: "live", labelKey: "portalPage.filterLive" },
  { value: "next", labelKey: "portalPage.filterNext" },
  { value: "planned", labelKey: "portalPage.filterPlanned" },
];

const STATE_CARDS: { key: string; state: PortalPhaseState }[] = [
  { key: "stateCard1", state: "live" },
  { key: "stateCard2", state: "next" },
  { key: "stateCard3", state: "planned" },
];

export function PortalRoadmap() {
  const t = useTranslations();
  const [filter, setFilter] = useState<Filter>("all");

  const shown = PORTAL_PHASES.filter((phase) => filter === "all" || phase.state === filter);
  const activeLabel = FILTERS.find((entry) => entry.value === filter)?.labelKey;

  return (
    <section id="feuille" className={`${styles.section} ${styles.bandWhite}`}>
      <div className={`${styles.wrap} ${styles.roadmapGrid}`}>
        <div>
          <p className={styles.eyebrow}>{t("portalPage.roadmapEyebrow")}</p>
          <h1 className={styles.title}>{t("portalPage.roadmapHeading")}</h1>
          <p className={styles.intro}>{t("portalPage.roadmapIntro")}</p>

          <div className={`${styles.notice} ${styles.noticeCurrent}`}>
            <p className={styles.eyebrow}>{t("portalPage.roadmapCurrentLabel")}</p>
            <p className={styles.phaseTitle}>{t("portalPage.roadmapCurrentTitle")}</p>
            <p className={styles.phaseDesc}>{t("portalPage.roadmapCurrentBody")}</p>
          </div>

          <div className={styles.oversight}>
            <span className={styles.noticeLabel}>{t("portalPage.roadmapOversightLabel")}</span>{" "}
            {t("portalPage.roadmapOversightBody")}
          </div>
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

          {/* The three states at a glance, so the console says what the
              filters are filtering before anything is pressed. */}
          <div className={styles.stateCards}>
            {STATE_CARDS.map(({ key, state }) => (
              <div key={key} className={styles.stateCard}>
                <PortalStatus state={state}>{t(`portalPage.${key}Title`)}</PortalStatus>
                <p className={styles.stateCardBody}>{t(`portalPage.${key}Body`)}</p>
              </div>
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
                <details>
                  <summary className={styles.phaseSummary}>
                    <span className={styles.phaseTitle}>{t(`portalPage.${key}Title`)}</span>
                    <PortalStatus state={state}>{t(`portalPage.${key}Status`)}</PortalStatus>
                  </summary>
                  <p className={styles.phaseDesc}>{t(`portalPage.${key}Desc`)}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
