import { useTranslations } from "next-intl";
import { HELP_FAQ, SITE_CONTACT } from "./site-content";
import { SiteCta } from "./SiteCta";
import styles from "../portal.module.css";

// Assistance: who responds and what to prepare, the four steps (the
// registration assistant's six screens inside step 1), assisted
// registration, the FAQ, and the two published contacts.

function EntityCard({
  id,
  prefix,
  tags,
}: {
  id: string;
  prefix: "helpEmployers" | "helpCentres";
  tags: number;
}) {
  const t = useTranslations("site");
  return (
    <div className={styles.card} id={id}>
      <h3>{t(`${prefix}Title`)}</h3>
      <p className={styles.muted}>{t(`${prefix}Body`)}</p>
      <ul className={styles.tags}>
        {Array.from({ length: tags }, (_, i) => (
          <li key={i}>{t(`${prefix}Tag${i + 1}`)}</li>
        ))}
      </ul>
      <dl className={styles.facts}>
        <div>
          <dt>{t("helpPrepareLabel")}</dt>
          <dd>{t(`${prefix}Prepare`)}</dd>
        </div>
        <div>
          <dt>{t("helpCoversLabel")}</dt>
          <dd>{t(`${prefix}Covers`)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function HelpView() {
  const t = useTranslations("site");

  return (
    <>
      <section className={styles.pageHead}>
        <div className={styles.container}>
          <h1>{t("helpTitle")}</h1>
          <p className={styles.lede}>{t("helpLede")}</p>
        </div>
      </section>

      <nav className={`${styles.container} ${styles.subnav}`} aria-label={t("helpSubnavLabel")}>
        <a href="#qui">{t("helpNavWho")}</a>
        <a href="#comment">{t("helpNavHow")}</a>
        <a href="#faq">{t("helpNavFaq")}</a>
        <a href="#contact">{t("helpNavContact")}</a>
      </nav>

      <section className={styles.section} id="qui">
        <div className={styles.sectionGrid}>
          <h2>{t("helpWhoTitle")}</h2>
          <div className={styles.stack}>
            <EntityCard id="employeurs" prefix="helpEmployers" tags={6} />
            <EntityCard id="centres" prefix="helpCentres" tags={2} />
            <ul className={styles.bullets}>
              <li>
                <strong>{t("helpRuleSitesLead")}</strong> {t("helpRuleSitesBody")}
              </li>
              <li>
                <strong>{t("helpRuleAdminLead")}</strong> {t("helpRuleAdminBody")}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionWash}`} id="comment">
        <div className={styles.sectionGrid}>
          <h2>{t("helpHowTitle")}</h2>
          <div>
            <ol className={styles.steps}>
              <li>
                <div>
                  <h3>{t("helpStep1Title")}</h3>
                  <p>{t("helpStep1Body")}</p>
                  <ol className={styles.substeps}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <li key={i}>{t(`helpStep1Sub${i}`)}</li>
                    ))}
                  </ol>
                </div>
              </li>
              {[2, 3, 4].map((n) => (
                <li key={n}>
                  <div>
                    <h3>{t(`helpStep${n}Title`)}</h3>
                    <p>{t(`helpStep${n}Body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className={`${styles.card} ${styles.note}`} id="assistee">
              <h3>{t("helpAssistedTitle")}</h3>
              <p className={styles.muted}>{t("helpAssistedBody")}</p>
              <a href="#contact" className={styles.textLink}>
                {t("helpNavContact")}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="faq">
        <div className={styles.sectionGrid}>
          <h2>{t("helpFaqTitle")}</h2>
          <div className={styles.faq}>
            {HELP_FAQ.map((n) => (
              <details key={n} id={n === 1 ? "confidentialite" : undefined}>
                <summary>{t(`faq${n}Question`)}</summary>
                <p>{t(`faq${n}Answer`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionWash}`} id="contact">
        <div className={styles.sectionGrid}>
          <h2>{t("helpContactTitle")}</h2>
          <div className={styles.stack}>
            <p className={styles.muted}>{t("helpContactIntro")}</p>
            <div className={styles.grid2}>
              <a
                className={`${styles.card} ${styles.cardLink}`}
                href={SITE_CONTACT.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.state}>{t("contactWhatsappLabel")}</span>
                <h3>{SITE_CONTACT.whatsappDisplay}</h3>
                <p className={styles.muted}>{t("helpContactWhatsappBody")}</p>
              </a>
              <a className={`${styles.card} ${styles.cardLink}`} href={`mailto:${SITE_CONTACT.email}`}>
                <span className={styles.state}>{t("contactEmailLabel")}</span>
                <h3>{SITE_CONTACT.email}</h3>
                <p className={styles.muted}>{t("helpContactEmailBody")}</p>
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteCta title={t("helpCtaTitle")} body={t("helpCtaBody")} action={t("helpCtaAction")} />
    </>
  );
}
