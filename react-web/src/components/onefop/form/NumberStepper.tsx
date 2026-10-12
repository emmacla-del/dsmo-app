"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * Consolidated numeric stepper: tabular-nums so digits don't jitter as the
 * value changes, clamps to [min, max], and an optional unit label. One
 * control, the same height and edge as every other answer box, with − and +
 * as divided segments inside it (.cam-stepper* in globals.css). Both are
 * neutral: a filled green "+" competed with the screen's one primary action.
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
  required = false,
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
  /** Sets aria-required on the input. */
  required?: boolean;
}) {
  const t = useTranslations("onefopUi");
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

  const boxClass = [
    "cam-stepper-box",
    compact ? "is-compact" : shouldShowButtons ? "has-buttons" : "is-plain",
    hasError ? "has-error" : "",
    disabled ? "is-disabled" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="cam-stepper">
      <div className={boxClass}>
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
          aria-required={required || undefined}
          value={(value as string) ?? ""}
          onChange={(e) => handleTyped(e.target.value)}
          // A wheel over a focused number box changes the figure without a
          // word; the grids already guard against it (onWheel blur).
          onWheel={(e) => e.currentTarget.blur()}
          className="cam-stepper-input"
        />
        {shouldShowButtons && (
          <>
            <button
              type="button"
              aria-label={t("decrease")}
              disabled={disabled || (min != null && current <= min)}
              onClick={() => stepBy(-step)}
              className="vt-stepper-button"
            >
              −
            </button>
            <button
              type="button"
              aria-label={t("increase")}
              disabled={disabled || (max != null && current >= max)}
              onClick={() => stepBy(step)}
              className="vt-stepper-button"
            >
              +
            </button>
          </>
        )}
      </div>
      {unit && (
        <span className="cam-hint" style={{ whiteSpace: "nowrap" }}>
          {unit}
        </span>
      )}
    </div>
  );
}
