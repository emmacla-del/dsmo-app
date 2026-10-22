# CAMLEAP Public Portal & Declarant Workspace: Design Feel, Harmony & Functional Critique

**Document Reference:** `docs/audit/portal-design-critique-2026-10-13.md`  
**Date:** October 13, 2026  
**Auditor:** Senior Product Designer & Design Critic  
**Scope:** Public Portal (`/`, `/a-propos`, `/declarer`, `/feuille-de-route`, `/assistance`), Authentication Flow (`/login`, `/register`, `/forgot-password`, `/verify-email`, `/reset-password`), Edge States (`/404`, Gated Redirects), and Authenticated Declarant Workspace (`/home`, `/home/declarations`, `/onefop/preview`, `/home/inscription-en-attente`).  
**Methodology:** Live browser walkthrough in Chromium across Desktop (1440×900) and Mobile (375×812) viewports in both French (`fr`) and English (`en`), backed by automated DOM style inspections and full-page visual captures (`docs/audit/screenshots/*`).

---

## 1. Executive Summary

CAMLEAP presents the solid structural skeleton of a serious national platform under ONEFOP / MINEFOP, but it currently hovers in an awkward valley between a high-minded public institutional policy brief and a bare-bones administrative back-office. The underlying engineering is robust and the functional flows are cohesive, but the emotional feel vacillates between austere civic dignity and timid, unloved assembly.

* **Biggest Design Strength:** Typographic and palette restraint. The foundational pairing of deep ministerial ink (`#112530`), muted teal-green (`#476c59`), and warm archival cream (`#faf8f5`) establishes an unmistakable sense of Cameroonian administrative authority that completely avoids the cheap neon gradients and disposable SaaS aesthetics common in modern web templates.
* **Biggest Design Weakness:** "Card exhaustion" and structural box-nesting. Key pages—most egregiously `/declarer` and `/assistance`—suffer from severe container proliferation where boxes are nested inside cards which sit inside larger banded containers, leading to visual fatigue, clunky vertical rhythm, and barren, lopsided expanses of empty whitespace.
* **Biggest Opportunity:** Infusing the portal with human, documentary craft. Replacing dry wireframe diagrams with authentic data-rich artifacts—such as a live campaign timeline spine on `/feuille-de-route`, editorial photography of Cameroonian vocational trades on `/a-propos`, and an energetic, statistics-backed declarant dashboard on `/home`—will transform CAMLEAP from a bureaucratic hurdle into an inspiring national institution.

---

## 2. Design Feel Assessment

### 2.1 Cards and Containers

#### Observations
1. **Container Stacking & Nesting (Card-in-a-Card Fatigue):** On `/declarer`, a primary container card wraps an inner accordion checklist card, which precedes an approval notice card, followed by four full-width button rows, followed by two separate white alert boxes with green borders, terminated by a card-footer containing two more action buttons. Below this mega-card, two additional notice cards sit in a mint band. The visitor is subjected to five distinct levels of visual enclosure.
2. **Empty Container Syndrome:** On `/assistance`, the central white card takes up only 45% of the content width on a 1440px desktop display, leaving more than 600px of desolate cream canvas to the right. The card itself contains only two short paragraphs, two buttons, and two nested alert boxes. It looks like an abandoned wireframe placeholder.
3. **Card Uniformity vs. Intentional Hierarchy:** On the home page (`/`), the "Comment ça marche" section deploys four identical cards side-by-side. Each card has the exact same white fill, border radius (`16px`), light border, and internal padding. There is no visual distinction between Step 1 (the initial gate) and Step 4 (final legal submission).
4. **Border Radii Drift:** Container cards on the public portal use `border-radius: 12px` or `16px` (`portal.module.css`), the `/login` auth card uses `border-radius: 10px`, while `/declarer` buttons use `border-radius: 2px` and auth buttons use `border-radius: 6px`.

#### Prescribed Fixes
* **Fix 1.1A (`/declarer`):** Unbox the secondary information. Strip the outer container border from the main section and let the four portal actions sit directly on the subtle background with clear typographic groupings. Move the legal compliance notices ("Dépôt des déclarations", "Accusé de réception") into an editorial two-column footer ribbon rather than isolated cards.
* **Fix 1.1B (`/assistance`):** Replace the single narrow card with a balanced two-column asymmetric layout: Column 1 holds direct contact channels (WhatsApp direct chat, phone hotline, hours of operation), Column 2 displays an interactive accordion of the top 4 triage questions (lost NIU, pending approval, informal sector assistance).
* **Fix 1.1C (Global):** Standardize card tokens to a strict 2-tier system: Tier 1 Interactive Cards (`12px` radius, 1px border, subtle 2px elevation) and Tier 2 Informational Panels (`8px` radius, flat wash background, zero elevation).

---

### 2.2 Composition and Layout

