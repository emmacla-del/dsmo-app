"use client";

// The hero animation's pause control (2026-10-21). The loop runs 33 seconds
// beside the hero's text, so WCAG 2.2.2 asks for a way to stop it. The
// animation itself stays CSS-only, rendered on the server: this wrapper only
// sets data-paused, and the stylesheet pauses every animation under it.
// The button is outside the role="img" panel, whose children assistive
// technology does not reach.

import { useState, type ReactNode } from "react";
import styles from "./project-journey-hero.module.css";

export function JourneyPlayer({
  children,
  pauseLabel,
  playLabel,
}: {
  children: ReactNode;
  pauseLabel: string;
  playLabel: string;
}) {
  const [paused, setPaused] = useState(false);

  return (
    <div className={styles.player} data-paused={paused || undefined}>
      {children}
      <button type="button" className={styles.pause} onClick={() => setPaused(!paused)}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          {paused ? (
            <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
          ) : (
            <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor" />
          )}
        </svg>
        {paused ? playLabel : pauseLabel}
      </button>
    </div>
  );
}
