# Inscriptions review redesign: survey and plan (2026-10-06)

Read-only survey. No code, schema or test was changed and no test was run. This
document reports what the code does today and lays out the plan for the redesign.
It contains no proposed code. Pasted excerpts are existing code, trimmed with `…`.

**Confirmed decisions this plan follows**

- The verification list has four rows: Nom de l'entité · Téléphone / WhatsApp de l'entité · Email de contact · N° CNPS.
- Verification state is client-side and is sent with the approve call (Option A). No new endpoint and no resumable state.
- A row marked ✗ blocks approval. The reviewer uses Reject or Request complements instead.
- `Company.contactEmail` is a new column, backfilled from `User.email`.
- `Company.cnpsNumber` becomes required for enterprise, cooperative, ctd, ong and vocationalTraining. It stays optional for administration and projectProgram.
- The declarant block is shown as context only: it is not verified and does not gate approval.
- The documents panel is removed. No documents and no uploads.

---

## Step 1: The current review dialog

### 1.1 The dialog (`react-web/src/app/admin/inscriptions/page.tsx:404-536`)

```tsx
<AdminDialog
  open={!!reviewing}
  onClose={closeReview}
  title={`Validation du compte — ${reviewing?.organisation || ""}`}
  eyebrow="Dossier d'auto-inscription"
  footer={<> <button …onClick={closeReview}>Annuler</button>
             <button …onClick={handleDecisionSubmit}>{pendingMutation ? "…" : "Confirmer"}</button> </>}
>
  {reviewing && (
    <div>
      <p>Type : <strong>{entityLabel(reviewing.entityType)}</strong> — {reviewing.region} / {reviewing.department}</p>
      <p>NIU : {hasRealNiu(reviewing.taxNumber) ? reviewing.taxNumber : "—"}{reviewing.cnpsNumber ? ` — CNPS : ${reviewing.cnpsNumber}` : ""}</p>
      <p>Enregistré le : {formatDate(reviewing.submittedAt)}</p>
      {reviewing.duplicateHints.length > 0 && ( <div className="cam-admin-notice cam-admin-notice--warn">…hints…</div> )}
      {reviewing.lastResubmission && ( …"Corrections envoyées" Champ / Avant / Après table… )}
      <div>
        <p><strong>Pièces justificatives</strong></p>
        {documentsQuery.isLoading ? … : documentsQuery.isError ? … : items.length === 0 ? … : (
          <table className="cam-dash-table"> Pièce | État | Action
            {items.map((doc) => <tr key={doc.kind}>
              <th>{doc.label}</th>
              <td>{isVerified && doc.verifiedBy ? `Vérifié par ${doc.verifiedBy} le …` : "En attente de vérification formelle"}</td>
              <td><button onClick={() => verifyMutation.mutate({ userId: reviewing.id, kind: doc.kind,
                    state: isVerified ? "PENDING" : "VERIFIED" })}>{isVerified ? "✓ Vérifié" : "Marquer vérifié"}</button></td>
            </tr>)}
          </table>)}
      </div>
      {reviewing.requiresCentralStructureCheck && ( <label><input type="checkbox" …/> Structure centrale confirmée</label> )}
      <div role="radiogroup" aria-label="Décision">
        Approuver le compte | Rejeter le compte | Demander des compléments
      </div>
      {decision !== "APPROVE" && ( <textarea …> "Motif de rejet" / "Message de compléments" )}
    </div>
  )}
</AdminDialog>
```

### 1.2 State, payloads and actions

| State (`page.tsx:128-131`) | Purpose |
|---|---|
| `reviewing: CompanyRegistrationItem \| null` | The queue row being reviewed. Its `id` is the **User** id. |
| `decision: "APPROVE" \| "REJECT" \| "REQUEST_COMPLEMENTS"` | Radio group, default `APPROVE`. |
| `comment: string` | Rejection reason or complements message. |
| `centralChecked: boolean` | "Structure centrale confirmée", shown only for ADMINISTRATION. |
| `closeReview()` | Resets all four (`:160-165`). |

| Action | Client call (`react-web/src/lib/user-directory.ts`) | HTTP | Body | Client-side gate |
|---|---|---|---|---|
| Approve | `approveUser(id, { centralStructureConfirmed })` (`:78`) | `PATCH /auth/approve-user/:id` | `{ centralStructureConfirmed: boolean }` (strictly `=== true`) | ADMINISTRATION requires `centralChecked` (`page.tsx:213`) |
| Reject | `rejectUser(id, reason)` (`:85`) | `PATCH /auth/reject-user/:id` | `{ reason }` | Non-empty comment (`:219`) |
| Request complements | `requestComplements(id, message)` (`:92`) | `PATCH /auth/request-complements/:id` | `{ message }` | Non-empty comment (`:225`) |
| Mark a document verified | `verifyUserDocument(userId, kind, state)` (`:120`) | `PATCH /auth/users/:id/documents/:kind/verify` | `{ state }` | none; fires on click, independent of the decision |

There is a single "Confirmer" button for all three decisions. On success every
decision invalidates `["auth","company-registrations"]` and closes the dialog
(`done()`, `:167-171`).

### 1.3 The documents section today

- **The four rows are not stored data.** `documentsQuery` (`page.tsx:195-199`) calls `GET /auth/users/:id/documents`. The server *always* returns four rows, built from a hard-coded list (`auth.service.ts:1268-1273`):

  | kind | label |
  |---|---|
  | `RCCM` | Extrait RCCM / Acte constitutif |
  | `NIU` | Attestation d'immatriculation fiscale (NIU) |
  | `CNI` | Pièce d'identité du représentant / déclarant |
  | `ATTESTATION` | Attestation de localisation ou plan |

- **The state shown is mostly a default.** Each row's state comes from a `RegistrationDocument` row if one exists. Otherwise it is `PENDING`, with `uploadedAt` set to the user's `createdAt`.
- **There is no upload path anywhere.** `fileRef` is never written, so "verifying" a document records a click, not a reviewed file.
- **"Marquer vérifié" creates the row the first time.** `verifyUserDocument` creates a `RegistrationDocument` row if none exists.
- **Document state does not gate approval** and is not sent with any decision.

### 1.4 Data source

The dialog is fed by **one endpoint** and gets no per-id lookup.

**Queue endpoint.** `reviewing` is a row from `GET /auth/company-registrations`, called
through `listCompanyRegistrations` with `PAGE_SIZE = 8` (`page.tsx:144-158`).

