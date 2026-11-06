"use client";

import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { formatAnswer } from "@/lib/dossier-vt-answers";
import { isFieldVisible, localized, type FormData, type OnefopEntity, type OnefopField, type OnefopSection } from "@/lib/onefop-schema";
import { isRowTextEmbeddedInTable } from "@/lib/onefop-tables";
import { dossierFieldAnchor, type PlacedFlag } from "@/lib/finding-targets";

/** The finding(s) pointing at this answer, said right above it, with the way back to the list. */
export function PlacedFlagNotice({ flags, label, back }: { flags: PlacedFlag[]; label: string; back: string }) {
  const blocking = flags.some((flag) => flag.severity === "blocking");
  return (
    <div className={`cam-dossier-field-flag${blocking ? " is-blocking" : " is-warning"}`} role="note">
      <strong className="cam-dossier-field-flag-label">{label}</strong>
      <ul>{flags.map((flag, index) => <li key={index} className={`is-${flag.severity}`}>{flag.text}</li>)}</ul>
      <a href="#dossier-verify">{back}</a>
    </div>
  );
}
import { ReviewStatisticalTable, reviewTableDefinition } from "./ReviewStatisticalTable";
import { CoherenceProvider } from "@/components/onefop/coherence/Coherence";

/** A paper question number (« 2.1 », « 4.10 ») is shown; a variable name (« S21Q01 ») never is (§8). */
function paperNumber(code: string | null): string | null {
  return code && /^\d+(\.\d+)*[a-z]?$/i.test(code) ? code : null;
}

/** « Avez-vous des chiffres ? » is read inside its table, not listed as a question of its own. */
function isResponseStatusField(field: OnefopField): boolean {
  return /_RESPONSE_STATUS$/i.test(field.id);
}

