# CAM-LEAP app tidy audit — 2026-10-06

**Status:** read-only. No application files were changed. No new components are proposed.  
**Surfaces:** registration wizard, declaration / ONEFOP questionnaire, admin console, plus `src/auth`, `src/pilotage`, `src/onefop`, `src/analytics`, `src/data-management`.  
**Tidy means:** which existing token, class, component, name, or wording already in the repo should replace the local variant.

Each violation row: **where → literal/pattern → existing tidy → mechanical or decision**.

---

## Method

| Surface | Paths | Files |
|---|---|---|
| Registration | `react-web/src/app/register/**`, `react-web/src/components/auth/**` | 8 |
| Home / declarations | `react-web/src/app/home/**` | 7 |
| ONEFOP questionnaire | `react-web/src/components/onefop/**`, `modern-jobs/**`, `NewDeclarationDialog.tsx` | 86 |
| Admin | `react-web/src/app/admin/**`, `react-web/src/components/admin/**` | 37 |

Hex/spacing/type literals were extracted by script against `tokens.css`. Unique values are listed with count and first `file:line`. Named CSS colours as style values: none.

---

## Part 1 — Visual tidiness

### 1.1 Colours

Three palettes share one hostname: CAM tokens (`#1e6b3a`, `#0b1f14`, `#d8ddd3`), Tailwind gray (`#111827`, `#6b7280`, `#e5e7eb`), Tailwind slate (`#0f172a`, `#64748b`, `#e2e8f0`). Registration uses tokens. Admin and the questionnaire still paint literals.

| Where | Literal / pattern | Existing tidy | Kind |
|---|---|---|---|
| Admin flag bar, dossier primary, sidebar gradient | `#007a5e` first `AdminSidebar.tsx:210`, `AdminHeaderActions.tsx:218`, `dossiers/page.tsx:605` | `--cam-flag-green` (`#0e5c2b`) or `--cam-green` (`#1e6b3a`) | **Decision** (flag green vs brand green) |
| diffusion, équipe, journal-audit, paramètres | `#006644` / `#005438` / `#004730` first `diffusion/page.tsx:610` | `--cam-green` / `--cam-green-dark` | Mechanical once the decision above is taken |
| établissements, utilisateurs links | `#004d3d` first `etablissement-detail/page.tsx:215` | `--cam-green-dark` | Mechanical |
| FieldControl, VtWizardFields, NumberStepper | `#1B4332` first `FieldControl.tsx:44` | `--cam-green-dark` or `--cam-border-strong` | **Decision** (border vs fill) |
| VT chrome | `#0e4d29` first `VtWizardSectionScreen.tsx:1147`; `#0A6640` `vt-wizard-section-utils.ts:20` | `--cam-green-dark` | Mechanical |
| `home/declarations/page.tsx:84` | `var(--cam-success, #16a34a)` | fallback is Tailwind; token is `#1e6b3a` | Mechanical |
| `home/declarations/page.tsx:85`, `FieldControl.tsx:44` | `var(--cam-error, #dc2626)` / raw `#dc2626` | `--cam-error` `#b3261e` | Mechanical |
| Scope quiz, EventProgress | `var(--cam-green, #1a5c3a)` | `--cam-green` `#1e6b3a` (`#1a5c3a` is `--cam-table-focus`) | Mechanical |
| `ModernJobsWizard.tsx:378` | `var(--cam-bg, #f4f6f5)` | `--cam-bg` `#fafaf7` | Mechanical |
| `home/declarations/page.tsx:447` | `var(--cam-accent-soft, #e8f0fe)` | `--cam-accent-soft` → `--cam-success-bg` `#eaf3ec` | Mechanical |
| `ModernJobsHeader.tsx:239` | `var(--cam-success, #34d399)` | `--cam-success` | Mechanical |
| Scope / facts frames | `var(--cam-text, #1c1f1d)` ×37 | `--cam-text` `#0b1f14` | Mechanical |
| `NewDeclarationDialog.tsx:219` | `var(--cam-border, #e2e8f0)` | `--cam-border` `#d8ddd3` | Mechanical |
| `NewDeclarationDialog.tsx:348–538` | `#2563eb`, `#9333ea`, `#7e22ce`, `#f3e8ff` | `--cam-info` for DSMO; `--vt-accent` for VT | **Decision** (VT currently has no purple token) |
| `OnefopPdfPreviewModal.tsx:271` | `#d9530f`, `#b03e08` | `--cam-warning` / `--cam-gold-dark` | Mechanical |
| `centre-qualite/page.tsx:285` and dossier badges | `#b91c1c` | `--cam-error` | Mechanical |
| `dossiers/page.tsx:624` | `#8b1e1b` reject button | `--cam-error` | Mechanical |
| Dossiers / établissements / utilisateurs body | `#111827` ×97, `#6b7280` ×114, `#e5e7eb` ×56 | `--cam-text`, `--cam-text-muted`, `--cam-border` | Mechanical |
| `KpiTile` CSS `admin-console.css:1938–1950` | `#ffffff`, `#e5e7eb`, `#111827`, `#f59e0b`, `#2563eb`, `#dc2626` | `--cam-surface`, `--cam-border`, `--cam-text`, `--cam-warning`, `--cam-info`, `--cam-error` | Mechanical |
| `DataState.tsx:21–26` | slate `#f8fafc` / `#64748b` / `#b91c1c` | `--cam-surface-subtle`, `--cam-text-muted`, `--cam-error` | Mechanical |
| Admin page backgrounds | `#f8fafc` `centre-qualite:201`, `etablissements:298`, `utilisateurs:191` | `--cam-bg` | Mechanical |

**Volume:** 2,070 hex hits in scoped TSX; 963 outside `tokens.css`. Registration: 0 hex. Unique non-token admin hex: 63. Unique non-token ONEFOP hex: 64.

Full unique-hex catalogues (count + first `file:line`) sit in Appendix A.

### 1.2 Spacing

Token scale: 4 / 8 / 12 / 16 / 24 / 32 / 48. Wizard chrome already tokenises 6, 10, 14, 20, 26.

| Where | Literal | Existing tidy | Kind |
|---|---|---|---|
| `form/FormGrid.tsx:13–15` | `gap=18`, `gapX=20`, `gapY=16` | `ui/FormGrid.tsx` already uses `gap-x-5 gap-y-4` (20/16). Pick one of the two existing FormGrids | **Decision** |
| Filter height 34 `centre-qualite:491` vs 38 `etablissements:419` vs 40 | | `--cam-form-field-height` (40px) | Mechanical |
| Page pad `centre-qualite:201` `"16px 28px 40px"`; `etablissements:298` `"24px 32px"`; `utilisateurs:149` `"32px"` | | `.cam-admin-main` already pads `--cam-space-6` | Mechanical |
| Off-scale 6/10/14/20 used as raw numbers on admin cards | 6×61, 10×58, 14×58, 20×58 admin | `--cam-space-2` (8) / `--cam-space-3` (12) / `--cam-space-4` (16) / `--cam-section-pad` (20) | Mechanical |
| `dossiers/page.tsx:518` | `padding: "7px 10px"` | `--cam-space-2` + `--cam-space-3` | Mechanical |

