# Registration-documents feature: removal plan

Date: 2026-10-06. Read-only survey of `src/auth/`, `prisma/`, `react-web/src`, `lib/` (Flutter) and `docs/`. No code changed, no tests run, no database touched. The stale copy under `.kilo/worktrees/` was ignored.

Context: the Inscriptions review redesign removes the registration-documents feature. There is no upload path anywhere in the system, so the four rows the dialog shows (RCCM, NIU, CNI, ATTESTATION) let a reviewer "verify" documents the platform never receives. This plan verifies, against the code, the leads in `docs/audit/inscriptions-review-redesign-2026-10-06.md` §5 and `docs/audit/documents-endpoint-scope-2026-10-06.md`. Every claim in those two reports that this plan relies on was confirmed; no discrepancy was found.

---

## Step 1: The endpoints

### 1.1 Service methods (`src/auth/auth.service.ts:1246-1333`)

```ts
  async getUserDocuments(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        registrationDocuments: {
          include: {
            verifier: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
    });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');

    const expectedKinds = [
      { kind: 'RCCM', label: 'Extrait RCCM / Acte constitutif' },
      { kind: 'NIU', label: 'Attestation d\'immatriculation fiscale (NIU)' },
      { kind: 'CNI', label: 'Pièce d\'identité du représentant / déclarant' },
      { kind: 'ATTESTATION', label: 'Attestation de localisation ou plan' },
    ];

    const storedDocs = user.registrationDocuments || [];
    const items = expectedKinds.map((exp) => {
      const doc = storedDocs.find((d) => d.kind === exp.kind);
      return {
        id: doc?.id || exp.kind,
        userId: user.id,
        kind: exp.kind,
        label: exp.label,
        state: doc?.state || 'PENDING',
        uploadedAt: doc?.uploadedAt || user.createdAt,
        verifiedAt: doc?.verifiedAt || null,
        verifiedBy: doc?.verifier
          ? `${doc.verifier.firstName || ''} ${doc.verifier.lastName || ''}`.trim() || doc.verifier.email
          : null,
      };
    });

    return {
      userId: user.id,
      companyName: user.company?.name || null,
      items,
    };
  }

  async verifyUserDocument(userId: string, kindOrId: string, state: string, verifierId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Utilisateur non trouvé');

    const validStates = ['PENDING', 'VERIFIED', 'REJECTED', 'MISSING'];
    const targetState = validStates.includes(state) ? state : 'VERIFIED';

    const existing = await this.prisma.registrationDocument.findFirst({
      where: {
        userId,
        OR: [{ id: kindOrId }, { kind: kindOrId }],
      },
    });

    if (existing) {
      return this.prisma.registrationDocument.update({
        where: { id: existing.id },
        data: {
          state: targetState,
          verifiedAt: targetState === 'VERIFIED' ? new Date() : null,
          verifiedBy: targetState === 'VERIFIED' ? verifierId : null,
        },
      });
    }

    return this.prisma.registrationDocument.create({
      data: {
        userId,
        kind: kindOrId,
        state: targetState,
        verifiedAt: targetState === 'VERIFIED' ? new Date() : null,
        verifiedBy: targetState === 'VERIFIED' ? verifierId : null,
      },
    });
  }
```

Observations, all confirmed in the code above:
- `getUserDocuments` always returns exactly four items, whatever is stored. `uploadedAt` falls back to `user.createdAt`, so the response reports an upload date for files that were never uploaded.
- `verifyUserDocument` defaults an unknown `state` to `VERIFIED`, matches the path segment against either row `id` or `kind`, creates a row for any free-text `kind`, and writes no audit row.

### 1.2 Controller methods (`src/auth/auth.controller.ts:310-327`)

```ts
  @Get('users/:id/documents')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)
  async getUserDocuments(@Param('id') id: string) {
    return this.authService.getUserDocuments(id);
  }

  @Patch('users/:id/documents/:kind/verify')
  @UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)
  @Roles(...USER_ADMIN_ROLES, ...TERRITORIAL_APPROVER_ROLES)
  async verifyUserDocument(
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Body('state') state: string,
    @Request() req: any,
  ) {
    return this.authService.verifyUserDocument(id, kind, state, req.user.id);
  }
```

