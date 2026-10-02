# R.1 Completion Spec (frozen)

Status: approved, human-reviewed. Frozen 2026-10-02. Scope: commits 1-5 on
`feat/registration-approval`, rebased onto `origin/master` (`fbc8a5f1`).

This document is the authoritative record of the approved spec. It is saved
here so that a lost session cannot lose the spec again.

## Background

Branch `feat/registration-approval` carried 6 commits on merge-base
`01d034e4`:

- `aa190cce` auth core
- `ee041382` decision emails
- `cb926508` React
- `a340445c` Flutter
- `02772b8d` backfill script
- `137e4b8d` unique `establishmentId` migration `20261002160000`

Master (`fbc8a5f1`) now has `ActiveCompanyGuard`,
`@AllowInactiveCompany({ statuses? })`, a `JwtStrategy` change, a
completeness spec and the minefop-services lockdown. Master is deployed
and live.

## Decision on the conflict (already made, human-reviewed)

**Master's guard wins.**

- Take master's `active-company.guard.ts`, its `.spec`,
  `allow-inactive-company.decorator.ts`, `jwt.strategy.ts` and
  `jwt.strategy.spec.ts`.
- Delete `session-gate.ts` and `canEstablishSession`. Master's
  `JwtStrategy` behaviour: staff keep a strict 401; COMPANY authenticates
  at any status; the guard denies `isActive=false` always, then
  allow-lists `ACTIVE` unless `@AllowInactiveCompany` lists the status.
- Keep ONLY the `validateUser` (login path) changes from the branch's
  auth work.
- `auth.module.ts`: trivial.

### Accepted consequence: a REJECTED company may hold a session

Master's `JwtStrategy` admits any COMPANY account at the 401 layer and
leaves the denial to `ActiveCompanyGuard` (403). The branch's discarded
`canEstablishSession` refused `REJECTED` / `isActive=false` at the 401
layer instead. This widening is accepted as designed:

- `validateUser` (login) refuses a REJECTED account outright, so any
  token held by a REJECTED company necessarily predates the rejection.
- `rejectUser` keeps `isActive=false`, and the guard denies
  `isActive=false` unconditionally - so such a token gets
  `403 { code: COMPANY_NOT_ACTIVE }` on every route, `/auth/me`
  included.
- Commits 4 and 5 therefore sign the client out when a 403
  `COMPANY_NOT_ACTIVE` comes from `/auth/me`.

## Commit 1 - backend: rebase + guard adoption + rejected login message

- Rebase onto `origin/master`, resolving as above.
- Add `ActiveCompanyGuard` to the staff routes (`approve-user`,
  `reject-user`, `request-complements`, `company-registrations`) - the
  completeness spec requires it; it is a no-op for staff.
- `resubmit-registration`: guard +
  `@AllowInactiveCompany({ statuses: [COMPLEMENTS_REQUESTED] })`.
- `GET dsmo/company`: guard +
  `@AllowInactiveCompany({ statuses: [PENDING_APPROVAL, COMPLEMENTS_REQUESTED] })`
  (prefill). `POST dsmo/company` stays fully guarded.
- `change-password`, `preferences`, `two-factor`, `DELETE /auth/me`,
  `resend-verification`:
  `@AllowInactiveCompany({ statuses: [PENDING_APPROVAL, COMPLEMENTS_REQUESTED] })`.
  `GET /auth/me`: leave as master has it.
- `validateUser`, strictly after the password check: REJECTED -> fixed
  message "Votre demande d'inscription a ete rejetee. Pour plus
  d'informations, contactez votre delegation regionale du MINEFOP ou
  l'ONEFOP." (NO reason). Suspended (`isActive=false`, not REJECTED) ->
  existing message unchanged. Wrong password -> generic, unchanged.
- The contact sentence lives in a shared constant under `src/common/`,
  imported by `auth.service` and `notification.service`.
