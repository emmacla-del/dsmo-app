"use client";

import { useTranslations } from "next-intl";
import type { OnefopField } from "@/lib/onefop-schema";
import { bilingual, localized, type LocalizedText } from "@/lib/onefop-schema";
import { AccessibleRadioGroup } from "./ui/AccessibleRadioGroup";
import { AccessibleCheckboxGroup } from "./ui/AccessibleCheckboxGroup";
import { AccessibleNumberInput } from "./ui/AccessibleNumberInput";
import { isOptionalField } from "@/lib/onefop-validation";

/**
 * The bare input control for a non-table field — no label, no wrapper, no
 * hint text. Extracted out of FieldRenderer so both the block layout
 * (Simple/Wizard) and the dense row layout (Tableur) render the exact same
 * type-dispatch logic instead of two copies of it — the presentation
 * modes must not duplicate field behavior, only how it's laid out.
 */
interface FieldControlProps {
  field: OnefopField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  placeholder?: string;
  /** Tighter height for dense table-row usage (Tableur mode). */
  compact?: boolean;
  /** True when this field currently has a validation issue — red border +
   * aria-invalid, matching the field-level half of the error-summary
   * pattern (the summary itself is ValidationSummary). */
  hasError?: boolean;
  /** Called on blur, for callers (Section 0's FieldRenderer branch) that
   * defer showing `hasError`/the error message until the field has
   * actually been left once. Wired only on the plain text/tel/email/date
   * input below — every other control type is unaffected. */
  onFieldTouch?: (fieldId: string) => void;
  /** Active language for option labels. When omitted (Tableur's dense
   * official-form view), options keep the bilingual "FR/ EN" rendering. */
  locale?: "fr" | "en";
}

