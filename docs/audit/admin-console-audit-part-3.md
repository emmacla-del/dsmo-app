# Admin console audit — part 3: domain model, lifecycles, user flows

[Index](README.md) · [Part 1](admin-console-audit-part-1.md) · [Part 2](admin-console-audit-part-2.md) · Part 3 · [Part 4](admin-console-audit-part-4.md)

## 6. Domain model

Source: `prisma/schema.prisma` (74 models; only those the console shows are listed) and the front-end types that read them. Field lists are abridged to what the console displays or filters on; full lists are in the schema.

### 6.1 Entities

| Entity (model) | Key fields the console uses | Relations | Shown on |
|---|---|---|---|
| **User** | `id`, `email`, `firstName`, `lastName`, `role: UserRole`, `status: UserStatus`, `isActive`, `region`, `department`, `subdivision`, `matricule`, `poste`, `serviceCode`, `positionType`, `positionTitle`, `registrationMethod`, `createdBy`, `approvedBy`, `approvedAt`, `rejectedBy`, `rejectionReason`, `archivedAt`, `archivedBy`, `archiveReason`, `assigneeId`, `lastLoginAt`, `createdAt` | `company`, `assignee`, `createdByUser`, `approvedByUser`, `auditLogs`, `userNotifications` | utilisateurs, annuaire, inscriptions (a registration *is* a `COMPANY` user), journal |
| **Company** (establishment) | `id`, `name`, `entityType: OnefopEntityType`, `establishmentId`, `registrationNumber`, `taxNumber` (NIU), `cnpsNumber`, `region`, `department`, `subdivision`, `mainActivity`, `sector`, `legalStatus`, `enterpriseSize`, `yearOfCreation`, `phone`, `address`, `respondentFirstName/LastName/Function/Phone`, `totalEmployees`, `menCount`, `womenCount`, `lastYearTotal`, `createdAt` | `user` (1:1 account), `onefopSubmissions`, `campaignSubmissions` | etablissements, etablissement-detail, inscriptions |
| **Registration** | not a model: the `COMPANY` `User` plus its `Company`, read through `GET /auth/company-registrations` (`CompanyRegistrationItem`: `organisation`, `status`, `overdue`, `waitingSince`, `duplicateHints[]`, `lastResubmission{at, changes}`, `requiresCentralStructureCheck`, `assigneeId/Name`, `createdBy/Name`, `registrationMethod`, `hasSubmitted`) | — | inscriptions |
| **DataCampaign** (campaign) | `id`, `code`, `name`, `description`, `status: CampaignStatus`, `purpose: CampaignPurpose`, `collectionType: SubmissionModule` (`ONEFOP`/`DSMO`), `periodicity`, `startDate`, `deadline`, `extendedDeadline`, `closedAt`, `referenceYear`, `referenceQuarter`, `targetRegions[]`, `targetDepartments[]`, `targetEntityTypes[]`, `autoReminders`, `reminderDays[]` | `quotas`, `submissions` (CampaignSubmission), `reminders`, `onefopSubmissions`, `creator` | campagnes, cibles, pilotage, dossiers |
| **CampaignQuota** (target) | `campaignId`, `scopeKind: CampaignQuotaScope` (`TERRITORIAL`/`ADMINISTRATION`), `regionId`, `departmentId`, `entityType` (nullable), `submissionTarget: Int`, `createdBy`, `updatedBy` | `campaign`, `region`, `department` | cibles (`TargetGrid`), coverage |
| **CampaignSubmission** | `campaignId`, `companyId`, `establishmentId`, `status: SubmissionStatus`, `submittedAt` | `campaign`, `company` | pilotage coverage, follow-up (indirect) |
| **CampaignReminder** | `sentAt`, `reminderType`, `recipientCount`, `failedCount`, `subject` | `campaign` | campagnes details dialog |
| **OnefopSubmission** (dossier / télédéclaration) | `id`, `submissionId`, `formType: OnefopEntityType`, `status: OnefopStatus`, `rawData: Json`, `flags`, `rejectionReason`, `reviewedBy`, `reviewedAt`, `submissionDate`, `region`, `department`, `subdivision`, `assigneeId`, `claimActivityAt`, `revision`, `quarterCode`, `campaignId`, `isLate`, `supersededById`, `archivedAt`, `archiveReason` | `company`, `campaign`, `assignee`, `anomalies`, `supersededBy`/`supersedes`, ~30 normalized statistical child tables | dossiers, dossiers/[id], questionnaires (counts), etablissement-detail |
| **OnefopAnomaly** (finding / anomaly) | `id`, `submissionId`, `ruleCode`, `ruleFamily` (`COHERENCE`, `VT_COHERENCE`, `COMPLETENESS`, `ELIGIBILITY`, `ARITHMETIC` per `RULE_FAMILY_LABELS`), `severity: AnomalySeverity`, `isBlocking`, `status: AnomalyStatus`, `description`, `observedValue`, `expectedValue`, `deltaValue`, `detectedAt`, `resolvedAt`, `resolvedById`, `resolutionType`, `resolutionNote`, `evidenceUrl` | `submission`, `resolvedBy` | centre-qualite, dossiers/[id] ("À vérifier") |
| **Finding** | not a model: the workspace groups an anomaly's per-sex rows into one finding (`lib/dossier-findings.ts`, `dossier-explain.ts`) | — | dossiers/[id] |
| **StaffInvitation** (one person) | no table: a signed, expiring JWT (backend `src/auth/staff-invitation.service.ts`), created by `POST /auth/admin/staff-invitations`; its only stored trace is the audit rows | — | utilisateurs (`InviteAgentDialog`) |
| **StaffInvitationLink** (group link) | `id`, `label`, `level` (string: incl. `territorial`), `region`, `department`, `serviceCode`, `positionType`, `maxUses`, `useCount`, `expiresAt`, `revokedAt`, `createdBy` | `createdByUser` | utilisateurs (`GroupInvitationLinks`) |
| **MinefopService / ServicePosition** | organigramme: `code`, `name`, `acronym`, `category`, `level`, `parentCode`, `roleMapping`, `requiresRegion`, `requiresDepartment`; positions `positionType`, `title`, `titleEn` | — | invitation dialogs |
| **Sector** | `id`, `name`, `nameEn`, `category`, `code` | `companies` | sectors, registration form |
| **UserNotification** | `id`, `userId`, `kind` (free text: `NUDGE`, and labels exist for `ASSIGNMENT`, `APPROVAL`, `REJECTION`), `subject`, `body`, `linkHref`, `readAt`, `createdAt` | `user` | bell, notifications |
| **AuditLog** (audit entry) | `id`, `userId`, `action` (string), `resourceType`, `resourceId`, `details: Json`, `previousValue`, `newValue`, `timestamp`, `ipAddress`, `userAgent` | `user` | journal-audit, parametres, etablissement-detail |
| **SystemSettings** | `observatoryName`, `countryCode`, `defaultLanguage`, `timezone`, `registrationOverdueDays`, `updatedBy`, `updatedAt` | — | parametres |
| **Export history** | `ExportHistoryItem` from `GET /data-management/export/history`; no model of its own: read from `AuditLog` rows with action `DATA_EXPORT` (backend `data-management.service.ts`) | — | diffusion |