- `sendRegistrationRejectedEmail`: keeps the reviewer's reason, ends with
  the contact sentence.
- `rejectUser` keeps `isActive=false`. `getMe`'s gate untouched.
- Tests: wrong password -> generic; REJECTED -> fixed message, reason
  absent; suspended -> old message; completeness spec green.

## Commit 2 - backend: complements correction

- `resubmit-registration` takes an optional `ResubmitRegistrationDto`
  (fields from `RegisterCompanyProfileDto` + territory ids), all
  optional, whitelist + `forbidNonWhitelisted`. Allowed only from
  `COMPLEMENTS_REQUESTED`. `establishmentId` unreachable (explicit
  allowlist, not a spread).
- `entityType` writable, field-only: normal territory chain, the file
  stays in its territorial queue.
- Transaction order: `user.updateMany` where `status = COMPLEMENTS_REQUESTED`
  -> `PENDING_APPROVAL`; count 0 -> 409 before any Company write. Then
  `company.update` (changed fields only), audit row
  `COMPANY_REGISTRATION_RESUBMITTED` with
  `{ companyId, changes: { field: { before, after } } }`, re-read for the
  response.
- Territory: `resolveAndValidateTerritory(tx, ..., { requireSubdivision: true })`;
  persist resolved names/ids only. `taxNumber` unique excluding self
  (pre-check 409 + P2002 backstop).
- `approvalComment` kept. The queue item gets
  `lastResubmission { at, changes }` only if newer than the latest
  complements-request audit row, else `null`.
- No body -> status flip only, still allowed.
- Tests: validation failures, wrong status -> 4xx, 409 race
  (`updateMany` count 0 -> `company.update` never called), audit diff,
  unknown key -> 400, no-body, region move at mechanism level,
  ADMINISTRATION on/off and the resulting queue.

## Commit 3 - backend: ADMINISTRATION approval confirmation

- Approving an ADMINISTRATION company requires an explicit server-side
  confirmation flag (from the existing "structure centrale" checkbox);
  missing -> 400. Tests both ways.

## Commit 4 - React

- Status page: correction form only in `COMPLEMENTS_REQUESTED`,
  prefilled from `getMyCompany()`; body = explicit changed-fields list,
  never a spread (`CompanyProfile` has an index signature);
  `CameroonGeographySelector` for territory; "resubmit unchanged" still
  possible.
- Home layout: disable the active-quarter query for awaiting-approval
  users (it is guarded -> would loop). No new exemption.
- `403 { code: COMPANY_NOT_ACTIVE }` -> status page; no-op if already
  there; if it comes from `/auth/me` -> sign out.
- Delete the REJECTED branch of the status page and its strings.
- Admin review dialog: changed-fields block (before -> after) from
  `lastResubmission`; send the ADMINISTRATION confirmation flag on
  approve.

## Commit 5 - Flutter

- Same correction form (`getRegions`/`getDepartments`/`getSubdivisions`);
  `resubmitRegistration({data})`.
- Detect `403 COMPANY_NOT_ACTIVE` before `_handleError`'s generic 403
  string; status screen, no-op if already there; from `/auth/me` -> sign
  out. 401 behaviour unchanged.
- Delete the REJECTED branch; remove its `.arb` strings;
  `flutter gen-l10n`. Do not commit line-ending-only churn.

## rejectionReason (registration)

With the fixed login message, nothing shows it to the company any more.
Remove it from the Flutter `User` model and the React user-types, and
stop returning it from `/auth/me` and login. Keep the DB column and the
staff-side use. Do not touch the DSMO declaration `rejectionReason`.

## Rules

- Own folder only. No DB. No `.env`. Never edit applied migrations.
- No push. No amends of merged commits. No trailers.
- Per commit: `git branch --show-current`, backend `tsc` + full `jest`,
  `react-web` `tsc`, `flutter analyze`, `git show --stat`.
- Stop after commit 5.
