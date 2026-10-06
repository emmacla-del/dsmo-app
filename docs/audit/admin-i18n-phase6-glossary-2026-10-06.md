# Admin bilingualism — Phase 6 glossary (Données and Administration)

Date: 2026-10-06
Scope: `react-web/src/app/admin/diffusion/page.tsx` (Exports),
`utilisateurs/page.tsx`, `journal-audit/page.tsx`, `parametres/page.tsx`,
the leftovers in pages/components already on next-intl (`annuaire`,
`components/admin/UsersDirectory.tsx`, `CompaniesDirectory.tsx`;
`sectors` has none), and the label libraries `lib/audit-log.ts` (also used
by the establishment detail page, deferred from Phase 4) and the
`STATUS_FILTERS` / `rowStatusMeta` labels in `lib/user-directory.ts`.
French unchanged unless a decision says otherwise. ✅ = confirmed earlier.

Not in scope (unchanged): export file contents, file names and the SPSS
syntax (CLAUDE.md §21); server-provided text (export error messages,
stored audit notes and reasons).

---

## A. Terms

| French | English | Notes |
|---|---|---|
| Exports ✅ / Diffusion | Exports / Dissemination | |
| Jeu de données | Dataset | |
| Périmètre (d'un export) | Scope | |
| Codebook / Syntaxe SPSS | Codebook / SPSS syntax | |
| Dictionnaire des variables / Guide de recodage | Variable dictionary / Recoding guide | |
| Agent / Enquêteur | Officer ✅ / Enumerator | « Ajouter Agent » → Add officer |
| Matricule | Staff number | |
| Ressort assigné ✅ | Assigned territory | |
| Réassigner / Affectation | Reassign / Assignment | |
| Journal d'audit ✅ / Horodatage / Acteur / Objet | Audit log / Timestamp / Actor / Object | |
| Système | System | actor of system entries |
| Rôles réglementaires & habilitations | Regulatory roles & permissions | |
| Délégation Régionale / Départementale | Regional / Departmental delegation | statutory role titles |
| Observatoire | Observatory | |
| Fuseau horaire | Time zone | |

## B. Strings

### B1. `diffusion/page.tsx` (Exports)

| French | English |
|---|---|
| Données › Exports (breadcrumb, title) | Phase 1 `adminNav` keys |
| Gérer, filtrer et exporter les données collectées - Campagne 2026 | Manage, filter and export collected data - Campaign 2026 — **D3** |
| Accès restreint à la gestion et diffusion nationale des données. | Access restricted to national data management and dissemination. |
| KPI: Total Déclarations · Dossiers enregistrés, hors brouillons · Déclarations Validées · {p} Taux de validation · En Attente de Révision · {p} en attente · Déclarations Rejetées · {p} taux de rejet | Total declarations · Files recorded, excluding drafts · Validated declarations · {p} validation rate · Awaiting review · {p} pending · Rejected declarations · {p} rejection rate |
| Configuration de l'Export · Définissez le format, le périmètre et les sections à inclure avant la génération du fichier. | Export configuration · Set the format, scope and sections to include before the file is generated. |
| Format de fichier · .SAV (Format natif SPSS Data) · .CSV (Données tabulaires) · .XLSX (Microsoft Excel) | File format · .SAV (native SPSS data format) · .CSV (tabular data) · .XLSX (Microsoft Excel) |
| Codebook & Syntaxe · Générer le Codebook (.sps) · Fichier de syntaxe SPSS avec les définitions de variables et les étiquettes de valeurs | Codebook & syntax · Generate the codebook (.sps) · SPSS syntax file with variable definitions and value labels |
| Périmètre des données · Toutes les données autorisées ({n}) · Par campagne · Par région · Sélection personnalisée | Data scope · All authorised data ({n}) · By campaign · By region · Custom selection |
| Campagne · Région · Statut · Chargement… · Aucune campagne enregistrée · Toutes (region) | Campaign · Region · Status · Loading… · No campaign recorded · All |
| Validé uniquement · Tous les statuts · En attente uniquement · Rejeté uniquement | Validated only · All statuses · Pending only · Rejected only |
| Masquer les filtres fins · Filtres complémentaires (Département, Type d'employeur) | Hide detailed filters · Additional filters (department, employer type) |
| Département ({region} / National) · Tous les départements · Type d'établissement | Department ({region} / National) · All departments · Establishment type |
| Tous les employeurs (6 types) · Entreprises privées · Coopératives · … | **D4** |
| Génération en cours… · Lancer l'Export · Compatible avec IBM SPSS Statistics 25+ | Generating… · Launch the export · Compatible with IBM SPSS Statistics 25+ |
| Fichier SPSS (.sav) / Fichier CSV (.csv) / Classeur Excel (.xlsx) téléchargé avec succès. | SPSS file (.sav) / CSV file (.csv) / Excel workbook (.xlsx) downloaded. |
| Le serveur a renvoyé un fichier vide : … Aucun fichier n'a été téléchargé. | The server returned an empty file: no record matches the requested scope, or the extraction failed on the server. No file was downloaded. |
| L'export n'a pas pu être généré : {msg}. Aucun fichier n'a été téléchargé. · erreur inconnue | The export could not be generated: {msg}. No file was downloaded. · unknown error |
| Le serveur n'a pas fourni de syntaxe SPSS pour ce périmètre. · Syntaxe SPSS téléchargée avec succès. · Impossible de télécharger la syntaxe SPSS : {msg}. | The server provided no SPSS syntax for this scope. · SPSS syntax downloaded. · Unable to download the SPSS syntax: {msg}. |
| Résumé du Jeu de Données · Aperçu du volume et de la structure du jeu exporté. · Total enregistrements · Variables au schéma canonique · Sections au schéma canonique | Dataset summary · Overview of the exported dataset's volume and structure. · Total records · Variables in the canonical schema · Sections in the canonical schema |
| Répartition par type · la répartition par type | Breakdown by type · the breakdown by type |
| Documentation du jeu de données · Syntaxe générée par le serveur pour le périmètre sélectionné. · Syntaxe SPSS du périmètre courant · .sps • générée à la demande | Dataset documentation · Syntax generated by the server for the selected scope. · SPSS syntax for the current scope · .sps • generated on demand |
| la documentation de référence · Dictionnaire des variables et guide de recodage : non disponibles · Ces référentiels ne sont pas encore produits par le système. Ils seront proposés ici dès qu'un service les générera à partir du schéma canonique ONEFOP. | the reference documentation · Variable dictionary and recoding guide: not available · The system does not produce these references yet. They will be offered here as soon as a service generates them from the canonical ONEFOP schema. |
| Historique des exports récents · Journal d'audit des extractions de données enregistrées sur la plateforme. | Recent export history · Audit log of data extractions recorded on the platform. |
| l'historique des exports · Chargement de l'historique des exports... · Aucun export enregistré · Les extractions de données générées par les administrateurs et analystes apparaîtront ici. | the export history · Loading the export history… · No export recorded · Data extractions generated by administrators and analysts will appear here. |
| Date & Heure · Utilisateur · Format · Périmètre | Date & time · User · Format · Scope |
| Périmètre complet autorisé · Région: · Dép: · Campagne: · Type: · Statuts: | Full authorised scope · Region: · Dept: · Campaign: · Type: · Statuses: |
| History user role shown as raw code « (ADMIN_ONEFOP) » | **D5** |

### B2. `utilisateurs/page.tsx`

| French | English |
|---|---|
| Accès restreint · La gestion des comptes ONEFOP est réservée aux administrateurs ONEFOP. | Restricted access · ONEFOP account management is reserved for ONEFOP administrators. |
| Administration › Utilisateurs & rôles ✅ · Gestion des accès, des rôles et des activités administratives | Access, role and administrative activity management |
| + Ajouter Agent | + Add officer |
| AGENTS ACTIFS · Comptes ONEFOP actifs (central, régional, départemental) | ACTIVE OFFICERS · Active ONEFOP accounts (central, regional, departmental) |
| AGENTS INACTIFS · Comptes désactivés ou en attente d'activation | INACTIVE OFFICERS · Deactivated accounts or accounts awaiting activation |
| NOUVELLES INSCRIPTIONS (MOIS) · Inscriptions enregistrées depuis le début du mois | NEW REGISTRATIONS (MONTH) · Registrations recorded since the start of the month |
| Agents ONEFOP · {n} affiché(s) sur {total} | ONEFOP officers · {n} shown of {total} |
| Nom de l'agent · Rôle · Ressort assigné · Matricule · Formulaires collectés · Dernière connexion · Compte créé le · Enregistré par · Statut · Actions | Officer name · Role · Assigned territory · Staff number · Forms collected · Last sign-in · Account created on · Registered by · Status · Actions |
| les agents ONEFOP · Aucun agent enregistré · Aucun compte ONEFOP central, régional ou départemental n'est enregistré dans votre périmètre d'administration. | the ONEFOP officers · No officer recorded · No central, regional or departmental ONEFOP account is recorded within your administration scope. |
| Ressort non affecté · Actif · Inactif · Profil · Réassigner | No territory assigned · Active · Inactive · Profile · Reassign |
| Raw `status` code under the badge (PENDING_APPROVAL…) | **D5** |
| Nouvel agent créé avec succès. · Territoire réassigné pour {name}. | New officer created. · Territory reassigned for {name}. |
| Profil — {name} · Fermer · EMAIL · RÔLE · RESSORT ASSIGNÉ · MATRICULE · COMPTE CRÉÉ LE · FORMULAIRES COLLECTÉS · DERNIÈRE CONNEXION | Profile — {name} · Close · EMAIL · ROLE · ASSIGNED TERRITORY · STAFF NUMBER · ACCOUNT CREATED ON · FORMS COLLECTED · LAST SIGN-IN |
| Ajouter un Agent ONEFOP · Création de compte administratif ou enquêteur | Add an ONEFOP officer · Creation of an administrative or enumerator account |
| Fermer / Annuler · Création… · Créer l'Agent | Close / Cancel · Creating… · Create the officer |
| Compte agent créé avec succès ! · Email : · Mot de passe temporaire : | Officer account created. · Email: · Temporary password: |
| Prénom · Nom · Email officiel · Région · Département · Tous les départements | First name · Last name · Official email · Region · Department · All departments |
| Réassigner le territoire — {name} · Affectation géographique de l'agent · Annuler · Enregistrement… · Confirmer l'affectation | Reassign territory — {name} · Officer's geographical assignment · Cancel · Saving… · Confirm the assignment |
| Région d'affectation · Aucune région affectée · Département · Tous les départements de la région | Assigned region · No region assigned · Department · All departments in the region |

### B3. `journal-audit/page.tsx`

| French | English |
|---|---|
| Derniers 7 jours · Derniers 30 jours · 3 derniers mois · 12 derniers mois · Toutes les dates | Last 7 days · Last 30 days · Last 3 months · Last 12 months · All dates |
| Toutes les ressources · Toutes les actions · Tous les utilisateurs · Acteur sélectionné (lien direct) | All resources · All actions · All users · Selected actor (direct link) |
| Accès réservé aux super-administrateurs plateforme et ONEFOP, et aux auditeurs. | Access reserved for platform and ONEFOP super administrators, and auditors. |
| Administration › Journal d'audit ✅ | Phase 1 `adminNav` keys |
| Filtres d'audit (aria) · Période · Acteur · Type d'action · Ressource · Identifiant · ID exact de la ressource · Réinitialiser | Audit filters · Period · Actor · Action type · Resource · ID · Exact resource ID · Reset |
| Registre d'audit (aria) · Horodatage · Acteur · Action · Objet · Détails · État précédent → Nouveau | Audit register · Timestamp · Actor · Action · Object · Details · Previous state → New |
| le journal d'audit · Aucun historique d'audit disponible · Aucun événement enregistré ne correspond aux filtres sélectionnés. Les événements consignés par le système apparaîtront ici. | the audit log · No audit history available · No recorded event matches the selected filters. Events logged by the system will appear here. |
| 0 événement · Affichage {a}-{b} sur {n} événement(s) · Précédent · Page {n} / {total} · Suivant | 0 events · Showing {a}–{b} of {n} events · Previous · Page {n} / {total} · Next |

### B4. `lib/audit-log.ts` (journal, parametres, establishment detail)

| French | English |
|---|---|
| 19 action labels: Visa en lot · Rejet en lot · Dossier rejeté · Retour pour correction · Export de la liste des dossiers · Anomalie résolue · Anomalie dérogée · Rôle / territoire modifié · Établissement créé · Établissement modifié · Déclaration DSMO soumise · Notification envoyée · Rapport généré · Rapports générés en lot · Rapport approuvé · Rapport rejeté · Rapport diffusé · Inscription approuvée · Inscription approuvée automatiquement | Bulk endorsement · Bulk rejection · File rejected · Returned for correction · File list export · Anomaly resolved · Anomaly waived · Role / territory changed · Establishment created · Establishment updated · DSMO declaration submitted · Notification sent · Report generated · Reports generated in bulk · Report approved · Report rejected · Report distributed · Registration approved · Registration approved automatically |
| 8 resource types: Dossier ONEFOP · Anomalie · Utilisateur · Établissement · Déclaration DSMO · Notification · Rapport · Lot de rapports | ONEFOP file · Anomaly · User · Establishment · DSMO declaration · Notification · Report · Report batch |
| Système | System |
| {n} visé(s), {m} refusé(s) sur {t} · {n} rejeté(s), {m} ignoré(s) sur {t} · Format {f} · {n} ligne(s) · Rôle et périmètre géographique · Identifiant {id} · vérifié : nom, téléphone, email, CNPS | {n} endorsed, {m} refused of {t} · {n} rejected, {m} skipped of {t} · Format {f} · {n} row(s) · Role and geographical scope · ID {id} · verified: name, phone, email, CNPS |
| Transition statuses: En instance · Visé · Rejeté · Correction demandée | Pending · Endorsed · Rejected · Correction requested |
| Stored notes / reasons / comments inside `details` | as stored (data) |

### B5. `parametres/page.tsx`

| French | English |
|---|---|
| Accès restreint aux super-administrateurs. | Access restricted to super administrators. |
| Administration › Paramètres ✅ · Identité de l'observatoire, rôles et journal d'audit | Observatory identity, roles and audit log |
| Modifications des paramètres enregistrées avec succès. | Settings saved. |
| Informations de l'Observatoire · Nom de l'observatoire · Pays · Langue par défaut · Fuseau horaire | Observatory information · Observatory name · Country · Default language · Time zone |
| Français (FR) · Anglais (EN) · Cameroun | French (FR) · English (EN) · Cameroon |
| Enregistrement… · Enregistrer les modifications | Saving… · Save changes |
| Rôles Réglementaires & Habilitations · Nomenclature statutaire des habilitations CAM-LEAP/ONEFOP · Gérer les affectations → | Regulatory roles & permissions · Statutory register of CAM-LEAP/ONEFOP permissions · Manage assignments → |
| 6 statutory role titles + descriptions (Super administrateur … Déclarant) | Super administrator · ONEFOP administrator · Regional delegation · Departmental delegation · Auditor · Respondent, each with its description translated |
| Journal d'Audit Récent · Voir le journal complet → · le journal d'audit · Aucun historique d'audit disponible · Journal d'audit non accessible à votre rôle · Les événements enregistrés par le système apparaîtront ici. | Recent audit log · View full log → · the audit log · No audit history available · Audit log not available to your role · Events recorded by the system will appear here. |
| Observatory name default « Observatoire National de l'Emploi » (initial value and placeholder) | **D6** |

### B6. Leftovers in already-keyed files

| File | French | English |
|---|---|---|
| `annuaire/page.tsx` | Listes de l'annuaire (aria) | Directory lists |
| `UsersDirectory.tsx` | Rôle · Région · Toutes les régions · Statut du compte (aria) | Role · Region · All regions · Account status |
| `UsersDirectory.tsx` | Le serveur n'applique pas encore ce filtre : la liste ci-dessous contient des comptes hors du rôle ou de la région choisis. | The server does not apply this filter yet: the list below includes accounts outside the chosen role or region. |
| `UsersDirectory.tsx` via `lib/user-directory.ts` | STATUS_FILTERS: Tous · En attente · Actifs · Suspendus · Rejetés; row status: En attente · Rejeté · Actif · Suspendu; role badges (`directoryRoleLabel`, already bilingual) | All · Pending · Active · Suspended · Rejected; Pending · Rejected · Active · Suspended |
| `CompaniesDirectory.tsx` | entity types (codes) · « Établissement » fallback | **D2** · Establishment |

---

## C. Decisions

- **D1 `lib/audit-log.ts` gets a locale.** Action labels, resource labels, "Système", the details summaries and the transition statuses in both languages, French by default (its existing tests keep their French expectations). Stored free text inside `details` (notes, reasons, comments) is shown as stored. This also translates the audit lines on the establishment detail page (deferred from Phase 4).
- **D2 Entity types without codes** on Exports (type breakdown, export-scope line, employer filter) and in `CompaniesDirectory` — the Phase 2–5 labels. `CompaniesDirectory` is also used by the respondent-side directory (`/home/annuaire`), so its French changes there too.
- **D3 « Campagne 2026 » in the Exports subtitle** is hardcoded, not the active campaign. Recommend: translate as-is and flag (same as equipe's « cible 2026 »); not fixed here.
- **D4 Employer filter on Exports.** The first option says « Tous les employeurs (6 types) » but the list offers 7 types, and the six-plus-one options use their own plural labels. Recommend: drop the wrong count (« Tous les employeurs » / "All employers") and use the shared type labels for the seven options. Changes the French.
- **D5 Raw codes.** The export history shows the user's role as a code « (ADMIN_ONEFOP) », and the officers table shows the raw registration status under the badge (« PENDING_APPROVAL »). Recommend: role → `directoryRoleLabel`, status → the Phase 4 account-status labels (CLAUDE.md §8).
- **D6 Observatory name.** « Observatoire National de l'Emploi » is the initial value and placeholder of a stored setting. Recommend: keep it French — it is an official name and the value is saved to the database.
- **D7 « Langue par défaut » setting is not wired.** The value is stored server-side but nothing in the i18n layer reads it (`src/i18n/config.ts` defaults to French; the locale comes only from the cookie). Translating its label is in scope; making it actually set the default language is a separate change — flagged, not done.
