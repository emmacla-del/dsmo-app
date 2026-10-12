"use client";

// The front door, served at "/".
//
// It answers two questions at once, which is why it is laid out the way it
// is. A declarant needs one thing: the route to their declaration. Everyone
// else — the ministry, partners, the public — needs to know what CAMLEAP is,
// what is in service and what is still to come. So the three doors come
// first and the roadmap sits below them: the task owns the top of the page,
// the programme is there for whoever scrolls.
//
// The sign-in form is not here. It lives at /login, where every link in the
// app already pointed (src/app/login/page.tsx).
//
// The lockup is BrandLockup, not a bare <img>: it owns the ONEFOP emblem's
// 56px floor and the endorsement wording that docs/standards/brand.md fixes.

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getOpenCampaigns } from "@/lib/api-client";
import { nextCampaignDeadline } from "@/lib/portal-campaigns";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import styles from "./portal.module.css";

type PhaseState = "live" | "next" | "planned";

const PHASES: { key: string; state: PhaseState }[] = [
  { key: "phase1", state: "live" },
  { key: "phase2", state: "next" },
  { key: "phase3", state: "planned" },
  { key: "phase4", state: "planned" },
];

const DOT: Record<PhaseState, string> = {
  live: styles.dotLive,
  next: styles.dotNext,
  planned: styles.dotPlanned,
};

const STATE_TEXT: Record<PhaseState, string> = {
  live: styles.stateLive,
  next: styles.stateNext,
  planned: styles.statePlanned,
};

