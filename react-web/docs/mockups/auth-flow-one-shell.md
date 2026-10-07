# Auth flow mockup 1: One Shell

> Proposal only. Nothing here is implemented. Written 2026-10-07 from a
> read-only audit of `/login`, `/register`, `/verify-email`,
> `/forgot-password` and the register success receipt.

**Thesis:** login, register and the receipt are three states of one page.
They share one shell: the same top bar, the same 600px reading measure, the
same field metrics and the same green button. The wizard keeps its 6 steps
and its rail. What changes is that each screen gets one real primary action,
and the frame is only as tall as its content.

This is directions A and B from the brief, combined.

---

## Scope markers

| Change | Login only | Register only | Shared `.cam-auth-page` (also forgot-password, verify-email, reset-password) | Whole flow |
|---|---|---|---|---|
| Shell: full-bleed stripe + one-line identity bar | | | **yes** | |
| 600px measure on every auth surface | | | **yes** (`.wrap` 380 → measure 600, form column ≤ 400) | |
| One control metric: 40px, 1.5px grey border at rest, 14px label | | | **yes** (wizard metrics promoted to shared) | |
| Frame sized to content, `max-height` = what is left of the viewport | | **yes** | | |
| Continue as a green primary button in a frame footer | | **yes** | | |
| Remove emblem placeholder + note | | | **yes** | |
| Receipt rendered in the shell, not in `.wrap-wide` | | **yes** | | |
| Login: create-account promoted from card footer to a second row under the button | **yes** | | | |

---

## What changes structurally

- **One shell for every auth route.** The page is a column of: a 4px stripe,
  an identity bar (`CAM-LEAP · Système national d'information sur le marché
  du travail`, on one line), the body, and a one-line footer. Login,
  forgot-password, verify-email, reset-password, register and the receipt
  all use it. Today the wizard alone has this structure
  (`.cam-auth-page--wizard`). The other pages use a centred card under a big
  masthead.
- **Login and register share chrome, not layout.** Login stays a short
  single form. It just sits in the same shell, at the same measure.
- **The wizard stays at 6 steps, and the rail survives.** The rail moves out
  of the header and into the top of the frame, so the identity bar is the
  same on every route.
- **The frame stops filling the viewport.** Today `.flow-frame` stretches to
  fill `.flow-body` whatever the step's height. With
  `align-self: flex-start; max-height: 100%`, steps 1, 4 and 5 end where
  their content ends, and steps 3 and 6 still scroll inside the frame's one
  scroll container.
- **Each wizard screen gets one primary action.** A frame footer, outside
  `.flow-frame-scroll` and next to the existing `.flow-missing-notice`,
  holds a green `Continuer` button on steps 1–5 and `Envoyer` on step 6.
  The `aria-disabled`-but-clickable behaviour stays, and auto-advance stays
  for steps 1 and 5. This is still not a Suivant/Retour pair, because the
  rail remains the way back.
- **The receipt is the 7th state of the frame.** It keeps the shell and the
  identity bar. The rail is replaced by a single "Inscription envoyée" line.

## What changes visually

- **Type scale:** one ladder across the flow.
  - Page title: `--cam-step-title-size` (20px) on every surface. The login
    title becomes "Connexion" at 20px, and the 25px wordmark goes.
  - Labels: 14px.
  - Controls: 15px, or 16px at ≤ 640px. Login gets this too, which ends the
    iOS zoom on login.
- **Spacing:** the wizard's rhythm everywhere. That is a 16px row gap,
  `--cam-step-header-space-after` under titles, and 20/22px frame padding.
- **Fields:** the wizard's control (40px, 8px radius, grey at rest, green on
  focus) becomes the shared control. Login's 44px inputs with a green
  border at rest go.
- **Colour:** unchanged palette. Green means "action" or "focus" only.
  Login's green resting borders and the receipt's 2px green card frame go,
  leaving one 1.5px green frame per screen.
- **Panels:** one frame per screen. No card inside the frame, and no card
  footer with a grey fill.