Representative seed records (`prisma/seed.ts`, organigramme; no personal data in it). The seed holds no establishments, users, campaigns or submissions; the brief's request for sample records of those is NOT DETERMINED from seed or fixture data.

| code | name | category | level | roleMapping | requiresRegion / Department |
|---|---|---|---|---|---|
| `DRMO` | Direction de la Régulation de la Main-d'Oeuvre | CENTRALE | 1 | CENTRAL | false / false |
| `DRMO-SDRPMO-SSPMO` | Service des Statistiques et de la Planification de la Main-d'Oeuvre | CENTRALE | 3 | CENTRAL | false / false |
| `DREFOP` | Délégation Régionale de l'Emploi et de la Formation Professionnelle | DECONCENTRE | 1 | REGIONAL | true / false |
| `DREFOP-SPE` | Service de la Promotion de l'Emploi | DECONCENTRE | 2 | REGIONAL | true / false |
| `DDEFOP` | Délégation Départementale de l'Emploi et de la Formation Professionnelle | DECONCENTRE | 1 | DIVISIONAL | true / true |

### 6.2 Enums, labels and badge colours

Badge tones map to `.cam-badge-success|warning|info|error|neutral` or shadcn `Badge` variants `success|warning|info|danger|neutral`.

**UserRole** — see part 1 §4.1.