export function Portal() {
  const t = useTranslations();
  const locale = useLocale();

  // The next closing date, from the one public campaign route. The page is
  // useful without it, so a failure is silent: no retry, and nothing rendered
  // unless a date actually came back. An anonymous visitor must never meet an
  // error here, and an API that has not deployed this route yet simply leaves
  // the line out rather than showing a date that was invented in the copy.
  const { data: campaigns } = useQuery({
    queryKey: ["public-campaigns-open"],
    queryFn: getOpenCampaigns,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const nextDeadline = nextCampaignDeadline(campaigns);

  const nextDeadlineLabel = nextDeadline
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" })
        .format(new Date(nextDeadline))
    : null;

  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <div className={`${styles.wrap} ${styles.mastheadInner}`}>
          <div>
            <BrandLockup size="hero" />
            <p className={styles.endorsement}>{t("landingPage.endorsement")}</p>
          </div>
          <div className={styles.mastheadActions}>
            <Link href="/login" className="cam-button cam-button-secondary">
              {t("portalPage.signInAction")}
            </Link>
            <LocaleSwitcher variant="masthead" />
          </div>
        </div>
      </header>

      <main>
        {/* ── What this is ── */}
        <section className={`${styles.section} ${styles.bandCream}`}>
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>{t("portalPage.eyebrow")}</p>
            <h1 className={styles.title}>{t("portalPage.title")}</h1>
            <p className={styles.lede}>{t("portalPage.lede")}</p>
            <p className={`${styles.status} ${styles.stateLive}`}>
              <span className={`${styles.dot} ${styles.dotLive}`} aria-hidden="true" />
              {t("portalPage.phaseStatus")}
              {nextDeadlineLabel ? (
                <span className={styles.deadline}>
                  {t("portalPage.nextDeadline", { date: nextDeadlineLabel })}
                </span>
              ) : null}
            </p>
          </div>
        </section>

        {/* ── The three doors ── */}
        <section className={`${styles.section} ${styles.bandWhite}`}>
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>{t("portalPage.doorsEyebrow")}</p>
            <h2 className={styles.heading}>{t("portalPage.doorsHeading")}</h2>
            <p className={styles.intro}>{t("portalPage.doorsIntro")}</p>

            <div className={styles.doors}>
              <section className={styles.door}>
                <div className={styles.doorBody}>
                  <p className={styles.doorEyebrow}>{t("portalPage.door1Eyebrow")}</p>
                  <h3 className={styles.doorTitle}>{t("portalPage.door1Title")}</h3>
                  <p className={styles.doorDesc}>{t("portalPage.door1Desc")}</p>
                  <p className={styles.doorRequirement}>{t("portalPage.door1Requirement")}</p>
                </div>
                <p className={styles.doorAction}>
                  <Link
                    href="/register?type=enterprise"
                    className="cam-button cam-button-primary cam-button-block"
                  >
                    {t("portalPage.door1Action")}
                  </Link>
                </p>
              </section>

              <section className={styles.door}>
                <div className={styles.doorBody}>
                  <p className={styles.doorEyebrow}>{t("portalPage.door2Eyebrow")}</p>
                  <h3 className={styles.doorTitle}>{t("portalPage.door2Title")}</h3>
                  <p className={styles.doorDesc}>{t("portalPage.door2Desc")}</p>
                  <p className={styles.doorRequirement}>{t("portalPage.door2Requirement")}</p>
                </div>
                <p className={styles.doorAction}>
                  <Link
                    href="/register?type=vocationalTraining"
                    className="cam-button cam-button-primary cam-button-block"
                  >
                    {t("portalPage.door2Action")}
                  </Link>
                </p>
              </section>

              {/* Tracking and receipts live inside the account: there is no
                  public lookup, so this door says so rather than asking for a
                  reference it cannot resolve. */}
              <section className={styles.door}>
                <div className={styles.doorBody}>
                  <p className={styles.doorEyebrow}>{t("portalPage.door3Eyebrow")}</p>
                  <h3 className={styles.doorTitle}>{t("portalPage.door3Title")}</h3>
                  <p className={styles.doorDesc}>{t("portalPage.door3Desc")}</p>
                  <p className={styles.doorRequirement}>{t("portalPage.door3Requirement")}</p>
                </div>
                <p className={styles.doorAction}>
                  <Link href="/login" className="cam-button cam-button-secondary cam-button-block">
                    {t("portalPage.door3Action")}
                  </Link>
                </p>
              </section>
            </div>

          </div>
        </section>

        {/* ── What a declaration commits you to, and what it returns ── */}
        <section className={`${styles.section} ${styles.bandTeal}`}>
          <div className={styles.wrap}>
            <div className={`${styles.notice} ${styles.noticeObligation}`}>
              <p>
                <span className={styles.noticeLabel}>{t("portalPage.authorityLabel")}</span>{" "}
                {t("portalPage.authorityBody")}
              </p>
            </div>
            <div className={styles.notice}>
              <p>
                <span className={styles.noticeLabel}>{t("portalPage.receiptLabel")}</span>{" "}
                {t("portalPage.receiptBody")}
              </p>
            </div>
          </div>
        </section>

        {/* ── The programme ── */}
        <section className={`${styles.section} ${styles.bandCream}`}>
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>{t("portalPage.roadmapEyebrow")}</p>
            <h2 className={styles.heading}>{t("portalPage.roadmapHeading")}</h2>
            <p className={styles.intro}>{t("portalPage.roadmapIntro")}</p>

            <ul className={styles.roadmap}>
              {PHASES.map(({ key, state }) => (
                <li key={key} className={styles.phase}>
                  <div className={styles.phaseHeader}>
                    <h3 className={styles.phaseTitle}>{t(`portalPage.${key}Title`)}</h3>
                    <p className={`${styles.status} ${STATE_TEXT[state]}`}>
                      <span className={`${styles.dot} ${DOT[state]}`} aria-hidden="true" />
                      {t(`portalPage.${key}Status`)}
                    </p>
                  </div>
                  <p className={styles.phaseDesc}>{t(`portalPage.${key}Desc`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Assistance ── */}
        <section className={`${styles.section} ${styles.bandWhite}`}>
          <div className={styles.wrap}>
            <p className={styles.eyebrow}>{t("portalPage.helpEyebrow")}</p>
            <h2 className={styles.heading}>{t("portalPage.helpHeading")}</h2>
            <p className={styles.intro}>{t("portalPage.helpBody")}</p>
            <p className={styles.helpChannel}>
              <span className={styles.noticeLabel}>{t("portalPage.helpChannelLabel")}</span>{" "}
              <a href="https://wa.me/237651965905" target="_blank" rel="noopener noreferrer">
                {t("portalPage.helpWhatsapp")}
              </a>
              {" · "}
              <Link href="/login">{t("portalPage.forgotIdentifierLink")}</Link>
            </p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerRow}`}>
          <div>
            {t("portalPage.footerBody")}
            <p className={styles.footerMinistry}>{t("portalPage.footerMinistry")}</p>
          </div>
          <Link href="/login">{t("portalPage.signInAction")}</Link>
        </div>
      </footer>
    </div>
  );
}
