interface WizardNavigationProps {
  ariaLabel: string;
  onPrevious: () => void;
  previousLabel: string;
  previousDisabled?: boolean;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  nextIcon?: string;
  onSaveAndExit?: () => void;
  saveAndExitLabel?: string;
  saving?: boolean;
  desktopSidebar?: boolean;
  contentMaxWidth?: string;
}

/** Shared in-flow navigation frame and actions for every declaration wizard. */
export function WizardNavigation({
  ariaLabel,
  onPrevious,
  previousLabel,
  previousDisabled = false,
  onNext,
  nextLabel,
  nextDisabled = false,
  nextIcon = "\u2192",
  onSaveAndExit,
  saveAndExitLabel,
  saving = false,
  desktopSidebar = false,
  contentMaxWidth = "var(--vt-content-max, 940px)",
}: WizardNavigationProps) {
  return (
    <nav
      aria-label={ariaLabel}
      style={{
        position: "static",
        background: "var(--cam-surface)",
        borderTop: "1px solid var(--cam-border)",
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          display: desktopSidebar ? "grid" : "flex",
          gridTemplateColumns: desktopSidebar ? "var(--vt-sidebar-width, 280px) 1fr" : undefined,
          alignItems: "center",
          width: "100%",
        }}
      >
        {desktopSidebar && (
          <div
            aria-hidden="true"
            style={{
              borderRight: "1px solid var(--cam-border)",
              height: "100%",
              minHeight: 64,
            }}
          />
        )}
        <div
          style={{
            flex: 1,
            padding: "12px clamp(12px, 3vw, 24px)",
            display: "flex",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          <div style={{ width: "100%", maxWidth: contentMaxWidth, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                width: "100%",
              }}
            >
              <button
                type="button"
                onClick={onPrevious}
                disabled={previousDisabled}
                className="cam-button cam-button-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  ...(previousDisabled ? { opacity: 0.6, cursor: "not-allowed" } : null),
                }}
              >
                <span aria-hidden="true">{"\u2190"}</span>
                <span>{previousLabel}</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {onSaveAndExit && saveAndExitLabel && (
                  <button
                    type="button"
                    onClick={onSaveAndExit}
                    disabled={saving}
                    className="cam-button cam-button-secondary"
                  >
                    {saveAndExitLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onNext}
                  disabled={nextDisabled}
                  className="cam-button cam-button-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <span>{nextLabel}</span>
                  <span aria-hidden="true">{nextIcon}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