**OnefopEntityType**: `ENTREPRISE`, `COOPERATIVE`, `CTD`, `ONG`, `ADMINISTRATION`, `PROJECT_PROGRAM`, `VOCATIONAL_TRAINING`, `VOCATIONAL_TRAINING_CENTER` (deprecated, never written). Labels via `ENTITY_TYPE_OPTION_KEYS` (`lib/companies-directory.ts`); the dossier queue overrides two inline: `Projet / programme`, `Centre de formation`.

**UserStatus** (registration / account):

| Value | Label in inscriptions (FR \| EN) | Badge |
|---|---|---|
| `PENDING_APPROVAL` | En attente \| Pending | warning |
| `COMPLEMENTS_REQUESTED` | Compléments demandés \| Further information requested | info |
| `ACTIVE` | Approuvée \| Approved | success |
| `REJECTED` | Rejetée \| Rejected | danger |
| `DRAFT`, `UNDER_REVIEW`, `DOCUMENTS_INCOMPLETE` | no label; rendered as the raw code | neutral |
| derived "overdue" | En retard · {days} j \| Overdue · {days} d | danger |

Account activity (not a status): `isActive` false → `Compte suspendu` (badge variant `rejected`); true → `Compte actif` (`active`); no user → `Aucun compte lié` (`neutral`) (`etablissement-detail`). The register page maps to `Actif`, `En attente`, `Rejeté`, `Suspendu`, `Aucun compte lié` (hard-coded French, `STATUS_LABELS`).

**OnefopStatus** (dossier):

| Value | Queue/completed badge (FR \| EN) | Tone | Status filter label |
|---|---|---|---|
| `DRAFT` | Statut non renseigné \| Status not recorded | neutral | — (never in the queue) |
| `PENDING_REVIEW` | En instance \| Pending | warning | En attente |
| `CORRECTION_REQUESTED` | Correction demandée \| Correction requested | warning | Corrections |
| `APPROVED` | Visé \| Endorsed | success | Visés |
| `REJECTED` | Rejeté \| Rejected | error | Rejeté (key `statusRejected`) |
| `SUPERSEDED` | Remplacé \| Replaced | neutral | Remplacés |

**CampaignStatus**: `DRAFT` Brouillon (warning), `ACTIVE` Active (success), `PAUSED` En pause (info), `CLOSED` Clôturée (neutral), `ARCHIVED` Archivée (neutral) (`campagnes/page.tsx`, `STATUS_BADGE`). Registration campaigns always show `Quota` (neutral) instead.

**CampaignPurpose**: `COLLECTION` Collecte, `REGISTRATION` Inscription (info tag). **CampaignPeriodicity**: `QUARTERLY` Trimestrielle, `SEMESTER` Semestrielle, `ANNUAL` Annuelle. **SubmissionModule**: `ONEFOP`, `DSMO`. **CampaignQuotaScope**: `TERRITORIAL`, `ADMINISTRATION`.

**SubmissionStatus** (CampaignSubmission): `PENDING`, `SUBMITTED`, `IN_PROGRESS`, `VALIDATED`, `LATE`, `EXEMPT`, `NOT_STARTED`. Not shown as badges in the console; `CampaignNonRespondentsTable` labels follow-up attempts (`nonRespFollowUpStatus`), not these values.

**Reminder types**: `CAMPAIGN_ANNOUNCEMENT` Annonce de campagne, `DEADLINE_APPROACHING` Échéance approchante, `FINAL_REMINDER` Dernier rappel, `DEADLINE_EXTENDED` Prorogation (`lib/campaigns.ts`, hard-coded French).

