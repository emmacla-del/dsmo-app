# Auth flow mockup 3: Review-first dossier

> Proposal only. Nothing here is implemented. Written 2026-10-07 from a
> read-only audit of the auth journey.

**Thesis:** registration is one dossier page, not a sequence of screens.
Five sections stack in the 600px frame:

1. Type
2. Déclarant
3. Informations
4. Localisation
5. Sécurité

Only the section being worked on is open. Every finished section collapses
to a one-line summary with "Modifier". Because the whole dossier is always
visible in summary form, the separate review step disappears: certification
and `Envoyer` close the page. Login becomes a quiet entry page for the
dossier, and the receipt is the same dossier, locked and stamped.

This is direction F from the brief.

> **Read this first.** The repository has already been here once and
> backed out. `src/components/auth/CollapsedSection.tsx` (unused today)
> and the `.section-collapsed*` / `.wizard-section.is-collapsed` rules in
> `globals.css` (about lines 1512–1590) are left over from a "six-section
> single page" layout. That layout was replaced by the current
> one-frame/one-section model, apparently because finished sections still
> cost scrolling. This mockup only makes sense if it answers that: finished
> sections collapse to **one line**, and there is still **one scroll
> container**. It is offered because it is the biggest structural
> alternative, not because it is the safest one.

---

## Scope markers

| Change | Login only | Register only | Shared `.cam-auth-page` (also forgot-password, verify-email, reset-password) | Whole flow |
|---|---|---|---|---|
| Wizard → accordion dossier, 5 sections + closing block | | **yes** | | |
| Review step removed; `RegistrationReview` tables move into the receipt and a "Voir tout" expander | | **yes** | | |
| Horizontal rail replaced by a compact section index ("2 / 5 sections complètes") | | **yes** | | |
| Login restyled to the frame metrics; create-account becomes a peer action | **yes** | | | |
| Shared control metrics and emblem removal | | | **yes** | |
| Receipt = locked dossier + stamp | | **yes** | | |

---

## What changes structurally

- **Six steps become five sections plus a closing block.** The "review"
  step id still exists in `REGISTRATION_STEP_IDS`. Its UI becomes the
  closing block at the end of the dossier: the honour notice,
  certification and `Envoyer`.
  - Completeness logic (`isSectionComplete`), required-field derivation
    (`missingRequiredFields`) and the four error triggers keep working per
    section.
  - `current` becomes "the open section".
  - `reached` becomes "the furthest section that may be opened". This is
    the same two-cursor model as today, displayed differently.
- **The rail goes.** At the top of the frame there is a single line:
  "Inscription — 2 sur 5 sections complètes", with a thin progress bar.
  The collapsed section rows are the navigation, and each one is a
  full-width button.
- **Auto-advance is replaced by auto-collapse.** When a section becomes
  complete and the respondent presses `Continuer` (or chooses a type in
  section 1), the section collapses to its summary and the next one opens
  directly underneath, in the same scroll position. The jump between
  screens disappears, and with it the "frame swaps under the cursor"
  problem. See the findings on the phone2 auto-advance.
- **Login and register diverge in layout but share metrics.** Login stays
  a short form in the shell from mockup 1. Its distinctive change is a
  two-option entry: `Se connecter` (primary) and "Première déclaration —
  Créer le dossier de votre établissement" (a secondary, full-width
  outline button of the same height). New respondents are the majority
  during a campaign and should not have to find a 13px footer link.
- **The receipt is the dossier, locked.** It shows the same collapsed rows
  without "Modifier", a stamp block at the top (identifier, status, date),
  and the full `RegistrationReview` tables available under "Voir le
  détail".

## What changes visually

- **Collapsed row:** a single line containing a check badge, the section
  name at 14px semibold, a summary at 13px muted (truncated) and
  "Modifier". There are no borders between rows except one hairline. No
  cards. The CSS for this already exists as `.section-collapsed*`.
- **Open section:** the current wizard step header and fields, unchanged,
  including the 560px container-query side-by-side labels.
