// The home hero visual: the CAMLEAP project journey, in six scenes of
// 5.5 s (a 33-second CSS-only loop), the story of the original animation:
// paper → digital → curated data → analysis → informing every stakeholder
// → the programme's phases.
//
// The paper page is page 1 of the official enterprise questionnaire
// (docs/official_forms/Questionnaire_ENTREPRISES ONEFOP .pdf), the layout
// the platform's PDF service prints, rendered to
// public/images/hero/questionnaire-entreprises-p1.webp. In scene 1 the
// camera moves in on Section 1 and a pen writes Boulangerie du Port's
// answers (S1Q01, S1Q02, S1Q10); scene 2 shows the same answers typed on a
// laptop, as in the original animation.
//
// Legibility: ink on a white outlined panel, teal for what is current
// (2026-10-21; it was white on the dark green). Nothing is told by colour
// alone: the current scene's segment is teal and longer, statuses carry a
// symbol and a word, the duplicate is struck out, and every bar carries its
// label and value. JourneyPlayer adds the pause control the 33-second loop
// needs (WCAG 2.2.2).
import Image from "next/image";
import { Caveat } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { JourneyPlayer } from "./JourneyPlayer";
import styles from "./project-journey-hero.module.css";

// The handwriting on the paper form, as in the original animation.
const handwriting = Caveat({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

const PAPER_SRC = "/images/hero/questionnaire-entreprises-p1.webp";
// The same scan at 10px wide, shown blurred until the scan arrives, so the
// first frame is the page rather than a blank sheet (2026-10-21). Regenerate
// it with sharp if the scan changes.
const PAPER_BLUR =
  "data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAACQAgCdASoKAA4AA4BaJZQCdH8GJ/gbh+hSTKtfgAD+8j1jjC/j5lgK5316yLlwruymHm91fl/CkL7wlrfOmIsSgrBFVpWAAAA=";

const SCENES = [1, 2, 3, 4, 5, 6] as const;

// Illustrative organisations, as in the original animation.
const ROWS = [
  { ref: "E-0412", org: "Boulangerie du Port SARL", status: "valid" },
  { ref: "E-0413", org: "Coop. agricole du Moungo", status: "valid" },
  { ref: "E-0414", org: "Atelier Couture Ngo", status: "corrected" },
  { ref: "E-0415", org: "TechHub Bonapriso", status: "valid" },
  { ref: "E-0416", org: "Boulangerie du Port SARL", status: "duplicate" },
] as const;

const SECTORS = [
  { n: 1, pct: 22 },
  { n: 2, pct: 31 },
  { n: 3, pct: 47 },
] as const;

const delay = (seconds: number) =>
  ({ "--i": `${seconds}s` }) as React.CSSProperties;

export async function ProjectJourneyHero() {
  const t = await getTranslations("site");

  return (
    <JourneyPlayer pauseLabel={t("journeyPause")} playLabel={t("journeyPlay")}>
      <div className={styles.panel} role="img" aria-label={t("journeyLabel")}>
        <div className={styles.head} aria-hidden="true">
          <span className={styles.kicker}>{t("journeyKicker")}</span>
          <ol className={styles.dots}>
            {SCENES.map((n) => (
              <li key={n} className={styles[`d${n}`]} />
            ))}
          </ol>
        </div>

        <div className={styles.stage} aria-hidden="true">
          {/* 1 · From paper… */}
          <div className={`${styles.scene} ${styles.s1}`}>
            <div className={`${styles.paperBig} ${handwriting.className}`}>
              <Image
                src={PAPER_SRC}
                alt=""
                width={1400}
                height={1980}
                sizes="(max-width: 900px) 100vw, 700px"
                placeholder="blur"
                blurDataURL={PAPER_BLUR}
                priority
              />
              <span className={`${styles.ink} ${styles.ink1}`}>2</span>
              <span className={`${styles.ink} ${styles.ink2}`}>
                Boulangerie du Port SARL
              </span>
              <span className={`${styles.ink} ${styles.ink3}`}>2&nbsp;4</span>
              <span className={styles.pen}>
                <svg viewBox="0 0 100 12" aria-hidden="true">
                  <path d="M0 6l9-3.2v6.4z" />
                  <rect x="9" y="2.8" width="9" height="6.4" />
                  <rect x="18" y="2.2" width="82" height="7.6" rx="3.8" />
                  <rect x="66" y="0.4" width="24" height="2.2" rx="1.1" />
                </svg>
              </span>
            </div>
          </div>

          {/* 2 · …to digital */}
          <div className={`${styles.scene} ${styles.s2}`}>
            <div className={styles.paperSmall}>
              <Image
                src={PAPER_SRC}
                alt=""
                width={1400}
                height={1980}
                sizes="(max-width: 900px) 35vw, 180px"
                placeholder="blur"
                blurDataURL={PAPER_BLUR}
              />
            </div>
            <div className={styles.laptop}>
              <div className={styles.lid}>
                <div className={styles.screen}>
                  <div className={styles.screenBar}>
                    <span />
                    <span />
                    <span />
                    <strong>CAMLEAP</strong>
                  </div>
                  <div className={styles.form}>
                    <p className={styles.cardTitle}>{t("journeyFormTitle")}</p>
                    {[1, 2, 3].map((n) => (
                      <div key={n} className={styles.field}>
                        <span className={styles.fieldLabel}>
                          {t(`journeyField${n}Label`)}
                        </span>
                        <span
                          className={styles.fieldBox}
                          style={delay([0.9, 2, 2.8][n - 1])}
                        >
                          <span className={styles.fieldValue}>
                            {t(`journeyField${n}Value`)}
                          </span>
                        </span>
                      </div>
                    ))}
                    <div className={styles.formFoot}>
                      <span className={styles.submit}>{t("journeySubmit")}</span>
                      <span className={styles.toast} style={delay(3.9)}>
                        {t("journeyReceived")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.base} />
            </div>
          </div>

          {/* 3 · Curated data */}
          <div className={`${styles.scene} ${styles.s3}`}>
            <div className={`${styles.card} ${styles.tableCard}`}>
              <p className={styles.cardTitle}>
                {t("journeyTableTitle")}
                <span className={styles.cardNote}>
                  {t("journeyTableRunning")}
                </span>
              </p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("journeyColRef")}</th>
                    <th>{t("journeyColOrg")}</th>
                    <th>{t("journeyColStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, i) => (
                    <tr
                      key={row.ref}
                      className={`${styles.in} ${row.status === "duplicate" ? styles.dup : ""}`}
                      style={delay(0.3 + i * 0.3)}
                    >
                      <td>{row.ref}</td>
                      <td>
                        <span className={styles.org}>{row.org}</span>
                      </td>
                      <td className={styles.status}>
                        {row.status === "valid" && t("journeyValid")}
                        {row.status === "duplicate" && t("journeyDuplicate")}
                        {row.status === "corrected" && (
                          <span className={styles.swap}>
                            <span
                              className={styles.swapBefore}
                              style={delay(2.5)}
                            >
                              {t("journeyCheckStaff")}
                            </span>
                            <span className={styles.swapAfter} style={delay(2.5)}>
                              {t("journeyCorrected")}
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className={styles.checks}>
                {[1, 2, 3].map((n) => (
                  <li key={n} className={styles.in} style={delay(3.1 + n * 0.3)}>
                    {t(`journeyCheck${n}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 4 · Rigorous analysis */}
          <div className={`${styles.scene} ${styles.s4}`}>
            <div className={`${styles.card} ${styles.dashCard}`}>
              <p className={styles.cardTitle}>
                {t("journeyDashTitle")}
                <span className={styles.cardNote}>{t("journeyDashNote")}</span>
              </p>
              <p className={styles.chartTitle}>{t("journeyChartTitle")}</p>
              <ul className={styles.bars}>
                {SECTORS.map(({ n, pct }) => (
                  <li key={n}>
                    <span className={styles.barLabel}>
                      {t(`journeySector${n}`)}
                    </span>
                    <span className={styles.barTrack}>
                      <span
                        className={styles.bar}
                        style={{
                          ...delay(0.4 + n * 0.3),
                          width: `${(pct / 47) * 100}%`,
                        }}
                      />
                    </span>
                    <span
                      className={`${styles.barValue} ${styles.in}`}
                      style={delay(1.4 + n * 0.3)}
                    >
                      {pct} %
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 5 · Informing every stakeholder */}
          <div className={`${styles.scene} ${styles.s5}`}>
            <div className={`${styles.card} ${styles.bulletin}`}>
              <span className={styles.bulletinKicker}>
                {t("journeyBulletinKicker")}
              </span>
              <strong>{t("journeyBulletinTitle")}</strong>
              <span className={styles.cardNote}>ONEFOP · CAMLEAP</span>
            </div>
            <svg
              className={styles.links}
              viewBox="0 0 300 100"
              preserveAspectRatio="none"
            >
              <path
                d="M150 0 C150 50 50 50 50 100"
                pathLength={1}
                style={delay(0.8)}
              />
              <path d="M150 0 L150 100" pathLength={1} style={delay(1.0)} />
              <path
                d="M150 0 C150 50 250 50 250 100"
                pathLength={1}
                style={delay(1.2)}
              />
            </svg>
            <ul className={styles.nodes}>
              {[1, 2, 3].map((n) => (
                <li
                  key={n}
                  className={`${styles.card} ${styles.in}`}
                  style={delay(1.3 + n * 0.3)}
                >
                  <strong>{t(`journeyNode${n}Title`)}</strong>
                  <span>{t(`journeyNode${n}Body`)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 6 · The programme */}
          <div className={`${styles.scene} ${styles.s6}`}>
            <ol className={styles.phases}>
              {[1, 2, 3, 4].map((n) => (
                <li
                  key={n}
                  className={`${styles.in} ${n === 1 ? styles.phaseNow : ""}`}
                  style={delay(0.3 + n * 0.3)}
                >
                  <span className={styles.phaseDot}>{n}</span>
                  <span className={styles.phaseTitle}>
                    {t(`homePhase${n}Title`)}
                  </span>
                  {n === 1 && (
                    <span className={styles.pill}>{t("currentPilot")}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className={styles.captions} aria-hidden="true">
          {SCENES.map((n) => (
            <p key={n} className={`${styles.caption} ${styles[`c${n}`]}`}>
              <strong>{t(`journeyCap${n}Title`)}</strong>
              <span>{t(`journeyCap${n}Body`)}</span>
            </p>
          ))}
        </div>
      </div>
    </JourneyPlayer>
  );
}