/** Tables the review renders with their real labels: the wizard's definition, or the project's two tables. */
function hasLabelledTable(field: OnefopField, data: FormData): boolean {
  const template = field.table?.template;
  return template === "activities_table" || template === "kpi_period_table" || Boolean(field.table && reviewTableDefinition(field, data));
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function rawValue(value: unknown, yes: string, no: string): string {
  if (typeof value === "boolean") return value ? yes : no;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function fieldValue(field: OnefopField, data: FormData, locale: "fr" | "en", yes: string, no: string): string[] | null {
  const value = data[field.id];
  if (value && typeof value === "object" && !Array.isArray(value)) return [rawValue(value, yes, no)];
  return formatAnswer(field, value, locale, { yes, no, row: (n) => String(n) });
}

/** The same establishment's file for an earlier round, shown beside each answer. */
export interface PreviousPeriodAnswers {
  data: FormData;
  /** « T2 2026 » — the earlier round's name. */
  label: string;
  /** The earlier round's code, for its own tables' period labels. */
  quarterCode: string | null;
}

function AnswerField({ field, data, yes, no, notAnswered, tableNote, cellIdLabel, recordedAnswerLabel, locale, quarterCode, previous, previousTitle }: {
  field: OnefopField;
  data: FormData;
  yes: string;
  no: string;
  notAnswered: string;
  tableNote: string;
  cellIdLabel: string;
  recordedAnswerLabel: string;
  locale: "fr" | "en";
  quarterCode: string | null;
  previous?: PreviousPeriodAnswers | null;
  /** « Période précédente (T2 2026) ». */
  previousTitle?: string;
}) {
  const cells = field.table?.matrix?.flat() ?? [];
  const labelled = hasLabelledTable(field, data);
  const isMatrix = !labelled && cells.length > 0;
  const values = isMatrix || labelled ? null : fieldValue(field, data, locale, yes, no);
  const number = paperNumber(field.paperCode);
  const render = (source: FormData, sourceQuarter: string | null) => {
    const sourceValues = isMatrix || labelled ? null : fieldValue(field, source, locale, yes, no);
    return (
      <>
            {labelled ? (
              <ReviewStatisticalTable field={field} data={source} quarterCode={sourceQuarter} />
            ) : isMatrix ? (
              <>
                <p className="cam-admin-meta" style={{ margin: "0 0 var(--cam-space-2)" }}>{tableNote}</p>
                <div className="cam-table-wrapper">
                  <table className="cam-table">
                    <thead>
                      <tr>
                        <th scope="col">{cellIdLabel}</th>
                        <th scope="col">{recordedAnswerLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cells.map((cellId) => (
                        <tr key={cellId}>
                          <th scope="row">{cellId}</th>
                          <td>{isBlank(source[cellId]) ? notAnswered : rawValue(source[cellId], yes, no)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : sourceValues?.length ? (
              sourceValues.map((value, index) => <div key={`${field.id}-${index}`}>{value}</div>)
            ) : (
              <span className="cam-admin-meta">{notAnswered}</span>
            )}
      </>
    );
  };
  const previousValues = previous && !isMatrix && !labelled ? fieldValue(field, previous.data, locale, yes, no) : null;
  const changed = previous && !isMatrix && !labelled
    && JSON.stringify(previousValues ?? []) !== JSON.stringify(values ?? []);
  return (
    <>
      <dt>
        {number && <span className="cam-admin-meta">{number} · </span>}
        {localized(field.label, locale) || field.id}
      </dt>
      <dd>
        {render(data, quarterCode)}
        {previous && (isMatrix || labelled) && (
          <details className="cam-dossier-previous">
            <summary>{previousTitle}</summary>
            {/* The earlier file carries none of this file's findings. */}
            <CoherenceProvider flags={[]} readOnly>
              {render(previous.data, previous.quarterCode)}
            </CoherenceProvider>
          </details>
        )}
        {changed && (
          <p className="cam-dossier-previous-inline">
            <span>{previous!.label}</span> {previousValues?.length ? previousValues.join(", ") : notAnswered}
          </p>
        )}
      </dd>
    </>
  );
}

function QuestionnaireSection({ section, title, data, yes, no, notAnswered, emptyMessage, tableNote, cellIdLabel, recordedAnswerLabel, locale, anchorId, quarterCode, flags, flagLabel, flagBack, quietLabel, blockingBadge, warningBadge, previous, previousTitle }: {
  section: OnefopSection;
  title: string;
  data: FormData;
  yes: string;
  no: string;
  notAnswered: string;
  emptyMessage: string;
  tableNote: string;
  cellIdLabel: string;
  recordedAnswerLabel: string;
  locale: "fr" | "en";
  anchorId: string;
  quarterCode: string | null;
  flags: Record<string, PlacedFlag[]>;
  flagLabel: string;
  flagBack: string;
  /** Shown on a folded section that carries no finding. */
  quietLabel: string;
  /** Section header badges: how many blocking findings / warnings sit in it. */
  blockingBadge: (count: number) => string;
  warningBadge: (count: number) => string;
  previous?: PreviousPeriodAnswers | null;
  previousTitle?: string;
}) {
  // A reason or domain the respondent typed is the row's label in its table
  // (as in the wizard), so it is not listed a second time on its own.
  const visible = section.fields.filter((field) =>
    isFieldVisible(field, data) && !isResponseStatusField(field) && !isRowTextEmbeddedInTable(field.id, section.fields));
  const headingAt = new Map<string, string>();
  for (const subsection of section.subsections) {
    const ids = subsection.fieldIds.filter((id) => visible.some((field) => field.id === id));
    const subsectionTitle = localized(subsection.title, locale);
    if (subsectionTitle && ids.length > 1) headingAt.set(ids[0], subsectionTitle);
  }

  const sectionFlags = visible.flatMap((field) => flags[dossierFieldAnchor(field.id)] ?? []);
  const flagged = sectionFlags.length > 0;
  const blockingInSection = sectionFlags.filter((flag) => flag.severity === "blocking").length;
  const warningsInSection = sectionFlags.length - blockingInSection;
  const body = (
      <div className="cam-dossier-section-body">
        {visible.length === 0 ? (
          <p className="cam-admin-meta">{emptyMessage}</p>
        ) : (
          <dl className="cam-dossier-fields cam-dossier-fields--two">
            {visible.map((field) => (
              // A table takes the whole width; short answers sit two by two.
              <div
                key={field.id}
                id={dossierFieldAnchor(field.id)}
                className={`cam-dossier-field${field.table || field.type === "repeating_table" ? " cam-dossier-field--wide" : ""}${flags[dossierFieldAnchor(field.id)] ? (flags[dossierFieldAnchor(field.id)].some((flag) => flag.severity === "blocking") ? " is-flagged is-flagged--blocking" : " is-flagged is-flagged--warning") : ""}`}
              >
                {/* The subsection heading first: a notice above it read as
                    belonging to the table before. */}
                {headingAt.has(field.id) && (
                  <div className="cam-admin-label" style={{ gridColumn: "1 / -1" }}>{headingAt.get(field.id)}</div>
                )}
                <AnswerField
                  field={field}
                  data={data}
                  yes={yes}
                  no={no}
                  notAnswered={notAnswered}
                  cellIdLabel={cellIdLabel}
                  recordedAnswerLabel={recordedAnswerLabel}
                  tableNote={tableNote}
                  locale={locale}
                  quarterCode={quarterCode}
                  previous={previous}
                  previousTitle={previousTitle}
                />
                {/* Said right under the answer it concerns, where the reviewer is looking. */}
                {flags[dossierFieldAnchor(field.id)] && <PlacedFlagNotice flags={flags[dossierFieldAnchor(field.id)]} label={flagLabel} back={flagBack} />}
              </div>
            ))}
          </dl>
        )}
      </div>
  );
  // A section with a finding stays open; the others fold to one line the
  // reviewer can open (the rail's links open them too).
  if (flagged) {
    return (
      <section className="cam-dossier-section" id={anchorId}>
        <div className="cam-dossier-section-head">
          <h2>{title}</h2>
          {blockingInSection > 0 && <span className="cam-badge cam-badge-error">{blockingBadge(blockingInSection)}</span>}
          {warningsInSection > 0 && <span className="cam-badge cam-badge-warning">{warningBadge(warningsInSection)}</span>}
        </div>
        {body}
      </section>
    );
  }
  return (
    <details className="cam-dossier-section is-quiet" id={anchorId}>
      <summary>
        <h2>{title}</h2>
        <span className="cam-admin-meta">{quietLabel}</span>
      </summary>
      {body}
    </details>
  );
}

/** Read-only rendering of the questionnaire's schema sections from rawData. */
export function DossierAnswerSections({ entity, sectionId, title, data, quarterCode = null, flags = {}, previous = null }: {
  entity: OnefopEntity;
  sectionId: string;
  title: string;
  data: FormData | null | undefined;
  /** The file's round, which names the project outcomes' « current » column. */
  quarterCode?: string | null;
  /** Findings placed on this file's answers (placeFindings), keyed by anchor. */
  flags?: Record<string, PlacedFlag[]>;
  /** The establishment's previous endorsed file, to compare each answer with. */
  previous?: PreviousPeriodAnswers | null;
}) {
  const locale = asUiLocale(useLocale());
  const t = useTranslations("adminDossierPage");
  const section = entity.sections.find((item) => item.id === sectionId);
  if (!data) return <p className="cam-admin-meta">{t("declarationDataUnavailable")}</p>;
  if (!section) return <p className="cam-admin-meta">{t("declarationDataUnavailable")}</p>;

  return (
    <QuestionnaireSection
      section={section}
      title={title}
      data={data}
      yes={t("vt.yes")}
      no={t("vt.no")}
      notAnswered={t("vt.notAnswered")}
      emptyMessage={t("vt.sectionEmpty")}
      tableNote={t("rawTableNote")}
      cellIdLabel={t("rawCellId")}
      recordedAnswerLabel={t("rawRecordedAnswer")}
      locale={locale}
      anchorId={`dossier-section-${sectionId}`}
      quarterCode={quarterCode}
      flags={flags}
      flagLabel={t("flaggedHere")}
      flagBack={t("flaggedBack")}
      quietLabel={t("sectionNoFlags")}
      blockingBadge={(count) => t("sectionBlockingBadge", { count })}
      warningBadge={(count) => t("sectionWarningBadge", { count })}
      previous={previous}
      previousTitle={previous ? t("previousPeriodTitle", { period: previous.label }) : undefined}
    />
  );
}