Removing these two handlers leaves no unused import in the controller: `Get`, `Patch`, `Param`, `Body`, `Request`, the guards and the role constants are all used by neighbouring handlers (e.g. `requestComplements` at :297-308 and `company-registrations` at :329).

### 1.3 Frontend callers

`react-web/src/lib/user-directory.ts:99-125`:

| Symbol | Lines | Role |
|---|---|---|
| `RegistrationDocumentItem` | 99-108 | item type; `state: "PENDING" \| "VERIFIED" \| "REJECTED" \| "MISSING"` |
| `UserDocumentsResult` | 110-114 | `{ userId, companyName, items }` |
| `getUserDocuments(userId)` | 116-118 | `GET /auth/users/:id/documents` |
| `verifyUserDocument(userId, kind, state)` | 120-125 | `PATCH /auth/users/:id/documents/:kind/verify`, body `{ state }` |

A grep of all of `react-web/src` for `getUserDocuments`, `verifyUserDocument`, `RegistrationDocumentItem`, `UserDocumentsResult` and `/documents` finds exactly two files: `user-directory.ts` (definitions) and `react-web/src/app/admin/inscriptions/page.tsx` (imports at :10 and :14, use at :197 and :203). There is no other page. The former caller, `/admin/etablissement-detail/approbation`, is already retired (the comment at `inscriptions/page.tsx:192-194` records the move); `react-web/src/app/admin/etablissement-detail/` now contains only `page.tsx`, which does not reference documents.

### 1.4 Backend and Flutter callers

- Backend: the two service methods are called only from the two controller handlers above. No other service, controller, job or seed calls them or touches `prisma.registrationDocument`.
- Flutter (`lib/`): no `/documents` call, no `registrationDocument` reference. Confirmed by grep.

---

## Step 2: The model

### 2.1 `RegistrationDocument` (`prisma/schema.prisma:212-237`)

```prisma
// One row per document a registrant must provide (Figma "Documents
// fournis": attestation d'enregistrement, pièce d'identité, certificat
// d'imposition…). A row with no fileRef is an expected document that has
// not been provided ("Manquant").
model RegistrationDocument {
  id         String    @id @default(uuid())
  userId     String
  // Document type code; free text until the list per entity type is ruled.
  kind       String
  // Supabase Storage object path, signed on read — same pattern as
  // Company.attestationUrl (PdfService.getSignedUrlForPath). No bytes here.
  fileRef    String?
  // PENDING | VERIFIED | REJECTED | MISSING — free text until the workflow settles.
  state      String    @default("PENDING")
  uploadedAt DateTime?
  verifiedAt DateTime?
  verifiedBy String?
  // Restrict: deleting a registrant with documents answers 409 (deleteUser
  // maps P2003), the same as a user with a company or submissions.
  user       User      @relation("RegistrationDocumentOwner", fields: [userId], references: [id], onDelete: Restrict)
  verifier   User?     @relation("RegistrationDocumentVerifier", fields: [verifiedBy], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([verifiedBy])
  @@map("registration_documents")
}
```

### 2.2 Relations and origin

- `User.registrationDocuments RegistrationDocument[] @relation("RegistrationDocumentOwner")` — `schema.prisma:181`. Owner FK is `ON DELETE RESTRICT`.
- `User.verifiedDocuments RegistrationDocument[] @relation("RegistrationDocumentVerifier")` — `schema.prisma:182`. Verifier FK is `ON DELETE SET NULL`.
- Created by `prisma/migrations/20260930120100_add_user_registration_fields/migration.sql` (Admin rebuild B1): `CREATE TABLE "registration_documents"` (:22-33), two indexes (:47, :50), two FKs (:59 RESTRICT, :62 SET NULL). Its header says "Nothing in the application reads or writes these columns yet"; the two endpoints were added afterwards.

### 2.3 Every read and write