export function FieldControl({ field, value, onChange, placeholder, compact = false, hasError = false, onFieldTouch, locale }: FieldControlProps) {
  const t = useTranslations();
  // Exposed as aria-required only: the wizard's own validation decides what
  // blocks, so no native `required` (and its browser tooltip) is set.
  const required = !isOptionalField(field);
  const optionLabel = (text: LocalizedText | null) => (locale ? localized(text, locale) : bilingual(text));
  const textInputStyle: React.CSSProperties = {
    width: "100%",
    height: compact ? 30 : 42,
    border: `1px solid ${hasError ? "#dc2626" : "#1B4332"}`,
    borderRadius: 6,
    padding: `0 ${compact ? "8px" : "12px"}`,
    fontSize: compact ? 13 : 14,
    fontFamily: "inherit",
    background: "#ffffff",
    color: "#0f172a",
    boxSizing: "border-box",
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    height: compact ? 30 : 42,
    border: `1px solid ${hasError ? "#dc2626" : "#1B4332"}`,
    borderRadius: 6,
    padding: `0 ${compact ? "8px" : "12px"}`,
    fontSize: compact ? 13 : 14,
    fontFamily: "inherit",
    background: "#ffffff",
    color: "#0f172a",
    boxSizing: "border-box",
    outline: "none",
  };


  if (field.type === "radio" && field.options) {
    if (!compact) {
      const radioOptions = field.options.map((opt) => ({
        value: opt.value,
        label: optionLabel(opt.label),
      }));
      return (
        <div id={field.id} aria-invalid={hasError || undefined}>
          <AccessibleRadioGroup
            id={field.id}
            name={field.id}
            options={radioOptions}
            value={value}
            onChange={(val) => onChange(field.id, val)}
            orientation={field.options.length <= 3 ? "horizontal" : "vertical"}
            required={required}
          />
        </div>
      );
    }

    return (
      <div
        id={field.id}
        tabIndex={-1}
        aria-invalid={hasError || undefined}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--cam-space-3)",
          outline: "none",
          borderLeft: hasError ? "3px solid var(--cam-error)" : "3px solid transparent",
          paddingLeft: hasError ? "var(--cam-space-2)" : 0,
        }}
      >
        {field.options.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--cam-space-1)",
              fontSize: compact ? "var(--cam-font-size-sm)" : "var(--cam-font-size-base)",
              whiteSpace: "nowrap",
            }}
          >
            <input
              type="radio"
              name={field.id}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(field.id, opt.value)}
            />
            {optionLabel(opt.label)}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox" && field.options) {
    const current = Array.isArray(value) ? (value as unknown[]).map(String) : [];
    if (!compact) {
      const checkboxOptions = field.options.map((opt) => ({
        value: opt.value,
        label: optionLabel(opt.label),
      }));
      return (
        <div id={field.id} aria-invalid={hasError || undefined}>
          <AccessibleCheckboxGroup
            id={field.id}
            options={checkboxOptions}
            value={current}
            onChange={(next) => onChange(field.id, next)}
          />
        </div>
      );
    }
    const toggle = (optionValue: string) => {
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      onChange(field.id, next);
    };
    // Two columns past 4 options, matching CheckboxGroupField's own
    // >4-options-and-wide-enough split — this is a web-only layout (no
    // narrow-viewport concern the way Flutter's mobile/desktop split has),
    // so it's unconditional here rather than measured.
    const twoColumns = field.options.length > 4;
    const renderCheckboxItem = (opt: (typeof field.options)[number]) => (
      <label
        key={opt.value}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cam-space-2)",
          fontSize: compact ? "var(--cam-font-size-sm)" : "var(--cam-font-size-base)",
          marginBottom: compact ? 2 : "var(--cam-space-2)",
        }}
      >
        <input type="checkbox" checked={current.includes(opt.value)} onChange={() => toggle(opt.value)} />
        {optionLabel(opt.label)}
      </label>
    );
    // Same id/tabIndex-for-jump-to-field reasoning as the radio group above.
    const groupBorderStyle: React.CSSProperties = {
      outline: "none",
      borderLeft: hasError ? "3px solid var(--cam-error)" : "3px solid transparent",
      paddingLeft: hasError ? "var(--cam-space-2)" : 0,
    };
    if (!twoColumns) {
      return (
        <div id={field.id} tabIndex={-1} aria-invalid={hasError || undefined} style={groupBorderStyle}>
          {field.options.map(renderCheckboxItem)}
        </div>
      );
    }
    const mid = Math.ceil(field.options.length / 2);
    return (
      <div
        id={field.id}
        tabIndex={-1}
        aria-invalid={hasError || undefined}
        style={{ ...groupBorderStyle, display: "flex", gap: "var(--cam-space-5)" }}
      >
        <div style={{ flex: 1 }}>{field.options.slice(0, mid).map(renderCheckboxItem)}</div>
        <div style={{ flex: 1 }}>{field.options.slice(mid).map(renderCheckboxItem)}</div>
      </div>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        id={field.id}
        name={field.id}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        className={`sovereign-select ${hasError ? "has-error" : ""}`}
        style={selectStyle}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(field.id, e.target.value)}
        onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
      >
        <option value="" disabled>
          {t("fieldControl.emptySelectionPlaceholder")}
        </option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {optionLabel(opt.label)}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        id={field.id}
        name={field.id}
        placeholder={placeholder}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        className={`sovereign-text-input ${hasError ? "has-error" : ""}`}
        style={{ ...textInputStyle, height: compact ? 30 : "auto", minHeight: compact ? 30 : 80, padding: "8px 12px" }}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(field.id, e.target.value)}
        onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
      />
    );
  }

  const htmlType =
    field.type === "tel" || field.type === "email" || field.type === "date"
      ? field.type
      : field.type === "number"
        ? "number"
        : "text";

  return (
    <input
      id={field.id}
      name={field.id}
      type={htmlType}
      placeholder={placeholder}
      aria-required={required || undefined}
      aria-invalid={hasError || undefined}
      className={`sovereign-text-input ${hasError ? "has-error" : ""}`}
      style={textInputStyle}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(field.id, e.target.value)}
      onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
    />
  );
}