Off-scale counts (including 0 resets): registration 12, home 63, ONEFOP 579, admin 479.

### 1.3 Typography

Token sizes exist (`--cam-font-size-2xs` = 11px, `xs` = 13, `sm` = 14, `base` = 15, `lg` = 18, `xl` = 24). Almost every screen writes raw 11/12/13/14. **12px has no token.**

| Element | Sizes in use | Existing tidy | Kind |
|---|---|---|---|
| Page `<h1>` | `AdminPageHeader` `1.5rem`; dossiers/[id]:412 `20`; établissement-detail:289 `22`; home declarations:267 `22` | `--cam-font-size-xl` (already on AdminPageHeader) | Mechanical on admin; **decision** for home |
| KPI value | 32/700 inscriptions:572, utilisateurs:233, établissements:364; 28/800 centre-qualite:265; `text-[32px] font-extrabold` diffusion:493 | `.cam-kpi-tile-value` | Mechanical |
| Uppercase field label | `11` / 700 (dossiers, établissements); `text-[11px]` (diffusion); `text-[10px]` diffusion:727 | `--cam-font-size-2xs` | Mechanical |
| Helper under field | `11` `declarations/new:465`; `12` geography:261; `--cam-microcopy-size` in `form/Microcopy.tsx` | `Microcopy` | Mechanical |
| Dialog title | `18` dossiers custom:931 vs `.cam-admin-dialog-title` | `AdminDialog` | Mechanical |
| `fontFamily: "monospace"` | `centre-qualite:431`, `:574`; `admin/error.tsx:106` | `--cam-font-mono` (tokens forbid bare monospace) | Mechanical |
| `var(--cam-font-display)` | `home/inscription-en-attente/page.tsx:186` — token does not exist | `--cam-font-serif` | Mechanical |

### 1.4 Cards, borders, radii

Token radii: 2 / 4 / 6 / 10 / 9999, plus `--cam-field-radius` 8 and `--cam-section-radius` 12.

| Recipe | Where | Existing tidy | Kind |
|---|---|---|---|
| `.card` | registration, login | keep | — |
| `.cam-dash-card` | questionnaires, parts of pilotage | keep | — |
| `.cam-dash-card` **plus** inline white/12px/`#e5e7eb` | `pilotage/page.tsx:95, 129, 185, 257, 327` | drop the inline; the class already draws the card | Mechanical |
| Inline `background:#ffffff; border:1px solid #e5e7eb; borderRadius:8` | utilisateurs:229, établissements:360, centre-qualite:239 | `.cam-dash-card` | Mechanical |
| Tailwind `bg-white rounded-xl border-slate-200/80 shadow-xs` | diffusion:483, équipe:168, journal-audit:240, paramètres:174 | `.cam-dash-card` | Mechanical |
| Local `Kpi` card | `inscriptions/page.tsx:571` | `KpiTile` | Mechanical |
| Local `SummaryCard` | `home/declarations/page.tsx:398` | same visual as `KpiTile`; home has no import of it today — use `.cam-dash-card` + `--cam-*` | Mechanical |
| Two `FormSectionCard` | `ui/FormSectionCard.tsx:23` and `ui/FormGrid.tsx:69` | the titled one in `FormSectionCard.tsx` | **Decision** which file keeps the name |
| Hairline `#e5e7eb` vs `#e2e8f0` vs `--cam-border` | dossiers vs centre-qualité vs registration | `--cam-border` | Mechanical |
| Card lift `rgba(0,0,0,0.02)` vs `0.03` vs `0.04` vs `--cam-shadow-sm` | admin cards vs facts frames vs Modern Jobs | `--cam-shadow-sm` | Mechanical |

### 1.5 Layout

| Surface | Max width | Padding | Breakpoints |
|---|---|---|---|
| Registration | `--cam-container-wizard` 600px | token chrome | 640, 559 |
| Home declarations | 900px `declarations/page.tsx:263` | `"24px 16px"` | none |
| ONEFOP VT | `--vt-content-max` 940px | `--cam-section-pad` 20 | Tailwind md/lg in `ui/FormGrid` |
| Admin CSS | `.cam-admin-main` **1360px** | `--cam-space-6` | 599, 639, 899, 1023, 1099, 1199 |
| Admin overrides | centre-qualité **1440**; dossier empty **820** | 16/24/28/32 mixed | |

Existing tidy: `.cam-admin-main` for admin width/pad; `--cam-container-wizard` for registration; `--vt-content-max` for VT. Home 900px is the outlier (**decision**: keep a reading measure or match VT 940).

Ten breakpoint numbers. Existing pair in tokens: 639 (tables) and 640 (wizard). Extra 599/899/1099/1199 live only in `admin-console.css`.

---

## Part 2 — Structural tidiness

### 2.1 Same concept, two renderers

