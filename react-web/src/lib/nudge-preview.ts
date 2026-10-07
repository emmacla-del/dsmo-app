// src/lib/nudge-preview.ts
//
// The quoted preview in the /admin/equipe reminder dialog. It repeats the
// body the server builds in src/report/actor-summary.service.ts
// (buildNudge), word for word and in French — the language the recipient
// receives — so the preview never shows a message that will not be sent.
//
// It used to print « plus de 7 jours », « la cible 2026 » and « depuis N
// jours » as fixed text. Each figure now comes from the summary response
// (staleAfterDays, lastDecisionAt) or the calendar year the server uses —
// there is no fallback figure.
import type { ActorSummaryActor, NudgeTemplate } from "./actor-summary";
import { doualaCalendarYear } from "./pilotage-targets";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from `sinceIso` to `now`, at least 1 — the server's daysSince
 * (src/report/actor-summary.service.ts); keep the two in step.
 */
export function daysSince(sinceIso: string, now: Date = new Date()): number {
  return Math.max(1, Math.floor((now.getTime() - new Date(sinceIso).getTime()) / DAY_MS));
}

export interface NudgePreviewContext {
  staleAfterDays: number;
  now?: Date;
}

/** The reminder body the server would send to `actor`, or null if it would refuse. */
export function nudgePreview(
  template: NudgeTemplate,
  actor: Pick<ActorSummaryActor, "role" | "coverage" | "processing" | "lastDecisionAt">,
  { staleAfterDays, now = new Date() }: NudgePreviewContext,
): string | null {
  if (template === "STALE_BACKLOG") {
    const stale = actor.processing.stale;
    if (stale === 0) return null;
    return `Vous avez ${stale} dossier${stale > 1 ? "s" : ""} en attente depuis plus de ${staleAfterDays} jours.`;
  }
  if (template === "BEHIND_TARGET") {
    const percent = actor.coverage.percent;
    if (percent == null) return null;
    const scope = actor.role === "DIVISIONAL_ADMIN" ? "Votre département" : "Votre région";
    return `${scope} est à ${Math.round(percent * 100)}% de la cible ${doualaCalendarYear(now)}.`;
  }
  // NO_RECENT_ACTIVITY
  return actor.lastDecisionAt
    ? `Aucune décision enregistrée sur votre compte depuis ${daysSince(actor.lastDecisionAt, now)} jours.`
    : "Aucune décision n’a encore été enregistrée sur votre compte.";
}
