# Console navigation and sidebar — audit

**Date:** 2026-10-23
**Scope:** the staff console shell — `src/app/admin/layout.tsx`,
`src/components/admin/AdminSidebar.tsx`, `AdminPageHeader.tsx`,
`ViewSwitch.tsx`, `src/app/admin/_routes.ts`, `src/lib/nav-profiles.ts`.
**Status:** F1, F3, F4 and F6 were implemented on 2026-10-23, after the
audit, on the owner's instruction. F2 is held for the owner's ruling; F5 and
Option C are open. The "Findings" section below is kept as written, with an
outcome line on each item that is done — the reasoning is why the change
looks the way it does.

### Outcomes

| | Finding | Outcome |
|---|---|---|
| F1 | One destination, two names | **Done.** Rail, breadcrumb and tab all read Tableau de bord / Dashboard. Cleared one failing test (6 → 5). |
| F2 | Role lost the quality centre | **Held** for the owner. |
| F3 | Drawer does not contain focus | **Done.** Re-measured live: `inert` true, focus enters the drawer, **0** controls tabbable behind (was 38), Escape returns focus to the menu button. |
| F4 | Dead header machinery | **Done.** `PAGE_TITLES` and its derivation removed. |
| F5 | Four navigation bands | **Open** — owner's decision. One side effect of F1 was fixed, below. |
| F6 | Hand-inlined icons | **Done.** Nine glyphs now come from `lucide-react`. |
| F7 | Smaller notes | **Open** — brand wording, hub count comment, `rgba()` literals. |

**One thing F1 forced, not in the original list.** Giving the hub and its
only sub-route the same name made the breadcrumb read "Dashboard ›
Dashboard". `equipe` already read "Équipe territoriale › Équipe
territoriale" for the same reason, so the trail in `AdminPageHeader` now
drops a segment that only repeats the one before it (keeping whichever
carries the link back). That is a narrow de-duplication, not the F5
decision: the band is still there, it just no longer says one word twice.

Read against the working tree, not `HEAD`: the hub regrouping dated
2026-10-23 in `_routes.ts` is uncommitted, and three findings below are
loose ends of that regrouping rather than long-standing defects.

---

## 1. What is already right

Worth stating first, because the findings are small by comparison and the
temptation with a component library is to replace all of it.

- **`NAV_PROFILES` is additive.** Each role names the hubs it gets. The
  file's own header explains what it replaced — a subtractive
  `allowedRoles` filter whose result was an emergent property of ~15
  scattered arrays, and which showed hubs whose pages then 403'd. A role's
  whole sidebar is now readable in one place.
- **Hub visibility and route authorization are separated on purpose.** A
  profile chooses what appears; `getAllowedRoles(pathname)` and the server
  decide what opens. A profile can only ever be narrower than the backend.
- **The in-page rows claim no ARIA role they cannot honour.** There are no
  tab panels, so `AdminSubNav` and `ViewSwitch` are a labelled `<nav>` and a
  button row with `aria-current` / `aria-pressed`, not `role="tablist"`.
  This is the correct call and it is documented in both files.
- **The closed mobile drawer is `visibility: hidden`**, so the rail's links
  are genuinely out of the tab order on a phone — not merely translated
  off-screen, which is the usual bug here.

None of the findings below is a reason to replace this model.

---

## 2. Findings

### F1 — One destination, two names *(decided)*

`/admin/pilotage` is called **"Tableau de bord" / "Dashboard"** in the rail
(`adminNav.hubs.supervision`) and **"Vue d'ensemble" / "Overview"** in the
breadcrumb and the sub-route tab (`adminNav.routes.pilotage`, and the
`label` on the hub in `_routes.ts`). The user clicks one word and arrives
at a page titled another.

This also fails `admin-locale.test.ts`, which asserts the French message
equals the label the route carries.

**Owner's decision, in chat 2026-10-23: keep "Dashboard" / "Tableau de
bord".** So the route model is the side that moves — the `supervision` hub
label and `adminNav.routes.pilotage` align to the catalogue, not the
reverse. Clears one of the six failing tests.

### F2 — A role lost its route to the quality centre

`nav-profiles.test.ts` expects a shared hub to resolve to
`['/admin/dossiers', '/admin/centre-qualite']` and gets `['/admin/dossiers']`.
After the regrouping, some role's profile no longer reaches
`/admin/centre-qualite` through the navigation.

This is the mirror image of the risk `_routes.ts` already flags in its own
comment on that sub-route — that CENTRAL_AGENT *gained* exposure to it.
Both directions need the owner's eye, because this is a navigation symptom
of an access question. Whether the fix is the profile or the test's
expectation is a decision, not a correction: nobody should silently update
the assertion.

### F3 — Mobile drawer does not contain focus *(verified in the browser)*

With the drawer open at 375px, measured live:

