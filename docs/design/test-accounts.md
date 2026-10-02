# Test Accounts Flagging & Exclusions Design Document

> **Status: DEFERRED TO PRE-PILOT**  
> We are currently in active development; all existing live database entries are test data. This design and implementation plan will be executed during the pre-pilot hardening phase prior to real enterprise onboarding.

---

## 1. Overview & Context

During development and pre-pilot testing, test company accounts and submissions are created by developers, QA, and administrators to validate questionnaires, multi-site structures, workflows, and pilotage targets.

To prevent test accounts from skewing official labour statistics, territorial coverage metrics, and campaign quotas, a formal flag **`Company.isTestAccount`** will be introduced along with a transactional management script and query-level exclusions across all reporting and aggregation engines.

### 1.1 Accounts to Keep Active (Excluded from Deactivation)
The following four test accounts are designated to remain permanently active for ongoing testing, demonstrations, and QA validation:
1. **`Super coop`**
2. **`Tata Coops`**
3. **`Ets Tata`**
4. **`wee`**

All other test accounts will be flagged (`isTestAccount = true`) and optionally deactivated (`isActive = false`).

---

## 2. Database Schema Migration

### 2.1 Prisma Schema Change
Add `isTestAccount` to `model Company` in [`prisma/schema.prisma`](file:///c:/Users/win/dsmo_app/prisma/schema.prisma):
```prisma
model Company {
  id                         String                  @id @default(uuid())
  ...
  isTestAccount              Boolean                 @default(false)
  establishmentId            String?
  ...
}
```

### 2.2 SQL Migration
- **Timestamp & Directory**: `prisma/migrations/20261002180000_add_company_is_test_account/migration.sql`
- **Ordering Constraint**: Timestamp must be strictly **AFTER** `20261002160000` (to maintain sequential ordering after the quota agent's unique-index migration).
- **SQL DDL**:
  ```sql
  -- AlterTable
  ALTER TABLE "companies" ADD COLUMN "isTestAccount" BOOLEAN NOT NULL DEFAULT false;
  ```
- **Commit Note**: Must state: `Depends on migration 20261002160000 (quota agent's unique-index migration).`

---

## 3. Data Flagging Script: `scripts/flag-test-companies.ts`

Follows the transactional safety pattern established by `scripts/archive-legacy-t3-campaigns.ts` and `scripts/backfill-submission-campaign-ids.ts`.

### 3.1 CLI Arguments & Validation
- `--actor-email=<email>`: **Required**.
  - Must exist in the database.
  - Must be `isActive: true` with `status: 'ACTIVE'`.
  - Role must be in `['SUPER_ADMIN', 'SUPER_ADMIN_ONEFOP']`.
- `--flag-ids=<id1,id2,...>`: Comma-separated list of Company IDs to mark `isTestAccount = true`.
- `--deactivate-ids=<id1,id2,...>`: Comma-separated list of Company IDs whose associated User accounts will additionally be set to `isActive = false`.
- `--apply`: Execution flag. Default (omitted) = **DRY-RUN** (prints identified companies, users, current statuses, and planned mutations; modifies nothing).

### 3.2 Invariants & Execution Guarantees
1. **Single Prisma Transaction**: All updates and audit records run within `prisma.$transaction`.
2. **Idempotency**: Re-checks each company and user inside the transaction; skips any record where `isTestAccount` is already `true` or `isActive` is already `false`.
3. **Audit Logging**: For each applied mutation:
   - Company flag: `AuditLog` row with `action: 'COMPANY_FLAG_TEST_ACCOUNT'`, `resourceType: 'Company'`, `resourceId: company.id`, `userId: actor.id`, `previousValue: 'false'`, `newValue: 'true'`.
   - User deactivation: `AuditLog` row with `action: 'USER_DEACTIVATE'`, `resourceType: 'User'`, `resourceId: user.id`, `userId: actor.id`, `previousValue: 'true'`, `newValue: 'false'`.
4. **No Deletes**: Never deletes any company, submission, user, or reference data.

---

## 4. System Exclusions (`isTestAccount = false`)

### 4.1 Pilotage Coverage (Stock Counts)
- **File**: [`src/pilotage/pilotage.service.ts`](file:///c:/Users/win/dsmo_app/src/pilotage/pilotage.service.ts)
  - In `companyWhere(scope)` (L488):
    ```typescript
    function companyWhere(scope: TargetScope): Record<string, unknown> {
      const base = { isTestAccount: false };
      if (scope.kind === 'region') return { ...base, regionId: scope.regionId };
      if (scope.kind === 'department') return { ...base, departmentId: scope.departmentId };
      return base;
    }
    ```
  - In `company.findMany` select (L126): include `isTestAccount: true`.
- **File**: [`src/pilotage/pilotage-coverage.ts`](file:///c:/Users/win/dsmo_app/src/pilotage/pilotage-coverage.ts)
  - Add `isTestAccount?: boolean` to `CompanyStockRow`.
  - In `isRegistered(row)`: require `!row.isTestAccount`.
  - In `applyRow(counts, row, year)`: add defensive guard `if (row.isTestAccount) return;` so test accounts never count toward `registered`, `registeredInYear`, `pendingApproval`, `pendingReview`, or `complementsRequested`.

### 4.2 Planned T.3 Endpoint (Campaign Returns vs. Quotas)
- **File**: [`docs/design/t3-returns-vs-quotas.md`](file:///c:/Users/win/dsmo_app/docs/design/t3-returns-vs-quotas.md)
  - Test accounts (`Company.isTestAccount = true`) are strictly excluded from:
    1. **Denominator** (`registeredStock`): `where: { isTestAccount: false }`.
    2. **Numerator** (`received`, `onTime`, `late`, `approved`): `where: { company: { isTestAccount: false } }`.

### 4.3 ONEFOP Statistical & SPSS Exports
- **File**: [`src/data-management/spss/export-filters.ts`](file:///c:/Users/win/dsmo_app/src/data-management/spss/export-filters.ts)
  - In `buildOnefopExportWhere(filters, eligibilityWhere)` (L47):
    ```typescript
    where.company = { isTestAccount: false };
    ```
  - Guarantees that SPSS (.sav), CSV, syntax, and Excel exports never contain test account submissions.

### 4.4 Note for Quota Agent: R.1 Backfill Script Candidate Query
> **Do not edit on this branch — for coordination with the quota agent on branch `feat/registration-approval`:**
- **File**: `scripts/backfill-company-establishment-ids.ts`
- **Current Candidate Query** (L80–87):
  ```typescript
  const rows = await prisma.company.findMany({
    where: {
      establishmentId: null,
      user: { role: 'COMPANY', status: 'ACTIVE' },
    },
    ...
  });
  ```
- **Required Update**: Add `isTestAccount: false` to the `where` clause:
  ```typescript
  where: {
    isTestAccount: false,
    establishmentId: null,
    user: { role: 'COMPANY', status: 'ACTIVE' },
  }
  ```
  *(Prevents minting official establishment IDs for test accounts during registration backfill).*

---

## 5. Verification & Test Plan

1. **Pilotage Coverage Tests**:
   - In `src/pilotage/pilotage-coverage.spec.ts`:
     - Assert `isRegistered(row({ isTestAccount: true })) === false`.
     - Assert `applyRow(counts, row({ isTestAccount: true }), 2026)` leaves all counters at `0`.
   - In `src/pilotage/pilotage.service.spec.ts`:
     - Assert `harness.prisma.company.findMany` is called with `where: expect.objectContaining({ isTestAccount: false })`.
2. **Export Filters Tests**:
   - In `src/data-management/spss/export-filters.spec.ts`:
     - Assert `buildOnefopExportWhere({}, ELIGIBLE)` contains `company: { isTestAccount: false }`.
3. **Full Regression**:
   - Run `npx jest` to verify 729/729 tests remain green.
   - Run `npx tsc --noEmit` on backend.