- **Server:** `AuthService.listCompanyRegistrations` (`auth.service.ts:1474-1591`) loads `Company` rows with all scalar columns, and joins `user` with these fields selected: `id, email, status, createdAt, approvalComment, rejectionReason, registrationNumber, registrationMethod, createdBy, createdByUser`.
- **Projection:** `withDuplicateHints` (`:1793-1876`) projects each row to this response (`CompanyRegistrationItem`, `user-directory.ts:127-155`):

  ```
  id (User.id), companyId, organisation (Company.name), email (User.email), entityType,
  region, department, status (User.status), taxNumber, cnpsNumber, submittedAt (Company.createdAt),
  registrationNumber (User.registrationNumber), approvalComment, rejectionReason,
  duplicateHints[], requiresCentralStructureCheck, registrationMethod, createdBy, createdByName,
  lastResubmission { at, changes }
  ```

**Documents endpoint.** The only other fetch is `GET /auth/users/:id/documents`, used
only by the documents panel.

---

## Step 2: Where each verified value lives

### 2.1 Entity name: `Company.name`

**Schema:** `name String` (NOT NULL), `prisma/schema.prisma` model `Company`.

**Write path.** The wizard's per-type name field (`companyName`, `cooperativeName`,
`ctdName`, `ngoName`, `administrationName`, `projectProgramName` or `centerName`) is
mapped to `companyName` by `resolveCompanyName` (`register-constants.ts:430`). From
there:

| Layer | Code |
|---|---|
| Controller | `auth.controller.ts:116` → `name: body.companyName` |
| Service | `auth.service.ts:719` → `company.create({ data: { …, name: companyData.name, … } })` |

**Read path.** `withDuplicateHints` returns it as `organisation: row.name`
(`auth.service.ts:1857`). **It is the same field the dialog reads**, in its title and
in the queue row.

**Correction.** Correctable through resubmission (`CORRECTABLE_COMPANY_FIELDS` includes
`name`).

### 2.2 Entity phone: `Company.phone`

**Schema:** `phone String?`.

**Write path.** Every type's step 3 includes `PHONE` (`register-constants.ts:149-155`):
key `phone`, label "Téléphone", required, `kind: "tel"`. It is sent as
`phone: visibleData.phone` (`register/page.tsx:588`), then:

| Layer | Code |
|---|---|
| Controller | `:134` → `phone: body.phone` |
| Service | `:743` → `phone: companyData.phone` |

Server-side the field is optional (`@IsOptional() @IsString()`). Only the client
requires it.

**Read path.** **The dialog does not receive it.** `Company.phone` is loaded by the
query, but `withDuplicateHints` does not project it.

**Correction.** **Not correctable** through resubmission: `phone` is absent from
`CORRECTABLE_COMPANY_FIELDS` and from `ResubmitRegistrationDto`.

**Not to be confused with** `Company.respondentPhone`, the declarant's "Téléphone 1".

### 2.3 Contact email: `User.email`

**Schema:** `User.email String @unique`.

**Write path:**

| Layer | Code |
|---|---|
| Wizard | `email: respondent.email.trim()` (`register/page.tsx:557`), labelled "Email professionnel" in the *respondent* step |
| Admin form | "Adresse e-mail" |
| Service | `createCompanyRegistration` → `user.create({ data: { email, … } })` (`auth.service.ts:698-701`) |

**It is the login identifier.** `validateUser(login, …)` looks up
`user.findUnique({ where: { email: login } })` first, and falls back to
`Company.establishmentId` (`auth.service.ts:186-195`). It is also the address for every
registration email: approval, rejection, complements and verification.

**Read path.** **The dialog receives it** as `email` (`withDuplicateHints:1858`), but
does not display it today.

**Correction.** Not correctable through resubmission.

### 2.4 CNPS: `Company.cnpsNumber`

**Schema:** `cnpsNumber String?` (nullable, not unique).

**Write path.** Only the **enterprise** config declares `cnpsNumber`
(`register-constants.ts:216`), labelled "N° CNPS", **optional**, in the "Fiscalité et
affiliation" block. Then:

| Layer | Code |
|---|---|
| Wizard | sends `cnpsNumber: visibleData.cnpsNumber` (`register/page.tsx:578`) |
| Admin form | sends `data.cnpsNumber` (`nouvelle/page.tsx:175`) |
| Controller | `:128` → `cnpsNumber: body.cnpsNumber` |
| Service | `:732` → `cnpsNumber: companyData.cnpsNumber` |

**Which types send it.** Today only enterprise sends a value; for the other six types
`visibleEntityDataForType` drops the key. The legacy Flutter config
(`lib/screens/register_constants.dart:360`) also declares it, labelled
"N° d'affiliation CNPS".

**Read path.** **The dialog receives it** (`cnpsNumber`, `:1864`) and shows it after
the NIU when present.

**Correction.** Correctable through resubmission.

**Other uses.**
- **Duplicate detection:** `withDuplicateHints` flags "Même numéro CNPS que « … »".
- **Queue search:** `cnpsNumber contains term`.
- **DSMO writes it too**, through `dsmo.service.ts:323,383` (`company.upsert`).

### 2.5 `Company.contactEmail`

**It does not exist.** There is no such column in `prisma/schema.prisma` and no such
key in any DTO.

A related bug: both approval paths already write
`Establishment.email: (company as any).email || user.email`
(`auth.service.ts:1004` and `:1712`). `Company` has no `email` column, so the
`as any` read is always `undefined` and the establishment always receives the login
email. That code is effectively waiting for a company contact email to exist.

### 2.6 How the dialog reaches these values today

| Value | In `CompanyRegistrationItem`? | Source |
|---|---|---|
| Company.name | Yes (`organisation`) | queue response |
| Company.phone | **No**: loaded by Prisma, dropped by the projection | — |
| User.email | Yes (`email`) | queue response |
| Company.cnpsNumber | Yes (`cnpsNumber`) | queue response |
| Company.contactEmail | n/a (column does not exist) | — |

Everything comes from the paginated queue response. There is no per-id lookup and no
separate fetch, apart from the documents call that is being removed.

---

## Step 3: The approval endpoints

### 3.1 Service methods (`src/auth/auth.service.ts`)

**`approveUser`** (`:1114-1135`) is the dispatcher. COMPANY users go to
`approveCompanyRegistration`:

