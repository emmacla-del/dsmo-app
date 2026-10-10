"use client";

import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { splitQuestionCode } from "@/lib/question-code";
import { AnyTableRenderer } from "./AnyTableRenderer";
import { FieldControl } from "./FieldControl";
import { CoherenceFieldNote } from "./coherence/Coherence";
import { InfoTooltip } from "./ui/InfoTooltip";
import { CodedLabel } from "./ui/QuestionCode";
import { OptionalSuffix } from "./ui/OptionalSuffix";
import { getModernJobsTooltip } from "./modern-jobs-tooltips";
import { ConditionalTable } from "@/components/modern-jobs/conditional/ConditionalTable";
import { tableHasGateway } from "@/components/modern-jobs/conditional/gateway-catalog";

/** Question text: 15px bold, as in the VT wizard; answers are 14px regular, hints 12px. */
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--cam-font-size-base)",
  fontWeight: "var(--cam-font-weight-bold)",
  lineHeight: 1.4,
  color: "var(--cam-text)",
  marginBottom: "var(--cam-space-2, 8px)",
};

const wrapperStyle: React.CSSProperties = {
  marginBottom: "var(--cam-form-gap)",
};

const hintStyle: React.CSSProperties = {
  fontSize: "var(--cam-microcopy-size)",
  color: "var(--cam-text-muted)",
  margin: "var(--cam-space-1) 0 0",
};

const selectAllHintStyle: React.CSSProperties = {
  fontSize: "var(--cam-microcopy-size)",
  color: "var(--cam-text-muted)",
  fontStyle: "italic",
  margin: "0 0 var(--cam-space-2)",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "var(--cam-font-size-sm)",
  color: "var(--cam-error)",
  fontWeight: 600,
  margin: "var(--cam-space-1) 0 0",
};

const secondaryLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--cam-font-size-sm)",
  fontWeight: 500,
  color: "var(--cam-text-muted)",
  marginTop: 2,
};

/** Strips a schema hint's own bilingual lead-in ("Ex:"/"Ex :"/"E.g."/"E.g:")
 * so Section 0 can show one consistent "Exemple :" / "Example:" prefix instead
 * of doubling up ("Exemple : E.g. Jean Dupont"). The French hints
 * use a colon ("Ex:"); the English ones don't ("E.g. Jean Dupont") — the
 * colon is optional in both so both lead-ins actually match. Schema content
 * itself is untouched — this only affects how the string is displayed. */
function stripExampleLeadIn(text: string): string {
  return text.replace(/^\s*(ex\.?|e\.g\.?)\s*:?\s*/i, "");
}

interface FieldRendererProps {
  field: OnefopField;
  value: unknown;
  // Full flat form-data map — only tables need this (a table's cells live
  // as many separate keys in the same shared map, not under field.id
  // itself); every other field type only ever reads its own `value`.
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  /** Parent section's id — determines whether the official paper question
   * code prefixes the label (see fieldDisplayLabel/isSimpleSection). */
  sectionId: string;
  /** Tighter spacing for a field rendered inside a paired 2-per-row slot
   * (see pairShortFields in SectionRenderer.tsx) — same control, just no
   * bottom margin of its own since the row itself carries that. */
  noBottomMargin?: boolean;
  /** Caps the input's width (e.g. a 4-digit year) without narrowing the
   * question label above it, so short inputs never force the label to wrap. */
  controlMaxWidth?: number;
  /** This field's current validation message, if any — the field-level
   * half of the error-summary pattern (the wizard's validation summary card is the
   * top-of-form half). Undefined/omitted renders the field exactly as
   * before this existed. */
  errorMessage?: string;
  /** Called on blur — Section 0 uses this to reveal `errorMessage` only
   * once the user has actually left the field (see SectionRenderer). */
  onFieldTouch?: (fieldId: string) => void;
  onAdvanceTable?: () => void;
  onPreviousTable?: () => void;
  autoFocusFirstCell?: boolean;
  onOpenScope?: () => void;
  entryMode?: "grid" | "guided";
  /** False when the section shows one shared Tableau/Guidé switch instead of one per table. */
  showTableModeToggle?: boolean;
  onEntryModeChange?: (mode: "grid" | "guided") => void;
}

/**
 * Block layout for Simple/Wizard mode: label (+ legend for radio/checkbox
 * groups) above the control, hint text below. The control itself — every
 * type switch — lives in FieldControl, shared with Tableur mode's dense row
 * layout, so the two presentation modes never duplicate that logic.
 */
