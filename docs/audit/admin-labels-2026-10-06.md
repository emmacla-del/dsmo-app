# Admin console — label alignment survey (Phase 4)

Date: 2026-10-06 · Tree: `e4878b83` (master) · Scope: `react-web/src/app/admin/**/page.tsx`
Status: **approved 2026-10-06** — all of T1–T13 and N1–N4. T1–T13 landed in `16b89969`, N1–N4 in `e45e8603`. See "Decisions" below.

The 2026-10-XX IA audit that Phase 4 was meant to follow was never saved to disk.
This survey was done fresh from the current tree and replaces it.

## Method

For each of the 20 `page.tsx` files under `src/app/admin/` I recorded:

- **Nav**: `label` in `src/app/admin/_routes.ts`. Labels on `hidden: true` entries are
  never rendered (they only gate access). They are listed for completeness.
- **Breadcrumb**: the last item passed to `AdminPageHeader`. For `/admin/sectors` it is
  the layout fallback in `app/admin/layout.tsx` (`PAGE_TITLES`).
- **H1**: the `title` prop, or a hand-rolled `<h1>` where the page has one.
- **Cross-links**: other visible names for the page, such as link text elsewhere or
  dialog titles.

Paths below are relative to `react-web/src/`.

The first breadcrumb item (the hub) matches the hub label on every page. Only the
last item is compared.

---

## Step 1 — Inventory

