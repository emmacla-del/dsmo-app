"use client";

import type { ReactNode } from "react";

/**
 * Consolidated numeric stepper: tabular-nums so digits don't jitter as the
 * value changes, clamps to [min, max], 44x44 increment/decrement buttons,
 * and an optional unit label. Replaces the per-field duplicated stepper
 * markup in VtWizardFields.tsx (VtWizardNumberStepper / the inline
 * insertion-stats inputs).
 */
export function NumberStepper({
  id,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  unit,
  compact = false,
  showButtons,
  disabled = false,
  hasError = false,
  describedBy,
  invalid = false,
}: {
  id: string;
  value: unknown;
  onChange: (id: string, value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: ReactNode;
  /** Compact inline mode (e.g. paired next to a Yes/No toggle) — narrower
   * box. Implies no increment/decrement buttons unless showButtons
   * overrides it. */
  compact?: boolean;
  /** Independent of `compact` — some fields hide the +/- buttons at full
   * width (e.g. VT_NO_STEPPER_IDS) without switching to the narrow box. */
  showButtons?: boolean;
  disabled?: boolean;
  /** Also sets aria-invalid on the input, in addition to the error border. */
  hasError?: boolean;
  /** id(s) of the element(s) describing the input, e.g. its error message. */
  describedBy?: string;
  /** Sets aria-invalid without changing the border (for callers that show
   * the error elsewhere). */
  invalid?: boolean;
}) {
  const shouldShowButtons = showButtons ?? !compact;
  const n = parseInt(String(value ?? ""), 10);
  const current = Number.isFinite(n) ? n : 0;

  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return v;
  };

  const stepBy = (delta: number) => onChange(id, String(clamp(current + delta)));

  const handleTyped = (raw: string) => {
    if (raw === "") {
      onChange(id, raw);
      return;
    }
    const parsed = parseInt(raw, 10);
    onChange(id, Number.isFinite(parsed) ? String(clamp(parsed)) : raw);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? 0 : 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: compact ? 32 : shouldShowButtons ? 44 : 40,
          maxWidth: compact ? 84 : shouldShowButtons ? 180 : "100%",
          width: compact || shouldShowButtons ? undefined : "100%",
          padding: compact ? "0 8px" : "0 4px 0 12px",
          background: "#fff",
          border: `1px solid ${hasError ? "var(--cam-error)" : "#1B4332"}`,
          borderRadius: "var(--cam-radius-sm)",
          boxSizing: "border-box",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={hasError || invalid || undefined}
          value={(value as string) ?? ""}
          onChange={(e) => handleTyped(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            fontFamily: "var(--cam-font-sans)",
            fontWeight: 600,
            fontSize: "var(--cam-font-size-base)",
            fontVariantNumeric: "tabular-nums",
            background: "transparent",
            color: "var(--cam-text)",
          }}
        />
        {shouldShowButtons && (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              aria-label="−"
              disabled={disabled || (min != null && current <= min)}
              onClick={() => stepBy(-step)}
              className="vt-stepper-button"
              style={{
                width: 44,
                height: 44,
                border: "1px solid var(--cam-border)",
                borderRadius: "var(--cam-radius-sm)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 18,
                background: "var(--cam-bg)",
                color: "var(--cam-text)",
              }}
            >
              −
            </button>
            <button
              type="button"
              aria-label="+"
              disabled={disabled || (max != null && current >= max)}
              onClick={() => stepBy(step)}
              className="vt-stepper-button"
              style={{
                width: 44,
                height: 44,
                border: "1px solid var(--cam-green)",
                borderRadius: "var(--cam-radius-sm)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 18,
                background: "var(--cam-green)",
                color: "#fff",
              }}
            >
              +
            </button>
          </div>
        )}
      </div>
      {unit && (
        <span style={{ fontFamily: "var(--cam-font-sans)", fontSize: 12, color: "var(--cam-text-muted)", whiteSpace: "nowrap" }}>
          {unit}
        </span>
      )}
    </div>
  );
}
