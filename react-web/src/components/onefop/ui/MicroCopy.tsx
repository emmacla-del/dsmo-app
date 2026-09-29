"use client";

import React, { type ReactNode } from "react";

export function RequiredBadge({ text = "(obligatoire)" }: { text?: string }) {
  return (
    <span className="text-xs font-semibold text-[#b3261e] ml-1.5" aria-hidden="true">
      {text}
    </span>
  );
}

export function FieldHint({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p className={`text-xs text-[#4a5a50] mt-1.5 leading-normal flex items-start gap-1.5 ${className}`}>
      <span className="inline-block w-1 h-1 rounded-full bg-[#aab5a3] mt-1.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function NotApplicableNotice({
  label = "Ne pas remplir / Non applicable",
  reason,
  className = "",
}: {
  label?: string;
  reason?: string;
  className?: string;
}) {
  return (
    <div
      className={`p-3 rounded-[4px] bg-[#fafaf7] border border-dashed border-[#aab5a3] text-[#4a5a50] text-xs flex items-center gap-2 ${className}`}
    >
      <span className="text-base" aria-hidden="true">
        ℹ
      </span>
      <div>
        <span className="font-semibold text-[#0b1f14]">{label}</span>
        {reason && <span className="ml-1 text-[#4a5a50]">({reason})</span>}
      </div>
    </div>
  );
}

export function SelectionInstruction({
  text = "Sélectionnez toutes les options applicables",
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={`text-xs italic text-[#4a5a50] mb-2.5 flex items-center gap-1.5 ${className}`}>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1a5c3a]" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

export function FieldErrorMessage({
  message,
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={`text-xs font-semibold text-[#b3261e] mt-1.5 flex items-center gap-1.5 animate-in fade-in duration-150 ${className}`}
    >
      <svg
        className="w-3.5 h-3.5 shrink-0 stroke-current stroke-2 fill-none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{message}</span>
    </p>
  );
}