```ts
async approveUser(id, actorId, actorRole, actorTerritory?, options?: ApproveRegistrationOptions) {
  if (typeof actorId !== 'string' || actorId.trim() === '') throw new UnauthorizedException();
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) throw new BadRequestException('Utilisateur non trouvé');
  if (user.role === 'COMPANY') {
    return this.approveCompanyRegistration(user, actorId, actorRole, actorTerritory, options);
  }
  assertCanApproveRegistration({ ...actorTerritory, role: actorRole }, user);
  if (user.status !== 'PENDING_APPROVAL') throw new BadRequestException(…);
  return toPublicUser(await this.prisma.user.update({ where: { id },
    data: { status: 'ACTIVE', isActive: true, approvedAt: new Date() } }));
}
```

**`approveCompanyRegistration`** (`:1646-1752`):

```ts
const company = await this.requireCompanyForReview(user.id);
assertTerritorialAuthority({ ...actorTerritory, role: actorRole }, company);
if (user.status !== 'PENDING_APPROVAL' && user.status !== 'COMPLEMENTS_REQUESTED') throw …;
if (!company.entityType) throw …;
if (company.entityType === 'ADMINISTRATION' && options?.centralStructureConfirmed !== true) {
  throw new BadRequestException("La confirmation « structure centrale » est obligatoire …");
}
if (!company.subdivisionId) throw …;
// up to 2 attempts (P2002 retry), inside $transaction:
//   subdivision code → EstablishmentIdGenerator.generate → company.update(establishmentId)
//   establishment.create({ code: `${issued}-01`, …, phone: company.phone, email: (company as any).email || user.email })
//   user.update({ status: 'ACTIVE', isActive: true, approvedAt })
//   auditLog.create({ userId: actorId, action: 'COMPANY_REGISTRATION_APPROVED', resourceType: 'User',
//                     resourceId: user.id, details: { companyId: company.id, establishmentId: issued } })
// after commit (fire-and-forget): sendRegistrationApprovedEmail(user.email, …), issueAttestation(…)
```

**`rejectUser`** (`:1137-1205`). For COMPANY users:

```ts
const trimmed = reason.trim(); if (!trimmed) throw 'Le motif de rejet est obligatoire.';
const company = await this.requireCompanyForReview(user.id);
assertTerritorialAuthority({ ...actorTerritory, role: actorRole }, company);
// status must be PENDING_APPROVAL or COMPLEMENTS_REQUESTED
user.update({ status: 'REJECTED', isActive: false, rejectionReason: trimmed, rejectedAt: new Date() });
auditLog.create({ action: 'COMPANY_REGISTRATION_REJECTED', resourceType: 'User', resourceId: id,
                  details: { companyId: company.id, reason: trimmed } });
sendRegistrationRejectedEmail(updated.email, company.name, trimmed)   // fire-and-forget
```

Staff (non-COMPANY) users go to a separate branch that writes
`STAFF_REGISTRATION_REJECTED` with `{ reason }`.

**`requestComplements`** (`:1207-1244`). COMPANY only:

```ts
const trimmed = message.trim(); if (!trimmed) throw …;
const company = await this.requireCompanyForReview(user.id);
assertTerritorialAuthority({ ...actorTerritory, role: actorRole }, company);
user.update({ status: 'COMPLEMENTS_REQUESTED', isActive: true, approvalComment: trimmed });
auditLog.create({ action: 'COMPANY_REGISTRATION_COMPLEMENTS_REQUESTED', resourceType: 'User', resourceId: id,
                  details: { companyId: company.id, message: trimmed } });
sendRegistrationComplementsEmail(updated.email, company.name, trimmed)   // fire-and-forget
```

### 3.2 What the controller accepts (`auth.controller.ts:274-308`)

| Route | Guards / roles | Body extraction | DTO |
|---|---|---|---|
| `PATCH approve-user/:id` | `JwtAuthGuard, RolesGuard, ActiveCompanyGuard`; `USER_ADMIN_ROLES + TERRITORIAL_APPROVER_ROLES` | `@Body('centralStructureConfirmed') centralStructureConfirmed?: boolean` | **none**: a single property is plucked from the body |
| `PATCH reject-user/:id` | same | `@Body('reason') reason?: string` | none |
| `PATCH request-complements/:id` | same | `@Body('message') message?: string` | none |

The service-side options type is `ApproveRegistrationOptions { centralStructureConfirmed?: boolean }`
(`auth.service.ts:156-158`). The global `ValidationPipe` is
`{ transform: false, whitelist: true, forbidNonWhitelisted: false }` (`src/main.ts:64`).
Properties plucked with `@Body('key')` are passed through raw, without
class-validator.

### 3.3 Audit-log writes

All four entries go to the `AuditLog` table, whose `details` field is `Json?`.

| Action | Written at | `userId` | `details` |
|---|---|---|---|
| `COMPANY_REGISTRATION_APPROVED` | `:1719`, inside the approval transaction | actor | `{ companyId, establishmentId }` |
| `COMPANY_REGISTRATION_AUTO_APPROVED` | `:1011` (public ADMINISTRATION registrations) | registrant | `{ companyId, establishmentId, entityType, reason: 'AUTO_APPROVE_ENTITY_TYPES' }` |
| `COMPANY_REGISTRATION_REJECTED` | `:1164` | actor | `{ companyId, reason }` |
| `COMPANY_REGISTRATION_COMPLEMENTS_REQUESTED` | `:1231` | actor | `{ companyId, message }` |

Today these entries are read in three places:

| Reader | What it does |
|---|---|
| `lastResubmissionByUser` (`:1599`) | Reads COMPLEMENTS_REQUESTED and RESUBMITTED. |
| `src/report/actor-summary.service.ts:34` | Counts COMPANY_REGISTRATION_APPROVED per actor. |
| Generic audit viewers: `/admin/journal-audit` and the établissement timeline (`/admin/etablissement-detail`, through `GET /audit/reports?resourceId=`) | Render the entries through `auditDetailsSummary` (`react-web/src/lib/audit-log.ts:120`). That function has no case for `COMPANY_REGISTRATION_*` and falls back to `details.reason/comments/notes`, so an approval shows as "—". `AUDIT_ACTIONS` has no label for these actions either. |

---

## Step 4: Verification state design (Option A)

### 4.1 Where the four flags would be received

They would arrive alongside `centralStructureConfirmed` in the same route and flow
along the same path:

1. `PATCH /auth/approve-user/:id`, in `AuthController.approveUser`.
2. `AuthService.approveUser(…, options)`.
3. `approveCompanyRegistration(…, options)`.

Within `approveCompanyRegistration`, they would be checked at the same point as the
central-structure confirmation: **before the transaction**. A refusal then issues no
establishment ID and writes no audit row, the property the existing comment at
`:1661-1666` relies on.