#### Observations
1. **Severe Right-Side Vacancy on Editorial Pages:** `/a-propos` features an expansive hero statement ("Du papier à un observatoire numérique.") with introductory paragraphs and an informational callout card all constrained to a max-width of 640px on the left side of a 1180px container. The right 45% of the viewport is completely empty cream space.
2. **The Hero Transform Panel Lacks Drama:** On the home page (`/`), the right column features a mint-colored panel containing two cards ("01 / PAPIER" pointing down to "02 / NUMÉRIQUE"). While conceptually sound, it occupies 420px of vertical height with approximately 70% dead whitespace around the cards. It feels like an unrendered PowerPoint graphic rather than a centerpiece hero asset.
3. **Monotonous Horizontal Rhythm:** Scrolling down `/a-propos` feels like walking past identical horizontal blocks: Cream Band → White Band → Cream Band → Dark Band. Within the cream and white bands, the layout repeats three-column and four-column text blocks that lack vertical tension, pull quotes, or varying density.

#### Prescribed Fixes
* **Fix 1.2A (`/` Home Hero):** Redesign the hero transform panel into a layered "Living Dossier" graphic. Replace the floating rectangles with an authentic preview artifact showing a stylized DSMO/ONEFOP statistical receipt featuring a real tracking watermark, official ministerial seal badge, and a verified validation stamp.
* **Fix 1.2B (`/a-propos` Hero):** Balance the top section by introducing an institutional mission infographic or high-resolution editorial portrait of Cameroonian vocational apprentices on the right side of the hero text.
* **Fix 1.2C (`/a-propos` Body):** Break the rhythm by making Section 3 ("Du papier à la décision éclairée") an asymmetric timeline grid where Phase 1 and Phase 2 are emphasized as current milestones, while Phases 3 and 4 sit in a structured future-outlook pane.

---

### 2.3 Illustrations, Imagery, and Visual Assets

#### Observations
1. **Absence of Photographic and Human Presence:** Across the entire public portal and authenticated workspace, there is not a single photograph of a person, an enterprise workplace, a vocational training workshop, or Cameroon's economic landscape. For a national labour and employment observatory, this gives the platform an unnervingly cold, abstract feel.
2. **Diagrammatic Stifling:** The paper-to-digital graphic on `/` and `/a-propos` consists only of CSS boxes and unicode down-arrows (`↓`). It fails to evoke the physical reality of transitioning from paper binders and stamp-pads to high-speed digital records.
3. **Icon Inconsistency & Emoji Intrusion:**
   - On `/declarer`, checkboxes inside the checklist are rendered using unicode ballot boxes `☑`.
   - On `/assistance`, the WhatsApp link is rendered as plain text without the official brand mark or an iconography accent.
   - On `/login`, the password toggle uses a simple eye SVG, while accordion indicators on `/declarer` use unicode triangles (`▶`, `▼`).

#### Prescribed Fixes
* **Fix 1.3A (Visual Assets):** Commission or integrate a suite of 3 custom SVG illustrations crafted in a unified woodcut or editorial linework style:
  1. *The National Census Ledger* (representing structured enterprise data)
  2. *The Vocational Forge & Digital Loom* (representing training centres)
  3. *The Statistical Beacon* (representing ONEFOP data intelligence).
* **Fix 1.3B (`/declarer`):** Replace raw unicode ballot boxes (`☑`) in the pre-flight checklist with custom SVG check badges utilizing `--cam-portal-teal-dark`.
* **Fix 1.3C (`/assistance`):** Integrate an official WhatsApp brand pill with verified green accent `#25D366` and an SVG phone handset icon to communicate immediate human contact.

---

### 2.4 Page-Level Design Character

#### Page-by-Page Character Evaluation
* **Home (`/`) — Grade: B+**  
  *Character:* Civic, dignified, clear. The split layout communicates purpose quickly.  
  *Critique:* The right-hand transform graphic lacks craft; the bottom "Comment ça marche" cards feel slightly repetitive.
* **About (`/a-propos`) — Grade: B-**  
  *Character:* Ministerial policy brief. It reads well for civil servants but lacks journalistic or public energy.  
  *Critique:* Lopsided layout on desktop; zero human photography; feels like an annual report converted into HTML.
* **Declarer (`/declarer`) — Grade: C+**  
  *Character:* Bureaucratic intake funnel. It is functionally complete but visually intimidating.  
  *Critique:* Too many warning boxes, stacked elevator buttons, nested cards. It feels like an obstacle course rather than a clear front door.
* **Roadmap (`/feuille-de-route`) — Grade: B**  
  *Character:* Focused mission briefing. The dark ink canvas gives it gravity and technical credibility.  
  *Critique:* Disconnected from the rest of the site's warm palette; looks like a 2×2 card board rather than an authentic chronological journey.
* **Assistance (`/assistance`) — Grade: C**  
  *Character:* Deserted help desk.  
  *Critique:* High ratio of whitespace to content; lacks warmth; offers no hours of service, physical office locations, or triage self-service tools.
