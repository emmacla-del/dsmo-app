# The landing page — a declaration portal at "/"

**Date:** 2026-10-12, reworked 2026-10-13
**Status:** five routes, their layouts and their tests are committed.
The shape itself is under review against §Who the front door is for, which
was written after them; the gaps are listed under §Open.
**Source:** `docs/mockups/landing-camleap-canonical.html` (the owner's
reference for the palette), and the owner's second reference mockup of
2026-10-13 for the layout. Neither is ported as HTML.

## CAMLEAP is two things

This is the sentence the rest of the document rests on, and not having
written it down is why the front door was restructured three times.

**The platform** is the service that is running now: registration,
teledeclaration, drafts, validation, acknowledgements, the staff console. It
has users, a deadline, and a support number. It changes when the service
changes.

**The programme** is the phased modernisation of ONEFOP's information system,
of which the platform is phase 1's deliverable. It has phases, states,
oversight and a direction. It changes when a phase does.

`docs/standards/brand.md` defines the first ("ONEFOP owns the platform.
CAMLEAP is the platform") and is silent on the second. Both are true at once,
and the site has to be both: a portal for the people who use the service, and
the public face of the programme for the people deciding whether it is real.
Trying to make it only one of the two is what produced nine bands, then five
routes, then a rethink.

### What follows

- **The two speak differently.** The platform speaks in the present tense and
  the second person: *you need a NIU*, *a draft can be resumed*, *collection
  closes on 31 March*. The programme speaks in phases and states: *phase 2 is
  the next step*, *benchmarking is planned*. A sentence that mixes them —
  "phase 3 will let you compare your salaries" — is a promise the platform
  has not made and cannot keep.
- **Audiences 1–3 come for the platform. Audience 4 comes for the
  programme.** Audience 5 is waiting for the programme to deliver something
  the platform can then serve.
- **Two destinations, therefore, and only two.** Not five, because the
  programme is one page's worth of content; not one, because a visitor
  deciding whether to fund or extend the programme is not served by a page
  whose answer to everything is "sign in".
- **Neither borrows the other's job.** The portal does not argue the
  programme's case — it carries at most one line and a link. The programme
  page does not offer the platform's actions; it links back to the portal
  once, for the reader who turns out to be a declarant after all.
- **"Phase 1 is in service" belongs to both**, and is the one sentence that
  legitimately appears on each: on the portal because it tells a declarant
  the thing is open, on the programme page because it tells a minister where
  the work has got to. It is the same fact in two registers, which is why the
  wording differs between them and should not be unified.

### A naming note

The platform's name is CAMLEAP (`docs/standards/brand.md`). People will also
say "the CAMLEAP programme", and that is not wrong, but a page should be
precise about which object it is describing: the roadmap's four phases are
the **programme's**, not features the **platform** is promising. If
`brand.md` is ever extended to cover the programme as well as the platform,
this is the distinction it should carry.

## Who the front door is for

Five audiences arrive at "/", for different reasons and at wildly different
frequencies. **The shape of the page is settled by them, not by a mockup.**

Written on 2026-10-13, after the page had been restructured three times in
one working session. The root cause is §CAMLEAP is two things above; this
section is the same point from the readers’ side. A later layout question is
argued against the two of them; it does not reopen them.

### 1. The declarant who has no account

An employer in the modern sector, or a vocational training centre, arriving
from a MINEFOP circular, an email campaign or word of mouth. Typically once a
year, often near a deadline, frequently not by choice.

**In sixty seconds they must be able to:** tell whether they are concerned at
all; see which of the two kinds of establishment they are; learn which
identifier they need (NIU for an employer, MINEFOP accreditation reference
for a centre); and start registering with that kind already carried into
step 1 of the form (`/register?type=…`, commit `a2ee0db7`).

**They must not be made to:** read the programme first, guess whether an
account is needed, or work out for themselves which questionnaire applies.

### 2. The declarant who already has an account

The same people, later: resuming a draft, checking a dossier's status,
downloading an acknowledgement.

**In sixty seconds:** sign in, from whatever page they happen to land on.

**They must not be made to** look for a public tracking box. There is no
public lookup — `/home/declarations` is the only place a declaration can be
seen — and the page must not imply otherwise by offering a reference field or
a "track my file" affordance.

### 3. Administration staff

Divisional, regional and central agents, ONEFOP administrators, auditors.
They work in the console at `/admin` and get there by signing in.

**In sixty seconds:** sign in, without wading through copy addressed to
declarants.

The front door owes them nothing else. Their work begins after
authentication, and the console is a different surface with its own rules
(`docs/standards/ui-grammar.md`).

### 4. The institution and its partners

MINEFOP and ONEFOP leadership, partner agencies, funders, journalists. Rare
and decisive: this is the page that gets opened in a meeting, on a projector,
by someone deciding whether the programme is real.

**In sixty seconds they must be able to:** say what CAMLEAP is and whose it
is; separate what is in service today from what is promised; see the four
phases with the state each is actually in; and find who oversees the
programme.

**They must not be given** a claim the platform cannot keep. The list of
claims already struck for this reason is §Claims removed in the truth pass,
and it is not a historical note — it is the standard this audience is owed.

**Frequency is not weight.** This audience arrives least and matters most per
visit, so "the programme is in the footer" is the wrong answer even though
the declarant is the commoner visitor.

### 5. The public and researchers — not served yet

No indicators, no dashboards, no open data: the analytical layer is phase 2
and does not exist. The page says so plainly rather than implying a
statistical offering behind a login.

When that layer lands, this is the audience that earns a new public section,
and that is the moment the site legitimately grows past the shape below.
Building a multi-tab information architecture now, for content that is one
page's worth, pays that cost years early.

## What follows from that

Each of these is a consequence of the section above, not a taste:

1. **The task owns the top of "/".** Identification and the way in come
   before institutional prose, because audiences 1–3 are the ones under time
   pressure.
2. **"Who are you" is the first question the page asks**, because the answer
   is what routes a declarant — and because it is the same question `/home`
   answers for someone who already has an account. The public page is the
   authenticated home, one step earlier.
3. **One institutional destination, not three.** Audience 4's needs fit on a
   page; three tabs for one page's content leaves the masthead reading as a
   content menu, which is what a brochure site has and a portal does not.
4. **That destination is reachable from the masthead**, not only the footer.
   See "frequency is not weight".
5. **Support is one click from every page**, at least through the first year
   of service: NIU and two-factor problems are the commonest way audiences 1
   and 2 fail, and the authenticated screens already carry the WhatsApp
   number in eight places.
6. **Sign-in is reachable from everywhere**, for audiences 2 and 3.
7. **No surface implies a capability that does not exist** — no public
   lookup, no published statistics, no QR code, no benchmarking.
8. **A permalink that has been published is not deleted**, only redirected: a
   circular may already carry it.

## What the portal offers

The complete set. An action not in this table does not go on the front door
without a reason written here first — the page has grown a fourth and fifth
"pathway" twice, and both times they were the same destination relabelled.

| Action | For | Goes to | Weight |
|---|---|---|---|
| Je suis une entreprise du secteur moderne | 1 | `/register?type=enterprise` | primary |
| Je suis un centre de formation professionnelle | 1 | `/register?type=vocationalTraining` | primary |
| Se connecter | 2, 3 | `/login` | secondary, in the masthead on every page |
| Le programme | 4 | `/programme` | masthead |
| Assistance | 1, 2 | `/assistance`, and the WhatsApp number it carries | masthead |

**The two registration actions carry `?type=`.** That is not decoration: the
registration reads it and skips the establishment-kind question in step 1
(commit `a2ee0db7`). A bare `/register` makes the respondent answer twice a
question the front door already asked.

**Everything an account holds is one action, not four.** "Reprendre un
brouillon", "Voir mes déclarations", "Télécharger un accusé" and "Suivre mon
dossier" are all `/login` — the drafts, the history and the acknowledgements
live at `/home/declarations`, behind authentication, and no public endpoint
resolves any of them. Offering them as separate actions presents one door as
four, which is the single defect this page has reintroduced most often. They
belong in a sentence under *Se connecter*, which is what the account gives
you — never as buttons.

**There is no "submit a declaration" action on the front door**, because an
anonymous visitor cannot perform one. The nearest true thing is "register" or
"sign in", and after signing in the declaration starts from `/home`, which
offers it as that surface's one task. A tab named for a task the page cannot
perform is how audience 1 ends up at a sign-in form wondering what happened.

## What the programme page carries

What audience 4 is owed, and the order it is owed in:

1. **What CAMLEAP is and whose it is** — the platform of ONEFOP, under
   MINEFOP oversight, and the LMIS/observatory distinction (CLAUDE.md §4):
   collection first, analysis after.
2. **What is in service today, against what is promised** — the sharpest
   thing on the page for someone deciding whether the programme is real.
3. **The four phases, each with the state it is actually in**, filterable.
4. **Who oversees the programme.**
5. **The caveat on benchmarking**, because it is the most attractive thing
   here and the furthest from being built.

It does not carry anything in §Claims removed in the truth pass.

**One thing to resolve when the two pages merge.** Between them they tell the
same story four times: the three eras (paper → digital → analysis), the
four-step transformation, the four phases, and the two progress cards
(available / building). That is four framings of "we moved from paper to
digital and intend to reach analytics". Audience 4 in a meeting needs it
once, told well. The phases are the version that carries real states and
cannot be dropped; the other three should become at most one supporting
narrative, and the merge is the moment to decide which.

## What this section does not settle

- **Which audience dominates during the pilot.** There is no traffic data.
  The ordering above is argued from purpose, not measurement; if the pilot
  turns out to be mostly institutional visits, principle 1 is the first thing
  to re-examine.
- **Whether the ministry wants the programme more prominent than one
  masthead entry.** That is the owner's call, and the only part of the shape
  that a reading of the code cannot decide.

## Goal

Turn "/" from a bare sign-in card into the front door of the collection
layer: the routes a declarant can take, and the account of what CAMLEAP is,
what is in service and what is still to come.

## Why

Superseded by §Who the front door is for, which states the same argument
from the audiences rather than from two of them. Kept as a record of how
the question was framed before that section existed: "the task owns the top
of the page, the programme sits below it, and the sign-in form moves off
the landing page entirely" — true as far as it went, and it did not survive
contact with a masthead that has to carry the programme as well.

## What is committed

| Commit | What it did |
|---|---|
| `c68e9ed2` | The sign-in form moved from "/" to /login, which until then only redirected back. No behaviour change. |
| `4a5152fd` | "/" became the portal: three doors, two notices, four phases, support, footer. Copy under `portalPage.*` in `messages/*.json`. |
| `a2ee0db7` | /register reads `?type=`, so a door carries the establishment kind and step 1 does not ask again. A saved draft wins over the link. |
| `94d71bd0` | `GET /api/public/campaigns/open` — the one campaign fact an anonymous visitor may read, on its own unguarded controller. The portal shows the earliest closing date, silently omitting it on failure. |
| `0e67d905` | The front-door palette: `--cam-portal-*` in tokens.css, re-pointed on the portal's own root. |
| `127b3be6`, `fa4a1faf`, `c762370d` | The bands became components, their content became data, and the roadmap filters and pathway dialogs arrived. |
| `b68447e1` | **The front door became five routes.** Home took the reference mockup's own sequence. |
| `da3ef6b2` | **The four remaining views took the mockup's layout.** |
| `7cf7312f` | Nine tests over what the route split introduced. |

## Decisions (resolved)

- **Five routes, not one page.** The reference mockup switches the whole
  page from the nav. That is a route group — `/`, `/declarer`,
  `/a-propos`, `/feuille-de-route`, `/assistance` — so each view has a URL
  to share, a title in the visitor's language, and `aria-current` read
  from the pathname. The mockup fakes this by toggling a `hidden`
  attribute on five sections of one document; nothing is hidden in the DOM
  here. Decided by the owner on 2026-10-13.
- **Sign-in lives at /login.** The portal is the front door. Anonymous
  visitors who hit a protected page go to /login, not to "/"; signing out
  still returns to "/".
- **The doors carry the establishment kind** via `?type=`, using the
  `EntityType` vocabulary the registration already speaks
  (`enterprise`, `vocationalTraining`) rather than a second set of names.
- **The deadline comes from a public endpoint**, not from copy that would
  go stale. It exposes the module, the reference year and the effective
  closing date, and nothing else.
- **Tracking lives inside the account.** No public lookup: the third route
  says so rather than asking for a reference no endpoint can resolve.
- **The palette is scoped to this page.** `--cam-portal-*` tokens in
  `tokens.css`; `portal.module.css` re-points the shared tokens on the
  portal's own root, so a `.cam-button` paints teal inside the portal and
  is untouched everywhere else. No `:root` token is redefined.
- **Colours only.** The mockups' decoration is not adopted: no tricolour
  stripe, no card rotation, no drop shadows, no hover lifts, no large
  radii, no pulsing dot. The hero's paper → record idea survives as two
  flat panels and an arrow.
- **Neutrals stay as they are.** The mockups' greys come from Tailwind's
  slate ramp, which rule G1 forbids as a second design system.
- **Fonts stay.** Inter. No DM Sans, Fraunces or Space Mono, and no
  Tailwind CDN.
- **`--cam-focus` is not repainted.** The palette's yellow is 1.6:1
  against cream — too weak for a focus ring. It keeps the current gold.
- **The hero keeps the mockup's headline.** The page opens on what CAMLEAP
  is; the task is one route away, and the status line carries the deadline.
- **"Obligatoire" stays off the employer route.** The repo cites Loi
  N° 2020/010 and Loi N° 91/023, but both are about statistical secrecy
  and confidentiality, not about an obligation to declare, so nothing
  available here establishes the claim. Given a citation, the tag returns
  as "Déclaration obligatoire (arrêté n° …)", which is more use to an
  employer than the bare word ever was.
- **Stacked rows, not three cards** (2026-10-13). The reference mockup
  stacks its actions. The three routes are not a menu to compare: they are
  three answers to "which one am I", and the one that applies is read.
- **Phase cards, not accordions** (2026-10-13). Four phases at three lines
  each gained nothing from a disclosure and cost a click. The three state
  cards went with them: they were a legend for filter buttons carrying the
  same three words.
- **The micro-labels are sentence case** (owner, 2026-10-13). They were
  uppercase, the mockups' idiom, which sat against the decision of
  2026-10-10 to take shouty caps out of the app; that decision wins here
  too. Fifteen strings a language, separators unchanged, and the kicker
  letter-spacing went with the capitals it was there to open up.
- **State on ink is light / yellow / muted** (2026-10-13), not teal. The
  portal's teal is close to invisible on `--cam-portal-ink`; the progress
  band on that same ground had already established the other vocabulary.

## What the reference mockup gets wrong

Recorded so a later pass over it does not reintroduce them:

- its pressed filter chip is filled with the band's own ink colour, which
  makes the pressed state invisible on the dark band;
- every heading carries an inline `font-size: 16px` from the editor that
  produced it, so the file does not render at its own type scale;
- it writes **CAM-LEAP**; the name is CAMLEAP, one word
  (`docs/standards/brand.md`);
- it substitutes a lettered square for the logo, where the front door
  takes the ONEFOP emblem + CAMLEAP lockup, the emblem never below 56px;
- it defaults to English; the platform's default locale is French;
- it carries both languages in the DOM and toggles them with CSS, which
  bypasses `messages/*.json` entirely;
- it opens internal links with `target="_blank"`;
- it prints a city under the support contact — see the truth pass below.

## Claims removed in the truth pass

The reference mockups assert things the platform does not do. These are
out, and must stay out unless they become true:

- a tamper-proof **QR code** on the attestation — there is no QR library in
  `package.json` and `src/dsmo/pdf.service.ts` renders none; the `qrCode`
  column holds the tracking number. The wording is "accusé de réception
  officiel au format PDF, portant un numéro de suivi unique";
- the attestation being **valable pour les audits et marchés publics**;
- **free priority access** to the phase 3 benchmarking for early declarants;
- **"28 pages"**, **"12 min"**, **Horizon 2027** and **Planned (2027)**;
- **phase 2 "in development"** — it reads "prochaine étape", consistent
  with the roadmap, pending confirmation that the analytics work has
  restarted;
- invented contacts (`support@onefop.cm`, a landline, a city). The only
  published channel is the WhatsApp number in `messages/fr.json`.

Phase 1 is described as in service for **both** dispositifs. Confirm the
vocational-training side is genuinely open to the public before that ships.

## File layout

The mockups are the specification, not the source: none of their HTML is
ported.

```
src/app/(portal)/
  layout.tsx                       masthead, skip link, <main>, footer
  page.tsx                         Home
  declarer/page.tsx                Declare
  a-propos/page.tsx                About
  feuille-de-route/page.tsx        Roadmap
  assistance/page.tsx              Support
src/components/landing/
  portal.module.css                one stylesheet
  portal/
    PortalMasthead.tsx             lockup, route tabs, sign-in, locale switch
    PortalHero.tsx                 headline, lede, actions, status, figure
    PortalStatusBand.tsx           what phase 1 does, as four claims
    PortalJourney.tsx              register → sign in → complete → submit
    PortalDeclare.tsx              the flow frame: header, routes, dock
    PortalNotices.tsx              where a declaration counts as filed
    PortalFaq.tsx                  the three questions
    PortalAbout.tsx                the programme, and the three eras
    PortalTransformation.tsx       the four-step band + its caveat
    PortalProgress.tsx             what is done and what is not (ink)
    PortalRoadmap.tsx              the four phases, filtered (ink)
    PortalSupport.tsx              the one published channel
    PortalFooter.tsx
    PortalDialog.tsx               native <dialog> for the pathway details
    PortalStatus.tsx               a state, said the same way everywhere
    portal-content.ts              routes, steps, phases as typed arrays
    portal-metadata.ts             per-route title and description
```

Content is data, not markup: `portal-content.ts` holds key-stems and
states, each section maps over them and resolves copy through `t()`. Copy
is 170 keys in both `messages/fr.json` and `messages/en.json`; key parity
is enforced by `src/lib/admin-locale.test.ts`.

Only `PortalMasthead`, `PortalDeclare`, `PortalRoadmap` and `PortalDialog`
hold state, and only those are client components. The rest render on the
server.

`PortalDialog` duplicates about thirty lines of `AdminDialog` rather than
lifting it into a shared component, because lifting means touching the
staff console, which this work does not. Deliberate, and recorded here so
it is not read as an oversight.

## Tests

`src/components/landing/portal-views.test.tsx`, 16 tests: the three routes
and their hrefs, the authority statement, the four phases and their
states, the roadmap filter and its live region, a pathway dialog opening
and closing, the deadline (present and absent), the masthead's
`aria-current` and its drawer, the footer's routes, the status claims, the
journey's order, the declaration dock, the questions, About's
collection-before-analysis line, and a filtered phase keeping its own
number.

Two of them — the phase numbering and `aria-current` — were checked
against a deliberate mutation of the code they cover.

One test is scoped rather than page-wide for a reason worth keeping: the
roadmap names the current phase in its own notice, and the copy makes that
string identical to phase 1's title, so a page-wide query matches both.

## Open

### The shape, measured against §Who the front door is for

That section was written after the five routes were built, and the built
shape does not satisfy all of it. Each gap below names the principle it
misses; none of them is a bug, and none should be fixed piecemeal.

- **"Who are you" is not asked on "/"** (principle 2). It is asked on
  `/declarer`, one click later, behind a masthead tab named for a task that
  page cannot perform. Three of that page’s four actions lead to `/login`.
- **Two institutional destinations, not one** (principle 3): `/a-propos`
  and `/feuille-de-route` hold between them about one page of content, and
  take two of the four masthead slots.
- **Support holds a masthead slot** (principle 5) — that one is satisfied,
  and should stay satisfied through the first year of service.
- **If `/declarer` goes, it redirects** (principle 8). A circular or an
  email may already carry it.
- **`PORTAL_ACTIONS` sends registration to a bare `/register`**, dropping
  the `?type=` the two kinds carry (principle 1, and commit `a2ee0db7`).
  This is in the working tree, not yet committed.

The proposal on the table is: `/` carries the chooser, `/programme` merges
the two institutional pages, `/assistance` keeps its slot, `/declarer`
redirects to the chooser. Masthead: **LE PROGRAMME · ASSISTANCE ·
[Se connecter]**. Not yet decided.

### Other

- **Which colours the platform eventually keeps** is still a separate
  decision. Nothing outside `portal.module.css` reads `--cam-portal-*`.
- **`landing.module.css` and `LandingShell`** still serve /login and were
  not touched by this work.

## Constraints

- Nothing outside the portal changes. `globals.css`, the staff console,
  the wizards and the respondent forms are not touched.
- No hex literal in TSX, and no Tailwind palette class (rule G1,
  `docs/standards/ui-grammar.md`). `npm run check:ui-grammar` covers the
  staff console and the registration wizard, so this page's discipline
  rests on review — and on `portal.module.css` being the only file here
  that may name a colour, through a token.
- `react-web` only. The Flutter client is out of scope; the backend is
  touched only by the already-committed public campaign route.