The staff (non-COMPANY) branch of `approveUser` does not use them.

### 4.2 Can the existing approve contract carry them?

**There is no DTO.** The controller plucks one property with `@Body('…')`.

- **Adding four more `@Body('…')` parameters would technically work**, but each would reach the service unvalidated: `transform: false`, and plucked primitives bypass class-validator.
- **The cleaner fit is a new `ApproveRegistrationDto`.** It would hold `centralStructureConfirmed` plus the four flags, with the route-local `ValidationPipe` override already used by `register-company` and `admin/register-company`. Those two routes override the pipe so that a missing property is validated rather than skipped.
- **`ApproveRegistrationOptions`** (`auth.service.ts:156`) grows the same four optional booleans.
- **Client:** `approveUser()` in `user-directory.ts:78` gains the four fields in its options and body.

Two points need a decision before implementation:

1. **Name collision.** The proposed key `emailVerified` already means something else: `User.emailVerified` (`schema.prisma:145`) is the email-verification-token flag that `verifyEmail` sets. A reviewer flag with the same name in the payload, the DTO and the audit details invites confusion. The flag names should be distinct from it.
2. **Server enforcement of the gate.** The decision "a ✗ blocks approval" is today only a UI rule. CLAUDE.md §14 says frontend hiding is not authorization. The existing precedent, `centralStructureConfirmed`, is enforced server-side as **strictly `true`** (`:1667`, with tests at `auth.registration-approval.spec.ts:168-208`). Following that precedent means the server refuses approval unless all applicable flags are strictly `true`. That has two knock-on effects:
   - **The CNPS flag must be conditional.** Administration and projectProgram may have no CNPS. The server would require `cnpsVerified === true` only when the entity type is one of the five employer types, or when a CNPS value is present. The UI shows the row as "non applicable" otherwise. Which rule applies needs a decision.
   - **The legacy Flutter admin approve breaks.** `lib/screens/admin/users_directory_screen.dart:189` and `lib/data/api_client.dart:555` call `PATCH /auth/approve-user/:id` **with no body**. Both already fail today for ADMINISTRATION files, which need `centralStructureConfirmed`. With an enforced gate they would fail for every company file. Flutter is not in the React-first scope, but it is still in the repository and calls this endpoint.

### 4.3 Where the flags would be persisted

| Option | What it gives | Cost |
|---|---|---|
| **Audit-log `details` only** | A record of who attested which values, and when, written in the same transaction as the approval. The details become `{ companyId, establishmentId, verification: { … } }`. No schema change. | Not queryable without JSON paths. The viewers show "—" unless `auditDetailsSummary` learns the action. |
| New JSON column on `Company` (or `User`) | Direct read on the établissement page. | A schema change (needs human approval), with nothing that reads it yet. |
| New JSON column on `OnefopSubmission` | — | Wrong entity: registration approval is not a submission. |
| Both | — | Two sources of truth. |

**The audit log alone is enough, and the reason matters.** Under the hard gate, every
approved file has all applicable flags set to `true`, because an approval with a ✗ is
refused. So the persisted values carry almost no varying information. What has to be
recorded is the **attestation**: actor, time, and which rows were applicable. The
audit entry already records the actor (`userId`) and the time, inside the approval
transaction. A column would add a near-constant field.

**Snapshot the attested values.** It is worth recording the values that were attested
alongside the flags: name, phone, contact email and CNPS as they stood at approval.
A later correction can change `Company` without leaving any trace of what the
reviewer actually checked.

### 4.4 What else would read the flags

**Nothing in the codebase reads them today.** Candidates:

| Reader | Change |
|---|---|
| `react-web/src/lib/audit-log.ts` | `AUDIT_ACTIONS` gets a label for `COMPANY_REGISTRATION_APPROVED`, and `auditDetailsSummary` gets a case that summarises the attestation. These are what `/admin/journal-audit` and the établissement timeline render. |
| `src/report/actor-summary.service.ts` | Counts approvals only. No change needed. |
| `COMPANY_REGISTRATION_AUTO_APPROVED` (public ADMINISTRATION registrations) | **Bypasses review entirely**, so it carries no flags. Since ADMINISTRATION is also a type where CNPS is optional, this should be stated as accepted behaviour, not left as a gap. Assisted ADMINISTRATION files do go through the queue (`skipAutoApproval`). |

---

## Step 5: Removing the documents feature

### 5.1 The two service methods

```ts
// src/auth/auth.service.ts:1246-1297
async getUserDocuments(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { company: true, registrationDocuments: { include: { verifier: { select: { id, firstName, lastName, email, role } } } } },
  });
  if (!user) throw new BadRequestException('Utilisateur non trouvé');
  const expectedKinds = [ RCCM, NIU, CNI, ATTESTATION ];   // labels as in §1.3
  const items = expectedKinds.map((exp) => { const doc = storedDocs.find((d) => d.kind === exp.kind);
    return { id: doc?.id || exp.kind, userId, kind, label, state: doc?.state || 'PENDING',
             uploadedAt: doc?.uploadedAt || user.createdAt, verifiedAt: doc?.verifiedAt || null,
             verifiedBy: verifier name || verifier email || null }; });
  return { userId: user.id, companyName: user.company?.name || null, items };
}

// src/auth/auth.service.ts:1299-1333
async verifyUserDocument(userId, kindOrId, state, verifierId) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw …;
  const targetState = ['PENDING','VERIFIED','REJECTED','MISSING'].includes(state) ? state : 'VERIFIED';
  const existing = await this.prisma.registrationDocument.findFirst({ where: { userId, OR: [{ id: kindOrId }, { kind: kindOrId }] } });
  if (existing) return this.prisma.registrationDocument.update({ … state, verifiedAt, verifiedBy … });
  return this.prisma.registrationDocument.create({ data: { userId, kind: kindOrId, state, verifiedAt, verifiedBy } });
}
```

### 5.2 Every caller

| Side | File | Reference |
|---|---|---|
| Backend route | `src/auth/auth.controller.ts:310-315` | `GET users/:id/documents` → `getUserDocuments` |
| Backend route | `src/auth/auth.controller.ts:317-327` | `PATCH users/:id/documents/:kind/verify` → `verifyUserDocument` |
| Frontend API | `react-web/src/lib/user-directory.ts:99-125` | `RegistrationDocumentItem`, `UserDocumentsResult`, `getUserDocuments`, `verifyUserDocument` |
| Frontend UI | `react-web/src/app/admin/inscriptions/page.tsx:10,14,192-208,457-507` | imports, `documentsQuery`, `verifyMutation`, "Pièces justificatives" panel |