- **Chrome:** the emblem placeholder and its note are removed from every
  route. They are a reminder for the team, not information for respondents.

---

## The four hard cases

### 1. Login

Above the fold at 1280×720, inside the 600 frame, in this order:

1. The title "Connexion" and a one-line subtitle.
2. The identifier and password fields.
3. "Rester connecté" and "Mot de passe oublié ?" on one row.
4. The green `Se connecter` button. This is the primary action.
5. A second row: "Première déclaration ? **Créer le compte de votre
   établissement →**", as a text link at body size rather than 13px muted
   footer text.

"Retrouver mon identifiant" stops being a tab. It becomes a link beside
"Mot de passe oublié ?", so the two "I forgot" paths sit together. Its pane
is unchanged and opens in the same frame.

### 2. The tallest register step (step 3, up to 17 fields)

- The frame takes the full height that is left (max-height), and only
  `.flow-frame-scroll` scrolls.
- The frame footer is always visible, holding `Continuer` and the
  missing-fields notice, so the CTA is never below the fold. Today the
  continue link sits at the end of roughly 1,350px of content, which is
  about 2.6 frame-heights down.
- Group headings (`.admin-section-header`) stay. Their top margin drops
  from 24px to 16px, because the grid's 16px row gap already separates
  them.

### 3. The review step with a full table

- The same four `table-official` blocks, with "Modifier" per block.
- The certification checkbox and `Envoyer` move into the frame footer, so
  they stay visible while the respondent reads. The button stays disabled
  until the box is ticked, as today.
- The honour notice stays directly above the footer.

### 4. The success receipt

- It is rendered in the same shell and frame (600, not 640) with no second
  masthead and a single 20px title. The title follows the status:
  "Demande envoyée" when pending, "Inscription réussie" when active.
- The identifier keeps its mono treatment and gains a `Copier` button,
  reusing login's forgot-ID pattern.
- The next step is a single primary action. "Se connecter" goes to
  `/login?identifier=<email>`, which pre-fills the identifier, or uses a
  sessionStorage handoff if a query parameter is unwanted. There is a
  secondary "Télécharger l'attestation" link when `attestationUrl` is
  present. `attestationUrl` is already returned and stored today but never
  rendered.
- The duplicated card-footer "Retour à la connexion" link is removed.
- On mount, focus moves to the receipt title, so the success is announced.

---

## Vertical space

Estimates come from the CSS. They were not measured in a browser.

| Surface @1280×720 | Today | One Shell |
|---|---|---|
| Login, chrome above the first field | about 290px: 48 page pad, about 188 masthead, about 57 card top and tabs | about 120px: 4 stripe, about 44 bar, 24 body pad, about 49 title |
| Login, total height | about 718px (document scrolls about 38px at 1366×680) | about 480px (fits at 680) |
| Register step 1, empty frame below content | about 120px of empty green-bordered box | 0, because the frame ends with its content |
| Register step 5, empty frame | about 200px | 0 |
| Register step 3, CTA position | at the end of about 1,350px of scroll | pinned in the frame footer |
| Receipt | a separate 640 layout with masthead, about 700px tall | in the shell at 600, about 520px tall |

The rail moving into the frame costs the frame about 8px. Removing the
masthead's subtitle line from the header gives back about 30px.

---

## Navigation clarity

- One green button per screen, which is CLAUDE.md §11. Today wizard steps
  1–5 have no green primary at all.
- The rail stays the only way back. When the respondent has gone back
  (`current < reached`), the footer button reads "Revenir à l'étape N →"
  and returns to the frontier. Today there is no forward control in that
  state, and the respondent has to find the right circle.
- The submit error banner clears when the respondent reaches the failing
  section and the failing field gets `aria-invalid`. This aligns submit
  with the other four error triggers.

## Login → register transition

The same bar, measure, title size and field metrics are used on both
pages, so the only visible change is that the rail appears. Today the page
jumps from a 380px centred card with a 25px wordmark to a full-height
600px frame with the wordmark hidden.

## Accessibility