| Concept | Renderer A | Renderer B (and C…) | Existing tidy | Kind |
|---|---|---|---|---|
| KPI tile | `KpiTile` `components/admin/KpiTile.tsx:22` used only at `pilotage/page.tsx:493–511` | local `Kpi` `inscriptions/page.tsx:569`; inline 32px tiles `utilisateurs:229`, `etablissements:360`; 28px tiles `centre-qualite:261`; Tailwind 32px `diffusion:483`; `.cam-pilot-kpi-*` `questionnaires:40`; `SummaryCard` `home/declarations:398` | `KpiTile` | Mechanical on admin; home is a **decision** (respondent vs admin chrome) |
| Card | `.card` / `.cam-dash-card` | inline white boxes; Tailwind `rounded-xl`; two `FormSectionCard`s | `.cam-dash-card` (admin), `.card` (auth), `ui/FormSectionCard.tsx` (questionnaire) | Mechanical |
| Empty / loading / error | `DataState` / `DataStateRow` | `cam-admin-empty` used for loading `campagnes:286`; raw `"Chargement…"` `notifications:73`, `diffusion:745`; `"…"` in KPI values; `return null` on guard | `DataState` + `resolveDataState` | Mechanical |
| Table | `.cam-dash-table` (inscriptions, cibles, pilotage) | `.cam-table` (campagnes, directories, centre-qualité); fully inline table `dossiers:664`, `utilisateurs:269`, `etablissements:470`; Tailwind table `journal-audit:381` | `.cam-dash-table` or `.cam-table` — both exist; pick `.cam-table` for directories, `.cam-dash-table` for numeric grids | **Decision** |
| Form field | `.cam-field` / `VtWizardFields` + `Microcopy` | `FieldRenderer`/`FieldControl`; `Accessible*`; raw `<label>+<input>` on dossiers filters:514; Tailwind selects `focus:ring-[#006644]` | `.cam-field` on admin; `VtWizardFields` on VT; `FieldRenderer` on Modern Jobs | **Decision** (questionnaire already has two kits) |
| Button | `.cam-button` | inline `#007a5e` dossiers:605; `#8b1e1b` dossiers:624; Tailwind `#006644` diffusion:864; text `#004d3d` utilisateurs:405 | `.cam-button` / `.cam-button-danger` | Mechanical |
| Dialog | `AdminDialog` (`<dialog>`) | hand-rolled overlay `dossiers/page.tsx:908, 1054`; `dossiers/[id]:1399, 1777, 1902`; plus questionnaire modals | `AdminDialog` on admin; questionnaire modals stay (different surface) | Mechanical on dossiers |
| Page header | `AdminPageHeader` | hand-built h1 `dossiers/[id]:412`; layout fallback only for `/admin/sectors` `layout.tsx:29` | `AdminPageHeader` | Mechanical |
| Questionnaire masthead | `ModernJobsHeader` | `SovereignMasthead` | whichever the active wizard already uses per family | **Decision** |
| FormGrid | `form/FormGrid.tsx:11` (`columns`, gap 18) used by `VtWizardSectionScreen.tsx:43` | `ui/FormGrid.tsx:18` (`cols`, Tailwind) used by `SectionRenderer.tsx:9`, `Section1ThematicRenderer.tsx:8` | one of the two existing files | **Decision** |
| Microcopy | `form/Microcopy.tsx:13` used by `VtWizardFields.tsx:21` | `ui/MicroCopy.tsx` (no importers found besides itself) | `form/Microcopy.tsx` | Mechanical (dead copy) |
| StatisticalTable | `ui/StatisticalTable.tsx` | `form/StatisticalTable.tsx` re-export | the re-export is already the tidy | — |

### 2.2 Duplicate implementations (same job, different names)

#### Empty state

| Pair | File:line | Copy |
|---|---|---|
| A `DataState` | `components/admin/DataState.tsx:48` | shared empty/error/loading block |
| B `.cam-admin-empty` | `admin-console.css`; used as empty *and* loading `campagnes/page.tsx:286, 292, 770` | CSS class, no honest-state machine |
| C `dataStateMessage("empty")` | `lib/admin-data-state.ts:297` | `Aucun enregistrement pour ${resource}.` |
| D hard-coded | `notifications/page.tsx:81` `Aucune notification.`; `StatisticalTable.tsx:55` `Aucune donnée disponible` | |

Existing tidy: `DataState` + page-level `emptyTitle`/`emptyHint` keys (already on dossiers, établissements, journal-audit, utilisateurs). `.cam-admin-empty` stays as the CSS shell that `DataState` can use. Kind: mechanical.

#### Card

Covered in 1.4 / 2.1. Named pair: `.card` (`globals.css`) vs `.cam-dash-card` (`admin-console.css`) vs `FormSectionCard`. Existing tidy: keep all three — they are three surfaces — and stop inventing a fourth inline. Kind: mechanical.

#### Date formatters

| Pair | File:line | Behaviour |
|---|---|---|
| A `stamp` | `lib/admin-data-state.ts:188` | `fr-FR`/`en-GB`, optional time, degrades to `—` |
| B `shortStamp` | `lib/admin-data-state.ts:201` | today = time, else day+month; used `pilotage/page.tsx:296` |
| C `equipe/page.tsx:592, 604` | local `toLocaleString` / `toLocaleDateString` via `intlLocale` | |
| D `notifications/page.tsx:147` | `date.toLocaleString("fr-FR", …)` — French only | |
| E `SubmissionPanel.tsx:163` | `toLocaleDateString()` — browser default locale | |
| F `OnefopSubmissionSuccess.tsx:66` | `Intl.DateTimeFormat("fr-CM"/"en-CM")` then fallback `toLocaleString()` | |

Existing tidy: `stamp` / `shortStamp`. Kind: mechanical.

#### Relative time

| Pair | File:line |
|---|---|
| A `elapsedSince` | `lib/admin-data-state.ts:217` — `Il y a 5 min` / `À l'instant` |
| B consumers | `NotificationBell.tsx:239`, `utilisateurs/page.tsx:363` |
| C missing | `notifications/page.tsx` formats absolute `toLocaleString` instead of `elapsedSince` |
| D `utilisateurs` profile pane | `:476` uses `stamp(..., true)` for last login while the table column uses `elapsedSince` |

Existing tidy: `elapsedSince` in lists, `stamp` on detail. Kind: mechanical.

#### Number formatters

| Pair | File:line |
|---|---|
| A `count` / `percent` | `lib/admin-data-state.ts:151, 160` — `fr-FR` with `—` for null; French `42 %` |
| B `formatNumber` | `TargetGrid.tsx:309`, `CoverageTable.tsx:169`, `CampaignReturnsTable.tsx:149`, `campagnes/page.tsx:1086`, `pilotage-target-payload.ts:400` — `toLocaleString("fr-FR")`, **no null guard** |
| C `LiveTablePreview.tsx:243` | `val.toLocaleString()` — browser locale |
| D `CoverageTable.tsx:174` / `CampaignReturnsTable.tsx:154` | local percent (`rate * 100`) vs `percent()` which already expects 0–100 |

Existing tidy: `count` / `percent`. Kind: mechanical. (`percent` vs `rate*100` needs a **decision** on whether CoverageTable’s rate is 0–1 or 0–100.)

#### Truncation

| Pair | File:line | Pattern |
|---|---|---|
| A CSS ellipsis | `AdminSidebar.tsx:258, 292`; `home/declarations/page.tsx:458`; `journal-audit:452` `truncate` | |
| B JS slice + `…` | `AdminHeaderActions.tsx:70` `slice(0, 20) + "…"`; `ModernJobsWizard.tsx:1076` `slice(0, 27) + "…"`; `OnefopSubmissionSuccess.tsx:326` `slice(0, 8)+"..."` | |

No shared helper exists. Existing tidy: CSS `textOverflow: "ellipsis"` (already the majority). Kind: mechanical (replace the two JS slices that are display-only).

### 2.3 File organisation

**Pattern the tidy pages follow**

| Kind | Location |
|---|---|
| Shared admin UI | `react-web/src/components/admin/` |
| Shared auth / registration | `react-web/src/components/auth/` |
| Shared questionnaire | `react-web/src/components/onefop/`, `modern-jobs/` |
| Helpers | `react-web/src/lib/` (`admin-data-state.ts`, `admin-url.ts`, `register-constants.ts`) |
| Page | route `page.tsx` wires queries + `AdminPageHeader` + shared components |

**Pages that violate it** (inline components / chrome that the other pages already extracted):