* **Login (`/login`) & Register (`/register`) — Grade: B+**  
  *Character:* Administrative, secure, focused.  
  *Critique:* Abrupt loss of the public portal masthead and language toggle; stark transition from warm cream to plain grey-white backdrop.
* **Declarant Dashboard (`/home`) — Grade: C-**  
  *Character:* Empty scaffold.  
  *Critique:* Massive expanse of blank white canvas with a single "Commencer une déclaration" button. Lacks operational pulse, campaign calendar, submission metrics, or welcome onboarding.

---

### 2.5 Interaction and Micro-Motion

#### Observations
1. **Button Hover States:** Primary buttons on the portal (`.cam-button-primary`) transition background color abruptly (from `#476c59` to `#355344`). There is no micro-elevation, subtle shadow expansion, or icon nudge.
2. **Card Interactivity:** Cards on the public portal are completely static. When hovering over the pathway cards on `/declarer` or roadmap cards on `/feuille-de-route`, there is zero visual feedback indicating whether the element is clickable or informative.
3. **Accordion Animation:** The FAQ accordions on `/declarer` snap open and closed instantly with no smooth height transition, creating jarring content reflow.
4. **Auth Loading Splash:** The new `AuthLoadingSplash` component correctly employs the subtle `camleapPulse` animation, providing a calm, reassuring beat during hydration and token verification.

#### Prescribed Fixes
* **Fix 1.5A:** Add smooth CSS transitions to all interactive cards (`transform: translateY(-2px)`, `box-shadow: 0 4px 12px rgba(17, 37, 48, 0.08)` over `160ms cubic-bezier(0.2, 0, 0, 1)`).
* **Fix 1.5B:** Implement smooth CSS grid transitions (`grid-template-rows: 0fr` to `1fr`) on FAQ and pre-flight accordion expandables to eliminate instantaneous layout snaps.

---

### 2.6 Typography as Design

#### Observations
1. **Headline Treatment:** Headlines set in *Inter* are clean and legible, but they lack editorial authority. H1 titles on `/` (`38px`, `font-weight: 700`) feel somewhat generic. There is no serif display face, no custom tracking adjustments, and no pull-quote styling.
2. **Kicker / Overline Discipline:** The kickers (`CAM-LEAP / ONEFOP · MINEFOP`, `PHASE 01 / ONEFOP`, `ÉTAT DU PROJET`) are effective at anchoring context, but they are rendered in small uppercase text with wide letter-spacing (`0.06em`). In French, some overlines feel slightly cramped when combining slashes and bullets.
3. **Monospace Details:** The inclusion of monospace formatting on establishment identifiers (`VT26000103`, `EN26000112`) and the 404 eyebrow (`404`) provides an excellent technical touch that should be extended to campaign cycle labels and reference numbers.

#### Prescribed Fixes
* **Fix 1.6A:** Introduce a refined typographic scale for display headings: tighten letter-spacing on display H1 elements to `-0.025em` to give them a modern, confident, editorial lockup.
* **Fix 1.6B:** Apply monospace styling (`font-family: var(--cam-font-mono)`) to official campaign codes and filing reference keys throughout both public notices and workspace headers.

---

### 2.7 The "Would a Designer Be Proud" Test

If a senior design director from a world-class civic design agency (such as UK GDS, USDS, or Etalab) evaluated CAMLEAP today, their verdict would be:

> *"The design system possesses genuine integrity and exceptional restraint—there are no cheesy animations, no fake stock graphics, and the bilingual typography is disciplined. However, the site feels assembled by an engineer working from wireframe specs rather than crafted by an art director. Pages like About and Assistance are starved of visual storytelling, `/declarer` is cluttered with warning boxes, and the declarant workspace looks like a skeleton screen awaiting content."*

* **Pages that feel designed:**
  * Home (`/`): Strong typography, balanced split hero, clear institutional masthead.
  * Roadmap (`/feuille-de-route`): Confident dark canvas with crisp status chips and refined typographic contrast.
* **Pages that feel assembled:**
  * Assistance (`/assistance`): A single lopsided card on a blank background.
  * Declarer (`/declarer`): A tower of nested warning rectangles and stacked buttons.
  * Declarant Dashboard (`/home`): An empty page with a lone button floating in a sea of white.

---

### 2.8 Confidence and Restraint

* **Confidence:** The portal is confident in its institutional role—it does not apologize for requiring administrative approval, it clearly states anti-fraud guarantees, and it does not use gimmicky marketing tropes. Where it lacks confidence is in visual scale: everything is medium-sized, medium-padded, and polite. It needs larger focal points, richer diagrams, and more assertive layout rhythms.
* **Restraint:** The portal scores a **9/10** on restraint. The palette is strictly bounded to ink, cream, teal, and gold; animations are subtle or nonexistent; and content is written with sober, precise civil service clarity.

