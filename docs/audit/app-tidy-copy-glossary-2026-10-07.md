# CAM-LEAP admin copy glossary — 2026-10-07

**Status:** record of the tidy plan's copy pass (Part 4; Step 4d of `docs/audit/app-tidy-plan-2026-10-06.md`).
**Decisions:** D2–D6 and D11–D14 as written in the plan, approved 2026-10-07, with the §4.3 sense-split.
**Enforced by:** `copy-retired-term` in `scripts/check-admin-ui-grammar.mjs`, which fails on a retired sense anywhere in the `admin*` namespaces of `messages/fr.json`. The surviving senses below are its allowlist.

Every string the pass changed is listed here, old → new, in both catalogues. No key was added, removed or renamed; routes and code identifiers are unchanged (D9).

## The vocabulary

| Concept | Staff copy | Respondent copy | English | Retired |
|---|---|---|---|---|
| The record a declarant files | **dossier** | **déclaration** | file / declaration | *fiche*, *soumission* (as the record) |
| The Axis-1 decision | **viser**, **visa** | — | endorse, endorsement | *valider* (for this act) |
| Send back for correction | **Demander une correction** / Confirmer la demande | — | Request a correction / Confirm request | *Retour pour correction* |
| Refuse | **Rejeter** / Confirmer le rejet | — | Reject / Confirm rejection | *Rejeter la Fiche*, capitalised *Rejet* |
| The number a territory must reach | **quota** | — | quota | *cible*, *objectif* |
| An empty list | **Aucun(e) … trouvé(e)** | — | No … found | *Aucun … enregistré* (for lists), *Aucun enregistrement pour …* |

## (i) Dossier vocabulary — eb76f5e0

