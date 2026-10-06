# Assisted registration wizard — translation plan (survey)

Date: 2026-10-06
Scope: ONEFOP. Read-only survey; no source file was changed.
Target: `react-web/src/app/admin/inscriptions/nouvelle/page.tsx` (518 lines)

---

## 0. Headline findings

1. **The page is not French-only in the mechanism, only in the copy.** It already imports
   `useTranslations` from `next-intl` (`page.tsx:5`) and calls
   `useTranslations("registerPage")` (`page.tsx:75`) for three strings (`emailRoleHint`,
   `emailUnavailable`, `emailAvailable`, lines 276/279/280).
2. **The comment at `page.tsx:33-35` is stale/wrong.** It says there is "no next-intl provider on
   /admin". The provider is in the root layout (`react-web/src/app/layout.tsx`:
   `NextIntlClientProvider locale={locale} messages={messages}` wrapping all routes), and
   `admin/layout.tsx:31,72` already calls `t("common.loading")`. The hardcoded
   `const LOCALE = "fr"` (`page.tsx:36`) is therefore a choice, not a constraint.
3. **Consequence today:** locale comes from the `NEXT_LOCALE` cookie (`src/i18n/request.ts`). If the
   cookie is `en` (set by the ONEFOP wizard's switcher, cookie `path=/`), this page renders French
   copy plus three English strings, and `<html lang="en">` (root layout sets `lang={locale}`)
   over mostly French content.
4. **No locale switcher anywhere in the admin shell.** See §3.4.
5. **fr.json / en.json have no key drift**: 1001 flattened leaf keys each, identical key sets.

---

## 1. STEP 1 — Hardcoded user-facing strings

### 1a. Target file `src/app/admin/inscriptions/nouvelle/page.tsx`

All local components (`Section`, `FieldGrid`, `Text`, `Select`, `EntityFieldInput`) are defined in
the same file (lines 399-517); there is no other file in `admin/inscriptions/nouvelle/`.

| # | Line | Literal | Kind | Variable? |
|---|------|---------|------|-----------|
| 1 | 139 | `Choisissez le type de déclarant.` | validation error | no |
| 2 | 141 | `Le nom et le prénom du répondant sont obligatoires.` | validation error | no |
| 3 | 143 | `L'adresse e-mail du déclarant est obligatoire.` | validation error | no |
| 4 | 144 | `Cette adresse e-mail est déjà utilisée par un autre compte.` | validation error | no |
| 5 | 146 | `Région, département et arrondissement sont obligatoires.` | validation error | no |
| 6 | 150 | `` `« ${localized(field.label, LOCALE)} » est obligatoire.` `` | validation error | **yes** — template literal, field label from ENTITY_CONFIGS |
| 7 | 224 | `Chargement…` | loading state | no |
| 8 | 225 | `Vous n'avez pas accès à cette page.` | forbidden state | no |
| 9 | 230 | `Déclarants` | breadcrumb | no |
| 10 | 230 | `Inscriptions` | breadcrumb | no |
| 11 | 230, 231, 352 | `Nouvelle inscription` | breadcrumb, page `<h1>` title, dialog button | no |
| 12 | 237-239 | `Enregistrez un déclarant rencontré sur le terrain, par téléphone ou au guichet. Cette inscription sera soumise à validation comme une inscription auto-service. Le demandeur pourra se connecter une fois approuvé.` | lede | no |
| 13 | 245 | `Fermer` | **aria-label** (error notice close) | no |
| 14 | 245 | `×` | glyph (button text) | no — leave as glyph |
| 15 | 255, 256 | `Type de déclarant` | section `<h2>` + radiogroup **aria-label** | no |
| 16 | 265 | `localized(ENTITY_CONFIGS[type].title, LOCALE)` | radio labels | data, not a literal (see §4) |
| 17 | 271 | `Répondant` | section heading | no |
| 18 | 273 | `Prénom` | label | no |
| 19 | 274 | `Nom` | label | no |
| 20 | 275 | `Adresse e-mail` | label | no |
| 21 | 276 | `t("emailRoleHint")` | hint | **already translated** |
| 22 | 279 | `⚠ ` + `t("emailUnavailable")` | live status | already translated (glyph is literal) |
| 23 | 280 | `✓ ` + `t("emailAvailable")` | live status | already translated (glyph is literal) |
| 24 | 284 | `Fonction` | label | no |
| 25 | 285 | `Téléphone du déclarant` | label | no |
| 26 | 286 | `Téléphone 2` | label | no |
| 27 | 291 | `` `Identification — ${localized(config.title, LOCALE)}` `` | section heading | **yes** — template literal, entity title |
| 28 | 305 | `Localisation` | section heading | no |
| 29 | 308 | `Pré-rempli avec votre ressort. Une inscription hors de votre ressort est refusée.` | helper text | no |
| 30 | 313 | `Région` | label | no |
| 31 | 324 | `Département` | label | no |
| 32 | 333 | `Arrondissement` | label | no |
| 33 | 339 | `Enregistrement…` | button (pending) | no |
| 34 | 339 | `Enregistrer l'inscription` | primary button | no |
| 35 | 341 | `Annuler` | secondary link | no |
| 36 | 348 | `Inscription enregistrée` | dialog eyebrow | no |
| 37 | 349 | `result?.company.name` | dialog title | backend data — not translated |
| 38 | 353 | `Voir la file` | dialog link | no |
| 39 | 360-361 | `Le dossier est en attente de validation. Transmettez ces identifiants au déclarant : il pourra se connecter une fois le dossier approuvé.` | confirmation text | no |
| 40 | 365 | `E-mail de connexion` | label | no |
| 41 | 370 | `Identifiant d'établissement` | label | no |
| 42 | 377 | `Mot de passe temporaire` | label | no |
| 43 | 385 | `Copier le mot de passe` | button | no |
| 44 | 387 | `Copié.` | success feedback | no |
| 45 | 390 | `Ce mot de passe ne sera plus affiché. Notez-le avant de fermer cette fenêtre.` | warning (role=status) | no |
| 46 | 469, 497 | `Sélectionner…` | `<option>` placeholder (Select, EntityFieldInput) | no |
| 47 | 437, 495 | ` *` | required marker (aria-hidden) | not text — leave |
| 48 | 471 | `{option}` (regions/departments/subdivisions) | options | backend territory names — not translated |
| 49 | 488-499 | `localized(field.label/hint/option.label, LOCALE)` | entity field labels, hints, options | ENTITY_CONFIGS data (§4) |
| 50 | 111 | `setError(e.message)` | error banner | **backend message**, verbatim (see §6 manual decisions) |

No pluralization in this file. Interpolations: #6 (field label) and #27 (entity title) only.

### 1b. Shared admin-only components rendered on this page (out of the target file)

These are admin-only but shared by every admin page; translating them is a console-wide change.

| File:line | Literal | Kind | Rendered here? |
|-----------|---------|------|----------------|
| `src/components/admin/AdminPageHeader.tsx:21` | `Fil d'Ariane` | nav aria-label | yes (breadcrumb passed) |
| `src/components/admin/AdminPageHeader.tsx:236` | `Retour` | back-link aria-label | yes (`backHref` passed) |
| `src/components/admin/AdminPageHeader.tsx:102,139` | `Sous-navigation` | nav aria-label | **no** — `backHref` set and no `tabs`, so sub-nav hidden |
| `src/components/admin/AdminDialog.tsx:46` | `Fermer` | dialog close aria-label | yes |
| `src/components/admin/AdminHeaderActions.tsx:77,110` | `Aucune campagne active`, `Chargement…` | campaign pill | **no** — `showCampaignPill={false}` |
| `src/components/admin/AdminHeaderActions.tsx:120` | `Ressort territorial` | title attribute | yes |
| `src/components/admin/AdminHeaderActions.tsx:133` | `Ressort : {scope}` | chip text, **interpolated** | yes |
| `src/lib/admin-data-state.ts:69-84` | `Département {x}`, `Région {x}`, `Départemental (non assigné)`, `Régional (non assigné)`, `National`; `:33` `Non renseigné` | scope label, interpolated | yes (feeds the chip) |
| `src/components/admin/AdminHeaderActions.tsx:173,174` | `Recherche` (aria-label), `Rechercher` (title) | search link | yes |
| `src/components/admin/AdminHeaderActions.tsx:200,201` | `Cameroun` (aria-label), `République du Cameroun` (title) | flag | yes |
| `src/components/admin/NotificationBell.tsx:107` | `` `Notifications (${count} non lue${count > 1 ? "s" : ""})` `` | aria-label + title, **hand-rolled plural** | yes (`showBell` defaults true) |
| `src/components/admin/NotificationBell.tsx:169,191,199,228` | `Notifications`, `Chargement…`, `Aucune notification.`, `Non lue` | panel | yes when opened |
| `src/app/admin/layout.tsx:137` | `Fermer le menu` / `Ouvrir le menu` | aria-label | yes (mobile) |
| `src/app/admin/layout.tsx:80,85,95,117` | `Accès restreint`, `← Retour au portail`, `Compte agent`, `Agent` | shell | shell-level |

Not inventoried exhaustively: `AdminSidebar.tsx` and `src/app/admin/_routes.ts` (nav labels, e.g. `_routes.ts:91` `Déclarants`, `:97` `Inscriptions` — the same words as the breadcrumb, #9/#10).

---

## 2. STEP 2 — Message catalogue convention and reuse

### Convention (from `react-web/messages/fr.json` / `en.json`)

- Two files, `fr.json` and `en.json`, one per locale (`src/i18n/config.ts`: `locales = ["fr","en"]`,
  `defaultLocale = "fr"`).
- **Top-level namespace = one per page or component, camelCase.** Pages mirror the route with a
  `Page` suffix: `adminSectorsPage` (`/admin/sectors`), `homeDeclarationsNewPage`
  (`/home/declarations/new`), `registerPage`, `loginPage`. Components use the component name:
  `companiesDirectory`, `usersDirectory`, `wizardShell`, `vtWizard`. Shared: `common`
  (`cancel`, `save`, `retry`, `loading`), `authShared`.
- **Nesting:** flat inside the namespace (depth 2) for every namespace except
  `onefopLegalAcknowledgment` (depth 3) and `modernJobs` (depth 5).
- **Key casing:** camelCase with a role suffix/prefix: `…Label`, `…Title`, `…Subtitle`,
  `…Button`, `…Placeholder`, `…Hint`, `…Link`, `…AriaLabel` (`companiesDirectory.closeAriaLabel`),
  `…Snackbar`, `…Notice`, `error…` prefix (`registerPage.errorSelectRegion`).
- 39 namespaces, 1001 leaf keys in each file. **No fr/en drift** (0 keys only in fr, 0 only in en).
- **No existing admin-inscriptions namespace.** Admin namespaces that exist: `adminSectorsPage`,
  `companiesDirectory`, `usersDirectory`, `declarationsListAdmin`, `sendNotificationForm`.
- Route-mirroring name for this page would be **`adminInscriptionsNouvellePage`** (route segment is
  the French `nouvelle`; the `homeDeclarationsNewPage` precedent comes from a route literally named
  `new`). `adminInscriptionsNewPage` is the alternative; naming is a decision for the implementer.

### Overlap with keys the public wizard already uses (`registerPage.*` unless noted)

Exact fr match (reusable as-is):

| Assisted literal | Existing key | fr | en |
|---|---|---|---|
| Répondant | `registerPage.respondentTitle` | Répondant | Respondent |
| Prénom | `registerPage.firstNameLabel` | Prénom | First name |
| Nom | `registerPage.lastNameLabel` | Nom | Last name |
| Fonction | `registerPage.functionLabel` | Fonction | Function |
| Téléphone 2 | `registerPage.phone2Label` | Téléphone 2 | Phone 2 |
| Localisation | `registerPage.locationTitle` | Localisation | Location |
| Région | `registerPage.regionLabel` | Région | Region |
| Département | `registerPage.departmentLabel` | Département | Department |
| Arrondissement | `registerPage.subdivisionLabel` | Arrondissement | Subdivision |
| Chargement… | `common.loading` | Chargement… | Loading… |
| Annuler | `common.cancel` | Annuler | Cancel |

Near matches (wording differs — reuse changes the assisted wizard's text):

| Assisted literal | Closest key | Its fr / en |
|---|---|---|
| Cette adresse e-mail est déjà utilisée par un autre compte. | `registerPage.errorEmailInUse` | Cette adresse email est déjà utilisée. / This email address is already in use. |
| Choisissez le type de déclarant. | `registerPage.errorEntityTypeRequired` | Choisissez le type de votre structure. / Choose your organization type. (2nd-person — wrong voice for staff) |
| Sélectionner… | `registerPage.selectPlaceholder` | — Sélectionner — / — Select — (exact fr match exists cross-namespace: `vtWizard.select` "Sélectionner…" / "Select…") |
| Téléphone du déclarant | `registerPage.phone1Label` | Téléphone 1 / Phone 1 |
| Adresse e-mail | `registerPage.professionalEmailLabel` | Email professionnel / Professional email |
| Identifiant d'établissement | `registerPage.establishmentIdLabel` | Identifiant établissement : {establishmentId} / Establishment ID: {establishmentId} (different shape — includes value) |
| E-mail de connexion | `registerPage.summaryLoginLabel` | Identifiant de connexion / Sign-in identifier |
| Copié. | `loginPage.copiedLabel` | Copié ✓ / Copied ✓ |
| Vous n'avez pas accès à cette page. | `adminSectorsPage.accessDeniedMessage` | Votre compte n'a pas accès à cette page. / Your account does not have access to this page. |
| Fermer (aria) | `companiesDirectory.closeAriaLabel` | Fermer / Close (exact, but another component's namespace) |
| Enregistrement… | `submissionPanel.savingButton` | Enregistrement… / Saving… (exact, other namespace) |
| Type-de-déclarant radio labels | `registerPage.entityOption*` | e.g. ONG ou association / NGO or association (see §4) |

Already used by the assisted wizard: `registerPage.emailRoleHint`, `registerPage.emailUnavailable`,
`registerPage.emailAvailable`.

Drift noticed in relevant namespaces: **none in key sets.** Content oddities (not drift):
`registerPage.stepRespondent` = "Déclarant" while `registerPage.respondentTitle` = "Répondant" —
both translate to "Respondent".

---

## 3. STEP 3 — How register/login read translations

### 3.1 Hooks and package

- Package: **`next-intl` ^4.14.4** (`package.json`), wired by `createNextIntlPlugin("./src/i18n/request.ts")` in `next.config`.
- `src/app/register/page.tsx:6`: `import { useLocale, useTranslations } from "next-intl";`
  - `:124` `const t = useTranslations();` (root, unscoped)
  - `:131` `const locale = asUiLocale(useLocale());` — only for ENTITY_CONFIGS `{fr,en}` data.
- `src/app/login/page.tsx:10`: `import { useTranslations } from "next-intl";`, `:20` `const t = useTranslations();` (no `useLocale`).
- Components: `RegistrationProgress.tsx:52` uses a scoped `useTranslations("registerPage")`;
  `RegistrationReview.tsx:31,35` uses `useTranslations()` + `asUiLocale(useLocale())`.

### 3.2 Reading a key

Fully-qualified dotted path against the root translator: `t("registerPage.firstNameLabel")`,
`t("loginPage.whatsappLink")`, `t("common.loading")`. Scoped translators drop the namespace:
`t("stepIndicator", …)`. One dynamic key: `register/page.tsx:1603`
``t(`registerPage.passwordRule${…}`)``.

### 3.3 Interpolation, rich text, plurals

- **ICU placeholders** via a values object: `register/page.tsx:724`
  `t("registerPage.entityChangeSnackbar", { step: t("registerPage.stepEntityInfo") })` →
  message `"Étape « {step} » réinitialisée."`; `RegistrationProgress.tsx:67`
  `t("stepIndicator", { current, total })`.
- **ICU plurals** in the message string: `register/page.tsx:1819`
  `t("registerPage.missingFieldsNotice", { count, names })` →
  `"{count, plural, one {Il reste # champ obligatoire : {names}} other {…}}"`. Plurals/`select`
  also used elsewhere (`sendSuccessMessage`, `resultsCount`, …).
- **Rich text:** `t.rich` / `t.markup` are **not used anywhere in `src/`**.

### 3.4 Locale switcher

- A switcher exists: `src/components/LocaleSwitcher.tsx` (writes `NEXT_LOCALE` cookie,
  `path=/; max-age=31536000`, then `router.refresh()`).
- It is rendered **only** in `src/components/onefop/ModernJobsHeader.tsx:251` (ONEFOP wizard
  masthead).
- **Not** in `src/app/admin/layout.tsx`, `AdminSidebar`, `AdminHeaderActions`, or any
  `src/components/admin/*` file; also not on `register/page.tsx` or `login/page.tsx`.
- The locale is read server-side from the cookie (`src/i18n/request.ts`) and handed down by
  `NextIntlClientProvider` in the root layout, so admin pages follow whatever the cookie says.

Admin files already on next-intl: `admin/layout.tsx`, `admin/sectors/page.tsx`,
`admin/annuaire/page.tsx`, `admin/inscriptions/nouvelle/page.tsx` (partial),
`components/admin/CompaniesDirectory.tsx`, `components/admin/UsersDirectory.tsx`.

---

## 4. STEP 4 — ENTITY_CONFIGS uses `{fr, en}` objects (confirmed)

- Type: `src/lib/register-i18n.ts:28-31` `interface LocalizedText { fr: string; en: string; }`;
  `:47-49` `localized(text, locale) => text[locale]`; `:43-45` `asUiLocale()` maps any `en*` to
  `"en"`, else `"fr"`.
- `src/lib/register-constants.ts:91-104` `EntityField.label: LocalizedText`, `hint?: LocalizedText`;
  `:106-110` `EntityConfig.title: LocalizedText`; options are `RegisterOption { value; label: LocalizedText }`
  (`src/lib/register-options.ts:14-17`).
- `src/lib/register-constants.ts:217` `export const ENTITY_CONFIGS: Record<EntityType, EntityConfig>`;
  e.g. `:220` `title: { fr: "Entreprise", en: "Company" }`, `:222`
  `label: { fr: "Raison sociale", en: "Company name" }`.
- Rationale recorded in code: `register-i18n.ts:22-27` — kept out of `messages/*.json` because they
  are "the questionnaire's own field set, not UI copy", versioned with field keys.

How consumers pick the language:

- Public wizard: `register/page.tsx:131` `asUiLocale(useLocale())`, then
  `localized(field.label, locale)` (`:345,347,360,1022,1241,1317,1334,1490`).
  Same pattern in `RegistrationReview.tsx:35` and `register-summary.ts:64,87,112,122` (locale passed in).
- Assisted wizard: hardcoded `const LOCALE = "fr"` (`page.tsx:36`) passed to `localized()` at
  `:150, :265, :291, :488, :489, :499`. Switching it to `asUiLocale(useLocale())` is the same
  mechanism the public wizard uses.

Trade-off (no decision taken):

| Keep `{fr,en}` data | Migrate to message keys |
|---|---|
| Labels stay next to `key`/`required`/`kind`; one place to edit a field. | Translators work in one catalogue; standard tooling (missing-key checks, ICU). |
| Already shared by public wizard, review summary, completeness/required checks and tests (`register-constants.test.ts`, `register-required.test.ts`, `register-entity-sections.test.ts`). | Touches all those consumers; tests that index labels would change. |
| Assisted wizard needs only `useLocale()` — near-zero cost. | Requires generating ~one key per field/hint/option across 7 entity types. |
| TypeScript guarantees both languages exist per label. | Parity relies on the fr/en key-set check (currently clean). |
| Only two locales by construction (`UiLocale = "fr" \| "en"`). | Adding a third locale is a catalogue change only. |
| Mirrors the Dart `register_constants.dart` port and ONEFOP Section 1 subset. | Splits questionnaire wording from its field definition (the concern `register-i18n.ts:22-27` raises). |

Data oddities spotted (for the domain owner, not changed):
- `register-constants.ts:242` cooperative `title: { fr: "Coopérative", en: "Coopérative" }` — EN value uses French spelling.
- Entity titles are short codes in places: `:259` `CTD`/`RLA`, `:274` `ONG`/`NGO`; `:323-326`
  vocationalTraining title includes "(enquête ONEFOP)". The assisted wizard uses these as radio
  labels (`page.tsx:265`), whereas the public wizard deliberately uses `registerPage.entityOption*`
  keys whose comment (`register/page.tsx:100-104`) says labels "avoid administrative codes (CTD/ONG/CFP)".

---

## 5. STEP 5 — Non-visible text

| Location | Text | Type |
|---|---|---|
| `page.tsx:245` | Fermer | aria-label |
| `page.tsx:256` | Type de déclarant | aria-label (radiogroup) |
| `page.tsx:278` | (`aria-live="polite"` region — content already translated) | live region |
| `page.tsx:389` | role=status warning (#45) — visible too | status |
| `page.tsx:243` | role=alert error banner — content from #1-#6 or backend | alert |
| `AdminPageHeader.tsx:21` | Fil d'Ariane | aria-label |
| `AdminPageHeader.tsx:236` | Retour | aria-label |
| `AdminDialog.tsx:46` | Fermer | aria-label |
| `AdminHeaderActions.tsx:120` | Ressort territorial | title |
| `AdminHeaderActions.tsx:173-174` | Recherche / Rechercher | aria-label / title |
| `AdminHeaderActions.tsx:200-201` | Cameroun / République du Cameroun | aria-label / title |
| `NotificationBell.tsx:107` | Notifications (N non lue(s)) | aria-label + title, hand-rolled plural |
| `admin/layout.tsx:137` | Fermer le menu / Ouvrir le menu | aria-label |

- **Page `<title>` / metadata:** none for this route. The page and `admin/layout.tsx` are
  `"use client"` and export no metadata, so the tab title is the root `metadata.title`
  `"CAM-LEAP"` (`src/app/layout.tsx`), whose `description` is French-only. A localized title
  would need a server `layout.tsx`/`generateMetadata` for the route.
- `<html lang>` is set from the locale (root layout) — will be correct once the page actually follows the locale.
- **alt text:** none in the target file (no `<img>`).
- **title attributes:** none in the target file; only in shared chrome above.
- **Toasts/snackbars:** none in the target file (errors use an inline alert; "Copié." is inline).

---

## 6. STEP 6 — Proposed key table

Proposed namespace for new keys: `adminInscriptionsNouvellePage` (abbreviated **`AIN.`** below).
Reused keys keep their existing namespace (the page would switch to an unscoped
`useTranslations()`, as `register/page.tsx` does). English values for new keys are proposals.

| # | String (fr) | file:line | Proposed key | fr value | en value | New / reuse |
|---|---|---|---|---|---|---|
| 1 | Choisissez le type de déclarant. | page.tsx:139 | `AIN.errorEntityTypeRequired` | Choisissez le type de déclarant. | Choose the declarant type. | new (near: `registerPage.errorEntityTypeRequired`, wrong voice) |
| 2 | Le nom et le prénom du répondant sont obligatoires. | :141 | `AIN.errorRespondentNameRequired` | (same) | The respondent's first and last name are required. | new |
| 3 | L'adresse e-mail du déclarant est obligatoire. | :143 | `AIN.errorEmailRequired` | (same) | The declarant's email address is required. | new |
| 4 | Cette adresse e-mail est déjà utilisée par un autre compte. | :144 | `AIN.errorEmailInUse` | (same) | This email address is already used by another account. | new **or** reuse `registerPage.errorEmailInUse` (wording changes) |
| 5 | Région, département et arrondissement sont obligatoires. | :146 | `AIN.errorLocationRequired` | (same) | Region, department and subdivision are required. | new |
| 6 | « {field} » est obligatoire. | :150 | `AIN.errorFieldRequired` | « {field} » est obligatoire. | "{field}" is required. | new (ICU `{field}`) |
| 7 | Chargement… | :224 | `common.loading` | Chargement… | Loading… | reuse |
| 8 | Vous n'avez pas accès à cette page. | :225 | `AIN.accessDeniedMessage` | (same) | You do not have access to this page. | new **or** reuse `adminSectorsPage.accessDeniedMessage` (wording changes) |
| 9 | Déclarants | :230 | `AIN.breadcrumbDeclarants` | Déclarants | Declarants | new (same label hard-coded in `_routes.ts:91`) |
| 10 | Inscriptions | :230 | `AIN.breadcrumbInscriptions` | Inscriptions | Registrations | new (same label in `_routes.ts:97`) |
| 11 | Nouvelle inscription | :230, :231, :352 | `AIN.title` | Nouvelle inscription | New registration | new (one key, 3 uses) |
| 12 | Enregistrez un déclarant rencontré… | :237-239 | `AIN.lede` | (full paragraph) | Register a declarant met in the field, by phone or at the counter. This registration will be submitted for validation like a self-service registration. The applicant can sign in once approved. | new |
| 13 | Fermer | :245 | `AIN.closeAriaLabel` | Fermer | Close | new **or** reuse `companiesDirectory.closeAriaLabel` (exact, cross-namespace) |
| 14 | Type de déclarant | :255, :256 | `AIN.entityTypeTitle` | Type de déclarant | Declarant type | new (heading + aria-label) |
| 15 | (entity titles) | :265 | — | ENTITY_CONFIGS `title` | ENTITY_CONFIGS `title` | data; switch `LOCALE` to `useLocale()` **or** reuse `registerPage.entityOption*` (decision) |
| 16 | Répondant | :271 | `registerPage.respondentTitle` | Répondant | Respondent | reuse |
| 17 | Prénom | :273 | `registerPage.firstNameLabel` | Prénom | First name | reuse |
| 18 | Nom | :274 | `registerPage.lastNameLabel` | Nom | Last name | reuse |
| 19 | Adresse e-mail | :275 | `AIN.emailLabel` | Adresse e-mail | Email address | new |
| 20 | (hint) | :276 | `registerPage.emailRoleHint` | — | — | already keyed |
| 21 | (status) | :279 | `registerPage.emailUnavailable` | — | — | already keyed |
| 22 | (status) | :280 | `registerPage.emailAvailable` | — | — | already keyed |
| 23 | Fonction | :284 | `registerPage.functionLabel` | Fonction | Function | reuse |
| 24 | Téléphone du déclarant | :285 | `AIN.phone1Label` | Téléphone du déclarant | Declarant's phone | new (near: `registerPage.phone1Label` "Téléphone 1") |
| 25 | Téléphone 2 | :286 | `registerPage.phone2Label` | Téléphone 2 | Phone 2 | reuse |
| 26 | Identification — {entityType} | :291 | `AIN.identificationTitle` | Identification — {entityType} | Identification — {entityType} | new (ICU `{entityType}`) |
| 27 | Localisation | :305 | `registerPage.locationTitle` | Localisation | Location | reuse |
| 28 | Pré-rempli avec votre ressort… | :308 | `AIN.locationScopeNote` | Pré-rempli avec votre ressort. Une inscription hors de votre ressort est refusée. | Pre-filled with your jurisdiction. A registration outside your jurisdiction is refused. | new |
| 29 | Région | :313 | `registerPage.regionLabel` | Région | Region | reuse |
| 30 | Département | :324 | `registerPage.departmentLabel` | Département | Department | reuse |
| 31 | Arrondissement | :333 | `registerPage.subdivisionLabel` | Arrondissement | Subdivision | reuse |
| 32 | Enregistrement… | :339 | `AIN.submittingLabel` | Enregistrement… | Saving… | new (exact fr exists in `submissionPanel.savingButton`) |
| 33 | Enregistrer l'inscription | :339 | `AIN.submitButton` | Enregistrer l'inscription | Save registration | new |
| 34 | Annuler | :341 | `common.cancel` | Annuler | Cancel | reuse |
| 35 | Inscription enregistrée | :348 | `AIN.successEyebrow` | Inscription enregistrée | Registration saved | new |
| 36 | Voir la file | :353 | `AIN.viewQueueLink` | Voir la file | View queue | new |
| 37 | Le dossier est en attente de validation… | :360-361 | `AIN.successBody` | (full sentence) | The file is awaiting validation. Pass these credentials to the declarant: they can sign in once the file is approved. | new |
| 38 | E-mail de connexion | :365 | `AIN.loginEmailLabel` | E-mail de connexion | Sign-in email | new |
| 39 | Identifiant d'établissement | :370 | `AIN.establishmentIdLabel` | Identifiant d'établissement | Establishment ID | new (near: `registerPage.establishmentIdLabel` carries `{establishmentId}`) |
| 40 | Mot de passe temporaire | :377 | `AIN.temporaryPasswordLabel` | Mot de passe temporaire | Temporary password | new |
| 41 | Copier le mot de passe | :385 | `AIN.copyPasswordButton` | Copier le mot de passe | Copy password | new |
| 42 | Copié. | :387 | `AIN.copiedLabel` | Copié. | Copied. | new **or** reuse `loginPage.copiedLabel` ("Copié ✓") |
| 43 | Ce mot de passe ne sera plus affiché… | :390 | `AIN.passwordShownOnceWarning` | Ce mot de passe ne sera plus affiché. Notez-le avant de fermer cette fenêtre. | This password will not be shown again. Note it down before closing this window. | new |
| 44 | Sélectionner… | :469, :497 | `AIN.selectPlaceholder` | Sélectionner… | Select… | new **or** reuse `registerPage.selectPlaceholder` ("— Sélectionner —") / `vtWizard.select` (exact) |

Shared admin chrome (§1b) is **not** included in the counts; it needs its own namespace
(e.g. `adminShell`) and affects every admin page.

### Summary

- Distinct hardcoded user-facing strings in the target file: **40 rows** (#1-14, 16-19, 23-44
  excluding glyphs/data), plus 3 already keyed.
- **New keys: 24 definite**, plus **5 near-match rows** (#4, #8, #13, #42, #44) that are new unless
  the wording of an existing key is accepted → **24-29 new keys**.
- **Reused (exact match): 11** — `common.loading`, `common.cancel`, and 9 `registerPage.*` labels.
- Already translated: 3 (`registerPage.emailRoleHint`, `emailUnavailable`, `emailAvailable`).
- Interpolated: 2 (#6 `{field}`, #26 `{entityType}`); plurals: 0 in target (1 hand-rolled plural in
  `NotificationBell.tsx:107`).
- ENTITY_CONFIGS-driven text (radio labels, field labels/hints/options): covered by replacing
  `LOCALE = "fr"` with `asUiLocale(useLocale())`, no keys needed — unless §4 is decided otherwise.
- **Admin locale switcher: none.** Only `ModernJobsHeader` renders `LocaleSwitcher`.

### Strings needing a manual decision

1. **Déclarant vs Répondant.** The page mixes "Type de déclarant" (entity type), "Répondant"
   (section), "Téléphone du déclarant" (inside the Répondant section), "L'adresse e-mail du
   déclarant". Existing EN maps both `stepRespondent` ("Déclarant") and `respondentTitle`
   ("Répondant") to "Respondent". EN terms for "déclarant" ("declarant" / "reporting entity" /
   "respondent") need a domain decision; "Type de déclarant" is really the organization type.
2. **"Ressort"** (#28 and shell chip): `usersDirectory.locationColumn` uses "Jurisdiction"; confirm.
3. **"Inscription" / "auto-service" / "la file"** — "registration", "self-service", "queue" proposed.
4. **`registerPage.emailRoleHint`** is written to the respondent in 2nd person ("votre identifiant…
   votre entité"); on this page it is read by staff. Reusing it as-is may be wrong in both languages.
5. **Backend error messages** (`page.tsx:111`, `e.message` via `ApiError`) arrive in French and
   are shown verbatim, e.g. `src/auth/territory.ts:195,206` ("Action non autorisée hors de votre
   région d'affectation ({region}).", interpolated), `src/territory/territory-resolver.ts:60-87`,
   `src/auth/auth.service.ts` ~682 ("Un utilisateur avec cet email existe déjà"), ~700 (duplicate
   taxpayer number). Not translatable client-side without error codes — backend scope.
6. **Territory option names** (regions/departments/subdivisions, `page.tsx:471`) come from the DB
   as proper nouns; leave untranslated?
7. **Domain codes in entity titles** (CTD/RLA, ONG/NGO, "(enquête ONEFOP)") and the cooperative EN
   title "Coopérative" in ENTITY_CONFIGS — domain owner; changing them affects the public wizard's
   review summary too.
8. **"Fonction"**: `registerPage.functionLabel` EN = "Function", `companiesDirectory.functionLabel`
   EN = "Role". (Also: the public wizard's Fonction is a select of `RESPONDENT_FUNCTION_OPTIONS`;
   the assisted wizard uses free text — behavioural divergence, not a translation issue.)
9. **Shared chrome** (§1b): translating `AdminDialog`, `AdminPageHeader`, `AdminHeaderActions`,
   `NotificationBell`, `admin-data-state.ts` changes every admin page — scope decision.
10. **Whether admin should get a locale switcher** at all, given the comment at `page.tsx:33-35`
    states the console is "written in French throughout", and the stale claim about the provider
    should be corrected either way.
11. Page `<title>` localization requires a server layout/`generateMetadata` for the route.