- Each surface gets exactly one `<h1>`: the page title on login, the step
  title in the wizard (`StepHeader` becomes h1 because the wordmark is no
  longer a heading), and the receipt title. Today the wizard has no h1 at
  all.
- On every step change, focus moves to the step `<h1>` (`tabIndex=-1`) via
  `requestAnimationFrame` after the section becomes visible. Today focus
  stays on a field inside a section that has just been `hidden`, so it
  falls to `<body>`.
- A visually hidden live region announces "Étape 3 sur 6 — Informations"
  at every width. Today the caption is `display:none` above 560px, so
  nothing is announced on desktop.
- The rail container gets `role="group"` or becomes a `<nav>`, so its
  `aria-label` is exposed.
- Login gets a `role="alert"` error box. The login tabs disappear, which
  removes the missing tab semantics.
- Keyboard: the footer button joins the Tab order after the last field. The
  Enter-walk is unchanged.

## What stays the same

Tokens, palette, endpoints, field set, validation rules, completeness and
rail logic (`register-rail.ts`, `register-completeness.ts`), draft
persistence, the entity-type change dialog, the leave dialog, and the
admin-assisted registration orchestrator. That orchestrator does not use
`.cam-auth-page`, so it is untouched.

## Effort

About 4–6 days:

- About 1.5 days to consolidate the shell CSS and update the forgot, verify
  and reset pages.
- 1 day to restyle login.
- 1 day for the frame-fit and footer action.
- 0.5 day for the receipt.
- 1 day for focus, announcement and h1.
- About 1 day to update `test-register-layout.mjs` and add login and
  receipt viewports.

## Risk

- Shared rules change on forgot-password, verify-email and reset-password.
  All three need a visual pass.
- `test-register-layout.mjs` asserts the current geometry. The frame no
  longer fills the body, and the footer is new. The single-scroll-container,
  `FRAME_MAX_WIDTH = 600` and `FIELD_HEIGHT = 40` assertions still hold.
  Assertions that read the continue link (`.flow-continue-link`) need
  updating.
- Promoting the 40px control to shared changes the height of the 2FA code
  field and the forgot-ID fields. That is intended.

---

## Sketches

### Login: 1280×720

```
████████████████████████ tricolor stripe (full bleed) ████████████████████████
  CAM-LEAP · Système national d'information sur le marché du travail
──────────────────────────────────────────────────────────────────────────────

                 ┌──────────────────── 600 ─────────────────────┐
                 │  Connexion                                   │
                 │  Accédez à l'espace de votre établissement   │
                 │                                              │
                 │  Identifiant                                 │
                 │  [ email ou identifiant ............... ]    │
                 │  Mot de passe                                │
                 │  [ •••••••••••• ...................  👁 ]   │
                 │  ☑ Rester connecté        Mot de passe oublié│
                 │                       Identifiant oublié ?   │
                 │  [██████████ Se connecter ██████████]        │
                 │                                              │
                 │  Première déclaration ?                      │
                 │  Créer le compte de votre établissement →    │
                 └──────────────────────────────────────────────┘
              Besoin d'aide ? WhatsApp
```

### Login: 390×844

```
██████████ stripe ██████████
 CAM-LEAP · Système nat…
────────────────────────────
┌──────────────────────────┐
│ Connexion                │
│ Accédez à l'espace…      │
│ Identifiant              │
│ [....................]   │
│ Mot de passe             │
│ [.................👁]    │
│ ☑ Rester connecté        │
│ Mot de passe oublié ?    │
│ Identifiant oublié ?     │
│ [████ Se connecter ████] │
│ Première déclaration ?   │
│ Créer un compte →        │
└──────────────────────────┘
 Besoin d'aide ? WhatsApp
```

### Register step 3: 1280×720

