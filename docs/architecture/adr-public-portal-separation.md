# ADR 001: Architectural Separation of Public Portal, Authenticated Declarant Workspace, and Staff Administration Console

## Status
**Accepted** (2026-10-13)

---

## Context
CAM-LEAP is the national statistical and teledeclaration platform of the National Employment and Vocational Training Observatory (**ONEFOP**), under the oversight of the Ministry of Employment and Vocational Training (**MINEFOP**) of the Republic of Cameroon.

The platform must serve four distinct audiences with divergent operational requirements:
1. **Funders, stakeholders, journalists, and ministry officials**: Need to inspect the institutional mandate, legal basis, methodology, progress indicators, and roadmap without authentication.
2. **Registered declaring entities (enterprises and vocational training centres)**: Need to prepare declarations, resume saved drafts, resolve validation issues, submit filings, and retrieve legally binding PDF receipts.
3. **Unregistered declaring entities**: Need transparent onboarding information, clear awareness of required prerequisites (e.g., NIU, CNPS, MINEFOP accreditation), notice of ONEFOP approval wait times, and assisted registration alternatives for informal or non-NIU structures.
4. **ONEFOP administrative staff**: Need internal back-office consoles to review incoming registration applications, arbitrate submissions, issue visas, and administer campaigns.

### Historical Drift
In earlier iterations of the web application, routing was conflated:
- The root route (`/`) originally rendered a sign-in card.
- Later, `/login` wrapped authentication in `LandingShell`, effectively presenting a second, duplicate "landing page" with redundant declaration guides.
- Inactive or pending accounts were redirected to `/` rather than `/login`.
- Authentication links were absent or hardcoded, preventing declarants from navigating between public guidance and authenticated workspaces without manual URL manipulation or session loss.

---

## Decision

We establish a strict, tripartite architectural separation across routes, layouts, headers, and session boundaries.

### 1. Three Isolated Route Groups

The application is structured into three mutually exclusive route groups:

```
src/app/
├── (portal)/                 # 1. Public Informational Website
│   ├── page.tsx              #    / (Landing, hero, journey, roadmap overview)
│   ├── declarer/             #    /declarer (Action hub, pre-flight checklist)
│   ├── feuille-de-route/     #    /feuille-de-route (4-phase roadmap)
│   ├── assistance/           #    /assistance (Official support & assisted registration)
│   └── a-propos/             #    /a-propos (Mandate, ONEFOP/MINEFOP history)
│
├── home/                     # 2. Authenticated Declarant Workspace
│   ├── layout.tsx            #    Declarant shell (Rail navigation, user identity)
│   ├── page.tsx              #    /home (Declarant dashboard / cockpit)
│   ├── declarations/         #    /home/declarations (Drafts & submission history)
│   └── inscription-en-attente/ # /home/inscription-en-attente (Pending approval holding screen)
│
└── admin/                    # 3. ONEFOP Staff Console
    ├── layout.tsx            #    Admin shell (Role-based staff navigation)
    ├── pilotage/             #    /admin/pilotage (Supervision & KPIs)
    ├── dossiers/             #    /admin/dossiers (Review & validation queue)
    ├── inscriptions/         #    /admin/inscriptions (Entity approvals & assisted onboarding)
    └── ...                   #    Staff parameters & directories
```

### 2. Header State Adaptation (`PortalMasthead`)

