# Admin bilingualism — Phase 3 glossary (Supervision)

Date: 2026-10-06
Scope: `react-web/src/app/admin/pilotage/page.tsx`, `dossiers/page.tsx`,
`dossiers/[id]/page.tsx`, `cibles/page.tsx`, and the components and lib labels
they render: `TargetGrid`, `CampaignReturnsTable`, `CoveragePanel`,
`CoverageTable`, `KpiTile`, `lib/pilotage-target-payload.ts`,
`lib/pilotage-targets.ts`, `lib/companies-directory.ts` (`entityTypeLabel`).

French text is unchanged unless a decision below says otherwise. English is
proposed. ✅ = term from the confirmed glossary (Phases 1–2).

Not in Phase 3: `/admin/equipe` (Supervision hub, but not in the Phase 3
list — see decision D7), `lib/api-client.ts` client-side network/export error
messages (shared with the respondent side — D8), campaign and anomaly status
label maps (Phase 5 pages render them).

---

## A. Term glossary (decide once, applies to all phases)

| French | Proposed English | Notes |
|---|---|---|
| Dossier | File ✅ | |
| Fiche (« Fiche #… », « Rejeter la Fiche ») | Form | the submitted questionnaire |
| Déclaration | Declaration | |
| Déclarant | Respondent ✅ | |
| Répondant | Respondent ✅ | |
| Structure | Organisation | « Structure » column, « Informations de la Structure » |
| Visa administratif / Viser / Visé | **D1** — Administrative endorsement / Endorse / Endorsed | alternative: Approval / Approve / Approved (but « Approuvées » already exists as a distinct pipeline stage) |
| En instance | Pending ✅ | |
| Correction demandée / Retour pour correction | Correction requested / Returned for correction | |
| Rejeté / Rejet | Rejected / Rejection | |
| Instruction (d'un dossier) | Review | « Historique d'instruction » → Review history |
| Anomalie bloquante | Blocking anomaly | |
| Avertissement | Warning | |
| Alertes de cohérence | Coherence warnings | |
| Éligibilité statistique | Statistical eligibility | |
| Complétude / Cohérence | Completeness / Coherence | |
| Axe | Axis | « Axe 1 · Visa administratif » → Axis 1 · Administrative endorsement |
| Arbitrage | Arbitration | |
| Ressort (territorial) | Territory ✅ | |
| Niveau central | Central level | |
| Non rattachés | Unassigned | |
| Campagne / Campagne de collecte / Campagne d'inscription | Campaign / Collection campaign / Registration campaign | Collecte → Collection ✅ |
| Quota / Objectif / Cible | Quota / Target / Target | |
| Couverture | Coverage | « Cibles et couverture » → Targets and coverage ✅ |
| Retours | Returns | |
| Reçus / Validés / À temps / En retard / Écart | Received / Validated / On time / Late / Gap | |
| Taux de quota / Taux de réponse / Taux | Quota rate / Response rate / Rate | |
| Répertoire actif | Active register | |
| Inscrits | Registered | |
| Approbation | Approval | registration approval |
| Compléments | **D6** — Further information requests | column in CoverageTable; confirm meaning |
| Signataire | Signatory | |
| Je certifie sur l'honneur | I solemnly certify | |
| Pièces justificatives | Supporting documents | |
| Jours ouvrables / calendaires | Working days / calendar days | |
| Raison sociale | Company name | as `registerPage` |
| Siège social | Head office | |
| Secteur d'activité / Branche | Sector of activity / Branch | |
| Effectif / Employés permanents | Workforce / Permanent employees | |
| Régime/statut juridique | Legal status | |
| Société unipersonnelle / SARL / SA / Autres | Single-member company / LLC / PLC / Others | the AST's own English (onefop_ast S1Q01 option values) |

---

## B. Strings by file

### B1. `pilotage/page.tsx` (Dashboard)

| French | English |
|---|---|
| Validé · En attente · Correction · Rejeté (pipeline legend) | Validated · Pending · Correction · Rejected |
| Quotas et retours → | Quotas and returns → |
| Campagne de Collecte | Collection campaign |
| Inactive · Actif | Inactive · Active |
| Aucune campagne de collecte active actuellement. | No collection campaign is currently active. |
| Gérer les campagnes → | Manage campaigns → |
| Depuis le {date} | Since {date} |
| Voir les détails de la campagne → | View campaign details → |
| Taux de couverture des entreprises ciblées | Coverage rate of targeted companies |
| Temps restant · {n} jours restants | Time remaining · {n, plural} days remaining |
| Entreprises ciblées · Agents de collecte | Targeted companies · Collection officers |
| Couverture Régionale | Regional coverage |
| Région · Soumissions · Complétion · Contrôle QC · Anomalies | Region · Submissions · Completion · QC check · Anomalies |
| Ressort départemental (couverture régionale non applicable). | Departmental territory (regional coverage not applicable). |
| Aucune donnée régionale disponible. | No regional data available. |
| Activité Récente · Voir tous les dossiers → | Recent activity · View all files → |
| l'activité récente (DataState resource) | recent activity |
| Chargement de l'activité... | Loading activity… |
| Aucune activité récente enregistrée. | No recent activity recorded. |
| Fiche #{id} | Form #{id} |
| Complétude · Cohérence · Anomalies · Avertissements · Éligibilité statistique | Completeness · Coherence · Anomalies · Warnings · Statistical eligibility |
| Qualité des Données · Voir le centre qualité → | Data quality · View quality centre → |
| Inscriptions · Déclarations · Supervision nationale · Approuvées · Exportables (pipeline stages) | Registrations · Declarations · National supervision · Approved · Exportable |
| Supervision › Tableau de bord (breadcrumb, title) | Phase 1 `adminNav` keys |
| les indicateurs de supervision | the supervision indicators |
| À TRAITER | TO PROCESS |
| Inscriptions en attente · Déclarations à examiner · Retours à corriger · Alertes qualité | Pending registrations · Declarations to review · Returns to correct · Quality alerts |
| PIPELINE DES DÉCLARATIONS | DECLARATION PIPELINE |
| Donnée non disponible (KpiTile) | Data not available |

### B2. `cibles/page.tsx` + target/return/coverage components

| French | English |
|---|---|
| Quotas de campagne · Suivi des retours (view switch) | Campaign quotas · Returns tracking |
| Collecte › Quotas et retours (breadcrumb, title) | Phase 1 `adminNav` keys |
| Quotas des campagnes ONEFOP et suivi des retours de déclarations. | ONEFOP campaign quotas and declaration returns tracking. |
| Consultation seulement — département {x} / — région {x} | Read only — department {x} / — region {x} |
| Vues quotas et retours (aria) | Quotas and returns views |
| Chargement… · Annuler · Enregistrer | `common.*` |
| Objectifs enregistrés. | Targets saved. |
| Confirmer l'enregistrement · Confirmer | Confirm save · Confirm |
| Ces objectifs remplaceront les valeurs enregistrées pour cette campagne. | These targets will replace the values saved for this campaign. |
| La liste des campagnes n'est pas disponible au niveau départemental. Un identifiant de campagne dans l'adresse permet la consultation. | The campaign list is not available at department level. A campaign ID in the address allows read-only access. |
| Chargement des campagnes… · Chargement des retours… | Loading campaigns… · Loading returns… |
| Aucune campagne ONEFOP n'est disponible. / Aucune campagne de collecte ONEFOP n'est disponible. | No ONEFOP campaign is available. / No ONEFOP collection campaign is available. |
| Campagne ONEFOP · Campagne de collecte ONEFOP | ONEFOP campaign · ONEFOP collection campaign |
| Campagnes de collecte · Campagnes d'inscription | Collection campaigns · Registration campaigns |
| Cibles d'inscription : elles alimentent la vue Couverture de la page Inscriptions. | Registration targets: they feed the Coverage view of the Registrations page. |
| Quotas de déclarations : ils alimentent le Suivi des retours. | Declaration quotas: they feed Returns tracking. |
| Aucun territoire n'est associé à ce compte. | No territory is assigned to this account. |
| Territoire · Mode · Objectif | Territory · Mode · Target |
| Niveau central · Objectif niveau central | Central level · Central-level target |
| Non défini | Not set |
| Objectif régional {region} · Objectif {department} (aria) | Regional target {region} · Target {department} |
| Cette région mélange un objectif régional et des objectifs départementaux. Choisissez un mode avant d'enregistrer. | This region mixes a regional target and department targets. Choose a mode before saving. |
| Enregistrez ou annulez vos modifications avant d'effacer une région | Save or cancel your changes before clearing a region |
| Effacer les cibles de la région | Clear the region's targets |
| Mode d'objectif · Par département · Région seule | Target mode · By department · Region only |
| Région seule · {n} / Par département · {n} / Région seule · valeur invalide | Region only · {n} / By department · {n} / Region only · invalid value |
| Aucune modification à enregistrer. | No changes to save. |
| La région « {r} » : doit être un entier positif ou nul. | Region "{r}": must be a whole number, zero or more. |
| Le département « {d} » ({r}) : doit être un entier positif ou nul. | Department "{d}" ({r}): must be a whole number, zero or more. |
| La requête a échoué. | The request failed. |
| Quota · Reçus · Validés · À temps · En retard · Écart · Taux de quota · Taux de réponse | Quota · Received · Validated · On time · Late · Gap · Quota rate · Response rate |
| Niveau central (Administrations) · Non rattachés · Total | Central level (administrations) · Unassigned · Total |
| Déclarations déposées après la date limite · retard | Declarations filed after the deadline · late |
| Reçus / Répertoire actif ({a} / {b}) | Received / active register ({a} / {b}) |
| Année | Year |
| Inscrits · Cible · Taux · Dans l'année · Approbation · Instruction · Compléments | Registered · Target · Rate · Within the year · Approval · Review · Further information requests (D6) |

### B3. `dossiers/page.tsx` (Files list)

| French | English |
|---|---|
| Tous · En instance · Corrections · Visés · Rejetés (status tabs) | All · Pending · Corrections · Endorsed · Rejected (D1) |
| Le visa confirme la conformité légale du déclarant. Un dossier visé reste exclu du lot statistique tant qu'une anomalie bloquante persiste. | Endorsement confirms the respondent's legal compliance. An endorsed file stays out of the statistical batch while a blocking anomaly remains. |
| Ces déclarations ont été renvoyées aux employeurs avec un motif de non-conformité. Elles reviennent dans la file dès leur nouvelle soumission. | These declarations were sent back to employers with a non-compliance reason. They return to the queue as soon as they are resubmitted. |
| Régional — {region} / Régional — ressort non affecté / Départemental — {dept} / Départemental — ressort non affecté / National / Ressort non affecté | Regional — {region} / Regional — no territory assigned / Departmental — {dept} / Departmental — no territory assigned / National / No territory assigned |
| Dossier {id} (aria) | File {id} |
| Échec de l'export ({status}) · L'export a échoué : {msg} | Export failed ({status}) · The export failed: {msg} |
| Supervision › Dossiers (breadcrumb, title) | Phase 1 `adminNav` keys |
| Instruction et suivi des dossiers de déclaration soumis | Review and tracking of submitted declaration files |
| Ressort : · Rechercher... | Territory: · Search… |
| Statut des dossiers (aria) | File status |
| Type de questionnaire · Tous les Questionnaires | Questionnaire type · All questionnaires |
| Région · Toutes les Régions | Region · All regions |
| Période · Toutes les périodes | Period · All periods |
| Recherche libre · ID, répondant, structure... | Free search · ID, respondent, organisation… |
| Viser la sélection · Rejeter Sélection · Exporter (CSV/Excel) | Endorse selection · Reject selection · Export (CSV/Excel) |
| ID Fiche · Répondant · Structure · Type · Région · Visa administratif · Qualité données · Éligibilité | Form ID · Respondent · Organisation · Type · Region · Administrative endorsement · Data quality · Eligibility |
| les dossiers · Aucun dossier trouvé · Aucun dossier ne correspond aux critères actuels dans votre ressort territorial. | the files · No files found · No file matches the current filters in your territory. |
| VISÉ · CORRECTION DEMANDÉE · REJETÉ · EN INSTANCE · STATUT NON RENSEIGNÉ | ENDORSED · CORRECTION REQUESTED · REJECTED · PENDING · STATUS NOT RECORDED |
| {n} anomalie(s) bloquante(s) · {n} avertissement(s) · Aucune anomalie enregistrée | {n, plural} blocking anomalies · {n, plural} warnings · No anomaly recorded |
| Éligible · Non éligible · En attente | Eligible · Not eligible · Pending |
| Affichage de {a}-{b} sur {n} soumission(s) | Showing {a}–{b} of {n, plural} submissions |
| Précédent · Page {n} · Page {n} / {total} · Suivant | Previous · Page {n} · Page {n} / {total} · Next |
| Visa en lot — confirmation officielle | Bulk endorsement — official confirmation |
| {n} dossier(s) sélectionné(s) et éligible(s) au visa | {n, plural} selected files eligible for endorsement |
| Je certifie sur l'honneur que ces déclarations ont été instruites et sont conformes aux critères réglementaires | I solemnly certify that these declarations have been reviewed and meet the regulatory criteria |
| SIGNATAIRE | SIGNATORY |
| {n} dossier(s) visé(s), {m} écarté(s). Opération horodatée au {date} | {n} endorsed, {m} skipped. Operation timestamped {date} |
| Le visa groupé a échoué : {msg}. Aucun dossier n'a été visé. · erreur inconnue | Bulk endorsement failed: {msg}. No file was endorsed. · unknown error |
| Cette action génère une entrée d'audit AUDIT_BULK_VISA_GRANTED | This action creates an audit log entry AUDIT_BULK_VISA_GRANTED (D3) |
| Annuler · Fermer · Validation... · Confirmer le Visa | Cancel · Close · Validating… · Confirm endorsement |
| Rejet administratif groupé · Ressort territorial : | Bulk administrative rejection · Territory: |
| {n} dossier(s) rejeté(s). Opération journalisée sous AUDIT_BULK_REJECT, horodatée au {date} | {n} rejected. Operation logged as AUDIT_BULK_REJECT, timestamped {date} (D3) |
| Aucun des dossiers sélectionnés n'est éligible au rejet (ils doivent être en attente de visa ou en correction). | None of the selected files can be rejected (they must be awaiting endorsement or in correction). |
| Vous allez rejeter {n} dossier(s) sélectionné(s). Cette action est officielle et irréversible sans arbitrage. | You are about to reject {n, plural} selected files. This action is official and cannot be reversed without arbitration. |
| Motif de rejet groupé · Indiquez le motif précis du rejet administratif (10 caractères minimum)… | Bulk rejection reason · State the exact reason for the administrative rejection (10 characters minimum)… |
| Le motif doit comporter au moins 10 caractères ({n}/10) | The reason must be at least 10 characters ({n}/10) |
| Je certifie sur l'honneur avoir examiné ces {n} dossiers et confirme leur rejet officiel. | I solemnly certify that I have reviewed these {n} files and confirm their official rejection. |
| Le rejet groupé a échoué : {msg}. Aucun dossier n'a été rejeté. | Bulk rejection failed: {msg}. No file was rejected. |
| Rejet en cours... · Rejeter {n} dossier(s) | Rejecting… · Reject {n, plural} files |
| entityTypeLabel: Entreprise · Coopérative · CTD · ONG · Administration · Projet / Programme · Centre de formation professionnelle | **D5** |

### B4. `dossiers/[id]/page.tsx` (File detail)

| French | English |
|---|---|
| En instance · Visé · Correction demandée · Rejeté | Pending · Endorsed · Correction requested · Rejected |
| Section titles (4) | **D2** |
| Fiche reçue par le serveur central · Campagne {code} | Form received by the central server · Campaign {code} |
| Visa administratif accordé · Dossier rejeté · Retour pour correction · Décision enregistrée | Administrative endorsement granted · File rejected · Returned for correction · Decision recorded |
| ← Retour aux dossiers · Retour aux dossiers | ← Back to files · Back to files |
| ce dossier · Dossier introuvable · Accès non autorisé | this file · File not found · Access denied |
| Aucun dossier ne correspond à cet identifiant dans votre ressort territorial. | No file matches this ID in your territory. |
| Votre rôle ne permet pas de consulter ce dossier. | Your role does not allow you to view this file. |
| Dossier # · Statut non renseigné · Soumis le {date} · — Région {r} | File # · Status not recorded · Submitted on {date} · — Region {r} |
| Rejeter la Fiche · Demander une correction · Valider et Archiver | Reject form · Request a correction · Validate and archive |
| AXE 1 · VISA ADMINISTRATIF · AXE 2 · QUALITÉ DES DONNÉES · AXE 3 · ÉLIGIBILITÉ STATISTIQUE | AXIS 1 · ADMINISTRATIVE ENDORSEMENT · AXIS 2 · DATA QUALITY · AXIS 3 · STATISTICAL ELIGIBILITY |
| ⏱ EN INSTANCE · 🚩 2 Avertissements · En attente d'arbitrage | **D4** — hardcoded |
| Informations sur le Répondant · NOM COMPLET · FONCTION / POSTE · TÉLÉPHONE · ADRESSE EMAIL | Respondent information · FULL NAME · FUNCTION / POSITION · PHONE · EMAIL ADDRESS |
| Informations de la Structure · RAISON SOCIALE · SIÈGE SOCIAL · SECTEUR D'ACTIVITÉ · BRANCHE · TAILLE DE L'ENTREPRISE · EMPLOYÉS PERMANENTS | Organisation information · COMPANY NAME · HEAD OFFICE · SECTOR OF ACTIVITY · BRANCH · COMPANY SIZE · PERMANENT EMPLOYEES |
| Région d'implantation · Département · Ville / Commune · Quartier / Adresse · Année de création · Régime/statut juridique | Region of location · Department · Town / municipality · Neighbourhood / address · Year of creation · Legal status |
| Société unipersonnelle · SARL · SA · Autres | Single-member company · LLC · PLC · Others |
| les données de cette section · Données chiffrées non affichées ici | the data for this section · Figures not shown here |
| Les tableaux statistiques de cette section ({tables}) sont enregistrés avec le dossier, mais leur restitution dans cet écran n'est pas encore spécifiée par le domaine ONEFOP. Consultez le P… | The statistical tables for this section ({tables}) are saved with the file, but how they are shown on this screen has not yet been specified by the ONEFOP domain. See the P… (full sentence translated at implementation) |
| Anomalies bloquantes ({n}) · Alertes de cohérence ({n}) · Observé : · Attendu : | Blocking anomalies ({n}) · Coherence warnings ({n}) · Observed: · Expected: |
| Aucune anomalie détectée. Le dossier est conforme aux règles de cohérence. | No anomaly detected. The file meets the coherence rules. |
| Historique d'instruction de la Fiche · Voir les événements d'audit → | Form review history · View audit events → |
| l'historique d'instruction · Aucune étape horodatée · Ce dossier ne porte aucune date de soumission ni de décision. | the review history · No timestamped step · This file carries no submission or decision date. |
| En attente de décision · Aucune décision enregistrée | Awaiting decision · No decision recorded |
| Retour pour Correction · Déclaration # | Return for correction · Declaration # |
| La demande de correction a été enregistrée avec succès et notifiée au déclarant. | The correction request was saved and the respondent was notified. |
| 1. SECTION CONCERNÉE · Sélectionnez une section… | 1. SECTION CONCERNED · Select a section… |
| 2. PROBLÈME CONSTATÉ · Décrivez l'écart ou la non-conformité constatée sur ce dossier. | 2. PROBLEM FOUND · Describe the discrepancy or non-compliance found in this file. |
| 3. AXE DE QUALITÉ (DIAGNOSTIC DU DOSSIER) · Axe 2 — {n} anomalie(s) bloquante(s), {m} avertissement(s) | 3. QUALITY AXIS (FILE DIAGNOSTIC) · Axis 2 — {n, plural} blocking anomalies, {m, plural} warnings |
| 4. ACTION DEMANDÉE AU DÉCLARANT · Demander des documents justificatifs | 4. ACTION REQUESTED FROM THE RESPONDENT · Request supporting documents |
| Délai de correction accordé : · 3 / 7 / 15 jours ouvrables · 30 jours calendaires | Correction deadline: · 3 / 7 / 15 working days · 30 calendar days |
| Je certifie sur l'honneur que cette demande de correction est motivée et conforme aux règles ministérielles. | I solemnly certify that this correction request is justified and complies with ministerial rules. |
| La demande de correction a échoué : {msg} · Erreur inconnue | The correction request failed: {msg} · Unknown error |
| Cette action génère une entrée d'audit DECLARATION.RETURNED | This action creates an audit log entry DECLARATION.RETURNED (D3) |
| Transmission... · Confirmer le Retour | Sending… · Confirm return |
| Le dossier a été officiellement visé et archivé. | The file was officially endorsed and archived. |
| Cette action accorde le visa administratif officiel à cette fiche et la marque comme validée pour intégration statistique. Confirmez-vous la décision ? | This action grants the official administrative endorsement to this form and marks it as validated for statistical integration. Do you confirm the decision? |
| La validation a échoué : · Validation... · Confirmer la validation | Validation failed: · Validating… · Confirm validation |
| La fiche a été officiellement rejetée. Le déclarant en a été informé. | The form was officially rejected. The respondent has been informed. |
| Cette décision met un terme au processus d'instruction pour cette déclaration. | This decision ends the review process for this declaration. |
| Motif du rejet · Précisez le motif légal ou technique du rejet (10 caractères minimum)… | Rejection reason · State the legal or technical reason for the rejection (10 characters minimum)… |
| Je certifie sur l'honneur que cette décision de rejet est motivée et conforme aux règles ministérielles. | I solemnly certify that this rejection decision is justified and complies with ministerial rules. |
| Cette action génère une entrée d'audit AUDIT_REJECT. · Le rejet a échoué : | This action creates an audit log entry AUDIT_REJECT. (D3) · The rejection failed: |
| Rejet en cours... · Confirmer le Rejet | Rejecting… · Confirm rejection |
| Correction comment composed for the respondent: « Constat : … — Action demandée : … — Pièces justificatives requises. — Délai accordé : … » | **D3b** |

---

## C. Decisions

- **D1 Visa.** "Administrative endorsement / Endorse / Endorsed", or "Approval / Approve / Approved"? (Approval collides with the « Approuvées » pipeline stage and registration approval.)
- **D2 Section titles on the file detail page.** The page writes « Section 2 : Emploi et Conditions de Travail », « Section 3 : Départs, Licenciements et Retraites », « Section 4 : Stage et Formation Professionnelle continue », « Section 1 : Identification de l'Établissement ». The canonical AST (generated schema) says « SECTION 2. EMPLOI ET TRAVAIL / EMPLOYMENT AND LABOUR », « SECTION 3. DÉPARTS / DEPARTURES », « SECTION 4. STAGE ET FORMATION / INTERNSHIP AND TRAINING », « SECTION 1. IDENTIFICATION DE L'ENTREPRISE / COMPANY DETAILS ». Options: (a) translate the page's wording literally, keep the French drift; (b) align both languages to the AST titles (changes the French). Recommend (b): the AST is canonical (CLAUDE.md §3).
- **D3 Persisted and audit text.**
  (a) The correction comment is composed on screen and stored/sent to the respondent. Recommend it stays **French regardless of the reviewer's locale** (it is the official record the respondent reads; the respondent's language is not known here). The section/deadline option *values* stay French; only their visible labels translate.
  (b) Audit event codes (AUDIT_BULK_VISA_GRANTED, DECLARATION.RETURNED, AUDIT_REJECT) stay as codes.
- **D4 Hardcoded axis badges.** `dossiers/[id]/page.tsx:558,588,618` render the literals « ⏱ EN INSTANCE », « 🚩 2 Avertissements », « En attente d'arbitrage » regardless of the dossier — static mock values, against the admin-data-state rules (a fabricated government fact). Translation would carry the fabrication into English. Recommend: translate the axis *headings* only, and flag the badges as a separate fix (wire them to the dossier's real status/diagnostic) — not done in this phase.
- **D5 Entity type labels in the files list** (`entityTypeLabel`): currently codes « CTD », « ONG ». Recommend the same labels as Phase 2 (`registerPage.entityOption*`): Collectivité territoriale / Local authority, ONG ou association / NGO or association, etc. Changes the French.
- **D6 « Compléments »** column (CoverageTable): proposed "Further information requests" — confirm what it counts.
- **D7 `/admin/equipe`** (Équipe territoriale) is in the Supervision hub but not in your Phase 3 list. Add it to Phase 3, or a later phase?
- **D8 Client-side error messages in `lib/api-client.ts`** (« Impossible de joindre le serveur… », export failures) are shown on both admin and respondent screens. Recommend a dedicated slot in Phase 7.