| Access | Location |
|---|---|
| Read via `include: { registrationDocuments }` | `auth.service.ts:1251` (`getUserDocuments`) |
| `prisma.registrationDocument.findFirst` | `auth.service.ts:1306` (`verifyUserDocument`) |
| `prisma.registrationDocument.update` | `auth.service.ts:1314` |
| `prisma.registrationDocument.create` | `auth.service.ts:1324` |
| `verifiedDocuments` | never read anywhere |

Nothing in `react-web/` touches Prisma; its only contact is the two HTTP routes. No seed or script under `prisma/` or `src/` creates rows.

### 2.4 `fileRef` is never written

Grep for `fileRef` across `src/`, `react-web/src`, `prisma/` and `lib/` finds only the schema field (`schema.prisma:223`), its comment (:214) and the migration column (`migration.sql:26`). The `create` and `update` calls above do not set it, and no upload endpoint exists. Every stored row is a checklist tick, not a document.

### 2.5 Delete-blocking effect

`deleteUser` (`auth.service.ts:2153-2172`) catches `PrismaClientKnownRequestError` with code `P2003` at `:2164` and throws `ConflictException` (409, "des données liées existent … Suspendez le compte à la place"). Because the owner FK is `ON DELETE RESTRICT`, every row created by a "Marquer vérifié" click blocks hard-deleting that registrant. Removing the code does not remove the rows: the block persists until the table is dropped (or the rows are deleted by a migration). Toggling back to "PENDING" updates the row but does not delete it, so even un-verified registrants stay blocked once clicked.

---

## Step 3: The Inscriptions dialog's documents section

### 3.1 Query and mutation (`react-web/src/app/admin/inscriptions/page.tsx:192-208`)

```tsx
  // Supporting documents of the account under review (moved here from the
  // retired /admin/etablissement-detail/approbation page). `reviewing.id` is
  // the user id, which is what the documents endpoints take.
  const documentsQuery = useQuery({
    queryKey: ["auth", "users", reviewing?.id, "documents"],
    queryFn: () => getUserDocuments(reviewing!.id),
    enabled: !!reviewing,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ userId, kind, state }: { userId: string; kind: string; state: "VERIFIED" | "PENDING" }) =>
      verifyUserDocument(userId, kind, state),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["auth", "users", userId, "documents"] });
    },
    onError: failed,
  });
```

### 3.2 The "Pièces justificatives" block (`page.tsx:457-507`)

```tsx
            <div>
              <p style={{ marginBottom: 4 }}><strong>Pièces justificatives</strong></p>
              {documentsQuery.isLoading ? (
                <p style={{ margin: 0 }}>Chargement des pièces justificatives…</p>
              ) : documentsQuery.isError ? (
                <p style={{ margin: 0 }}>Impossible de charger les pièces justificatives.</p>
              ) : (documentsQuery.data?.items ?? []).length === 0 ? (
                <p style={{ margin: 0 }}>Aucune pièce justificative enregistrée.</p>
              ) : (
                <table className="cam-dash-table">
                  <thead>
                    <tr>
                      <th scope="col">Pièce</th>
                      <th scope="col">État</th>
                      <th scope="col"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(documentsQuery.data?.items ?? []).map((doc) => {
                      const isVerified = doc.state === "VERIFIED";
                      return (
                        <tr key={doc.kind}>
                          <th scope="row">{doc.label}</th>
                          <td>
                            {isVerified && doc.verifiedBy
                              ? `Vérifié par ${doc.verifiedBy} le ${formatDate(doc.verifiedAt)}`
                              : "En attente de vérification formelle"}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="cam-button cam-button-secondary cam-button-sm"
                              disabled={verifyMutation.isPending}
                              onClick={() =>
                                verifyMutation.mutate({
                                  userId: reviewing.id,
                                  kind: doc.kind,
                                  state: isVerified ? "PENDING" : "VERIFIED",
                                })
                              }
                            >
                              {isVerified ? "✓ Vérifié" : "Marquer vérifié"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
```

### 3.3 State, mutations, query keys

