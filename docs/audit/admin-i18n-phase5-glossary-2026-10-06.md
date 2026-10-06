# Admin bilingualism — Phase 5 glossary (Collecte and Contrôle Qualité)

Date: 2026-10-06
Scope: `react-web/src/app/admin/campagnes/page.tsx`, `questionnaires/page.tsx`,
`centre-qualite/page.tsx`, and the label maps they read from
`lib/campaigns.ts` (status, periodicity, purpose, reminder types) and
`lib/anomaly-registry.ts` (anomaly status). French unchanged unless a
decision says otherwise. ✅ = confirmed earlier.

---

## A. Terms

| French | English | Notes |
|---|---|---|
| Collecte ✅ / Campagne ✅ / Campagne d'inscription | Collection / Campaign / Registration campaign | |
| Brouillon ✅ / Active / En pause / Clôturée / Archivée | Draft / Active / Paused / Closed / Archived | campaign status |
| Cible (registration campaign status) | Target | as Phase 3 |
| Trimestrielle / Semestrielle / Annuelle | Quarterly / Half-yearly / Annual | periodicity |
| 2026-T3 ✅ / T1 (1er trimestre) | 2026-Q3 / Q1 (1st quarter) | |
| Échéance / Date limite | Deadline | |
| Prorogation / Prorogée / Prolonger | Extension / Extended / Extend | |
| Rappel / Relance | Reminder | |
| Clôturer / Archiver / Activer / Mettre en pause | Close / Archive / Activate / Pause | |
| Recensement | Census | « Lancer une campagne de recensement » |
| Homologué / homologuées | Certified | officially approved questionnaire |
| Module de collecte · Questionnaire ONEFOP · Déclaration DSMO | Collection module · ONEFOP questionnaire · DSMO declaration | |
| Registre des anomalies / Règles de validation / Famille de règles | Anomaly register / Validation rules / Rule family | |
| Sévérité / Bloquante / Avertissement ✅ | Severity / Blocking / Warning | |
| Ouverte / Résolue / Dérogée (status) · Dispensées (filter) | Open / Resolved / Waived · Waived | **D4** |
| Levée (d'une anomalie) / Décision de levée | Clearance / Clearance decision | |
| Dérogation administrative / Dispense légale | Administrative derogation / Legal waiver | |
| Pièce justificative ✅ / PV d'enquête | Supporting document / Inspection report | |

## B. Strings

### B1. `campagnes/page.tsx`

| French | English |
|---|---|
| Action réservée aux administrateurs et au niveau central : votre rôle permet la consultation seulement. | Reserved for administrators and the central level: your role allows read-only access. |
| Questionnaire ONEFOP · Déclaration DSMO (module labels) | ONEFOP questionnaire · DSMO declaration |
| Aucune échéance fixée · Échéance illisible · Échue · depuis le {date} · {n} jour(s) · jusqu'au {date} | No deadline set · Unreadable deadline · Past due · since {date} · {n, plural} day(s) · until {date} |
| Campagne activée avec succès. · Campagne mise en pause. · Campagne clôturée. · Campagne archivée. · Campagne supprimée avec succès. · Rappel envoyé. · Échéance prolongée. | Campaign activated. · Campaign paused. · Campaign closed. · Campaign archived. · Campaign deleted. · Reminder sent. · Deadline extended. |
| Accès restreint aux responsables de campagnes. | Access restricted to campaign managers. |
| Lancer une campagne | Launch a campaign |
| Consultation seule : l'activation, la pause, la prolongation, la clôture et les rappels sont réservés aux administrateurs et au niveau central. | Read-only: activating, pausing, extending, closing and reminders are reserved for administrators and the central level. |
| Fermer (aria) | Close |
| Aucune campagne active · Activez une campagne en brouillon ci-dessous, ou lancez-en une nouvelle avec le bouton ci-dessus. | No active campaign · Activate a draft campaign below, or launch a new one with the button above. |
| Historique des campagnes · {n} campagne(s) | Campaign history · {n, plural} campaign(s) |
| Impossible de charger les campagnes : {msg} | Unable to load campaigns: {msg} |
| Aucune autre campagne · Créez et activez une campagne avec le bouton « Lancer une campagne » ci-dessus. | No other campaign · Create and activate a campaign with the "Launch a campaign" button above. |
| Campagne · Type · Ouverture · Clôture · Statut · Actions | Campaign · Type · Opening · Closing · Status · Actions |
| Prorogée (était {date}) · (prorogée, était {date}) | Extended (was {date}) · (extended, was {date}) |
| Activer · Supprimer · Archiver · Voir les détails · Voir les détails de {name} (aria) | Activate · Delete · Archive · View details · View details of {name} |
| Communication · Envoyer un rappel · Envoi… · Envoyer · Type de rappel | Communication · Send a reminder · Sending… · Send · Reminder type |
| Reminder types: Annonce de campagne · Échéance approchante · Dernier rappel · Prorogation | Campaign announcement · Deadline approaching · Final reminder · Extension |
| Le rappel sera envoyé par courriel à tous les établissements dont la déclaration est encore en brouillon ou non soumise pour cette campagne. | The reminder will be emailed to every establishment whose declaration is still a draft or not submitted for this campaign. |
| Prorogation · Prolonger « {name} » · Prolonger la campagne · Prolongation… · Prolonger · Nouvelle date limite · Échéance actuelle : {date}. | Extension · Extend "{name}" · Extend the campaign · Extending… · Extend · New deadline · Current deadline: {date}. |
| Clôture · Clôturer « {name} » ? · Clôture… · Clôturer la campagne · La collecte sera fermée : les établissements ne pourront plus soumettre de déclaration pour cette campagne. | Closure · Close "{name}"? · Closing… · Close the campaign · Collection will be closed: establishments will no longer be able to submit a declaration for this campaign. |
| Suppression · Supprimer « {name} » ? · Suppression… · Supprimer définitivement · Cette action est irréversible. Seules les campagnes en brouillon sans aucune donnée liée (soumissions, quotas, gels) peuvent être supprimées. | Deletion · Delete "{name}"? · Deleting… · Delete permanently · This action cannot be undone. Only draft campaigns with no linked data (submissions, quotas, freezes) can be deleted. |
| Archivage · Archiver « {name} » ? · Archivage… · Archiver la campagne · La campagne sera archivée. Les données historiques seront conservées, mais aucune nouvelle saisie ne sera possible. | Archiving · Archive "{name}"? · Archiving… · Archive the campaign · The campaign will be archived. Historical data is kept, but no new entry will be possible. |
| Campagne active : {name} (aria) · Date début : {d} │ Date fin : {d} | Active campaign: {name} · Start date: {d} │ End date: {d} |
| Jours restants · Établissements ciblés · Déclarations attendues à l'activation · Soumissions collectées · Suivi non disponible : le serveur ne met pas encore à jour les soumissions de campagne | Days remaining · Targeted establishments · Declarations expected at activation · Submissions collected · Tracking not available: the server does not yet update campaign submissions |
| Envoyer un rappel · Prolonger · Mettre en pause · Archiver · Clôturer la campagne | Send a reminder · Extend · Pause · Archive · Close the campaign |
| Questionnaires assignés · Tous les types d'établissement | Assigned questionnaires · All establishment types |
| Échéancier de la campagne · Lancement de la collecte · Date limite de déclaration · Terminé · En cours | Campaign schedule · Collection launch · Declaration deadline · Done · In progress |
| Details dialog: Fermer · Impossible de charger le détail : {msg} · Statut · Module · Période de référence · Périodicité · Objet · Ouverture · Échéance · Prorogation · Clôturée le · Créée par · Régions ciblées · Départements ciblés · Types d'établissement · Établissements ciblés · Tous | Close · Unable to load details: {msg} · Status · Module · Reference period · Periodicity · Purpose · Opening · Deadline · Extension · Closed on · Created by · Targeted regions · Targeted departments · Establishment types · Targeted establishments · All |
| Rappels envoyés (10 derniers) · Date · Type · Envoyés · Échecs · Aucun rappel envoyé pour cette campagne. | Reminders sent (last 10) · Date · Type · Sent · Failed · No reminder sent for this campaign. |
| Create dialog: Campagne d'inscription créée. Saisissez ses cibles dans Collecte › Quotas et retours. · Campagne créée et activée avec succès. | Registration campaign created. Enter its targets in Collection › Quotas and returns. · Campaign created and activated. |
| Veuillez renseigner les dates de début et d'échéance. · La date limite doit être postérieure à la date de début. · Veuillez renseigner l'année et le trimestre de référence. | Enter the start date and the deadline. · The deadline must be after the start date. · Enter the reference year and quarter. |
| Nouvelle cible · Nouvelle collecte · Définir une campagne d'inscription · Lancer une campagne de recensement | New target · New collection · Define a registration campaign · Launch a census campaign |
| Création en cours… · Créer la campagne · Lancer la campagne | Creating… · Create the campaign · Launch the campaign |
| Objet de la campagne · Collecte — Campagne de collecte · Inscription — Campagne d'inscription · Une campagne d'inscription porte des cibles d'inscription ; elle n'ouvre pas de collecte. | Campaign purpose · Collection — Collection campaign · Registration — Registration campaign · A registration campaign holds registration targets; it does not open a collection. |
| Les campagnes d'inscription concernent uniquement le module ONEFOP. · Module de collecte · Déclaration sur la situation de la main d'œuvre (DSMO) · Questionnaire ONEFOP (Emplois créés) | Registration campaigns apply to the ONEFOP module only. · Collection module · Declaration on the workforce situation (DSMO) · ONEFOP questionnaire (jobs created) |
| Année de référence * · ex. 2026 · Trimestre de référence * · Sélectionner… · T1 (1er trimestre) … T4 (4e trimestre) · Période sur laquelle portent les données | Reference year * · e.g. 2026 · Reference quarter * · Select… · Q1 (1st quarter) … Q4 (4th quarter) · Period the data covers |
| Périodicité · Date de début · Date limite (Échéance) · Description ou instructions (optionnel) · Note interne sur la cible d'inscription · Instructions particulières communiquées aux établissements déclarant… | Periodicity · Start date · Deadline · Description or instructions (optional) · Internal note on the registration target · Specific instructions sent to reporting establishments… |
| Activer les rappels automatiques (relances envoyées à J-7, J-3 et J-1 de l'échéance) | Enable automatic reminders (sent 7, 3 and 1 days before the deadline) |
| Campaign display names (formatCampaignDisplayName) | **D1** |

### B2. `questionnaires/page.tsx`

| French | English |
|---|---|
| Modèles nationaux de fiches d'enquête et de déclaration pour le recueil statistique DSMO | National survey and declaration form templates for DSMO statistical collection |
| Le schéma ONEFOP n'a pas pu être chargé : {msg} | The ONEFOP schema could not be loaded: {msg} |
| Homologué · En vigueur | Certified · In force — **D3** |
| {n} sections d'enquête homologuées · Chargement des sections… | {n} certified survey sections · Loading sections… |
| Total déclarations déposées · Dans votre ressort · Non accessible à votre rôle | Total declarations filed · In your territory · Not available to your role |
| Format réglementaire · DSMO-ONEFOP-v2 | Regulatory format · DSMO-ONEFOP-v2 — **D3** |
| Voir dossiers · Aperçu | View files · Preview |
| Référentiel des Questionnaires Canoniques | Canonical questionnaire register |
| Les modèles de fiches de collecte ONEFOP sont compilés à partir de l'AST canonique institutionnel. Toute modification structurelle requiert un arrêté d'homologation ministériel. | ONEFOP collection form templates are compiled from the institutional canonical AST. Any structural change requires a ministerial certification order. — **D3** |
| Schéma canonique actif v{v} : {s} sections, {q} questions recensées au niveau national. | Active canonical schema v{v}: {s} sections, {q} questions recorded nationally. |
| Structure Règlementaire · ONEFOP · Aperçu : {type} · Fermer · Consulter les dossiers ({code}) | Regulatory structure · ONEFOP · Preview: {type} · Close · Open files ({code}) |
| Questionnaire national pour : {type} | National questionnaire for: {type} |
| Type d'entité : {code} · Format d'export : SPSS / CSV / Excel | Entity type: {code} · Export format: SPSS / CSV / Excel — **D3** |
| Sections d'enquête homologuées ({n}) · Identifiant : {id} · Ordre : {n} · {n} question(s) / champ(s) | Certified survey sections ({n}) · ID: {id} · Order: {n} · {n, plural} question(s) / field(s) |
| Chargement de la structure réglementaire… · Structure de sections non disponible pour ce questionnaire. | Loading the regulatory structure… · Section structure not available for this questionnaire. |
| Section titles (`sec.title.fr`) | **D2** |
| Entity type card titles (`entityTypeLabel`, codes) | the Phase 2–4 labels (`ENTITY_TYPE_OPTION_KEYS`), as approved |

### B3. `centre-qualite/page.tsx`

| French | English |
|---|---|
| Indicateurs · Registre des anomalies · Règles de validation (tabs) | Indicators · Anomaly register · Validation rules |
| L'anomalie a été résolue et l'opération consignée au journal d'audit. · Erreur lors de la résolution de l'anomalie. | The anomaly was resolved and the operation recorded in the audit log. · Error while resolving the anomaly. |
| Veuillez saisir un motif ou une justification pour la résolution de l'anomalie. | Enter a reason or justification for resolving the anomaly. |
| INDICATEURS DE QUALITÉ · Complétude · Dossiers complets · Cohérence · Sans contradiction · Taux d'anomalies · {n} bloquante(s) · Avertissements · {n} alerte(s) · Éligibilité statistique · {n} dossier(s) prêts | QUALITY INDICATORS · Completeness · Complete files · Coherence · No contradiction · Anomaly rate · {n} blocking · Warnings · {n} alert(s) · Statistical eligibility · {n} file(s) ready |
| ANOMALIES PAR TYPE ET PAR RÉGION · Par famille de règles · Chargement des familles… · Aucune anomalie ouverte par famille. · Par région · Chargement des régions… · Aucune anomalie ouverte par région. | ANOMALIES BY TYPE AND REGION · By rule family · Loading families… · No open anomaly by family. · By region · Loading regions… · No open anomaly by region. |
| RÈGLES DE VALIDATION ({n}) · ACTIVES · le référentiel des règles · Aucune règle répertoriée · Les règles de contrôle configurées s'afficheront ici. · Famille : {f} · BLOQUANTE · AVERTISSEMENT | VALIDATION RULES ({n}) · ACTIVE · the rule register · No rule listed · Configured control rules will appear here. · Family: {f} · BLOCKING · WARNING |
| Registre des anomalies ({n}) · Tableau d'instruction détaillé des anomalies détectées sur les déclarations soumises. | Anomaly register ({n}) · Detailed review table of anomalies detected in submitted declarations. |
| Tous statuts · Ouvertes · Résolues · Dispensées · Toutes sévérités · Bloquantes uniquement · Avertissements uniquement · Actualiser | All statuses · Open · Resolved · Waived · All severities · Blocking only · Warnings only · Refresh |
| Déclaration / Dossier · Règle & Code · Description de l'Anomalie · Sévérité · Détectée le · Statut · Action | Declaration / File · Rule & code · Anomaly description · Severity · Detected on · Status · Action |
| le registre des anomalies · Aucune anomalie enregistrée · Aucune anomalie correspondant à ce périmètre n'est actuellement enregistrée. | the anomaly register · No anomaly recorded · No anomaly is currently recorded for this scope. |
| Observé : · Attendu : · Écart : · Bloquante · Avertissement · Résoudre · Traitée | Observed: · Expected: · Gap: · Blocking · Warning · Resolve · Handled |
| Contrôle Qualité · Décision de Levée · Résolution de l'anomalie : {code} | Quality control · Clearance decision · Resolving anomaly: {code} |
| Annuler · Enregistrement… · Confirmer la Résolution | Cancel · Saving… · Confirm resolution |
| Déclaration : {ref} · Région : {r} | Declaration: {ref} · Region: {r} |
| Mode de résolution administratif | Administrative resolution method |
| Correction validée du déclarant · Les données ont été vérifiées et mises en conformité suite au retour de révision | Respondent's correction validated · The data was checked and brought into compliance after the review return |
| Contrôle physique / Enquête de terrain concluante · Un agent ONEFOP assermenté a vérifié la conformité in situ | Physical check / conclusive field inspection · A sworn ONEFOP officer checked compliance on site |
| Dispense légale / Dérogation administrative (WAIVED) · Réservée à la Direction Centrale ONEFOP / SuperAdmin National avec visa motivé | Legal waiver / administrative derogation (WAIVED) · Reserved for the ONEFOP Central Directorate / national super administrator, with a reasoned endorsement |
| Justification administrative & Note d'audit * · Précisez les constatations, références de pièces ou motifs légaux justifiant la résolution de cette anomalie… | Administrative justification & audit note * · State the findings, document references or legal grounds justifying the resolution of this anomaly… |
| Lien de la pièce justificative ou PV d'enquête (optionnel) · https://... ou réf. archivage | Link to the supporting document or inspection report (optional) · https://... or archive ref. |
| Server text shown as-is: rule names, descriptions and families; anomaly descriptions and rule families | stays French (backend) |

---

## C. Decisions

- **D1 Campaign names.** Names are stored data. `formatCampaignDisplayName` rewrites two known official names into a French display title (« Collecte des données sur les emplois (Secteur moderne) », « Déclaration sur la situation de la main d'œuvre (DSMO) »). Recommend: keep campaign names as stored data, untranslated, including that French rewrite — they are official titles.
- **D2 Questionnaire section titles** on the Questionnaires preview read `sec.title.fr` from the generated schema, which also carries the AST's English. Recommend: show `sec.title` in the console locale (canonical AST English in English).
- **D3 Fixed claims on the Questionnaires page**: « Homologué », « En vigueur », « Format réglementaire DSMO-ONEFOP-v2 », « Format d'export : SPSS / CSV / Excel », and « Toute modification structurelle requiert un arrêté d'homologation ministériel » are literals, not read from any record. Recommend: translate them as they are now and flag them for domain review (I cannot verify them); no behaviour change in this phase.
- **D4 WAIVED wording.** The status label is « Dérogée » but the registry filter says « Dispensées » for the same status. Recommend: "Waived" for both in English; keep both French words as they are (aligning the French is a separate wording call for you).
- **D5 Backend text** — validation rule names/descriptions/families, anomaly descriptions — stays French.