| Key | French: was → now | English: was → now | Decision |
|---|---|---|---|
| `adminPilotagePage.formRef` | Fiche #{id} → **Dossier #{id}** | Form #{id} → **File #{id}** | D2 |
| `adminDossiersPage.formIdColumn` | ID Fiche → **ID Dossier** | Form ID → **File ID** | D2 |
| `adminDossierPage.timelineReceived` | Fiche reçue par le serveur central → **Déclaration reçue par le serveur central** | Form received by the central server → **Declaration received by the central server** | D2 |
| `adminDossierPage.historyTitle` | Historique d'instruction de la Fiche → **Historique d'instruction du dossier** | Form review history → **File review history** | D2 |
| `adminDossierPage.approveBody` | Cette action accorde le visa administratif officiel à cette fiche et la marque comme validée pour intégration statistique. Confirmez-vous la décision ? → **Cette action accorde le visa administratif officiel à ce dossier et le marque comme validé pour intégration statistique. Confirmez-vous la décision ?** | This action grants the official administrative endorsement to this form and marks it as validated for statistical integration. Do you confirm the decision? → **This action grants the official administrative endorsement to this file and marks it as validated for statistical integration. Do you confirm the decision?** | D2 |
| `adminDossierPage.rejectSuccess` | La fiche a été officiellement rejetée. Le déclarant en a été informé. → **Le dossier a été officiellement rejeté. Le déclarant en a été informé.** | The form was officially rejected. The respondent has been informed. → **The file was officially rejected. The respondent has been informed.** | D2 |
| `adminEtablissementPage.noIdHint` | Ouvrez une fiche depuis le répertoire des établissements. → **Ouvrez un établissement depuis le répertoire des établissements.** | Open a record from the establishment register. → **Open an establishment from the establishment register.** | D2 (third sense: an establishment record) |
| `newDeclarationDialog.dialogTitle` | Nouvelle soumission → **Nouvelle déclaration** | New submission → **New declaration** | D2 |
| `adminDossiersPage.showingRange` | Affichage de {first}-{last} sur {total} {count, plural, one {soumission} other {soumissions}} → **Affichage de {first}-{last} sur {total} {count, plural, one {dossier} other {dossiers}}** | Showing {first}–{last} of {total} {count, plural, one {submission} other {submissions}} → **Showing {first}–{last} of {total} {count, plural, one {file} other {files}}** | D2 |
| `adminDossiersPage.zeroSubmissions` | 0 soumission → **0 dossier** | 0 submissions → **0 files** | D2 |
| `adminPilotagePage.submissionsColumn` | Soumissions → **Déclarations** | Submissions → **Declarations** | D2 |
| `adminEtablissementPage.submissionHistoryTitle` | Historique des Soumissions → **Historique des déclarations** | Submission history → **Declaration history** | D2 |
| `adminEtablissementPage.submissionsResource` | l'historique des soumissions → **l'historique des déclarations** | the submission history → **the declaration history** | D2 |
| `adminCampagnesPage.submissionsCollected` | Soumissions collectées → **Déclarations collectées** | Submissions collected → **Declarations collected** | D2 |
| `adminDossierPage.validateArchiveButton` | Valider et Archiver → **Viser** | Validate and archive → **Endorse** | D3/D13 (also the approve dialog's title) |
| `adminDossierPage.confirmValidation` | Confirmer la validation → **Confirmer le visa** | Confirm validation → **Confirm endorsement** | D3 |
| `adminDossierPage.validating` | Validation... → **Visa en cours…** | Validating… → **Endorsing…** | D3 |
| `adminDossierPage.approveFailed` | La validation a échoué : {message}. → **Le visa a échoué : {message}.** | Validation failed: {message}. → **Endorsement failed: {message}.** | D3 (consistency: same dialog as the three above) |
| `adminDossierPage.correctionTitle` | Retour pour Correction → **Demander une correction** | Return for correction → **Request a correction** | D12 |
| `adminDossierPage.confirmReturn` | Confirmer le Retour → **Confirmer la demande** | Confirm return → **Confirm request** | D12 |
| `adminDossierPage.rejectFormButton` | Rejeter la Fiche → **Rejeter** | Reject form → **Reject** | D13 |
| `adminDossiersPage.rejectSelectionButton` | Rejeter Sélection → **Rejeter la sélection** | *(unchanged)* Reject selection | D13 |
| `adminDossierPage.confirmRejection` | Confirmer le Rejet → **Confirmer le rejet** | *(unchanged)* Confirm rejection | D13 |
| `adminTargets.validatedColumn` | Validés → **Visés** | Validated → **Endorsed** | D14 (SubmissionStatus.VALIDATED in campaign returns) |

## (ii) Quota — 5017a56f

| Key | French: was → now | English: was → now | Decision |
|---|---|---|---|
| `adminTargets.targetColumn` | Objectif → **Quota** | Target → **Quota** | D4 |
| `adminTargets.centralTargetAriaLabel` | Objectif niveau central → **Quota niveau central** | Central-level target → **Central-level quota** | D4 |
| `adminTargets.regionTargetAriaLabel` | Objectif régional {region} → **Quota régional {region}** | Regional target {region} → **Regional quota {region}** | D4 |
| `adminTargets.departmentTargetAriaLabel` | Objectif {department} → **Quota {department}** | Target {department} → **Quota {department}** | D4 |
| `adminTargets.mixedRegionWarning` | Cette région mélange un objectif régional et des objectifs départementaux. Choisissez un mode avant d'enregistrer. → **Cette région mélange un quota régional et des quotas départementaux. Choisissez un mode avant d'enregistrer.** | This region mixes a regional target and department targets. Choose a mode before saving. → **This region mixes a regional quota and department quotas. Choose a mode before saving.** | D4 |
| `adminTargets.clearRegionButton` | Effacer les cibles de la région → **Effacer les quotas de la région** | Clear the region's targets → **Clear the region's quotas** | D4 |
| `adminTargets.targetModeAriaLabel` | Mode d'objectif → **Mode de quota** | Target mode → **Quota mode** | D4 |
| `adminTargets.coverageTargetColumn` | Cible → **Quota** | Target → **Quota** | D4 |
| `adminCiblesPage.targetsSaved` | Objectifs enregistrés. → **Quotas enregistrés.** | Targets saved. → **Quotas saved.** | D4 |
| `adminCiblesPage.confirmSaveBody` | Ces objectifs remplaceront les valeurs enregistrées pour cette campagne. → **Ces quotas remplaceront les valeurs enregistrées pour cette campagne.** | These targets will replace the values saved for this campaign. → **These quotas will replace the values saved for this campaign.** | D4 |
| `adminCiblesPage.registrationStatus` | Cible → **Quota** | Target → **Quota** | D4 |
| `adminCiblesPage.registrationTargetsNoteBefore` | Cibles d'inscription : elles alimentent la vue → **Quotas d'inscription : ils alimentent la vue** | Registration targets: they feed the → **Registration quotas: they feed the** | D4 (incl. 'cibles d'inscription') |
| `adminEquipePage.template.BEHIND_TARGET` | Retard sur la cible de couverture → **Retard sur le quota de couverture** | Behind the coverage target → **Behind the coverage quota** | D4 |
| `adminEquipePage.noTargetWarning` | Attention : aucune cible n'est définie pour ce ressort. → **Attention : aucun quota n'est défini pour ce ressort.** | Note: no target is set for this territory. → **Note: no quota is set for this territory.** | D4 |
| `adminEquipePage.coverageTitle` | Ressort — Cible & Couverture → **Ressort — Quota & couverture** | Territory — Target & coverage → **Territory — Quota & coverage** | D4 |
| `adminEquipePage.registeredOverTarget` | Inscrits / Cible : → **Inscrits / Quota :** | Registered / target: → **Registered / quota:** | D4 |
| `adminCampagnesPage.registrationStatus` | Cible → **Quota** | Target → **Quota** | D4 |
| `adminCampagnesPage.registrationCreated` | Campagne d'inscription créée. Saisissez ses cibles dans Collecte › Quotas et retours. → **Campagne d'inscription créée. Saisissez ses quotas dans Collecte › Quotas et retours.** | Registration campaign created. Enter its targets in Collection › Quotas and returns. → **Registration campaign created. Enter its quotas in Collection › Quotas and returns.** | D4 |
| `adminCampagnesPage.newTarget` | Nouvelle cible → **Nouveau quota** | New target → **New quota** | D4 |
| `adminCampagnesPage.purposeHint` | Une campagne d'inscription porte des cibles d'inscription ; elle n'ouvre pas de collecte. → **Une campagne d'inscription porte des quotas d'inscription ; elle n'ouvre pas de collecte.** | A registration campaign holds registration targets; it does not open a collection. → **A registration campaign holds registration quotas; it does not open a collection.** | D4 (incl. 'cibles d'inscription') |
| `adminCampagnesPage.descriptionRegistration` | Note interne sur la cible d'inscription → **Note interne sur le quota d'inscription** | Internal note on the registration target → **Internal note on the registration quota** | D4 |

## (iii) Labels and empty states — a678f5f0

| Key | French: was → now | English: was → now | Decision |
|---|---|---|---|
| `adminNav.routes.centreQualite` | Centre Qualité → **Contrôle Qualité** | Quality centre → **Quality control** | D5 |
| `registerPage.respondentTitle` | Répondant → **Déclarant** | *(unchanged)* Respondent | D6 |
| `registerPage.reviewTitle` | Vérification → **Récapitulatif** | *(unchanged)* Review | D6 |
| `adminCentreQualitePage.noAnomalyTitle` | Aucune anomalie enregistrée → **Aucune anomalie trouvée** | No anomaly recorded → **No anomaly found** | D11 |
| `adminUtilisateursPage.emptyTitle` | Aucun agent enregistré → **Aucun agent trouvé** | No officer recorded → **No officer found** | D11 |
| `adminDiffusionPage.noCampaign` | Aucune campagne enregistrée → **Aucune campagne trouvée** | No campaign recorded → **No campaign found** | D11 |
| `adminDiffusionPage.historyEmptyTitle` | Aucun export enregistré → **Aucun export trouvé** | No export recorded → **No export found** | D11 |
| `adminPilotagePage.noRecentActivity` | Aucune activité récente enregistrée. → **Aucune activité récente trouvée.** | No recent activity recorded. → **No recent activity found.** | D11 |
| `notificationBell.empty` | Aucune notification. → **Aucune notification trouvée.** | No notifications. → **No notifications found.** | D11 |

Code changed with (iii):

| Where | Was | Now | Decision |
|---|---|---|---|
| `lib/admin-data-state.ts`: `dataStateMessage("empty", …)`, shown when a page passes no title | Aucun enregistrement pour {resource}. / No records for {resource}. | **Aucun résultat trouvé pour {resource}.** / **No results found for {resource}.** | D11 |
| `app/admin/_routes.ts`: the route's French fallback label | Centre Qualité | **Contrôle Qualité** | D5 |

## Kept: surviving senses (the rule's allowlist)

| Key | Text | Why it stays |
|---|---|---|
| `adminQuestionnairesPage.subtitle` | Modèles nationaux de fiches d'enquête… | *fiche* = the questionnaire template, correct statistical French |
| `adminQuestionnairesPage.registerBody` | Les modèles de fiches de collecte ONEFOP… | same |
| `adminDossiersPage.statusCorrectionsNote` | …dès leur nouvelle soumission. | *soumission* = the act of (re)submitting |
| `adminDossierPage.historyEmptyHint` | …aucune date de soumission… | the act |
| `adminInscriptionsPage.dateFilterLabel` | Date de soumission | the act |
| outside admin: `submissionPanel.submittingButton`, `homeDeclarationsNewPage.submissionError` / `submittingInProgress`, `registerPage.reviewStatusReady`, `submissionPanel.finalSubmissionUnavailable`, `vtValidationScreen.errorsBlockingSubmit` | Soumission…, Erreur lors de la soumission, … | the act |
| `adminPilotagePage.coverageRateLabel`, `targetedCompaniesLabel`; `adminCampagnesPage.targetedEstablishments`, `detailRegions`, `detailDepartments` | …ciblé(e)s | the participle *targeted*: a campaign's scope, not a quota; D4 retires the noun only |
| `adminDossierPage.noDecisionRecorded`, `adminEquipePage.noActionRecorded`, `adminDossiersPage.noAnomaly` | Aucune décision / action / anomalie enregistrée | a fact about one record, not an empty list (D11) |
| the questionnaire's row messages (`vtWizard.noTrainers`, `modernJobs.roster.noRecords`) | Aucun formateur enregistré… | what the declarant has entered, not a filtered list |

## Not changed: candidates for a later copy decision

Record-sense or near-miss strings that the approved §4.3 tables do not list. They were left as they are; the three in admin namespaces are allowlisted by the rule with this reason.

| Key | Text | Note |
|---|---|---|
| `adminCampagnesPage.deleteBody` | …(soumissions, quotas, gels)… | record-sense *soumission* → *déclarations* |
| `adminCampagnesPage.trackingUnavailable` | …les soumissions de campagne | record-sense |
| `adminParametresPage.role.REGIONAL_ADMIN.description` | Supervision des soumissions… | record-sense → *dossiers* |
| `homeDeclarationsPage.pageSubtitle` | …vos déclarations d'emploi, soumissions et statuts… | respondent; *soumissions* duplicates *déclarations* |
| `usersDirectory.deleteWarning` | …déclarations, soumissions ou notifications liées… | record-sense |
| `sendNotificationForm.statusLabel` | Statut de soumission | ambiguous (the state of the submission) |
| `adminDossiersPage.validating` | Validation... | the list page's bulk-visa pending label; D3 named only the detail |
| `adminPilotagePage.statusApproved` | Validé | an APPROVED dossier in the activity feed; elsewhere that status reads *Visé* |
| `adminJournalAuditPage.emptyTitle`, `adminParametresPage.auditEmptyTitle`, `adminEtablissementPage.auditEmptyTitle` | Aucun historique d'audit disponible | a filtered list; *disponible* rather than *trouvé* |
| `usersDirectory` search field label | Rechercher (hard-coded) | no message key |
| `usersDirectory.rejectReasonLabel` | Motif du rejet (optionnel) | the field is in fact required by the confirm button |
| `components/onefop/ui/StatisticalTable.tsx` default | Aucune donnée disponible (hard-coded) | the component has no importer and never renders |
| `lib/notifications-inbox.ts` `notificationKindLabel()` | Relance, Affectation, … | French-only; no English |
| `admin/campagnes` `formatCampaignDisplayName()` | rewrites official all-caps campaign names | display names hard-coded in French |