| | |
|---|---|
| `inert` on `.cam-admin-body` | `false` |
| `aria-hidden` on `.cam-admin-body` | unset |
| focus after opening | still on the hamburger, never moved into the drawer |
| focusable controls behind the scrim | **38** |

So a keyboard or screen-reader user who opens the drawer and tabs walks
straight out of it into the page the scrim is covering, with no way to tell
they have left. Escape does close it, and focus is not returned to the
hamburger afterwards.

The backdrop is a `<div aria-hidden="true" onClick=…>` — fine for a mouse,
but it is not the dismiss affordance for anyone else.

This is precisely the class of defect `AdminDialog` was written to fix for
dialogs; the drawer never got the same treatment.

### F4 — Dead header machinery in the layout

`PAGE_TITLES` in `layout.tsx` is `{}` — every admin page now renders its
own `AdminPageHeader`, as the comment above it records. But roughly fifteen
lines below still compute `matchedPrefix`, `pageTitle`, `isSubRoute` and
`breadcrumb` from it, and a layout-level `<AdminPageHeader>` branch is
still mounted behind `pageTitle &&`. None of it can ever be reached.

### F5 — Four navigation bands before any data

On `/admin/dossiers` a reviewer passes, top to bottom: the rail, the
breadcrumb (`Survey submissions › Submission review`), the sub-route tabs
(`Submission review` | `Data quality centre`), and the `ViewSwitch` status
row (`All 9 · Pending 2 · …`). Four levels, three of them horizontal
strips, before the first filter.

The breadcrumb's last segment and the active sub-route tab are the same
word, one above the other. On a hub with two sub-routes the breadcrumb adds
a line and no information.

This is an information-architecture question, not a component one. No
library resolves it.

### F6 — Hand-inlined icons now have a maintained source

`AdminSidebar` carries seven inline hub SVGs (~65 lines), plus a logout
glyph, and `layout.tsx` carries a hamburger. `lucide-react` is now a
dependency, and every one of these exists in it: `LayoutDashboard`,
`Users`, `FileText`, `UsersRound`, `ShieldCheck`, `Database`, `Settings`,
`LogOut`, `Menu`. Cosmetically identical, ~80 fewer lines to maintain.

### F7 — Smaller notes

- The rail's brand block is a hardcoded `ONEFOP`. `docs/standards/brand.md`
  puts CAMLEAP on working screens and ONEFOP on official moments; the
  console rail is a working screen. Worth confirming, not assuming.
- `_routes.ts` says "Primary 6 Hubs Definition"; there are seven.
- The drawer's shadow and scrim are `rgba(0, 0, 0, …)` literals. The
  `rgba-literal` rule only blocks on the wizard globs, so the gate is
  silent here, but they are values outside the token set.

---

## 3. Options

### Option A — Fix the defects, keep the structure *(recommended)*

F1, F2, F3, F4, F6. No change to the information architecture, no new
dependency beyond `lucide-react`, which is already installed. F3 is the one
with user-visible stakes; F2 needs the owner's ruling before anything moves.

Small, reversible, and it leaves the regrouping done today intact.

### Option B — Remove one navigation band

Either drop the breadcrumb's final segment where it repeats the active tab,
or hide the sub-route row on hubs with a single sub-route (`supervision`
and `equipe` both have exactly one today, so each renders a one-item tab
row that can never be used to navigate anywhere).

Modest and reversible, but it is a design decision about the console's
information architecture and belongs to the owner, not to a conversion pass.

### Option C — Adopt shadcn's Sidebar

What it would genuinely bring: a collapsible rail with persisted state, a
real `Sheet` on mobile — which fixes F3 for free, with a focus trap and an
inert background — a keyboard shortcut, and `SidebarProvider` state instead
of the hand-rolled `menuOpen`.

What it costs: it replaces `AdminSidebar` *and* the layout shell, so it
touches every console screen in one change rather than one screen at a
time. The dark rail, the shared sizing with the wizard rail, and the
sign-out-at-the-foot decision would all have to be re-expressed in its
token and slot vocabulary. Twelve admin pages are currently uncommitted.

**Not now.** Worth revisiting once the tree is clean, and as its own
decision with its own review — not folded into a page conversion.

### Option D — shadcn for the in-page layers only

`Breadcrumb` is already installed and would replace the hand-rolled one;
`NavigationMenu` could back `AdminSubNav`. Lower risk than C, but it buys
markup consistency rather than behaviour, and `AdminSubNav` and
`ViewSwitch` already do the accessible thing. Low value; do it only if a
screen needs it anyway.

---

## 4. Suggested order

1. **F1** — align the route label to "Tableau de bord" / "Dashboard"
   (decided above). Clears a failing test.
2. **F2** — owner rules on whether the profile or the expectation is wrong.
3. **F3** — contain focus in the open drawer, make the background inert,
   return focus to the hamburger on close.
4. **F4**, **F6** — dead code and icons; pure subtraction.
5. **F5** / Option B — only once the owner has decided the band question.

Option C stays open and unscheduled.
