"use client";

import { useTranslations } from "next-intl";
import type { FormData, OnefopEntity, OnefopSection } from "@/lib/onefop-schema";
import { bilingual } from "@/lib/onefop-schema";
import { validateSectionData } from "@/lib/onefop-validation";

interface SimpleModeSidebarProps {
  entity: OnefopEntity;
  data: FormData;
  activeSectionId?: string;
  onSelectSection?: (sectionId: string) => void;
}

/**
 * Faithful port of SimpleModeSidebar from lib/screens/onefop/simple_mode_shell.dart
 * Provides persistent left navigation rail, real-time section validation indicators,
 * and completion progress tracking.
 */
export function SimpleModeSidebar({
  entity,
  data,
  activeSectionId,
  onSelectSection,
}: SimpleModeSidebarProps) {
  const t = useTranslations();
  const sections = entity.sections;

  const isSectionComplete = (sec: OnefopSection): boolean => {
    const issues = validateSectionData(sec, data);
    if (issues.length > 0) return false;
    // Check if at least one visible field has data
    return sec.fields.some((f) => {
      const v = data[f.id];
      return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
    });
  };

  const completedCount = sections.filter(isSectionComplete).length;
  const progressRatio = sections.length === 0 ? 0 : Math.round((completedCount / sections.length) * 100);

  const scrollToSection = (secId: string) => {
    if (onSelectSection) {
      onSelectSection(secId);
    }
    const el = document.getElementById(secId) ?? document.getElementById(`${secId}-heading`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <aside
      aria-label={t("simpleModeSidebar.ariaLabel")}
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--cam-surface)",
        borderRight: "var(--cam-border-width) solid var(--cam-border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "calc(100vh - 120px)",
        position: "sticky",
        top: 20,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: "var(--cam-space-3) var(--cam-space-4)",
          borderBottom: "var(--cam-border-width) solid var(--cam-border)",
        }}
      >
        <div style={{ fontSize: "var(--cam-font-size-sm)", fontWeight: 700, color: "var(--cam-green)" }}>
          {t("simpleModeSidebar.brandName")}
        </div>
        <div style={{ fontSize: "11px", color: "var(--cam-text-muted)" }}>{t("simpleModeSidebar.subtitle")}</div>
      </div>

      {/* Section List */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "var(--cam-space-2) 0" }}>
        {sections.map((sec, idx) => {
          const done = isSectionComplete(sec);
          const active = activeSectionId === sec.id;
          const label = bilingual(sec.title);

          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollToSection(sec.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--cam-space-2)",
                padding: "var(--cam-space-2) var(--cam-space-3)",
                border: "none",
                background: active ? "var(--cam-success-bg)" : "transparent",
                borderLeft: active ? "3px solid var(--cam-green)" : "3px solid transparent",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "var(--cam-font-size-sm)",
                color: active ? "var(--cam-green)" : "var(--cam-text)",
                fontWeight: active ? 600 : 400,
                transition: "background 0.15s ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 2,
                  background: done ? "var(--cam-green)" : "var(--cam-bg)",
                  color: done ? "#ffffff" : "var(--cam-text-muted)",
                  border: `1px solid ${done ? "var(--cam-green)" : "var(--cam-border-strong)"}`,
                }}
              >
                {done ? "✓" : idx + 1}
              </span>
              <span style={{ flex: 1, lineHeight: 1.35 }}>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Progress Footer */}
      <div
        style={{
          padding: "var(--cam-space-3) var(--cam-space-4)",
          borderTop: "var(--cam-border-width) solid var(--cam-border)",
          background: "var(--cam-bg)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
          <span style={{ color: "var(--cam-text-muted)" }}>{t("simpleModeSidebar.completedLabel")}</span>
          <span style={{ fontWeight: 800, color: "var(--cam-green)" }}>{progressRatio}%</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--cam-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressRatio}%`,
              background: "var(--cam-green)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ fontSize: "11px", color: "var(--cam-text-muted)", marginTop: "4px", textAlign: "right" }}>
          {t("simpleModeSidebar.progressCount", { completed: completedCount, total: sections.length })}
        </div>
      </div>
    </aside>
  );
}
