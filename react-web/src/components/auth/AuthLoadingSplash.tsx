import { useTranslations } from "next-intl";
import { BrandLockup } from "@/components/brand/BrandLockup";

/**
 * Branded skeleton loader for gated route loading / auth checking states.
 * Uses BrandLockup with existing camleapPulse keyframe animation and design tokens.
 */
export function AuthLoadingSplash() {
  const t = useTranslations();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--cam-bg)",
        color: "var(--cam-text-muted)",
        padding: "var(--cam-space-6)",
      }}
    >
      <div
        style={{
          marginBottom: "var(--cam-space-4)",
          animation: "camleapPulse 2s ease-in-out infinite",
        }}
      >
        <BrandLockup size="compact" nameAs="div" />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "var(--cam-font-size-sm)",
          color: "var(--cam-text-muted)",
        }}
      >
        {t("common.workspacePreparing")}
      </p>
    </div>
  );
}
