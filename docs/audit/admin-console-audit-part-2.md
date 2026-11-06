# Admin console audit — part 2: page-by-page specification

[Index](README.md) · [Part 1](admin-console-audit-part-1.md) · Part 2 · [Part 3](admin-console-audit-part-3.md) · [Part 4](admin-console-audit-part-4.md)

## 5. Page-by-page specification

Common to every page unless stated: root `.cam-admin-page`; header `AdminPageHeader`; non-ready regions rendered by `DataState` / `DataStateRow`, whose default copy is `dataStateMessage` (`lib/admin-data-state.ts`):

| State | FR | EN |
|---|---|---|
| loading | `Chargement de {resource}…` | `Loading {resource}…` |
| forbidden | `Accès non autorisé. Votre rôle ne permet pas de consulter ces données.` | `Access denied. Your role does not allow you to view this data.` |
| notFound | `Enregistrement introuvable.` | `Record not found.` |
| unavailable | `Données non disponibles` | `Data not available` |
| error | `Impossible de charger {resource}.` + server message + `common.retry` button | `Unable to load {resource}.` |
| empty | `Aucun résultat trouvé pour {resource}.` | `No results found for {resource}.` |

Pages override the title/hint as listed below. "Role gate" is the route gate from part 1 §4.2; the page's own `useAdminScreenGuard` group is given when it differs.

---

### 5.1 `/admin/pilotage` — Tableau de bord

- **Purpose.** One overview of what needs attention: pending registrations, submissions to review or correct, blocking quality alerts, the register's status and the active campaign's coverage.
- **Access.** Route: `PILOTAGE_READ_ROLES ∪ DIRECTORY_READ_ROLES` (all staff except `AUDITOR`). Inside the page (`PilotageDashboard`):
  - `canReviewRegistrations` = `APPROVAL_ROLES`; `canReadEstablishmentRegister` = `DIRECTORY_READ_ROLES`; `canReadSurveySubmissions` = `PILOTAGE_READ_ROLES`; `canManageCampaigns` = `CAMPAIGN_ROLES`; `canAccessSurveyDetails` = `SURVEY_ROLES`.
  - The combined "À traiter" card and the operation tabs appear only when the role has both registration review and submissions (`hasCombinedOperations`: SA, AO, RA, DA).
  - `ADMIN_ONEFOP_REGISTRATIONS` sees the registrations operation only; `ADMIN_ONEFOP_SUBMISSIONS` and `CENTRAL_AGENT` see submissions (CA also sees the register card because it is in `DIRECTORY_READ_ROLES`; NOT DETERMINED whether CA lands on registrations by default — `activeOperation` defaults to `registrations` when `canReadRegistrationOperation`, which is true for CA).
- **Entry points.** Login redirect; rail "Tableau de bord"; error boundary; `RequireAdminRole` redirect target. **Exits.** KPI links to `/admin/inscriptions?status=PENDING_APPROVAL|OVERDUE|COMPLEMENTS_REQUESTED`, `/admin/dossiers?status=PENDING_REVIEW|CORRECTION_REQUESTED`, `/admin/centre-qualite?vue=registre&status=OPEN&severity=BLOCKING` (`anomalyRegisterHref`), `/admin/etablissements`, `/admin/campagnes`, `/admin/cibles?vue=retours&campagne={id}[&territoire={key}]`.
- **Layout (rendered order).**
  1. Header: breadcrumb `Tableau de bord`, title `Tableau de bord | Dashboard`, subtitle `Vue d’ensemble des inscriptions, des télédéclarations, de la couverture des campagnes et de la qualité des données.`
  2. If no operation is readable: `DataState unavailable`, `Ce tableau de bord n’est pas accessible à ce profil.`
  3. Combined roles: card `À traiter | Needs attention` with five `DashboardMetricLink`s: `Inscriptions en attente`, `En retard (plus de {days} j)`, `En attente` (submissions), `Correction`, `Alertes qualité bloquantes`.
  4. Tabs (Radix `Tabs`, value in `?operation=`): `Inscriptions | Account registrations`, `Télédéclarations | Survey submissions`.
  5. Registrations tab: card `Statut du registre des établissements` with `StatStrip` (Total établissements, Comptes actifs, En attente de validation, Comptes rejetés, Comptes suspendus) and `RegistrationTrendChart`; for non-combined reviewers, a card with three metric links (En attente, Compléments demandés, En retard).
  6. Submissions tab: for non-combined roles, card `À traiter` with three links; then `CampaignCoverage`: campaign card (eyebrow `Campagne de Collecte`, campaign name, date range and days remaining, status badge, `campaignDetailsLink` → `/admin/campagnes` for `CAMPAIGN_ROLES`), three response KPIs (`Taux de réponse`, `Régions ayant répondu`, `En retard`), then an `AdminTablePanel` with Tabs "by territory" / "by entity type" holding `CoverageBarChart` (during collection) or `CampaignReviewStatusChart` (once `isCampaignCollectionComplete`), and `CampaignActivityTrendChart`.
- **Data.** `GET /admin/questionnaires/pilotage/queues` (`pendingNationalVisasCount`, `correctionsUnderReviewCount`, `blockingAnomaliesCount`); `GET /auth/company-registrations?page=1&pageSize=1` (`counts.pending/complements/overdue`, `overdueDays`); `GET /companies/stats` (`getCompanyStats`, `lib/companies-directory.ts`: `total`, `active`, `pendingValidation`, `rejected`, `suspended`); `GET /companies/registration-trend` (chart); `GET /admin/pilotage/campaigns/active`; `GET /admin/pilotage/campaigns/{id}/returns` and `…/returns/activity` (chart). All refetch every 120 s except the campaigns list.
- **Filters / URL.** `?operation=registrations|submissions` (replace, no scroll). No other filters.
- **Actions.** Links only; no mutations.
- **States.** Coverage: `La couverture de la campagne n'est pas disponible pour ce profil.` (unavailable), error with retry, no campaign: badge + `Aucune campagne de collecte active actuellement.`; loading `loadingCoverage`. KPI values show `—` (`metricUnavailable`) when the query has not answered. `StatStrip` shows `Chargement des chiffres…` / `Chiffres indisponibles pour le moment.`.
- **Side effects.** None.
- **Responsive.** Operation tab list wraps (`flex-wrap`; comment notes a 410 px overflow at 375 px was fixed).
- **Deviations / TODOs.** Uses `cam-dash-*` classes and shadcn `Tabs`/`Badge`. The overdue label falls back to a hard-coded `7` days when the registrations query has not answered (`overdueDays ?? 7`), which shows a figure the server did not supply.

### 5.2 `/admin/equipe` — Équipe territoriale