**AnomalyStatus**: `OPEN` Ouvertes (tone = severity), `RESOLVED` Résolues (success), `WAIVED` Dispensées (success). Note `lib/anomaly-registry.ts` labels the same values `Ouverte`, `Résolue`, `Dérogée`.
**AnomalySeverity**: `CRITICAL`, `WARNING` (front-end type also has `INFO`). Displayed by `isBlocking`: `Bloquante` (error) / `Avertissement` (warning).
**AnomalyResolutionType**: `DECLARANT_CORRECTION` (`Correction validée du déclarant`), `FIELD_INSPECTION` (`Contrôle physique / Enquête de terrain concluante`), `LEGAL_DEROGATION` (`Dispense légale / Dérogation administrative (WAIVED)`), `REVIEWER_EXPLANATION` (workspace « Expliquer » only), `RULE_RECHECK` (system only, refused from clients).

**Group link state**: `Actif`, `Complet`, `Expiré`, `Révoqué` (`adminGroupLinks.state.*`).

**Notification kind**: `NUDGE` Relance, `ASSIGNMENT` Affectation, `APPROVAL` Validation, `REJECTION` Rejet (hard-coded French).

**Audit actions**: 50 codes with FR/EN labels and tones in `lib/audit-log.ts` (`AUDIT_ACTIONS`, `AUDIT_ACTION_LABELS_EN`); resource types `OnefopSubmission` Dossier ONEFOP, `OnefopAnomaly` Anomalie, `User` Utilisateur, `Company` Établissement, `Declaration` Déclaration DSMO, `Notification`, `Report` Rapport, `BatchJob` Lot de rapports.

## 7. Lifecycles and state machines

Each transition lists: trigger → route/action → role (front-end gate) → audit action recorded (from `AUDIT_ACTIONS` names; whether the server writes each one was not re-verified).

### 7.1 Registration (COMPANY user)

```
 self sign-up / assisted ──► PENDING_APPROVAL ──approve──► ACTIVE ──suspend──► (isActive=false) ──activate──► ACTIVE
                                 │      ▲                     │
                     complements │      │ respondent resubmits │ archive / restore (archivedAt)
                                 ▼      │                     ▼
                         COMPLEMENTS_REQUESTED            (archived)
                                 │
                 reject ◄────────┴────────── reject
                    ▼
                 REJECTED (terminal in the console)
```

| Transition | Where | Role | Audit |
|---|---|---|---|
| create (self) | `/register` (outside console) | respondent | — |
| create (assisted) | inscriptions/nouvelle → `POST /auth/admin/register-company` | `DIRECTORY_ROLES` | `COMPANY_REGISTRATION_ASSISTED` |
| approve | inscriptions dialog → `PATCH /auth/approve-user/{id}` | `APPROVAL_ROLES` | `COMPANY_REGISTRATION_APPROVED` (+ `COMPANY_ESTABLISHMENT_ID_ISSUED`) |
| reject | same → `PATCH /auth/reject-user/{id}` | `APPROVAL_ROLES` | `COMPANY_REGISTRATION_REJECTED` |
| request complements | same → `PATCH /auth/request-complements/{id}` | `APPROVAL_ROLES` | `COMPANY_REGISTRATION_COMPLEMENTS_REQUESTED` |
| resubmit | respondent, `resubmitRegistration` (`/home`) | respondent | `COMPANY_REGISTRATION_RESUBMITTED` |
| auto-approve | server | — | `COMPANY_REGISTRATION_AUTO_APPROVED` (at sign-up, for entity types in `AUTO_APPROVE_ENTITY_TYPES`, unless the caller sets `skipAutoApproval`; backend `auth.service.ts`) |
| claim / release | inscriptions queue → `PATCH /auth/users/{id}/assign` | `APPROVAL_ROLES` | `REGISTRATION_ASSIGNED` |
| archive / restore | inscriptions organisations | `USER_ARCHIVE_ROLES` | `REGISTRATION_ARCHIVED` / `REGISTRATION_RESTORED` |
| suspend / activate | inscriptions organisations; etablissement-detail (SA) | `USER_LIFECYCLE_ROLES`; `SETTINGS_ROLES` | `USER_SUSPENDED` / `USER_ACTIVATED` |
| delete account | etablissement-detail; annuaire users | `SETTINGS_ROLES`; SA | **none**: `deleteUser` writes no audit row (part 4 §13) |