**No other caller exists:**
- No backend or frontend test covers either endpoint.
- The Flutter client (`lib/`) has no `/documents` call.
- The only other matches are documentation, and the stale copy under `.kilo/worktrees/fir-iguanadon/`, which is not the working tree.

### 5.3 The `RegistrationDocument` model

```prisma
model RegistrationDocument {           // @@map("registration_documents")
  id         String    @id @default(uuid())
  userId     String
  kind       String                    // free text
  fileRef    String?                   // never written by any code path
  state      String    @default("PENDING")
  uploadedAt DateTime?
  verifiedAt DateTime?
  verifiedBy String?
  user       User      @relation("RegistrationDocumentOwner",    fields: [userId],     references: [id], onDelete: Restrict)
  verifier   User?     @relation("RegistrationDocumentVerifier", fields: [verifiedBy], references: [id], onDelete: SetNull)
  @@index([userId]) @@index([verifiedBy])
}
// User back-relations (schema.prisma:181-182):
//   registrationDocuments RegistrationDocument[] @relation("RegistrationDocumentOwner")
//   verifiedDocuments     RegistrationDocument[] @relation("RegistrationDocumentVerifier")
```

The table was created by `prisma/migrations/20260930120100_add_user_registration_fields/migration.sql`.

### 5.4 Other readers of `registrationDocuments`

There are none. The only readers are `getUserDocuments`, through the `include`, and
`verifyUserDocument`, through `prisma.registrationDocument`. `verifiedDocuments` is
never read.

**One indirect effect remains while the table exists.** The owner relation is
`onDelete: Restrict`. Every row that a "Marquer vérifié" click has created blocks
`deleteUser` on that registrant: the delete answers 409 through the `P2003` mapping at
`auth.service.ts:2164`. That stays true after the code is removed and until the table
is dropped.

### 5.5 Files that change

| Phase | File | Change |
|---|---|---|
| **This change** | `src/auth/auth.controller.ts` | Remove the two `users/:id/documents` routes. |
| | `src/auth/auth.service.ts` | Remove `getUserDocuments` and `verifyUserDocument`. |
| | `react-web/src/lib/user-directory.ts` | Remove `RegistrationDocumentItem`, `UserDocumentsResult`, `getUserDocuments` and `verifyUserDocument`. |
| | `react-web/src/app/admin/inscriptions/page.tsx` | Remove the imports, `documentsQuery`, `verifyMutation` and the "Pièces justificatives" panel. |
| | `docs/deferred.md` | Lines 137 and 142-144 track `registration_documents` and its free-text `kind`/`state`. Mark them superseded by this decision. |
| | `docs/audit/onefop-scope-gap-fix-plan-2026-10-06.md` | Family 1 (rows 1a/1b, decisions D2/D3) plans a territory fix for these two endpoints. Retiring the endpoints closes it. Note it there so it is not implemented. |
| | `docs/audit/documents-endpoint-scope-2026-10-06.md` | Historical. Add at most a "resolved by retirement" note. |
| **Later schema task (Phase 6-style)** | `prisma/schema.prisma` | Remove `model RegistrationDocument` and the two `User` back-relations. |
| | new migration | `DROP TABLE "registration_documents"` (indexes and FKs go with it). |

**Confirmed: the model drop is a separate task, not this commit.** This change removes
every code read and write. The table, the model and the `User` relations stay until a
later migration, which is a schema change needing human approval (CLAUDE.md §21).
Leaving the model in place costs nothing at runtime, and Prisma client generation is
unaffected.

---

## Step 6: Registration form changes

### 6.1 The contact block today

This is the entity-info step: section 3, `case "entityInfo"`. It renders
`entityFieldGroups(entityType, entityData)` through `renderEntityField`. The contact
fields are shared constants in `react-web/src/lib/register-constants.ts:149-185`:

```ts
const PHONE:    EntityField = { key: "phone",  label: { fr: "Téléphone",   en: "Phone" },   hint: { fr: "Ex : 655000000", … }, required: true,  kind: "tel" };
const PHONE_2:  EntityField = { key: "phone2", label: { fr: "Téléphone 2", en: "Phone 2" },                                    required: false, kind: "tel" };
const PO_BOX:   EntityField = { key: "poBox",  label: { fr: "Boîte postale", en: "P.O. box" },                                required: false, kind: "text" };
const HEAD_OFFICE: EntityField = { key: "address", label: { fr: "Adresse du siège", en: "Office address" }, required: true, kind: "text" };
```

Their placement comes from `react-web/src/lib/register-entity-sections.ts:30-66`:

```ts
enterprise:         … { "Siège social et contact",   keys: ["address", "phone", "phone2", "poBox"] }
cooperative:        … { "Siège social et contact",   keys: ["cooperativeHeadOffice", "phone", "phone2", "poBox"] }
ctd / administration / projectProgram: { "Siège et contact", keys: ["address", "phone", "phone2", "poBox"] }
ong:                … { "Siège social et contact",   keys: ["address", "phone", "phone2", "poBox"] }
vocationalTraining: … { "Localisation et contact",   keys: ["address", "phone", "phone2", "poBox"] },
                      { "Promoteur / Directeur", keys: ["promoterName", "promoterSex", "promoterPhone1", "promoterPhone2"] }
```

The respondent step (`register/page.tsx:1174-1297`) separately holds the declarant's
"Téléphone 1" (required), "Téléphone 2" and "Email professionnel". These are the
**declarant's** contact details, not the entity's.

### 6.2 Current fields per type: phone, CNPS, email

| Type | Entity phone (`phone`) | Phone 2 | CNPS | Entity email |
|---|---|---|---|---|
| enterprise | "Téléphone", required | optional | "N° CNPS", **optional** | none |
| cooperative | required | optional | **none** | none |
| ctd | required | optional | **none** | none |
| ong | required | optional | **none** | none |
| administration | required | optional | none | none |
| projectProgram | required | optional | none | none |
| vocationalTraining | required (plus promoter Tél. 1/2) | optional | **none** | none |

**Every type's only email is the respondent's "Email professionnel", which becomes `User.email`.**

**The "phone 1" label change.** The verified row is "Téléphone / WhatsApp **de
l'entité**", which is `Company.phone`. The label that changes is therefore `PHONE`'s
"Téléphone" in step 3, not the respondent's "Téléphone 1". The brief says "label
change for phone 1", which could be read as the respondent field. This plan assumes
the entity phone; confirm before implementation.