- **Type scale:** as in mockup 1. One h1 for the dossier ("Inscription de
  votre établissement"), h2 per section.
- **Colour:** completed rows get a green check, the open section has a
  gold left rule (reusing the "current" gold), and locked rows are muted
  text.
- **Chrome:** the mockup 1 shell (stripe + identity bar). No rail.

---

## The four hard cases

### 1. Login

The title "Connexion", two fields, remember / forgot, the green
`Se connecter`, then a divider and the outline button "Première
déclaration ? Créer le dossier de votre établissement". Everything is
above the fold at every target viewport.

### 2. The tallest register step (section 3)

- Above it are two collapsed rows, about 44px each.
- Below it are two locked rows ("Localisation", "Sécurité") and the locked
  closing block, all one line each.
- Section 3's fields scroll inside the single frame scroller, as today.
  The difference is that what comes next stays visible as a short list,
  rather than being numbers on a rail.
- `Continuer` sits at the end of section 3, not pinned. The pinned
  missing-fields notice stays pinned. As a variant, `Continuer` can be
  pinned as in mockup 1.

### 3. The review step

The review step disappears. Once sections 1–5 are complete, they are all
collapsed, so the page is:

- 5 summary rows (about 220px);
- "Voir le détail complet", which expands the four tables for anyone who
  wants them;
- the honour notice;
- the certification;
- `Envoyer`.

The CTA is above the fold at 1280×720. Today it is about 1,000–1,300px
down.

### 4. The success receipt

The same frame. At the top:

- the stamp: "✓ Demande envoyée", the identifier with `Copier`, the status
  and the date;
- the five rows, locked;
- "Voir le détail";
- primary `Se connecter`, which pre-fills the identifier;
- secondary "Télécharger l'attestation" when `attestationUrl` is present.

---

## Vertical space

- There is no empty frame on short sections: the frame ends where the
  dossier ends.
- Collapsed rows cost about 44px each. By section 5, the four rows above
  it take about 180px. At 1366×680 (about 529px of frame) this leaves
  about 350px for the open section. Section 5 needs about 255px without
  its title, so it fits.
- The worst case is going back to section 3 from the closing block: two
  rows above, two below, and section 3's full height in between. The
  scroller handles it. `scrollIntoView({block: "start"})` on open keeps
  the open section's heading at the top.
- Phone (390×844): the progress line is about 36px, compared with about
  71px for the caption and rail today.

## Navigation clarity

- Strongest for "what have I said?". Every answer is one glance away in
  its row summary.
- Weakest for "how many steps are left?". "2 sur 5" plus the visible
  locked rows replaces the six circles.
- Back-navigation is local: tap the row. Returning forward is also local:
  the next unfinished row is visible right there. The "Revenir à l'étape
  N" problem disappears.
- Browser Back is still not a step-back. With an accordion, that matches
  expectations better than with full-screen steps.

## Login → register transition

The shell, metrics and title size are the same, and the first section of
the dossier is open. It is continuous on all viewports. It is less
dramatic than mockup 2's panel, but simpler.

## Accessibility

- Accordion semantics: each section header is a `<button
  aria-expanded aria-controls>` inside an `<h2>`, which is the WAI-ARIA
  accordion pattern. Locked rows are `aria-disabled` and keep the "why is
  it locked" click (trigger (d)).
- When a section collapses, focus moves to the next section's `<h2>`
  button, and a live region announces "Déclarant terminé. Informations
  ouvertes." Today focus is lost when a section is hidden.
- Tab order follows the visual order: the rows above, the open section's
  fields, then the rows below. The Enter-walk in `handleFormKeyDown` is
  restricted to the open section, which already happens via the
  `offsetParent` filter, because collapsed sections' fields are not
  rendered.
- A summary line is truncated visually, but its full text is in the
  button's accessible name.

## What stays the same

Tokens, palette, endpoints, field set, validation, completeness and
required-field logic, `summaryRows` / `sectionSummary`, the draft, the
entity-type change dialog (now triggered from row 1), the leave dialog,
and the admin-assisted orchestrator.

## Effort

About 10–15 days:

- 3 days for the accordion structure and the open/collapse state replacing
  the frame swap.
- 1 day to adapt the existing collapsed-row styles.
- 2 days to fold the closing block in and remove review.
- 1 day for the receipt.
- 1 day for login.
- 1.5 days for focus and announcements.
- 2–3 days to rewrite most navigation assertions in
  `test-register-layout.mjs`.
- Plus 1–2 days of unit-test updates where tests assume a review step in
  the UI (`register-rail.test.ts` and similar).

## Risk

- **Reverses a past decision.** The single-page-with-collapsed-sections
  model was tried and replaced. The reason should be recovered from git
  history before this is chosen.
- **The official review screen disappears.** If ONEFOP considers the
  explicit recapitulation screen part of the declaration act, this needs
  domain sign-off (CLAUDE.md §21 "official reporting workflows").
- **Draft restore** lands on "the first incomplete section". In an
  accordion that is natural, but `restoredReached` / `firstIncompleteWithin`
  must be re-pointed at "open section".
- **Rail-specific code becomes dead code:** `RegistrationProgress`, the
  rail hint and the rail CSS.

---

## Sketches

### Login: 1280×720

```
████████████████████████ stripe ██████████████████████████████████████████████
  CAM-LEAP · Système national d'information sur le marché du travail
──────────────────────────────────────────────────────────────────────────────
                 ┌──────────────────── 600 ─────────────────────┐
                 │  Connexion                                   │
                 │  Identifiant                                 │
                 │  [ ..................................... ]   │
                 │  Mot de passe                                │
                 │  [ ..................................👁 ]    │
                 │  ☑ Rester connecté      Mot de passe oublié ?│
                 │  [█████████████ Se connecter ████████████]   │
                 │  ─────────────────── ou ──────────────────   │
                 │  [   Première déclaration ? Créer le dossier ]│
                 │                         Identifiant oublié ? │
                 └──────────────────────────────────────────────┘
```

### Login: 390×844

```
 CAM-LEAP · Système nat…
┌──────────────────────────┐
│ Connexion                │
│ [identifiant.........]   │
│ [mot de passe.....👁]    │
│ ☑ Rester connecté        │
│ Mot de passe oublié ?    │
│ [████ Se connecter ████] │
│ ────────── ou ────────── │
│ [ Créer le dossier    ]  │
└──────────────────────────┘
```

### Register section 3: 1280×720

```
                 ┌──────────────────── 600 ─────────────────────┐
                 │ Inscription de votre établissement           │
                 │ 2 sur 5 sections complètes  ▓▓▓▓▓░░░░░░░     │
                 ├──────────────────────────────────────────────┤
                 │ ✓ Type        Entreprise           Modifier ▲│
                 │ ✓ Déclarant   E. Biya · DRH · e@…  Modifier █│
                 │ ▌Informations                               █│
                 │ ▌ IDENTIFICATION                            ││
                 │ ▌     Raison sociale* [..............]      ││
                 │ ▌   Statut juridique* [select       ▾]      ││
                 │ ▌                NIU* [..........]          ▼│
                 ├──────────────────────────────────────────────┤
                 │ 2 champs manquants : NIU, N° CNPS            │
                 └──────────────────────────────────────────────┘
   (below, after scrolling:  🔒 Localisation · 🔒 Sécurité · 🔒 Envoi)
```

### Register section 3: 390×844

```
┌──────────────────────────┐
│ 2 sur 5  ▓▓▓▓░░░░░       │
├──────────────────────────┤
│ ✓ Type  Entreprise   ✎   │
│ ✓ Déclarant E. Biya  ✎   │
│ ▌Informations        ▲   │
│ ▌Raison sociale*     █   │
│ ▌[................]  │   │
│ ▌Statut juridique*   ▼   │
└──────────────────────────┘
```

### Closing block (replaces review): 1280×720

```
                 ┌──────────────────── 600 ─────────────────────┐
                 │ 5 sur 5 sections complètes  ▓▓▓▓▓▓▓▓▓▓▓▓     │
                 ├──────────────────────────────────────────────┤
                 │ ✓ Type          Entreprise           Modifier│
                 │ ✓ Déclarant     E. Biya · DRH        Modifier│
                 │ ✓ Informations  SARL Exemple · NIU…  Modifier│
                 │ ✓ Localisation  Centre · Mfoundi…    Modifier│
                 │ ✓ Sécurité      Mot de passe défini  Modifier│
                 │ ▸ Voir le détail complet                     │
                 │ ▌Déclaration sur l'honneur : …               │
                 │ ☐ Je certifie l'exactitude…                  │
                 │                          [█ Envoyer █] (off) │
                 └──────────────────────────────────────────────┘
```

### Closing block: 390×844

```
┌──────────────────────────┐
│ 5 sur 5 ▓▓▓▓▓▓▓▓▓▓       │
│ ✓ Type  Entreprise   ✎   │
│ ✓ Déclarant  E. Biya ✎   │
│ ✓ Infos  SARL Ex…    ✎   │
│ ✓ Localisation …     ✎   │
│ ✓ Sécurité           ✎   │
│ ▸ Voir le détail         │
│ ☐ Je certifie…           │
│ [██████ Envoyer ██████]  │
└──────────────────────────┘
```

### Receipt: 1280×720

```
                 ┌──────────────────── 600 ─────────────────────┐
                 │ ✓ Demande envoyée — 07/10/2026               │
                 │ Identifiant  CM-2026-000123  [Copier]        │
                 │ Statut       En attente de validation ONEFOP │
                 ├──────────────────────────────────────────────┤
                 │ ✓ Type          Entreprise                   │
                 │ ✓ Déclarant     E. Biya · DRH                │
                 │ ✓ Informations  SARL Exemple                 │
                 │ ✓ Localisation  Centre · Mfoundi             │
                 │ ▸ Voir le détail                             │
                 │ [███ Se connecter ███]  Télécharger l'attest.│
                 └──────────────────────────────────────────────┘
```

### Receipt: 390×844

```
┌──────────────────────────┐
│ ✓ Demande envoyée        │
│ CM-2026-000123 [Copier]  │
│ En attente ONEFOP        │
│ ✓ Type  Entreprise       │
│ ✓ Informations SARL Ex…  │
│ ▸ Voir le détail         │
│ [████ Se connecter ████] │
│ Télécharger l'attestation│
└──────────────────────────┘
```