"Overdue" is derived (waiting longer than `SystemSettings.registrationOverdueDays`, default 7) and is a filter, not a status. `DRAFT`, `UNDER_REVIEW`, `DOCUMENTS_INCOMPLETE` exist in the enum (comment: "Admin rebuild B1 — registration review states (additive)") but nothing writes them: at commit `f9589993` the backend only reads them (`dsmo.service.ts`, `pilotage-coverage.ts`, `actor-summary.service.ts`).

### 7.2 Dossier (OnefopSubmission)

```
 DRAFT ──respondent submits──► PENDING_REVIEW ──endorse──► APPROVED ──reopen──► CORRECTION_REQUESTED
                                │   │                                              │
                     request    │   └──reject──► REJECTED (final)                   │ respondent files a new
                     correction ▼                                                  │ submission for the period
                        CORRECTION_REQUESTED ──reject──► REJECTED                  ▼
                                │                                         old file: SUPERSEDED
                                └── respondent resubmits ──► new PENDING_REVIEW file; old file → SUPERSEDED
```

| Transition | Where | Role (front end) | Audit |
|---|---|---|---|
| claim / release / reassign | queue row, bulk claim, workspace bar → `PATCH …/{id}/assign` | `SURVEY_ROLES`, own or free | `DOSSIER_ASSIGNED` |
| endorse (single) | workspace → `PATCH …/{id}/approve`; requires 0 blocking; justification if open warnings | `SURVEY_ROLES` + active claim | `AUDIT_APPROVE` |
| endorse (bulk) | queue → `POST …/bulk-visa`; held, pending, 0 blocking; justification if any warned file | not read-only, held | `AUDIT_BULK_VISA_GRANTED` + `AUDIT_APPROVE` per file |
| reject | workspace or bulk; reason ≥ 10 + certify; from `PENDING_REVIEW` or `CORRECTION_REQUESTED` | same | `AUDIT_REJECT` / `AUDIT_BULK_REJECT` |
| request correction | workspace (section, problem, action, deadline, certify) or bulk (reason ≥ 10); from `PENDING_REVIEW` only | same | `AUDIT_CORRECTION` / `AUDIT_BULK_REQUEST_CORRECTION` |
| reopen for correction | completed view or workspace; reason ≥ 10 + certify; from `APPROVED` | SA, AO, AS | `AUDIT_REOPEN` |
| superseded | server, on resubmission | — | `AUDIT_SUPERSEDED` |
| archive / restore | queue/completed menu | `DOSSIER_ARCHIVE_ROLES` | `DOSSIER_ARCHIVED` / `DOSSIER_RESTORED` |
| save review progress | workspace (`POST …/review-progress`) | claim holder | `DOSSIER_REVIEW_PROGRESS_SAVED` |
| re-run checks | workspace `Recalculer les contrôles` → `POST …/coherence/recheck` (pending files) | `SURVEY_ROLES` | `COHERENCE_RECHECKED` |
| export list | queue/completed `Exporter (Excel)` | not read-only | `AUDIT_LIST_EXPORT` |

Claims expire after inactivity (`claimExpired`, `Réclamation expirée`); the default is 12 hours of inactivity (`ONEFOP_REVIEW_CLAIM_INACTIVITY_HOURS`, backend `review-claim-policy.ts`), recorded as `DOSSIER_CLAIM_EXPIRED`. Decisions carry `expectedRevision`; a 409 shows `staleFileModified` and reloads.

### 7.3 Campaign (DataCampaign)

```
 DRAFT ──activate──► ACTIVE ──pause──► PAUSED ──activate──► ACTIVE
   │                   │  └─extend deadline (stays ACTIVE), remind (stays ACTIVE)
 delete                └──close──► CLOSED ──archive──► ARCHIVED
   ▼                   ACTIVE/PAUSED ──archive──► ARCHIVED
 (gone)
```

