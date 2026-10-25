"use client";

import type { CSSProperties, ReactNode } from "react";

/** Shared question and error typography for every declaration field renderer. */
export const questionLabelStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--cam-font-sans)",
  fontSize: "var(--cam-question-size)",
  fontWeight: "var(--cam-question-weight)",
  lineHeight: "var(--cam-question-line-height)",
  color: "var(--cam-text)",
  marginBottom: "var(--cam-field-stack-gap)",
};

export const questionErrorStyle: CSSProperties = {
  fontSize: "var(--cam-font-size-xs, 0.75rem)",
  fontWeight: "var(--cam-font-weight-semibold)",
  color: "var(--cam-error)",
  lineHeight: 1.35,
};

/** Shared label, control, and field-error frame for schema-backed questions. */
export function QuestionField({
  fieldId,
  label,
  children,
  wrapperStyle,
  labelWrapperStyle,
  labelStyle,
  labelAs = "label",
  labelBelow,
  beforeControl,
  errorId,
  errorMessage,
  errorStyle,
  messageWrapperStyle,
  afterControl,
}: {
  fieldId: string;
  label: ReactNode;
  children: ReactNode;
  wrapperStyle?: CSSProperties;
  labelWrapperStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  labelAs?: "label" | "div";
  labelBelow?: ReactNode;
  beforeControl?: ReactNode;
  errorId?: string;
  errorMessage?: string;
  errorStyle?: CSSProperties;
  messageWrapperStyle?: CSSProperties;
  afterControl?: ReactNode;
}) {
  return (
    <div style={wrapperStyle}>
      <div style={labelWrapperStyle}>
        {labelAs === "label" ? (
          <label htmlFor={fieldId} style={{ ...questionLabelStyle, ...labelStyle }}>{label}</label>
        ) : (
          <div style={{ ...questionLabelStyle, ...labelStyle }}>{label}</div>
        )}
        {labelBelow}
      </div>
      {beforeControl}
      {children}
      {(errorMessage || afterControl) && (
        <div style={messageWrapperStyle}>
          {errorMessage && (
            <p id={errorId} role="alert" style={{ ...questionErrorStyle, ...errorStyle }}>
              {errorMessage}
            </p>
          )}
          {afterControl}
        </div>
      )}
    </div>
  );
}