```
████████████████████████ stripe ██████████████████████████████████████████████
  CAM-LEAP · Système national d'information sur le marché du travail
──────────────────────────────────────────────────────────────────────────────
                 ┌──────────────────── 600 ─────────────────────┐
                 │ (✓)──(✓)──(3)──( 4 )──( 5 )──( 6 )           │
                 │ Type  Décl. Infos Local. Sécu. Récap.        │
                 ├──────────────────────────────────────────────┤
                 │ Entreprise                          ▲ scroll │
                 │ Renseignez les informations…        █        │
                 │ IDENTIFICATION                      █        │
                 │      Raison sociale* [............] │        │
                 │    Statut juridique* [select     ▾] │        │
                 │                 NIU* [..........]   │        │
                 │      N° CNPS* [..........]          ▼        │
                 ├──────────────────────────────────────────────┤
                 │ 2 champs manquants : NIU, N° CNPS            │
                 │                         [█ Continuer → █]    │
                 └──────────────────────────────────────────────┘
          Déjà inscrit ? Se connecter · Besoin d'aide ? WhatsApp
```

### Register step 3: 390×844

```
██████████ stripe ██████████
 CAM-LEAP · Système nat…
────────────────────────────
┌──────────────────────────┐
│ Étape 3 sur 6 — Infos    │
│ ✓──✓──③──④──⑤──⑥        │
├──────────────────────────┤
│ Entreprise           ▲   │
│ IDENTIFICATION       █   │
│ Raison sociale*      │   │
│ [..................] │   │
│ Statut juridique*    │   │
│ [select          ▾]  ▼   │
├──────────────────────────┤
│ [█████ Continuer → ████] │
└──────────────────────────┘
 Se connecter · Aide
```

### Review: 1280×720

```
                 ┌──────────────────── 600 ─────────────────────┐
                 │ (✓)──(✓)──(✓)──(✓)──(✓)──(6)                 │
                 ├──────────────────────────────────────────────┤
                 │ Récapitulatif                          ▲     │
                 │ 1. DÉCLARANT                [Modifier] █     │
                 │ ┌──────────────┬───────────────────┐   │     │
                 │ │ Nom          │ Emmanuel B.       │   │     │
                 │ │ Fonction     │ DRH               │   │     │
                 │ └──────────────┴───────────────────┘   ▼     │
                 ├──────────────────────────────────────────────┤
                 │ ☐ Je certifie l'exactitude…                  │
                 │                         [█ Envoyer █] (off)  │
                 └──────────────────────────────────────────────┘
```

### Review: 390×844

```
┌──────────────────────────┐
│ Étape 6 sur 6 — Récap.   │
│ ✓──✓──✓──✓──✓──⑥        │
├──────────────────────────┤
│ 1. DÉCLARANT  [Modifier] │
│ Nom                      │
│ Emmanuel B.              │
│ Fonction                 │
│ DRH                  ▼   │
├──────────────────────────┤
│ ☐ Je certifie…           │
│ [██████ Envoyer ██████]  │
└──────────────────────────┘
```

At ≤ 560px the two-column table becomes stacked label/value pairs. Today
the 38% label column wraps badly at 390px.

### Receipt: 1280×720

```
████████████████████████ stripe ██████████████████████████████████████████████
  CAM-LEAP · Système national d'information sur le marché du travail
──────────────────────────────────────────────────────────────────────────────
                 ┌──────────────────── 600 ─────────────────────┐
                 │ ✓ Demande envoyée                            │
                 │ Accusé de réception — en attente ONEFOP      │
                 │                                              │
                 │ Établissement     SARL Exemple               │
                 │ Type              Entreprise                 │
                 │ Identifiant       [CM-2026-000123] [Copier]  │
                 │ Déclarant         E. Biya (e@ex.cm)          │
                 │ Statut            En attente de validation   │
                 │                                              │
                 │ [███ Se connecter ███]  Télécharger l'attest.│
                 └──────────────────────────────────────────────┘
```

### Receipt: 390×844

```
┌──────────────────────────┐
│ ✓ Demande envoyée        │
│ En attente ONEFOP        │
│ Établissement            │
│ SARL Exemple             │
│ Identifiant              │
│ CM-2026-000123 [Copier]  │
│ Statut                   │
│ En attente de validation │
│ [████ Se connecter ████] │
│ Télécharger l'attestation│
└──────────────────────────┘
```