All transitions: campagnes page, `canMutate` = `NATIONAL_ROLES`; endpoints `POST /campaigns/{id}/activate|pause|close|archive|extend|remind`, `DELETE /campaigns/{id}`. Confirmation dialogs exist for close, archive, delete, extend, remind; none for activate and pause. Registration campaigns (`purpose = REGISTRATION`) show no Activate or Archive button in history rows (`!isRegistrationCampaign`), so their lifecycle from the console is create → (delete while DRAFT). Their status is displayed as `Quota`. Campaign transitions write no audit row: `src/campaign/` has no audit write at commit `f9589993` (part 4 §13). Only quota deletion is labelled (`CAMPAIGN_QUOTA_DELETE`).

### 7.4 Campaign quota (target)

Not status-driven. Edited in `TargetGrid`; one `PUT /admin/pilotage/campaigns/{id}/quotas` replaces the campaign's set after a confirm dialog. Per region one of three modes: all-types region row, per-entity-type rows, or department rows; mixing is refused (CLAUDE.md §21, 2026-10-25). Removing a row is logged `CAMPAIGN_QUOTA_DELETE`.

### 7.5 Anomaly

```
            detected (submit / re-check) ──► OPEN
                                              │
     ┌──────────────── resolve ───────────────┼──────────────────── derogation ──────────┐
     ▼                                        ▼                                         ▼
 RESOLVED (DECLARANT_CORRECTION,      RESOLVED (REVIEWER_EXPLANATION,            WAIVED (LEGAL_DEROGATION)
          FIELD_INSPECTION)                    warnings only, workspace)
                                      RESOLVED (RULE_RECHECK, system)
```

| Transition | Where | Role | Audit |
|---|---|---|---|
| detect | server at submission, or `Recalculer les contrôles` / national `recheck-pending` | — / `SURVEY_ROLES` | `COHERENCE_RECHECKED` |
| resolve (correction, inspection) | centre-qualite dialog → `PATCH …/anomalies/{id}/resolve` | `SURVEY_ROLES` | `ANOMALY_RESOLVED` |
| waive (legal derogation) | same dialog | SA, AO | `ANOMALY_WAIVED` |
| explain (warning) | workspace `Expliquer` | claim holder, `SURVEY_ROLES` | `ANOMALY_RESOLVED` (type `REVIEWER_EXPLANATION`) |
| close by re-check | server | — | as part of `COHERENCE_RECHECKED` |

A resolved anomaly is never re-opened from the console; a re-check may add a new row for the same rule (CLAUDE.md §21, 2026-11-01).

### 7.6 Staff invitation, group link, staff account

```
 Invitation (one person): created ──accepted──► staff User, ACTIVE at once (no approval step)
 Group link: Actif ──uses reach maxUses──► Complet
             Actif ──expiresAt passes──► Expiré
             Actif ──revoke──► Révoqué
 Staff sign-up via link: PENDING_APPROVAL ──approve──► ACTIVE   |   ──reject──► REJECTED
 Staff account: ACTIVE ⇄ suspended (isActive) ; territory reassigned ; deleted
```

| Transition | Where | Role | Audit |
|---|---|---|---|
| create invitation | utilisateurs `Inviter un agent` → `POST /auth/admin/staff-invitations` | SA, AO | `STAFF_INVITATION_CREATED` |
| accept invitation | `/inscription-agent` (outside console) | invitee | `STAFF_INVITATION_ACCEPTED` |
| create group link | utilisateurs → `POST /auth/admin/staff-invitation-links` | SA, AO | `STAFF_INVITATION_LINK_CREATED` |
| sign up via link | outside console | invitee | `STAFF_INVITATION_LINK_USED` |
| revoke link | utilisateurs (`Révoquer le lien`, confirm) → `PATCH …/{id}/revoke` | SA, AO | `STAFF_INVITATION_LINK_REVOKED` (no label in `AUDIT_ACTIONS`) |
| approve / reject staff request | `PendingStaffRequests` → `PATCH /auth/approve-user|reject-user/{id}` | SA, AO (console); delegates per CLAUDE.md §21 2026-10-26 but no console route reaches them | `STAFF_REGISTRATION_REJECTED` on reject |
| create officer directly | `Ajouter Agent` → `POST /auth/admin/create-minefop-user` | SA, AO | **none**: `adminCreateMinefopUser` writes no audit row (part 4 §13) |
| reassign territory | `ReassignDialog` → `PATCH /auth/users/{id}/territory` | SA, AO | `USER_TERRITORY_CHANGED` |

