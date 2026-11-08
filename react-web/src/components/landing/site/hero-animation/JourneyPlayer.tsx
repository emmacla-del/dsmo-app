"use client";

// The hero animation's controller (2026-11-08). The six scenes are still
// drawn by CSS and rendered on the server; this component decides which one
// is on screen and when it moves on.
//
// Each step plays in two phases: a title card naming the step (« Étape 2
// sur 6 », its title and one line), then the scene itself. Both phases are
// timed by CSS animations, the title card's own and the fill of the current
// progress bar, and this component only listens for their animationend. So
// pausing (animation-play-state) pauses the clock as well as the picture,
// and no timer has to be kept in step with the CSS.
//
// The story plays once and stops on its last step with « Revoir ». The bars
// are buttons: a step can be chosen at any time, with the mouse or the arrow
// keys, and it plays from its title card. The animation waits until it is on
// screen and holds while the tab is hidden. Without motion
// (prefers-reduced-motion) there is no title card and nothing advances: each
// step shows its finished frame, and the bars choose between them.
//
// The controls sit outside the stage's role="img", whose children assistive
// technology does not reach; a polite live region names the step a viewer
// moves to, and nothing is announced while it plays by itself.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./project-journey-hero.module.css";

export type JourneyStep = {
  /** « Étape 2 sur 6 » */
  counter: string;
  /** « Étape 2 sur 6 : …au numérique », punctuated for the language. */
  name: string;
  title: string;
  body: string;
};

export type JourneyLabels = {
  kicker: string;
  /** The stage's description, for its role="img". */
  stage: string;
  /** The list of step buttons. */
  steps: string;
  pause: string;
  play: string;
  replay: string;
  previous: string;
  next: string;
};

type Phase = "title" | "play";

export function JourneyPlayer({
  children,
  steps,
  labels,
}: {
  children: ReactNode;
  steps: JourneyStep[];
  labels: JourneyLabels;
}) {
  const last = steps.length - 1;
  const [scene, setScene] = useState(0);
  const [phase, setPhase] = useState<Phase>("title");
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  // Held until the player is on screen, and while the tab is hidden.
  const [offscreen, setOffscreen] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const [still, setStill] = useState(false);
  // Bumped on every choice, so choosing the current step replays its card.
  const [run, setRun] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const reduce = Boolean(motion?.matches);
      setStill(reduce);
      if (reduce) setPhase("play");
    };
    apply();
    motion?.addEventListener?.("change", apply);
    return () => motion?.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setOffscreen(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(!entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(last, index));
      setScene(target);
      setPhase(still ? "play" : "title");
      setEnded(false);
      setPaused(false);
      setRun((n) => n + 1);
      const step = steps[target];
      setAnnouncement(`${step.name}. ${step.body}`);
    },
    [last, still, steps],
  );

  // A native listener, not onAnimationEnd: React resolves that one to a
  // vendor-prefixed event name where AnimationEvent is missing (jsdom), and
  // then never hears the event. Only the two clocks count; every other
  // animation in the scenes ends too, and is ignored.
  useEffect(() => {
    const node = root.current;
    if (!node || still) return;
    const listener = (event: Event) => {
      const clock = (event.target as HTMLElement).dataset?.clock;
      if (clock === "title") {
        setPhase("play");
      } else if (clock === "scene") {
        if (scene < last) {
          setScene(scene + 1);
          setPhase("title");
        } else {
          setEnded(true);
        }
      }
    };
    node.addEventListener("animationend", listener);
    return () => node.removeEventListener("animationend", listener);
  }, [last, scene, still]);

  const onStepKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = Math.max(0, Math.min(last, next));
    goTo(target);
    buttons.current[target]?.focus();
  };

  const current = steps[scene];

  return (
    <div
      ref={root}
      className={styles.player}
      data-scene={scene + 1}
      data-phase={phase}
      data-paused={paused || undefined}
      data-held={offscreen || tabHidden || undefined}
      data-ended={ended || undefined}
      data-still={still || undefined}
    >
      <div className={styles.panel}>
        <div className={styles.head}>
          <p className={styles.where}>
            <span className={styles.kicker}>{labels.kicker}</span>
            <span className={styles.now} aria-hidden="true">
              {current.counter} · {current.title}
            </span>
          </p>
          <ol className={styles.steps} aria-label={labels.steps}>
            {steps.map((step, i) => {
              const label = step.name;
              const state = i < scene ? "done" : i === scene ? "current" : "todo";
              return (
                <li key={i}>
                  <button
                    ref={(el) => {
                      buttons.current[i] = el;
                    }}
                    type="button"
                    className={styles.step}
                    data-state={state}
                    aria-label={label}
                    aria-current={i === scene ? "step" : undefined}
                    title={label}
                    tabIndex={i === scene ? 0 : -1}
                    onClick={() => goTo(i)}
                    onKeyDown={(e) => onStepKey(e, i)}
                  >
                    <span className={styles.track}>
                      <span
                        key={i === scene ? `fill-${run}` : "fill"}
                        className={styles.fill}
                        data-clock={i === scene ? "scene" : undefined}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={styles.stage} role="img" aria-label={labels.stage}>
          {children}
          {phase === "title" && !still && (
            <div
              key={`card-${scene}-${run}`}
              className={styles.titleCard}
              data-clock="title"
              aria-hidden="true"
            >
              <span className={styles.titleCounter}>{current.counter}</span>
              <strong className={styles.titleText}>{current.title}</strong>
              <span className={styles.titleBody}>{current.body}</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.control} ${styles.stepControl}`}
          onClick={() => goTo(scene - 1)}
          disabled={scene === 0}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M8 1.5 3 6l5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span className={styles.controlText}>{labels.previous}</span>
        </button>

        {!still &&
          (ended ? (
            <button type="button" className={styles.control} onClick={() => goTo(0)}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="M2.2 6a3.8 3.8 0 1 0 1.1-2.7M2.2 1.6v2.2h2.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
              {labels.replay}
            </button>
          ) : (
            <button type="button" className={styles.control} onClick={() => setPaused(!paused)}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                {paused ? (
                  <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
                ) : (
                  <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor" />
                )}
              </svg>
              {paused ? labels.play : labels.pause}
            </button>
          ))}

        <button
          type="button"
          className={`${styles.control} ${styles.stepControl}`}
          onClick={() => goTo(scene + 1)}
          disabled={scene === last}
        >
          <span className={styles.controlText}>{labels.next}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="m4 1.5 5 4.5-5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
