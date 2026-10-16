"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { useTranslations } from "next-intl";

export interface InfoTooltipProps {
  content: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Accessible Info Tooltip (ⓘ) popover.
 * - Supports desktop hover with safety delay and click toggle for touch devices
 * - Keyboard accessible (Enter/Space to toggle, Escape to dismiss)
 * - Outside click dismiss
 * - Viewport-safe alignment (prevents clipping on right edges)
 */
export function InfoTooltip({
  content,
  className = "",
  ariaLabel: ariaLabelProp,
}: InfoTooltipProps) {
  const t = useTranslations("onefopUi");
  const ariaLabel = ariaLabelProp ?? t("moreInfo");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(true), 150);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  // Close on Escape or outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <span
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-flex items-center align-middle ml-1.5 ${className}`}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-5 h-5 inline-flex items-center justify-center rounded-full text-[var(--cam-text-muted)] hover:text-[var(--cam-green)] hover:bg-[var(--cam-success-bg)] focus-visible:ring-2 focus-visible:ring-[var(--cam-green)] outline-none transition-colors duration-150 cursor-pointer"
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute z-50 bottom-full mb-2 left-1/2 w-64 max-w-[85vw] p-3 rounded-[4px] bg-[var(--cam-text)] text-white text-xs leading-relaxed shadow-lg border border-[var(--cam-green)]/40 cam-tooltip-pop-in"
        >
          {/* Arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--cam-text)]"
            aria-hidden="true"
          />
          {content}
        </div>
      )}
    </span>
  );
}
