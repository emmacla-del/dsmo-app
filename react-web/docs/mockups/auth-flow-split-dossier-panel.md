# Auth flow mockup 2: Split screen with a persistent dossier panel

> Proposal only. Nothing here is implemented. Written 2026-10-07 from a
> read-only audit of the auth journey.

**Thesis:** on desktop, the left third of the screen is a persistent
context panel, and its content changes with the journey:

- On login, it says who must declare, and it holds the "create an account"
  entry point.
- In the wizard, it becomes the dossier: a vertical rail where every
  completed step shows its own summary lines.
- On the receipt, it holds the identifier and what happens next.

The form stays on the right, in its 600px reading measure. On phones the
panel collapses into a top bar and a "Mon dossier" sheet.

This is directions C and D from the brief, combined. The panel is used on
all three surfaces, not only as a brand panel.

---

## Scope markers

| Change | Login only | Register only | Shared `.cam-auth-page` (also forgot-password, verify-email, reset-password) | Whole flow |
|---|---|---|---|---|
| Two-column shell (panel 360–400px + 600 form column) at ≥ 1100px | | | **yes**: forgot, verify and reset get the panel in its "brand" state | |
| Panel "brand" content (who declares, help, create account) | **yes** | | (reused, read-only, on forgot, verify and reset) | |
| Vertical rail with per-step summaries, replacing the horizontal rail | | **yes** | | |
| Review step slimmed: certification + submit + honour notice, tables kept but collapsible | | **yes** | | |
| Receipt panel: identifier, copy, next steps | | **yes** | | |
| Phone: top bar + "Mon dossier" bottom sheet | | **yes** | | |
| Remove emblem placeholder; the panel carries the institutional identity | | | **yes** | |

---

## What changes structurally

- **Login and register share one shell,** and the panel is the thing that
  continues across the transition. On login, its lower half is a "Première
  déclaration ?" block with a secondary button. Clicking it keeps the panel
  in place while the panel animates into the dossier rail, and the right
  column swaps to step 1. The panel makes the transition continuous.
- **The wizard stays at 6 steps.** The horizontal 6-circle rail is
  replaced by a vertical list in the panel, one row per step:
  - circle and name;
  - for completed steps, 1–3 summary lines, from `sectionSummary`, which
    today only feeds the rail's `title` tooltip;
  - a "Modifier" affordance.
  `RegistrationProgress` keeps its states (`done`, `current`,
  `currentComplete`, `revealed`, `locked`) and its `aria-disabled` locked
  behaviour. Only the layout changes.
- **The review step stays but gets lighter.** The respondent has watched
  the dossier fill up in the panel, so step 6 leads with the honour notice,
  the certification checkbox and `Envoyer`. The four summary tables follow
  as an expandable "Voir le détail complet". The tables are not removed,
  because they are the official recapitulation.
- **The receipt** keeps the panel. The panel shows the identifier, a copy
  button, the status and the "what happens next" list. The right column
  shows the confirmation and the next action.
- **One scroll container per column.** The right column's frame scrolls.
  The panel does not scroll: it truncates its summaries to one line per step
  at heights under 760px. This keeps the single-scrollbar rule on the form
  side. The panel must never become a second scroller, per CLAUDE.md §13
  ("sidebar must not create competing internal scroll systems").

## What changes visually

- **Panel:** a `--cam-surface-subtle` background with a 4px tricolor rule
  on its left edge, no border, and no shadow. The respondent sees it as
  page structure, not as a card. Panel type:
  - wordmark at 20px;
  - body text at 14px;
  - summary lines at 13px muted;
  - step names at 14px semibold.
- **Form column:** the wizard's current control metrics everywhere. Login
  moves from 44px controls with green resting borders to the 40px grey
  control. There is one 20px title per screen.
- **Spacing:** the form column uses the wizard rhythm (16px rows). The
  panel uses 24px blocks.
- **Colour:** green stays reserved for done, action and focus. The current
  step's gold ring carries over to the vertical rail.
- **Chrome:** no top header bar on desktop. The panel is the identity. The
  full-bleed stripe becomes the panel's edge rule.

---

## The four hard cases

### 1. Login

- **Panel, left:**
  - "CAM-LEAP", with the one-line system name.
  - "Qui doit déclarer ?", in 2–3 short lines.
  - A "Première déclaration ?" block with a `Créer un compte` secondary
    button.
  - The help line.
- **Form column, right:** the title "Connexion", the identifier and
  password fields, the remember-me / forgot row, and the full-width green
  `Se connecter` button, which is the primary action. Everything is above
  the fold at 1280×720 and at 1366×680.
- **Phone:** the panel reduces to the identity bar. "Créer un compte"
  becomes a link row under the button.

### 2. The tallest register step (step 3)

