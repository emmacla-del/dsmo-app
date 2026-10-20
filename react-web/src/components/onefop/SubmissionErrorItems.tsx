"use client";

import type { SubmissionErrorDetail, SubmissionErrorTarget } from "@/lib/onefop-submission";

/**
 * The list under a refused submission's summary. Each table or question the
 * server refused is named in the respondent's words and, where the screen
 * can take them there, is a link to it (audit C5). Lines that name no place
 * in the form are shown as plain text.
 */
export function SubmissionErrorItems({
  detail,
  onGoTo,
}: {
  detail: SubmissionErrorDetail;
  onGoTo?: (target: SubmissionErrorTarget) => void;
}) {
  if (detail.items.length === 0) return null;
  const targets = detail.targets ?? [];
  return (
    <ul style={{ margin: "var(--cam-space-1) 0 0", paddingLeft: "var(--cam-space-5)" }}>
      {detail.items.map((item, index) => {
        const target = targets[index];
        return (
          <li key={index}>
            {target && onGoTo ? (
              <button
                type="button"
                onClick={() => onGoTo(target)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "inherit",
                  font: "inherit",
                  textAlign: "left",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                {item}
              </button>
            ) : (
              item
            )}
          </li>
        );
      })}
    </ul>
  );
}
