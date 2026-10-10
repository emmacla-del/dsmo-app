"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * The side panel every respondent wizard puts its WizardStepList in
 * (.cam-wizard-rail in globals.css). `sheet` drops the panel's own frame
 * when it sits inside a phone drawer, whose sheet is the frame. Under a
 * sticky header the panel pins at --cam-wizard-rail-top, which
 * ModernJobsHeader publishes.
 */
export function WizardRail({
  label,
  className,
  head,
  progress,
  foot,
  sheet = false,
  children,
}: {
  /** Accessible name of the panel, when the list inside does not name it enough. */
  label?: string;
  /** A wizard's own layout hook, e.g. registration's .flow-panel breakpoint. */
  className?: string;
  /** Replaces the "Sommaire" title, e.g. the registration identity block. */
  head?: ReactNode;
  /** Sections complete out of the total; omitted, no progress line. */
  progress?: { done: number; total: number };
  foot?: ReactNode;
  sheet?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("wizardRail");
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <aside
      className={["cam-wizard-rail", sheet && "cam-wizard-rail--sheet", className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {head ?? (
        <div>
          {!sheet && <h2 className="cam-wizard-rail-title">{t("title")}</h2>}
          {progress && (
            <>
              <p className="cam-wizard-rail-progress">
                {t("progress", { done: progress.done, total: progress.total })}
              </p>
              <div
                className="cam-wizard-rail-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={t("progressBar")}
              >
                <div className="cam-wizard-rail-bar-fill" style={{ width: `${percent}%` }} />
              </div>
            </>
          )}
        </div>
      )}
      {children}
      {foot && <div className="cam-wizard-rail-foot">{foot}</div>}
    </aside>
  );
}
