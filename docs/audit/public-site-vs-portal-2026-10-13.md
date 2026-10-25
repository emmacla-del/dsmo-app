# Audit — public website vs. authenticated portal

**Date:** 2026-10-13
**Scope:** `react-web/` (Next.js 16 app) and, where authorization is in
question, the NestJS backend at the repository root (`src/`).
**Method:** read-only inspection of the working tree as it stands today,
plus one run of `npm test` in `react-web/` (664 tests, all passing). No code
changed.
**Working tree:** not clean. Several portal files carry uncommitted edits
that change the answers below; every such case is marked **(uncommitted)**
and compared against `HEAD`.

---

## Critical gaps — read this first

### C1. Sign-in has been removed from the public masthead (uncommitted)

`src/components/landing/portal/PortalMasthead.tsx:76-88` renders the locale
switcher and the mobile menu toggle, and nothing else, in the masthead's
action slot. `HEAD` had a sign-in button there:

```
-          <Link href="/login" className="cam-button cam-button-primary">
-            {t("portalPage.signInAction")}
```

Consequence: on `/`, `/a-propos` and `/feuille-de-route` there is **no way
to reach `/login` at all** — not in the masthead, not in the footer
(`PortalFooter.tsx:20-26` carries the five content routes only). A returning
declarant or a staff member landing on the home page must first click
"Déclarer" or "Assistance". `docs/plans/landing-portal.md` principle 6
("Sign-in is reachable from everywhere") and its own file-layout table
("PortalMasthead.tsx — lockup, route tabs, **sign-in**, locale switch") both
describe the committed behaviour, not the current one.

### C2. The public site never says that registration must be approved before a declaration can be filed

Self-registration creates the account with `status: 'PENDING_APPROVAL'`
(`src/auth/auth.service.ts:708`). `ActiveCompanyGuard` denies every route on
`@Controller('onefop')` unless the company is `ACTIVE`
(`src/auth/active-company.guard.ts:49-57`;
`src/questionnaires/questionnaires.controller.ts:57-58`). The only exception
is `entityType === 'ADMINISTRATION'`, which auto-approves
(`auth.service.ts:73`, `691`, `1039`).

The public copy does not carry this step anywhere:

- `PORTAL_JOURNEY` is four steps — register, sign in, complete, submit
  (`portal-content.ts:45`; copy `portalPage.journey1Title`–`journey4Title`).
  Approval is not among them.
- `portalPage.faq2Answer` reads "Oui. Inscrivez-vous, terminez la
  vérification et connectez-vous avant de déclarer." Email verification is
  *not* in fact a gate — `ActiveCompanyGuard` never reads `emailVerified` —
  and approval, which *is* the gate, is not mentioned.
- `portalPage.heroRequirement` says registration and sign-in are required
  before any submission. True, and incomplete.

