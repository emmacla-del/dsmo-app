# Bilingualism — Phase 7 glossary (respondent /home/* gaps)

Date: 2026-10-06
Scope: the `/home/*` routes and what they render —
`src/app/home/layout.tsx`, `home/page.tsx`, `home/declarations/page.tsx`,
`home/inscription-en-attente/page.tsx` (`declarations/new`, `[slug]` and
`annuaire` have no French-only text), `components/NewDeclarationDialog.tsx`,
`lib/role-navigation.ts` (sidebar and landing labels), plus the
`lib/api-client.ts` network/export error messages carried over from Phase 3
(decision 8). French unchanged unless a decision says otherwise.
✅ = confirmed earlier.

Not in Phase 7: the ONEFOP declaration wizard at `/onefop/preview` (see D5);
server text (approval comments, rejection reasons, campaign/quarter labels).

---

## A. Terms

All confirmed earlier (Déclarants ✅ Respondents, Ressort ✅ Territory,
Compléments ✅ Further information, Raison sociale ✅ Company name, NIU/CNPS
kept as acronyms). New:

| French | English | Notes |
|---|---|---|
| Dossier d'inscription | Registration file | |
| Renvoyer le dossier | Resubmit the file | |
| Période fermée | Period closed | |
| Campagne en cours | Current campaign | fallback when the round has no label |
| Console ministérielle | Ministry console | |
| Division du Travail / Délégation Régionale | Labour Division / Regional Delegation | **D2** (role badges on /home) |

## B. Strings

### B1. `home/layout.tsx`

| French | English |
|---|---|
| Campagne en cours (fallback) | Current campaign |
| Période fermée | Period closed |
| Role badge (`roleLabel`) | **D2** |
| Nav labels (`navItemsForRole`) | **D2** |
| « R.C. » logo mark · « CAM-LEAP · MINEFOP » | unchanged (brand marks) |

### B2. `lib/role-navigation.ts`

| French | English |
|---|---|
| Entreprise/ Company · Division du Travail · Delegation Regionale · Admin · ONEFOP · Super Admin · DSMO + ONEFOP · Auditeur | Company · Labour Division · Regional Delegation · Admin · ONEFOP · Super Admin · DSMO + ONEFOP · Auditor |
| Accueil/ Home · Déclarations/ Declarations · Analytique/ Analytics · Paramètres/ Settings | Home · Declarations · Analytics · Settings |
| Tableau de Bord Territorial / Régional / National | Territorial / Regional / National dashboard |
| Instruction des Dossiers · Instruction & Visas | File review · Review & endorsement |
| Statistiques & Diffusion · Statistiques DSMO | Statistics & dissemination · DSMO statistics |
| Nomenclature des Secteurs · Utilisateurs ONEFOP · Répertoire des Établissements · Gestion des Utilisateurs & Entités | Sector classification · ONEFOP users · Establishment register · User & entity management |

### B3. `home/page.tsx` (staff card)

| French | English |
|---|---|
| Console Ministérielle MINEFOP · ONEFOP | MINEFOP · ONEFOP ministry console |
| Accédez directement aux quatre outils d'instruction, d'arbitrage de qualité et de diffusion statistique. | Go straight to the four tools for review, quality arbitration and statistical dissemination. |
| Tableau de Bord National · Indicateurs de performance | National dashboard · Performance indicators |
| Dossiers en Instance · File de traitement prioritaire | Pending files · Priority processing queue |
| Instruction & Visas · Contrôle de conformité & arbitrage | Review & endorsement · Compliance check & arbitration |
| Statistiques & Diffusion · Agrégats consolidés & exportations | Statistics & dissemination · Consolidated aggregates & exports |

### B4. `home/declarations/page.tsx`

| French | English |
|---|---|
| ⚠️ Demande de correction de l'administration : | ⚠️ Correction requested by the administration: |
| Des ajustements ou compléments sont requis sur votre déclaration. Veuillez corriger et resoumettre. (fallback when no reason is stored) | Adjustments or additional information are required on your declaration. Please correct and resubmit. |
| Corriger et resoumettre | Correct and resubmit |
| The stored rejection reason | as stored (server text) |

### B5. `home/inscription-en-attente/page.tsx`