| # | Route | Nav (`_routes.ts`) | Breadcrumb (last item) | H1 | Other names for this page |
|---|---|---|---|---|---|
| 1 | `/admin/pilotage` | Tableau de bord `:65` | Tableau de bord `pilotage/page.tsx:458` | **Observatoire National de l'Emploi** `:459` | "Tableau de Bord National" `app/home/page.tsx:72`; "Tableau de Bord Territorial / Régional / National" `lib/role-navigation.ts:86,91,101,110`; "Retour à la supervision" `admin/error.tsx:92` |
| 2 | `/admin/dossiers` | **Dossiers en instance** `:66` | **Dossiers en instance** `dossiers/page.tsx:425` | **Dossiers en Instance** `:426` | "Voir tous les dossiers →" `pilotage/page.tsx:252`; "Instruction & Visas" `app/home/page.tsx:102`, `role-navigation.ts:102,111`; "Instruction des Dossiers" `role-navigation.ts:87,92`; "Tous les dossiers →" `etablissement-detail/page.tsx:390`; "Voir dossiers" `questionnaires/page.tsx:121`; default view "Tous" `dossiers/page.tsx:82` |
| 3 | `/admin/dossiers/[id]` | not in nav | **none** (does not use `AdminPageHeader`) | **Soumission #{ref}** `dossiers/[id]/page.tsx:371` | "← Retour aux dossiers" `:305`; "Dossier introuvable" `:315` |
| 4 | `/admin/equipe` | **Administrateurs territoriaux** `:71` | **Équipe** `equipe/page.tsx:138` | **Supervision de l'Équipe Territoriale** `:139` | none |
| 5 | `/admin/campagnes` | Campagnes `:82` | Campagnes `campagnes/page.tsx:176` | **Campagnes Nationales de Recensement** `:177` | "Gérer les campagnes →" `pilotage/page.tsx:103`; "Voir les détails de la campagne →" `:137`; header campaign pill `components/admin/AdminHeaderActions.tsx:75` |
| 6 | `/admin/cibles` | Quotas et retours `:85` | Quotas et retours `cibles/page.tsx:93` | Quotas et retours `:94` | "Quotas et retours →" `pilotage/page.tsx:65` — **aligned** |
| 7 | `/admin/questionnaires` | Questionnaires `:86` | Questionnaires `questionnaires/page.tsx:62` | **Questionnaires Homologués ONEFOP** `:63` | none |
| 8 | `/admin/inscriptions` | Inscriptions `:97` | Inscriptions `inscriptions/page.tsx:225` | Inscriptions `:226` | KPI "Inscriptions en attente" `pilotage/page.tsx:481`; "Voir les inscriptions" `equipe/page.tsx:460`; "Voir la file" `inscriptions/nouvelle/page.tsx:339` — **aligned** |
| 9 | `/admin/inscriptions/nouvelle` | Nouvelle inscription `:105` (hidden) | Nouvelle inscription `inscriptions/nouvelle/page.tsx:224` | **Nouvelle inscription assistée** `:225` | button "Nouvelle inscription" `inscriptions/page.tsx:232`; button **"+ Nouvel Établissement"** `etablissements/page.tsx:345` |
| 10 | `/admin/etablissements` | Établissements `:106` | Établissements `etablissements/page.tsx:293` | Établissements `:294` | breadcrumb on both detail pages — **aligned** |
| 11 | `/admin/etablissement-detail` | Détail établissement `:114` (hidden) | {short name} `etablissement-detail/page.tsx:243` | {short name} `:245` **and** a second `<h1>` {full name} `:270-271` | row link `etablissements/page.tsx:495` — label aligned (see S1) |
| 12 | `/admin/etablissement-detail/approbation` | **Approbation établissement** `:115` (hidden) | Validation du compte `etablissement-detail/approbation/page.tsx:202` | **Validation du compte déclarant** `:204` | "Validation du compte" `etablissement-detail/page.tsx:304`; dialog "Validation du compte — {organisation}" `inscriptions/page.tsx:387` |
| 13 | `/admin/centre-qualite` | Centre Qualité `:127` | Centre Qualité `centre-qualite/page.tsx:204` | **Centre de Contrôle de Qualité** `:205` | "Voir le centre qualité →" `pilotage/page.tsx:317`; KPI "Alertes qualité" `pilotage/page.tsx:499`; tab "Registre des anomalies" `:46` vs its H2 **"Registre des Contrôles & Anomalies"** `:476` |
| 14 | `/admin/diffusion` | Exports `:150` | Exports `diffusion/page.tsx:454` | **Gestion des Données et Exports** `:455` | "Statistiques & Diffusion" `app/home/page.tsx:117`, `role-navigation.ts:103,112` |
| 15 | `/admin/sectors` | **Nomenclatures** `:151` | **Jeux de données** `app/admin/layout.tsx:27` | **Référentiel des secteurs** `layout.tsx:27` | H2 "Nomenclature" `sectors/page.tsx:86`; "Nomenclature des Secteurs" `role-navigation.ts:104,113`; unused i18n `adminSectorsPage.pageTitle` = "Secteurs d'activité" `messages/fr.json:18` |
| 16 | `/admin/utilisateurs` | **Utilisateurs** `:163` | Utilisateurs & rôles `utilisateurs/page.tsx:189` | Utilisateurs & rôles `:190` | "Gérer les affectations →" `parametres/page.tsx:569`; "Utilisateurs ONEFOP" `role-navigation.ts:105,114`; Annuaire also has a tab "Utilisateurs" `messages/fr.json:59` |
| 17 | `/admin/annuaire` | Annuaire `:167` | Annuaire `annuaire/page.tsx:24` (i18n `fr.json:58`) | Annuaire `:25` | "Répertoire des Établissements" `role-navigation.ts:106`; "Gestion des Utilisateurs & Entités" `role-navigation.ts:115` — **aligned in console** |
| 18 | `/admin/journal-audit` | **Traçabilité** `:168` | **Journal d'audit** `journal-audit/page.tsx:240` | **Journal d'Audit Systémique** `:241` | "Voir le journal" `equipe/page.tsx:453`; "Voir le journal complet →" `parametres/page.tsx:605`, `etablissement-detail/page.tsx:605`; "Voir les événements d'audit →" `dossiers/[id]/page.tsx:1342`; H2 "Journal d'Audit Récent" `parametres/page.tsx:599` |
| 19 | `/admin/parametres` | Paramètres `:169` | Paramètres `parametres/page.tsx:208` | **Paramètres du Système** `:209` | none |
| 20 | `/admin/notifications` | Notifications `:178` (hidden) | Notifications `notifications/page.tsx:60` | Notifications `:61` | bell "Voir tout" `components/admin/NotificationBell.tsx:263` — **aligned** |

---

## Step 2 — Mismatches

