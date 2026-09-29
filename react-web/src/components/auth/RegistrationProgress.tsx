"use client";

import { useTranslations } from "next-intl";

interface StepItem {
  id: string;
  labelKey:
    | "stepEntityType"
    | "stepRespondent"
    | "stepEntityInfo"
    | "stepLocation"
    | "stepSecurity"
    | "stepReview";
}

const REGISTRATION_STEPS: StepItem[] = [
  { id: "entityType", labelKey: "stepEntityType" },
  { id: "respondent", labelKey: "stepRespondent" },
  { id: "entityInfo", labelKey: "stepEntityInfo" },
  { id: "location", labelKey: "stepLocation" },
  { id: "security", labelKey: "stepSecurity" },
  { id: "review", labelKey: "stepReview" },
];

interface RegistrationProgressProps {
  currentStep: string;
  totalSteps?: number;
}

export function RegistrationProgress({ currentStep }: RegistrationProgressProps) {
  const t = useTranslations("registerPage");
  const currentIdx = REGISTRATION_STEPS.findIndex((s) => s.id === currentStep);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;
  const currentItem = REGISTRATION_STEPS[activeIdx] || REGISTRATION_STEPS[0];

  return (
    <div aria-label={t("stepIndicator", { current: activeIdx + 1, total: REGISTRATION_STEPS.length })} style={{ marginBottom: "20px" }}>
      {/* Desktop segmented track with connecting lines */}
      <div className="progress-rail-desktop" role="list">
        {REGISTRATION_STEPS.map((s, idx) => {
          const isCompleted = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          const stateClass = isCompleted ? "is-completed" : isCurrent ? "is-current" : "";

          return (
            <div
              key={s.id}
              className={`progress-step-item ${stateClass}`}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="progress-step-circle" aria-hidden="true">
                {isCompleted ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span className="progress-step-label">
                {t(s.labelKey)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile compact progress bar */}
      <div className="progress-rail-mobile">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--cam-green-dark)" }}>
            {t("stepIndicator", { current: activeIdx + 1, total: REGISTRATION_STEPS.length })}
          </span>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--cam-text-muted)" }}>
            {t(currentItem.labelKey)}
          </span>
        </div>
        <div
          style={{
            height: "4px",
            width: "100%",
            background: "var(--cam-border)",
            borderRadius: "var(--cam-radius-full)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((activeIdx + 1) / REGISTRATION_STEPS.length) * 100}%`,
              background: "var(--cam-green)",
              borderRadius: "var(--cam-radius-full)",
              transition: "width 0.25s ease-in-out",
            }}
          />
        </div>
      </div>
    </div>
  );
}