| French | English |
|---|---|
| Dossier d'inscription | Registration file |
| Votre compte est en attente de validation par un agent. Vous pourrez déclarer dès qu'il sera activé. | Your account is awaiting approval by an officer. You will be able to declare as soon as it is activated. |
| Des compléments ont été demandés : · Merci de compléter votre dossier. (fallback) | Further information has been requested: · Please complete your file. |
| Chargement de votre dossier… · Votre dossier n'a pas pu être chargé. Vous pouvez tout de même le renvoyer tel quel. | Loading your file… · Your file could not be loaded. You can still resubmit it as it is. |
| Corrigez ce qui doit l'être, puis renvoyez le dossier. Les champs inchangés sont laissés tels quels. | Correct what needs correcting, then resubmit the file. Unchanged fields are left as they are. |
| Field labels: Raison sociale · Numéro contribuable (NIU) · Activité principale · Activité secondaire · Société mère · Adresse · Téléphone / WhatsApp · Numéro CNPS · Fax · Email · Capital social (FCFA) · Type d'entité | Company name · Taxpayer number (NIU) · Main activity · Secondary activity · Parent company · Address · Phone / WhatsApp · CNPS number · Fax · Email · Share capital (FCFA) · Entity type |
| ⚠ Adresse déjà utilisée · ✓ Disponible | reuse `registerPage.emailUnavailable` / `emailAvailable` |
| Votre identifiant de connexion et le contact de l'entité auprès de l'ONEFOP. | Your sign-in identifier and the entity's contact with ONEFOP. |
| Non renseigné | Not recorded |
| Entity type options (codes CTD / ONG) | **D1** |
| Choisissez l'arrondissement pour déplacer le dossier. · Cette adresse e-mail est déjà utilisée par un autre compte. | Choose the subdivision to move the file. · This email address is already used by another account. |
| Renvoyer le dossier · Se déconnecter | Resubmit the file · Sign out |
| The stored approval comment | as stored (server text) |

### B6. `components/NewDeclarationDialog.tsx`

Already on next-intl except three combined "Français / English" strings:

| Current | French | English |
|---|---|---|
| « Vérification de votre type d'entité… / Checking your entity type… » | Vérification de votre type d'entité… | Checking your entity type… |
| « Vérification impossible — … / Couldn't verify automatically — … » | the French half | the English half |
| « Aucun type d'entité n'est encore enregistré … / No entity type is on record … » | the French half | the English half |

### B7. `lib/api-client.ts` (shown on admin and respondent screens)

| French | English |
|---|---|
| Impossible de joindre le serveur ({host}). Vérifiez votre connexion internet ou la disponibilité du service. | Unable to reach the server ({host}). Check your internet connection or the service's availability. |
| le serveur {host} est injoignable. Vérifiez que l'API est démarrée et accessible, puis réessayez. | the server {host} is unreachable. Check that the API is running and reachable, then try again. |
| votre session a expiré. Reconnectez-vous puis relancez l'export. | your session has expired. Sign in again, then restart the export. |
| votre rôle ne permet pas cet export. | your role does not allow this export. |
| l'export {label} n'existe pas sur le serveur {host} : la version de l'API déployée ne le propose pas encore. | the {label} export does not exist on server {host}: the deployed API version does not offer it yet. |
| échec du téléchargement {label} (HTTP {status}). | {label} download failed (HTTP {status}). |
| le téléchargement a été interrompu avant la fin. Réessayez ou réduisez le périmètre de l'extraction. | the download was interrupted before it finished. Try again or narrow the extraction scope. |
| Export labels: « CSV SPSS » etc. | unchanged (format names) |

---

## C. Decisions

- **D1 Entity types without codes** on the pending-registration correction form — the Phase 2–6 labels. Changes the French (« CTD » → « Collectivité territoriale »).
- **D2 Drop the combined "Français/ English" labels.** `role-navigation.ts` (role badge and sidebar items on /home), `NewDeclarationDialog`'s three messages: each becomes one string in the selected language. Changes the French display (the « / English » half disappears). The staff nav labels stay as they are in French (« Division du Travail », « Delegation Regionale » — the latter missing its accent); recommend fixing the accent (« Délégation Régionale ») while moving it to keys.
- **D3 `api-client.ts` errors.** These are thrown from plain functions outside React, so they cannot call `useTranslations`. Recommend a small helper that reads the `NEXT_LOCALE` cookie at throw time (the same cookie the provider reads), defaulting to French. Alternative: throw codes and translate in each caller — more correct, much larger change.
- **D4 No language switcher on /home.** Respondents can only change language inside the ONEFOP wizard header. Recommend adding the same `LocaleSwitcher` to the /home sidebar footer, as on the admin rail. (The login and registration pages have none either — outside /home; say if you want them too.)
- **D5 ONEFOP wizard (`/onefop/preview`) — not in Phase 7.** It is respondent-side but not under /home. A rough scan finds French-only UI text in the submission success screen, the PDF preview modal, the live table preview, the VT wizard screens, the wizard header and its submission-error fallback (`formatSubmissionError` still has a combined FR/EN branch). Much of what the scan flags is already paired fr/en data (e.g. the project-programme scope quiz). Questionnaire wording there comes from the AST and must not be translated by hand. Recommend a separate Phase 8 with its own survey.
- **D6 Server text** (approval comment, rejection reason, campaign/quarter label) stays as stored.
