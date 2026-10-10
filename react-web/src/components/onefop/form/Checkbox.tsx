"use client";

import type { ReactNode } from "react";

export interface CheckboxOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * A single checkbox: a real <input type="checkbox"> (visually hidden,
 * sr-only technique) paired with a styled box, rather than a role="checkbox"
 * div. Native input gives correct checked/keyboard/screen-reader semantics
 * for free — no roving tabindex needed, each checkbox tabs independently,
 * which is correct group behavior (unlike a radiogroup). The <label> wraps
 * both so the whole row is a >=44px touch target without enlarging the
 * visible check mark.
 */
export function Checkbox({
  id,
  checked,
  onChange,
  label,
  disabled = false,
  invalid = false,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="vt-checkbox-option"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        padding: "8px 6px",
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          borderRadius: 4,
          border: `1.5px solid ${checked ? "var(--vt-accent, #1e6b3a)" : "#d1d6d3"}`,
          backgroundColor: checked ? "var(--vt-accent, #1e6b3a)" : "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 12,
          fontWeight: 800,
          lineHeight: 1,
          transition: "all 0.15s ease",
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span
        style={{
          fontFamily: "var(--vt-font)",
          fontSize: "var(--cam-font-size-sm)",
          fontWeight: checked ? 600 : 400,
          color: checked ? "var(--vt-ink, #1c1f1d)" : "var(--vt-ink-soft, #4e5451)",
        }}
      >
        {label}
      </span>
    </label>
  );
}

/**
 * A group of independent checkboxes ("select all that apply"). Keeps the
 * (fieldId, value[]) onChange shape VtWizardCheckboxGroup already uses.
 */
export function CheckboxGroup({
  fieldId,
  options,
  value,
  onChange,
  ariaLabel,
  columns = 1,
  describedBy,
  invalid = false,
}: {
  fieldId: string;
  options: CheckboxOption[];
  value: string[];
  onChange: (fieldId: string, value: string[] | undefined) => void;
  ariaLabel?: string;
  columns?: 1 | 2;
  /** id(s) of the element(s) describing the group, e.g. its error message. */
  describedBy?: string;
  /** Marks every checkbox invalid (role="group" itself does not support
   * aria-invalid). */
  invalid?: boolean;
}) {
  const toggle = (optValue: string, next: boolean) => {
    const updated = next
      ? [...value, optValue]
      : value.filter((v) => v !== optValue);
    onChange(fieldId, updated.length ? updated : undefined);
  };

  return (
    <div
      id={fieldId}
      role="group"
      aria-label={ariaLabel ?? fieldId}
      aria-describedby={describedBy}
      tabIndex={-1}
      style={{
        display: "grid",
        gridTemplateColumns: columns === 2 ? "repeat(auto-fit, minmax(240px, 1fr))" : "1fr",
        gap: "2px 24px",
      }}
    >
      {options.map((opt) => (
        <Checkbox
          key={opt.value}
          id={`${fieldId}-${opt.value}`}
          checked={value.includes(opt.value)}
          disabled={opt.disabled}
          onChange={(next) => toggle(opt.value, next)}
          label={opt.label}
          invalid={invalid}
        />
      ))}
    </div>
  );
}