| Page | Lines | Inline that already exists elsewhere |
|---|---:|---|
| `admin/dossiers/[id]/page.tsx` | 2051 | header, three dialogs, status chips, timeline — `AdminPageHeader` + `AdminDialog` + `AdminStatusBadge` |
| `app/register/page.tsx` | 1827 | six steps in one file; rail/header/review already live in `components/auth/` |
| `admin/dossiers/page.tsx` | 1207 | filters, table, two dialogs, flag chip — `AdminDialog`, `.cam-table` |
| `admin/campagnes/page.tsx` | 1031 | local `formatNumber` at 1086; otherwise already uses `AdminDialog` |
| `admin/diffusion/page.tsx` | 1005 | whole page is Tailwind utilities; KPI tiles, filters, tables reinvented |
| `admin/centre-qualite/page.tsx` | 745 | inline KPI cards despite `KpiTile` |
| `home/declarations/new/page.tsx` | 717 | DSMO wizard fields inline |
| `admin/etablissement-detail/page.tsx` | 700 | CARD constant, toasts, account dialog (dialog already `AdminDialog`) |
| `admin/etablissements/page.tsx` | 678 | KPI tiles, filters, action menu |
| `admin/utilisateurs/page.tsx` | 631 | KPI tiles, badge, create dialog |
| `admin/inscriptions/page.tsx` | 553 | local `Kpi` (569) and `Filter` (578) |
| `home/declarations/page.tsx` | 511 | `SummaryCard` (398), status map, correction banner |

**Pages that already follow the pattern:** `admin/annuaire/page.tsx` (80 lines, header + directories), `admin/sectors/page.tsx`, `admin/questionnaires/page.tsx` (header + `cam-dash-card` + `AdminDialog`).

Helpers: date/number/empty live in `lib/admin-data-state.ts`. Copies in `TargetGrid.tsx`, `CoverageTable.tsx`, `equipe/page.tsx`, `notifications/page.tsx` violate that.

---

## Part 3 — Semantic tidiness

### 3.1 Labels — nav / breadcrumb / H1

Admin pages that **agree** (nav label = breadcrumb last crumb = H1 via `adminNav.routes.*`): campagnes, dossiers list, équipe, inscriptions list, établissements, questionnaires, journal-audit, utilisateurs, paramètres, nouvelle inscription (`adminInscriptionsNouvellePage.title` = `adminNav.routes.nouvelleInscription` = "Nouvelle inscription").

| Page | Nav | Breadcrumb last | H1 | Existing tidy | Kind |
|---|---|---|---|---|---|
| `/admin/pilotage` | Tableau de bord | Tableau de bord | Tableau de bord | path is still `/pilotage` | **Decision** (rename path or keep) |
| `/admin/cibles` | Quotas et retours | Quotas et retours | Quotas et retours | path is `/cibles`; copy inside the page still says "cibles" / "objectifs" (`fr.json:1343, 1382`) | **Decision** |
| `/admin/centre-qualite` | **Centre Qualité** (`adminNav.routes.centreQualite`) | Centre Qualité | Centre Qualité | hub label is **Contrôle Qualité** (`adminNav.hubs.qualite`, `_routes.ts:127`) | **Decision**: one of the two existing strings |
| `/admin/diffusion` | Exports | Exports | Exports | path `/diffusion`; page namespace still "diffusion" | **Decision** |
| `/admin/sectors` | Nomenclatures | from layout `PAGE_TITLES` | Nomenclatures | path `/sectors` | **Decision** |
| `/admin/dossiers/[id]` | Dossiers | none (`AdminPageHeader` unused) | `Dossier #{ref}` `dossiers/[id]:412` + `fr.json:1530` | `AdminPageHeader` breadcrumb Déclarants-style: Supervision › Dossiers › Dossier #ref | Mechanical |
| `/admin/notifications` | Notifications (hidden) | hardcoded `"Notifications"` `:60` | hardcoded `"Notifications"` `:61` | `t("adminNav.routes.notifications")` | Mechanical |
| `/admin/annuaire` | Annuaire | Annuaire | `homeAnnuairePage.pageTitle` "Annuaire" | agrees; tabs say **Entités** vs rest of hub **Établissements** | **Decision** |
| Registration rail vs body | `stepRespondent` **Déclarant** `fr.json:270` | — | StepHeader `respondentTitle` **Répondant** `:303` `register/page.tsx:1190` | pick `Déclarant` (rail + inscriptions review already use it) | **Decision** |
| Registration review | rail `stepReview` **Récapitulatif** `:274` | — | StepHeader `reviewTitle` **Vérification** `:328` `register/page.tsx:1660` | pick one existing key | **Decision** |
| Registration entity type | rail **Type d'entité** | — | **Quel type de structure déclarez-vous ?** `:291` | rail stays short; H2 is the question — acceptable if intentional | **Decision** |
| DSMO wizard | `homeDeclarationsNewPage.stepIdentification` "Identification" | — | heading `appTitle` "Déclaration DSMO" | different product from ONEFOP rail | — |
| ONEFOP review stage | sidebar `stageQuiz` "Quiz préalable de déclaration" | — | FactsReview `reviewTitle` "Récapitulatif & Dépôt" `fr.json:1128` | two different stages; labels already distinguish | — |

### 3.2 Same concept, different names

Grep of `messages/fr.json` + admin copy.

#### dossier / soumission / déclaration / fiche

Same ONEFOP record:

| Word | Where |
|---|---|
| **déclaration** | home `pageTitle` "Mes déclarations"; `NewDeclarationDialog` home button; `confirmSubmitMessage`; dossier certify text `bulkEndorseCertify` "ces déclarations" |
| **soumission** | dialog title `dialogTitle` "Nouvelle soumission" `fr.json:415`; dossiers pagination `showingRange` "… {soumissions}" `:1457`; `zeroSubmissions` |
| **dossier** | nav, H1, empty `noFilesTitle`, bulk visa copy |
| **fiche** | `rejectFormButton` "Rejeter la Fiche" `:1533`; `historyTitle` "Historique d'instruction de la Fiche" `:1564`; `approveBody` "cette fiche" `:1598`; `rejectSuccess` "La fiche a été…" `:1602` |

Existing tidy: **déclaration** on the respondent surface; **dossier** on the staff surface. Retire **fiche** and **soumission** from user-visible admin French (keep `submission` in API). Kind: **decision** then mechanical replacements.

#### retour / correction / complément

| Word | Where | Concept |
|---|---|---|
| **correction** | `CORRECTION_REQUESTED`; `requestCorrectionButton`; home banner "Demande de correction" | ONEFOP dossier sent back |
| **Retour pour correction** | timeline `:1521`; dialog title `:1571`; button `confirmReturn` "Confirmer le Retour" `:1596` | same action |
| **complément** | `COMPLEMENTS_REQUESTED`; `requestComplements` "Demander des compléments" `:1789` | registration, not a dossier |
| **compléments** vs **correction** | inscriptions vs dossiers | two workflows |

