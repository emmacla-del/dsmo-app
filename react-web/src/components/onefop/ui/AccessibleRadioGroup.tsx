"use client";

import React, { useRef, type KeyboardEvent } from "react";

export interface RadioOption {
  value: string;
  label: string;
  description?: string | null;
}

export interface AccessibleRadioGroupProps {
  id: string;
  name?: string;
  label?: string;
  options: RadioOption[];
  value: unknown;
  onChange: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
  disabled?: boolean;
  /** Sets aria-required on the radiogroup. */
  required?: boolean;
}

/**
 * Accessible Radio Group component matching CAM-LEAP #1a5c3a green palette.
 * Full keyboard arrow navigation (Up/Down/Left/Right), Space selection,
 * and ARIA radiogroup / radio compliance.
 */
export function AccessibleRadioGroup({
  id,
  name: _name,
  label,
  options,
  value,
  onChange,
  orientation = "vertical",
  className = "",
  disabled = false,
  required = false,
}: AccessibleRadioGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const selectedValue = String(value ?? "");

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || options.length === 0) return;

    const currentIndex = options.findIndex((opt) => opt.value === selectedValue);
    let nextIndex = -1;

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      nextIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (currentIndex >= 0) {
        onChange(options[currentIndex].value);
      }
      return;
    }

    if (nextIndex >= 0) {
      const nextOpt = options[nextIndex];
      onChange(nextOpt.value);

      // Focus the newly selected radio button
      const buttons = groupRef.current?.querySelectorAll<HTMLDivElement>('[role="radio"]');
      if (buttons && buttons[nextIndex]) {
        buttons[nextIndex].focus();
      }
    }
  };

  const isHorizontal = orientation === "horizontal";

  return (
    <div
      id={id}
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      aria-required={required || undefined}
      onKeyDown={handleKeyDown}
      className={`w-full ${className}`}
    >
      <div
        className={`flex ${
          isHorizontal
            ? "flex-row flex-wrap gap-4 sm:gap-6"
            : "flex-col gap-2.5"
        }`}
      >
        {options.map((opt, idx) => {
          const isSelected = selectedValue === opt.value;
          const isFocusable =
            isSelected || (!selectedValue && idx === 0);

          return (
            <div
              key={opt.value}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={disabled}
              tabIndex={isFocusable && !disabled ? 0 : -1}
              onClick={() => {
                if (!disabled) onChange(opt.value);
              }}
              className={`group flex items-start gap-3 p-3 rounded-md border transition-all duration-150 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[#1B4332] focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-[#1B4332] bg-[#eaf3ec]/60 shadow-xs"
                  : "border-[#1B4332] bg-white hover:bg-[#fafaf7]"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {/* Radio Circle Indicator */}
              <div
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150 ${
                  isSelected
                    ? "border-[#1B4332] bg-white"
                    : "border-[#1B4332] group-hover:border-[#144a28] bg-white"
                }`}
                aria-hidden="true"
              >
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1B4332]" />
                )}
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