| Item | Detail |
|---|---|
| Local state | None of its own. It reads `reviewing` (the dialog's selected registration). |
| Query | `documentsQuery`, key `["auth", "users", <userId>, "documents"]`, enabled only while the dialog is open. |
| Mutation | `verifyMutation`, sends only `VERIFIED` or `PENDING` (never `REJECTED`/`MISSING`), invalidates the same key on success, reports errors through the shared `failed` notice. |
| Coupling | None. The approve/reject/complements mutations and `handleDecisionSubmit` do not read `documentsQuery` or `verifyMutation`. Document state never gates approval. |
| Dead branch | The "Aucune pièce justificative enregistrée" branch is unreachable: the backend always returns four items. |

After removal, no import becomes orphaned except `getUserDocuments` and `verifyUserDocument`. `useQuery`, `useMutation`, `queryClient`, `failed` and `formatDate` remain used elsewhere in the page (e.g. `formatDate` at :370, :422, :431; `queryClient` at :168; `failed` at :179-189).

### 3.4 Test coverage

- Backend: grep of `src/**/*.spec.ts` for `getUserDocuments`, `verifyUserDocument`, `registrationDocument`, `RegistrationDocument`, `verifiedDocuments` and `users/:id/documents` finds nothing. The only "Documents" hits are the string `'Documents illisibles'` used as a rejection reason in `auth.registration-approval.spec.ts:318,323,332` and `public-user.spec.ts:20`; unrelated.
- Frontend: no `react-web/src/**/*.test.ts(x)` references either function, the types or the route. The only Inscriptions test, `react-web/src/lib/inscriptions.test.ts`, imports `inscriptionsHref` only.
- `src/auth/active-company.completeness.spec.ts` (read, not run): it scans every controller in `AppModule` and asserts (a) at least 18 controllers, (b) `jwtRoutesCount > 0`, (c) no JWT route lacks `ActiveCompanyGuard`/`@AllowInactiveCompany`, (d) the exact set of `@AllowInactiveCompany` exemptions. Neither documents handler is in the exemption list, and removing two guarded handlers from an existing controller changes none of the four assertions. Unaffected.

---

## Step 4: The scope-gap plan

### 4.1 Family 1 in one paragraph

`docs/audit/onefop-scope-gap-fix-plan-2026-10-06.md` Family 1 covers the two documents routes, which are open to SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN and DIVISIONAL_ADMIN but never pass the caller to the service, so a territorial admin with a user's UUID can read or change document-verification state for any user nationally. 1a (`GET`) proposes loading the target with its company and returning not-found unless the target is a COMPANY user whose company passes `assertTerritorialAuthority`. 1b (`PATCH`) proposes the same target rule plus a `state` whitelist (`VERIFIED | PENDING | REJECTED`, 400 otherwise), a `kind` whitelist of the four known kinds with matching by kind only, an optional status rule, and an audit row. Each comes with a list of unit tests to add; the suggested order of work places it as step 4 ("1b, then 1a").

### 4.2 What becomes moot

Family 1 becomes moot once the endpoints are removed: the territory gap is closed by deletion rather than by scoping, and none of its proposed tests need writing.

| Item in the plan | Status after removal |
|---|---|
| Summary rows 1a and 1b | Moot. |
| Family 1 section (1a, 1b, their tests) | Moot. |
| D2 (verify on a file no longer pending) | Moot. Only Family 1 uses it. |
| D3 (staff-account targets for documents) | Moot. Only Family 1 uses it. |
| D1 (404 vs 403 for out-of-territory) | Partly moot. The 403-for-the-verify-write half disappears; the 404-for-reads recommendation still applies to Families 3 and 4. |
| D4, D5 | Unaffected. |
| Suggested order of work, step 4 | Moot; steps 1-3, 5, 6 unaffected. |

---

## Step 5: Report

### 5.1 Files to edit in the removal change

| Layer | File | Change |
|---|---|---|
| Backend | `src/auth/auth.controller.ts` | Remove the `GET users/:id/documents` and `PATCH users/:id/documents/:kind/verify` handlers (:310-327). |
| Backend | `src/auth/auth.service.ts` | Remove `getUserDocuments` and `verifyUserDocument` (:1246-1333). |
| Frontend | `react-web/src/lib/user-directory.ts` | Remove `RegistrationDocumentItem`, `UserDocumentsResult`, `getUserDocuments`, `verifyUserDocument` (:99-125). |
| Frontend | `react-web/src/app/admin/inscriptions/page.tsx` | Remove the two imports (:10, :14), the comment, `documentsQuery` and `verifyMutation` (:192-208), and the "Pièces justificatives" block (:457-507). |
| Docs | `docs/deferred.md` | Line 137 (`registration_documents` table row) and lines 142-144 (free-text `kind`/`state` follow-up): mark superseded by the retirement; point to the later drop task. |
| Docs | `docs/deferred.md` | Line 136 (`UserStatus.DOCUMENTS_INCOMPLETE`, "Documents incomplets"): annotate that the documents concept behind it is retired. Do not remove the enum value (see 5.2). |
| Docs | `docs/admin-replacement/ui-wiring-todo.md` | Lines 28 and 71 (Documents column / "Documents fournis"): mark closed as "won't do — feature retired". |
| Docs | `docs/audit/onefop-scope-gap-fix-plan-2026-10-06.md` | Note Family 1, D2, D3, half of D1 and order-of-work step 4 as resolved by retirement. |
| Docs | `docs/audit/documents-endpoint-scope-2026-10-06.md` | Historical; at most a one-line "resolved by retirement" note. |
| Docs | `docs/audit/fe-be-contract-2026-10-05.md` (:180-181, D13), `admin-integrity-2026-10-03.md` (:114-115) | Historical dated audits; leave as is. |

No file is deleted outright; every change is a removal inside an existing file.

### 5.2 Prisma model retirement

**Now: nothing changes in `prisma/schema.prisma`.** The `RegistrationDocument` model, the two `User` back-relations and the `registration_documents` table all stay. Prisma client generation is unaffected by an unused model, and leaving it costs nothing at runtime.

**Later, a separate Phase-6-style drop task:**
1. Remove `model RegistrationDocument` (`schema.prisma:212-237`, including its comment).
2. Remove `User.registrationDocuments` and `User.verifiedDocuments` (`schema.prisma:181-182`).
3. New migration: `DROP TABLE "registration_documents"` (its two indexes and two FKs go with it).

**Why it waits.** CLAUDE.md §21 requires explicit human review for database schema changes, and §6 and `.claude/rules/architecture.md` treat Prisma changes as high-risk. A drop migration is also irreversible for any rows present, and per project memory a migration pushed to master is applied on deploy by Render's `build.sh`, so it cannot ride along with a code-only change. Splitting it out keeps the code removal small and reversible.

**Consequence of waiting.** Until the drop, existing rows keep blocking `DELETE /auth/users/:id` for their registrants (409 via the P2003 mapping, Step 2.5). With the write path gone, no new blocking rows can appear. The drop task should count existing rows first.

**`UserStatus.DOCUMENTS_INCOMPLETE` is out of scope.** It is a separate enum value (migration `20260930120000_add_user_status_registration_values`), has no writer, and is still read by `src/dsmo/dsmo.service.ts:169` (`getCompanyStats` pending bucket) and covered by `src/pilotage/pilotage-coverage.spec.ts:95`. Removing a Postgres enum value is itself a schema change; if it is ever retired, that is its own decision.

### 5.3 Tests referencing the removed code

None, backend or frontend. `active-company.completeness.spec.ts` enumerates handlers dynamically and is unaffected (Step 3.4). The removal change should be verified with the backend suite (`jest --runInBand`) and the react-web type check and tests, all of which are expected to pass unchanged.

### 5.4 Consumers needing a replacement

None. No export, PDF, analytics, approval check, dashboard or Flutter screen reads `registration_documents` or the two endpoints. Document state never gated approval. The verification-row panel in the redesign replaces the UI concept (a reviewer confirming facts about the file), not this data, which has no meaning to migrate: every row is a tick against a file that was never received.
