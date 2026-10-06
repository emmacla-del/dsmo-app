# Admin bilingualism — Phase 4 glossary (Déclarants)

Date: 2026-10-06
Scope: `react-web/src/app/admin/inscriptions/page.tsx` (queue + review dialog;
the Couverture view is already done in Phase 3), `etablissements/page.tsx`,
`etablissement-detail/page.tsx`, and the labels they take from
`lib/inscriptions.ts` (method badges, verification rows, approval-gate
messages). French unchanged unless a decision says otherwise. ✅ = confirmed
in an earlier phase.

---

## A. Terms

| French | English | Notes |
|---|---|---|
| Déclarants ✅ / Inscriptions ✅ / Établissements ✅ | Respondents / Registrations / Establishments | |
| Inscription validée / Approuvée / Approuver le compte | Registration approved / Approved / Approve the account | registration approval — not "endorsement", which is the dossier visa |
| Compléments demandés / Demander des compléments | Further information requested / Request further information | consistent with Phase 3 "Compléments" |
| Auto-service / Créé par admin / Assisté | Self-service / Created by admin / Assisted | registration-method badges |
| Dossier d'auto-inscription | Self-registration file | |
| Conforme / Non conforme | Compliant / Non-compliant | verification radios |
| Structure centrale | Central structure | |
| NIU / Numéro contribuable (NIU) / Numéro fiscal (NIU) | NIU / Taxpayer number (NIU) / Tax number (NIU) | NIU kept as the official acronym |
| CNPS / N° CNPS | CNPS / CNPS No. | kept as the official acronym |
| Raison sociale ✅ / Société mère / Capital social | Company name / Parent company / Share capital | |
| Responsable / Responsable désigné | Contact person / Designated contact person | |
| Effectifs déclarés / Effectif exercice précédent | Declared workforce / Workforce in previous year | |
| Doublons | Duplicates | |
| Zone dangereuse | Danger zone | |
| Compte rattaché / Compte lié | Linked account | |
| Suspendre / Réactiver le compte | Suspend / Reactivate the account | |

## B. Strings

### B1. `inscriptions/page.tsx`

| French | English |
|---|---|
| Nouvelle inscription | New registration (Phase 2 key) |
| Vues des inscriptions (aria) · File d'inscriptions · Couverture | Registration views · Registration queue · Coverage |
| Inscriptions saisies par {name} · l'agent sélectionné · Retirer ce filtre | Registrations entered by {name} · the selected officer · Remove this filter |
| Fermer (aria) | Close |
| En attente de vérification · Compléments demandés · Approuvées · Rejetées (KPIs) | Awaiting verification · Further information requested · Approved · Rejected |
| Type d'établissement · Tous les types | Establishment type · All types |
| Région d'origine · Toutes les régions | Region of origin · All regions |
| Statut · En file (attente + compléments) · Tous les statuts · En attente · Compléments demandés · Approuvée · Rejetée | Status · In queue (pending + further information) · All statuses · Pending · Further information requested · Approved · Rejected |
| Date de soumission · Toutes les dates · Derniers 30 jours · Derniers 90 jours | Submission date · All dates · Last 30 days · Last 90 days |
| Recherche · Nom, NIU, e-mail… | Search · Name, NIU, email… |
| Vous n'avez pas accès à cette file. · Impossible de charger les inscriptions. | You do not have access to this queue. · Unable to load registrations. |
| Organisation · Type · Territoire · Soumise le · Enregistré par · Vérification · Doublons · Action | Organisation · Type · Territory · Submitted on · Registered by · Verification · Duplicates · Action |
| EN ATTENTE · COMPLÉMENTS DEMANDÉS · APPROUVÉE · REJETÉE | PENDING · FURTHER INFORMATION REQUESTED · APPROVED · REJECTED |
| Examiner | Review |
| Affichage {a}-{b} sur {n} · Précédent · Suivant | Showing {a}–{b} of {n} · Previous · Next |
| Inscription validée et compte activé. · Inscription rejetée. · Demande de compléments transmise. | Registration approved and account activated. · Registration rejected. · Request for further information sent. |
| Cochez la confirmation « structure centrale » avant d'approuver. | Tick the "central structure" confirmation before approving. |
| Le motif de rejet est obligatoire. · Le message de demande de compléments est obligatoire. | A rejection reason is required. · A message requesting further information is required. |
| Validation du compte — {org} · Dossier d'auto-inscription | Account validation — {org} · Self-registration file |
| Annuler · Confirmer | Cancel · Confirm |
| Type : {type} · NIU : {niu} · Enregistré le : {date} | Type: {type} · NIU: {niu} · Registered on: {date} |
| Corrections envoyées le {date} · Dossier renvoyé sans modification. | Corrections sent on {date} · File resubmitted without changes. |
| Champ · Avant · Après | Field · Before · After |
| Field names (18): Raison sociale, Numéro contribuable (NIU), Activité principale, Activité secondaire, Société mère, Adresse, Téléphone / WhatsApp, Email, Numéro CNPS, Fax, Capital social, Type d'entité, Région, Département, Arrondissement, Région/Département/Arrondissement (identifiant) | Company name, Taxpayer number (NIU), Main activity, Secondary activity, Parent company, Address, Phone / WhatsApp, Email, CNPS number, Fax, Share capital, Entity type, Region, Department, Subdivision, Region/Department/Subdivision (ID) |
| Informations à vérifier · Information · Valeur déclarée · Vérification · Non renseigné | Information to verify · Item · Declared value · Verification · Not recorded |
| Vérification : {label} (aria) · ✓ Conforme · ✗ Non conforme | Verification: {label} · ✓ Compliant · ✗ Non-compliant |
| Déclarant · Pour information, non soumis à vérification. | Respondent · For information only, not subject to verification. |
| Nom · Fonction · Téléphone · Email de connexion · Enregistré par | Name · Function · Phone · Sign-in email · Registered by |
| Structure centrale confirmée | Central structure confirmed |
| Décision (aria) · Approuver le compte · Rejeter le compte · Demander des compléments | Decision · Approve the account · Reject the account · Request further information |
| Motif de rejet · Message de compléments | Rejection reason · Message requesting further information |
| `lib/inscriptions.ts` verification rows: Nom de l'entité · Téléphone / WhatsApp de l'entité · Email de contact · N° CNPS | Entity name · Entity phone / WhatsApp · Contact email · CNPS No. |
| Approval gate: Impossible d'approuver : {items} est vide / sont vides. Demandez une correction. | Cannot approve: {items} is empty / are empty. Request a correction. |
| Une information est non conforme : rejetez le dossier ou demandez des compléments. | An item is non-compliant: reject the file or request further information. |
| Marquez chaque information comme conforme pour approuver. | Mark every item as compliant to approve. |

