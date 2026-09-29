"use client";

import React, { type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

export interface CheckboxOption {
  value: string;
  label: string;
  description?: string | null;
}

export interface AccessibleCheckboxGroupProps {
  id: string;
  label?: string;
  options: CheckboxOption[];
  value: unknown;
  onChange: (value: string[]) => void;
  instructionText?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Accessible Checkbox Group component matching CAM-LEAP #1a5c3a green palette.
 * Keyboard toggleable (Space/Enter), ARIA compliant, with SVG checkmarks
 * and comfortable WCAG touch targets.
 */
export function AccessibleCheckboxGroup({
  id,
  label,
  options,
  value,
  onChange,
  instructionText: instructionTextProp,
  className = "",
  disabled = false,
}: AccessibleCheckboxGroupProps) {
  const t = useTranslations("onefopUi");
  const instructionText = instructionTextProp ?? t("selectAllThatApply");
  const currentValues: string[] = Array.isArray(value)
    ? (value as unknown[]).map(String)
    : [];

  const handleToggle = (optVal: string) => {
    if (disabled) return;
    const next = currentValues.includes(optVal)
      ? currentValues.filter((v) => v !== optVal)
      : [...currentValues, optVal];
    onChange(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, optVal: string) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggle(optVal);
    }
  };

  return (
    <div id={id} role="group" aria-label={label} className={`w-full ${className}`}>
      {instructionText && (
        <div className="text-xs italic text-[#4a5a50] mb-3 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1a5c3a]" aria-hidden="true" />
          <span>{instructionText}</span>
        </div>
      )}

      <div
        className={`grid gap-2.5 ${
          options.length > 4
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {options.map((opt) => {
          const isSelected = currentValues.includes(opt.value);

          return (
            <div
              key={opt.value}
              role="checkbox"
              aria-checked={isSelected}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : 0}
              onClick={() => handleToggle(opt.value)}
              onKeyDown={(e) => handleKeyDown(e, opt.value)}
              className={`group flex items-start gap-3 p-3 rounded-[4px] border transition-all duration-150 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[#1a5c3a] focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-[#1a5c3a] bg-[#eaf3ec]/40 shadow-xs"
                  : "border-[#d8ddd3] bg-white hover:border-[#aab5a3] hover:bg-[#fafaf7]"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {/* Checkbox Box */}
              <div
                className={`mt-0.5 w-5 h-5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors duration-150 ${
                  isSelected
                    ? "border-[#1a5c3a] bg-[#1a5c3a] text-white"
                    : "border-[#aab5a3] group-hover:border-[#4a5a50] bg-white text-transparent"
                }`}
                aria-hidden="true"
              >
                <svg
                  className="w-3.5 h-3.5 stroke-current stroke-[2.5] fill-none"
                  viewBox="0 0 16 16"
                >
                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Text Label & Description */}
              <div className="min-w-0 flex-1">
                <span
                  className={`block text-sm leading-snug font-sans ${
                    isSelected
                      ? "font-semibold text-[#0b1f14]"
                      : "font-normal text-[#1c1f1d] group-hover:text-[#0b1f14]"
                  }`}
                >
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="block text-xs text-[#4a5a50] mt-0.5 leading-relaxed">
                    {opt.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
