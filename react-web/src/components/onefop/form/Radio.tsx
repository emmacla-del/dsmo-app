"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface RadioOption {
  value: string;
  label: ReactNode;
  caption?: ReactNode;
  disabled?: boolean;
}

/**
 * True ARIA radiogroup: role="radio" + aria-checked on each option, roving
 * tabIndex (one stop for the group), Arrow/Home/End navigation that both
 * moves focus and selects (the standard WAI-ARIA radiogroup pattern), and
 * a visible focus ring. Replaces the old plain-<div onClick> radio in
 * VtWizardFields.tsx, which had no role="radio", aria-checked, or keyboard
 * support at all.
 *
 * onChange keeps the (fieldId, value) shape the rest of the wizard uses so
 * call sites don't need to change their state handling.
 */
export function RadioGroup({
  fieldId,
  options,
  value,
  onChange,
  ariaLabel,
  layout = "vertical",
  describedBy,
  invalid = false,
  required = false,
}: {
  fieldId: string;
  options: RadioOption[];
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  ariaLabel: string;
  layout?: "vertical" | "horizontal";
  /** id(s) of the element(s) describing the group, e.g. its error message. */
  describedBy?: string;
  invalid?: boolean;
  /** Sets aria-required on the radiogroup. */
  required?: boolean;
}) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const enabledIndices = options
    .map((o, i) => (o.disabled ? -1 : i))
    .filter((i) => i >= 0);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const rovingIndex = selectedIndex >= 0 && !options[selectedIndex].disabled
    ? selectedIndex
    : enabledIndices[0] ?? 0;

  const focusAndSelect = (index: number) => {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange(fieldId, opt.value);
    itemRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = enabledIndices.indexOf(rovingIndex) >= 0 ? enabledIndices.indexOf(rovingIndex) : 0;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight": {
        event.preventDefault();
        const next = enabledIndices[(currentIndex + 1) % enabledIndices.length];
        focusAndSelect(next);
        break;
      }
      case "ArrowUp":
      case "ArrowLeft": {
        event.preventDefault();
        const prev = enabledIndices[(currentIndex - 1 + enabledIndices.length) % enabledIndices.length];
        focusAndSelect(prev);
        break;
      }
      case "Home": {
        event.preventDefault();
        focusAndSelect(enabledIndices[0]);
        break;
      }
      case "End": {
        event.preventDefault();
        focusAndSelect(enabledIndices[enabledIndices.length - 1]);
        break;
      }
      case " ":
      case "Enter": {
        event.preventDefault();
        focusAndSelect(rovingIndex);
        break;
      }
    }
  };

  return (
    <div
      id={fieldId}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-required={required || undefined}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        display: "flex",
        flexDirection: layout === "horizontal" ? "row" : "column",
        flexWrap: layout === "horizontal" ? "wrap" : "nowrap",
        gap: layout === "horizontal" ? 28 : 6,
      }}
    >
      {options.map((opt, index) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => { itemRefs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={opt.disabled || undefined}
            disabled={opt.disabled}
            tabIndex={index === rovingIndex ? 0 : -1}
            onClick={() => focusAndSelect(index)}
            className="vt-radio-option"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              minHeight: 44,
              padding: "8px 6px",
              border: "none",
              background: "transparent",
              cursor: opt.disabled ? "not-allowed" : "pointer",
              borderRadius: 4,
              userSelect: "none",
              opacity: opt.disabled ? 0.5 : 1,
              textAlign: "left",
              font: "inherit",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: `2px solid ${selected ? "var(--vt-accent, #1e6b3a)" : "#d1d6d3"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                backgroundColor: "#ffffff",
                transition: "border-color 0.15s ease",
              }}
            >
              {selected && (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "var(--vt-accent, #1e6b3a)",
                  }}
                />
              )}
            </span>
            <span>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--vt-font)",
                  fontWeight: selected ? 600 : 400,
                  fontSize: "var(--cam-answer-size)",
                  color: selected ? "var(--vt-ink, #1c1f1d)" : "var(--vt-ink-soft, #4e5451)",
                }}
              >
                {opt.label}
              </span>
              {opt.caption && (
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--vt-font)",
                    fontWeight: 400,
                    fontSize: "var(--cam-microcopy-size)",
                    color: selected ? "var(--vt-ink-soft, #4e5451)" : "var(--vt-ink-faint, #7a827f)",
                    lineHeight: 1.25,
                    marginTop: 2,
                  }}
                >
                  {opt.caption}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