### B2. `etablissements/page.tsx`

| French | English |
|---|---|
| Registre des entités déclarantes et gestion des comptes | Register of reporting entities and account management |
| Exporter · + Nouvelle inscription | Export · + New registration |
| TOTAL ÉTABLISSEMENTS · Entités enregistrées au répertoire | TOTAL ESTABLISHMENTS · Entities recorded in the register |
| COMPTES ACTIFS · Comptes déclarants validés et actifs | ACTIVE ACCOUNTS · Approved and active respondent accounts |
| EN ATTENTE DE VALIDATION · Dossiers soumis en attente d'approbation | AWAITING APPROVAL · Submitted files awaiting approval |
| COMPTES SUSPENDUS · Comptes désactivés ou suspendus | SUSPENDED ACCOUNTS · Deactivated or suspended accounts |
| TYPE D'ÉTABLISSEMENT · RÉGION · STATUT DU COMPTE · RECHERCHE LIBRE · Rechercher… | ESTABLISHMENT TYPE · REGION · ACCOUNT STATUS · FREE SEARCH · Search… |
| Tous · Toutes · Actif · En attente · Suspendu · Aucun compte lié | All · All · Active · Pending · Suspended · No linked account |
| Établissement · Identifiant · Région / Ville · Responsable · Date d'inscription · Statut du compte · Actions | Establishment · ID · Region / Town · Contact person · Registration date · Account status · Actions |
| le répertoire des établissements · Aucun établissement trouvé · Aucun établissement ne correspond à la recherche en cours. | the establishment register · No establishment found · No establishment matches the current search. |
| Actions (aria) · Voir les détails · Gérer les utilisateurs | Actions · View details · Manage users |
| {n} sur {m} établissement(s) de cette page (type / suspendu filtrés localement) | {n} of {m} establishments on this page (type / suspended filtered locally) |
| Affichage {a}-{b} sur {n} établissement(s) · Précédent · Suivant | Showing {a}–{b} of {n} establishments · Previous · Next |
| CSV export headers and status values | **D2** |

### B3. `etablissement-detail/page.tsx`

