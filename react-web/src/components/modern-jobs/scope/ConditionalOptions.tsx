"use client";

import React from "react";

export interface OptionItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface ConditionalOptionsProps {
  options: OptionItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  allowMultiple?: boolean;
  ariaLabel?: string;
}

/**
 * Compact conditional option boxes for multi-choice/single-choice answers.
 * - 1px border, ~4px radius, compact padding, no icons, no shadows, no gradients.
 * - Responsive container queries: 1 col (<520px), 2 col (520-839px), 3 col (>=840px).
 */
export function ConditionalOptions({
  options,
  selected,
  onChange,
  allowMultiple = true,
  ariaLabel,
}: ConditionalOptionsProps) {
  const handleToggle = (id: string) => {
    if (!allowMultiple) {
      onChange(selected.includes(id) ? [] : [id]);
      return;
    }
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="cam-conditional-options-grid"
      style={{
        display: "grid",
        gap: "6px 8px",
        marginTop: 10,
        marginBottom: 8,
      }}
    >
      <style>{`
        .cam-conditional-options-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px 8px;
        }
        @media (min-width: 480px) {
          .cam-conditional-options-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          }
        }
      `}</style>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            role={allowMultiple ? "checkbox" : "radio"}
            aria-checked={isSelected}
            onClick={() => handleToggle(opt.id)}
            style={{
              textAlign: "left",
              padding: "7px 10px",
              borderRadius: 4,
              border: isSelected
                ? "1px solid var(--cam-green)"
                : "1px solid var(--cam-border)",
              background: isSelected
                ? "var(--vt-accent-soft, #eaf3ec)"
                : "var(--cam-surface)",
              color: isSelected
                ? "var(--cam-green)"
                : "var(--cam-text)",
              fontWeight: isSelected ? 600 : 400,
              fontSize: "var(--cam-answer-size)",
              cursor: "pointer",
              transition: "border-color 0.12s ease, background-color 0.12s ease",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              userSelect: "none",
            }}
          >
            <span>{opt.label}</span>
            {opt.sublabel && (
              <span
                style={{
                  fontSize: "var(--cam-microcopy-size)",
                  color: isSelected
                    ? "var(--cam-green)"
                    : "var(--cam-text-muted)",
                  fontWeight: 400,
                }}
              >
                {opt.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