---

## 3. Visual Harmony Assessment

### 3.1 Color Harmony
* **The Green Shift:** On public portal routes, the primary green is `--cam-portal-teal` (`#476c59` / `rgb(71, 108, 89)`), leaning heavily toward slate-teal. On authentication pages (`/login`, `/register`) and the workspace, the primary green switches to `--cam-green` (`#1e6b3a` / `rgb(30, 107, 58)`), an emerald forest green. This creates a distinct visual boundary between the public website and the declarant tools.
* **Dark Surface Parity:** The footer and the roadmap canvas share the exact same deep ink value (`--cam-ink` / `#112530`), maintaining solid ground harmony.
* **Contrast Compliance:** All text on cream (`#faf8f5`), white (`#ffffff`), and dark ink (`#112530`) exceeds WCAG AA standards (contrast ratios > 7:1 for body copy).

### 3.2 Typography Harmony
* All pages consistently load *Inter* with fallbacks to system sans-serif.
* Section titles on public pages consistently render at `24px`–`28px` with `font-weight: 700`.
* Overlines consistently utilize uppercase lettering with `letter-spacing: 0.05em`.

### 3.3 Spacing and Rhythm
* Public routes use a unified wrapper (`max-width: 1180px`, horizontal padding `24px`).
* Vertical section band padding is consistently set to `56px` (`var(--cam-space-7)`), creating a predictable cadence as the visitor scrolls down pages.

### 3.4 Component Consistency

| Component | Portal Routes (`/`, `/declarer`) | Auth Routes (`/login`, `/register`) | Workspace (`/home`) | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Buttons** | Height 42px, Radius **2px**, Teal `#476c59` | Height 46px, Radius **6px**, Green `#1e6b3a` | Height 38px, Radius **4px**, Green `#1e6b3a` | ⚠️ **Disjointed** (3 different radii) |
| **Cards** | Flat wash or white, Radius **12px/16px** | White, 1px border, Radius **10px**, subtle shadow | Borderless or full-width | ⚠️ Minor radius drift |
| **Language Switcher**| Pill style, Radius **8px**, Black active pill | **Not Present** | Flat bordered pill, Radius **4px** | ⚠️ **Disjointed** (missing on auth) |
| **Notice Boxes** | Mint wash (`#edf4f0`) or red left border | Subtle grey wash with emerald left border | Blue wash with blue left border | ⚠️ 3 different alert styles |

### 3.5 Brand Identity
* **Lockup Consistency:** The institutional lockup (ONEFOP seal + vertical rule + CAMLEAP wordmark + endorsement subtitle) is rendered with pixel-perfect consistency across all public mastheads and auth headers.
* **Favicon and Document Titles:** Every page serves a standardized bilingual title (`Accueil · CAMLEAP`, `Home · CAMLEAP`, etc.).

### 3.6 Cross-Page Feel
* The five public routes (`/`, `/a-propos`, `/declarer`, `/feuille-de-route`, `/assistance`) feel closely related, with the exception of `/feuille-de-route` which switches abruptly to an all-dark ink canvas.
* Transitioning from `/` to `/login` feels like leaving a website and entering an internal terminal: the navigation header and footer vanish entirely, and the background shifts from warm cream to sterile off-white.

### 3.7 Modernity
* The design language represents a clean, modern civic web platform consistent with mature European and North American digital government standards (e.g., DINUM / France.fr, GOV.UK).
* It avoids dated gradients, glossy bevels, and bloated hero carousels.

### 3.8 Bilingual Visual Parity
* 100% message key parity between English and French.
* French copy is approximately 15% longer than English, but flexbox and CSS grid layouts accommodate text expansion without broken line-wraps or button clipping.

---

## 4. Functional Assessment