- **Panel:** steps 1–2 show their summaries ("Entreprise", "E. Biya · DRH
  · e@ex.cm"). Step 3 is current, and steps 4–6 are locked.
- **Form column:** the frame takes the full height and is the only
  scroller. The pinned bottom bar holds the missing-fields notice and the
  `Continuer` primary button.
- **Width:** the form column is still 600px, so the 560px container query
  and the side-by-side labels are unchanged.

### 3. The review step

- The certification and `Envoyer` are at the top, under a two-line
  instruction. They are not below about 1,000px of tables, as they are
  today.
- "Voir le détail complet" expands the four `table-official` blocks inside
  the same frame scroller.
- The panel already shows every section's summary with its "Modifier"
  links.

### 4. The success receipt

- **Panel:** the identifier in large mono type with `Copier`, the status,
  and "Prochaines étapes": 1. validation ONEFOP, 2. you receive an email,
  3. sign in to declare.
- **Form column:** "Demande envoyée", plus a primary `Se connecter`, which
  pre-fills the identifier, and a secondary "Télécharger l'attestation"
  when `attestationUrl` exists.
- Focus moves to the confirmation heading.

---

## Vertical space

These are estimates from the CSS.

- **Desktop:** the header row disappears, and the rail and identity move
  into the side panel. The frame gains about 104px of height at 1280×720:
  from about 527px of usable scroll height to about 630px.
- **Empty frame on short steps:** these steps are now offset by the panel.
  The page has content on both sides instead of one tall half-empty box.
  The frame can still be sized to content, as in mockup 1.
- **Phone (390×844):** the top bar shows "Étape 3 sur 6 — Informations"
  and a `Mon dossier ▾` button, about 52px. That is less than today's
  header with the caption and the rail, about 108px. The 6-circle rail is
  removed on phones: the step caption does that job, and the dossier sheet
  provides the jump-back.

## Navigation clarity

- The vertical list makes "where am I / what is done / what is left"
  readable without tooltips. Today, completed-step summaries are only in
  `title` attributes, which are invisible on touch and to most screen
  reader users.
- "Modifier" is on every completed step, always visible. Going back and
  returning is two clicks in the same place.
- When `current < reached`, a "Reprendre à l'étape N" row is pinned at the
  top of the panel.

## Login → register transition

This is the most continuous of the three mockups. The panel stays and
changes its content, and the form column changes. On phones it is no
better than mockup 1.

## Accessibility

- The panel is `<nav aria-label="Étapes de l'inscription">` containing an
  `<ol>`. Each step is a `<button>` with `aria-current="step"` on the
  current one. The accessible name is "Informations — terminé : Entreprise,
  SARL Exemple", so the summary becomes part of the name rather than a
  tooltip.
- Focus order: identity → skip link → form column. The skip link ("Aller
  au formulaire") is needed, because the panel precedes the form in the
  DOM and contains up to 6 buttons.
- On a step change, focus goes to the step `<h1>` and a live region
  announces the step. This must be fixed whatever the direction; see
  findings.
- The "Mon dossier" sheet on phones is a modal dialog. It needs a focus
  trap, Escape to close, and focus returned to its trigger. The existing
  `.leave-dialog` has none of these today, so there is no ready pattern to
  reuse.

## What stays the same

Tokens, palette, endpoints, the field set, validation, completeness logic,
rail state logic, `summaryRows` / `sectionSummary` (they gain a second
consumer), the draft, and both dialogs. The admin-assisted orchestrator is
untouched.

## Effort

About 8–12 days:

- 2 days for the shell, plus the panel in its brand state for forgot,
  verify and reset.
- 2 days for the vertical dossier rail.
- 1.5 days for the review restructure.
- 1 day for the receipt panel.
- 2 days for the phone top bar and the sheet, including the dialog focus
  pattern.
- 1 day for focus and announcements.
- 1.5–2 days to rewrite the rail and header sections of
  `test-register-layout.mjs`.

## Risk

- The biggest risk is height at 1366×680: six steps with three summary
  lines each will not fit, so truncation rules must be strict. A panel that
  scrolls would break the one-scroller rule.
- Between 1100px and about 1000px, two columns (about 400 + 600 + gutters)
  do not fit. The shell needs a middle state: tablet behaves like phone.
- The layout test's header and rail assertions are rewritten. The frame
  width (600) and field height (40) assertions still hold.
- Putting certification above the tables changes what "review" means in
  the official flow. The honour declaration would be certified before the
  detail is read. This needs product/domain sign-off. The tables can stay
  on top if that is preferred, which costs back the CTA position.

---

## Sketches

### Login: 1280×720

```
┃█┃ CAM-LEAP                     │
┃█┃ Système national d'info…     │     Connexion
┃█┃                              │     Accédez à l'espace de votre établissement
┃ ┃ Qui doit déclarer ?          │
┃ ┃ Toute entreprise, ONG, CTD,  │     Identifiant
┃ ┃ administration ou CFP qui    │     [ email ou identifiant ............... ]
┃ ┃ emploie du personnel…        │     Mot de passe
┃ ┃                              │     [ •••••••••••• .....................👁 ]
┃ ┃ ─────────────────────────    │     ☑ Rester connecté    Mot de passe oublié ?
┃ ┃ Première déclaration ?       │                          Identifiant oublié ?
┃ ┃ [  Créer un compte  →  ]     │     [██████████ Se connecter ██████████████]
┃ ┃                              │
┃ ┃ Besoin d'aide ? WhatsApp     │
 └──── panel 380 ────────────────┘└──────────── form column 600 ─────────────┘
```

### Login: 390×844

```
██████████ stripe ██████████
 CAM-LEAP · Système nat…
────────────────────────────
 Connexion
 Identifiant
 [......................]
 Mot de passe
 [...................👁]
 ☑ Rester connecté
 Mot de passe oublié ?
 [█████ Se connecter ████]
 ──────────────────────────
 Première déclaration ?
 Créer un compte →
```

### Register step 3: 1280×720

```
┃█┃ CAM-LEAP · Inscription       │ ┌──────────────────── 600 ─────────────────┐
┃ ┃                              │ │ Entreprise                        ▲      │
┃ ┃ (✓) Type de structure        │ │ Renseignez les informations…      █      │
┃ ┃     Entreprise    Modifier   │ │ IDENTIFICATION                    █      │
┃ ┃ (✓) Déclarant                │ │      Raison sociale* [..........] │      │
┃ ┃     E. Biya · DRH  Modifier  │ │    Statut juridique* [select   ▾] │      │
┃ ┃ (3) Informations   ◀ ici     │ │                 NIU* [........]   │      │
┃ ┃ ( 4 ) Localisation  🔒       │ │             N° CNPS* [........]   ▼      │
┃ ┃ ( 5 ) Sécurité      🔒       │ ├──────────────────────────────────────────┤
┃ ┃ ( 6 ) Récapitulatif 🔒       │ │ 2 champs manquants      [█ Continuer █]  │
┃ ┃ Se connecter · Aide          │ └──────────────────────────────────────────┘
```

### Register step 3: 390×844

```
██████████ stripe ██████████
 Étape 3 sur 6 — Infos  [Mon dossier ▾]
────────────────────────────
┌──────────────────────────┐
│ Entreprise           ▲   │
│ IDENTIFICATION       █   │
│ Raison sociale*      │   │
│ [..................] │   │
│ Statut juridique*    ▼   │
├──────────────────────────┤
│ [█████ Continuer → ████] │
└──────────────────────────┘
```

### Review: 1280×720

```
┃ ┃ (✓) Type   Entreprise        │ ┌──────────────────────────────────────────┐
┃ ┃ (✓) Déclarant E. Biya…       │ │ Récapitulatif et envoi                   │
┃ ┃ (✓) Informations SARL Ex…    │ │ ▌Déclaration sur l'honneur : …           │
┃ ┃ (✓) Localisation Centre…     │ │ ☐ Je certifie l'exactitude…              │
┃ ┃ (✓) Sécurité ••••            │ │ [██████ Envoyer ██████] (off)            │
┃ ┃ (6) Récapitulatif ◀ ici      │ │ ▸ Voir le détail complet (4 sections)    │
┃ ┃                              │ └──────────────────────────────────────────┘
```

### Review: 390×844

```
 Étape 6 sur 6 — Récap. [Mon dossier ▾]
┌──────────────────────────┐
│ Récapitulatif et envoi   │
│ ▌Déclaration sur l'hon…  │
│ ☐ Je certifie…           │
│ [██████ Envoyer ██████]  │
│ ▸ Voir le détail complet │
└──────────────────────────┘
```

### Receipt: 1280×720

```
┃█┃ Identifiant                  │ ┌──────────────────────────────────────────┐
┃ ┃ CM-2026-000123  [Copier]     │ │ ✓ Demande envoyée                        │
┃ ┃ Statut : en attente ONEFOP   │ │ SARL Exemple · Entreprise                │
┃ ┃                              │ │ Déclarant : E. Biya (e@ex.cm)            │
┃ ┃ Prochaines étapes            │ │                                          │
┃ ┃ 1. Validation par l'ONEFOP   │ │ [████ Se connecter ████]                 │
┃ ┃ 2. Email de confirmation     │ │ Télécharger l'attestation                │
┃ ┃ 3. Connexion et déclaration  │ └──────────────────────────────────────────┘
```

### Receipt: 390×844

```
┌──────────────────────────┐
│ ✓ Demande envoyée        │
│ CM-2026-000123 [Copier]  │
│ En attente ONEFOP        │
│ Prochaines étapes        │
│ 1. Validation  2. Email  │
│ 3. Connexion             │
│ [████ Se connecter ████] │
│ Télécharger l'attestation│
└──────────────────────────┘
```