The public masthead ([`src/components/landing/portal/PortalMasthead.tsx`](file:///c:/Users/win/dsmo_app/react-web/src/components/landing/portal/PortalMasthead.tsx)) adapts dynamically based on client authentication state (`useAuthStore`):
- **Anonymous / Visitor**: Renders a primary CTA button linking to `/login` (`"Se connecter"` / `"Sign in"`).
- **Authenticated Declarant (`COMPANY`)**: Renders a secondary CTA button linking to `/home` (`"Mon Espace Déclarant →"` / `"My Declarant Space →"`).
- **Authenticated Staff (`ADMIN`, `SUPER_ADMIN`, `REGIONAL_DELEGATE`, etc.)**: Renders a secondary CTA button linking to `/admin/pilotage` (`"Pilotage ONEFOP →"` / `"ONEFOP Monitoring →"`).

In parallel, the declarant workspace header and navigation rail ([`src/app/home/layout.tsx`](file:///c:/Users/win/dsmo_app/react-web/src/app/home/layout.tsx)) enclose the institutional CAMLEAP logo in a direct link back to `/` (`title="Retour au portail public"`), enabling declarants to consult public guidance without logging out.

### 3. Deep-Link and Return-To Contract (`/login`)

- Authentication lives exclusively at `/login` as a focused single-card administrative interface using [`AuthHeader`](file:///c:/Users/win/dsmo_app/react-web/src/components/auth/AuthHeader.tsx) and `.cam-auth-page`.
- `LandingShell` is retired from `/login`.
- `/login` inspects `?returnTo=` and `?redirect=` search parameters. Upon successful authentication, the router redirects to the sanitized target route rather than forcing navigation to `/home`.
- Deep links to specific submissions, receipts, or drafts are preserved across login sessions.
- Inactive or rejected sessions terminating via `api-client.ts` navigate to `/login` (via `LOGIN_PATH = "/login"`), never to `/`.

### 4. The `/declarer` Action Hub

The `/declarer` route functions as a transparent entry portal for both new and returning entities:
- **Pre-flight Checklist**: Surfaces the required documents before registration begins:
  - NIU (or pending allocation status)
  - CNPS number (if applicable)
  - Designated declarant full name and function
  - Physical address and subdivision
  - Principal activity sector
- **Mandatory Approval Warning**: Clearly warns that registration triggers administrative review by ONEFOP before teledeclaration access is unlocked, with approval confirmation communicated via email.
- **Unregistered / Non-NIU / Informal Entity Support**: Expressly directs entities without NIU or from the informal sector to contact their Departmental MINEFOP Delegation for assisted registration.
- **Authenticated State**: For logged-in users, surfaces an active session banner (`"Connecté en tant que [email]"`) with direct shortcuts to `/home` and `/home/declarations`.

### 5. Rules for Adding New Routes

When authoring new routes in the application, developers must apply these rules:
1. **Public Informational Pages**: Must reside in `src/app/(portal)/[slug]`, share `PortalLayout`, use `portalMetadata()` for bilingual head titles, and adhere strictly to `tokens.css` and `portal.module.css`.
2. **Declarant Tools & Workflows**: Must reside in `src/app/home/[slug]`, inherit `HomeLayout`, implement `useRequireAuth()`, and register navigation items in `src/lib/role-navigation.ts`.
3. **Staff Review & Administration**: Must reside in `src/app/admin/[slug]`, inherit `AdminLayout`, and enforce role checks with `hasRole(user?.role, ADMIN_ROLES)`.
4. **No Ad-Hoc Landing Wrappers**: Standard authentication forms must never re-implement or wrap themselves in landing hero marketing containers.

---

## Consequences

- **Clear Separation of Concerns**: Public visitors, declarants, and staff operate in distinct, dedicated interfaces tailored to their workflows.
- **Friction Reduction for Unregistered Entities**: First-time declarants are fully informed of requirements, review procedures, and assisted alternatives prior to initiating registration.
- **Consistent Visual Language**: Eliminates conflicting 2-column landing variations at login while upholding the national administrative aesthetic of the CAMLEAP design system.
- **Regression Prevention**: Preserves 100% test suite compatibility across unit, navigation, and accessibility tests.

---

## Known Limitation: Client-Side Route Gating

- **Current Implementation**: Protected declarant routes (`/home/*`, `/onefop/preview`) gate access via the client-side `useRequireAuth()` hook (`src/lib/use-require-auth.ts`). When an unauthenticated visitor requests a protected route directly, the Next.js server serves the shell HTML, and redirection to `/login?returnTo=...` executes on the client after React hydration.
- **Why Acceptable for Pilot**: No sensitive business data or confidential establishment records are exposed during the pre-auth render phase. The client layouts and pages immediately render a neutral loading splash until `authState === "authed"` is validated against client tokens. If `authState === "anon"`, redirection fires before any private data is queried or displayed.
- **Upgrade Path (Post-Pilot)**: Introduce Next.js Edge Middleware (`src/middleware.ts`) paired with HTTP-only session cookies. This will intercept incoming HTTP requests at the edge, verify authentication tokens before rendering, and issue an immediate 307/308 HTTP redirect to `/login?returnTo=...` prior to sending any HTML markup to the client.

