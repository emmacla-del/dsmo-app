# Establishment ID at registration: implementation plan (2026-10-06)

Status: PLAN ONLY. No code, schema or migration was changed. No git, jest, build, prisma or database commands were run.
Input: `docs/audit/establishment-id-lifecycle-2026-10-06.md` (the survey). Section references like "survey §7.2" point there.
Line numbers were re-verified against the working tree just before this file was written. `src/auth/auth.service.ts` was being edited by another agent at the same time (document-review removal), so its line numbers may shift again. They are given with a quoted anchor so they can be found again.

Policy target: the ID is generated at registration from a sequential counter. Gaps are allowed. A number is never issued twice.

Confirmed decisions this plan follows:

| # | Decision |
|---|---|
| Q1 | Stale prefixes are accepted. A company that changes entity type keeps its original prefix. The corrected type lives in `Company.entityType`. |
| Q2 | YY is the registration year. Pilotage `registeredInYear` switches from `establishmentIdGeneratedAt` to `User.approvedAt`. |
| Q3 | Pending and rejected companies may use their ID for login and `findIdentifier`. |
| Q4 | The `-01` Establishment row stays approval-time. Only the public code moves. |
| Q5 | A Postgres sequence is in scope. |
| Q6 | Assisted registrations get an ID at creation. |
| Q7 | Five existing bugs are logged separately (see "Known bugs"), not fixed here. |

---

## STEP 1: The sequence

### 1.1 Name, and how many

**One sequence per (prefix, YY)**, named `establishment_serial_<prefix in lower case><YY>`. Examples: `establishment_serial_en26`, `establishment_serial_ad26`, `establishment_serial_vt27`.

Why not the alternatives:

| Option | Rejected because |
|---|---|
| One global sequence | The serial is 4 digits. One counter shared by 7 types and every year would hit 9999 once, permanently. It would also break the yearly restart that every existing ID follows (survey §1.1, §3). |
| One sequence per prefix (7, never reset) | Same ceiling problem: 9999 ENTREPRISE IDs for the life of the system. |
| Counter table `(prefix, year, last_serial)` updated with `UPDATE … RETURNING` | It is transactional. The row lock is held until the registration commits, so registrations of one type serialise each other (the concern in survey §7.2). A rolled-back registration also rolls the counter back, so the counter does not "advance on generation". A sequence has neither problem. |

Per (prefix, YY) keeps the current format and its semantics exactly: `{prefix 2}{YY 2}{serial 4}{suffix 2}`, with the serial restarting at 0001 each year.

Each sequence is `AS integer MINVALUE 1 MAXVALUE 9999 NO CYCLE`. The 10000th ID of a (prefix, YY) then fails with an error. It no longer produces an 11-character ID that `isValid` rejects and `slice(4,8)` misreads (survey §1.1, edge cases).

### 1.2 Where it lives

