"use client";

import { useTranslations } from "next-intl";
import React, { type ChangeEvent } from "react";

export interface AccessibleNumberInputProps {
  id: string;
  name?: string;
  value: unknown;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  unitLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  showStepper?: boolean;
  onBlur?: () => void;
}

/**
 * Polished number input & stepper component matching CAM-LEAP #1a5c3a green palette.
 * Direct typing with tabular numbers (no jitter), tactile minus/plus buttons,
 * and optional unit label.
 */
export function AccessibleNumberInput({
  id,
  name,
  value,
  onChange,
  min = 0,
  max,
  step: stepDelta = 1,
  unitLabel,
  placeholder = "0",
  disabled = false,
  className = "",
  compact = false,
  showStepper = true,
  onBlur,
}: AccessibleNumberInputProps) {
  const t = useTranslations("onefopUi");
  const strVal = value == null ? "" : String(value);
  const numVal = parseInt(strVal, 10);
  const currentNum = Number.isFinite(numVal) ? numVal : 0;

  const handleStep = (delta: number) => {
    if (disabled) return;
    let next = currentNum + delta;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    onChange(String(next));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange("");
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      if (min !== undefined && parsed < min) {
        onChange(String(min));
      } else if (max !== undefined && parsed > max) {
        onChange(String(max));
      } else {
        onChange(raw);
      }
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`flex items-center bg-white border border-[#1B4332] rounded-[4px] transition-all duration-150 focus-within:border-[#1B4332] focus-within:ring-2 focus-within:ring-[#1B4332]/20 shadow-xs ${
          compact ? "h-8 max-w-[120px]" : "h-10 max-w-[200px]"
        } ${disabled ? "bg-[#fafaf7] opacity-60" : ""}`}
      >
        <input
          id={id}
          name={name || id}
          type="number"
          min={min}
          max={max}
          value={strVal}
          placeholder={placeholder}
          disabled={disabled}
          onChange={handleInputChange}
          onBlur={onBlur}
          className={`flex-1 min-w-0 bg-transparent text-[#0b1f14] font-semibold font-sans tabular-nums border-none outline-none focus:ring-0 ${
            compact ? "text-xs px-2 text-center" : "text-sm px-3"
          }`}
        />

        {showStepper && (
          <div className="flex items-center gap-0.5 pr-1 shrink-0">
            <button
              type="button"
              aria-label={t("decrease")}
              disabled={disabled || (min !== undefined && currentNum <= min)}
              onClick={() => handleStep(-stepDelta)}
              className="w-7 h-7 flex items-center justify-center rounded-[2px] border border-[#d8ddd3] bg-[#fafaf7] hover:bg-[#eaf3ec] active:bg-[#d8ddd3] text-[#0b1f14] font-bold text-sm transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              −
            </button>
            <button
              type="button"
              aria-label={t("increase")}
              disabled={disabled || (max !== undefined && currentNum >= max)}
              onClick={() => handleStep(stepDelta)}
              className="w-7 h-7 flex items-center justify-center rounded-[2px] border border-[#1a5c3a] bg-[#1a5c3a] hover:bg-[#144a28] active:bg-[#0b1f14] text-white font-bold text-sm transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              +
            </button>
          </div>
        )}
      </div>

      {unitLabel && (
        <span className="text-xs sm:text-sm font-medium text-[#4a5a50] whitespace-nowrap">
          {unitLabel}
        </span>
      )}
    </div>
  );
}