### 4.1 Layout and Visual Hierarchy
* **Focal Point:** Strongest on `/` (headline and primary CTA are unambiguous). Weakest on `/declarer` (the visitor's eye bounces between four stacked buttons and six warning boxes).
* **Whitespace:** Well-calibrated on `/` and `/feuille-de-route`; excessive and unbalanced on `/a-propos` and `/assistance`.

### 4.2 Buttons and Interactions
* **Primary vs. Secondary:** On `/declarer`, having two primary registration buttons ("Inscrire une entreprise" and "Inscrire un centre de formation") stacked on top of each other diminishes the clarity of the primary action. Grouping them into a segmented pathway chooser would clarify intent.
* **Hover and Focus:** Keyboard focus indicators (`:focus-visible`) are consistently present across interactive buttons, cards, and input fields.

### 4.3 Navigation
* **Global Navigation:** The masthead maintains persistent navigation across all public views with active route indicators (`aria-current="page"`).
* **Wayfinding & Return Links:** Every authentication screen now includes a clearly centered, muted return link (`← Retour au portail CAMLEAP` / `← Back to CAMLEAP Portal`), resolving prior dead-end traps.
* **Session Persistence:** When authenticated, the public masthead correctly swaps the "Se connecter" button for an active workspace link ("Mon Espace Déclarant →").

### 4.4 Information Usefulness
* **Approval Warning:** Prominently stated across `/`, `/declarer`, and `/login`.
* **Assisted Registration:** Clear directions for informal sector and non-NIU entities are present on both `/declarer` and `/assistance`.
* **Holding Screen Data:** The pending approval screen (`/home/inscription-en-attente`) displays the official contact number and instructions, but lacks estimated turnaround times.

### 4.5 Accessibility Signals
* Keyboard tab-navigation flows logically through masthead links, body controls, and footers.
* Skip links (`Aller au contenu` / `Skip to content`) are wired to `#contenu`.
* Color contrast across text and surfaces complies with WCAG AA.

### 4.6 Mobile Responsiveness (375px)
* **Drawer Navigation:** The hamburger menu cleanly reveals all four navigation destinations with full tap targets.
* **Layout Stacking:** Desktop multi-column grids collapse gracefully into single-column vertical stacks.
* **Touch Targets:** All primary buttons maintain a minimum tap height of `44px`.

---

## 5. Page-by-Page Walkthrough Notes

### 5.1 Home (`/`)
* **What I Saw:** A refined institutional landing page featuring a split hero (headline on left, paper-to-digital transform diagram on right), followed by a live status band and a four-step "Comment ça marche" journey.
* **What Works:**
  * Authoritative typographic lockup and crisp national branding.
  * Clear status badge confirming operational Phase 1 deployment.
  * Direct action buttons leading into submission and project discovery.
* **What Doesn't:**
  * The right-hand paper-to-digital transform panel feels sparse and wireframe-like.
  * Four identical white cards in the journey section feel repetitive.
* **Design Feel Notes:** Confident, dignified, but slightly academic. Needs a richer hero artifact.
* **Visual Harmony Notes:** Excellent harmony between cream, mint, and deep ink.
* **Screenshot Description:** Split hero with green CTA button, central white status card with teal border, and 4 horizontal journey cards on warm cream. (`desktop-fr-home.png`)

---

### 5.2 About (`/a-propos`)
* **What I Saw:** An editorial policy narrative explaining CAMLEAP's legal and structural transformation from paper forms to digital data governance, ending in a dark ink roadmap summary.
* **What Works:**
  * Compelling institutional storytelling and clear explanation of ONEFOP's mandate.
  * Dark ink closing band provides dramatic visual contrast.
* **What Doesn't:**
  * Severe right-side whitespace vacancy in the top hero.
  * Text-heavy three-column section lacks visual anchors or diagrams.
* **Design Feel Notes:** Reads like an official whitepaper; lacks civic warmth and human imagery.
* **Visual Harmony Notes:** Good typographic consistency, but suffers from unbalanced layout distribution.
* **Screenshot Description:** Left-heavy editorial text blocks on cream, followed by three text columns and a dark navy closing section. (`desktop-fr-about.png`)

---

### 5.3 Declarer Hub (`/declarer`)
* **What I Saw:** An administrative entry hub intended to route declarants into enterprise registration, vocational centre registration, sign-in, or submission tracking.
* **What Works:**
  * Thorough pre-flight checklist detailing required filing documents.
  * Clear warnings regarding administrative approval requirements.
  * Assisted registration note for entities without a NIU.
* **What Doesn't:**
  * Box-in-a-box fatigue: too many nested borders, alert boxes, and notice cards.
  * Stack of 4 full-width buttons creates an elevator-panel aesthetic.
  * Multiple warning boxes compete for attention.
* **Design Feel Notes:** Tense and bureaucratic. It feels like an interrogation rather than a welcoming portal.
* **Visual Harmony Notes:** Excessive border-radius mixing (2px on buttons vs 12px on cards).
* **Screenshot Description:** A towering white card containing an accordion checklist, alert boxes, and four stacked buttons, followed by two standalone notice cards. (`desktop-fr-declarer.png`)

---

### 5.4 Roadmap (`/feuille-de-route`)
* **What I Saw:** A structured four-phase project roadmap presented on an all-dark ink canvas with filter pills for phase availability.
* **What Works:**
  * Crisp typography with excellent contrast against the dark background.
  * Functional interactive filtering by status (Disponible, En développement, Prévu).
  * Clear visual badges (solid white, amber, outline).
* **What Doesn't:**
  * Total canvas color break from the rest of the public site (100% dark mode).
  * Lacks a connecting chronological spine or visual timeline flow.
* **Design Feel Notes:** Technical, serious, and focused.
* **Visual Harmony Notes:** Feels like a distinct sub-product or developer console rather than part of the public portal.
* **Screenshot Description:** Deep navy page with filter pills at top and a 2×2 grid of bordered cards showing Phases 1 through 4. (`desktop-fr-roadmap.png`)

---

### 5.5 Assistance (`/assistance`)
* **What I Saw:** A minimalist support page displaying official contact channels, a WhatsApp link, and guidance for assisted registration.
* **What Works:**
  * Clear, prominent display of the official telephone/WhatsApp support line.
  * Essential fallback instructions for unregistered entities.
* **What Doesn't:**
  * Severe horizontal imbalance: the content card occupies only the left 45% of the page, leaving 55% of the viewport completely blank.
  * Lacks operating hours, physical regional delegation addresses, and triage FAQ links.
* **Design Feel Notes:** Deserted and minimal; feels like an incomplete stub.
* **Visual Harmony Notes:** Matches portal color tokens but fails on composition and spatial balance.
* **Screenshot Description:** Left-aligned white card with telephone number and buttons floating in an empty expanse of cream. (`desktop-fr-assistance.png`)

---

### 5.6 Login (`/login`)
* **What I Saw:** A focused, centered administrative card supporting standard username/password sign-in and a secondary "Retrouver mon identifiant" tab.
* **What Works:**
  * Flawless contextual notice when redirected from gated routes (`?returnTo=`).
  * Direct recovery workflow for forgotten establishment identifiers.
  * Prominent return link to the public portal (`← Retour au portail CAMLEAP`).
* **What Doesn't:**
  * Complete absence of the public masthead and language switcher.
  * Sharp shift from warm cream portal background to stark white/grey canvas.
* **Design Feel Notes:** Clean, secure, and functional, but isolated from the main website.
* **Visual Harmony Notes:** Button radius shifts to 6px; primary green shifts to forest emerald `#1e6b3a`.
* **Screenshot Description:** Centered white card with two tabs, contextual gated notice, form fields, and return link below. (`desktop-fr-login.png`)

---

### 5.7 Register (`/register`)
* **What I Saw:** A six-step administrative onboarding wizard featuring a persistent left sidebar dossier panel and a main form card.
* **What Works:**
  * Clear step-by-step progress tracking (Type d'entité → Récapitulatif).
  * Direct parameter handling (`?type=enterprise` vs `?type=vocationalTraining`).
  * Confirmation dialog guarding against accidental abandonment when dirty.
* **What Doesn't:**
  * Right side of the desktop screen has significant dead whitespace.
  * Floating dev overlay badge ("N") overlaps the footer return link.
* **Design Feel Notes:** Structured, disciplined, and businesslike.
* **Visual Harmony Notes:** Strong alignment with the administrative design system.
* **Screenshot Description:** Left sidebar showing step list and CAMLEAP lockup; center card showing entity type radio options. (`desktop-fr-register.png`)

---

### 5.8 Forgot Password (`/forgot-password`)
* **What I Saw:** A clean two-step recovery screen asking for the declarant email, presenting security questions, and enabling password reset.
* **What Works:** Clear step progression, helpful error states, and centered return link.
* **What Doesn't:** No language switcher available if a user arrives via an English link on a French browser.
* **Screenshot Description:** Centered card with email input, submit button, and return link to portal. (`desktop-fr-forgot-password.png`)

---

### 5.9 Verify Email (`/verify-email`)
* **What I Saw:** A token validation receipt showing status badge (Échec / Succès) and return buttons.
* **What Works:** Clean feedback pill, helpful error message for expired tokens, and return link.
* **Screenshot Description:** Centered card with error pill and "Retour à la connexion" action. (`desktop-fr-verify-email.png`)

---

### 5.10 Reset Password (`/reset-password`)
* **What I Saw:** A password reset card with password visibility toggles and validation requirements.
* **What Works:** Good field security indicators and clean layout.
* **Screenshot Description:** Centered card with password and confirmation inputs. (`desktop-fr-reset-password.png`)

---

### 5.11 Branded 404 (`/unknown-route`)
* **What I Saw:** A fully branded 404 error page maintaining the public `PortalMasthead` and `PortalFooter`.
* **What Works:**
  * Crisp monospace `404` eyebrow and clear explanatory heading.
  * Two prominent recovery actions ("Retour à l'accueil" and "Espace déclarant").
* **What Doesn't:** The central card could feature a subtle illustration or broken compass icon to soften the error.
* **Screenshot Description:** Masthead and footer framing a centered card with green 404 eyebrow and two action buttons. (`desktop-fr-not-found.png`)

---

### 5.12 Declarant Dashboard (`/home`)
* **What I Saw:** An authenticated workspace shell with a left navigation rail and a main content area.
* **What Works:** Role-aware navigation rail, user identity display, and instant declaration button.
* **What Doesn't:**
  * The main canvas is 90% empty white space.
  * Contains only a generic "Bienvenue" heading and a single button.
  * Zero dashboard utility: no submission metrics, no campaign deadlines, no recent activity.
* **Design Feel Notes:** Feels like an unpopulated development stub rather than an operational dashboard.
* **Screenshot Description:** Left rail showing user email and nav items; vast empty white main area with a lone green button. (`desktop-fr-home-workspace.png`)

---

### 5.13 Declarations History (`/home/declarations`)
* **What I Saw:** The submission archive screen for authenticated declarants.
* **What Works:** Integrates with the home shell layout.
* **What Doesn't:** When empty, displays a plain text message rather than an encouraging empty-state illustration explaining how to file a first declaration.
* **Screenshot Description:** Standard workspace shell with table/empty state. (`desktop-fr-home-declarations.png`)

---

### 5.14 Questionnaire Wizard (`/onefop/preview`)
* **What I Saw:** The comprehensive ONEFOP teledeclaration questionnaire wizard.
* **What Works:**
  * Structured multi-section progression with save-and-resume capability.
  * Excellent coherence checks and validation indicators.
  * BrandLockup and campaign identification in the sticky header.
* **What Doesn't:** High visual density in statistical grid tables can be overwhelming on laptop screens.
* **Screenshot Description:** Dedicated wizard interface with progress tracker and statistical entry fields. (`desktop-fr-onefop-wizard.png`)

---

### 5.15 Pending Approval Screen (`/home/inscription-en-attente`)
* **What I Saw:** The holding screen presented to registered declarants whose accounts are awaiting ONEFOP administrative validation.
* **What Works:**
  * Reassuring explanation of the review process with official support hotline.
* **What Doesn't:**
  * Displays two redundant "Se déconnecter" buttons (one in the rail, one in the main body).
  * Still displays the "Nouvelle déclaration" button in the rail even though the account is locked.
  * No estimated SLA or turnaround time window.
* **Screenshot Description:** Workspace shell with a blue alert box explaining pending review and two sign-out buttons. (`desktop-fr-pending-approval.png`)

---

## 6. Findings Against Earlier Review Items

| Review Item | Status | Visual Quality | Notes & Observations |
| :--- | :--- | :--- | :--- |
| **Header Sign-in Link** | **Present** | ⭐⭐⭐⭐ (High) | Displays "Se connecter" when anonymous; dynamically transforms into "Mon Espace Déclarant →" when authenticated. |
| **Approval Warning** | **Present** | ⭐⭐⭐⭐ (High) | Prominently stated in hero copy, `/declarer` alert boxes, and FAQ entries. |
| **Pathway Pre-selection** | **Present** | ⭐⭐⭐⭐ (High) | Buttons on `/declarer` directly target `/register?type=enterprise` and `/register?type=vocationalTraining`. |
| **Deep-linking After Login** | **Present** | ⭐⭐⭐⭐⭐ (Excellent)| Gated routes correctly redirect to `/login?returnTo=<encoded>` with full open-redirect guards. |
| **Login Contextual Notice** | **Present** | ⭐⭐⭐⭐⭐ (Excellent)| Emerald-bordered notice box renders cleanly above login tabs when `returnTo` is detected. |
| **404 Page** | **Present** | ⭐⭐⭐⭐ (High) | Branded error screen sharing `PortalMasthead`, `PortalFooter`, and recovery buttons. |
| **Return Links on Auth Pages** | **Present** | ⭐⭐⭐⭐ (High) | Muted centered link (`← Retour au portail CAMLEAP`) present on `/login`, `/register`, `/forgot-password`, `/verify-email`, `/reset-password`. |
| **Assisted Registration Note** | **Present** | ⭐⭐⭐⭐ (High) | Clearly visible in dedicated alert boxes on both `/declarer` and `/assistance`. |
| **Holding Screen Information**| **Present** | ⭐⭐⭐ (Fair) | Explains review process and provides telephone contact; lacks SLA turnaround timeline and has duplicate sign-out buttons. |
| **Pre-flight Checklist** | **Present** | ⭐⭐⭐ (Fair) | Clean accordion with document list; suffers from nested card-in-a-card styling. |
| **Notices Rendering** | **Present** | ⭐⭐⭐⭐ (High) | Legal guarantees and official PDF receipt notices rendered with anti-fraud statements. |

---

## 7. Priority-Ranked Fixes

### Scale
* **Priority 1–2:** Fix before pilot launch (critical visual polish, hierarchy, or usability).
* **Priority 3–4:** Fix after pilot launch (deeper editorial and asset enhancements).
* **Priority 5:** Nice to have (long-term aesthetic refinements).

---

### Priority 1–2: Fix Before Pilot

#### A. Design Feel Fixes
1. **[P1] Eliminate Card-in-a-Card Clutter on `/declarer`:**
   * *Issue:* The five-tier nested card structure creates severe visual fatigue and looks like an unstyled wireframe.
   * *Fix:* Remove the outer card enclosure. Turn the pre-flight checklist into a clean, borderless list. Group the two registration actions ("Entreprise" vs "Centre de formation") into a unified, two-up segmented selection card.
2. **[P2] Rebalance Layout and Eliminate Dead Whitespace on `/assistance`:**
   * *Issue:* The desktop layout leaves 55% of the viewport completely blank.
   * *Fix:* Implement a two-column layout: Column 1 holds direct contact channels (phone, WhatsApp, hours of operation); Column 2 features a clean triage accordion for common blockers.
3. **[P2] Replace Generic Home Hero Graphic with an Authentic Artifact:**
   * *Issue:* The mint-colored box with two floating rectangles on `/` looks like an unfinished placeholder.
   * *Fix:* Replace the boxes with a stylized "Official Digital Receipt" preview artifact featuring a ministerial seal badge, tracking number, and security watermark.

#### B. Visual Harmony Fixes
4. **[P1] Harmonize Button Border Radii and Greens Across Public & Auth Portals:**
   * *Issue:* Button radii drift randomly between 2px (portal), 4px (rail), 6px (auth), and 8px (language toggle); green shifts between teal `#476c59` and forest `#1e6b3a`.
   * *Fix:* Standardize all primary buttons across the entire application to `border-radius: 6px` and unify the primary brand green token to a single canonical hue.
5. **[P2] Remove Duplicate Sign-Out Action on `/home/inscription-en-attente`:**
   * *Issue:* The pending approval screen renders two "Se déconnecter" buttons within 200px of each other.
   * *Fix:* Remove the redundant inline button and hide the inactive "Nouvelle déclaration" CTA in the rail for pending accounts.

#### C. Functional Fixes
6. **[P2] Add Language Switcher to Auth Pages (`/login`, `/register`, etc.):**
   * *Issue:* Once a user clicks "Se connecter", the language toggle disappears. If an anglophone user lands on `/login`, they cannot switch to English without navigating back.
   * *Fix:* Add the `LocaleSwitcher` component to the `AuthHeader` or header utility bar across all auth pages.
7. **[P2] Smooth Out FAQ Accordion Expand/Collapse Transitions:**
   * *Issue:* FAQ questions on `/declarer` snap instantly, causing jarring layout shifts.
   * *Fix:* Apply CSS grid smooth height animations to accordions.

---

### Priority 3–4: Fix After Pilot
8. **[P3] Populate Declarant Dashboard (`/home`) with Live Operational Pulse:**
   * Transform the empty white screen into a functional dashboard: Active Campaign Countdown, Filing Status Widget, and Quick Links.
9. **[P3] Integrate Chronological Timeline Spine on `/feuille-de-route`:**
   * Replace the static 2×2 card grid with an interconnected vertical timeline spine connecting Phase 1 through Phase 4.
10. **[P4] Introduce Human Photography on `/a-propos`:**
    * Add high-quality photography documenting Cameroonian technical trades and vocational workshops.

---

### Priority 5: Nice to Have
11. **[P5] Micro-Interactions on Interactive Cards:**
    * Add subtle lift and shadow expansion on hover for roadmap and journey cards.
12. **[P5] Illustrated Empty States:**
    * Replace plain text messages in declaration history with custom linework illustrations.

---

## 8. Honest Counterweight: What CAMLEAP Does Exceptionally Well

1. **Ministerial Authority Without Bureaucratic Clutter:** The aesthetic avoids both generic commercial SaaS gloss and ugly legacy government tables. It feels sober, official, and trustworthy.
2. **Exemplary Typographic Hierarchy:** Across all pages, headings, overlines, kickers, and body text follow strict mathematical proportions with zero awkward line wraps.
3. **Flawless Bilingual Parity:** English and French experiences are completely equal in polish, layout stability, and structural detail.
4. **Resolute Palette Discipline:** The strict bounding of colors to deep ink, archival cream, teal-green, and subtle gold gives CAMLEAP a distinct institutional signature.
5. **Rock-Solid Route Gating and Recovery:** Deep-linking (`?returnTo=`), contextual login notices, and pervasive return links provide a bulletproof safety net against user confusion.
6. **Purposeful Monospace Utility:** Monospace accents on identifiers (`VT26000103`), tax numbers, and status codes anchor the platform in technical precision.
7. **Hydration-Safe Brand Loading:** The `AuthLoadingSplash` provides a smooth, flicker-free bridge during client authentication checks.

---

## 9. Recommended Next Steps

1. **Review and Socialize Audit:** Present this report to the ONEFOP / MINEFOP product steering committee to align on visual priorities before pilot deployment.
2. **Execute Priority 1–2 Polish Sprint:** Implement the 7 critical fixes (button radius unification, unboxing `/declarer`, rebalancing `/assistance`, and adding language switcher to auth pages).
3. **Conduct Post-Sprint Visual Regression Audit:** Re-run the automated Playwright visual suite across desktop and mobile to ensure 100% aesthetic harmony prior to launch.
