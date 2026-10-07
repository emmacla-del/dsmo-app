# Hardcoded admin values — fix plan

Date: 2026-10-07
Status: plan only, nothing changed.

## Background

The values below were introduced as fixed text, mostly by the 1 October
"pixel-perfect alignment with Figma" commits (`339c4a63`, `ff2f5cfc`,
`d12d5b38`, `6e23d2a5`, `d066da90`), plus one client-side imitation of a server
message (PR #31, `14fbe023`). The 3 October data-integrity remediation
(`853b8ac3`) removed the fabricated *constants* it targeted
(`FIGMA_DIAGNOSTIC_MOCK`, …), but its guard
(`react-web/scripts/check-admin-data-integrity.mjs`) only matches named
patterns, so plain JSX text and message values pass it.

A sweep of `src/app/admin`, `src/components/admin` and the admin message
namespaces for fixed years and counts found no instance beyond those listed
here. « ex. 2026 » (`adminCampagnesPage.referenceYearPlaceholder`) is a
legitimate example placeholder and stays.

---

## Phase A — Dossier detail: the three axis badges (frontend only)

File: `react-web/src/app/admin/dossiers/[id]/page.tsx` (the strip under the
header, today « ⏱ EN INSTANCE », « 🚩 2 Avertissements », « En attente
d'arbitrage » on every dossier).

Source: data the page already loads.
- `GET /admin/questionnaires/:id` → `dossier.status`
- `GET /admin/questionnaires/:id/diagnostic` (`EligibilityEngineService`) →
  `axis1Status`, `axis2BlockingCount`, `axis2WarningCount`,
  `axis3Eligibility: "READY" | "EXCLUDED"`, `exclusionReason`.

| Axis | Shown |
|---|---|
| 1 · Administrative endorsement | the stored status through the existing `STATUS_BADGES` labels (Pending / Endorsed / Correction requested / Rejected); null → « Statut non renseigné » |
| 2 · Data quality | blocking > 0 → « {n} anomalie(s) bloquante(s) » (error tone); else warnings > 0 → « {n} avertissement(s) » (warning tone); else « Aucune anomalie » (success tone); diagnostic unavailable or failed → `metricUnavailable(locale)`, never a number |
| 3 · Statistical eligibility | READY → « Éligible »; EXCLUDED → the reason, labelled: `EXCL_BLOCKING_ANOMALY_OPEN` « Anomalie bloquante ouverte », `EXCL_DRAFT_ONLY` « Brouillon », `EXCL_CORRECTION_PENDING` « Correction en attente », `EXCL_WAITING_NAT_VISA` « En attente de visa », `EXCL_REJECTED` « Rejeté »; unknown reason → « Non éligible »; diagnostic unavailable → `metricUnavailable(locale)` |

- « En attente d'arbitrage » is dropped: no field in either response
  supports it.
- Labels go through `adminDossierPage` keys in both catalogues; a test checks
  every `StatisticalExclusionReason` value has a label (the enum list is
  copied from `src/questionnaires/…` with a comment pointing at it).
- The diagnostic already drives the anomaly lists further down the page, so
  no new request.
- Supersedes the background-task chip suggested earlier
  ("Wire dossier axis badges to real data"); it would be dismissed.

Risk: low. Displayed facts become true; layout unchanged.

## Phase B — Equipe reminder preview (backend + frontend)

File: `react-web/src/app/admin/equipe/page.tsx`; server message in
`src/report/actor-summary.service.ts` (`buildNudge`).

Today the preview hardcodes « de la cible **2026** » and « depuis **N**
jours », and copies the server's `STALE_AFTER_DAYS` (7) by hand.

- **Year** — use `doualaCalendarYear()` (`lib/pilotage-targets.ts`), the
  same Africa/Douala year the server computes (`getUTCFullYear()` after a
  +1 h shift).
- **Days since last decision** — the page cannot compute it:
  `GET /audit/actor-summary` returns `lastActionAt` (any action), while the
  server message counts from the last *decision* (`ALL_DECISION_ACTIONS`).
  - **Option B1 (recommended, lasting):** add `lastDecisionAt` and
    `staleAfterDays` to each actor in the actor-summary response (additive
    API fields, no schema change, computed with the same query `buildNudge`
    uses). The preview then shows the exact message, and the « 7 jours »
    copy reads the server's constant.
  - **Option B2 (frontend only):** keep the server out of it and word the
    preview generically: « Aucune décision enregistrée sur votre compte
    depuis [nombre de jours calculé à l'envoi]. »
- Tests: backend unit test for the two new fields (B1); the preview uses
  them.

Risk: B1 touches a backend endpoint (additive only); the frontend tolerates
the fields being absent (older deployment) by falling back to B2's wording.

## Phase C — Exports subtitle

File: `react-web/src/app/admin/diffusion/page.tsx`, message
`adminDiffusionPage.subtitle` (« … - Campagne 2026 »).

- Subtitle becomes « Gérer, filtrer et exporter les données collectées »,
  followed by « — {campagne active} » when `useActiveCampaign()` (already
  used by the header pill) returns one; nothing appended otherwise.

Risk: negligible.

## Phase D — Add-officer form default region

File: `react-web/src/app/admin/utilisateurs/page.tsx` (`EMPTY_FORM.region:
"Littoral"`).

The server requires a region for a regional officer
(`resolveStaffTerritory`: « Les utilisateurs régionaux doivent avoir une
région assignée »), so a careless « Créer l'Agent » creates a Littoral
officer.

- Default region `""` with a « Sélectionner une région » first option;
  « Créer l'Agent » stays disabled until a region is chosen. No server change.

Related finding, not fixed here (RBAC-adjacent, needs your decision): the
form has no role selector — `EMPTY_FORM.role` is always `REGIONAL_ADMIN` —
although it shows a department picker and its eyebrow reads « Création de
compte administratif ou enquêteur ». A divisional officer cannot be created
from this form.

Risk: low; one more required click.

## Phase E — Questionnaires page claims (needs a domain decision first)

File: `react-web/src/app/admin/questionnaires/page.tsx`.

| Claim | Source today | Proposal |
|---|---|---|
| « Format d'export : SPSS / CSV / Excel » | matches what `/admin/diffusion` offers (.sav, .csv, .xlsx) | keep |
| « Format réglementaire DSMO-ONEFOP-v2 » | literal | replace with the loaded schema's `schemaVersion` (« Schéma v{n} »), or remove — decision |
| « Homologué » badge, « En vigueur » badge | literal, no record | keep only if ONEFOP confirms; otherwise remove — decision |
| « Toute modification structurelle requiert un arrêté d'homologation ministériel. » | literal legal statement | ONEFOP to confirm wording, or remove — decision |

No change until the domain owner answers.

## Phase F — Extend the integrity guard

File: `react-web/scripts/check-admin-data-integrity.mjs`.

- New rule: a four-digit year (`19xx`/`20xx`) in JSX text or string
  literals under `src/app/admin`, `src/components/admin`, and in the
  `admin*` namespaces of `messages/fr.json` / `en.json`.
- New rule: placeholder counts in text (« N jours », « N days »).
- An explicit allowlist (file:key + reason) for legitimate cases, starting
  with `adminCampagnesPage.referenceYearPlaceholder`.
- Verified both ways: the extended guard fails on the current code
  (« Campagne 2026 », « cible 2026 ») and passes after Phases B–C.

Risk: false positives — handled by the allowlist, which documents each
exception.

---

## Order and commits

Phase-gated, one commit per phase, review between phases:

1. **A** dossier badges (frontend)
2. **B** equipe preview (backend commit + frontend commit if B1)
3. **C + D** exports subtitle, officer form default (small, one commit)
4. **F** guard (after B and C, so it lands green)
5. **E** questionnaires claims — after the domain answer

Checks per phase: unit tests (react-web `npm test`; backend `jest
--runInBand` for B1), typecheck, lint compared with HEAD, admin integrity
guard, build.

## Decisions needed

1. Phase B: **B1** (exact preview, additive backend fields) or **B2**
   (frontend-only generic wording)?
2. Phase E: answers from the ONEFOP domain owner on the four claims.
3. Phase D: should the add-officer form gain a role selector
   (regional / divisional)? Separate change; RBAC-adjacent.