### 7.7 Notification

`unread (readAt null) ──open or mark read──► read`; `mark all read` sets all. Created by the server (e.g. a nudge from `/admin/equipe`). No delete.

### 7.8 Coverage of §6 statuses in §7

UserStatus (7.1, incl. the three unused values), OnefopStatus (7.2), CampaignStatus (7.3), CampaignPurpose (7.3), AnomalyStatus and resolution types (7.5), group link states (7.6), notification read state (7.7). `SubmissionStatus` (CampaignSubmission) has no console transition: it is set by the server on submission and review (CLAUDE.md §21, 2026-10-17 entries) and only read in coverage figures.

## 8. User flows

✓ = implemented in the console; ✗ = not available in the console; ◐ = partly.

### 8.1 Registering and approving or rejecting an establishment (RA, DA, AR, AO, SA)

1. ✓ (optional, assisted) `/admin/inscriptions` → `Nouvelle inscription` → fill the four sections → submit → note the temporary password, tick the acknowledgement → `viewQueueLink`.
2. ✓ `/admin/pilotage` → `Inscriptions en attente` or `En retard`, or rail → `/admin/inscriptions` (queue, default status "En file").
3. ✓ Filter (status, region, type, duplicates…) → `Réclamer` on a row (optional).
4. ✓ `Ouvrir` → review dialog: check duplicate hints and resubmission diff, mark each item `✓ Conforme` / `✗ Non conforme`, tick central-structure confirmation when asked.
5. ✓ Choose `Approuver le compte` (enabled only when every item is ✓), or `Rejeter le compte` / `Demander des compléments` with a written message → submit.
6. ✓ The server e-mails the respondent the decision (project notes record e-mail delivery as unreliable, so it may not arrive).
7. ✓ Approved organisations appear under `Organisations enregistrées` and in `/admin/etablissements`; open the detail page for facts, declarations, account.
- `CENTRAL_AGENT`: ✓ reads `/admin/etablissements` and details only; ✗ cannot open the queue.

### 8.2 Creating and running a campaign, setting targets, following returns (SA, AO, AS; RA read-only)

1. ✓ `/admin/campagnes` → `Lancer une campagne` → purpose, module, periodicity, dates, reference year/quarter → create (status DRAFT).
2. ✓ For a registration campaign: success notice → `registrationSetQuotas` → `/admin/cibles?vue=quotas&campagne=…`.
3. ✓ `/admin/cibles` → `Quotas de campagne` → choose campaign → enter quotas per region / department / type (and central) → `Enregistrer` → confirm.
4. ✓ Back to `/admin/campagnes` → `Activer` (collection campaigns; no confirmation).
5. ✓ During the campaign: `Envoyer un rappel`, `Prolonger`, `Mettre en pause`; pilotage → submissions tab → coverage and trend; `/admin/cibles?vue=retours` for returns by territory; `/admin/dossiers?vue=followup` for non-respondents.
6. ✓ End: `Clôturer la campagne` (confirm) → later `Archiver`.
- RA: ✓ sees everything above, all buttons disabled; ✓ reads returns. DA: ✓ cibles (quotas only with a campaign id in the URL; returns from active campaigns). AR: ✓ coverage view only.

### 8.3 Reviewing a dossier end to end (SA, AO, AS, RA, DA; CA read-only)

1. ✓ `/admin/dossiers` (`File d'instruction`) → quick view `mine`/`unassigned`/`pending`/`corrections`, filters.
2. ✓ `Réclamer` on a free file → claim and open the workspace.
3. ✓ In the workspace: read `À vérifier` findings, jump to the flagged answer, `Expliquer` a warning (note 10–2000), `Recalculer les contrôles` if rules changed; read sections and history.
4. ✓ Decide: `Viser` (blocked while blocking findings remain; justification if warnings) / `Demander une correction` (section, problem, action, deadline, certify) / `Rejeter` (reason ≥ 10, certify).
5. ✓ The page moves to the next file in the same queue, or back to the queue with `endOfQueue`.
6. ◐ Correction loop: the respondent corrects and resubmits in `/home` (outside console); the new file appears as `PENDING_REVIEW`; the old one becomes `SUPERSEDED` and leaves the lists. CLAUDE.md memory notes this path has never been tested on a backend that includes it.
7. ✓ After endorsement, SA/AO/AS can `Rouvrir pour correction` from `Dossiers terminés` or the workspace.
8. ✓ Bulk alternative: select rows → `Viser la sélection` / `Demander une correction` / `Rejeter la sélection`.
- CA: ✓ opens queue (pending, corrections) and workspace read-only; ✗ claims or decisions.

