"use client";

import { useTranslations } from "next-intl";
import React, { useState, useRef, useEffect, useCallback } from "react";

interface ResizableSplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidthPx?: number;
  defaultRightWidthPx?: number;
  minLeftWidthPx?: number;
  maxLeftWidthPx?: number;
  minRightWidthPx?: number;
  maxRightWidthPx?: number;
  storageKeyLeft?: string;
  storageKeyRight?: string;
  locale?: "fr" | "en";
  className?: string;
  style?: React.CSSProperties;
}

export function ResizableSplitPane({
  left,
  right,
  defaultLeftWidthPx = 420,
  defaultRightWidthPx = 760,
  minLeftWidthPx = 320,
  maxLeftWidthPx = 820,
  minRightWidthPx = 520,
  maxRightWidthPx = 1500,
  storageKeyLeft = "dsmo_quiz_box_width",
  storageKeyRight = "dsmo_table_box_width",
  className,
  style,
}: ResizableSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  const [leftWidth, setLeftWidth] = useState<number>(defaultLeftWidthPx);
  const [rightWidth, setRightWidth] = useState<number>(defaultRightWidthPx);

  // Drag states
  const [isDraggingLeft, setIsDraggingLeft] = useState<boolean>(false);
  const [isDraggingRight, setIsDraggingRight] = useState<boolean>(false);
  const [isHoveredLeft, setIsHoveredLeft] = useState<boolean>(false);
  const [isHoveredRight, setIsHoveredRight] = useState<boolean>(false);

  // Restore saved widths from localStorage on mount
  useEffect(() => {
    try {
      const savedLeft = localStorage.getItem(storageKeyLeft);
      if (savedLeft) {
        const val = parseFloat(savedLeft);
        if (!isNaN(val) && val >= minLeftWidthPx && val <= maxLeftWidthPx) {
          setLeftWidth(val);
        }
      }
      const savedRight = localStorage.getItem(storageKeyRight);
      if (savedRight) {
        const val = parseFloat(savedRight);
        if (!isNaN(val) && val >= minRightWidthPx && val <= maxRightWidthPx) {
          setRightWidth(val);
        }
      }
    } catch (_) {}
  }, [storageKeyLeft, storageKeyRight, minLeftWidthPx, maxLeftWidthPx, minRightWidthPx, maxRightWidthPx]);

  // Handle 1 (Quiz Box resize): changes ONLY leftWidth without altering rightWidth
  const handlePointerDownLeft = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    setIsDraggingLeft(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  const handlePointerMoveLeft = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingLeft || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const clamped = Math.min(Math.max(relativeX, minLeftWidthPx), maxLeftWidthPx);
      setLeftWidth(clamped);
    },
    [isDraggingLeft, minLeftWidthPx, maxLeftWidthPx]
  );

  const handlePointerUpLeft = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingLeft) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setIsDraggingLeft(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(storageKeyLeft, Math.round(leftWidth).toString());
      } catch (_) {}
    },
    [isDraggingLeft, leftWidth, storageKeyLeft]
  );

  const handleDoubleClickLeft = useCallback(() => {
    setLeftWidth(defaultLeftWidthPx);
    try {
      localStorage.removeItem(storageKeyLeft);
    } catch (_) {}
  }, [defaultLeftWidthPx, storageKeyLeft]);

  // Handle 2 (Results Table resize): changes ONLY rightWidth without altering leftWidth
  const handlePointerDownRight = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    setIsDraggingRight(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  const handlePointerMoveRight = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRight || !rightPaneRef.current) return;
      const rect = rightPaneRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const clamped = Math.min(Math.max(relativeX, minRightWidthPx), maxRightWidthPx);
      setRightWidth(clamped);
    },
    [isDraggingRight, minRightWidthPx, maxRightWidthPx]
  );

  const handlePointerUpRight = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRight) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setIsDraggingRight(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(storageKeyRight, Math.round(rightWidth).toString());
      } catch (_) {}
    },
    [isDraggingRight, rightWidth, storageKeyRight]
  );

  const handleDoubleClickRight = useCallback(() => {
    setRightWidth(defaultRightWidthPx);
    try {
      localStorage.removeItem(storageKeyRight);
    } catch (_) {}
  }, [defaultRightWidthPx, storageKeyRight]);

  const t = useTranslations("modernJobs.splitPane");
  const hasRight = right != null;
  const titleHintLeft = t("hintLeft");
  const titleHintRight = t("hintRight");

  return (
    <div
      ref={containerRef}
      className={`cam-resizable-split ${hasRight ? "" : "cam-resizable-split--solo"} ${className || ""}`}
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        alignItems: "stretch",
        overflowX: "auto",
        overflowY: "hidden",
        paddingBottom: 8,
        ...style,
      }}
    >
      <style>{`
        .cam-resizable-split {
          flex-direction: column;
          height: auto;
        }
        .cam-resizable-left-pane {
          width: 100% !important;
          min-width: 0;
          height: auto;
          flex-shrink: 0;
        }
        .cam-resizable-divider-left,
        .cam-resizable-divider-right {
          display: none !important;
        }
        .cam-resizable-right-pane {
          width: 100% !important;
          min-width: 0;
          height: auto;
          flex-shrink: 0;
          margin-top: 24px;
        }

        @media (min-width: 960px) {
          .cam-resizable-split {
            flex-direction: row;
            height: calc(100vh - 170px);
            min-height: 520px;
          }
          .cam-resizable-left-pane {
            width: var(--pane-left-width) !important;
            height: 100%;
          }
          .cam-resizable-divider-left {
            display: flex !important;
          }
          .cam-resizable-right-pane {
            width: var(--pane-right-width) !important;
            height: 100%;
            margin-top: 0;
          }
          .cam-resizable-divider-right {
            display: flex !important;
          }
          .cam-resizable-split--solo .cam-resizable-left-pane {
            width: min(760px, 100%) !important;
          }
        }
      `}</style>

      {/* ── Left Pane: Quiz Box (Independent Width & Internal Scroll) ── */}
      <div
        ref={leftPaneRef}
        className="cam-resizable-left-pane"
        style={
          {
            "--pane-left-width": `${leftWidth}px`,
            minWidth: 0,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: isDraggingLeft ? "none" : "width 0.08s ease-out",
          } as React.CSSProperties
        }
      >
        {left}
      </div>

      {/* ── Handle 1: Quiz Box Resize Handle (Adjusts ONLY Quiz Box) ── */}
      {hasRight && <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(leftWidth)}
        aria-valuemin={minLeftWidthPx}
        aria-valuemax={maxLeftWidthPx}
        aria-label={t("resizeQuiz")}
        tabIndex={0}
        title={titleHintLeft}
        className="cam-resizable-divider-left"
        onPointerDown={handlePointerDownLeft}
        onPointerMove={handlePointerMoveLeft}
        onPointerUp={handlePointerUpLeft}
        onPointerCancel={handlePointerUpLeft}
        onDoubleClick={handleDoubleClickLeft}
        onMouseEnter={() => setIsHoveredLeft(true)}
        onMouseLeave={() => setIsHoveredLeft(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setLeftWidth((w) => Math.max(minLeftWidthPx, w - 15));
          if (e.key === "ArrowRight") setLeftWidth((w) => Math.min(maxLeftWidthPx, w + 15));
          if (e.key === "Enter") handleDoubleClickLeft();
        }}
        style={{
          width: 18,
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "col-resize",
          position: "relative",
          zIndex: 20,
          touchAction: "none",
          userSelect: "none",
          outline: "none",
          padding: "0 2px",
          flexShrink: 0,
        }}
      >
        {/* Vertical line indicator */}
        <div
          style={{
            width: 3,
            height: "100%",
            borderRadius: 3,
            background:
              isDraggingLeft || isHoveredLeft
                ? "var(--cam-green)"
                : "var(--cam-border)",
            boxShadow: isDraggingLeft ? "0 0 0 3px rgba(26, 92, 58, 0.15)" : "none",
            transition: isDraggingLeft ? "none" : "all 0.15s ease",
          }}
        />

        {/* Center Grip Pill Affordance */}
        <div
          style={{
            position: "sticky",
            top: "calc(50vh - 20px)",
            width: 14,
            height: 44,
            borderRadius: "var(--cam-radius-full, 9999px)",
            background: isDraggingLeft || isHoveredLeft ? "var(--cam-green)" : "var(--cam-surface)",
            border: `1.5px solid ${
              isDraggingLeft || isHoveredLeft ? "var(--cam-green)" : "var(--cam-border)"
            }`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            transition: isDraggingLeft ? "none" : "all 0.15s ease",
          }}
        >
          <span
            style={{
              width: 4,
              height: 1.5,
              borderRadius: 1,
              background: isDraggingLeft || isHoveredLeft ? "#ffffff" : "var(--cam-text-muted)",
            }}
          />
          <span
            style={{
              width: 4,
              height: 1.5,
              borderRadius: 1,
              background: isDraggingLeft || isHoveredLeft ? "#ffffff" : "var(--cam-text-muted)",
            }}
          />
          <span
            style={{
              width: 4,
              height: 1.5,
              borderRadius: 1,
              background: isDraggingLeft || isHoveredLeft ? "#ffffff" : "var(--cam-text-muted)",
            }}
          />
        </div>
      </div>}

      {/* ── Right Pane: Results Table (Independent Width & Internal Scroll) ── */}
      {hasRight && <div
        ref={rightPaneRef}
        className="cam-resizable-right-pane"
        style={
          {
            "--pane-right-width": `${rightWidth}px`,
            minWidth: 0,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: isDraggingRight ? "none" : "width 0.08s ease-out",
          } as React.CSSProperties
        }
      >
        {right}
      </div>}

      {/* ── Handle 2: Results Table Resize Handle (Adjusts ONLY Results Table) ── */}
      {hasRight && <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(rightWidth)}
        aria-valuemin={minRightWidthPx}
        aria-valuemax={maxRightWidthPx}
        aria-label={t("resizeResults")}
        tabIndex={0}
        title={titleHintRight}
        className="cam-resizable-divider-right"
        onPointerDown={handlePointerDownRight}
        onPointerMove={handlePointerMoveRight}
        onPointerUp={handlePointerUpRight}
        onPointerCancel={handlePointerUpRight}
        onDoubleClick={handleDoubleClickRight}
        onMouseEnter={() => setIsHoveredRight(true)}
        onMouseLeave={() => setIsHoveredRight(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setRightWidth((w) => Math.max(minRightWidthPx, w - 20));
          if (e.key === "ArrowRight") setRightWidth((w) => Math.min(maxRightWidthPx, w + 20));
          if (e.key === "Enter") handleDoubleClickRight();
        }}
        style={{
          width: 18,
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "col-resize",
          position: "relative",
          zIndex: 20,
          touchAction: "none",
          userSelect: "none",
          outline: "none",
          padding: "0 2px",
          flexShrink: 0,
        }}
      >
        {/* Vertical line indicator */}
        <div
          style={{
            width: 3,
            height: "100%",
            borderRadius: 3,
            background:
              isDraggingRight || isHoveredRight
                ? "var(--cam-green)"
                : "var(--cam-border)",
            boxShadow: isDraggingRight ? "0 0 0 3px rgba(26, 92, 58, 0.15)" : "none",
            transition: isDraggingRight ? "none" : "all 0.15s ease",
          }}
        />

        {/* Center Grip Pill Affordance */}
        <div
          style={{
            position: "sticky",
            top: "calc(50vh - 20px)",
            width: 14,
            height: 44,
            borderRadius: "var(--cam-radius-full, 9999px)",
            background: isDraggingRight || isHoveredRight ? "var(--cam-green)" : "var(--cam-surface)",
            border: `1.5px solid ${
              isDraggingRight || isHoveredRight ? "var(--cam-green)" : "var(--cam-border)"
            }`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            transition: isDraggingRight ? "none" : "all 0.15s ease",
          }}
        >
          <span
            style={{
              width: 4,
              height: 1.5,
              borderRadius: 1,
              background: isDraggingRight || isHoveredRight ? "#ffffff" : "var(--cam-text-muted)",
            }}
          />
          <span
            style={{
              width: 4,
              height: 1.5,
              borderRadius: 1,
              background: isDraggingRight || isHoveredRight ? "#ffffff" : "var(--cam-text-muted)",
            }}
          />
          <span
            style={{
              width: 4,
              height: 1.5,
              borderRadius: 1,
              background: isDraggingRight || isHoveredRight ? "#ffffff" : "var(--cam-text-muted)",
            }}
          />
        </div>
      </div>}
    </div>
  );
}
