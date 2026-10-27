"use client";

import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { formatAnswer } from "@/lib/dossier-vt-answers";
import { isFieldVisible, localized, type FormData, type OnefopEntity, type OnefopField, type OnefopSection } from "@/lib/onefop-schema";

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

function AnswerField({ field, data, yes, no, notAnswered, tableNote, cellIdLabel, recordedAnswerLabel, locale }: {
  field: OnefopField;
  data: FormData;
  yes: string;
  no: string;
  notAnswered: string;
  tableNote: string;
  cellIdLabel: string;
  recordedAnswerLabel: string;
  locale: "fr" | "en";
}) {
  const cells = field.table?.matrix?.flat() ?? [];
  const isMatrix = cells.length > 0;
  const values = isMatrix ? null : fieldValue(field, data, locale, yes, no);
  return (
    <>
      <dt>
        {field.paperCode && <span className="cam-admin-meta">{field.paperCode} · </span>}
        {localized(field.label, locale) || field.id}
      </dt>
      <dd>
        {isMatrix ? (
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
                      <td>{isBlank(data[cellId]) ? notAnswered : rawValue(data[cellId], yes, no)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : values?.length ? (
          values.map((value, index) => <div key={`${field.id}-${index}`}>{value}</div>)
        ) : (
          <span className="cam-admin-meta">{notAnswered}</span>
        )}
      </dd>
    </>
  );
}

function QuestionnaireSection({ section, title, data, yes, no, notAnswered, emptyMessage, tableNote, cellIdLabel, recordedAnswerLabel, locale, open, onToggle }: {
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
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const visible = section.fields.filter((field) => isFieldVisible(field, data));
  const headingAt = new Map<string, string>();
  for (const subsection of section.subsections) {
    const ids = subsection.fieldIds.filter((id) => visible.some((field) => field.id === id));
    const subsectionTitle = localized(subsection.title, locale);
    if (subsectionTitle && ids.length > 1) headingAt.set(ids[0], subsectionTitle);
  }

  return (
    <details className="cam-dossier-section" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>{title}</summary>
      <div className="cam-dossier-section-body">
        {visible.length === 0 ? (
          <p className="cam-admin-meta">{emptyMessage}</p>
        ) : (
          <dl className="cam-dossier-fields cam-dossier-fields--two">
            {visible.map((field) => (
              <div key={field.id}>
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
                />
              </div>
            ))}
          </dl>
        )}
      </div>
    </details>
  );
}

/** Read-only rendering of the questionnaire's schema sections from rawData. */
export function DossierAnswerSections({ entity, sectionId, title, data, open, onToggle }: {
  entity: OnefopEntity;
  sectionId: string;
  title: string;
  data: FormData | null | undefined;
  open: boolean;
  onToggle: (open: boolean) => void;
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
      open={open}
      onToggle={onToggle}
    />
  );
}