### 8.4 Handling a data-quality anomaly from detection to resolution

1. ✓ Detection is automatic at submission (server) or via `Recalculer les contrôles` (workspace).
2. ✓ Pilotage `Alertes qualité bloquantes` → `/admin/centre-qualite?vue=registre&status=OPEN&severity=BLOCKING`; rail badge on `Télédéclarations`.
3. ✓ In the register, filter by family/severity/status; open the dossier link for context.
4. ✓ `Résoudre` → choose mode (correction validated / field inspection / legal derogation for SA, AO), write the justification, optional evidence link → confirm. If the file changed, refresh the revision and retry.
5. ✓ For a warning, the reviewer can instead `Expliquer` it in the workspace.
6. ◐ Only the first 50 anomalies are listed (no pager).
- CA: ✓ indicators and rules; ✗ register (forbidden state).

### 8.5 Inviting and managing staff (SA, AO)

1. ✓ `/admin/utilisateurs` → `Inviter un agent` (one person: level, service, post) → share by link/WhatsApp; or `Liens d'invitation de groupe` → create a link for a service/territory.
2. ✓ Invitees sign up outside the console; their requests appear in `Demandes en attente` → approve or reject (with reason).
3. ✓ Or `Ajouter Agent` → create directly with a temporary password.
4. ✓ Manage: reassign territory, view profile; suspend/activate/change role/delete in `/admin/annuaire?tab=users` (SA only).
5. ✓ `Révoquer` a group link (confirm).
6. ◐ Territorial delegates may approve their own staff server-side (CLAUDE.md §21, 2026-10-26) but no console route lets RA/DA reach the pending list (`USER_ADMIN_ROLES` gate) — recorded there as STILL OPEN.
- RA (and SA, AO): ✓ `/admin/equipe` → `Relancer` a territorial admin.

### 8.6 Producing an export in "diffusion" (SA, AO, AS)

1. ✓ `/admin/diffusion` → choose format (`.sav` / `.csv` / `.xlsx`), codebook option, scope, campaign, region, questionnaire, status (default `Validé uniquement`), advanced filters.
2. ✓ `Lancer l'Export` → file downloads (`onefop_export_{campaign}_{timestamp}.{ext}`; CSV also downloads its `.sps`).
3. ✓ For training centres: `Télécharger la liste nominative` / `Télécharger les coordonnées` (SA, AO only server-side; AS sees the buttons and is refused).
4. ✓ `Documentation du jeu de données` → codebook `.sps`.
5. ✓ `Historique des exports récents` shows the export.

### 8.7 Reading notifications and the audit journal

1. ✓ Any role: bell badge → popover (5 latest) → click a subject (marks read, follows link) → `Voir tout` → `/admin/notifications` → `Tout marquer comme lu`.
2. ✓ SA, AU: `/admin/journal-audit` → filter period, actor, action, resource, id → page through. Deep links from equipe (`?actor=`), dossiers and establishment detail (`?resourceId=`).
3. ✗ AU: lands on a blank main area after login (part 1 §3.5) and must use the rail's single hub.
4. ✓ SA: last 6 entries on `/admin/parametres`.

### 8.8 Role coverage check

Every role in §4.1 appears in at least one flow: SA (all), AO (8.1–8.7), AR (8.1, 8.2), AS (8.2–8.4, 8.6), RA (8.1–8.5), DA (8.1–8.4), AU (8.7), CA (8.1, 8.3, 8.4). `COMPANY` is outside the console and appears only as the counterpart in 8.1 and 8.3.
