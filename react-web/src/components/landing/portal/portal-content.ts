// What the front door is made of, as data rather than as repeated markup.
//
// Each entry carries a key and the few things that differ between siblings;
// the copy itself lives in messages/*.json under portalPage.<key>*, so a
// wording change never touches a component. Adding a phase is a line here
// plus its strings in both message files.

export type PortalPhaseState = "live" | "next" | "planned";

// ── The five views ────────────────────────────────────────────────────────
//
// The reference mockup switches the whole page from the nav rather than
// scrolling one long document, so each view is a real route under
// src/app/(portal): a shareable URL, a server-rendered title in the
// visitor's language, and `aria-current` read from the pathname instead of
// from a scroll observer.

export interface PortalRoute {
  /** Message key: portalPage.<key>. */
  key: "navHome" | "navDeclare" | "navRoadmap" | "navSupport" | "navAbout";
  href: "/" | "/declarer" | "/feuille-de-route" | "/assistance" | "/a-propos";
}

/** The masthead's four tabs, in order. */
export const PORTAL_NAV: PortalRoute[] = [
  { key: "navHome", href: "/" },
  { key: "navDeclare", href: "/declarer" },
  { key: "navRoadmap", href: "/feuille-de-route" },
  { key: "navSupport", href: "/assistance" },
];

/** Reached from the hero and the footer rather than from the nav: it explains
    the programme, which is not a task a visitor arrives to do. */
export const PORTAL_ABOUT: PortalRoute = { key: "navAbout", href: "/a-propos" };

// ── Home ──────────────────────────────────────────────────────────────────

/** What phase 1 actually does, one claim a line. Each is something the
    platform can be held to: authenticated registration and declaration,
    drafts, validation, and history inside the account. */
export const PORTAL_STATUS_CLAIMS = ["status1", "status2", "status3", "status4"] as const;

/** Register, sign in, complete, submit — the four steps in the order a
    declarant meets them, not the four phases of the programme. */
export const PORTAL_JOURNEY = ["journey1", "journey2", "journey3", "journey4"] as const;

// ── Declare ───────────────────────────────────────────────────────────────

// The two declaration doors carry the establishment kind, so step 1 of the
// registration does not ask again for what choosing a door already answered
// (src/app/register/page.tsx). `vocationalTraining` rather than `cfp`: it is
// the EntityType value the registration actually reads, and a second set of
// names would be a mapping table to keep in step.
//
// The third door is secondary and goes to /login, because drafts, history and
// receipts live inside the account — there is no public lookup, so it says so
// rather than asking for a reference it cannot resolve.
export interface PortalDoor {
  /** Message-key stem: portalPage.<key>Title / Desc / Requirement / Action,
      plus <key>Audience / Outcome in the pathway dialog. */
  key: "door1" | "door2" | "door3";
  href: string;
  variant: "primary" | "secondary";
}

export const PORTAL_DOORS: PortalDoor[] = [
  { key: "door1", href: "/register?type=enterprise", variant: "primary" },
  { key: "door2", href: "/register?type=vocationalTraining", variant: "primary" },
  { key: "door3", href: "/login", variant: "secondary" },
];

/** The three things people ask before declaring. Message-key stems:
    portalPage.<key>Question / Answer. */
export const PORTAL_FAQ = ["faq1", "faq2", "faq3"] as const;

// ── Roadmap ───────────────────────────────────────────────────────────────

export interface PortalPhase {
  /** Message-key stem: portalPage.<key>Title / Status / Desc. */
  key: "phase1" | "phase2" | "phase3" | "phase4";
  state: PortalPhaseState;
}

export const PORTAL_PHASES: PortalPhase[] = [
  { key: "phase1", state: "live" },
  { key: "phase2", state: "next" },
  { key: "phase3", state: "planned" },
  { key: "phase4", state: "planned" },
];

// ── About ─────────────────────────────────────────────────────────────────

// Where the collection has come from and where it is going. Three eras, flat:
// the reference mockup rotates these cards, which is decoration the owner
// asked to leave out.
export const PORTAL_STORY = ["story1", "story2", "story3"] as const;

/** The four steps of the transformation, each with the state it is in. */
export interface PortalTransformStep {
  /** Message-key stem: portalPage.<key>Title / Desc / Status. */
  key: "transform1" | "transform2" | "transform3" | "transform4";
  state: PortalPhaseState;
}

export const PORTAL_TRANSFORM: PortalTransformStep[] = [
  { key: "transform1", state: "live" },
  { key: "transform2", state: "live" },
  { key: "transform3", state: "next" },
  { key: "transform4", state: "planned" },
];

// What phase 1 actually delivered. Each claim here is one the platform can be
// held to — see the truth pass in docs/plans/landing-portal.md for what was
// taken out of the reference mockup and why.
export const PORTAL_ACHIEVEMENTS = ["achieved1", "achieved2", "achieved3"] as const;