- **Purpose.** Compare territorial admins' activity (assisted registrations, conversions, coverage, backlog, overdue files, decisions, median decision time) and send one a reminder.
- **Access.** `MONITORING_ROLES` (SA, AO, RA). `REGIONAL_ADMIN` sees its own region only; the region filter is fixed to `user.region`. "Voir le journal" link only for `AUDIT_ROLES`.
- **Entry / exits.** Rail. Row links to `/admin/journal-audit?actor={userId}` and `/admin/inscriptions?createdBy={userId}`.
- **Layout.** Header (title `Équipe territoriale`, subtitle `Activité de terrain, couverture des ressorts et débit de traitement des administrateurs régionaux et départementaux.`); notice; one `AdminTablePanel` `Administrateurs territoriaux` with meta count; a period `<select>`; table.
- **Table columns.** `Administrateur` (name + `lastSystemAction` + date or `noActionRecorded`), role (filter head, options from `MONITORED_ROLES`), region (filter head), department, `Inscriptions assistées` (+ last registration), `Conversions ONEFOP` (+ rate), `Inscrits / quota` (+ %), `En attente`, `En retard` / `staleDays` (red badge when > 0), `Décisions` (three badges approved/rejected/corrections), median days, `Actions`.
- **Filters.** Period `7 jours | 30 jours | 90 jours | 12 mois` (default 30d), role, region — all component state, **not in the URL**.
- **Actions.** `Relancer` opens `AdminDialog` (eyebrow `Communication interne`, title `Relancer {name}`): template select (`Dossiers en attente depuis plus de {days} jours`, `Retard sur le quota de couverture`, `Aucune décision récente`, preselected from the actor's figures), French preview (`nudgePreview`, with warnings when the template does not fit), optional message (`maxLength 500`, character count). Submit → `POST /audit/nudge` (`sendNudge`, `lib/actor-summary.ts`); success notice `Relance envoyée avec succès à {name}.`; failure `Échec de l'envoi de la relance.` + server message.
- **Data.** `GET /audit/actor-summary?period&role&region` (`getActorSummary`, `lib/actor-summary.ts`).
- **States.** Loading `Chargement des données d'activité…`; error `Impossible de charger l’activité des équipes territoriales.`; empty `Aucun administrateur territorial trouvé pour ces filtres.`; forbidden `Accès réservé aux administrateurs centraux et régionaux.`
- **Side effects.** The nudge creates a `UserNotification` of kind `NUDGE` for the recipient (front end: `notificationKindLabel`; backend not re-read).
- **Deviations.** A 12-column `cam-table` inside an `AdminTablePanel` that also has a filter row: the period filter sits outside the column heads, the other two inside them.

### 5.3 `/admin/inscriptions` — Inscriptions (queue and organisations)

- **Purpose.** Process establishment registrations: verify, approve, reject or request complements; list registered organisations and archive, restore, suspend or reactivate them.
- **Access.** Route `APPROVAL_ROLES`. Queue table state is `forbidden` if the role is not in `APPROVAL_ROLES`. "Nouvelle inscription" button: queue view, `DIRECTORY_ROLES`. Organisation row menu: archive/restore `USER_ARCHIVE_ROLES`; suspend/activate `USER_LIFECYCLE_ROLES`.
- **Entry / exits.** Rail; pilotage KPIs; equipe `?createdBy=`. Exits: `/admin/inscriptions/nouvelle`, `/admin/etablissement-detail?id=…&returnTo=…`, `/admin/dossiers?vue=submissions&companyId=…`, `/admin/etablissements`.
- **Layout.** Header with title = hub name `Inscriptions` (no breadcrumb, `hideTabs`) and the primary action; `RegistrationsHubTabs`; then per view (`?vue=queue|organisations`, `coverage` redirects to cibles):
  - **queue**: "created by" filter notice, action notice, `Mise à jour…` live line, overdue `Alert` (`{count} dossier(s) attend(ent) une décision depuis plus de {days} jours.` + `overdueShow` link), `AdminTablePanel` `File d'inscriptions` containing the status summary (`Statut des inscriptions` + four counts + scope note + overdue summary), primary filters, `Plus de filtres` disclosure, `Exporter les inscriptions (CSV)`, active filter chips, table, then pager `Affichage {start}-{end} sur {total}`.
  - **organisations**: notice, `AdminTablePanel` `Organisations enregistrées` with the same summary, filters, export, table, pager.
- **Queue columns.** `Organisation / Référence` (sticky; name + establishment id), `Statut de l'inscription` (badge + `En retard · {days} j`), `Doublons` (`<details>` list of duplicate hints), `Région / Département`, `Type d'établissement`, `Soumis le`, `Affectation` (assignee + `Réclamer`/`Libérer` link), `Actions` (`Ouvrir`).
- **Organisations columns.** Organisation, `Statut de l'inscription`, `Région / Département`, `Type d'établissement`, `Actions` (`Ouvrir` → detail; menu: declarations link, `Archiver`, `Restaurer`, suspend/activate).
- **Filters (URL).** `search`/`organisation` (debounced), `status` (queue: `""` = `En file (attente + compléments)`, `ALL`, `PENDING_APPROVAL`, `COMPLEMENTS_REQUESTED`, `OVERDUE`, `ACTIVE`, `REJECTED`; organisations: `ACTIVE`/`REJECTED`/both), `assignedToMe`, `dateRange` (`all`, `30`, `90`, `custom` + `from`/`to`), `duplicates` (`with`/`without`), `registrationMethod` (`SELF_REGISTRATION`, `ADMIN_CREATED`, `ASSISTED`), `sort` (`newest`/`oldest`), `type`, `region`, `department`, `includeArchived` (organisations), `createdBy` (queue), `page`. Page size 8. All via `inscriptionsHref` (`lib/inscriptions.ts`).
- **Review dialog** (`AdminDialog`, eyebrow `Dossier d'inscription (assistée)`, title `Validation du compte — {organisation}`):
  - facts: type, region/department, NIU, registration date; duplicate hints; last resubmission diff table (`Champ`/`Avant`/`Après` — keys `fieldColumn`, `beforeColumn`, `afterColumn`);
  - `Informations à vérifier` table: rows `Nom de l'entité`, `Téléphone / WhatsApp de l'entité`, `Email de contact`, and `N° CNPS` for ENTREPRISE, COOPERATIVE, CTD, ONG, VOCATIONAL_TRAINING; each row a radio pair `✓ Conforme` / `✗ Non conforme` (no default; ✓ disabled when the value is empty);
  - respondent block (name, function, phones, login email, registered by + method badge);
  - checkbox `Structure centrale confirmée` when `requiresCentralStructureCheck`;
  - decision radios `Approuver le compte` / `Rejeter le compte` / `Demander des compléments`;
  - reason textarea (required for reject and complements) with hint.
- **Validation.** Approve blocked by `approvalGate` (`lib/inscriptions.ts`): `Impossible d'approuver : {fields} est/sont vide(s). Demandez une correction.`; `Une information est non conforme : rejetez le dossier ou demandez des compléments.`; `Marquez chaque information comme conforme pour approuver.`; plus `Cochez la confirmation « structure centrale » avant d'approuver.`. Reject without text: `Le motif de rejet est obligatoire.`; complements without text: `Le message de demande de compléments est obligatoire.`.
- **API.** List `GET /auth/company-registrations` (`listCompanyRegistrations`); approve `PATCH /auth/approve-user/{id}` with verification flags, `centralStructureConfirmed`, `expectedRevision`; reject `PATCH /auth/reject-user/{id}`; complements `PATCH /auth/request-complements/{id}`; claim `PATCH /auth/users/{id}/assign` (`assignRegistrationUser`); archive `PATCH /auth/users/{id}/archive` (reason), restore `PATCH …/restore`, suspend `PATCH /auth/users/{id}/suspend`, activate `/activate`. Archive uses `ArchiveActions` with a reason dialog (`Archiver cette organisation ?`). Suspend/activate have **no confirmation**.
- **States.** Loading/updating; error `Impossible de charger les inscriptions.`; empty `Aucune inscription trouvée`; forbidden for non-reviewers.
- **Side effects.** Audit rows `COMPANY_REGISTRATION_APPROVED/REJECTED/COMPLEMENTS_REQUESTED`, `REGISTRATION_ASSIGNED`, `REGISTRATION_ARCHIVED/RESTORED` (labels in `lib/audit-log.ts`). The server e-mails the respondent on each decision (`sendRegistrationApprovedEmail`, `…RejectedEmail`, `…ComplementsEmail`, backend `src/dsmo/notification.service.ts`); project notes record e-mail delivery as unreliable.
- **Responsive.** First column sticky (`sticky left-0`), table scrolls horizontally.
- **Deviations.** Page title is the hub name, no breadcrumb. The review dialog's eyebrow says "(assistée)" for every registration, assisted or not. Filters mix native `<select class="cam-admin-input">` and shadcn inputs. Inline Tailwind shadow with `rgba(15,23,42,0.45)` on sticky cells (G1/G14).

### 5.4 `/admin/inscriptions/nouvelle` — Nouvelle inscription

- **Purpose.** Register a respondent met in the field, by phone or at the counter; the account then follows the normal validation.
- **Access.** `DIRECTORY_ROLES`. Territory fields per `registrationTerritoryChoice` (§4.4).
- **Entry / exits.** Button on inscriptions (queue view) and on etablissements. Back arrow and breadcrumb → `/admin/inscriptions`. Result dialog → `/admin/inscriptions`.
- **Layout.** Header (breadcrumb Inscriptions › Examen des inscriptions › Nouvelle inscription, title `Nouvelle inscription | New registration`, back arrow); lede `Enregistrez un déclarant rencontré sur le terrain, par téléphone ou au guichet. Cette inscription sera soumise à validation comme une inscription auto-service. …`; step anchor nav (`cam-registration-steps`); error notice (focused on each new error); four numbered sections: 1 entity type (radio list `cam-entity-type-option`), 2 identification (fields from `ENTITY_CONFIGS[entityType]`, with branch lookup), 3 respondent (first name*, last name*, email* with live availability check, function), 4 location (region, department, subdivision — chosen or read-only); actions: submit, `Annuler | Cancel`.
- **Validation (first problem shown).** `Choisissez le type de déclarant.`; `Le nom et le prénom du répondant sont obligatoires.`; `L'adresse e-mail du déclarant est obligatoire.`; `Cette adresse e-mail est déjà utilisée par un autre compte.`; `Région, département et arrondissement sont obligatoires.`; `« {field} » est obligatoire.`; `Le capital social doit être un nombre entier positif ou égal à zéro.`. Submit disabled until regions (and sectors, when a branch field exists) have loaded.
- **API.** `POST /auth/admin/register-company` (`adminRegisterCompany`, `lib/inscriptions.ts`), `GET /sectors`, `/locations/*`, email availability (`use-email-availability.ts`).
- **Result dialog.** Not dismissible until acknowledged: login email, establishment id, temporary password, `copyPasswordButton`, warning `Ce mot de passe ne sera plus affiché. Notez-le avant de fermer cette fenêtre.`, checkbox `J'ai noté ou transmis le mot de passe. …`; buttons "Nouvelle inscription" (reset) and `viewQueueLink`.
- **States.** Guard loading/forbidden (`Vous n'avez pas accès à cette page.`); lookup states (`Impossible de charger les branches d'activité.`, `Impossible de charger les territoires.`). `loading.tsx` skeleton exists for the route.
- **Side effects.** Audit `COMPANY_REGISTRATION_ASSISTED`; queue invalidated. `UnsavedNavigationGuard` warns on leaving with data or unacknowledged credentials.
- **Deviations.** Sets `document.title` manually. Uses shadcn controls and `FieldGrid`.

### 5.5 `/admin/etablissements` — Registre des établissements

- **Purpose.** The register of reporting entities with headline counts.
- **Access.** `DIRECTORY_READ_ROLES`. Export and "Nouvelle inscription" hidden for `CENTRAL_AGENT` (`isReadOnlyRole`).
- **Entry / exits.** `RegistrationsHubTabs`; rail for CA; pilotage. Row `Voir` → `/admin/etablissement-detail?id={establishmentId|registrationNumber}`; disabled when neither exists.
- **Layout.** Header (title = hub `Inscriptions`, subtitle `Registre des entités déclarantes et gestion des comptes`, actions `Exporter la page actuelle (CSV)`, `Nouvelle inscription`); `RegistrationsHubTabs`; `StatStrip` `Chiffres clés` (Total établissements, Comptes actifs, En attente de validation, Comptes rejetés, Comptes suspendus, each with a hint); `AdminTablePanel` with toolbar filters (search, type, region, status, sort, year/semester/quarter via `AdminFilterDisclosure`); table; pager with numbered page buttons.
- **Columns.** `Établissement` (name + id), `Type`, `Territoire` (region / department / subdivision), `Contact`, `Date d'inscription`, actions.
- **Filters.** Component state, **not URL** (G15 deviation). Search/region/status debounced 300 ms. Server-side: search, status (`ACTIVE`, `PENDING_APPROVAL`, `REJECTED` only), region, sort, year/semester/quarter, page (size 8). Client-side only: type, and the `SUSPENDED` status — the pager then reports `localNarrowing` ("{shown} of {page}") because the narrowing applies to the current page only.
- **API.** `GET /companies` (`listCompanies`), company stats, `GET /data-management/stats`.
- **States.** Empty `Aucun établissement trouvé` + hint; error/retry; KPI loading/error.
- **Deviations.** The status filter offers `Toutes` hard-coded as a sentinel value (`"Toutes"`) and French status labels from a local `STATUS_LABELS` map (`Actif`, `En attente`, `Rejeté`, `Suspendu`, `Aucun compte lié`).

### 5.6 `/admin/etablissement-detail` — Détail établissement

- **Purpose.** One establishment's stored facts, workforce, declarations, linked account and its audit trail.
- **Access.** `DIRECTORY_READ_ROLES`. Account actions only for `SETTINGS_ROLES` (SA); audit card readable for `AUDIT_ROLES`.
- **Entry / exits.** From etablissements, inscriptions (organisations, with `returnTo`). Back arrow → `returnTo` (`resolveEstablishmentReturnTo`). Links: `/admin/dossiers?companyId=…` (`allFilesLink`), `/admin/dossiers/{id}`, `/admin/journal-audit?resourceId={userId}`. `?manage=true` opens the account dialog.
- **Lookup.** `?id=` is searched with `GET /companies?search={id}&pageSize=20` and matched client-side (`companyQuery`).
- **Layout.** Header: breadcrumb Inscriptions › Registre des établissements › {short name}; title = name before "—"; subtitle `Registre officiel et détails de l'établissement`; status badge `Aucun compte lié` / `Compte suspendu` / `Compte actif`; action `Suspendre le compte` / `Réactiver le compte` (SA). Meta line: type · `Identifiant :` · main activity. Two-column grid (`xl`): left — `Informations Générales` (18 fields), `Effectifs déclarés` (total, men, women, last year), `Historique des déclarations` (table: reference, type, received, status, actions → open); right — linked account card, `Informations du Compte` (registration date + `DataState unavailable` `Métadonnées d'inscription non conservées`), `Journal d'Audit` (last 8 entries for the account).
- **Account dialog** `Gestion du Compte Utilisateur` (wide): suspend/reactivate with hint (`Le titulaire ne pourra plus se connecter. Les données sont conservées.`), `Connexions non journalisées` (unavailable), danger zone `Supprimer le compte` (`Suppression définitive du compte utilisateur. Cette action est irréversible.`). Footer note `actionsLogged`.
- **API.** `PATCH /auth/users/{id}/suspend|activate`, `DELETE /auth/users/{id}`; `GET /admin/questionnaires?companyId&limit=10`; `GET /audit/reports?resourceId&limit=8`.
- **States.** No id: `Aucun établissement demandé`; not found `Établissement introuvable`; forbidden `Accès non autorisé` / `Le répertoire des établissements est réservé aux administrateurs plateforme.`; no linked account `Aucun compte rattaché`; audit empty `Aucun historique d'audit disponible`.
- **Defect.** "Supprimer" calls `deleteUser` immediately — there is no confirmation step, despite the hint saying the action is irreversible. On success it navigates to `/admin/etablissements`.
- **Deviations.** Uses shadcn `Card` for every block (decorative containers, against G4 and CLAUDE.md §8). Workforce reads `Company.totalEmployees`, which memory notes as dead data (owner left staff screens as they are, 2026-10-17).

### 5.7 `/admin/annuaire` — Annuaire

- **Purpose.** Directory of entities, and for `SUPER_ADMIN` of user accounts.
- **Access.** `USER_ADMIN_ROLES` (SA, AO). `ADMIN_ONEFOP` sees entities only, with no view switch. The rail entry links to `?tab=users`, which an AO cannot see (it falls back to entities).
- **Layout.** Header (breadcrumb Administration › Annuaire, title `Annuaire | Directory`, campaign pill); for SA a `ViewSwitch` `Entités` / `Utilisateurs` (`?tab=companies|users`); then `CompaniesDirectory` or `UsersDirectory`.
- **CompaniesDirectory.** Searchable paged list (`GET /companies?search&page`); selecting a company opens an `AdminDialog` showing its details (`CompanyDetail`), with a close button.
- **UsersDirectory.** Status filter (default `pending`), table `Utilisateur`/`Localisation`/`Rôle`/`Statut`/`Actions`; mutations approve (`/auth/approve-user`), reject, change role (`PATCH /auth/users/{id}/role`), suspend/activate, delete, reassign territory; confirm dialogs (comment says it keeps "Flutter's own confirmation friction").
- **States.** Guard loading/forbidden (`Accès refusé`, `Votre compte n'a pas accès à cette page.`).

### 5.8 `/admin/campagnes` — Campagnes

- **Purpose.** Manage collection and registration campaigns through their lifecycle.
- **Access.** `CAMPAIGN_ROLES` (SA, AO, AS, RA). Mutations `canMutate` = `NATIONAL_ROLES`; for RA every action button is rendered disabled inside `Gated` with title `Action réservée aux administrateurs et au niveau central : votre rôle permet la consultation seulement.`, plus notice `Consultation seule : …`.
- **Entry / exits.** Rail; pilotage; header campaign pill everywhere. Success notice after creating a registration campaign links to `/admin/cibles?vue=quotas&campagne={id}` (`registrationSetQuotas`).
- **Layout.** Header (breadcrumb Gestion des campagnes › Campagnes; campaign pill; primary `Lancer une campagne`); read-only notice; error/success notices; active campaign block(s) — banner `Aucune campagne active` + hint when none, else one `ActiveCampaignCard` per active campaign (name, date range, `daysRemaining`, `targetedEstablishments`, `submissionsCollected` with hint `trackingUnavailable`, buttons Voir les détails, Envoyer un rappel, Prolonger, Mettre en pause, Archiver, Clôturer la campagne); two-column row: `Historique des campagnes` table and, for the first active campaign, side panels `assignedQuestionnaires` and `scheduleTitle`.
- **History columns.** `Campagne` (name + `Inscription` tag for registration campaigns), `Type` (collection type or periodicity + reference quarter), `Ouverture`, `Clôture` (+ "extended, was"), `Statut`, `Actions` (`Activer` for DRAFT/PAUSED collection campaigns; `Supprimer` for DRAFT; `Archiver` for non-draft non-archived collection campaigns; eye icon → details).
- **Dialogs.** Create (`CreateCampaignDialog`): purpose `Collecte`/`Inscription`; module DSMO/ONEFOP (forced ONEFOP for registration); periodicity; start date (default today, Douala) and deadline (default +90 days); reference year + quarter (required for ONEFOP); description; auto reminders (off for registration). Errors: `errorDates`, `errorDeadlineOrder`, `errorReference`. Remind: reminder type select (`Annonce de campagne`, `Échéance approchante`, `Dernier rappel`, `Prorogation`). Extend: new date (required). Close / Delete / Archive: confirmation dialogs. Details: `getCampaign` with creator and reminder history table (date, type, sent, failed).
- **API.** `GET /campaigns`, `GET /campaigns/{id}`, `POST /campaigns`, `POST /campaigns/{id}/activate|pause|close|archive|extend|remind`, `DELETE /campaigns/{id}`.
- **States.** Loading; error `Impossible de charger les campagnes : {message}`; empty history `Aucune autre campagne`; forbidden `Accès restreint aux responsables de campagnes.`.
- **Deviations.** Reference page of `ui-grammar.md`. Pause has no confirmation; activate has none. Registration campaigns show status `Quota` instead of their status (`registrationStatus`). "Submissions collected" is shown as untracked.

### 5.9 `/admin/cibles` — Quotas et rapports de campagne

- **Purpose.** Set per-territory submission quotas, follow returns by territory, and read registration coverage.
- **Access.** Route `SURVEY_ROLES ∪ REGISTRATION_ROLES`. Views: `quotas` needs `SURVEY_ROLES` and `CAMPAIGN_ROLES` (list); `retours` needs `SURVEY_ROLES`; `couverture` needs `REGISTRATION_ROLES`. Write: `NATIONAL_ROLES`; central quota row: `NATIONAL_ROLES`.
- **URL.** `?vue=quotas|retours|couverture` (`relances` → dossiers follow-up), `?campagne=`, `?annee`, `?semestre`, `?trimestre`. Invalid views are replaced with the first allowed one.
- **Layout.** Header (title `Quotas et rapports de campagne`, subtitle `Quotas des campagnes ONEFOP, retours des déclarations et couverture des inscriptions.`); read-only notice (`Consultation seulement.` or with territory); `ViewSwitch` `Quotas de campagne` / `Retours des déclarations` / `Couverture des inscriptions`; view body.
- **Quotas view.** Campaign select (optgroups collection / registration, ONEFOP only); note (registration → link to coverage; collection → `declarationQuotasNote`); campaign line; `AdminTablePanel` with `TargetGrid` (regions expandable to departments, region/department/entity-type modes, central row for national roles, per-region clear); `Enregistrer` (primary). Save opens confirm dialog `Confirmer l'enregistrement` (`Ces quotas remplaceront les valeurs enregistrées pour cette campagne.` + list `name : from → to`); success `Quotas enregistrés.`; client validation errors listed; server error shown.
- **Returns view.** Campaign select (shown when the role can list or there are several); `CampaignReturnsTable` with regions expanded by default.
- **Coverage view.** `CoveragePanel` (year/semester/quarter selector, territory and entity-type tables, help).
- **API.** `GET /campaigns`, `/admin/pilotage/campaigns/active`, quotas `GET|PUT` (`getCampaignQuotas`/`putCampaignQuotas`), returns, coverage `/admin/pilotage/coverage{,/semester,/quarter}` (`lib/pilotage-targets.ts`).
- **States.** `Chargement des campagnes…`, `Aucune campagne ONEFOP n'est disponible.`, `Aucune campagne de collecte ONEFOP n'est disponible.`, divisional without list: `La liste des campagnes n'est pas disponible au niveau départemental. …`, `Chargement des retours…`.
- **Deviations.** Confirm button shows `"…"` while saving (hard-coded); save error inside the dialog uses an inline `style={{ color: "var(--cam-error)" }}`. Campaign selects use `.cam-target-year` (documented exception in `ui-grammar.md`).

### 5.10 `/admin/questionnaires` — Formulaires d'enquête

- **Purpose.** Show the seven ONEFOP questionnaires, their section counts from the generated schema, and how many declarations each has.
- **Access.** `SURVEY_ROLES`. File counts and links only when `canReadSubmissions` (same group).
- **Layout.** Header (subtitle `Modèles nationaux de fiches d'enquête et de déclaration pour le recueil statistique ONEFOP`); schema error `DataState`; `AdminTablePanel` `Questionnaires` with meta `activeSchema` (version, sections, questions); table `Questionnaire` / `Sections` / `Déclarations déposées` (title "in your territory") / actions `Voir dossiers` → `/admin/dossiers?formType=…`, `Aperçu` → preview dialog (sections with order and field counts; `Ouvrir les dossiers` primary link).
- **Rows.** ENTREPRISE, COOPERATIVE, ADMINISTRATION, PROJECT_PROGRAM, CTD, ONG, VOCATIONAL_TRAINING (labels via `ENTITY_TYPE_OPTION_KEYS`).
- **API.** `public/schemas/onefop.schema.json` (`useOnefopSchema`); 7 × `GET /admin/questionnaires?formType=…&limit=0`.
- **Deviations.** Read-only; no create/edit despite the page family "configuration". The `Voir dossiers` button is rendered disabled for roles without access rather than hidden (all route roles do have access, so the branch is dead).

### 5.11 `/admin/dossiers` — Examen des télédéclarations

- **Purpose.** The review queue of ONEFOP submissions; completed decisions; follow-up of establishments that have not responded.
- **Access.** `SURVEY_READ_ROLES`. `CENTRAL_AGENT` is read-only: no selection column, no claim, no exports, queue views limited to `pending` and `corrections` (`READ_ONLY_DOSSIER_QUEUE_VIEWS`). Reopen: SA, AO, AS. Archive: `DOSSIER_ARCHIVE_ROLES`. History link: `AUDIT_ROLES`. Follow-up contacts: `SURVEY_ROLES`.
- **Layout.** Header: title `Déclarations & enquêtes | Declarations & surveys`, subtitle `Gérez les déclarations ONEFOP, suivez leur instruction et contrôlez la qualité des données.`; actions: (submissions) search field `ID, répondant, structure...` + `Filtres` button with count; (other views) campaign select; tabs `File d'instruction` (badge), `Dossiers terminés`, `Relances`.
  - **Submissions (`?vue=submissions`, default).** Notices (reopen, assign, archive, end-of-queue); quick-filter buttons for queue views (`mine`, `unassigned`, `pending`, `corrections`, `aria-pressed`) and `En retard >7 j`; export `Exporter (Excel)`; active filter chips; live result count; selection toolbar (`Réclamer la sélection`, `Exporter la sélection CSV`, `✓ Viser la sélection`, `Demander une correction`, `× Rejeter la sélection`); table; pager (Précédent/Suivant, page x of y). Filter side panel (`aside`, Escape closes): type, region, department, period (`7d`/`30d`/`3m`/`12m`), late, assignment (`unassigned`, `me`, `other`), controls (`clean`, `warnings`, `blocking`), sort, campaign, quarter; `Effacer` / `Fermer`.
  - **Columns (submissions).** checkbox, `Entité` (sticky; name link + status badge when not pending), `Territoire`, `Contrôles` (`# anomalie(s) bloquante(s)`, `# avertissement(s)`, `—`, or "validation data unavailable"), `Attente` (`# jours` or `# jours · en retard` when > 7 days), `Agent responsable` (name or `Non réclamé`, `Réclamation expirée`), `Actions` (primary + menu).
  - **Row primary action** (`selectDossierQueuePrimaryAction`): `Réclamer` (free or expired) → claims then opens the workspace; `Examiner les problèmes` (held, has issues) → workspace `focus=verify`; `Viser` (held, clean) → workspace `openApprove=1`; `Voir l’historique` (correction requested); `Ouvrir le dossier` otherwise. Menu: `Libérer`, `Réclamer`, history, `Archiver`, `Restaurer`.
  - **Completed (`?vue=completed`).** Heading `Dossiers complétés`, export; columns `Structure`, `Identifiant établissement`, `Type`, `Territoire`, `Campagne / période`, `Décision` (+ rejection reason), `Date de décision`, `Statut d’archivage`, `Actions` (open; menu history / archive / restore / `Rouvrir pour correction`). Includes archived rows via `completedIncludeArchived`.
  - **Follow-up (`?vue=followup`).** `AdminTablePanel` `Liste des relances` with `CampaignNonRespondentsTable` for the selected collection campaign (`GET` non-respondents). Empty: `Aucune campagne de collecte n'est disponible pour les relances.`
- **URL params.** Per-view prefixed filters (`submissionsStatus`, … via `filterParam`), legacy unprefixed params, `vue`, `queueView`, `campaignId`, `companyId`, `formType`, `search`/`q`, `page`, `preview`, `decisionNotice`, `endOfQueue`. Page size 10.
- **Bulk dialogs.** All `AdminDialog`, all require a certification checkbox:
  - Endorse (`Visa en lot — confirmation officielle`): eligible = held, `PENDING_REVIEW`, 0 blocking; note optional, **required** (`Justification`, max 2000) when any selected file has open warnings (CLAUDE.md §21, 2026-11-02); certify `Je certifie sur l'honneur …`; result with timestamp. → `POST /admin/questionnaires/bulk-visa`.
  - Reject (`Rejet administratif groupé`): eligible = held, `PENDING_REVIEW` or `CORRECTION_REQUESTED`; reason ≥ 10 characters (`Le motif doit comporter au moins 10 caractères ({length}/10).`). → `POST …/bulk-reject`.
  - Correction (`Demande de correction groupée`): eligible = held, `PENDING_REVIEW`; reason ≥ 10. → `POST …/bulk-request-correction`.
  - Reopen (`Rouvrir ce dossier pour correction ?`): reason ≥ 10 + certify. → `PATCH /admin/questionnaires/{id}/reopen-for-correction`.
  - Bulk claim: claims each selected file in turn (`claimFilesInTurn`) via `PATCH /admin/questionnaires/{id}/assign`.
- **States.** Empty `Aucun dossier trouvé` / `Aucun dossier ne correspond aux critères actuels dans votre ressort territorial.`; `Aucun des dossiers sélectionnés n'est éligible au rejet …`; `… n'est en attente de visa …`; error/retry.
- **Side effects.** Audit `AUDIT_BULK_VISA_GRANTED`, `AUDIT_BULK_REJECT`, `AUDIT_BULK_REQUEST_CORRECTION` (+ per-file rows per CLAUDE.md), `DOSSIER_ASSIGNED`, `DOSSIER_ARCHIVED/RESTORED`, `AUDIT_REOPEN`, `AUDIT_LIST_EXPORT`. Queue counts invalidated.
- **Responsive.** Sticky entity column; filter panel is an off-canvas `aside` (`is-open`).
- **Deviations.** Page title `Déclarations & enquêtes` differs from its nav label `Examen des télédéclarations` and from the hub. Header actions carry the search and filter trigger rather than a filter region above the table. The overdue threshold is hard-coded at 7 days (`elapsedMoreThanDays(…, 7)`), unlike registrations, whose threshold is a setting. Queue type labels for PROJECT_PROGRAM and VOCATIONAL_TRAINING are hard-coded inline in French and English (`queueTypeLabel`).

### 5.12 `/admin/dossiers/[id]` — Dossier review workspace

- **Purpose.** Review one submission and decide on it.
- **Access.** `SURVEY_READ_ROLES`. Decisions need `SURVEY_ROLES` **and** being the active claim holder (`isActiveDossierClaimOwner`). Read-only when `isReadOnlyRole` or `?readOnly=true` (set by the queue when someone else holds the claim). Staff names visible to SA, AO, AS (`STAFF_NAME_ROLES`). Reopen: `REOPEN_ROLES` on APPROVED.
- **Entry / exits.** From the queue (with `returnTo`, `openApprove`, `openCorrection`, `openReject`, `focus=verify`, `includeArchived`), centre-qualite, etablissement-detail, pilotage. Previous/next file links (`GET …/{id}/neighbours`); after a decision the page moves to the next file (`reviewMove=1&decisionNotice=…`) or back to the queue with `endOfQueue=1`. Superseded/supersedes notices link to the other file. `auditEventsLink` → journal (AUDIT_ROLES).
- **Layout.** Top bar (institutional masthead, §3.1). Header: title = entity name or `fileTitle`; subtitle line with reference, received date, `filedLate`, `correctsFile`; respondent line. **Decision bar** (`aria-label` `Barre de décision`): `DossierBarClaim` (`Réclamé par vous · expire {time}`, `Réclamé par {name}`, `Dossier libre`, claim/release), previous/next, `Rejeter`, `Demander une correction`, `Rouvrir pour correction`, blocked notice, primary `Viser`. Decision notice. Left rail: `Contrôles` (blocking/warning counts, eligibility note, `Recalculer les contrôles` for pending files), `Sections` anchor list with per-section state and flag counts, `Notes et historique` link. Main: `À vérifier · {count}` findings (each with observed/expected by sex, anchors to the answer, `Expliquer` for warnings), explained warnings list, `Identification`, answer sections (`DossierAnswerSections` or `DossierVtSections` for VT), `Notes et historique` timeline (review progress, decisions).
- **Dialogs.**
  - Correction (`Demander une correction`, eyebrow `declarationLine`): `1. Section concernée` (select), `2. Problème constaté` (required), 3 axis-2 diagnostic counts (read-only), `4. Action demandée au déclarant` (required), `Demander des documents justificatifs` checkbox, `Délai de correction accordé :`, certify (required). → `PATCH …/request-correction`. Success `La demande de correction a été enregistrée avec succès et notifiée au déclarant.`
  - Approve: refuses when blocking anomalies remain (`Résolvez tous les problèmes bloquants avant le visa.`); justification required (max 2000) when open warnings (`Saisissez une justification avant de viser un dossier avec des avertissements ouverts.`). → `PATCH …/approve`. Success `Le dossier a été officiellement visé.`
  - Reject: reason ≥ 10 + certify. → `…/reject`. Success `Le dossier a été officiellement rejeté. Le déclarant en a été informé.`
  - Reopen: reason ≥ 10 + certify. → `…/reopen-for-correction`. Success `Le dossier a été rouvert. …`
  - Explain (`ExplainFindingAction`, `Expliquer cet avertissement`): note 10–2 000 characters → `PATCH /admin/questionnaires/anomalies/{id}/resolve` with `REVIEWER_EXPLANATION`, one call per stored row with expected revision.
- **API.** `GET /admin/questionnaires/{id}` (`getAdminDossier`), `…/claim-state`, `…/diagnostic`, `…/review-progress` (GET/POST), `…/neighbours`, `…/coherence/recheck` (POST), decisions above, `PATCH …/assign`.
- **States.** Page `notFound` / forbidden (`Accès non autorisé` / `Votre rôle ne permet pas de consulter ce dossier.`); claim load failure `Impossible de charger l'état actuel de la réclamation. Aucune action n'est disponible.`; stale revision (409) → `staleFileModified`; no findings `Aucune anomalie détectée. Le dossier est conforme aux règles de cohérence.`; history empty `Aucune étape horodatée`.
- **Deviations.** Masthead and decision bar are specific to this workflow (documented in `admin-layout-spec.md` §4C). Button label `Viser` here vs. key name `validateArchiveButton`.

### 5.13 `/admin/centre-qualite` — Centre qualité des données

- **Purpose.** Quality rates, the anomaly register, and the validation rules; resolve an anomaly.
- **Access.** `SURVEY_READ_ROLES`. Register readable by `ANOMALY_REGISTRY_ROLES` (= `SURVEY_ROLES`; CA gets `forbidden` on the register). `LEGAL_DEROGATION` option enabled only for `ANOMALY_DEROGATION_ROLES` (SA, AO).
- **URL.** `?vue=indicateurs|registre|regles`, `?status=OPEN|RESOLVED|WAIVED`, `?severity=BLOCKING|WARNING`, `?family=…`.
- **Layout.** Header (breadcrumb Télédéclarations › Centre qualité des données, hub sub-nav with pending badge); `ViewSwitch` `Indicateurs` / `Registre des anomalies` / `Règles de validation`; success notice; per view:
  - Indicateurs: `Indicateurs de qualité` `StatStrip` (Complétude, Cohérence, Taux d'anomalies, Avertissements, Éligibilité statistique with hints) and aggregates by family and by region (`AggregateList`).
  - Registre: table `Déclaration / Dossier` (link to workspace), `Règle & Code` (family filter), `Description de l'Anomalie`, `Sévérité` (filter; `Bloquante`/`Avertissement`), `Détectée le`, `Statut` (filter; `Ouvertes`/`Résolues`/`Dispensées`), action (resolve, open only).
  - Règles: rule list with severity badges.
- **Resolve dialog.** Title `Résolution de l'anomalie : {code}`; anomaly text, file ref, region; `Mode de résolution administratif` radios: `DECLARANT_CORRECTION`, `FIELD_INSPECTION`, `LEGAL_DEROGATION` (disabled for non-derogation roles); note required (`Veuillez saisir un motif ou une justification …`); evidence link optional; revision check with `refreshLatestRevision`. → `PATCH /admin/questionnaires/anomalies/{id}/resolve`.
- **API.** `GET /admin/questionnaires/anomalies/registry?limit=50…`, `GET …/quality/summary`, `GET …/rules`.
- **States.** `Aucune anomalie trouvée` / `Aucune anomalie correspondant à ce périmètre n'est actuellement enregistrée.`; `Erreur lors de la résolution de l'anomalie.`; `anomalyNoLongerOpen`; `revisionUnavailable`.
- **Gap.** Only the first 50 anomalies are requested (`REGISTRY_PAGE_SIZE`) and no pager is rendered.

### 5.14 `/admin/diffusion` — Exports de données

- **Purpose.** Produce the statistical dataset in SPSS / CSV / Excel, the restricted VT files, and the codebook; see recent exports.
- **Access.** `NATIONAL_ROLES` (SA, AO, AS).
- **Layout.** Header (subtitle `Gérer, filtrer et exporter les données collectées`); error / success notices; `StatStrip`; section `Configuration de l'Export`: format radios (`.SAV (Format natif SPSS Data)`, `.CSV (Données tabulaires)`, `.XLSX (Microsoft Excel)`), codebook checkbox, scope radios, campaign, region, questionnaire (`Employeurs (…)` / `Centres de formation professionnelle`), status (`Validé uniquement` default, `Tous les statuts`, `En attente uniquement`, `Rejeté uniquement`), advanced (department, establishment type), `Lancer l'Export`; when questionnaire = TVET: `Liste nominative du personnel (8.8)` and `Coordonnées et contacts (1.15, 1.16, 2.1.12)` with format radios and download buttons. Section `Résumé du Jeu de Données` (count by form type); `Documentation du jeu de données` (codebook `.sps` download); `Historique des exports récents` table (`Date & Heure`, `Utilisateur`, `Format`, `Périmètre`).
- **API.** `POST /data-management/export/submissions/count`, `/data-management/export/submissions/spss/sav`, `…/spss/csv`, `…/submissions/excel` (`downloadSpssSavBlob`, `downloadSpssCsvBlob`, `downloadExcelWorkbookBlob`, via `downloadExportBlob`, all POST), `/data-management/export/submissions/spss/manifest`, `/data-management/export/vt-roster/{sav,csv,manifest}`, `/data-management/export/vt-contact/{sav,csv,manifest}`, `GET /data-management/export/history?limit=20`, `GET /data-management/stats`, `GET /campaigns`.
- **States.** `Le serveur a renvoyé un fichier vide : …`; `L'export n'a pas pu être généré : {message}. Aucun fichier n'a été téléchargé.`; history empty `Aucun export trouvé`; forbidden `Accès restreint à la gestion et diffusion nationale des données.`.
- **Side effects.** `DATA_EXPORT` audit rows; restricted files fail closed with 503 if the audit write fails (CLAUDE.md §21, 2026-10-17). Files download via a synthetic `<a download>`.
- **Gap.** The restricted roster/contact buttons are shown to `ADMIN_ONEFOP_SUBMISSIONS`, whom the server refuses (SA, AO only, per CLAUDE.md §21).

### 5.15 `/admin/sectors` — Référentiels

- **Purpose.** Read the national sector nomenclature.
- **Access.** `NATIONAL_ROLES`.
- **Layout.** Header (title `Référentiels | Reference data`, subtitle `Nomenclature nationale des métiers et secteurs d'activité`); `AdminTablePanel` with count; table `Nom`, `Nom (EN)`, `Catégorie` (filter head; values translated via `adminSectorsPage.category.*`), `Code`.
- **API.** `GET /sectors`. Filter: category (state only).
- **States.** `Chargement des secteurs…`, `Impossible de charger les secteurs. Réessayez plus tard.`, `Aucun secteur trouvé.`; forbidden with a `logoutButton`.
- **Deviations.** Read-only; the layout spec expects "scoped create/edit actions", none exist. Page title differs from `adminSectorsPage.pageTitle` (`Secteurs d'activité`), which is unused in the header.

### 5.16 `/admin/utilisateurs` — Utilisateurs & rôles

- **Purpose.** Manage ONEFOP officers: add, invite, group invitation links, pending staff requests, reassign territory.
- **Access.** `USER_ADMIN_ROLES` (SA, AO).
- **Layout.** Header (subtitle `Gestion des accès, des rôles et des activités administratives`; campaign pill; `Ajouter Agent` primary; `Inviter un agent` secondary); notice; `StatStrip` (Agents actifs, Agents inactifs, Nouvelles inscriptions (mois)); `AdminTablePanel` `Agents ONEFOP` (`shownOf`) with table `Nom de l'agent`, `Rôle`, `Ressort assigné`, `Matricule`, `Formulaires collectés`, `Dernière connexion`, `Compte créé le`, `Enregistré par`, `Statut`, `Actions` (profile, reassign); `PendingStaffRequests`; `GroupInvitationLinks`; dialogs.
- **Dialogs.** `CreateAgentDialog` (first/last name, email, role REGIONAL_ADMIN/DIVISIONAL_ADMIN, region, department, matricule, poste; returns a temporary password) → `POST /auth/admin/create-minefop-user`. `InviteAgentDialog` (level, service, post from the organigramme) → `POST /auth/admin/staff-invitations`, with WhatsApp share. Profile dialog. `ReassignDialog` (`Réassigner le territoire — {name}`: region, department) → `PATCH /auth/users/{id}/territory`. Group links: create (`POST /auth/admin/staff-invitation-links`), revoke (`PATCH …/{id}/revoke`). Pending requests: approve / reject with reason.
- **Data.** `GET /auth/users?roles=REGIONAL_ADMIN,DIVISIONAL_ADMIN,CENTRAL_AGENT&page=1&pageSize=50` (no pager), three count queries.
- **States.** Empty `Aucun agent trouvé` / `Aucun compte ONEFOP central, régional ou départemental n'est enregistré …`; forbidden `Accès restreint` / `La gestion des comptes ONEFOP est réservée aux administrateurs ONEFOP.`; group links empty `Aucun lien de groupe`; pending empty `Aucune demande en attente`.

### 5.17 `/admin/parametres` — Paramètres

- **Purpose.** Platform identity, registration overdue threshold, a reference card of roles, and the latest audit entries.
- **Access.** `SETTINGS_ROLES` (SA).
- **Layout.** Header (subtitle `Identité de l'observatoire, suivi des inscriptions, rôles et journal d'audit`); success notice (4 s); sections: `Informations de l'Observatoire` (name, country `CM`, default language fr/en, time zone `Africa/Douala`; `Enregistrer les modifications`); `Suivi des inscriptions` (`Délai avant retard (jours)`, integer 1–90, `overdueDaysInvalid` hint; secondary save); `Rôles Réglementaires & Habilitations` (definition list of all 9 roles; link `manageAssignments` → `/admin/utilisateurs`); `Journal d'Audit Récent` (6 latest; link → journal).
- **API.** `GET /system-settings`, `PATCH /system-settings` (identity or `registrationOverdueDays`), `GET /audit/reports?paginate=true&limit=6`.
- **Side effects.** `SYSTEM_SETTINGS_UPDATED` audit row; changing the threshold invalidates the registration queue.
- **Deviations.** Identity save errors are not shown (no `isError` branch for `identityMutation`). Two save buttons in one page (primary and secondary) — consistent with one primary per view.

### 5.18 `/admin/journal-audit` — Journal d'audit

- **Purpose.** Evidence log of administrative actions.
- **Access.** `AUDIT_ROLES` (SA, AU).
- **Entry.** Rail; deep links `?actor=` (equipe) and `?resourceId=` (dossiers, detail pages); deep links reset the period to "all".
- **Layout.** Header; `AdminTablePanel` with a `FilterBar` (period `Select` + `Réinitialiser`) and a shadcn table whose heads carry filters: `Horodatage` (period), `Acteur` (users from `GET /auth/users?page=1&pageSize=100`), `Action` (labels from `AUDIT_ACTIONS`), `Ressource` (types from `AUDIT_RESOURCE_TYPES`), `Identifiant` (debounced text), `Détails`, `État précédent → Nouveau`. Pager below the panel: `0 événement` or range, Précédent / page x of y / Suivant. Page size 12.
- **API.** `GET /audit/reports?paginate=true&limit&offset&period&actor&action&resourceType&resourceId`.
- **States.** Empty `Aucun historique d'audit disponible` + hint; forbidden `Accès réservé aux super-administrateurs plateforme et ONEFOP, et aux auditeurs.`.
- **Deviations.** Filters are component state, not URL (except the two deep-link params on load). The period filter appears twice (FilterBar and column head). Actor list is capped at 100 users.

### 5.19 `/admin/notifications` — Notifications

- **Purpose.** The signed-in user's own inbox.
- **Access.** Every role (`ALL_ROLES`), hidden from the rail; reached from the bell's `Voir tout`.
- **Layout.** Header (breadcrumb and title `Notifications`, no tabs, action `Tout marquer comme lu` when any unread); error notice; section with a timeline: date, unread dot, subject button (marks read, follows `linkHref`), kind label (`Relance`, `Affectation`, `Validation`, `Rejet` — hard-coded French in `lib/notifications-inbox.ts`), body.
- **API.** `GET /auth/me/notifications?limit=50`, `PATCH …/{id}/read`, `PATCH …/read-all`. No pagination beyond 50, no unread filter.
- **States.** `Chargement…`, `Impossible de charger les notifications.`, `Aucune notification trouvée.`.
- **Deviations.** Kind labels are not translated in English.