The wait is only disclosed *after* the form is submitted, on the
registration receipt (`registerPage.receiptPendingNote`: "Un agent doit
valider votre inscription. Vous recevrez un e-mail dès que votre compte
sera activé."). For an employer arriving near a deadline this is the wrong
moment to learn it.

**This is the single biggest gap for unregistered declarants.**

### C3. The registration link dropped `?type=`, and the "which one am I" question went with it (uncommitted)

`PORTAL_ACTIONS` (`portal-content.ts:66-71`) sends registration to a bare
`/register` and the other three actions to `/login`. `HEAD`'s
`PortalDeclare.tsx` instead mapped over `PORTAL_REGISTRATIONS`
(`portal-content.ts:80-83`), whose two entries carry
`/register?type=enterprise` and `/register?type=vocationalTraining`.

Two effects:

1. `applyEntityTypeFromLink()` (`src/app/register/page.tsx:867-871`) now has
   nothing to read, so step 1 asks the establishment kind that the front
   door no longer asks either. Commit `a2ee0db7` existed to prevent exactly
   this.
2. The public site no longer distinguishes an employer from a vocational
   training centre anywhere. `portalPage.declarePanelHint` mentions the NIU
   and the accreditation reference in one sentence, but nothing routes on it.

`docs/plans/landing-portal.md` names this regression in advance — "Offering
them as separate actions presents one door as four, which is the single
defect this page has reintroduced most often" — and again under §Open.

### C4. The authority and receipt statements are rendered on no page (uncommitted)

`src/app/(portal)/declarer/page.tsx` still imports `PortalNotices` (line 4)
but no longer renders it; the diff against `HEAD` is exactly
`-      <PortalNotices />`. Nothing else in `src/` renders that component.
The two statements it carried — where a declaration counts as officially
filed (`portalPage.authorityLabel`/`authorityBody`) and what the platform
returns for one (`receiptLabel`/`receiptBody`) — are therefore not public
anywhere.

The test that covers them (`portal-views.test.tsx:61`) renders
`<PortalNotices />` directly, so it still passes and does not catch the
removal. The dead import is also a lint error waiting to happen.

### C5. Every portal-entry page is a dead end

`/login`, `/register`, `/forgot-password`, `/reset-password`,
`/verify-email` and `/inscription-agent` contain no link to `/` or to any
public route. `AuthHeader` (`src/components/auth/AuthHeader.tsx:23-28`) and
`BrandLockup` (`src/components/brand/BrandLockup.tsx:28-48`) are plain
`<div>`s — the logo is not clickable. Grep of `href=` in
`src/app/login/page.tsx` returns four hits: a WhatsApp link (twice),
`/forgot-password` and `/register`.

### C6. An unauthenticated visitor to an authenticated route gets no explanation

`useRequireAuth` (`src/lib/use-require-auth.ts:27-36`) and its duplicate in
`src/app/onefop/preview/page.tsx:43-55` call `router.replace("/login")` in
an effect. While that runs, `/home` renders a centred `common.loading`
string (`src/app/home/layout.tsx:120-126`) and `/onefop/preview` renders the
same (lines 64-70). The visitor lands on the sign-in form with no message
about why, and no hint that they may need to register first.

There is **no `middleware.ts`** in the project (`find . -maxdepth 2 -name
"middleware*"` returns nothing), so all route gating is client-side. The
server-side API enforcement is sound (see G2), so this is a UX defect, not a
security hole.

---

# Part A — Inventory of routes and pages

## A1. Every route the app serves

`public` = reachable with no token. `authed` = client-side gate redirects to
`/login`. `admin` = additionally role-gated.

| Path | File | Access | Renders | State |
|---|---|---|---|---|
| `/` | `src/app/(portal)/page.tsx` | public | Portal home: hero, phase-1 claims, four-step journey | functional |
| `/declarer` | `src/app/(portal)/declarer/page.tsx` | public | Start page: four action buttons + FAQ | functional; see C3, C4 |
| `/feuille-de-route` | `src/app/(portal)/feuille-de-route/page.tsx` | public | Four programme phases with state filter | functional |
| `/assistance` | `src/app/(portal)/assistance/page.tsx` | public | The one published support channel (WhatsApp) + two actions | functional |
| `/a-propos` | `src/app/(portal)/a-propos/page.tsx` | public | Mandate, three eras, four-step transformation, phase-1 progress | functional |
| `/login` | `src/app/login/page.tsx` | public | Sign-in + "retrouver mon identifiant" tab + 2FA step | functional |
| `/register` | `src/app/register/page.tsx` | public | 6-step self-service registration wizard (2225 lines) | functional |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | public | Security-question password reset, 3 steps | functional |
| `/reset-password` | `src/app/reset-password/page.tsx` | public | Consumes an admin-emailed reset token | functional |
| `/verify-email` | `src/app/verify-email/page.tsx` | public | Consumes an email-verification token | functional |
| `/inscription-agent` | `src/app/inscription-agent/page.tsx` | public (token-bearing) | Staff invitation acceptance / group sign-up | functional |
| `/home` | `src/app/home/page.tsx` | authed | Respondent or staff landing inside the shell | functional |
| `/home/declarations` | `src/app/home/declarations/page.tsx` | authed | Unified DSMO + ONEFOP submission history, grouped by status | functional |
| `/home/declarations/new` | `src/app/home/declarations/new/page.tsx` | authed | 3-step DSMO declaration wizard | functional |
| `/home/inscription-en-attente` | `src/app/home/inscription-en-attente/page.tsx` | authed | Pending-approval status page + correction form for `COMPLEMENTS_REQUESTED` | functional |
| `/home/annuaire` | `src/app/home/annuaire/page.tsx` | — | Server redirect to `/admin/annuaire` | functional (13 lines, redirect only) |
| `/home/[slug]` | `src/app/home/[slug]/page.tsx` | authed | **Honest "not yet migrated" placeholder** for any nav slug without a route | **stub by design** |
| `/onefop/preview` | `src/app/onefop/preview/page.tsx` | authed | The ONEFOP declaration wizard (the real declaration entry point) | functional |
| `/admin/pilotage` | `src/app/admin/pilotage/page.tsx` | admin | Role-scoped dashboard / queues | functional |
| `/admin/dossiers` | `.../dossiers/page.tsx` | admin | Submission review list | functional |
| `/admin/dossiers/[id]` | `.../dossiers/[id]/page.tsx` | admin | One dossier, with visa / reject / request-correction | functional |
| `/admin/inscriptions` | `.../inscriptions/page.tsx` | admin | Registration review queue | functional |
| `/admin/inscriptions/nouvelle` | `.../inscriptions/nouvelle/page.tsx` | admin | **Assisted registration** — staff register a company | functional |
| `/admin/annuaire` | `.../annuaire/page.tsx` | admin | Accounts + entities directory | functional |
| `/admin/etablissements` | `.../etablissements/page.tsx` | admin | Establishment register | functional |
| `/admin/etablissement-detail` | `.../etablissement-detail/page.tsx` | admin | One establishment | functional |
| `/admin/utilisateurs` | `.../utilisateurs/page.tsx` | admin | Staff accounts | functional |
| `/admin/equipe` | `.../equipe/page.tsx` | admin | Team / invitations | functional |
| `/admin/campagnes` | `.../campagnes/page.tsx` | admin | Campaign management | functional |
| `/admin/cibles` | `.../cibles/page.tsx` | admin | Targeting | functional |
| `/admin/centre-qualite` | `.../centre-qualite/page.tsx` | admin | Blocking-anomaly resolution | functional |
| `/admin/questionnaires` | `.../questionnaires/page.tsx` | admin | Questionnaire inventory from the generated schema | functional |
| `/admin/sectors` | `.../sectors/page.tsx` | admin | Sector classification (read-only list) | functional |
| `/admin/diffusion` | `.../diffusion/page.tsx` | admin | Statistics dissemination / export | functional |
| `/admin/journal-audit` | `.../journal-audit/page.tsx` | admin | Audit log | functional |
| `/admin/notifications` | `.../notifications/page.tsx` | admin | The caller's own notification inbox | functional |
| `/admin/parametres` | `.../parametres/page.tsx` | admin | Settings | functional |

Also present: `src/app/admin/error.tsx` (admin error boundary). No
`not-found.tsx`, no `middleware.ts`, no route handlers (`route.ts`) anywhere
— the app talks to the NestJS API directly from the client.

**No `/programme`, `/lmis`, `/observatory` or `/roadmap` route exists**, and
`next.config.ts` declares no `redirects()`. If any of those permalinks were
ever published they 404 today.

## A2. Category per route

**Public informational (5)** — `/`, `/a-propos`, `/feuille-de-route`,
`/assistance`, and `/declarer`. `/declarer` is classified here with a
caveat: it is named for a task (`portalPage.navDeclare` = "Déclarer" /
"Submit data") but performs none; it is a signpost.

**Portal entry (6)** — `/login`, `/register`, `/forgot-password`,
`/reset-password`, `/verify-email`, `/inscription-agent`.

**Authenticated declarant (6)** — `/home`, `/home/declarations`,
`/home/declarations/new`, `/home/inscription-en-attente`, `/onefop/preview`,
`/home/[slug]`.

**Admin / staff (19)** — every `/admin/*` route above, plus `/home/annuaire`
which only redirects into the console.

**Uncategorized** — none.

## A3. Public landing page at `/`

Yes. `src/app/(portal)/page.tsx` composes three bands, in this order:

1. **`PortalHero`** — eyebrow `CAM-LEAP / ONEFOP · MINEFOP`; H1; lede
   explaining CAMLEAP as ONEFOP's LMIS under MINEFOP oversight; the
   requirement line ("L'inscription et la connexion sont obligatoires avant
   toute soumission"); two buttons — "Soumettre des données" → `/declarer`
   and "Découvrir CAMLEAP" → `/a-propos`; a status line that appends the
   earliest open-campaign closing date fetched from
   `GET /public/campaigns/open`, silently omitted on failure
   (`PortalHero.tsx:30-41`); and a two-panel paper→digital figure.
2. **`PortalStatusBand`** — "what phase 1 does", four claims
   (`PORTAL_STATUS_CLAIMS`), including "aucune recherche publique n'est
   proposée".
3. **`PortalJourney`** — an ordered list of four numbered steps: register,
   sign in, complete and validate, submit. The per-step descriptions and the
   closing CTA were removed in the working tree (`PortalJourney.tsx` diff),
   so it is now four bare numbered titles.

Above all three: the shared masthead and skip link; below: the shared footer
(`src/app/(portal)/layout.tsx:20-33`).

## A4. Is there a portal entry page?

Yes — `/declarer`. It is a real route with its own URL, title and metadata,
not a dialog, and it is reachable from the masthead on every portal page and
from the hero's primary button.

What it contains today (`PortalDeclare.tsx`): an eyebrow, an H1 ("S'inscrire,
se connecter et soumettre"), an intro, a panel headed "Choisissez comment
continuer", four stacked buttons, a notice, and a dock of two links (back to
home / get help).

The four buttons are:

| Label (FR) | Target |
|---|---|
| Inscrire un établissement | `/register` |
| Se connecter pour déclarer | `/login` |
| Reprendre un brouillon | `/login` |
| Voir mes déclarations et récépissés | `/login` |

So it does explain the available actions — but three of the four are the
same destination, and `PortalDialog.tsx` (68 lines, a native `<dialog>`
built for the per-pathway detail view) is now **imported by nothing** and is
dead code.

## A5. Navigation structure

**Masthead** (`PortalMasthead.tsx`, shared by all five portal routes): the
ONEFOP emblem + CAMLEAP lockup as one link to `/`; a `<nav>` of four tabs
from `PORTAL_NAV` — Accueil, Déclarer, Feuille de route, Assistance — with
`aria-current="page"` derived from `usePathname()`; the locale switcher; and
a menu toggle that opens the same four links as a drawer on narrow
viewports. **No sign-in action** (C1).

**Footer** (`PortalFooter.tsx`): "CAMLEAP" in bold, the ministry line, and a
`<nav>` of all five content routes — the four tabs plus `/a-propos`, which
the masthead deliberately omits.

**Global navigation:** none. The portal nav exists only inside the
`(portal)` route group. `/login`, `/register` and the other entry pages use
`LandingShell` or `AuthHeader`, neither of which carries any navigation.
`/home` and `/admin` have their own rails.

---

# Part B — Separation of concerns

## B1. Visual distinctness and shared chrome

Three visually distinct surfaces, with no shared header or footer between
them:

- **Portal** (`portal.module.css`): re-points the shared `--cam-*` tokens to
  a `--cam-portal-*` palette on its own root, so `.cam-button` paints teal
  inside the portal only. Cream / teal / ink bands.
- **Entry pages**: `/login` uses `LandingShell` (`landing.module.css`) — a
  two-pane "focus stage" with a guides panel on the left and the auth card on
  the right. `/register` and the rest use `AuthHeader` + `cam-auth-page`.
  Neither has the portal's bands or nav.
- **Authenticated**: `/home` uses `cam-home` + a left rail from
  `globals.css`; `/admin` uses `AdminSidebar` + `admin-console.css`.

The brand is the common thread: the ONEFOP emblem + CAMLEAP lockup appears
on the portal masthead, on `LandingShell` and (emblem-less, per
`docs/standards/brand.md`) in `AuthHeader`; working screens show CAMLEAP
alone.

**Headers do not change with signed-in state.** `PortalMasthead` never reads
the auth store or the token — grep for `useAuthStore|getToken` across
`src/components/landing/portal/` and `src/app/(portal)/` returns no code
hits.

## B2. Not-signed-in user visits an authenticated route

Redirect to `/login`, client-side, with no explanation. `/home` renders a
centred loading string first (`home/layout.tsx:120-126`) then
`router.replace("/login")` fires from `useRequireAuth`'s effect
(`use-require-auth.ts:31-34`). `/onefop/preview` does the same via its own
copy of the hook (lines 43-55). No error page, no message, no silent
failure — just an unexplained landing on the sign-in form. See C6.

## B3. Signed-in user visits a public route

They see the public masthead exactly as an anonymous visitor does: no email,
no role, no account menu, no "go to my dashboard". And at present
(C1) not even a "Sign in" link to indicate state either way. Signing out
from `/home` or `/admin` calls `logout()` then `router.replace("/")`
(`home/layout.tsx:270-280`), so the signed-out user lands on the portal —
which is correct, but indistinguishable from an arrival.

## B4. Layouts

Four layouts, properly separated:

- `src/app/layout.tsx` — root: fonts, `NextIntlClientProvider`,
  `QueryProvider`, `AuthInitializer`. Wraps everything.
- `src/app/(portal)/layout.tsx` — public: skip link, masthead, `<main
  id="contenu">`, footer. The bracketed folder adds no URL segment.
- `src/app/home/layout.tsx` — authenticated respondent/staff shell: auth
  gate, role-aware rail, pending-approval redirect, logout.
- `src/app/admin/layout.tsx` — staff console: role guard
  (`useAdminScreenGuard(ADMIN_ROLES)`), sidebar, header actions.

The six entry pages (`/login`, `/register`, …) have **no shared layout** —
each imports `LandingShell` or `AuthHeader` itself. That is why the
dead-end problem in C5 is per-page rather than fixable in one place.

---

# Part C — Content for stakeholders and funders

## C1 (part C). Does the app explain CAMLEAP to a newcomer?

Yes, in two places, without a login.

On `/` — `portalPage.lede`: "CAM-LEAP est la plateforme camerounaise
d'analyse de l'emploi et du marché du travail, conçue pour moderniser le
système d'information de l'ONEFOP sous la tutelle du MINEFOP. La phase 1
remplace la collecte papier par des télédéclarations numériques authentifiées
pour les établissements et centres de formation professionnelle du Cameroun."

On `/a-propos` — the fuller account (see C2 below).

One brand defect: the hero eyebrow and the lede both write **"CAM-LEAP"**
with a hyphen. `docs/standards/brand.md` and `docs/plans/landing-portal.md`
both state the name is **CAMLEAP**, one word, and the plan lists the
hyphenated spelling among the things the reference mockup gets wrong. The
masthead logo is correct; the copy is not.

## C2. About page

`/a-propos` → `PortalAbout` + `PortalTransformation` + `PortalProgress`:

- `aboutTitle` / `aboutBody` — what the platform is for and whose it is.
- A panel, `aboutPanelTitle` / `aboutPanelBody`, carrying the LMIS /
  observatory distinction required by CLAUDE.md §4: "La collecte structurée
  et authentifiée vient d'abord. L'analyse validée et la diffusion
  responsable suivront lors des prochaines phases."
- `PORTAL_STORY` — three eras (paper → digital → analysis), flat, with the
  middle one marked as "now".
- `PORTAL_TRANSFORM` — four transformation steps, each carrying a state
  (`live`, `live`, `next`, `planned`).
- `PORTAL_ACHIEVEMENTS` — three claims about what phase 1 actually
  delivered.

The mandate is named in words (ONEFOP, under MINEFOP oversight), both in the
body copy and in `portalPage.footerMinistry`. There is **no named oversight
body, committee or contact** on the page — `docs/plans/landing-portal.md`
lists "who oversees the programme" as something audience 4 is owed, and it is
not there.

## C3. Roadmap page

`/feuille-de-route` → `PortalRoadmap`. Four phases from `PORTAL_PHASES`
(`portal-content.ts:97-102`), each with a hard-coded state:

| Phase | State |
|---|---|
| phase1 | `live` |
| phase2 | `next` |
| phase3 | `planned` |
| phase4 | `planned` |

Rendered as cards on the ink band, with a four-way filter (Toutes / En
service / Prochaine étape / Planifiées) whose result count is announced
through a live region, plus a "current phase" notice. States are static
constants in the source, not read from any system of record.

## C4. Bilingual?

Yes, fully, for the portal. `messages/fr.json` and `messages/en.json` each
hold **172 keys under `portalPage`**, with zero keys missing on either side
(verified by diffing the key sets); 74 top-level namespaces on both sides
with no divergence. Key parity is also enforced by a test
(`src/lib/admin-locale.test.ts`, per `docs/plans/landing-portal.md`).

Switching: `LocaleSwitcher` (`src/components/LocaleSwitcher.tsx:18-24`)
writes a `NEXT_LOCALE` cookie with a one-year max-age and calls
`router.refresh()`. `src/i18n/request.ts` resolves the locale per request —
cookie first, then `Accept-Language`, French as the fallback. There are no
locale URL segments; the same URL serves both languages.

## C5. Can a funder or journalist find the narrative without logging in?

Yes. They land on `/`, which opens on what CAMLEAP is rather than on a
sign-in form, and two masthead-or-hero clicks reach the full account:
`/a-propos` for the mandate and the delivered/promised split,
`/feuille-de-route` for the four phases and their states. This layer is
**more complete than the audit prompt's framing assumes** — the content
exists, it is bilingual, and it has been through a documented "truth pass"
that struck unsupportable claims (QR codes, audit validity, "28 pages",
"12 min", invented contacts — see `docs/plans/landing-portal.md` §Claims
removed in the truth pass).

Two weaknesses: the narrative is spread over two routes holding about one
page of content between them (the plan itself flags this under §Open), and
no oversight body is named.

---

# Part D — Portal entry experience

## D1. First-time declarant: "I want to declare" → "I have registered"

Path, as the app behaves today:

1. `/` — reads the hero. Learns CAMLEAP exists and that registration and
   sign-in are required. Clicks **"Soumettre des données"**.
2. `/declarer` — reads "S'inscrire, se connecter et soumettre" and
   "Les employeurs doivent préparer leur NIU. Les centres de formation
   professionnelle doivent préparer leur référence d'agrément ou MINEFOP."
   Clicks **"Inscrire un établissement"**.
3. `/register` — a 6-step wizard (`REGISTRATION_STEPS`,
   `src/lib/register-constants.ts:28-34`):
   1. **entityType** — pick one of seven organisation types
      (`ENTITY_TYPE_OPTIONS`, `register/page.tsx:116+`). Because `?type=` was
      dropped (C3), this question is now asked here for the first time.
   2. **respondent** — first name, last name, function, email, phone 1,
      phone 2 (optional).
   3. **entityInfo** — the per-type field set from `ENTITY_CONFIGS`. For an
      enterprise: company name, legal status, **NIU (required)**, **CNPS no.
      (required)**, main activity, head-office address, phone, and optional
      branch / share capital / parent company / secondary activity / P.O. box.
   4. **location** — region → department → subdivision, each fetched from the
      API and dependent on the previous.
   5. **security** — password against `password-strength.ts` rules.
   6. **review** — `RegistrationReview`, then submit.
4. **Receipt** — not a route; the same page swaps to a receipt view
   (`register/page.tsx:1162+`). Shows the establishment ID (copyable), the
   company, type, respondent, date, and status. For a normal registration the
   status is **"En attente de validation par l'ONEFOP"** and the note says an
   officer must validate it and an e-mail will follow.
5. **`/login`** — the one button on the receipt, which also stashes the
   email so the sign-in field is prefilled (`saveLoginIdentifier`).
6. After signing in, `/home`'s layout detects `PENDING_APPROVAL` and
   redirects to **`/home/inscription-en-attente`**
   (`home/layout.tsx:113-118`). No declaration is possible from there.

**Clicks:** 2 to reach the form; the wizard itself auto-advances at the
frontier when a section completes (`advancesImmediately`), so the click count
inside it depends on optional fields — roughly 6 "Continuer" presses plus the
field entry. So about **8-10 deliberate clicks** from `/` to a submitted
registration, then an **indeterminate wait** for staff approval.

**They have registered. They cannot yet declare.** That step is explained
only at step 4, and never on the public site (C2).

## D2. Returning declarant

- **Resume a saved draft** — from `/declarer`, "Reprendre un brouillon" →
  `/login` → `/home` → the ONEFOP wizard restores from
  `use-onefop-draft` / server save, or the DSMO wizard from
  `getDsmoDraft`. There is no "my drafts" list; the draft is restored by the
  wizard itself.
- **Submission history** — `/home/declarations`
  (`src/app/home/declarations/page.tsx`, 562 lines): merges
  `GET /dsmo/declarations` and `GET /onefop/submissions` into one timeline
  grouped Draft / Pending / Approved / Rejected / Correction.
- **Retrieve a receipt** — the same page, via `getDeclarationPdfUrl` per
  entry. Separately, an `ACTIVE` company can fetch its **registration**
  attestation from the `/home` rail (`home/layout.tsx:79-105`,
  `getMyAttestation`), which the backend guards with `ActiveCompanyGuard`.

All three require a session. `portalPage.helpAccountBody` states this
plainly: "Une référence seule ne permet pas de récupérer publiquement un
récépissé."

## D3. Is there a page listing all portal actions?

Yes — `/declarer` lists four (register, sign in, resume a draft, view
submissions and receipts). It is a single page, not scattered. But three of
the four resolve to `/login`, so it presents one door as four — the defect
`docs/plans/landing-portal.md` identifies as the page's most-repeated
regression, now re-introduced and locked in by a test
(`portal-views.test.tsx:40-59` asserts exactly these four hrefs).

## D4. Forgotten reference number

Yes, there is a recovery path, and it is reasonably complete:

- **Forgotten login identifier / establishment ID** — `/login`'s second tab,
  "Retrouver mon identifiant": company name + NIU + phone →
  `POST /auth/identifier/find` (`login/page.tsx:155-178`), which returns the
  establishment ID with a copy button.
- **Forgotten password** — `/forgot-password`: security questions, three
  steps (`GET /auth/reset/questions`, `POST /auth/reset/verify`).
- **Admin-issued reset** — `/reset-password?token=…`, from
  `POST /auth/admin/reset-password` (SUPER_ADMIN only).

There is **no** public lookup of a *declaration* tracking number, by design.

---

# Part E — Links between public and portal

## E1. Primary calls-to-action on `/`

Two, both in the hero (`PortalHero.tsx:52-59`):

- **"Soumettre des données"** (primary) → `/declarer`
- **"Découvrir CAMLEAP"** (secondary) → `/a-propos`

`PortalJourney`'s closing CTA to `/declarer` was removed in the working tree,
so after the three bands the home page ends with no action at all. Nothing on
`/` points to `/login` or `/register`.

## E2. Does `/` link directly to `/register` or `/login`?

Neither. It links to `/declarer`, the entry page, which then branches. That
is the intended design. But combined with C1, it means **`/` has no path to
sign-in at all**, which is not intended.

## E3. Dead ends

**Public pages with no path to the portal:** `/`, `/feuille-de-route` and
`/a-propos` have no sign-in link (C1). They do all reach `/declarer` through
the masthead, so a first-time visitor is served; a returning one is not.

**Portal pages with no path back to the public site:** all six entry pages
(C5). Also `/home` and `/admin`: the only route back to `/` is the logout
button.

**Dead code reached from nowhere:**
- `PortalDialog.tsx` (68 lines) — imported by nothing.
- `PortalNotices.tsx` — imported by `/declarer` but not rendered (C4).
- `PORTAL_REGISTRATIONS` — still used by `PortalSupport.tsx:33` (which does
  link to `/register?type=enterprise`), but no longer by `PortalDeclare`.

## E4. Brand and header consistency

Consistent in identity, inconsistent in chrome. All front-door surfaces show
the ONEFOP emblem + CAMLEAP lockup as one unit per
`docs/standards/brand.md`, and working screens show CAMLEAP alone — a
documented, deliberately applied rule. But the portal, `LandingShell` and
`AuthHeader` are three different layouts with three different stylesheets and
no shared nav, so crossing from `/declarer` to `/register` feels like leaving
the site. Two palettes are in play: the portal's teal/cream
(`--cam-portal-*`) and the app's green (`--cam-green`).

---

# Part F — Gaps against the standard pattern

## F1. Present

| Element | Status |
|---|---|
| One domain | ✅ One Next.js app, one origin, one route tree |
| Public informational pages | ✅ Five routes, bilingual, truth-passed |
| A distinct portal-entry experience | ✅ `/declarer` is a real route, not a dialog |
| Authenticated portal for declarants | ✅ `/home`, `/home/declarations`, `/onefop/preview` |
| Shared branding | ✅ Lockup rules in `docs/standards/brand.md`, applied |

## F2. Missing

- **A header that adapts to signed-in state.** Not implemented anywhere on
  the public side.
- **Sign-in in the masthead.** Present at `HEAD`, removed in the working tree
  (C1).
- **Any path from the entry/auth pages back to the public site** (C5).
- **Disclosure of the approval gate on the public site** (C2).
- **A named oversight body** on `/a-propos`.
- **`middleware.ts`** — no server-side route gating; all client-side.
- **Redirects for retired public permalinks.** `next.config.ts` declares
  none, and `docs/plans/landing-portal.md` principle 8 requires them.
- **`not-found.tsx`** — no branded 404.

## F3. Partially implemented

- **Portal entry.** The page exists and is well-built; its action list
  misrepresents one destination as four (C3, D3).
- **Public / portal visual coherence.** Shared identity, three unrelated
  layouts (E4).
- **The institutional story.** Complete in substance, spread over two routes
  that tell it four ways (the plan's own §Open: "between them they tell the
  same story four times").
- **Entity-kind routing.** `/register?type=` is implemented and read
  (`register/page.tsx:867-871`); only `PortalSupport` still sends it.

## F4. Contradictions of the pattern

- **A masthead tab named for a task the page cannot perform.** "Déclarer" /
  "Submit data" leads to a page with no declaration on it. The plan names
  this: "A tab named for a task the page cannot perform is how audience 1
  ends up at a sign-in form wondering what happened."
- **No public content is hidden behind login** — good. Nothing in the
  `(portal)` group is gated.
- **No authenticated tool is exposed publicly** — good. See G2.
- `/declarer`'s eyebrow reads "PHASE 01 / ONEFOP", programme vocabulary on a
  page addressed to a declarant — the register-mixing the plan warns against.

---

# Part G — Registration model

## G1. Which model?

**Mixed — but effectively register-first with a mandatory staff-approval
gate, plus a parallel staff-assisted path.**

Precisely:

- **Self-service registration is open to the public.** `/register`
  (`src/app/register/page.tsx`) → `POST /auth/register-company`
  (`src/auth/auth.controller.ts:76`), which carries **no guard decorators** —
  it is one of the few genuinely public endpoints.
- **The resulting account cannot declare.** It is created with
  `status: 'PENDING_APPROVAL'` (`src/auth/auth.service.ts:708`), and
  `ActiveCompanyGuard` denies every `COMPANY`-role request unless
  `status === 'ACTIVE'` (`src/auth/active-company.guard.ts:49-57`).
- **One exception auto-approves:** `AUTO_APPROVE_ENTITY_TYPES =
  ['ADMINISTRATION']` (`auth.service.ts:73`, checked at `691`, applied at
  `1039`). A public administration is `ACTIVE` immediately.
- **Staff can register a company on its behalf** —
  `POST /auth/admin/register-company` (`auth.controller.ts:271-273`, roles
  `SUPER_ADMIN`, `ADMIN_ONEFOP`, `REGIONAL_ADMIN`, `DIVISIONAL_ADMIN`), from
  `/admin/inscriptions/nouvelle`. This path sets `skipAutoApproval`
  deliberately (`auth.service.ts:616-621`): "a declarant that did not fill in
  its own details gets no less oversight than one that did."
- **Approval is a staff action**: `auth.service.ts:1161-1166` flips the
  status to `ACTIVE`, or `1257-1262` sets `COMPLEMENTS_REQUESTED` with a
  comment, which routes the company to the correction form at
  `/home/inscription-en-attente`.

So the lived model is: **register (self or assisted) → wait for an ONEFOP
officer → sign in → declare.**

## G2. Is there any submission path without an authenticated session?

**No.** Checked all three places:

1. **Server-side.** `@Controller('onefop')` applies
   `JwtAuthGuard, RolesGuard, ActiveCompanyGuard` at the class level
   (`src/questionnaires/questionnaires.controller.ts:57-58`), and
   `POST onefop/submit` adds `@Roles('COMPANY')` (lines 219-220). Every
   controller in `src/` references `JwtAuthGuard` except one: the
   deliberately unguarded `PublicCampaignController`
   (`src/campaign/public-campaign.controller.ts:29-36`), which exposes only
   `GET public/campaigns/open` — module, reference year, closing date, and
   nothing else, documented at length in the file itself. `ThrottlerGuard` is
   the only global guard (`src/app.module.ts:47`).
2. **Client-side.** `/onefop/preview` and the whole `/home` subtree gate on
   token presence and redirect to `/login`. Nothing in the `(portal)` group
   renders a questionnaire.
3. **Draft / preview bypass.** `POST onefop/preview`
   (`questionnaires.controller.ts:65`) sits under the same class-level
   guards. Draft saves go through `saveDraftToBackend` /
   `useOnefopServerSave`, both authenticated. The register wizard's own draft
   is browser-local (`register-draft.ts`) and holds registration data, not a
   declaration.

The gating is sound on the server. The weakness is purely presentational
(C6): there is no `middleware.ts`, so an anonymous visitor to a protected
route briefly renders a loading string before a client-side redirect.

## G3. Flow for submission without prior registration

Not implemented. No such flow exists.

---

# Part H — Unregistered company experience

## H1. Exact path to a first declaration

| # | Page | Action | Required of them |
|---|---|---|---|
| 1 | `/` | Read hero; click "Soumettre des données" | — |
| 2 | `/declarer` | Read the prerequisite; click "Inscrire un établissement" | — |
| 3 | `/register` step 1 | Choose organisation type (7 options) | — |
| 4 | step 2 | Respondent identity | First name, last name, function, **email**, phone (Cameroon format, `cameroon-phone.ts`) |
| 5 | step 3 | Entity details | Enterprise: company name, legal status, **NIU**, **CNPS no.**, main activity, head-office address, phone. VTC: centre name, CFP type, **accreditation/registration no.**, NIU, CNPS no. |
| 6 | step 4 | Location | Region, department, subdivision (API-driven cascade) |
| 7 | step 5 | Password | Meets `password-strength.ts` rules |
| 8 | step 6 | Review and submit | — |
| 9 | receipt | Copy the establishment ID; click through | Keep the ID |
| 10 | `/login` | Sign in | Email + password |
| 11 | `/home/inscription-en-attente` | **Wait** | Nothing they can do |
| 12 | — | **An ONEFOP officer approves the file** | Out of their hands |
| 13 | `/home` → `/onefop/preview` | Complete and submit the declaration | The questionnaire |

**Steps involved: 13, of which step 12 is not theirs and has no stated
duration.** Six wizard steps; two documents (NIU and CNPS number, or an
accreditation reference) that must be to hand.

## H2. Friction that would cause abandonment

Real, in rough order of severity:

1. **The approval wait, undisclosed until step 9.** No SLA is stated
   anywhere, in copy or in code. A company arriving near a deadline has no
   way to know whether it will be approved in time.
2. **The approval notification depends on e-mail.**
   `registerPage.receiptPendingNote` promises an e-mail on activation. Email
   delivery from this deployment has been unreliable (SMTP unreachable from
   the host, sender domain unverified). If the e-mail does not arrive, the
   company has no in-app pull mechanism other than signing in again to see
   whether the status changed.
3. **NIU and CNPS number are both required** for enterprise, cooperative,
   CTD, ONG and vocational training (`register-constants.ts:180-196`). A new
   or informal establishment that lacks either cannot complete step 3. See H6.
4. **Two-factor** exists as a login challenge (`login/page.tsx:91-153`) but
   is not forced at registration, so it is not a blocker for a first
   declaration.
5. **Email verification** is sent but is **not** a gate
   (`ActiveCompanyGuard` never reads `emailVerified`), so it does not block —
   though the FAQ says it must be completed, which will make some respondents
   wait for nothing.
6. **The six-step wizard auto-advances at the frontier**
   (`advancesImmediately`), which is good, but 2225 lines of form across six
   sections is still a long sitting for a once-a-year task.

## H3. Does the public site say registration is first?

Yes, clearly and more than once:

- `portalPage.heroRequirement`: "L'inscription et la connexion sont
  obligatoires avant toute soumission de déclaration."
- `portalPage.doorsIntro`: "Inscrivez un établissement et connectez-vous
  avant de déclarer."
- `portalPage.faq2Answer`: "Oui. Inscrivez-vous… La soumission anonyme n'est
  pas disponible."
- `PORTAL_JOURNEY` puts "S'inscrire" as step 01.

It does **not** imply declarations can be made directly. The one misleading
signal is the masthead tab "Déclarer" / "Submit data", which names a task
the page behind it cannot perform. And it stops one step short of the truth
by omitting approval (C2).

## H4. Self-service or staff-assisted?

**Both.**

- **Self-service:** `/register` (`src/app/register/page.tsx`) →
  `POST /auth/register-company`, unguarded. Open to anyone. This is the
  advertised path and the only one the public site mentions.
- **Staff-assisted:** `/admin/inscriptions/nouvelle`
  (`src/app/admin/inscriptions/nouvelle/page.tsx`, 571 lines) →
  `POST /auth/admin/register-company`, roles `SUPER_ADMIN`, `ADMIN_ONEFOP`,
  `REGIONAL_ADMIN`, `DIVISIONAL_ADMIN`.

**When each is used:** nothing in the code or the docs states a policy. The
assisted route exists, works, and is reachable only from inside the console;
the public site never mentions it (see J3).

## H5. Unregistered company hits `/home`, `/onefop/preview` or a declaration route

They see a centred "Chargement…" and are then redirected to `/login` by an
effect. **No error message, no explanation, and no indication that they need
to register first.** The page is not broken and nothing leaks, but the
visitor is left to infer the reason. See C6.

Worse for the near-miss case: a company that *has* registered and signs in
is redirected from `/home` to `/home/inscription-en-attente`
(`home/layout.tsx:113-118`), which does explain the wait — so the
explanation exists, one step too late to help an unregistered visitor.

## H6. Can a company declare without a NIU or MINEFOP accreditation?

**Not through the public wizard.** `TAX_NUMBER` is `required: true`
(`register-constants.ts:180-185`) and `CNPS_NUMBER` is `required: true`
(lines 191-196), for enterprise, cooperative, CTD, ONG and vocational
training. `missingRequiredFields` blocks "Continuer" until they are filled.

**The server, however, tolerates their absence.** `createCompanyRegistration`
falls back to a synthetic `NA-${crypto.randomUUID()}` when `taxNumber` is
empty (`auth.service.ts:693-694`) and skips the uniqueness check entirely for
types that do not collect one (`auth.service.ts:629-647`, written for
`ADMINISTRATION` and `PROJECT_PROGRAM`, which have no NIU field in the UI).

So the capability to register a NIU-less establishment exists in the data
model and is exercised by two entity types — but the client makes it
unreachable for an enterprise or a training centre. An informal or brand-new
establishment is blocked at step 3 with no alternative offered and no
mention of the assisted path. **This is a policy question as much as a code
one** — see L5.

---

# Part I — Communication about unregistered declarants

## I1. Does the public site address not-yet-registered companies explicitly?

Yes, but implicitly rather than by name. The hero states the prerequisite;
`/declarer`'s H1 is "S'inscrire, se connecter et soumettre"; the first
action is "Inscrire un établissement"; FAQ 2 is "L'inscription est-elle
obligatoire ?". There is no sentence of the form "Vous n'êtes pas encore
inscrit ? Commencez ici" — the unregistered visitor has to work out that the
first button is theirs.

## I2. Content distinguishing a first-timer from a returning declarant?

Weakly. The ordering does the work: register is listed first on `/declarer`
and is the only primary-variant button, with the three secondary ones below
it. `PORTAL_JOURNEY` numbers register as 01. But there is no heading, no
divider and no label that says which group each action belongs to, and the
labels themselves are ambiguous — "Se connecter pour déclarer" could read to
a newcomer as the way to declare.

## I3. Are the CTAs appropriate for both?

For **unregistered** visitors: yes on `/declarer`, no on `/`. The home page's
two actions are "Soumettre des données" and "Découvrir CAMLEAP" — the first
is a signpost, which works.

For **registered** visitors: no. Since C1 removed the masthead sign-in,
`/`, `/a-propos` and `/feuille-de-route` offer them nothing, and
`/declarer` offers them three buttons that are the same door.

Nothing assumes prior registration, which is the right default.

## I4. Are "Sign in", "Register" and "Submit a declaration" distinguished?

They are **not collapsed into one button** — the distinction exists:

| Concept | Where |
|---|---|
| Register | `portalActionRegister` "Inscrire un établissement" → `/register` |
| Sign in | `portalActionLogin` "Se connecter pour déclarer" → `/login`; `portalPage.signInAction` on `/assistance` |
| Submit a declaration | Deliberately absent as an action — the plan states "There is no 'submit a declaration' action on the front door, because an anonymous visitor cannot perform one" |

But two things to flag:

1. **The masthead tab is named for the absent action.** "Déclarer" / "Submit
   data" is the second tab, and it is the task label the plan says must not
   appear as a tab.
2. **"Se connecter pour déclarer" blurs the line.** For an unregistered
   visitor scanning four buttons, a label combining sign-in with the task
   reads as the way to do the task. The register button is above it and is
   the only primary, which mitigates but does not resolve this.

---

# Part J — Assisted registration

## J1. Does it exist?

Yes, fully implemented.

**Route:** `/admin/inscriptions/nouvelle`
(`src/app/admin/inscriptions/nouvelle/page.tsx`, 571 lines).
**Endpoint:** `POST /auth/admin/register-company`
(`src/auth/auth.controller.ts:271-273`).
**Who:** `SUPER_ADMIN`, `ADMIN_ONEFOP`, `REGIONAL_ADMIN`,
`DIVISIONAL_ADMIN`.

**What staff collect:** the same field set as the public wizard — the page
reuses `ENTITY_CONFIGS`, `entityApiValue`, `isFieldVisible`,
`visibleEntityDataForType` and the same territory hooks, and offers the same
seven organisation types with the public wizard's plain-language labels
(lines 38-50). Email availability is checked live (`useEmailAvailability`).

**How the company receives credentials:** the staff member does **not**
choose a password. The server generates a temporary one and returns it once
in plaintext (`src/lib/inscriptions.ts:16-17, 97`); the page shows it in a
result panel alongside the email and the establishment ID
(`nouvelle/page.tsx:420-430`) with a copy-to-clipboard button (line 236).
Conveying it to the company is an out-of-band manual step — **there is no
code path that delivers it.**

**What the company does next:** signs in at `/login` with that email and
temporary password. The account is created with `skipAutoApproval`
(`auth.service.ts:616-621`), so it too lands in the review queue and the
company sees `/home/inscription-en-attente` until an officer approves it.
Staff-created accounts generally carry `mustChangePassword: true` (the
pattern at `auth.service.ts:580` for MINEFOP users).

## J2. Is it documented for staff?

**Not implemented** as staff-facing documentation. There is no runbook, no
onboarding guide, and no SOP in `docs/`. What exists is engineering record
only: the `skipAutoApproval` rationale in a code comment
(`auth.service.ts:616-621`), `docs/audit/` entries, and
`src/auth/assisted-registration.spec.ts` as the behavioural specification.
The in-app page carries its own labels and hints, and that is the whole of
the guidance.

## J3. Is it offered publicly as an option?

**No.** `/admin/inscriptions/nouvelle` is behind `useAdminScreenGuard`, and
no public page mentions that staff can register a company on its behalf.
`/assistance` offers the WhatsApp number and says help is available for
"l'inscription, la connexion, la vérification à deux facteurs, le NIU ou les
références d'agrément…" (`portalPage.helpBody`) — which is the nearest
thing, but it offers help *with* self-registration, not registration *by* an
officer. A company that cannot self-register has no stated route.

---

# Part K — Proposed implementation plan

Ordered by dependency. Estimates are developer-days for one engineer
familiar with this codebase, including the bilingual copy and tests this
repo's conventions require.

### K-1. Restore sign-in to the masthead — **0.25 d** — CRITICAL
- **Build:** put the `/login` button back in `PortalMasthead`'s action slot,
  and add it to the mobile drawer (the drawer currently renders only
  `PORTAL_NAV`).
- **Where:** `src/components/landing/portal/PortalMasthead.tsx:76-88` and the
  drawer at lines 91-95. Copy key `portalPage.signInAction` already exists in
  both languages.
- **Contains:** one secondary-or-primary button, "Se connecter" / "Sign in".
- **Depends on:** nothing. Do this first.
- **Test:** add one assertion to `portal-views.test.tsx`'s masthead tests —
  the absence was not caught because nothing covered it.

### K-2. Decide and settle `PORTAL_ACTIONS` vs `PORTAL_REGISTRATIONS` — **0.5 d** — CRITICAL
- **Build:** collapse the three `/login` actions into one, and restore
  `?type=` on registration. Either revert `PortalDeclare` to the two typed
  registration rows plus one sign-in line (the `HEAD` shape), or keep the
  four-row layout but make row 1 two rows carrying `?type=enterprise` and
  `?type=vocationalTraining` and rows 3-4 a sentence under sign-in.
- **Where:** `portal-content.ts:60-83`,
  `src/components/landing/portal/PortalDeclare.tsx:33-48`,
  `portal-views.test.tsx:40-59`.
- **Contains:** the question "which kind of establishment are you?", which is
  currently asked nowhere on the public site.
- **Depends on:** an owner decision on the layout. The *behaviour* (carry
  `?type=`, one door not four) is already decided in
  `docs/plans/landing-portal.md` and needs no new decision.

### K-3. Put the approval step in the public journey and FAQ — **1 d** — CRITICAL
- **Build:** a fifth step in `PORTAL_JOURNEY`, or a re-cut four: *register →
  **ONEFOP validates your file** → sign in → complete → submit*. Correct
  `faq2Answer` (drop the email-verification claim, which is not a gate; add
  the approval, which is). Add one FAQ: "Combien de temps l'inscription
  prend-elle ?" — answerable only once the ministry states a target.
- **Where:** `portal-content.ts:45`,
  `src/components/landing/portal/PortalJourney.tsx`, `messages/fr.json` and
  `messages/en.json` under `portalPage`.
- **Contains:** the one fact that decides whether a declarant arriving a week
  before a deadline can file at all.
- **Depends on:** a ministry answer on the expected turnaround. Ship the step
  itself without a duration if that answer is not ready — stating the step is
  most of the value.

### K-4. Give the entry pages a way back — **0.5 d**
- **Build:** make the lockup a `<Link href="/">` in `BrandLockup` (behind a
  prop so `/home`'s non-navigational uses are unaffected), and add a
  "← Retour au site" link to `LandingShell`'s header.
- **Where:** `src/components/brand/BrandLockup.tsx:28-48`,
  `src/components/landing/LandingShell.tsx:33-44`,
  `src/components/auth/AuthHeader.tsx:23-28`.
- **Depends on:** nothing.

### K-5. Explain the redirect instead of performing it silently — **1 d**
- **Build:** have `useRequireAuth` redirect to `/login?from=<path>` and have
  `/login` render a notice for a known `from` — "Cette page demande une
  connexion. Pas encore inscrit ? Inscrire un établissement →". One hook, one
  notice, two message keys.
- **Where:** `src/lib/use-require-auth.ts:31-34`, the duplicate at
  `src/app/onefop/preview/page.tsx:43-55`, and `src/app/login/page.tsx`.
- **Note:** the two hooks are duplicates whose own comments say to reconcile
  them "once both slices have landed". They have landed. Merging them is part
  of this item, not a separate refactor.
- **Depends on:** K-4 for consistency of the entry-page chrome.

### K-6. Make the masthead adapt to signed-in state — **1.5 d**
- **Build:** a small client component that reads the auth store and renders
  either "Se connecter" or the account's email plus "Mon espace" → `/home`.
  Must be hydration-safe — use the existing `useIsClient` pattern
  (`src/lib/use-is-client.ts`), already used for exactly this in both
  layouts, so the server render does not disagree.
- **Where:** new `src/components/landing/portal/PortalAccountAction.tsx`,
  used by `PortalMasthead`.
- **Depends on:** K-1 (same slot).

### K-7. "Not yet registered? Start here" on the entry page — **0.5 d**
- **Build:** a labelled split on `/declarer`: a "Première déclaration"
  heading over the registration rows, a "Déjà inscrit" heading over sign-in.
  Rules, not cards (CLAUDE.md §8).
- **Where:** `PortalDeclare.tsx`, plus four message keys.
- **Depends on:** K-2, which decides what the rows are.

### K-8. Restore the authority and receipt statements — **0.25 d**
- **Build:** either render `<PortalNotices />` again on `/declarer` or move
  it to `/` — and remove the dead import either way.
- **Where:** `src/app/(portal)/declarer/page.tsx:4`.
- **Depends on:** an owner decision on where the statements belong, which the
  removal implies was being reconsidered.

### K-9. Rename the "Déclarer" tab — **0.25 d**
- **Build:** rename to something the page can honour — "Comment déclarer" /
  "How to declare", or "Commencer" / "Get started".
- **Where:** `portalPage.navDeclare` in both message files.
- **Depends on:** nothing. Pure copy.

### K-10. Publish the assisted-registration path — **1 d**
- **Build:** a paragraph on `/assistance` stating that an establishment
  unable to register itself may be registered by an ONEFOP officer, and how
  to ask (the WhatsApp number). Plus a short staff runbook.
- **Where:** `PortalSupport.tsx` + message keys; new
  `docs/standards/assisted-registration.md`.
- **Depends on:** a ministry decision on whether to offer this publicly
  (J3) — the capability exists either way.

### K-11. Decide the public information architecture — **3-5 d**
- **Build:** the proposal already on the table in
  `docs/plans/landing-portal.md` §Open: `/` carries the chooser,
  `/programme` merges `/a-propos` and `/feuille-de-route`, `/assistance`
  keeps its slot, `/declarer` redirects. Masthead: **LE PROGRAMME ·
  ASSISTANCE · [Se connecter]**.
- **Where:** the `(portal)` route group; a `redirects()` block in
  `next.config.ts` for `/declarer`, `/a-propos` and `/feuille-de-route`.
- **Depends on:** an owner decision. Explicitly "Not yet decided."

### K-12. Server-side route gating — **2 d**
- **Build:** a `middleware.ts` that redirects unauthenticated requests for
  `/home/*`, `/onefop/*` and `/admin/*` before the page renders.
- **Caveat:** the JWT currently lives in browser storage, not a cookie
  (CLAUDE.md §15), so middleware cannot see it. This item is **blocked** on
  the httpOnly-cookie migration §15 reserves for security review, and must
  not be attempted as a side effect of this work.

### K-13. A branded 404 — **0.5 d**
- **Build:** `src/app/not-found.tsx` with the portal chrome and links to `/`,
  `/declarer`, `/assistance`.

## K6. Deferrable past the pilot

- K-6 (auth-aware masthead) — nice, not load-bearing once K-1 restores a
  sign-in link.
- K-11 (IA restructure) — the current five routes work; this is a quality
  improvement that needs an owner decision and would churn URLs mid-pilot.
- K-12 (middleware) — blocked on an auth-architecture change that must not be
  rushed.
- K-13 (404 page).
- A named oversight body on `/a-propos` — needs ministry input, not code.

## K7. Critical before the pilot

- **K-1** — sign-in must be reachable from the home page.
- **K-2** — the establishment-kind question must be asked somewhere, and
  `?type=` must survive.
- **K-3** — the approval step must be public before a declarant plans around
  a deadline.
- **K-5** — an unregistered visitor who hits a protected route must be told
  what to do.
- **K-8** — the authority statement is the page's legal backbone; it should
  not be on no page during a pilot.

Total for the critical set: **about 3 developer-days.**

---

# Part L — Recommendations for unregistered declarants

## L1. Website content

1. **Say the approval step out loud**, on `/` and on the entry page. "Votre
   inscription est validée par un agent de l'ONEFOP avant votre première
   déclaration." One sentence; it changes what a declarant plans around.
2. **Add the explicit invitation**: "Vous n'êtes pas encore inscrit ?
   Inscrivez votre établissement" as a labelled group heading, not as the
   implicit meaning of button order.
3. **Name what to have ready, per kind**, next to the button that applies:
   NIU and CNPS number for an employer; accreditation reference, NIU and CNPS
   number for a training centre. `declarePanelHint` says this in one
   undifferentiated sentence today and omits CNPS entirely, which is a
   required field.
4. **State a turnaround, once the ministry gives one.** "Généralement sous
   N jours ouvrés." Until then say the step exists without a number rather
   than omitting the step.
5. **Fix `faq2Answer`:** email verification is not a gate; approval is.
6. **Fix the hyphen.** "CAM-LEAP" in `portalPage.eyebrow` and
   `portalPage.lede` contradicts `docs/standards/brand.md`.

## L2. Routing

- **Do not add a "Start your first declaration" route.** It would be a third
  signpost to the same place and would reintroduce the task-named-tab
  problem. Make `/declarer` carry the distinction instead (K-7).
- **Restore `?type=`** (K-2). Two typed entry points, not one bare one.
- **Put sign-in in the masthead** (K-1). That is the right place for the
  register/sign-in distinction: register is a page-level action for people
  doing something once, sign-in is persistent chrome for people returning.
- **Add `redirects()`** before any route is renamed — principle 8 of the
  plan, and currently unimplemented.

## L3. Communication at the entry point

Yes — make it explicit. Two labelled groups on `/declarer`:

- **Première déclaration** — "Inscrivez votre établissement. Un agent de
  l'ONEFOP valide votre dossier, puis vous pouvez déclarer." Then the two
  typed registration rows.
- **Déjà inscrit** — "Connectez-vous pour reprendre un brouillon, consulter
  vos déclarations ou télécharger un récépissé." Then one sign-in button.

That is the same information as today's four buttons, with the ambiguity
removed and the approval step included.

## L4. Operational

1. **The assisted path is undocumented** (J2). Write the runbook: who may
   use it, when, how the temporary password is conveyed, and what the officer
   tells the company to do next. One page in `docs/`.
2. **Credential delivery is manual and unlogged.** The temporary password is
   shown once on screen and must be relayed by phone or WhatsApp. For a pilot
   that is workable; it should be a conscious decision, not a gap.
3. **The approval notification depends on e-mail**, which this deployment has
   not delivered reliably. Either verify the sender domain before the pilot
   or tell pending declarants in the app to check back — the
   `/home/inscription-en-attente` page is the natural place, and it already
   exists.
4. **Decide the self-service / assisted policy.** Nothing in the code states
   when each is used. Staff will invent one otherwise.

## L5. Legal and policy questions to escalate

1. **The NIU-less establishment.** An informal or newly created employer
   cannot complete `/register` (NIU and CNPS both required), yet the server
   supports a synthetic NIU and two entity types already use it. If such
   establishments are within scope for the pilot, someone must decide whether
   to relax the client requirement, route them to assisted registration, or
   exclude them. **Flagged for MINEFOP.** This is a change to what the
   registration requires and therefore falls under CLAUDE.md §21.
2. **Whether declaring is legally obligatory.**
   `docs/plans/landing-portal.md` records that "Obligatoire" was deliberately
   left off the employer route because the laws cited in the repo (Loi
   N° 2020/010, Loi N° 91/023) concern statistical secrecy, not an obligation
   to declare. If an obligation exists, the ministry should supply the
   instrument so the tag can return as "Déclaration obligatoire (arrêté
   n° …)" — more use to an employer than the bare word.
3. **Whether an obliged declarant may be blocked by approval.** If a company
   is legally required to declare by a date and an officer has not yet
   approved its registration, who bears that? The platform currently has no
   provisional-declaration mechanism and no documented escalation.
4. **Whether the vocational-training collection is genuinely open.**
   `docs/plans/landing-portal.md` ends with: "Phase 1 is described as in
   service for **both** dispositifs. Confirm the vocational-training side is
   genuinely open to the public before that ships." That confirmation is not
   recorded anywhere, and the public copy makes the claim.

---

# Part M — Documentation

## M1. Does documentation of the intended architecture exist?

**Yes, and it is unusually good.** `docs/plans/landing-portal.md` (477
lines) is a genuine architecture record for this exact question. It contains:

- **§CAMLEAP is two things** — the platform vs. the programme, and why the
  site must be both.
- **§Who the front door is for** — five audiences, what each must be able to
  do in sixty seconds, and what each must not be made to do. The audit
  prompt's four audiences map onto audiences 1-4; the doc adds a fifth (the
  public and researchers) and states it is not served yet.
- **§What follows from that** — eight numbered principles, including "sign-in
  is reachable from everywhere" and "a published permalink is not deleted,
  only redirected".
- **§What the portal offers** — a table of every permitted front-door action,
  with the rule that an action not in the table does not go on the page
  without a reason written there first.
- **§Decisions (resolved)**, **§Claims removed in the truth pass**,
  **§File layout**, **§Tests**, **§Open**, **§Constraints**.

Supporting: `docs/standards/brand.md` (CAMLEAP vs ONEFOP usage),
`docs/standards/ui-grammar.md` (the admin class vocabulary), `CLAUDE.md` §4
(LMIS vs Observatory), §8 (UX principles), §14 (authorization), §15 (JWT
storage), §21 (what needs human approval).

## M2. Does the implementation match?

Partly, and the document **already says where it does not**. §Open lists
five gaps, four of which this audit independently confirms:

| Doc's §Open claim | Verified |
|---|---|
| "'Who are you' is not asked on `/`" (principle 2) | ✅ It is on `/declarer`, and since C3 nowhere at all |
| "Two institutional destinations, not one" (principle 3) | ✅ `/a-propos` + `/feuille-de-route`, two of four tabs |
| "Support holds a masthead slot — satisfied" | ✅ Still satisfied |
| "If `/declarer` goes, it redirects" (principle 8) | ⚠️ No `redirects()` exists in `next.config.ts` for anything |
| "`PORTAL_ACTIONS` sends registration to a bare `/register`… in the working tree, not yet committed" | ✅ Exactly so — C3 |

Divergences the document does **not** yet record:

1. **Sign-in has left the masthead** (C1). The doc's §File layout still
   describes `PortalMasthead.tsx` as "lockup, route tabs, **sign-in**, locale
   switch", and principle 6 requires it. This is the most serious divergence
   and is newer than the document.
2. **`PortalNotices` is rendered on no page** (C4). §File layout lists it as
   "where a declaration counts as filed".
3. **`PortalDialog` is dead code.** §File layout lists it as "native
   `<dialog>` for the pathway details"; the pathway dialogs went with
   `PORTAL_REGISTRATIONS`.
4. **`PortalJourney` lost its per-step descriptions and its CTA.**
   §File layout describes it as "register → sign in → complete → submit",
   which is still true of the titles.
5. **The approval gate is in no document.** Neither
   `docs/plans/landing-portal.md` nor any public copy treats
   `PENDING_APPROVAL` as a step in the declarant's journey, although
   `auth.service.ts:708` and `active-company.guard.ts:49-57` make it one.
   This is the largest conceptual gap in the documentation, not just in the
   UI.
6. **§Tests says 16 tests**; the file has 16 `test(` calls, so that is
   current — but the Declare test was rewritten to assert the four-action
   shape, which means the regression in C3 is now protected by a test rather
   than caught by one.

## M3. Recommendation

Do not write a new document — **update the one that exists**, and add one
thing it lacks.

**Update `docs/plans/landing-portal.md`:** record the sign-in removal (or
revert it), the `PortalNotices` removal, and `PortalDialog`'s death, each
with its reason, so a later agent does not read them as oversights. Per
CLAUDE.md §21's closing instruction, decisions belong in the section
concerned.

**Add the missing document:** a declarant-lifecycle record — the states a
company passes through (`PENDING_APPROVAL` → `ACTIVE` /
`COMPLEMENTS_REQUESTED` / `REJECTED`), which guard enforces each, what the
declarant can do in each, what the public site must therefore say, and the
assisted path as an alternative entry. `docs/standards/` is the right home.
That document would have caught C2 before the pilot.

---

# Final Assessment

## N1. Is CAMLEAP ready to pilot as a public-facing website with an integrated portal?

**Nearly — the structure is ready, two defects are not.**

What is genuinely ready: five public routes, fully bilingual (172 portal keys
in each language, zero divergence), that explain the programme without a
login and have been through a documented truth pass removing unsupportable
claims. A real portal-entry route, not a dialog. A 6-step self-service
registration. A working declarant area with history and receipts. A
19-page staff console. 664 unit tests, all passing. Server-side authorization
that holds: every controller is guarded, and the one public endpoint is
deliberately and narrowly so.

What is not ready: a visitor on the home page cannot sign in (C1), and the
public site does not disclose the approval step that stands between
registering and declaring (C2). Both are small fixes. Neither is acceptable
in a pilot.

## N2. Is the app ready to serve unregistered declarants?

**No.**

The public site *is* clear that registration comes first — the hero, the
entry page, the FAQ and the journey all say so. But it is clear about the
wrong number of steps.

**The single biggest gap: the public site never says that an ONEFOP officer
must approve a registration before the first declaration can be filed.**
Registration lands on `PENDING_APPROVAL` (`src/auth/auth.service.ts:708`),
and `ActiveCompanyGuard` refuses every declaration route until the status is
`ACTIVE` (`src/auth/active-company.guard.ts:49-57`). A company reads
"inscrivez-vous, connectez-vous, déclarez", does the first two, and finds it
cannot do the third — learning why only on the registration receipt, after
the form is submitted.

## N3. If a pilot launched tomorrow, could unregistered companies file?

**They could register. Most could not file in the same sitting, and some
would get stuck.**

- A company with a NIU and a CNPS number can complete registration — about
  13 steps, six wizard sections, two clicks from the home page.
- It would then be blocked until an officer approves, with no stated
  turnaround and a notification that depends on e-mail delivery this
  deployment has not made reliable.
- A company without a NIU or a CNPS number **cannot complete registration at
  all**, and the public site offers it no alternative — even though the
  server supports a synthetic NIU and staff-assisted registration exists at
  `/admin/inscriptions/nouvelle`.
- A returning company that lands on `/` rather than on `/declarer` has no
  sign-in link to click.
- Anyone who follows a bookmark or a circular straight to `/home` or
  `/onefop/preview` is bounced to a sign-in form with no explanation.

## N4. Minimum set of changes for a two-week launch

**Ship (about 3 developer-days of work, well inside two weeks):**

1. **K-1 — restore the masthead sign-in** (0.25 d). Reverting one hunk of
   `PortalMasthead.tsx`.
2. **K-2 — one door, not four; `?type=` restored** (0.5 d). Decide the
   layout, then `portal-content.ts` + `PortalDeclare.tsx` + its test.
3. **K-3 — the approval step in the public journey and FAQ** (1 d). Ship the
   step even without a stated turnaround.
4. **K-5 — explain the redirect** (1 d). `/login?from=…` plus a notice that
   names registration, and merge the two duplicate auth hooks while there.
5. **K-7 — "Première déclaration" / "Déjà inscrit" labels on `/declarer`**
   (0.5 d).
6. **K-8 — restore the authority statement** (0.25 d), and drop the dead
   import.
7. **K-9 — rename the "Déclarer" tab** (0.25 d).
8. **Operational, not code:** decide whether a NIU-less establishment is in
   scope (L5.1); verify the e-mail sender domain or tell pending declarants
   to check back; write the one-page assisted-registration runbook (K-10).

**Defer:** the IA restructure to `/programme` (K-11) — it needs an owner
decision and churns URLs mid-pilot; the auth-aware masthead (K-6);
server-side middleware (K-12), which is blocked on the httpOnly-cookie
migration CLAUDE.md §15 reserves for security review and must not be rushed;
a branded 404 (K-13); naming the oversight body on `/a-propos`.

## N5. Executive summary

CAMLEAP's public website and declarant portal are further along than a
pilot-readiness review usually finds: there are five public pages explaining
the programme, its mandate under ONEFOP and MINEFOP, and its four phases with
the state each is actually in — fully available in French and English without
signing in, and already vetted to remove claims the platform cannot keep. A
company can register itself through a six-step form, and once its file is
approved it can complete, save, validate and submit its declaration and
retrieve its official acknowledgement, while ONEFOP staff review submissions
in a nineteen-page internal console. Authorization is enforced on the server,
and no declaration can be filed anonymously. Two things must be corrected
before the pilot opens, and both are small. First, the public site does not
mention that an ONEFOP officer must approve a registration before the first
declaration can be filed — so a company planning around a collection deadline
is told it needs three steps when it needs four, and discovers the fourth
only after submitting its registration. Second, an uncommitted change has
removed the "Sign in" button from the site's header, leaving a returning
declarant or a ministry officer with no way in from the home page. Together
with four smaller fixes — chiefly telling an establishment which documents it
needs, and separating "I am new here" from "I already have an account" —
these amount to roughly three days of work. Two operational questions need a
decision from the ministry rather than from the engineering team: how quickly
registrations will be approved, and what an establishment without a taxpayer
number or an accreditation reference should do, since the current form cannot
accept one.