Existing tidy: **correction** for ONEFOP dossiers; **complément** for inscriptions. Stop "Retour" as a synonym of correction on the dossier dialog (`confirmReturn`). Kind: **decision** on the dossier verb (Demander une correction vs Confirmer le retour).

#### cible / objectif / quota

| Word | Where |
|---|---|
| **Quotas et retours** | nav `adminNav.routes.cibles` |
| **quota** | column headers `quotaColumn`, `quotaRateColumn` |
| **objectif** | `mixedRegionWarning`, `targetModeAriaLabel`, `confirmSaveBody` "Ces objectifs remplaceront…" `fr.json:1382` |
| **cible** | path `/admin/cibles`; `clearRegionButton` "Effacer les cibles"; `noTargetWarning`; campaign copy `newTarget`, `purposeHint` "cibles d'inscription" |
| **returns** | English API `campaigns/:id/returns`; French "retours" |

Existing tidy: nav already chose **Quotas et retours**. Replace remaining "cible"/"objectif" in that screen with **quota**. Kind: mechanical after confirming registration campaigns still say "cible d'inscription" (**decision**: quota vs cible d'inscription).

#### vérifier / valider / approuver / viser

Same staff action on a pending dossier:

| Word | Where |
|---|---|
| **Viser** | `endorseSelectionButton` "Viser la sélection"; badge `badgeEndorsed` "VISÉ"; `axis1Title` "VISA ADMINISTRATIF" |
| **Valider et Archiver** | `validateArchiveButton` `:1535` |
| **Confirmer la validation** | `confirmValidation` `:1601` |
| **Approuver** | inscriptions `approve`; utilisateurs `approve`; établissement `approveAccount` |
| **Validation...** | `validating` `:1600` |

Existing tidy: **viser** for ONEFOP dossiers (already the list-page verb). **Approuver** for inscriptions/accounts. Retire "Valider et Archiver" / "Confirmer la validation" on the dossier detail in favour of the list-page visa wording. Kind: **decision**.

#### inscription / enregistrement

| Word | Where |
|---|---|
| **inscription** | nav, rail `Étapes de l'inscription`, `Nouvelle inscription`, UserStatus flow |
| **enregistrement** | button `submittingButton` "Enregistrement…"; `submitButton` "Enregistrer l'inscription"; `n° d'enregistrement`; `confirmSaveTitle` "Confirmer l'enregistrement" (quotas); roster `Aucun enregistrement` |
| **date d'inscription** vs **date d'enregistrement** | établissements column `:1821` vs établissement-detail `:1904` |

Existing tidy: **inscription** for the company onboarding flow; **enregistrement** for "save this form" and for the legal registration number. Align the two date labels to `date d'inscription`. Kind: mechanical.

### 3.3 Empty-state wording

Distinct patterns in `fr.json` + hard-coded TSX:

| Pattern | Examples | First |
|---|---|---|
| `Aucun X trouvé` | `Aucun secteur trouvé.`; `Aucun dossier trouvé`; `Aucun établissement trouvé` | `fr.json:23, 1443, 1825` |
| `Aucune X trouvée` | `Aucune entreprise trouvée.`; `Aucune déclaration pour l'instant` | `:444, 179` |
| `Aucun X enregistré` | `Aucun agent enregistré`; `Aucune anomalie enregistrée`; `Aucun formateur enregistré pour le moment.` | `:2338, 2191`; `StatisticalTableDefinition.ts:1171` |
| `Aucun enregistrement pour ${resource}` | `dataStateMessage` | `admin-data-state.ts:297` |
| `Aucune donnée disponible` | default `StatisticalTable` | `ui/StatisticalTable.tsx:55` |
| `Aucune X.` (period) | `Aucune notification.` | `notifications/page.tsx:81`; `notificationBell.empty` |
| `Rien` — **not used** | — | — |
| Hint sentence under title | `noFilesHint`, `noEstablishmentHint`, `emptyHint` (audit, agents) | page-level keys |

Existing tidy: title `Aucun(e) {noun} trouvé(e)` + optional hint, as dossiers/établissements already do via `DataState`. Replace `Aucune donnée disponible` and `Aucun enregistrement pour ${resource}` with the page keys. Kind: mechanical.

### 3.4 Action labels on a dossier

| Action | Labels in use | Existing tidy | Kind |
|---|---|---|---|
| Grant visa | "Viser la sélection" `fr.json:1431`; "Valider et Archiver" `:1535`; "Confirmer la validation" `:1601`; `approveBody` talks of visa **and** validation | "Viser" / "Confirmer le visa" — the list already chose viser | **Decision** |
| Reject | "Rejeter Sélection" `:1432`; "Rejeter {count} dossier(s)" `:1491`; "Rejeter la Fiche" `:1533`; "Confirmer le Rejet" `:1611` | "Rejeter" + "Confirmer le rejet" (drop "Fiche") | Mechanical |
| Send back | "Demander une correction" `:1534`; "Confirmer le Retour" `:1596`; dialog "Retour pour Correction" `:1571` | "Demander une correction" | **Decision** |
| Open | row is a link, no button label | — | — |
| Export | dossiers list export uses format param `:386` | keep | — |

### 3.5 Confirmation phrasing

| Pattern | Body | Where |
|---|---|---|
| Native `window.confirm` long sentence | "Ceci va soumettre définitivement cette déclaration au serveur. Cette action ne peut pas être annulée. Continuer ?" | `fr.json:649, 699`; `SubmissionPanel.tsx:202` |
| "Êtes-vous sûr de vouloir … ?" | quiz reset `:872`; remove record `:956`; trainer delete `StatisticalTableDefinition.ts:1175` | |
| "Confirmez-vous la décision ?" | `approveBody` `:1598` | `dossiers/[id]` visa dialog |
| Statement, no question | `rejectBody` "Cette décision met un terme au processus d'instruction pour cette déclaration." `:1603` | |
| "Ces objectifs remplaceront…" | `confirmSaveBody` `:1382` | cibles `AdminDialog` |
| "Confirmer & …" buttons | "Confirmer et soumettre" PDF modal; "Confirmer et continuer →"; "Confirmer la déclaration à néant"; "Confirmer et réinitialiser" | ONEFOP |
| Certify-on-honour checkbox + confirm | dossier visa/reject/correction; registration `certifyLabel` | |

Existing tidy: `AdminDialog` for admin (already on inscriptions, campagnes, cibles). Dossier dialogs should use that shell and the **Confirmez-vous la décision ?** sentence already in `approveBody`. Questionnaire keeps `window.confirm` until those flows move to their existing custom dialogs (`ProjectProgramScopeQuiz` already has dialogs). Kind: mechanical on dossiers; **decision** on whether submit uses `window.confirm` or the PDF modal's "Confirmer et soumettre".

---

## Part 4 — State and behaviour

### 4.1 Loading states

| Query surface | DataState | Raw / other |
|---|---|---|
| dossiers list | `DataStateRow` via `resolveDataState` | |
| dossiers/[id] | `DataState` on some blocks | guard: full-page DataState |
| centre-qualité rules/registry | `DataState` / `DataStateRow` | KPI values show `"…"` `:266` |
| journal-audit | `DataStateRow` | |
| utilisateurs table | `DataStateRow` | KPI `"…"` `:239`; guard `return null` `:140` |
| établissements | `DataStateRow` | KPI `"…"` `:365` |
| établissement-detail | `DataState` | |
| paramètres audit | `DataState` | |
| diffusion history | `DataState` | `"Chargement de l'historique des exports..."` `:1034`; KPI `"…"`; `"Chargement…"` campaigns `:745` |
| pilotage | `DataState` on queues | activity `isLoading` branch `:275` |
| campagnes | | `cam-admin-empty` + `t("common.loading")` `:286, 770` |
| inscriptions | | `<p className="cam-admin-lede">{t("common.loading")}</p>` `:330` |
| inscriptions/nouvelle | | same lede `:229` |
| cibles | | lede `t("common.loading")` / `loadingCampaigns` / `loadingReturns` |
| équipe | | `adminEquipePage.loading` "Chargement des données d'activité…" `:268` |
| notifications | | `"Chargement…"` hardcoded `:73` |
| sectors | | `cam-admin-empty` loadingSectors |
| annuaire | | `<p>{t("common.loading")}</p>` `:48` |
| questionnaires | | `t("loadingSections")` |
| layout queues | | `cam-admin-empty` + `common.loading` `:74` |
| home declarations | | local padded empty `:533`; no DataState |
| registration | | step-local, no list query |

Existing tidy: `DataState` / `DataStateRow` + `t("common.loading")` ("Chargement…"). Kind: mechanical.

### 4.2 Error states

| Pattern | Where | Copy |
|---|---|---|
| `DataState` error + `errorDetail` | dossiers, centre-qualité, journal-audit, établissements, détail, paramètres | `Impossible de charger ${resource}.` plus server message |
| `cam-admin-notice cam-admin-notice--error` + `formatApiError` | cibles `:269`; campagnes detail | server French/English mixed |
| `t("loadError")` | inscriptions `:331` "Impossible de charger les inscriptions." | generic, specific noun |
| `schemaQuery.isError` notice | questionnaires `:78` | |
| `queuesQuery.isError` DataState | pilotage `:478` | |
| `summaryQuery.isError` | équipe `:270` | |
| hardcoded | notifications `:74` | |
| absent (guard `return null`) | utilisateurs `:140`, campagnes `:187` on *auth* load | failure of the screen guard is silent |
| mutation errors inline | dossiers bulk `:990`; dossier detail `:1693, 1830, 2048` | `t("…Failed", { message })` |

Generic vs specific: `dataStateMessage` interpolates the resource; inscriptions has a dedicated sentence; cibles surfaces the raw API string. Existing tidy: `DataState` for queries, `formatApiError` for mutations (already used on cibles). Kind: mechanical.

### 4.3 Empty states

See 3.3. Wiring:

| Uses DataState empty title/hint | Uses raw text |
|---|---|
| dossiers, centre-qualité, journal-audit, établissements, détail submissions/audit, paramètres, diffusion history | inscriptions (table with no DataState empty), équipe `:278`, notifications `:81`, sectors `:96`, campagnes `:292`, home declarations `:179` keys but local layout |

### 4.4 refetchInterval

| File:line | Interval | Query |
|---|---|---|
| `admin/layout.tsx:45` | **30_000** | `getPilotageQueues` (every admin page) |
| `NotificationBell.tsx:58` | **30_000** | notifications |
| `usePendingRegistrationsCount.ts:35` | **120_000** | pending inscriptions badge |
| `admin/pilotage/page.tsx:371, 380, 387, 395` | **120_000** | four dashboard queries |

No refetch on registration, home declarations, or most admin lists. Existing tidy: 30s for badge/queue chrome, 120s for dashboard bodies — already a split. Kind: **decision** only if queues should match 120s (layout 30s vs pilotage 120s for related data).

### 4.5 URL state vs React state

**In the URL (survives reload):**

| Page | Params |
|---|---|
| dossiers | `status`, `companyId`, `q`, `formType` (`dossiers/page.tsx:132–138`) — **region, period, pagination offset are React state** |
| centre-qualité | `vue`, `status`, `severity` |
| inscriptions | `createdBy`, `vue`, `annee` — **search, region, statusFilter, typeFilter, dateRange, page are React state** `:110–116` |
| cibles | `vue`, `campagne`, `annee` |
| annuaire | `tab` |
| journal-audit | `actor`, `resourceId` deep links only — **period, action, resourceType, page are React state** `:94–100` |
| établissement-detail | `id`, `manage` |
| onefop preview | `entity` / `entityType` |

**React-only (reset on reload):**

| Page | Filters |
|---|---|
| établissements | search, type, region, status, page `:119–131` |
| diffusion | campaign, region, status, department, entityType, codebook `:194–224` |
| utilisateurs | none as filters (create dialog only) |
| équipe | period/role/region in component state |
| campagnes | none as list filters |
| home/declarations | `groupFilter` (status chips) |
| dossiers | `regionFilter`, `periodFilter`, `offset` |

Existing tidy: dossiers already has `hrefWith` for status/q/formType — extend that same helper (`lib/admin-url.ts`) to the React-only filters. Kind: mechanical.

---

## Part 5 — Backend surface

### 5.1 User-facing error messages

Same fact, two French (or English) strings:

| Fact | Message A | Message B | Existing tidy | Kind |
|---|---|---|---|---|
| Campaign missing | `'Campaign not found'` `campaign.service.ts:263, 281, 328, 459, 635` | `'Campagne introuvable'` `:408, 528`; `'Campagne introuvable.'` `pilotage.service.ts:823` | `Campagne introuvable.` (pilotage already French + period) | Mechanical |
| User missing | `'Utilisateur introuvable.'` `auth.service.ts:358, 2451, 2514` | `'Utilisateur non trouvé'` `:1211, 1236, 1306, 1358, 2085, 2128, 2173, 2193, 2210, 2232` | `Utilisateur introuvable.` | Mechanical |
| Company missing | `'Entreprise non trouvée'` `analytics.controller.ts:142` | `'Entreprise introuvable pour ce compte.'` `auth.service.ts:1817`; `'Aucun profil entreprise trouvé.'` `dsmo.controller.ts:34` | one of the three existing French lines | **Decision** |
| Email taken | `'Un utilisateur avec cet email existe déjà'` `auth.service.ts:519` (no period) | `'Email ou numéro contribuable déjà utilisé'` `:880` | keep both if they are different facts; same fact → first | **Decision** |
| Notification missing | `'User not found'` / `'Notification not found'` `notification.service.ts:71, 404` | French everywhere else in auth | French, matching auth | Mechanical |
| Roles in English | `'Only DIVISIONAL, REGIONAL…'` `notification.service.ts:76` | `'Privilèges territoriaux insuffisants.'` `territory.ts:211` | French | Mechanical |
| Unauthorised empty | `UnauthorizedException()` no body `jwt.strategy.ts:28–51`, `local.strategy.ts:14` | `'Authentification requise.'` `territory.ts:184` | `'Authentification requise.'` | Mechanical |

GENERIC_ERROR in auth (login/reset) is intentional and consistent.

### 5.2 Response shapes

No global envelope. Observed families:

| Shape | Endpoints |
|---|---|
| Raw array / object | `GET /onefop/submissions`, `GET /onefop/submissions/:id`, `GET /admin/pilotage/coverage/*`, quotas, most GET lists |
| `{ success: true }` | `DELETE /onefop/draft/:quarterCode`; data-management region/sector mutate |
| `{ success, message, data }` | onefop preview `onefop.service.ts:115` |
| `{ users, total }` / `{ items, total }` / `{ data, total }` | auth users vs questionnaires admin list vs companies — **three list envelopes** |
| `{ success: true }` vs thrown exception | mix |

camelCase is the Nest/Prisma default and is consistent on live JSON. Query params are camelCase (`entityType`, `quarterCode`, `campaignId`) except:

- inscriptions UI `annee`, `vue` (French)
- centre-qualité `vue`
- cibles `campagne`, `annee`

Existing tidy: keep raw bodies (majority). List endpoints already used by admin should stay `{ items, total }` **or** `{ users, total }` — pick the questionnaires admin list shape for new work. Kind: **decision** on list envelope; mechanical on query-param language (keep French `vue`/`annee` since they are already in the URL contract).

snake_case: not used on API JSON. Prisma enums are UPPER_SNAKE.

### 5.3 Status vocabulary

| Enum | Values | `DRAFT` means | `PENDING*` means |
|---|---|---|---|
| `OnefopStatus` | DRAFT, PENDING_REVIEW, APPROVED, REJECTED, CORRECTION_REQUESTED | unsaved/incomplete questionnaire | waiting staff visa |
| `DeclarationStatus` (DSMO) | DRAFT, SUBMITTED, DIVISION_APPROVED, REGION_APPROVED, FINAL_APPROVED, REJECTED | same idea | SUBMITTED, not PENDING_REVIEW |
| `SubmissionStatus` (campaign returns) | PENDING, SUBMITTED, IN_PROGRESS, VALIDATED, LATE, EXEMPT, NOT_STARTED | — | PENDING ≠ Onefop PENDING_REVIEW |
| `CampaignStatus` | DRAFT, ACTIVE, PAUSED, CLOSED, ARCHIVED | unpublished campaign | — |
| `UserStatus` | PENDING_APPROVAL, ACTIVE, REJECTED, DRAFT, UNDER_REVIEW, COMPLEMENTS_REQUESTED, DOCUMENTS_INCOMPLETE | unfinished **registration** | PENDING_APPROVAL |
| `AnomalyStatus` | OPEN, … | — | — |
| `NotificationStatus` | SENT, OPENED, CLICKED, FAILED | — | — |

Collisions:

| Word | Enum A | Enum B |
|---|---|---|
| **DRAFT** | Onefop questionnaire | Campaign | User registration |
| **REJECTED** | Onefop dossier | User account | DSMO declaration |
| **PENDING** | SubmissionStatus campaign return | vs Onefop **PENDING_REVIEW** vs User **PENDING_APPROVAL** | |
| **VALIDATED** | SubmissionStatus | vs Onefop **APPROVED** vs UI "visé" | |
| **SUBMITTED** | DSMO DeclarationStatus | SubmissionStatus | |

Existing tidy: do not rename Prisma enums (exports/SPSS). UI already maps OnefopStatus → French via `homeDeclarationsPage` / dossier badges. Map `SubmissionStatus.VALIDATED` to the visa wording, not "approuvé". Kind: **decision** documented in copy only.

### 5.4 Route naming

Admin **frontend** paths (`_routes.ts`):

```
/admin/pilotage
/admin/dossiers
/admin/dossiers/[id]
/admin/equipe
/admin/campagnes
/admin/cibles
/admin/questionnaires
/admin/inscriptions
/admin/inscriptions/nouvelle
/admin/etablissements
/admin/etablissement-detail   ← singular, query ?id=
/admin/centre-qualite
/admin/diffusion
/admin/sectors
/admin/utilisateurs
/admin/annuaire
/admin/journal-audit
/admin/parametres
/admin/notifications
```

| Inconsistency | Examples | Existing tidy | Kind |
|---|---|---|---|
| Plural vs singular | `/etablissements` vs `/etablissement-detail` | other details use `/dossiers/[id]`, `/inscriptions/nouvelle` | **Decision** (keep query detail; it is already gated) |
| French slug vs English | `centre-qualite`, `parametres`, `equipe` vs `pilotage`, `sectors`, `notifications` | no single existing convention | **Decision** (do not rename live URLs without a redirect plan) |
| Label vs path | `/cibles` vs "Quotas et retours"; `/diffusion` vs "Exports"; `/pilotage` vs "Tableau de bord"; `/sectors` vs "Nomenclatures" | labels in `adminNav` are the product names | keep paths |
| Backend vs frontend | UI `/admin/dossiers` → API `/admin/questionnaires` + `/admin/questionnaires/pilotage/queues` | already documented in fe-be contract audits | — |
| Hyphen vs camel | kebab everywhere on frontend; backend `onefop-analytics`, `data-management`, `system-settings`, `minefop-services` | kebab | consistent |
| Nested admin | `admin/pilotage`, `admin/questionnaires` vs unprefixed `campaigns`, `auth`, `onefop` | existing split: staff under `admin/`, respondent under `onefop`/`auth` | — |
| Duplicate ONEFOP controllers | `@Controller('onefop')` on both `onefop.controller.ts` and `questionnaires.controller.ts` | already the living split (respondent vs submit pipeline) | — |

---

## Summary

### Violation counts (approximate)

| Part | Distinct tidy violations |
|---:|---:|
| 1 Visual | ~40 patterns (2,070 hex hits, 963 off-token; 1,133 off-scale spacing; 1,024 font-size literals) |
| 2 Structural | 11 concepts with two+ renderers; 6 helper pairs; 12 pages that break file organisation |
| 3 Semantic | 8 nav/H1/rail disagreements; 5 synonym families; 7 empty-copy patterns; 3 dossier actions with two verbs; 6 confirmation patterns |
| 4 State | 14 pages not using DataState for loading; 8 React-only filter sets that reset; 2 refetch families (30s / 120s) |
| 5 Backend | 6 error-message pairs; 3 list envelopes; 5 status-word collisions; 4 path/label mismatches |

### Five most impactful changes

1. **Paint admin with the tokens registration already uses** (`--cam-text`, `--cam-border`, `--cam-green`, `.cam-dash-card`, `.cam-button`). Dossiers + établissements + utilisateurs + centre-qualité + the Tailwind island (diffusion, équipe, journal-audit, paramètres) are the volume.
2. **Call the shared components that already exist:** `KpiTile`, `AdminDialog`, `DataState`, `stamp`/`count`/`elapsedSince`, `.cam-table` / `.cam-dash-table`.
3. **One French noun per surface for the ONEFOP record:** déclaration (respondent), dossier (staff). Remove fiche/soumission from admin UI copy.
4. **One staff verb for the Axis-1 decision:** viser (list page already does). Align dossier detail "Valider et Archiver".
5. **One FormGrid / FormSectionCard / field kit per questionnaire family** — stop `form/` and `ui/` exporting the same names.

### Five most mechanical changes

1. Correct token fallbacks that name the wrong colour (`#16a34a`, `#dc2626`, `#1a5c3a`, `#e8f0fe`, `#f4f6f5`, `#34d399`).
2. Replace local `toLocaleString` / `toLocaleDateString` with `count` / `stamp` / `elapsedSince`.
3. Replace `"Chargement…"` / `cam-admin-empty` loading / `"…"` KPI placeholders with `DataState` loading.
4. `Campaign not found` → `Campagne introuvable.`; `Utilisateur non trouvé` → `Utilisateur introuvable.`; bare `monospace` → `--cam-font-mono`; `var(--cam-font-display)` → `--cam-font-serif`.
5. Notifications header strings → `adminNav.routes.notifications`; dossier detail chrome → `AdminPageHeader` + `AdminDialog`.

### Pages already fully tidy (relative to this map)

- Registration wizard chrome (tokens, `.card`, shared rail/header) — remaining issues are rail vs H2 wording only.
- `admin/annuaire/page.tsx` (thin wrapper).
- `admin/questionnaires/page.tsx` (header + `cam-dash-card` + `AdminDialog`).
- `admin/campagnes/page.tsx` and `admin/cibles/page.tsx` (tokens + `AdminDialog`; leftover "cible/objectif" copy).
- `components/auth/*` and `lib/admin-data-state.ts` (the helpers others should call).

### Decisions the human must make

1. **Which green is the admin primary:** `--cam-green` `#1e6b3a`, flag `#0e5c2b` / `#007a5e`, or diffusion `#006644`.
2. **Staff noun for a submitted questionnaire:** dossier (nav) vs déclaration (certify text) vs fiche (detail buttons).
3. **Staff verb for Axis 1:** viser vs valider vs approuver.
4. **Quota vs cible vs objectif** on `/admin/cibles`, including registration campaigns.
5. **Hub vs page title** for quality: Contrôle Qualité vs Centre Qualité.
6. **Registration rail:** Déclarant vs Répondant; Récapitulatif vs Vérification.
7. **Which FormGrid / FormSectionCard file survives.**
8. **List JSON envelope:** `{ items, total }` vs `{ users, total }`.
9. **Whether to rename live URLs** (`/cibles`, `/diffusion`, `/pilotage`, `/sectors`) to match labels — or leave paths and treat labels as the product names.
10. **Home KPI / cards:** stay respondent-styled, or reuse `KpiTile` / `.cam-dash-card`.

---

## Appendix A — Unique non-token hex (count, first file:line)

### Admin (701 hits, 63 unique)

```
#6b7280 x114  admin/dossiers/[id]/page.tsx:322
#111827 x97   admin/dossiers/[id]/page.tsx:412
#e5e7eb x56   admin/dossiers/[id]/page.tsx:395
#374151 x46   admin/dossiers/[id]/page.tsx:400
#006644 x31   admin/diffusion/page.tsx:610
#d1d5db x30   admin/dossiers/[id]/page.tsx:396
#f3f4f6 x26   admin/dossiers/[id]/page.tsx:424
#b91c1c x22   admin/centre-qualite/page.tsx:285
#e2e8f0 x19   admin/centre-qualite/page.tsx:240
#007a5e x18   admin/centre-qualite/page.tsx:553
#004d3d x16   admin/etablissement-detail/page.tsx:215
#fecaca x14   admin/dossiers/[id]/page.tsx:1243
#9ca3af x13   admin/dossiers/[id]/page.tsx:435
#dc2626 x13   admin/dossiers/[id]/page.tsx:319
#f9fafb x13   admin/dossiers/[id]/page.tsx:954
#d97706 x12   admin/centre-qualite/page.tsx:295
#fef2f2 x12   admin/dossiers/[id]/page.tsx:41
#065f46 x11   admin/dossiers/[id]/page.tsx:1285
#ecfdf5 x11   admin/dossiers/[id]/page.tsx:39
#b45309 x9    admin/centre-qualite/page.tsx:443
#4b5563 x8    admin/etablissement-detail/page.tsx:612
#fef3c7 x8    admin/centre-qualite/page.tsx:442
#a7f3d0 x7    admin/dossiers/[id]/page.tsx:1285
#f1f5f9 x7    admin/centre-qualite/page.tsx:420
#cbd5e1 x5    admin/centre-qualite/page.tsx:491
#fee2e2 x5    admin/centre-qualite/page.tsx:442
#fef9e7 x5    admin/centre-qualite/page.tsx:597
#047857 #15803d #991b1b #dcfce7 #e8f7f3 #f59e0b  (×4 each)
#b8860b #c2410c #fca5a5 #fde68a #fdecea #fff5f5  (×3 each)
#004730 #005438 #92400e #92620a #d1fae5 #fff7ed #fffbeb  (×2 each)
singletons: #059669 #064e3b #0d9488 #164e32 #16a34a #1d4ed8 #2563eb
            #5ba897 #5c3800 #8b1e1b #a7d1c7 #c25800 #ef4444 #eff6ff
            #fcd34d #ffedd5 #fff3e8
```

### Home / declarations (21 non-token hits)

`#e8f0fe` `#16a34a` `#2563eb` `#d97706` `#dc2626` `#92400e` `#f0fdf4` `#f1f5f9` `#fde68a` `#fffbeb` — first `home/declarations/page.tsx:83–86`.

### ONEFOP non-token (241 hits, 64 unique) — highest volume

`#1c1f1d` ×37, `#cbd5e1` ×30, `#e2e8f0` ×23, `#dc2626` ×18, `#1B4332` ×16, `#0e4d29` ×10, plus purple/orange/legacy VT as in §1.1. First lines: `ConditionalOptions.tsx:88`, `CameroonGeographySelector.tsx:272`, `EventProgress.tsx:47`, `FieldControl.tsx:44`, `VtWizardSectionScreen.tsx:1147`.