| French | English |
|---|---|
| ← Retour aux établissements | ← Back to establishments |
| cet établissement · Aucun établissement demandé · Accès non autorisé · Établissement introuvable | this establishment · No establishment requested · Access denied · Establishment not found |
| Ouvrez une fiche depuis le répertoire des établissements. | Open a record from the establishment register. |
| Le répertoire des établissements est réservé aux administrateurs plateforme. | The establishment register is reserved for platform administrators. |
| Aucun établissement enregistré ne porte cet identifiant. | No registered establishment has this ID. |
| Établissement · Registre officiel et détails de l'établissement | Establishment · Official register and establishment details |
| Compte suspendu. · Compte réactivé. · Compte supprimé. | Account suspended. · Account reactivated. · Account deleted. |
| AUCUN COMPTE LIÉ · COMPTE SUSPENDU · COMPTE ACTIF | NO LINKED ACCOUNT · ACCOUNT SUSPENDED · ACCOUNT ACTIVE |
| Identifiant : · Activité principale : | ID: · Main activity: |
| Réactiver le compte · Suspendre le compte | Reactivate the account · Suspend the account |
| Informations Générales | General information |
| 18 field labels (Raison sociale … Téléphone du responsable) | Company name, Entity type, Registration number (approval), Tax number (NIU), CNPS number, Establishment ID, Year of creation, Legal form, Size, Main activity, Sector, Phone, Address, Region, Department, Subdivision, Designated contact person, Contact person's phone |
| Effectifs déclarés · Effectif total · Hommes · Femmes · Effectif exercice précédent | Declared workforce · Total workforce · Men · Women · Workforce in previous year |
| Historique des Soumissions ({n}) · Tous les dossiers → | Submission history ({n}) · All files → |
| l'historique des soumissions · Aucune déclaration soumise · Cet établissement n'a pas encore soumis de déclaration administrative. | the submission history · No declaration submitted · This establishment has not submitted an administrative declaration yet. |
| Reçu le {date} • Type : {type} · Consulter | Received on {date} • Type: {type} · Open |
| Compte Utilisateur Rattaché · le compte rattaché · Aucun compte rattaché · Cet établissement n'a pas de compte utilisateur enregistré. | Linked user account · the linked account · No linked account · This establishment has no registered user account. |
| Statut : {status} · ACTIF · INACTIF | Status: {status} · ACTIVE · INACTIVE |
| Informations du Compte · Date d'enregistrement | Account information · Registration date |
| les métadonnées d'inscription · Métadonnées d'inscription non conservées · Le système n'enregistre ni l'agent créateur, ni le mode d'inscription, ni l'adresse IP, ni la géolocalisation, ni l'état de vérification documentaire de cet établissement. | the registration metadata · Registration metadata not kept · The system does not record the creating officer, the registration method, the IP address, the geolocation or the document-verification status of this establishment. |
| Journal d'Audit ✅ · le journal d'audit · Les événements d'audit sont rattachés au compte utilisateur de l'établissement. | Audit log · the audit log · Audit events are attached to the establishment's user account. |
| Aucun historique d'audit disponible · Journal d'audit non accessible à votre rôle · Les événements enregistrés apparaîtront ici. · Voir le journal complet → | No audit history available · Audit log not available to your role · Recorded events will appear here. · View full log → |
| Gestion du Compte Utilisateur · {name} — enregistré le {date} | User account management · {name} — registered on {date} |
| Les actions effectuées sont consignées au journal d'audit. · Fermer | Actions taken are recorded in the audit log. · Close |
| la gestion du compte · Gestion du compte réservée au super-administrateur plateforme | account management · Account management reserved for the platform super administrator |
| ACTIONS SUR LE COMPTE · Le titulaire pourra à nouveau se connecter et déclarer. · Le titulaire ne pourra plus se connecter. Les données sont conservées. | ACCOUNT ACTIONS · The holder will be able to sign in and declare again. · The holder will no longer be able to sign in. The data is kept. |
| Enregistrement… · Réactiver · Suspendre | Saving… · Reactivate · Suspend |
| HISTORIQUE DES CONNEXIONS · l'historique des connexions · Connexions non journalisées · Le système n'enregistre ni les connexions réussies, ni les tentatives échouées, ni les appareils utilisés pour ce compte. | SIGN-IN HISTORY · the sign-in history · Sign-ins not logged · The system does not record successful sign-ins, failed attempts or the devices used for this account. |
| ZONE DANGEREUSE · Supprimer le compte · Suppression définitive du compte utilisateur. Cette action est irréversible. · Suppression… · Supprimer | DANGER ZONE · Delete the account · Permanent deletion of the user account. This action cannot be undone. · Deleting… · Delete |
| Audit entry lines (action label, actor, details) | **D3** |
| Raw codes shown: submission status (APPROVED…), account status (ACTIVE…) | **D4** |

---

## C. Decisions

- **D1 Entity type labels.** The inscriptions page has its own short list (« CTD », « ONG », « CFP »); the establishment pages use `entityTypeLabel` (« CTD », « ONG »). Recommend: the Phase 2/3 labels (`ENTITY_TYPE_OPTION_KEYS`) on all three pages, including the type before/after in the correction diff. Changes the French.
- **D2 CSV export on Établissements** (client-side file of the rows on screen). Recommend: keep the headers and status values French regardless of locale — exports are out of scope (CLAUDE.md §21) and a file's columns should not change with the viewer's language.
- **D3 Audit entries on the establishment detail page** are labelled by `lib/audit-log.ts`, which the Phase 6 audit-log page also uses. Recommend: translate that library once, in Phase 6; until then those lines stay French on this page.
- **D4 Raw codes on the establishment detail page.** The submission history shows `sub.status` as the raw code (« APPROVED », « PENDING_REVIEW ») and the linked account shows its raw `status` (« ACTIVE »). Recommend: show labels instead — the Phase 3 dossier status labels for submissions, and the account labels for the account (Pending / Active / Rejected) — per CLAUDE.md §8 (no technical codes). A small behaviour change in both languages.
- **D5 Backend text shown as-is**: duplicate hints (`duplicateHints`, written by `auth.service.ts`) and server error messages stay French — backend scope.