export function FieldRenderer({
  field,
  value,
  data,
  onChange,
  sectionId,
  noBottomMargin = false,
  controlMaxWidth,
  errorMessage,
  onFieldTouch,
  onAdvanceTable,
  onPreviousTable,
  autoFocusFirstCell,
  onOpenScope,
  entryMode,
  showTableModeToggle = true,
  onEntryModeChange,
}: FieldRendererProps) {
  const t = useTranslations();
  const locale = (useLocale() as "fr" | "en") || "fr";
  // Respondent Identification (Section 0): a restrained government-
  // declaration treatment for its label/required-marker/hint — every other
  // section keeps the exact rendering below unchanged. See SectionRenderer's
  // matching section0 branch for the card treatment.
  const isRespondentSection = sectionId === "section0";

  const respondentLabels: Record<string, { fr: string; en: string }> = {
    S0Q01: { fr: "Nom et prénom(s) du répondant", en: "Respondent's full name" },
    S0Q02: { fr: "Fonction / Titre dans l'établissement", en: "Function / Title in the establishment" },
    S0Q03_TEL1: { fr: "Numéro de téléphone principal", en: "Primary phone number" },
    S0Q03_TEL2: { fr: "Numéro de téléphone secondaire", en: "Secondary phone number" },
    S0Q03_EMAIL: { fr: "Adresse email professionnelle", en: "Professional email address" },
  };

  const rawLabel = isRespondentSection
    ? (respondentLabels[field.id]?.[locale] ?? localized(field.label, locale))
    : localized(field.label, locale);
  // Every question shows its paper code as a badge (see CodedLabel);
  // `label` stays plain text for aria-labels.
  const coded = splitQuestionCode(field.paperCode, rawLabel);
  const label = coded.code ? `${coded.code} ${coded.text}` : coded.text;
  const secondaryLabel = isRespondentSection ? null : null;
  const rawHint = localized(field.hint, locale);
  const hint = isRespondentSection && rawHint
    ? t("fieldRenderer.exampleHint", { example: stripExampleLeadIn(rawHint) })
    : rawHint;
  // Side-by-side fields (noBottomMargin) lay out on the parent grid's rows via
  // CSS subgrid — label / control / messages — so the inputs of a row always
  // line up even when one question wraps onto two lines or shows an error.
  const ownWrapperStyle: React.CSSProperties = noBottomMargin
    ? { display: "grid", gridTemplateRows: "subgrid", gridRow: "span 3", rowGap: 0, marginBottom: 0, minWidth: 0 }
    : wrapperStyle;
  const hasError = !!errorMessage;
  const errorId = hasError ? `${field.id}-error` : undefined;

  // Tables governed by the preliminary quiz appear only after its "Oui"
  // (ConditionalTable). Project/Program tables and other ungated matrices
  // render directly.
  if (field.type === "table" || field.type === "repeating_table") {
    const gated = tableHasGateway(field);
    const table = (
      <AnyTableRenderer
        field={field}
        data={data}
        onChange={onChange}
        followUp={gated}
        onAdvanceTable={onAdvanceTable}
        onPreviousTable={onPreviousTable}
        autoFocusFirstCell={autoFocusFirstCell}
        onOpenScope={onOpenScope}
        mode={entryMode}
        showModeToggle={showTableModeToggle}
        onModeChange={onEntryModeChange}
      />
    );
    if (!gated) return table;
    return (
      <ConditionalTable
        tableField={field}
        data={data}
        onChange={onChange}
        locale={locale}
        errorMessage={errorMessage}
        onOpenScope={onOpenScope}
      >
        {table}
      </ConditionalTable>
    );
  }

  const tooltip = getModernJobsTooltip(field.id) ?? (field.paperCode ? getModernJobsTooltip(field.paperCode) : null);
  const tooltipText = tooltip ? (locale === "en" ? tooltip.en : tooltip.fr) : null;

  // Radio/checkbox fields are never in a short-pairable pair (see
  // isShortPairable in SectionRenderer.tsx — only text/number/email/tel
  // qualify), so noBottomMargin never applies to either branch below;
  // both keep their original fixed zero margin.
  if (field.type === "radio" && field.options) {
    return (
      <fieldset style={{ ...wrapperStyle, border: "none", padding: 0, margin: 0 }}>
        <legend style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span><CodedLabel code={coded.code} text={coded.text} /></span>
          <OptionalSuffix field={field} />
          {tooltip && <InfoTooltip content={tooltipText ?? tooltip.fr} ariaLabel={label} />}
        </legend>
        <FieldControl field={field} value={value} onChange={onChange} hasError={hasError} locale={locale} />
        {hasError && (
          <p id={errorId} role="alert" style={errorTextStyle}>
            {errorMessage}
          </p>
        )}
        {hint && <p style={hintStyle}>{hint}</p>}
      </fieldset>
    );
  }

  // Grouped like radio (a <fieldset>/<legend>, not a single labeled
  // control) since a checkbox field is several controls, not one — mirrors
  // CheckboxGroupField's own "Select all that apply" helper text
  // (onefop_form_widgets.dart).
  if (field.type === "checkbox" && field.options) {
    return (
      <fieldset style={{ ...wrapperStyle, border: "none", padding: 0, margin: 0 }}>
        <legend style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span><CodedLabel code={coded.code} text={coded.text} /></span>
          <OptionalSuffix field={field} />
          {tooltip && <InfoTooltip content={tooltipText ?? tooltip.fr} ariaLabel={label} />}
        </legend>
        <p style={selectAllHintStyle}>{t("fieldRenderer.selectAllApply")}</p>
        <FieldControl field={field} value={value} onChange={onChange} hasError={hasError} locale={locale} />
        {hasError && (
          <p id={errorId} role="alert" style={errorTextStyle}>
            {errorMessage}
          </p>
        )}
        {hint && <p style={hintStyle}>{hint}</p>}
      </fieldset>
    );
  }

  const computedPlaceholder = (() => {
    if (isRespondentSection) {
      if (field.id === "S0Q01") return t("fieldRenderer.placeholderName");
      if (field.id === "S0Q02") return t("fieldRenderer.placeholderJobTitle");
      if (field.id === "S0Q03_TEL1") return t("fieldRenderer.example", { example: "677 12 34 56" });
      if (field.id === "S0Q03_TEL2") return t("fieldRenderer.example", { example: "699 12 34 56" });
      if (field.id === "S0Q03_EMAIL") return t("fieldRenderer.placeholderEmail");
    }
    if (rawHint) {
      const stripped = stripExampleLeadIn(rawHint);
      return t("fieldRenderer.example", { example: stripped });
    }
    const idLower = field.id.toLowerCase();
    if (idLower.includes("name") || idLower.includes("nom")) return t("fieldRenderer.placeholderName");
    if (idLower.includes("function") || idLower.includes("fonction") || idLower.includes("title") || idLower.includes("titre")) {
      return t("fieldRenderer.placeholderJobTitle");
    }
    if ((idLower.includes("sec") || idLower.includes("2")) && (idLower.includes("phone") || idLower.includes("tel"))) return t("fieldRenderer.example", { example: "699 12 34 56" });
    if (idLower.includes("phone") || idLower.includes("tel")) return t("fieldRenderer.example", { example: "677 12 34 56" });
    if (idLower.includes("email") || idLower.includes("mail")) return t("fieldRenderer.placeholderEmail");
    return undefined;
  })();

  return (
    <div style={ownWrapperStyle}>
      <div style={{ marginBottom: "var(--cam-space-2, 8px)", alignSelf: noBottomMargin ? "end" : undefined }}>
        <label
          htmlFor={field.id}
          style={{
            ...labelStyle,
            marginBottom: 0,
            display: "inline",
          }}
        >
          <span><CodedLabel code={coded.code} text={coded.text} /></span>
          <OptionalSuffix field={field} />
          {tooltip && (
            <span style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: 6 }}>
              <InfoTooltip content={tooltipText ?? tooltip.fr} ariaLabel={label} />
            </span>
          )}
        </label>
        {secondaryLabel && secondaryLabel !== label && <span style={secondaryLabelStyle}>{secondaryLabel}</span>}
      </div>
      <div style={controlMaxWidth ? { width: controlMaxWidth, maxWidth: "100%" } : undefined}>
        <FieldControl
          locale={locale}
          field={field}
          value={value}
          onChange={onChange}
          placeholder={computedPlaceholder}
          hasError={hasError}
          onFieldTouch={onFieldTouch}
        />
      </div>
      {/* In a side-by-side row, messages wrap to the column instead of widening it. */}
      <div style={noBottomMargin ? { contain: "inline-size" } : undefined}>
        {hasError && (
          <p id={errorId} role="alert" style={errorTextStyle}>
            {errorMessage}
          </p>
        )}
        {/* An "Ex: …" hint is already shown as the placeholder — don't repeat it. */}
        {!isRespondentSection && hint && !/^\s*(ex\.?|e\.g\.?)\s*:?\s/i.test(hint) && <p style={hintStyle}>{hint}</p>}
        <CoherenceFieldNote fieldId={field.id} />
      </div>
    </div>
  );
}
