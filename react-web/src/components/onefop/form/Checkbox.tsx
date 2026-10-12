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
        // Same rhythm as a radio option (Radio.tsx): 32px row, 4px apart.
        minHeight: "var(--cam-space-6)",
        padding: "var(--cam-space-1) 6px",
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
          width: "var(--cam-choice-size)",
          height: "var(--cam-choice-size)",
          flexShrink: 0,
          borderRadius: "var(--cam-radius-sm)",
          // The input edge (3:1 against white, WCAG 2.2, 1.4.11).
          border: `2px solid ${checked ? "var(--cam-green)" : "var(--cam-text-muted)"}`,
          backgroundColor: checked ? "var(--cam-green)" : "var(--cam-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--cam-surface)",
          fontSize: "var(--cam-font-size-2xs)",
          fontWeight: "var(--cam-font-weight-bold)",
          lineHeight: 1,
          transition: "all 0.15s ease",
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span
        style={{
          fontFamily: "var(--vt-font)",
          fontSize: "var(--cam-answer-size)",
          // Black and regular, ticked or not: the box shows the choice.
          fontWeight: "var(--cam-font-weight-regular)",
          color: "var(--cam-text)",
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
        gap: "var(--cam-space-1) 24px",
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
