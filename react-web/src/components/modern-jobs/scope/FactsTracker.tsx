"use client";

import { useTranslations } from "next-intl";
import React from "react";
import type { TrackerRow, TrackerColumnKey, BeatDefinition } from "./ScopeTypes";

interface FactsTrackerProps {
  rows: TrackerRow[];
  activeBeat: BeatDefinition;
  onSelectBeat: (beat: BeatDefinition) => void;
  onReset?: () => void;
  locale?: "fr" | "en";
  className?: string;
  style?: React.CSSProperties;
  quietSummary?: string[];
  fullWidth?: boolean;
}

/**
 * Labelled Tracker Table (Memory only, not saisie).
 * 7 fixed columns: Fait | Réponse | Types / motifs | Personnels | Âges | Diplômes | Autre
 * Rows appear only when that main is answered.
 * Row click -> jump to main beat.
 * Filled cell click -> jump to that child beat.
 */
export function FactsTracker({
  rows,
  activeBeat,
  onSelectBeat,
  onReset,
  className,
  style,
  quietSummary,
  fullWidth = false,
}: FactsTrackerProps) {
  const t = useTranslations("modernJobs.facts");

  const columns: Array<{ key: TrackerColumnKey; label: string; width: string; minWidth: string }> = [
    { key: "fait", label: t("colFact"), width: "17%", minWidth: "110px" },
    { key: "reponse", label: t("colAnswer"), width: "8%", minWidth: "60px" },
    { key: "typesMotifs", label: t("colTypes"), width: "15%", minWidth: "95px" },
    { key: "personnels", label: t("colStaff"), width: "14%", minWidth: "85px" },
    { key: "ages", label: t("colAges"), width: "11%", minWidth: "75px" },
    { key: "diplomes", label: t("colDiplomas"), width: "13%", minWidth: "80px" },
    { key: "autre", label: t("colOther"), width: "22%", minWidth: "140px" },
  ];

  const title = t("title");
  const emptyPlaceholder = t("empty");

  return (
    <aside
      aria-label={title}
      className={className}
      style={{
        background: "var(--cam-surface)",
        border: "1px solid var(--cam-border)",
        borderRadius: "var(--cam-radius-md, 8px)",
        padding: fullWidth ? "18px 22px" : "14px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          borderBottom: "1px solid var(--cam-border)",
          paddingBottom: 10,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: "var(--cam-text)",
          }}
        >
          {title}
        </h3>
        {onReset && (
          <button
            type="button"
            onClick={() => {
              const confirmMsg = t("resetConfirm");
              if (typeof window !== "undefined" && window.confirm(confirmMsg)) {
                onReset();
              }
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--cam-green)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            {t("reset")}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: "28px 12px",
            textAlign: "center",
            color: "var(--cam-text-muted)",
            fontSize: 12.5,
            lineHeight: 1.5,
            flex: 1,
            display: "grid",
            placeItems: "center",
          }}
        >
          <p style={{ margin: 0 }}>{emptyPlaceholder}</p>
        </div>
      ) : (
        <div
          className="cam-tracker-table-container"
          style={{
            width: "100%",
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: "640px",
              borderCollapse: "collapse",
              fontSize: 14,
              lineHeight: 1.35,
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  borderBottom: "2px solid var(--cam-border)",
                  background: "var(--cam-surface)",
                }}
              >
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    style={{
                      padding: "8px 10px",
                      fontWeight: 700,
                      color: "var(--cam-text-muted)",
                      fontSize: 12.5,
                      whiteSpace: "nowrap",
                      width: col.width,
                      minWidth: col.minWidth,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isRowActive = activeBeat.mainId === row.mainId;

                const renderCellContent = (colKey: TrackerColumnKey) => {
                  if (colKey === "fait") {
                    return (
                      <span style={{ fontWeight: 600, color: "var(--cam-text)" }}>
                        {row.title}
                      </span>
                    );
                  }

                  if (colKey === "reponse") {
                    if (row.reponse === null) return <span style={{ color: "#94a3b8" }}>—</span>;
                    const isYes = row.reponse === "Oui";
                    return (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontWeight: 700,
                          fontSize: 12.5,
                          background: isYes ? "#eaf3ec" : "#f1f5f9",
                          color: isYes ? "var(--cam-green)" : "#475569",
                        }}
                      >
                        {isYes ? t("yes") : t("no")}
                      </span>
                    );
                  }

                  const values =
                    colKey === "typesMotifs"
                      ? row.typesMotifs
                      : colKey === "personnels"
                      ? row.personnels
                      : colKey === "ages"
                      ? row.ages
                      : colKey === "diplomes"
                      ? row.diplomes
                      : row.autre;

                  if (!values || values.length === 0) {
                    return <span style={{ color: "#cbd5e1" }}>—</span>;
                  }

                  return (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 4px" }}>
                      {values.map((v, idx) => {
                        const label = typeof v === "string" ? v : v.label;
                        const tooltip = typeof v === "string" ? undefined : v.tooltip;
                        return (
                          <span
                            key={idx}
                            title={tooltip || label}
                            style={{
                              display: "inline-block",
                              background: "#f1f5f9",
                              padding: "1px 5px",
                              borderRadius: 3,
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#334155",
                              maxWidth: "100%",
                              wordBreak: "break-word",
                              cursor: tooltip ? "help" : "default",
                              borderBottom: tooltip ? "1px dotted #94a3b8" : "none",
                            }}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <tr
                    key={row.mainId}
                    style={{
                      borderBottom: "1px solid var(--cam-border)",
                      background: isRowActive ? "var(--vt-accent-soft, #eaf3ec)" : "transparent",
                      transition: "background-color 0.1s ease",
                    }}
                  >
                    {columns.map((col) => {
                      const childBeatForCell = row.cellBeats?.[col.key];
                      const isCellActive =
                        isRowActive &&
                        ((col.key === "reponse" && !activeBeat.childBeatId) ||
                          (childBeatForCell && activeBeat.childBeatId === childBeatForCell));

                      const isClickable =
                        col.key === "fait" ||
                        col.key === "reponse" ||
                        Boolean(childBeatForCell && row.reponse === "Oui");

                      return (
                        <td
                          key={col.key}
                          onClick={() => {
                            if (!isClickable) return;
                            if (col.key === "fait" || col.key === "reponse" || !childBeatForCell) {
                              onSelectBeat({ mainId: row.mainId });
                            } else {
                              onSelectBeat({ mainId: row.mainId, childBeatId: childBeatForCell });
                            }
                          }}
                          style={{
                            padding: "9px 10px",
                            verticalAlign: "top",
                            cursor: isClickable ? "pointer" : "default",
                            background: isCellActive ? "var(--vt-accent-soft, #eaf3ec)" : "transparent",
                            outline: isCellActive ? "1px solid var(--cam-green)" : "none",
                            borderRadius: isCellActive ? 3 : 0,
                            minWidth: col.minWidth,
                            transition: "background-color 0.1s ease",
                          }}
                        >
                          {renderCellContent(col.key)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quiet summary line of official codes under the table */}
      {quietSummary && quietSummary.length > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 8,
            borderTop: "1px dashed var(--cam-border)",
            fontSize: 11,
            color: "var(--cam-text-muted)",
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 6px",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600 }}>{t("enabledSections")}</span>
          {quietSummary.map((code) => (
            <span
              key={code}
              style={{
                fontFamily: "var(--cam-font-mono)",
                background: "#f1f5f9",
                padding: "1px 5px",
                borderRadius: 3,
                fontSize: 10,
                color: "#475569",
              }}
            >
              {code}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