One related precedent: the ONEFOP AST already labels VT's phone 1 "WhatsApp".

### 6.3 Required schema change

These are both schema changes and need human approval (CLAUDE.md §21).

**`Company.contactEmail`**
- Add the column, `String`.
- Backfill with `UPDATE companies SET "contactEmail" = users.email FROM users WHERE companies."userId" = users.id`. Every `Company` has a `userId` (NOT NULL, unique), so every row receives a value.
- After the backfill the column can be made NOT NULL **only if every write path sets it.** Those paths are `AuthService.createCompanyRegistration` and both DSMO `company.upsert` creates (`dsmo.service.ts:337-343`, `:394-400`, `create: { userId, … }`). It also needs `prisma/seed.ts:1453`. Otherwise it stays nullable and is enforced at the DTO level.

**`Company.cnpsNumber` required for five types**
- **A plain `NOT NULL` cannot express this.** It is conditional on `entityType`. The options are:
  - (a) DTO-level enforcement only, with `@ValidateIf(o => employer types)`. This is the pattern the VT fields already use (`register-company.dto.ts:78-106`).
  - (b) (a) plus a Postgres `CHECK ("entityType" NOT IN (…five…) OR "cnpsNumber" IS NOT NULL)` constraint.
- **A CHECK constraint fails on existing data.** Every existing cooperative, ctd, ong and VT row has a null CNPS, because the form never asked for it. So does every enterprise that skipped the optional field. A CHECK would have to be added `NOT VALID`, or deferred.
- **CNPS cannot be backfilled.** No source exists. Existing registrations without a CNPS stay that way until the company supplies one.
- **The CHECK would also constrain DSMO.** Its `company.upsert` creates can set `entityType` (`dsmo.service.ts:326`) without a CNPS.
- **Recommended shape: (a) now, (b) deferred.** (b) waits until existing rows have been completed.

**Migration shape**
1. Add `contactEmail`.
2. Backfill it from `users.email`.
3. Optionally set it NOT NULL, as described above.
4. No CNPS backfill. Any CHECK constraint is deferred, or added `NOT VALID`.
5. Add no table drop here; that is §5's later task.

**Consequences for files already in the review queue**
- Pending files without a CNPS cannot have the CNPS row ticked, so their reviewer must request complements.
- `cnpsNumber` is already correctable through resubmission, so that path works for CNPS.
- **`phone` and `contactEmail` are not correctable today.** A ✗ on either one leaves Request complements as a dead end: the company cannot fix the value. They have to be added to:

  | File | Change |
  |---|---|
  | `CORRECTABLE_COMPANY_FIELDS` (`auth.service.ts:1342`) | add both fields |
  | `ResubmitRegistrationDto` (`src/auth/dto/resubmit-registration.dto.ts`) | add both fields |
  | `RegistrationCorrections` (`user-directory.ts:200`) | add both fields |
  | `TEXT_FIELDS` (`react-web/src/app/home/inscription-en-attente/page.tsx:28`) | add both fields |
  | `FIELD_LABELS` (`admin/inscriptions/page.tsx:45`) | add both fields, so the reviewer's diff names them |

- **A resubmission can change `entityType` to an employer type** (`entityType` is correctable). So the "CNPS required for five types" rule has to apply on resubmission too, not only at registration.

### 6.4 Assisted registration (`/admin/inscriptions/nouvelle`)

The assisted form reads the same `ENTITY_CONFIGS`, so the new fields, the new CNPS
rule and the phone label arrive automatically in its "Identification — {type}" grid.
Requiredness comes from `field.required` (`firstProblem`, `nouvelle/page.tsx:142-146`).

Additional work specific to this form:
- **Payload:** `submit()` (`:161-202`) lists payload keys explicitly. `contactEmail` has to be added to that list, and to `AssistedRegistrationPayload` in `react-web/src/lib/inscriptions.ts`. `cnpsNumber` is already sent.
- **Backend:** the server side shares `CompanyRegistrationFieldsDto` with the public route, so the DTO change covers both. The `adminRegisterCompany` controller mapping (`auth.controller.ts:211+`) needs `contactEmail` added, as does `registerCompany`'s mapping (`:115-160`) and `CompanyRegistrationData` / `createCompanyRegistration`.
- **Prefill decision:** the admin form's respondent "Adresse e-mail" is the login identifier. Should the entity contact email default to it or be typed separately? The decision has not been made. The backfill rule ("from User.email") suggests defaulting to it for convenience, while still storing it separately.

### 6.5 Does registration collect CNPS for non-enterprise types?

