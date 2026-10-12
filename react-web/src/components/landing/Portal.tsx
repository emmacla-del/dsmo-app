"use client";

// The front door, served at "/".
//
// It answers two questions at once, which is why the bands are in this order.
// A declarant needs one thing: the route to their declaration. Everyone else —
// the ministry, partners, the public — needs to know what CAMLEAP is, what is
// in service and what is still to come. So the doors come first and the
// roadmap sits below them: the task owns the top of the page, the programme
// is there for whoever scrolls.
//
// The sign-in form is not here. It lives at /login, where every link in the
// app already pointed (src/app/login/page.tsx).
//
// This file is composition and nothing else: each band is its own component
// under ./portal, and what the bands are made of — the doors, the phases —
// is data in portal-content.ts. "use client" sits here alone; the sections
// are only ever rendered from inside it, so they inherit the boundary.

import { PortalMasthead } from "./portal/PortalMasthead";
import { PortalHero } from "./portal/PortalHero";
import { PortalDoors } from "./portal/PortalDoors";
import { PortalNotices } from "./portal/PortalNotices";
import { PortalTransformation } from "./portal/PortalTransformation";
import { PortalRoadmap } from "./portal/PortalRoadmap";
import { PortalProgress } from "./portal/PortalProgress";
import { PortalSupport } from "./portal/PortalSupport";
import { PortalFooter } from "./portal/PortalFooter";
import styles from "./portal.module.css";

export function Portal() {
  return (
    <div className={styles.page}>
      <PortalMasthead />
      <main>
        <PortalHero />
        <PortalDoors />
        <PortalNotices />
        <PortalTransformation />
        <PortalRoadmap />
        <PortalProgress />
        <PortalSupport />
      </main>
      <PortalFooter />
    </div>
  );
}