✗ marks a surface that disagrees with the proposed label in Step 3. Six pages are
already aligned (#6, #8, #10, #11, #17, #20) and are left out. Fourteen pages disagree.

| # | Page | Nav | Breadcrumb | Title (H1) |
|---|---|---|---|---|
| 1 | Pilotage | Tableau de bord ✓ `_routes.ts:65` | Tableau de bord ✓ `pilotage/page.tsx:458` | Observatoire National de l'Emploi ✗ `:459` |
| 2 | Dossiers | Dossiers en instance ✗ `_routes.ts:66` | Dossiers en instance ✗ `dossiers/page.tsx:425` | Dossiers en Instance ✗ `:426` |
| 3 | Dossier detail | — | *(none)* | Soumission #{ref} ✗ `dossiers/[id]/page.tsx:371` |
| 4 | Équipe | Administrateurs territoriaux ✗ `_routes.ts:71` | Équipe ✗ `equipe/page.tsx:138` | Supervision de l'Équipe Territoriale ✗ `:139` |
| 5 | Campagnes | Campagnes ✓ | Campagnes ✓ | Campagnes Nationales de Recensement ✗ `campagnes/page.tsx:177` |
| 7 | Questionnaires | Questionnaires ✓ | Questionnaires ✓ | Questionnaires Homologués ONEFOP ✗ `questionnaires/page.tsx:63` |
| 9 | Nouvelle inscription | Nouvelle inscription ✓ (hidden) | Nouvelle inscription ✓ | Nouvelle inscription assistée ✗ `inscriptions/nouvelle/page.tsx:225` |
| 12 | Validation du compte | Approbation établissement ✗ (hidden) `_routes.ts:115` | Validation du compte ✓ | Validation du compte déclarant ✗ `etablissement-detail/approbation/page.tsx:204` |
| 13 | Centre Qualité | Centre Qualité ✓ | Centre Qualité ✓ | Centre de Contrôle de Qualité ✗ `centre-qualite/page.tsx:205` |
| 14 | Exports | Exports ✓ | Exports ✓ | Gestion des Données et Exports ✗ `diffusion/page.tsx:455` |
| 15 | Nomenclatures | Nomenclatures ✓ | Jeux de données ✗ `layout.tsx:27` | Référentiel des secteurs ✗ `layout.tsx:27` |
| 16 | Utilisateurs | Utilisateurs ✗ `_routes.ts:163` | Utilisateurs & rôles ✓ | Utilisateurs & rôles ✓ |
| 18 | Journal d'audit | Traçabilité ✗ `_routes.ts:168` | Journal d'audit ✓ | Journal d'Audit Systémique ✗ `journal-audit/page.tsx:241` |
| 19 | Paramètres | Paramètres ✓ | Paramètres ✓ | Paramètres du Système ✗ `parametres/page.tsx:209` |

Two of these are sub-page mismatches rather than nav/breadcrumb/H1 mismatches. They are
listed here because commit `e4878b83` flagged them for Phase 4:

| # | Surface | Tab / filter | Heading |
|---|---|---|---|
| 2a | Dossiers default view | Nav says "en instance". The page opens on "Tous" `dossiers/page.tsx:82` | — |
| 13a | Qualité register | Tab "Registre des anomalies" `centre-qualite/page.tsx:46` | H2 "Registre des Contrôles & Anomalies" ✗ `:476` |

**Pattern.** In twelve of the fourteen pages, the nav and breadcrumb agree and only the
H1 differs. The H1 is almost always a longer, Title Case "official" name. Only #2, #4,
#15, #16 and #18 disagree at the nav or breadcrumb level.

---

## Step 3 — Proposed labels

Rules applied:
1. Use the name that already appears most often.
2. Pages under a hub get the short name.
3. Detail pages are titled by their entity.
4. Labels use French sentence case. The current H1s mix in Title Case ("Dossiers en
   Instance", "Paramètres du Système"), which no nav label uses.

| # | Page | Proposed label | Applies to | Why |
|---|---|---|---|---|
| 1 | `/admin/pilotage` | **Tableau de bord** | H1 | Already the nav and breadcrumb label. The current H1 is the institution's name, not the page's name (see D3). |
| 2 | `/admin/dossiers` | **Dossiers** | nav, breadcrumb, H1 | "dossiers" is in every cross-link: "Voir tous les dossiers", "Tous les dossiers", "Retour aux dossiers", "Voir dossiers". The page opens on "Tous", so "en instance" names a filter and not the page. This also settles 2a. The home tile "Dossiers en Instance" → `?status=PENDING_REVIEW` (`app/home/page.tsx:87`) names a filtered link correctly and stays. |
| 3 | `/admin/dossiers/[id]` | **Dossier #{ref}** | H1 | The entity is called "dossier" everywhere else on the page and in the console. "Soumission" appears only in this H1. |
| 4 | `/admin/equipe` | **Équipe territoriale** | nav, breadcrumb, H1 | "Équipe" is in two of the three surfaces and in the commit history. The qualifier, taken from the current H1, says whose team it is. The nav label "Administrateurs territoriaux" was set on purpose in `08618fba`. If you want to keep it, apply it to the breadcrumb and H1 instead. |
| 5 | `/admin/campagnes` | **Campagnes** | H1 | Short label under a hub. "Recensement" is also inaccurate now: the page lists registration campaigns as well (`7eb6814c`). |
| 7 | `/admin/questionnaires` | **Questionnaires** | H1 | Short label under a hub. |
| 9 | `/admin/inscriptions/nouvelle` | **Nouvelle inscription** | H1, plus the button on Établissements | Already used three times: hidden nav, breadcrumb and the Inscriptions button. The Établissements button "+ Nouvel Établissement" (`etablissements/page.tsx:345`) opens this same form, so it should use the same name. If the "admin-assisted" meaning matters, it can go in a subtitle (adding one is a change to what the page shows, so it is not included here). |
| 12 | `/admin/etablissement-detail/approbation` | **Validation du compte — {company name}** | H1. Hidden nav label → "Validation du compte" | This is a detail-type page, so it is titled by its entity. The format matches the existing dialog title in `inscriptions/page.tsx:387`. The hidden nav label is never rendered and changes only for grep-ability. |
| 13 | `/admin/centre-qualite` | **Centre Qualité** | H1. Register H2 → **Registre des anomalies** | Already the nav, breadcrumb and pilotage link label. The H2 is aligned with its tab (13a). The H2 keeps its `(count)` suffix. |
| 14 | `/admin/diffusion` | **Exports** | H1 | Short label under a hub. The legacy "Statistiques & Diffusion" also blurs the LMIS/Observatory line (CLAUDE.md §4): this page is LMIS export, not public statistical dissemination. |
| 15 | `/admin/sectors` | **Nomenclatures** | breadcrumb, H1 (both in `layout.tsx:27`) | The word "Nomenclature" appears in the nav, the page H2 and the legacy nav. "Jeux de données" matches no route at all. It is a stale `nav` value in the layout fallback table. |
| 16 | `/admin/utilisateurs` | **Utilisateurs & rôles** | nav | Already the breadcrumb and H1. It also separates this page (ONEFOP agents and their roles) from Annuaire's "Utilisateurs" tab (D2). The alternative is "Utilisateurs" on the breadcrumb and H1, but that makes the D2 collision worse. |
| 18 | `/admin/journal-audit` | **Journal d'audit** | nav, H1 | "journal" is in every cross-link ("Voir le journal", "Voir le journal complet" ×2, "Journal d'Audit Récent") and in the breadcrumb. "Traçabilité" appears only in the nav. |
| 19 | `/admin/parametres` | **Paramètres** | H1 | Short label under a hub. |

Hub labels stay as they are. All six already match their breadcrumb first item.

### Cross-links that stay as they are

Action-phrased links ("Voir tous les dossiers →", "Gérer les campagnes →", "Voir le
journal complet →", "Voir tout") contain the page name or point to it, so they are not
mismatches. KPI tiles ("Déclarations à examiner", "Retours à corriger", "Alertes
qualité") name the filtered set they open, not the page.

### Legacy `/home` launcher — proposed as a separate decision

`lib/role-navigation.ts` and the `/home` tiles in `app/home/page.tsx:58-118` use a
parallel set of names:

- Tableau de Bord National / Régional / Territorial
- Instruction & Visas
- Instruction des Dossiers
- Statistiques & Diffusion
- Nomenclature des Secteurs
- Utilisateurs ONEFOP

They also give `/admin/annuaire` two different names depending on role:
"Répertoire des Établissements" and "Gestion des Utilisateurs & Entités"
(`role-navigation.ts:106,115`).

The file header says these labels are ported "field-for-field" from Flutter's
`_buildTabs`. Aligning them would make the React and Flutter navs diverge, or would
require a Flutter change. Both are outside a React label pass. **Not proposed in
Phase 4.** I recommend a separate decision on whether the `/home` launcher should copy
the console labels.

---

## Step 4 — Ranked changes

How the rubric is applied here:

- **TRIVIAL**: one string in the page's own file. No logic.
- **MINOR**: string change plus a test expectation update. **None in this survey.** No
  test pins any admin label. `nav-profiles.test.ts:165-166` uses synthetic labels "A"
  and "B", and there is no e2e suite in `react-web`. So label changes are checked by
  type-check and in the browser, not by unit tests.
- **NON-TRIVIAL**: a change in a shared file whose string renders on more than one page
  (`_routes.ts` labels appear in the hub's tab row on every page of that hub), or a
  change that spans several files.

| Rank | ID | Change | Files |
|---|---|---|---|
| TRIVIAL | T1 | Pilotage H1 → "Tableau de bord" | `pilotage/page.tsx:459` |
| TRIVIAL | T2 | Dossier detail H1 "Soumission" → "Dossier #{ref}" | `dossiers/[id]/page.tsx:371` |
| TRIVIAL | T3 | Campagnes H1 → "Campagnes" | `campagnes/page.tsx:177` |
| TRIVIAL | T4 | Questionnaires H1 → "Questionnaires" | `questionnaires/page.tsx:63` |
| TRIVIAL | T5 | Nouvelle inscription H1 → "Nouvelle inscription" | `inscriptions/nouvelle/page.tsx:225` |
| TRIVIAL | T6 | Établissements button → "Nouvelle inscription" | `etablissements/page.tsx:345` |
| TRIVIAL | T7 | Approbation H1 → "Validation du compte — {name}" (template string, no new logic; `company` is already in scope) | `etablissement-detail/approbation/page.tsx:204` |
| TRIVIAL | T8 | Centre Qualité H1 → "Centre Qualité"; register H2 → "Registre des anomalies" | `centre-qualite/page.tsx:205,476` |
| TRIVIAL | T9 | Exports H1 → "Exports" | `diffusion/page.tsx:455` |
| TRIVIAL | T10 | Paramètres H1 → "Paramètres" | `parametres/page.tsx:209` |
| TRIVIAL | T11 | Journal d'audit H1 → "Journal d'audit" | `journal-audit/page.tsx:241` |
| TRIVIAL | T12 | Sectors fallback: `title` and `nav` → "Nomenclatures". This is in the shared layout, but the entry affects only `/admin/sectors` | `app/admin/layout.tsx:27` |
| TRIVIAL | T13 | Hidden nav "Approbation établissement" → "Validation du compte" (never rendered) | `_routes.ts:115` |
| NON-TRIVIAL | N1 | Dossiers → "Dossiers" in nav, breadcrumb and H1. The nav string shows in the Supervision tab row on 3 pages | `_routes.ts:66`, `dossiers/page.tsx:425-426` |
| NON-TRIVIAL | N2 | Équipe → "Équipe territoriale" in nav, breadcrumb and H1. Nav string shows on 3 Supervision pages; it reverses a deliberate rename from `08618fba` | `_routes.ts:71`, `equipe/page.tsx:138-139` |
| NON-TRIVIAL | N3 | Utilisateurs nav → "Utilisateurs & rôles". Shows in the Administration tab row on 4 pages | `_routes.ts:163` |
| NON-TRIVIAL | N4 | Journal nav "Traçabilité" → "Journal d'audit". Shows in the Administration tab row on 4 pages | `_routes.ts:168` |

I suggest two commits: T1–T13 together, then N1–N4 together. Your phase-gate convention
allows splitting them further.

---

## Decisions (2026-10-06)

- **Scope:** apply all of T1–T13 and N1–N4, as two commits (trivial, then
  non-trivial), with a review stop between them.
- **N2 Équipe:** "Équipe territoriale" on the nav, breadcrumb and H1. This reverts the
  nav label "Administrateurs territoriaux" from `08618fba`, which was a bare rename with
  no external justification cited.
- **N3 Utilisateurs:** the nav becomes "Utilisateurs & rôles". This keeps it distinct
  from Annuaire's "Utilisateurs" tab, and the page manages roles too.
- **T7 as applied:** the H1 uses the full `company.name`, matching the Inscriptions
  review dialog. It falls back to "Validation du compte" when the name is empty.
- **Out of scope, not touched:** `lib/role-navigation.ts` (it mirrors Flutter) and the
  `/home` launcher labels. D1–D4 are deferred (below).

---

## Deferred — domain questions

Not changed in Phase 4. Each needs a domain or product decision first.

### D1 — "Couverture" has two meanings (domain)
- **Inscriptions › Couverture** (`inscriptions/page.tsx:243`, `lib/pilotage-targets.ts:189`):
  registration coverage against quotas.
- **Pilotage**: "Taux de couverture des entreprises ciblées" (`pilotage/page.tsx:142`) is
  campaign declaration completion. "Couverture Régionale" (`:181`) is declaration counts
  by region.
- A third use: the Équipe subtitle "couverture des ressorts" (`equipe/page.tsx:140`)
  means agents' activity across territories.

Which meaning keeps the word is a domain decision. No rename is proposed.

### D2 — Two user lists and two establishment lists (IA/domain)
- `/admin/utilisateurs` ("Utilisateurs & rôles", ONEFOP agents) and **Annuaire ›
  Utilisateurs** (`fr.json:59`) both list accounts.
- **Annuaire › Entités** (`fr.json:60`) and `/admin/etablissements` both list declaring
  entities.

Whether these are different populations or duplicated views decides whether the names
should differ or the views should merge. N3 helps on the user side without settling the
question.

### D3 — Pilotage H1 is the institution's name (product)
"Observatoire National de l'Emploi" is a truncated form of ONEFOP's own name
(Observatoire National de l'Emploi et de la Formation Professionnelle). It is not the
page's name. If the institution's name is meant to appear, it belongs in the console
shell or sidebar header, not in one page's H1. "Observatoire" is also the reserved name
for the analytics layer above the LMIS (CLAUDE.md §4). T1 assumes the branding was not
deliberate.

### D4 — Questionnaires subtitle says "DSMO" (domain)
`questionnaires/page.tsx:64`: "…pour le recueil statistique DSMO" sits on a page of
ONEFOP questionnaires. The subtitle is content, not a label, so it is not proposed here.
Please check with the ONEFOP domain owner.

## Structural findings — out of scope for Phase 4 (each changes what a page shows)

- **S1** `/admin/etablissement-detail` renders **two `<h1>`s**: the header's short name
  (`:245`) and the hero card's full name (`:270-271`). Their loading fallbacks also
  differ: "Établissement" for the title and "—" for the breadcrumb (`NOT_PROVIDED`).
- **S2** `/admin/dossiers/[id]` has no breadcrumb and does not use `AdminPageHeader`. It
  has its own header block (`:334-408`). It is the only detail page without a
  breadcrumb.
- **S3** `/admin/sectors` has no header of its own. It is the last page still using the
  layout's `PAGE_TITLES` fallback. The layout comment (`layout.tsx:19-25`) lists the
  refactored pages and is out of date. The unused i18n key `adminSectorsPage.pageTitle`
  is a dead string.
- **S4** `/admin/diffusion` subtitle hardcodes "Campagne 2026" (`diffusion/page.tsx:456`).
- **S5** The Contrôle Qualité hub has a single entry, so its breadcrumb reads
  "Contrôle Qualité › Centre Qualité" and has no tab row. This is not a mismatch, but the
  breadcrumb is redundant.
