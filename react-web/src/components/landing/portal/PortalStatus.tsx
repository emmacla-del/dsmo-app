import type { ReactNode } from "react";
import type { PortalPhaseState } from "./portal-content";
import styles from "../portal.module.css";

// A state, said the same way everywhere it appears: a dot and a label, in the
// colour the state owns. The hero's "in service" line and each phase's state
// are the same object, so they are the same component rather than two
// paragraphs that happen to look alike.
//
// The dot is aria-hidden: it repeats what the label already says, and a
// screen reader announcing "bullet, in service" helps nobody.

const DOT: Record<PortalPhaseState, string> = {
  live: styles.dotLive,
  next: styles.dotNext,
  planned: styles.dotPlanned,
};

const TEXT: Record<PortalPhaseState, string> = {
  live: styles.stateLive,
  next: styles.stateNext,
  planned: styles.statePlanned,
};

export function PortalStatus({
  state,
  children,
}: {
  state: PortalPhaseState;
  children: ReactNode;
}) {
  return (
    <p className={`${styles.status} ${TEXT[state]}`}>
      <span className={`${styles.dot} ${DOT[state]}`} aria-hidden="true" />
      {children}
    </p>
  );
}
