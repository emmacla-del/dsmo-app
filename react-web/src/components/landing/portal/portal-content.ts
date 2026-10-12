// What the front door is made of, as data rather than as repeated markup.
//
// Each entry carries a key and the few things that differ between siblings;
// the copy itself lives in messages/*.json under portalPage.<key>*, so a
// wording change never touches a component. Adding a phase is a line here
// plus its four strings in both message files.

export type PortalPhaseState = "live" | "next" | "planned";

export interface PortalDoor {
  /** Message-key stem: portalPage.<key>Eyebrow / Title / Desc / Requirement / Action. */
  key: "door1" | "door2" | "door3";
  href: string;
  variant: "primary" | "secondary";
}

export interface PortalPhase {
  /** Message-key stem: portalPage.<key>Title / Status / Desc. */
  key: "phase1" | "phase2" | "phase3" | "phase4";
  state: PortalPhaseState;
}

// The two declaration doors carry the establishment kind, so step 1 of the
// registration does not ask again for what choosing a door already answered
// (src/app/register/page.tsx). `vocationalTraining` rather than `cfp`: it is
// the EntityType value the registration actually reads, and a second set of
// names would be a mapping table to keep in step.
//
// The third door is secondary and goes to /login, because tracking and
// receipts live inside the account — there is no public lookup, so it says
// so rather than asking for a reference it cannot resolve.
export const PORTAL_DOORS: PortalDoor[] = [
  { key: "door1", href: "/register?type=enterprise", variant: "primary" },
  { key: "door2", href: "/register?type=vocationalTraining", variant: "primary" },
  { key: "door3", href: "/login", variant: "secondary" },
];

export const PORTAL_PHASES: PortalPhase[] = [
  { key: "phase1", state: "live" },
  { key: "phase2", state: "next" },
  { key: "phase3", state: "planned" },
  { key: "phase4", state: "planned" },
];

// The nav tabs, and the band each one points at. The ids live on the sections
// themselves, so adding a band to the nav means adding it here and giving that
// section the matching id — there is no third place to keep in step.
export interface PortalNavItem {
  /** Message key: portalPage.<key>. */
  key: "navDoors" | "navTransform" | "navRoadmap" | "navSupport";
  /** The id of the section it scrolls to. */
  target: string;
}

export const PORTAL_NAV: PortalNavItem[] = [
  { key: "navDoors", target: "parcours" },
  { key: "navTransform", target: "pourquoi" },
  { key: "navRoadmap", target: "feuille" },
  { key: "navSupport", target: "assistance" },
];

// Where the collection has come from and where it is going: the hero's second
// column. Three eras, flat — the reference mockup rotates these cards, which
// is decoration the owner asked to leave out.
export const PORTAL_STORY = ["story1", "story2", "story3"] as const;

// The four steps of the transformation, each with the state it is in.
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