**No.** Only `ENTITY_CONFIGS.enterprise` declares `cnpsNumber`. Adding the CNPS
requirement means a form change for **cooperative, ctd, ong and vocationalTraining**:
a new `cnpsNumber` field, required, in each of those configs. Enterprise's existing
field flips from optional to required. Each new field also needs a place in
`ENTITY_SECTION_LAYOUT`; otherwise it lands in the "Informations complémentaires"
fallback, and `register-entity-sections.test.ts:40` ("no type needs the unmapped
fallback today") fails.

**The placement constraint.** `register-required.test.ts:95` asserts that the last
field of section 3 is optional for every type. The wizard's auto-advance depends on
it (`register/page.tsx:840-846`):

- Neither required CNPS nor a required `contactEmail` may become the last field of section 3.
- In the contact groups, inserting `contactEmail` before `poBox` keeps `poBox` (optional) last.
- VT's last group is the promoter block, so VT is unaffected wherever its contact fields go.

---

## Step 7: The declarant context block

### 7.1 Where the declarant data comes from today

**The current dialog shows no declarant data at all.** It shows the organisation,
type, territory, NIU/CNPS, date, hints, corrections, documents and decision.

The data exists:

| Value | Column(s) | Written by |
|---|---|---|
| Name | `Company.respondentFirstName` / `respondentLastName` (also `User.firstName` / `lastName`) | registration (both routes) |
| Function | `Company.respondentFunction` | registration. Public: select of 9; admin: free text, optional |
| Phone | `Company.respondentPhone` / `respondentPhone2` | registration. Public: phone 1 required; admin: optional |
| Email (login) | `User.email` | registration |
| Registered by | `User.createdBy` → `createdByName`, `registrationMethod` | already in the response |

### 7.2 Is it in the review response?

**Partly.**

- **Already in the response:** `email`, `createdByName` and `registrationMethod`.
- **Fetched but dropped:** `Company.respondentFirstName`, `respondentLastName`, `respondentFunction`, `respondentPhone`, `respondentPhone2`, and `Company.phone`. `prisma.company.findMany` returns every `Company` scalar, but the projection in `withDuplicateHints` (`:1854-1874`) leaves them out. Its row parameter type (`:1794-1816`) also omits them.
- **Required change:** add `respondentFirstName`, `respondentLastName`, `respondentFunction`, `respondentPhone`, `respondentPhone2`, `phone` and `contactEmail` to that projection and its parameter type, and to `CompanyRegistrationItem` in `react-web/src/lib/user-directory.ts`.
- **Do not use `User.firstName` / `lastName` here.** They are not selected, and `Company.respondent*` is the declarant record that registration writes.
- **No new endpoint and no extra query are needed.**

---

## Step 8: Report

### 8.1 Schema changes (need human approval)

- **`Company.contactEmail String?`**, backfilled from `users.email` by `userId`. It may become NOT NULL only after every `Company` write path sets it: auth registration, both DSMO upserts and the seed.
- **CNPS required for the five employer types:**
  - Enforce it in `CompanyRegistrationFieldsDto` with `@ValidateIf` on `entityType`, and on resubmission when `entityType` changes.
  - Do not use a column NOT NULL; it cannot be conditional.
  - Treat a DB `CHECK` as optional and deferred, or add it `NOT VALID`, because existing rows have no CNPS and none can be backfilled.
- **Migration:** add the column, then backfill. No CNPS change at the DB level in this pass. No table drop.
- **Later, separate task:** drop `registration_documents`, the `RegistrationDocument` model and the two `User` back-relations.

### 8.2 Registration form (`/register`)

- **New field:** "Email de contact" (`contactEmail`), required, in each type's contact group, placed before `poBox`.
- **CNPS:**
  - New required `cnpsNumber` field for cooperative, ctd, ong and vocationalTraining.
  - Enterprise's existing field flips to required.
  - Administration and projectProgram are unchanged (no field), unless optional CNPS is wanted for them. The decision says "optional", which could mean adding an optional field; this needs a ruling.
- **Label:** `PHONE` "Téléphone" becomes "Téléphone / WhatsApp" in fr and en. This assumes the entity phone (see §6.2).
- **Payload and draft:**
  - `submit()` sends `contactEmail`.
  - The review-step summary (`register-summary.ts`) and the draft (`register-draft.ts`) pick the new field up automatically through `entityData`, so it should be verified rather than re-coded.
  - `pruneEntityDataForType` keeps `contactEmail` across type switches only if every type declares it, which this plan does.

### 8.3 Assisted registration (`/admin/inscriptions/nouvelle`)

- **Automatic:** the field, requiredness and label changes come through `ENTITY_CONFIGS`.
- **Manual:** add `contactEmail` to the explicit `mutation.mutate({…})` payload and to `AssistedRegistrationPayload`.
- **Decision needed:** whether the contact email defaults to the respondent's login email.

### 8.4 Inscriptions dialog

- **Remove** the "Pièces justificatives" panel, `documentsQuery` and `verifyMutation`.
- **Add a verification list** of four rows. Each row shows the label, the value from the queue response and a ✓ / ✗ control:

  | Row | Value |
  |---|---|
  | Nom de l'entité | `organisation` |
  | Téléphone / WhatsApp de l'entité | `phone` (new in the response) |
  | Email de contact | `contactEmail` (new) |
  | N° CNPS | `cnpsNumber` |

  - **"Unanswered" must stay distinguishable from ✓ and ✗**, per CLAUDE.md §9.
  - **CNPS row:** "non applicable" for administration and projectProgram when empty.
  - **State:** client state reset by `closeReview()`, like `centralChecked`.
- **Add a declarant context block** (not verified): the declarant's name, function, phone(s) and login email, plus the existing "registered by" attribution.
- **Approve gate:**
  - "Confirmer" with Approuver is refused unless every applicable row is ✓.
  - Any ✗ steers the reviewer to Rejeter or Demander des compléments.
  - The existing central-structure checkbox stays.
- **Diff labels:** `FIELD_LABELS` gains `phone` and `contactEmail` for the resubmission table.

### 8.5 Approve payload and persistence

- **Payload:** `PATCH /auth/approve-user/:id` carries `centralStructureConfirmed` plus four verification booleans.
  - Introduce an `ApproveRegistrationDto` with the route-local `ValidationPipe`.
  - Extend `ApproveRegistrationOptions`.
  - Choose a key name that does not collide with `User.emailVerified`.
- **Server check:** inside `approveCompanyRegistration`, before the transaction, refuse unless every applicable flag is strictly `true`. The CNPS flag is conditional on entity type or on a value being present. This mirrors `centralStructureConfirmed`.
- **Persistence:** in the `COMPANY_REGISTRATION_APPROVED` audit entry's `details`, alongside `companyId` and `establishmentId`. Record the flags and the four values as attested. No new column.
- **Readers:** `audit-log.ts` gains a label and a details summary for the action.
- **Known breakage:** the legacy Flutter approve (`lib/…/users_directory_screen.dart:189`, `lib/data/api_client.dart:555`) sends no body and would be refused.

### 8.6 Documents removal

- **This change:** remove both routes, both service methods, the client functions and types, and the dialog panel. Update `docs/deferred.md` and the Family 1 plan.
- **Later task:** drop the table, model and relations.
- **Until the drop:** existing `registration_documents` rows keep blocking `deleteUser` for their registrants (409).

### 8.7 Tests to add or change

| File | Change |
|---|---|
| `src/auth/auth.registration-approval.spec.ts` | Add: refuses a COMPANY approval when any applicable flag is missing, `false` or merely truthy; approves when all are `true`; does not require the CNPS flag for administration and projectProgram with no CNPS (or per the ruling); audit `details` contain the flags and attested values; the refusal happens before the transaction (no establishment ID, no audit row). Update the existing approve tests (`:94`, `:112`, `:138`, `:184`, `:208`, `:214`) to send the flags. |
| `src/auth/assisted-registration.spec.ts` | Add: `contactEmail` persisted; CNPS required for the five types, optional for administration and projectProgram. |
| `src/auth/auth.registration-resubmission.spec.ts` | Add: `phone` and `contactEmail` accepted and diffed; changing `entityType` to an employer type without a CNPS is refused. Update the "refuses an unknown key" fixtures if they use these keys. |
| new or existing DTO spec for `CompanyRegistrationFieldsDto` | CNPS `ValidateIf` per type; `contactEmail` `@IsEmail`. |
| `react-web/src/lib/register-constants.test.ts` | Add: every type declares `contactEmail`; the five employer types declare a required `cnpsNumber`; administration and projectProgram per the ruling. |
| `react-web/src/lib/register-entity-sections.test.ts` | Existing tests at `:21` and `:40` must stay green with the new fields placed. |
| `react-web/src/lib/register-required.test.ts` | Existing `:65` and `:95` must stay green: required-only completion, and the last field optional. |
| `react-web/src/lib/register-summary.test.ts` | Add a row check for the contact email. |
| Inscriptions gate logic | No test file covers the inscriptions page today. Extract the approve gate (applicable rows, all ✓) to a pure helper in `react-web/src/lib/inscriptions.ts` and test it in `inscriptions.test.ts`, which already exists. |
| `react-web/src/lib/audit-log` | If the summary case is added, add a test next to the existing `admin-data-integrity.test.ts` pattern. |
| Documents | No existing test covers the documents endpoints, so nothing to remove. `active-company.completeness.spec.ts` enumerates controller handlers dynamically and should keep passing after the two routes go. Re-run it. |
| Authoritative backend run | `jest --runInBand`; parallel runs are flaky in this repo. |

### 8.8 Every file affected

**Backend**

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `Company.contactEmail`. (Later task: remove `RegistrationDocument` and the `User` relations.) |
| `prisma/migrations/<new>/migration.sql` | Add `contactEmail`, backfill from `users.email`. (Later: drop `registration_documents`.) |
| `src/auth/dto/register-company.dto.ts` | `contactEmail` (`@IsEmail`); `cnpsNumber` required by `@ValidateIf` for the five employer types. |
| `src/auth/dto/resubmit-registration.dto.ts` | Add `phone`, `contactEmail`. |
| `src/auth/dto/approve-registration.dto.ts` (new) | `centralStructureConfirmed` plus the four verification flags. |
| `src/auth/auth.controller.ts` | Map `contactEmail` in `registerCompany` and `adminRegisterCompany`; use the approve DTO; remove the two documents routes. |
| `src/auth/auth.service.ts` | Add `contactEmail` to `CompanyRegistrationData` and `createCompanyRegistration`. Extend `ApproveRegistrationOptions`. Add the flag check and attested snapshot in `approveCompanyRegistration`. Use `company.contactEmail` instead of `(company as any).email` for `Establishment.email` (both approval paths). Extend `withDuplicateHints` (phone, contactEmail, respondent fields). Add `phone` and `contactEmail` to `CORRECTABLE_COMPANY_FIELDS`, plus the CNPS rule on `entityType` change. Remove `getUserDocuments` and `verifyUserDocument`. |
| `src/dsmo/dsmo.service.ts` | Only if `contactEmail` becomes NOT NULL: set it on the two `company.upsert` creates. Cross-domain, so flag it to the CTO. |
| `prisma/seed.ts` | Set `contactEmail` (and CNPS for employer types) on seeded companies. |

**React web**

| File | Change |
|---|---|
| `react-web/src/lib/register-constants.ts` | `PHONE` label "Téléphone / WhatsApp"; new `CONTACT_EMAIL` field on all seven types; `cnpsNumber` required on the five employer types. |
| `react-web/src/lib/register-entity-sections.ts` | Place `contactEmail` (before `poBox`) and `cnpsNumber` in each type's layout. |
| `react-web/src/app/register/page.tsx` | Send `contactEmail` in `submit()`. |
| `react-web/src/lib/api-client.ts` | `RegisterCompanyPayload` gets `contactEmail`. |
| `react-web/src/app/admin/inscriptions/nouvelle/page.tsx` | Send `contactEmail`; decide on the respondent-email default. |
| `react-web/src/lib/inscriptions.ts` | `AssistedRegistrationPayload` gets `contactEmail`; new pure approve-gate helper. |
| `react-web/src/lib/user-directory.ts` | `CompanyRegistrationItem` gets `phone`, `contactEmail` and the respondent fields; `approveUser` options get the four flags; `RegistrationCorrections` gets `phone` and `contactEmail`; remove the documents types and functions. |
| `react-web/src/app/admin/inscriptions/page.tsx` | Remove the documents panel and queries; add the verification list, declarant block and approve gate; add `phone` and `contactEmail` to `FIELD_LABELS`. |
| `react-web/src/app/home/inscription-en-attente/page.tsx` | Add `phone` and `contactEmail` to `TEXT_FIELDS` so complements can fix them. |
| `react-web/src/lib/audit-log.ts` | Label and details summary for `COMPANY_REGISTRATION_APPROVED`. |
| `react-web/messages/{fr,en}.json` | Only if any new copy goes through next-intl. Registration field labels are `{fr,en}` data in `register-constants.ts`, not catalogue keys. |
| Test files | As listed in §8.7. |

**Docs**

| File | Change |
|---|---|
| `docs/deferred.md` | Mark the `registration_documents` items superseded; add the later table-drop task. |
| `docs/audit/onefop-scope-gap-fix-plan-2026-10-06.md` | Note that Family 1 is closed by retiring the endpoints. |

**Legacy Flutter (`lib/`): not changed in this plan, but affected**

| File | Effect |
|---|---|
| `lib/screens/register_constants.dart`, `lib/providers/auth_provider.dart:327`, `lib/data/api_client.dart:351` | The Flutter registration would fail the new CNPS rule for the five types, and would not send `contactEmail`. |
| `lib/screens/admin/users_directory_screen.dart:189`, `lib/data/api_client.dart:555` | The Flutter approve sends no body and would be refused by a server-enforced gate. |

### 8.9 Decisions still needed

1. **Phone label:** confirm the label change targets the entity `phone` ("Téléphone" → "Téléphone / WhatsApp"), not the declarant's "Téléphone 1".
2. **Server gate:** confirm the gate is enforced server-side, strictly `true` like `centralStructureConfirmed`, accepting the Flutter approve breakage.
3. **CNPS row for administration and projectProgram:**
   - (a) Is the row hidden or shown as "non applicable" when CNPS is empty?
   - (b) Do these types get an optional CNPS field at registration, or none?
4. **Flag key names:** they must avoid `emailVerified` (collides with `User.emailVerified`).
5. **`contactEmail` requiredness:** nullable with DTO-level requiredness, or NOT NULL, which pulls in DSMO and the seed.
6. **Assisted form:** whether `contactEmail` defaults to the respondent's login email.
7. **Existing rows without CNPS:** whether any DB-level CHECK is wanted, and when, given that they cannot be backfilled.
8. **Auto-approved ADMINISTRATION registrations:** confirm it is acceptable that they bypass the verification list.