- A new migration, `prisma/migrations/20261011120000_establishment_serial_sequences/migration.sql`. The latest folder today is `20261010120000_drop_deprecated_target_tables`. Re-check before committing in case a newer one has landed.
- The migration creates **one SQL function**, `public.establishment_serial_ensure(prefix text, yy text) RETURNS text`. It returns the sequence's qualified name, and creates the sequence first if it does not exist yet.
- The migration **creates the sequences now for every (prefix, YY) that already has IDs**, so their starting points are fixed by a reviewed migration and not by the first request after deploy.
- Sequences for years not seen yet (2027 onward, or a type's first ID) are created **on first use** by the same function. No yearly migration is needed.
- Prisma does not model standalone sequences or functions. `schema.prisma` is not changed except for a comment (STEP 6).

### 1.3 How the generator reads it

Two statements, through `$queryRaw`:

1. `SELECT public.establishment_serial_ensure($prefix, $yy)`: returns the sequence name, and creates it on first use.
2. `SELECT nextval($name::regclass)`: takes the serial.

`nextval` is used, not a counter table (see 1.1).

There are two statements, not one, on purpose. When another session has just created the sequence, a single statement can still hold a stale catalog cache entry and fail with "relation does not exist". A new statement outside a transaction starts a new transaction, which picks up catalog invalidations, so the second statement always sees the sequence. Inside an interactive transaction (the approval fallback, the backfill script), that guarantee does not hold. The race there needs two first uses of the same new (prefix, YY) in the same instant, and it fails loudly with no wrong ID issued. Accepted as a residual.

### 1.4 Does the advisory lock stay?

**No.** `pg_advisory_xact_lock(hash(prefix+YY))` and `advisoryLockKey` are removed.

- `nextval` is atomic and lock-free. Two concurrent callers always get different numbers.
- First-use creation needs no lock either. Two concurrent creators collide on the `pg_class` unique index. The loser's `CREATE SEQUENCE` is caught inside the function (`duplicate_table` / `unique_violation`) and it returns the name the winner created. Both seed from the same data.
- The `companies_establishmentId_key` unique index (migration 20261002160000) stays as the database backstop.

Consequences:
- The generator no longer has to run inside `$transaction`. That docstring rule (generator.ts:26-29) and the matching one in the auto-approval docstring (auth.service.ts:940-943) go away.
- Registrations no longer serialise on a lock.
- The backfill script no longer blocks concurrent approvals for its whole run (survey §1.4).

---

## STEP 2: The migration

### 2.1 What it does

1. Creates `public.establishment_serial_ensure(text, text)`. It:
   - checks its inputs against the 7 known prefixes and two digits. The values are interpolated into DDL with `%I`, so this is defence in depth.
   - returns at once if the sequence already exists.
   - otherwise computes the seed and runs `CREATE SEQUENCE`.
2. Seeds a sequence for every (prefix, YY) that already appears in `companies` or `establishments`.
3. Revokes EXECUTE on the function from the Supabase API roles `anon` and `authenticated`, if they exist. Supabase's default privileges grant EXECUTE on new `public` functions to them, and PostgREST would expose it as an RPC that anyone could call to burn serials. It does **not** revoke from PUBLIC, because the app's runtime role may differ from the migration role (open question 8).

### 2.2 Do existing rows need to advance it?

Yes. A sequence starts at **MAX(serial ever issued for that (prefix, YY)) + 1**. That maximum is taken over three sources:

| Source | Why |
|---|---|
| `companies."establishmentId"` | The live IDs. |
| `left(establishments.code, 10)` | The principal site code repeats the company code. |
| `audit_logs.details->>'establishmentId'` for actions `COMPANY_REGISTRATION_APPROVED`, `COMPANY_REGISTRATION_AUTO_APPROVED` and `COMPANY_ESTABLISHMENT_ID_BACKFILLED` | Every ID issued so far was audited at issuance (auth.service.ts:1019, :1636; backfill script :318). Migration `20261004130000_remove_pending_subdivisions` deleted a company and its establishment by raw SQL, so its code survives only here. Including the audit rows keeps that number from being issued again. `audit_logs.details` is JSONB since `20261001160000_capture_untracked_schema`. |

Only values matching `^{prefix}{YY}[0-9]{6}$` count. A malformed legacy value cannot produce `NaN` the way `parseInt` can today (survey §1.1).

The same seed query runs on first use, so a (prefix, YY) that first appears after deploy is also seeded correctly. That covers, for example, old code writing during the deploy window.

### 2.3 The SQL

Follows the repo style: a prose header explaining why, the Prisma-style `-- CreateX` markers, `public.` qualification as in `20261005120000_role_model_refactor`, no `IF EXISTS` on objects this migration owns, and no "NOT applied" line (pushing to master applies it through `build.sh`).

```sql
-- Establishment ID serials move from MAX()+1 to Postgres sequences.
--
-- Policy: an establishment ID is generated at registration from a
-- sequential counter. Gaps are allowed; a number is never issued twice.
-- MAX()+1 over companies could not hold that: a rolled-back allocation was
-- re-issued, and deleting the top row (as 20261004130000 did by raw SQL)
-- made its number available again.
--
-- One sequence per (prefix, two-digit year), named
-- establishment_serial_<prefix lower><yy>, e.g. establishment_serial_en26.
-- The format does not change: {prefix}{yy}{serial 4}{subdivision suffix 2},
-- and the serial still restarts each year. MAXVALUE 9999 NO CYCLE, so the
-- 10000th ID of a (prefix, year) fails loudly instead of producing an
-- 11-character code.
--
-- Sequences for a (prefix, year) not seen yet are created on first use by
-- establishment_serial_ensure(), so no yearly migration is needed. The seed
-- is the highest serial ever recorded for that pair in companies,
-- establishments or the issuance audit rows, so a number whose company row
-- was later deleted is still not reissued. nextval() never rolls back, so a
-- registration that fails after taking a number leaves a gap, as intended.
--
-- No advisory lock: nextval() is atomic, and two concurrent first uses
-- collide on pg_class's unique index; the loser's CREATE is caught below.
--
-- Supersedes the allocation notes in
-- 20261002160000_unique_company_establishment_id (advisory lock, "companies
-- awaiting approval are unaffected"). That file is applied and is not
-- edited.

-- CreateFunction
CREATE FUNCTION public.establishment_serial_ensure(p_prefix text, p_yy text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_seq  text;
    v_last integer;
BEGIN
    IF p_prefix IS NULL OR p_prefix !~ '^(EN|CO|CT|ON|AD|PP|VT)$' THEN
        RAISE EXCEPTION 'establishment_serial_ensure: unknown prefix %', p_prefix;
    END IF;
    IF p_yy IS NULL OR p_yy !~ '^[0-9]{2}$' THEN
        RAISE EXCEPTION 'establishment_serial_ensure: invalid year %', p_yy;
    END IF;

    v_seq := 'establishment_serial_' || lower(p_prefix) || p_yy;
    IF to_regclass('public.' || v_seq) IS NOT NULL THEN
        RETURN 'public.' || v_seq;
    END IF;

    SELECT COALESCE(MAX(substring(issued.code FROM 5 FOR 4)::integer), 0)
      INTO v_last
      FROM (
            SELECT c."establishmentId" AS code FROM companies c
            UNION ALL
            SELECT left(e.code, 10) FROM establishments e
            UNION ALL
            SELECT a.details ->> 'establishmentId'
              FROM audit_logs a
             WHERE a.action IN ('COMPANY_REGISTRATION_APPROVED',
                                'COMPANY_REGISTRATION_AUTO_APPROVED',
                                'COMPANY_ESTABLISHMENT_ID_BACKFILLED')
           ) issued
     WHERE issued.code ~ ('^' || p_prefix || p_yy || '[0-9]{6}$');

    BEGIN
        EXECUTE format(
            'CREATE SEQUENCE public.%I AS integer MINVALUE 1 MAXVALUE 9999 START WITH %s NO CYCLE',
            v_seq, v_last + 1);
    EXCEPTION
        WHEN duplicate_table OR unique_violation THEN
            -- A concurrent first use created it, seeded from the same data.
            NULL;
    END;
    RETURN 'public.' || v_seq;
END;
$$;

-- Seed: create the sequence of every (prefix, year) that already has IDs,
-- so its starting point is fixed here rather than by the first request
-- after deploy.
DO $$
DECLARE
    k record;
BEGIN
    FOR k IN
        SELECT DISTINCT substring(code FROM 1 FOR 2) AS prefix,
                        substring(code FROM 3 FOR 2) AS yy
          FROM (
                SELECT "establishmentId" AS code FROM companies
                UNION ALL
                SELECT left(code, 10) FROM establishments
               ) existing
         WHERE code ~ '^(EN|CO|CT|ON|AD|PP|VT)[0-9]{8}$'
    LOOP
        PERFORM public.establishment_serial_ensure(k.prefix, k.yy);
    END LOOP;
END;
$$;

-- Keep the function off the Supabase REST API: default privileges grant
-- EXECUTE on new public functions to these roles, and an RPC that anyone
-- can call would burn serials. Guarded so a plain Postgres without the
-- Supabase roles (local, shadow database) still migrates.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.establishment_serial_ensure(text, text) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.establishment_serial_ensure(text, text) FROM authenticated;
    END IF;
END;
$$;
```

Things to verify before merge (none of them run here):
- Run it on a scratch database or a Supabase branch. Then check `SELECT last_value, is_called FROM establishment_serial_en26` against `SELECT max(substring("establishmentId",5,4)) FROM companies WHERE "establishmentId" LIKE 'EN26%'`.
- Run `scripts/sql/find-duplicate-establishment-ids.sql` first, as the 20261002160000 header asks.
- Rollback, if needed: a follow-up migration with `DROP FUNCTION public.establishment_serial_ensure(text, text)` and one `DROP SEQUENCE` per `establishment_serial_%` relation. The old MAX()+1 generator would then work again unchanged.

---

## STEP 3: The generator rewrite

### 3.1 Current generator (`src/common/utils/establishment-id.generator.ts`, verified 2026-10-06)

```ts
// src/common/utils/establishment-id.generator.ts
import { Prisma } from '@prisma/client';

/** PrismaService and a $transaction client both expose these. */
type IdClient = {
  company: { findFirst: (args: unknown) => Promise<{ establishmentId: string | null } | null> };
  $executeRaw: (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<unknown>;
};

export class EstablishmentIdGenerator {
    private static readonly ENTITY_PREFIX: Record<string, string> = {
        'ENTREPRISE': 'EN',
        'COOPERATIVE': 'CO',
        'CTD': 'CT',
        'ONG': 'ON',
        'ADMINISTRATION': 'AD',
        'PROJECT_PROGRAM': 'PP',
        'VOCATIONAL_TRAINING': 'VT',
    };

    /**
     * Generate compact establishment ID
     * Format: {prefix}{yearLast2}{serial}{subdivCode}
     * Example: EN26000112 (Enterprise, 2026, serial 1, subdiv 12)
     *
     * Must only be called inside prisma.$transaction(...).
     * pg_advisory_xact_lock is held until COMMIT/ROLLBACK; outside a
     * transaction PostgreSQL releases it at the end of the statement and
     * concurrent serial allocation is not serialised.
     */
    static async generate(
        prisma: IdClient,
        entityType: string,
        subdivisionCode: string,
    ): Promise<string> {
        const prefix = this.ENTITY_PREFIX[entityType.toUpperCase()];
        if (!prefix) {
            throw new Error(`Unknown entity type: ${entityType}`);
        }

        const yearLast2 = new Date().getFullYear().toString().slice(-2);
        const lockKey = this.advisoryLockKey(prefix, yearLast2);
        await prisma.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

        // Get next serial number for this entity type and year
        const lastEstablishment = await prisma.company.findFirst({
            where: {
                establishmentId: { startsWith: `${prefix}${yearLast2}` }
            },
            orderBy: { establishmentId: 'desc' }
        });

        let nextSerial = 1;
        if (lastEstablishment?.establishmentId) {
            const lastSerial = parseInt(lastEstablishment.establishmentId.slice(4, 8));
            nextSerial = lastSerial + 1;
        }

        const serial = nextSerial.toString().padStart(4, '0');
        const subdivCode = subdivisionCode.padStart(2, '0').slice(0, 2);

        return `${prefix}${yearLast2}${serial}${subdivCode}`;
    }

    // isValid (lines 65-71) and parse (lines 73-107): unchanged by this plan.

    /** Stable signed 32-bit key for pg_advisory_xact_lock (prefix + year). */
    static advisoryLockKey(prefix: string, yearLast2: string): number {
        const text = `${prefix}${yearLast2}`;
        let hash = 0;
        for (let i = 0; i < text.length; i += 1) {
            hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
        }
        return hash;
    }
}
```

### 3.2 Shape of the new version

- **Same signature:** `static generate(client, entityType: string, subdivisionCode: string): Promise<string>`. All three callers (auth.service.ts:983, :1602 and the backfill script :272), plus the new registration call, pass the same arguments.
- **`IdClient` narrows** to `{ $queryRaw }`. Both `PrismaService` and a `$transaction` client expose it. `company.findFirst` and `$executeRaw` are no longer used.
- **Order inside `generate`:**
  1. Look up the prefix and throw on an unknown type **before any database call**. That preserves the "unknown type touches nothing" behaviour the spec asserts.
  2. Compute YY.
  3. `ensure` (statement 1).
  4. `nextval` (statement 2).
  5. Pad the serial to 4 digits and append the suffix.
- **Exhaustion:** `nextval` raising "reached maximum value" (SQLSTATE 2200H) should surface as a clear error, not a raw driver error. The exact HTTP mapping is open question 7.
- **Removed:**
  - `advisoryLockKey`. Its only caller is `generate`; the spec does not use it.
  - The "Must only be called inside `$transaction`" docstring. It is now safe both outside and inside one.
- **Unchanged:** `ENTITY_PREFIX`, `isValid` and `parse`.

### 3.3 Where the year and prefix come from

- **Prefix:** unchanged. `ENTITY_PREFIX[entityType.toUpperCase()]`, from `companyData.entityType` at registration. The 7 types are mapped. `VOCATIONAL_TRAINING_CENTER` (deprecated enum value, schema.prisma:2008-2014) and any free-text value still throw. Note that `RegisterCompanyDto.entityType` is `@IsOptional() @IsString()` (register-company.dto.ts:50), so registration must validate the type **before** calling the generator (STEP 4.1, open question 1).
- **Year:** `new Date().getFullYear()`, evaluated at registration, so YY is the registration year (Q2). It stays in server time, which is UTC on Render. Pilotage counts years on Africa/Douala time (pilotage-coverage.ts:46). Whether YY should use Douala time is open question 4.

### 3.4 Does the subdivision suffix stay?

Yes. The format, and therefore `isValid`, `parse`, the Flutter hint `EN26000112`, every stored ID and every `-01` code, are unchanged. The suffix is still `subdivision.code.slice(-2)`. It now reflects the subdivision at registration. If a resubmission corrects the territory, the suffix goes stale, the same way Q1 accepts for the prefix (open question 3 asks for an explicit yes).

---

## STEP 4: The call sites

### 4.1 Registration: `createCompanyRegistration` (auth.service.ts:629-802)

**Generate before `company.create`, and pass the ID into `company.create`'s data. No follow-up update.**

1. After the existing pre-checks (email at :646, taxNumber at :660, territory at :672-683) and before `user.create` (:698), add two checks:
   - **Entity type is one of the 7 prefixed types.** Otherwise 400, before any write (open question 1).
   - **The resolved subdivision has a code.** `resolveAndValidateTerritory` returns ids and names but not `Subdivision.code`, so this needs a `subdivision.findUnique` on `resolvedTerritory.subdivisionId`. Otherwise 400 with the existing text "Code d'arrondissement introuvable pour cet établissement." (today's approval-time message, :1597).
2. Call `EstablishmentIdGenerator.generate(this.prisma, entityType, code.slice(-2))`. Outside any transaction: none is needed any more (STEP 1.4).
3. `company.create` (:716) gets `establishmentId` and `establishmentIdGeneratedAt: new Date()`.

Why this order:
- There is never a window where a Company exists without an ID.
- No transaction has to be added around `user.create` and `company.create`. They are still two unwrapped statements; that is an existing risk, unchanged and out of scope.
- Requests that fail the cheap pre-checks do not burn a serial.

A failure after `nextval` (an email or taxNumber race that becomes P2002 at :797) leaves a gap. The policy allows that.

Other edits in this function:
- `autoApprove` (:687-690) is unchanged.
- The return at :795 becomes `establishmentId: company.establishmentId` instead of `autoApprovedEstablishmentId`, so both `registerCompany` (:824) and `adminRegisterCompany` (:920) return the ID for every file (Q6).
- The `-01` Establishment is **not** created here (Q4). Approval's `establishment.create` would otherwise hit the principal unique index (survey §7.2).

### 4.2 Auto-approval: `autoApproveRegistration` (auth.service.ts:945-1035)

**Reads what registration generated.** The `company` argument is the row returned by `company.create`, so `company.establishmentId` is set. The existing `if (!issued)` guard (:981-988) then skips generation, and the transaction does only:
- create the `-01` Establishment,
- set the user ACTIVE,
- write the audit row (which still records `establishmentId: issued`).

- **Keep the guard as is.** It costs nothing and keeps the function correct if ever called with a null-ID row.
- **Keep the subdivision-code lookup** (:973-980). It only feeds the fallback; removing it is cleanup, not required.
- **Keep the P2002 retry** (:1027-1034). In the normal path a P2002 can now only come from `establishments_code_key` or the principal index, where a retry does not help. It is harmless. The misleading "pour ce territoire" text is existing behaviour and not changed here.
- **Update the docstring** at :928-944 (STEP 6).
- **Auto-approval failure:** it still leaves a PENDING_APPROVAL file, but now with an ID. Staff approval then reuses it.

### 4.3 Staff approval: `approveCompanyRegistration` (auth.service.ts:1557-1663)

**The `if (!issued)` guard (:1600-1607) stays.** In the normal path it is now always false: approval only creates `-01`, flips ACTIVE and audits.

The guard is still needed for **legacy files** that were PENDING_APPROVAL, COMPLEMENTS_REQUESTED or otherwise null-ID when this ships. They get their ID at approval through the same generator, now sequence-backed. Their YY is the approval year, not the registration year, unless the backfill is extended (4.4, open question 5).

The pre-transaction checks are unchanged:
- entityType non-null (:1569)
- the ADMINISTRATION confirmation (:1578)
- subdivisionId non-null (:1583)

The in-transaction subdivision-code check (:1592-1598) also stays. For new files it is redundant (registration already checked), but it guards legacy files and the `-01` row's territory.

Q1: no prefix-versus-entityType check is added. A company corrected from ENTREPRISE to COOPERATIVE is approved with its `EN…` ID.

### 4.4 Backfill script: `scripts/backfill-company-establishment-ids.ts`

**It stays.** It is the only path for legacy ACTIVE companies with a null ID (the "29-company case", active-company.guard.ts:49). Changes:

- **Header (:1-40).** Rewrite:
  - "those get their ID from the normal approval path" becomes: new files get theirs at registration; legacy pending files get theirs at approval.
  - The `pg_advisory_xact_lock` sentence becomes: allocation is by sequence, and a rolled-back `--apply` leaves gaps.
- **Allocation code (:255-330).** No change. It already calls `EstablishmentIdGenerator.generate(tx, …)`, which keeps working inside the transaction.
- **The `TRANSACTION_OPTIONS` rationale (:47-50)** still holds for the writes. The lock-blocking side effect (survey §1.4) disappears.
- **Targets (:135-139).** Unchanged by default (ACTIVE only). Extending them to legacy PENDING_APPROVAL, COMPLEMENTS_REQUESTED and REJECTED rows is open question 5. If extended:
  - The audit action and the "NEVER touches" list change.
  - The `-01` Establishment must **not** be created for non-ACTIVE rows (Q4).
- **Dry run.** The existing note already says IDs are not predicted, which stays true. `nextval` must not be called in dry-run mode, and it is not.

---

## STEP 5: Effects

| # | Surface | Today | After | Code change needed? |
|---|---|---|---|---|
| 1 | React receipt, `react-web/src/app/register/page.tsx:1020-1041` | ID row shown only if `result.establishmentId` | Shown for every new file | **None for the ID row.** The existing heading "Attestation officielle d'enregistrement…" and status row "Enregistré / Compte opérationnel" (:1045-1049) are now more misleading, because a pending file shows an official-looking ID beside them. That is a UX decision (open question 11), not a backend change. |
| 2 | Flutter receipt, `lib/screens/register_screen.dart:529-560` | Branches on `establishmentId != null`; the pending dialog is the live path | Always takes the `RegistrationReceipt` branch. The pending-review dialog becomes unreachable, and the receipt note (app_fr.arb:213) promises ONEFOP access a pending account does not have. | **Yes (Flutter).** Branch on the returned user status (ACTIVE versus not) instead of the ID, and show the ID in the pending dialog. The user commits Flutter changes themselves. |
| 3 | Flutter home gate, `lib/screens/home_screen.dart:562-572` ("ID établissement manquant") | Blocks ONEFOP for null-ID companies | Never fires for new files. Still fires for legacy ACTIVE null-ID rows until they are backfilled. | None. Keep as a defensive check. |
| 4 | `findIdentifier`, auth.service.ts:1043-1073 | 400 "Identifiant non disponible…" for pending files | Returns the ID for every new file, pending and rejected included (Q3). The null branch (:1063-1067) stays for legacy rows. | None. Add a test (STEP 7). |
| 5 | `validateUser`, auth.service.ts:186-195 | ID login impossible for pending files (no ID) | Login by ID works for pending files (`PENDING_APPROVAL` COMPANY passes, :230-236). A rejected company's ID resolves to its user, who gets `REGISTRATION_REJECTED_LOGIN_MESSAGE` after the password check (:242-244). That is accepted under Q3. On the web this is still blocked by the `type="email"` login input (Known bug 4). | None. |
| 6 | Pilotage, `src/pilotage/pilotage-coverage.ts:66-68`; `pilotage.service.ts:200-215`, :361-372, :966-985 | `registeredAt = establishmentIdGeneratedAt ?? createdAt` | `registeredAt = user.approvedAt ?? establishmentIdGeneratedAt ?? createdAt` (Q2; fallback chain is open question 6) | **Yes:** add `approvedAt` to `CompanyStockRow` (:1-11), select `user: { status, isActive, approvedAt }` at both `company.findMany` sites, and map it in `toStockRow`. `isRegistered` (:62-64) is unchanged, so the stock counts do not move. |

Why that fallback chain for pilotage: `users.approvedAt` was added in `20260930120100_add_user_registration_fields` with no backfill, so companies activated before 2026-09-30 have it null. For those rows `establishmentIdGeneratedAt` was set at approval or by the backfill, which is today's value. Keeping it as the middle fallback means legacy rows count in exactly the year they count in today. New rows always have `approvedAt`, because both approval paths set it (auth.service.ts:1009, :1628).

Other effects, with no code change:
- `/admin/etablissement-detail` can now open new pending files: the ID is searchable (survey §8.6).
- `/admin/etablissements` (`c.establishmentId || c.id`) and `CompaniesDirectory` (`—` when null) keep their fallbacks for legacy rows.
- `getMyCompany` (`dsmo.service.ts:66-77`) now returns `establishmentIdGeneratedAt` as the registration time. Nothing reads it as an approval time except pilotage, which is switched above.
- The attestation, the approval email, SYS_08, reports, campaign sync and eligibility, `ActiveCompanyGuard`, and the ONEFOP submission path (which needs the `-01` row, still approval-time) are not affected (survey §8.8).
- The assisted-registration result page (`react-web/src/app/admin/inscriptions/nouvelle/page.tsx:346-352`) now receives an ID. Showing it is optional frontend work (open question 13).

---

## STEP 6: Comments and docs to update (lines re-verified 2026-10-06)

| File:line | Current text (anchor) | Change |
|---|---|---|
| `prisma/schema.prisma:303-307` | "Allocation is serialised by pg_advisory_xact_lock … companies still awaiting approval are unaffected." | Comment only: allocation by per-(prefix, year) sequence; generated at registration; null only for legacy rows. No migration impact. |
| `src/auth/auth.service.ts:685-686` | "Establishment IDs are issued at staff approval, except for…" | Issued here, at registration, for every file. |
| `src/auth/auth.service.ts:772-774` | "Auto-approval: activate the account and allocate its establishment ID…" | The ID already exists; auto-approval creates `-01` and activates. |
| `src/auth/auth.service.ts:928-944` | autoApproveRegistration docstring, "allocates its establishment ID", "EstablishmentIdGenerator takes a pg advisory lock…" | Drop the allocation and lock text; describe the guard as a legacy fallback. |
| `src/auth/auth.service.ts:1246-1252` (survey had :1336-1339; shifted by the concurrent edit) | "so establishmentId stays unreachable: it is issued by a reviewer at approval." | "…it is generated at registration and is permanent." The allowlist itself is unchanged. |
| `src/auth/auth.service.ts:1576-1577` (survey :1666) | "Checked before the transaction, so a refusal issues no establishment ID and writes no audit row." | "…a refusal creates no Establishment and writes no audit row." |
| `src/auth/auth.service.ts:1642-1644` | "the approval and the establishment ID are already durable" | Minor: "the approval is already durable". |
| `src/common/utils/establishment-id.generator.ts:21-30` | Docstring: "Must only be called inside prisma.$transaction(...)…" | Replace with the sequence description (part of STEP 3). |
| `react-web/src/lib/inscriptions.ts:85` (survey :86) | "/** null until a reviewer approves the file — assisted ones always queue. */" | Generated at registration; null only for legacy files. Frontend file. |
| `lib/screens/register_screen.dart:549-552` (survey :548) | "R.1: no establishment ID is issued at self-registration any more…" | Rewritten with the branch change (STEP 5 #2). Flutter; the user commits it. |
| `scripts/backfill-company-establishment-ids.ts:1-40` | Header: "get their ID from the normal approval path", "pg_advisory_xact_lock on (prefix, year)" | See STEP 4.4. |
| `prisma/migrations/20261002160000_unique_company_establishment_id/migration.sql:1-17` | "Allocation is serialised … pg_advisory_xact_lock", "companies awaiting approval … are unaffected" | **Do not edit.** It is applied, and Prisma checksums applied migrations (`migrate dev` would demand a reset). The new migration's header records that it supersedes these notes. |
| `src/auth/active-company.guard.ts:49` | "29 active companies have none until R.1's backfill" | Leave. Still true for legacy rows. |

---

## STEP 7: Tests

No jest test in `src/` runs against a real Postgres (all Prisma clients are mocked), so the migration SQL and `establishment_serial_ensure` cannot be covered by jest. They need the manual verification in STEP 2.3. Per project memory, `jest --runInBand` is the authoritative run.

| Spec | Change |
|---|---|
| `src/common/utils/establishment-id.generator.spec.ts` | Rewrite the mock client (:20-24: `company.findFirst`, `$executeRaw`) to a `$queryRaw` mock that returns the sequence name, then a serial. Assert: ensure is called with the prefix and current YY, then nextval; serial 1 gives `0001`, 9999 gives `9999`; the suffix is the two-digit pad/slice; an unknown type throws **before** `$queryRaw` (replaces :67); `VOCATIONAL_TRAINING_CENTER` throws. The `isValid` and `parse` blocks (:88-140) are unchanged. |
| `src/auth/auth.registration-approval.spec.ts` | The fixtures `establishmentId: null` at :30 and :363 stay, and now mean "legacy pending file". The mocks at :82 and :383 need `$queryRaw` in place of, or in addition to, `$executeRaw`, because the fallback still generates. Tests :94-110, :138-150 and :184-194 then keep asserting a generated `EN…12`, `EN…01` or `AD…12`. **Add:** a file that already holds `EN26000712` approves without calling the generator and without `company.update`, and creates `code: 'EN26000712-01'`. **Reword** the comment at :176-177 ("Refused before the transaction: no establishment ID…") to "…no Establishment, no audit row"; its assertions (:178-181) stay valid. The retry test (:214-225) is unchanged. |
| `src/auth/assisted-registration.spec.ts` | `makePrisma` (:20-57) needs `subdivision.findUnique` returning a code and `$queryRaw`. **Fixture bug to fix:** `body()` sends `entityType: 'ENTERPRISE'` (:87), which is not a prefixed type. Under registration-time generation it would fail (400 or a generator throw); it must become `'ENTREPRISE'`. :121-133: reword the comment (auto-approval would have activated the account; the ID is now allocated anyway, per Q6), keep the not-ACTIVE assertions, and add `company.create` data `establishmentId` matching `/^AD\d{8}$/` and `result.company.establishmentId` defined. :195-201 (`registerCompany`): assert `result.company.establishmentId` is set. |
| **New:** `createCompanyRegistration` cases (in assisted-registration.spec.ts or a new `auth.registration-id.spec.ts`) | The generator is called before `user.create`. An unknown or missing entityType gives 400 with no `user.create`, `company.create` or `$queryRaw` (if open question 1 resolves that way). A subdivision with no code gives 400 with no writes. Public ADMINISTRATION auto-approval: the ID is generated once at registration, `autoApproveRegistration` does not call the generator again, and `-01` uses that ID. The survey (§6) notes there is no auto-approval test today. |
| **New:** `findIdentifier` | No spec exists today. Cover: a pending company with an ID gets it back; a legacy null-ID company gets the 400. |
| `src/pilotage/pilotage-coverage.spec.ts:19`, :74-81, :88 | Add `approvedAt` to `row()`. Rename and extend the fallback test: `approvedAt` wins; null `approvedAt` falls back to `establishmentIdGeneratedAt`, then to `createdAt`. Add a case for registration in December and approval in January, counted in the approval year. |
| `src/pilotage/pilotage.service.spec.ts:418`, :516, :1005 | Company fixtures gain `user.approvedAt`. Check the expected `registeredInYear` values still hold. |
| `src/scripts/backfill-company-establishment-ids.spec.ts` | `generate` is mocked (:68), so no change unless the targets change (open question 5). Then :15 and :181, and a new non-ACTIVE "no `-01`" case. |
| Unchanged, re-run | `auth.registration-resubmission.spec.ts:25-28` (establishmentId still not correctable), `active-company.guard.spec.ts:74-80`, `active-company.integration.spec.ts:280`, :357, `dsmo.service.spec.ts:71`. |

---

## STEP 8: Report

### 8.1 Every file that changes

**Backend (src/, prisma/, scripts/)**

| File | Change |
|---|---|
| `prisma/migrations/20261011120000_establishment_serial_sequences/migration.sql` (new) | Creates `establishment_serial_ensure`, seeds sequences for existing (prefix, YY) pairs, revokes the function from Supabase API roles. |
| `src/common/utils/establishment-id.generator.ts` | Allocation by ensure + `nextval`; drops MAX()+1, the advisory lock and `advisoryLockKey`; same signature and format. |
| `src/auth/auth.service.ts` | `createCompanyRegistration`: entityType and subdivision-code checks, then generation before `company.create`; return the ID always. Comments and docstrings per STEP 6. `autoApproveRegistration` and `approveCompanyRegistration` logic unchanged (the guards stay as legacy fallback). |
| `src/pilotage/pilotage-coverage.ts` | `CompanyStockRow.approvedAt`; `registeredAt = approvedAt ?? establishmentIdGeneratedAt ?? createdAt`. |
| `src/pilotage/pilotage.service.ts` | Select `user.approvedAt` at both company queries; map it in `toStockRow`. |
| `prisma/schema.prisma` | Comment at :303-307 only. No model change, so no Prisma migration diff. |
| `scripts/backfill-company-establishment-ids.ts` | Header rewritten; targets unchanged unless open question 5 says otherwise. |
| `src/common/utils/establishment-id.generator.spec.ts` | Rewritten mocks and assertions. |
| `src/auth/auth.registration-approval.spec.ts` | Mock `$queryRaw`; new "ID already issued" approval test; one comment reworded. |
| `src/auth/assisted-registration.spec.ts` | Mock additions, `ENTERPRISE` to `ENTREPRISE`, new ID assertions, comment reworded. |
| New spec (or additions) for `createCompanyRegistration`, public auto-approval and `findIdentifier` | See STEP 7. |
| `src/pilotage/pilotage-coverage.spec.ts`, `src/pilotage/pilotage.service.spec.ts` | `approvedAt` fixtures and fallback cases. |
| `src/scripts/backfill-company-establishment-ids.spec.ts` | Only if the backfill targets change. |

**Frontend and Flutter (other owners, listed for completeness)**

| File | Change |
|---|---|
| `lib/screens/register_screen.dart` | Branch the success dialog on user status, not on the ID; rewrite the :549 comment. The user commits Flutter. |
| `react-web/src/lib/inscriptions.ts` | :85 comment. |
| `react-web/src/app/register/page.tsx` | Optional, UX decision: a status-aware heading and status row (open question 11). |
| `react-web/src/app/admin/inscriptions/nouvelle/page.tsx` | Optional: show the assisted file's ID (open question 13). |

**Not edited:** `prisma/migrations/20261002160000_unique_company_establishment_id/migration.sql` (applied).

Human approval required before implementation (CLAUDE.md §21): the migration (database change), and the registration behaviour change (an entityType becomes required at registration if open question 1 resolves that way, which changes the API contract).

### 8.2 The migration SQL

See STEP 2.3. Folder: `prisma/migrations/20261011120000_establishment_serial_sequences/`.

### 8.3 Open questions for the human

1. **Missing or unknown entityType at registration.** `RegisterCompanyDto.entityType` is optional and free text, and the deprecated `VOCATIONAL_TRAINING_CENTER` has no prefix. Recommended: 400 before any write. The alternative is to register with a null ID and let approval generate it. That contradicts "every file has an ID", and approval already refuses a null entityType.
2. **Subdivision without a code at registration.** Recommended: 400 before any write, with today's approval message. That moves the failure from approval to registration (survey §8.7). Every current subdivision is coded (20261003120000 freezes the codes), but the column is nullable.
3. **Subdivision suffix staleness.** Q1 accepts a stale prefix. Please confirm a stale suffix after a territory correction is accepted the same way.
4. **YY time zone.** Keep UTC (today's behaviour), or use Africa/Douala to match pilotage? This matters only between 00:00 and 01:00 Douala time on 1 January.
5. **Legacy null-ID files at deploy.** PENDING_APPROVAL and COMPLEMENTS_REQUESTED files currently without an ID get one at approval, with YY = the approval year. REJECTED ones never get one. Should the backfill be extended to issue IDs to these now? And with which YY: the current year, or the registration year? The latter needs an optional year argument on `generate`.
6. **Pilotage fallback chain.** Please confirm `approvedAt ?? establishmentIdGeneratedAt ?? createdAt`. It leaves legacy rows' `registeredInYear` exactly as today.
7. **Exhaustion.** The ceiling is 9999 per (prefix, YY), and abandoned public registrations now consume numbers. Is that enough for ENTREPRISE? When a sequence hits MAXVALUE, should registration return a 503 or 409 with a fixed message, or is a 500 acceptable?
8. **Database roles.** Is the runtime role (`DATABASE_URL`, pooler) the same as the migration role (`DIRECT_URL`)? Can it `CREATE` in `public`? First-use creation runs at request time, and the seeded sequences are owned by the migration role. Not verified, because `.env` was not read.
9. **Supabase API exposure.** Please confirm revoking EXECUTE from `anon` and `authenticated` is right. Should the new sequences also be revoked from those roles? PostgREST cannot call `nextval` without a function, so this is optional.
10. **Prisma drift.** Sequences created at request time (2027 onward) exist in a dev database but not in the shadow database. Check whether `prisma migrate dev` (5.22) reports drift for standalone sequences before relying on it locally. `migrate deploy` in `build.sh` does no drift check.
11. **Receipts (UX).** With every file showing an ID, should the React receipt heading and status row (register/page.tsx:1045-1049) and the Flutter receipt note (app_fr.arb:213) be made status-aware in the same release?
12. **Audit of issuance.** Self-registration writes no audit row today. Should registration-time issuance be audited, by adding `establishmentId` to `COMPANY_REGISTRATION_ASSISTED` and adding a self-registration row? That would let the ensure seed see numbers held only by files that were later deleted by SQL.
13. **Assisted result page.** Should it show the generated ID next to the email, which it currently labels "Identifiant"?

---

## Known bugs (Q7: logged here, not fixed by this plan)

These already exist and do not depend on when the ID is generated (survey §9.7).

1. **SYS_08 and the Excel export send the Establishment UUID, not the public code.**
   - SPSS SYS_08 "ID établissement" reads `submission.establishmentId` (`src/data-management/canonical-schema-adapter.service.ts:629-640`).
   - The Excel export falls back to `s.establishmentId` when the company code is missing (`src/data-management/data-management.service.ts:1277`).
   - Both carry the Establishment UUID since E.1.
2. **`getCampaignSubmissions` matches UUIDs against codes.** `src/campaign/campaign.service.ts` (~:608-618) compares `CampaignSubmission.establishmentId` (a UUID) with `Company.establishmentId` (a code), so the company enrichment never matches.
3. **`saveDraft` and `getDrafts` disagree with migrated drafts.** `src/onefop/onefop.service.ts:127-168` writes and reads the bare company code, while drafts migrated by E.1 carry `-01`. Migrated drafts are no longer visible.
4. **The React login input cannot accept an ID.** `react-web/src/app/login/page.tsx:207-216` is `type="email"` and `required`, with no `noValidate`. The ID returned by "Retrouver mon identifiant" fails HTML5 validation. After this plan this affects every company, pending ones included.
5. **`/admin/etablissements` shows the wrong status.** `react-web/src/app/admin/etablissements/page.tsx` (~:176-198) maps only PENDING_APPROVAL, so COMPLEMENTS_REQUESTED and REJECTED companies show as ACTIF or SUSPENDU.
