# Establishment ID lifecycle: read-only survey (2026-10-06)

Status: COMPLETE. Read-only. No code was changed, and no git, test, build, prisma or database commands were run.
Line numbers refer to the working tree on 2026-10-06. `src/campaign/` was being edited at the same time, so its line numbers are approximate.

Policy target evaluated (analysis only): the ID is generated at registration from a sequential counter. Gaps are allowed and numbers are never reused. An ID is permanent once generated, even if the file is never approved. The counter advances when an ID is generated, not when a file is approved. There is no pool, no reassignment and no release.

---

## 0. Four columns share the name "establishmentId"

| Column | Prisma | Holds |
|---|---|---|
| `Company.establishmentId` | `String? @unique` (schema.prisma:308) plus `establishmentIdGeneratedAt DateTime?` (:309) | The public 10-character code, e.g. `EN26000112`. |
| `Establishment.code` | `String @unique` (schema.prisma:338) | The site code: company code + `-NN`, e.g. `EN26000112-01`. |
| `OnefopSubmission.establishmentId` | `String` NOT NULL, FK -> `Establishment.id`, `onDelete: Restrict` (schema.prisma:858, :905) | **The UUID of the Establishment row, not the public code.** Relinked to UUIDs by migration `20261002180000_phase_e1_establishments`, steps 4 and 7. |
| `CampaignSubmission.establishmentId` | `String` NOT NULL, FK -> `Establishment.id` (schema.prisma:663, :667), `@@unique([campaignId, establishmentId])` | A UUID, same as above (E.1 steps 5 and 7). |
| `SubmissionDraft.establishmentId` | `String`, `@@unique([establishmentId, quarterCode])` (schema.prisma:800, :812) | A code. E.1 step 6 suffixed the existing rows with `-01`, but today's writer stores the **bare** company code (see 1.5). |

So "the establishment ID" (the public, generated code) lives only in `Company.establishmentId` and, derived from it, in `Establishment.code`. Neither OnefopSubmission nor CampaignSubmission stores the code.

---

## 1. Write sites and the generator

### 1.1 The generator: `src/common/utils/establishment-id.generator.ts` (full text)

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

    static isValid(establishmentId: string): boolean {
        const pattern = /^(EN|CO|CT|ON|AD|PP|VT)[0-9]{2}[0-9]{4}[0-9]{2}$/;
        return pattern.test(establishmentId);
    }

    static parse(establishmentId: string) { /* slices 0-2 prefix, 2-4 year, 4-8 serial, 8-10 subdiv */ }

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
(`isValid` and `parse` are shown elided. Lines 68-107 have the full text. `isValid` and `parse` have no production callers; only the spec uses them.)

Facts about the generator:
- **Format:** `{prefix 2}{YY 2}{serial 4, zero-padded}{subdivision suffix 2}`, 10 characters. Examples:
  - `EN26000112`: ENTREPRISE, 2026, serial 0001, subdivision suffix 12 (the generator's own docstring, and `establishment-id.generator.spec.ts`).
  - `AD26000412`: ADMINISTRATION, 2026, serial 0004, suffix 12 (generator.spec.ts, "increments the serial for ADMINISTRATION").
  - `EN26000101`: ENTREPRISE, serial 0001, subdivision code `5801`, so the suffix is `01` (backfill-company-establishment-ids.spec.ts:68, :81). Its principal site is `EN26000101-01`.
  - Also `EN25000100` (pilotage.service.spec.ts:516) and the Flutter login hint `nom@entreprise.cm ou EN26000112` (lib/l10n/app_fr.arb:167).
- **Counter mechanism:** MAX()+1. The generator reads the lexicographically highest `Company.establishmentId` that starts with `{prefix}{YY}`, parses characters 4-8 and adds 1. There is no database sequence, no counter table and no row count.
- **Where the "next number" lives:** nowhere. It is derived from whatever rows exist in `companies` at that moment. Deleting a company, or setting its establishmentId to null, lowers the maximum, so its number can be issued again.
- **Counter scope:** one counter per (prefix, YY). The subdivision suffix is appended and plays no part in allocation, so the counter is **not** scoped to a subdivision. Two IDs differ by serial even when their suffixes differ.
- **Subdivision suffix:** callers pass `subdivision.code.slice(-2)` (auth.service.ts:980, :1688). Subdivision codes are 4 digits (e.g. `5801`), so the suffix is just the last two digits. It is not unique per subdivision. It is informational only.
- **Year reset:** yes, implicitly. YY comes from `new Date().getFullYear()` in server local time (UTC on Render). Each new YY starts again at 0001 because no row matches the new `{prefix}{YY}`. Pilotage counts years on Douala time (UTC+1, `pilotage-coverage.ts:46`). An ID generated between 00:00 and 01:00 Douala time on 1 January therefore carries the previous YY.
- **Advisory lock:** `pg_advisory_xact_lock(hash(prefix+YY))`. It covers the MAX() read and every later statement in the same transaction: the company update, `establishment.create`, the user update and the audit row. It is held until COMMIT or ROLLBACK. Under READ COMMITTED, a waiter's next statement takes a fresh snapshot, so it sees the winner's committed row. Outside a transaction the lock is released when the statement ends, and nothing is serialised (the docstring says so). The lock is not taken anywhere else (no other `pg_advisory` call exists in `src/`).
- **Edge cases:** serial 10000 makes an 11-character ID that fails `isValid`, and `slice(4,8)` then misreads every later serial. That gives a ceiling of 9999 per (prefix, YY). A non-numeric legacy value starting with `{prefix}{YY}` would make `parseInt` return NaN and produce `…0NaN…`.

### 1.2 Write site: staff approval, `AuthService.approveCompanyRegistration` (auth.service.ts:1646-1752)
- **Trigger:** `POST` approve, via `approveUser` (auth.service.ts:1114, which calls :1125 for role COMPANY) when the user is PENDING_APPROVAL or COMPLEMENTS_REQUESTED.
- **Pre-checks, before any transaction:** territorial authority (:1654), status (:1655), entityType non-null (:1658), the ADMINISTRATION central-structure confirmation (:1667), subdivisionId non-null (:1672).
- **Inside `$transaction`, with up to 2 attempts (:1676-1750):**
  1. Look up the subdivision code; throw 400 if it is blank (:1681-1688).
  2. `let issued = company.establishmentId; if (!issued) { issued = await EstablishmentIdGenerator.generate(tx, …); tx.company.update({ establishmentId: issued, establishmentIdGeneratedAt: new Date() }) }` (:1689-1696).
  3. `tx.establishment.create({ code: \`${issued}-01\`, isPrincipal: true, … })` (:1697-1714).
  4. Set the user ACTIVE (:1715).
  5. Write the `COMPANY_REGISTRATION_APPROVED` audit row (:1719).
- **On P2002:** retry once. The second P2002 becomes a 409 with "Un identifiant d'établissement existe déjà pour ce territoire" (:1742-1751).
- **After COMMIT:** the approval email carries the ID (:1735), and `issueAttestation` (:1737) runs fire-and-forget.

### 1.3 Write site: public auto-approval, `AuthService.autoApproveRegistration` (auth.service.ts:945-1035)
- **Trigger:** `createCompanyRegistration` (:629) when `autoApprove` is true (:687-690). That requires `!skipAutoApproval` and an entityType in `AUTO_APPROVE_ENTITY_TYPES = ['ADMINISTRATION']` (:63).
- Only the public route `POST /auth/register-company` (auth.controller.ts:105-112, which calls `registerCompany` at :809) can trigger it. `adminRegisterCompany` (:855) passes `skipAutoApproval: true` (:887).
- Same five writes as 1.2, inside its own `$transaction` with the same `if (!issued)` guard and the same single P2002 retry. The audit action is `COMPANY_REGISTRATION_AUTO_APPROVED`.
- **Important:** this transaction runs **after** `user.create` (:698) and `company.create` (:716), which are two separate auto-committed statements **not** wrapped in any transaction. If auto-approval fails, an ordinary PENDING_APPROVAL file is left behind with no ID (comment at :772-774).

### 1.4 Write site: backfill script, `scripts/backfill-company-establishment-ids.ts` (run by hand)
- **Targets:** companies with `establishmentId: null` whose user is `COMPANY`/`ACTIVE` (:135-139). Pending, complements-requested and rejected files are explicitly excluded (:14-16).
- **Runs** one `$transaction` for the whole batch (timeout 180 s, :50). It calls `EstablishmentIdGenerator.generate` (:272), updates the company (:280), creates the `-01` Establishment (:283-285) and writes the `COMPANY_ESTABLISHMENT_ID_BACKFILLED` audit row.
- **Side effect:** the advisory lock for every (prefix, YY) it touches is held for the whole batch, which blocks concurrent approvals of those types.

### 1.5 Other writes of columns named establishmentId (none of them generates a code)
- **`Establishment.code`:** written only at 1.2 (:1699), 1.3 (:991), 1.4 (:285), and by the E.1 migration SQL backfill (`c."establishmentId" || '-01'`, migration.sql:62). Each is always derived from the company code.
- **`OnefopSubmission.establishmentId`:**
  - Live path: `questionnaires.service.ts` :539-582 resolves the client value (bare code, `-01` code or UUID) to `Establishment.id` among the caller's own establishments, otherwise the single active or principal one. It throws 400 "Établissement introuvable…" if none exists (:570-577). The value is connected at :1396.
  - Mock fallback: `resolvedEstablishmentId = submittingCompany.establishmentId || ''` (:581). It runs only when the Prisma client has no `establishment` delegate, i.e. in tests.
  - `OnefopService.submitForm` (onefop.service.ts:22-103, writes `establishmentId: establishmentId || company.establishmentId` at :74) is **dead code**: no controller or caller routes to it (onefop.controller.ts has only GET submissions, the PDF route, active-quarter and the draft routes). If it ran, it would put a code into a UUID foreign-key column.
- **`SubmissionDraft.establishmentId`:** `OnefopService.saveDraft` (onefop.service.ts:127-153) writes `company.establishmentId`, the bare 10-character code. Rows migrated by E.1 carry `-01`. `getDrafts` and `deleteDraft` (:159, :168) query the bare code, so migrated drafts are no longer visible. This bug already exists and does not depend on when the ID is generated.
- **CampaignSubmission:** created in `src/campaign/campaign.service.ts` (~:878, `establishmentId: est.id`, a UUID). Not touched in this survey.

---

## 2. Readers

| Where | Label | Used for | Assumes timing? |
|---|---|---|---|
| `src/auth/auth.service.ts:186-195` `validateUser` | n/a | Login: if no user has `email = login`, finds `company.findFirst({ establishmentId: login })` with an **exact, case-sensitive** match after the frontend has trimmed the value. A pending COMPANY user may log in (:230-236). REJECTED gets a fixed message (:242). | No. Works with whatever is stored. |
| `auth.service.ts:1043-1073` `findIdentifier` (`POST /auth/identifier/find`, auth.controller.ts:580-587) | "Votre identifiant :" | Matches name + NIU + phone and returns `establishmentId`. If it is null: 400 "Identifiant non disponible pour ce compte. Contactez le support DSMO." (:1063-1066). | **Yes.** It treats null as "not issued yet", and it would hand out the ID of a pending or rejected company if one existed. |
| `auth.service.ts:1760-1781` `issueAttestation` and `src/dsmo/pdf.service.ts:408-527` | Attestation PDF, ID centred (:527); title `Attestation d'inscription - {id}` (:452) | Storage path `attestations/{createdAt year}/{establishmentId}.pdf` with `upsert: true` (:409, :423) | Called only after approval or auto-approval. A reused ID would overwrite another company's attestation. |
| `src/dsmo/notification.service.ts:533-537` | "Identifiant d'établissement : …" | Approval email | Approval only. |
| `src/dsmo/dsmo.service.ts:66-77` `getMyCompany` | n/a | Returns `establishmentId` and `establishmentIdGeneratedAt` to the company (feeds the VT1_1 autofill and Flutter home) | No |
| `dsmo.service.ts:233-256` `listCompanies` | n/a | Search: `establishmentId contains term` (case-insensitive) | No |
| `src/pilotage/pilotage-coverage.ts:58-68`, `pilotage.service.ts:207-208, 365-396, 969-981` | n/a (coverage counters) | `isRegistered = ACTIVE && isActive && hasEstablishmentId`; `registeredAt = establishmentIdGeneratedAt ?? createdAt` decides which year `registeredInYear` counts the company in | **Yes.** `establishmentIdGeneratedAt` is used as a stand-in for the approval date. |
| `src/data-management/canonical-schema-adapter.service.ts:629-640`, SPSS **SYS_08** "ID établissement" / "Establishment ID", `sourcePath: 'submission.establishmentId'`, resolved by `extractValue` (:227-233) | SYS_08 | SPSS export | No, but **the value exported is the Establishment UUID, not the public code** (see §0). |
| `src/data-management/data-management.service.ts:1257, 1277` (Excel) | "ID établissement" | `s.company?.establishmentId ?? s.establishmentId ?? null`: the company code, otherwise falls back to the submission's **UUID** | No |
| `data-management.service.ts:674, 1050` | n/a | Selects `company.establishmentId` for exports and review | No |
| `src/report/report.service.ts:210-236, 854, 1130-1139`; `report-pdf.service.ts:810` | n/a | Filters and builds panel keys from `OnefopSubmission.establishmentId` (the UUID); the PDF falls back to it when the name is missing | No. It is the UUID. |
| `src/onefop/onefop.service.ts:134-139, 159, 168` (drafts) | 400 "Votre établissement n'a pas encore d'identifiant (code site)…" | Draft key | **Yes.** It handles a company with no ID. The route sits behind `ActiveCompanyGuard` (onefop.controller.ts:23), so pending companies never get here. |
| `onefop.service.ts:172-222` `getSubmissions` | n/a | `?establishmentId=` filter; echoes `s.establishmentId` (the UUID) | No |
| `src/questionnaires/questionnaires.service.ts:539-582` | n/a | Resolves the client code to the Establishment UUID (`code`, `id`, or `${code}-01`) | Needs an Establishment row, which exists only after approval. |
| `src/questionnaires/campaign-review-sync.ts:25-42`, `eligibility-engine.service.ts:564-750` | n/a | The (campaignId, Establishment UUID) pair | No |
| `src/campaign/campaign.service.ts` ~:608-618 `getCampaignSubmissions` | n/a | Matches `CampaignSubmission.establishmentId` (a **UUID**) against `Company.establishmentId` (a **code**), so the company enrichment can never match. This bug already exists. | No |
| `src/auth/active-company.guard.ts:47-52` | n/a | Explicitly does **not** check establishmentId | No (decided on status only) |
| DTOs: `src/dto/onefop-submission.dto.ts:12-41` (optional `establishmentId`, `__meta.establishmentId`); `src/auth/dto/resubmit-registration.dto.ts:12` (deliberately leaves it out; the whitelist rejects it, auth.registration-resubmission.spec.ts:25-28) | n/a | Input | n/a |
| **Frontend** `react-web/src/app/register/page.tsx:606-611, 1020-1040` | "Identifiant d'établissement" | Receipt row, shown **only if** `response.company.establishmentId` is set. The table is titled "Attestation officielle d'enregistrement…" and always shows "Statut… Enregistré / Compte opérationnel" (:1046-1049), even for a pending file. | **Yes**, conditional on the value being present. |
| `react-web/src/app/login/page.tsx:141-162, 320-350` | "Retrouver mon identifiant", "Votre identifiant :" | Shows the `findIdentifier` result | The ID it returns **cannot be typed into the React login field**, which is `type="email"` with `required` and has no `noValidate` (:207-216; label "Adresse email", messages/fr.json:211), so HTML5 validation rejects `EN26000112`. |
| `react-web/src/app/admin/etablissements/page.tsx:176-198, 262-269, 467, 519` | Column "Identifiant"; CSV "Identifiant" | Display. **Row id `c.establishmentId \|\| c.id`** is used for the detail link (:495, :592, :611). | **Yes.** It falls back to the UUID when there is no ID. The status mapping knows only PENDING_APPROVAL, so COMPLEMENTS_REQUESTED and REJECTED show as ACTIF or SUSPENDU. |
| `react-web/src/app/admin/etablissement-detail/page.tsx:94-109, 293, 330` | "Identifiant :" / "Identifiant établissement" | Lookup: `listCompanies({search:id})`, then `find(c => c.establishmentId === id \|\| c.registrationNumber === id)` | **Yes.** A company with no ID arrives with its UUID, which the server search (name, NIU, establishmentId, region) does not match, so **pending companies cannot be opened ("not found")**. |
| `react-web/src/components/admin/CompaniesDirectory.tsx:47-50, 281-282` (used by `/admin/annuaire`) | "Identifiant" (`companiesDirectory.establishmentIdColumn`, fr.json:429) | Display; shows `—` when null | Tolerates null |
| `react-web/src/app/admin/inscriptions/page.tsx` | (none) | Does not show establishmentId at all | n/a |
| `react-web/src/app/admin/inscriptions/nouvelle/page.tsx:346-352`; `src/lib/inscriptions.ts:84-87` | "Identifiant" = **email** | Assisted result. The type comment says `/** null until a reviewer approves the file — assisted ones always queue. */` | **Yes** (the comment) |
| `react-web/src/lib/onefop-autofill.ts:239` | VT1_1 "Code de la Structure" (AST, onefop_ast.dart:2947-2956: "(A ne pas remplir / Not to be filled in)", admin-assigned) | Prefills VT1_1 from `comp.establishmentId`. It flows to `structureCode` (flat-key-normalizer.ts:672), is stored in `vocationalTrainingDetail.structureCode` (schema.prisma:1100, "admin-assigned") and goes into the PDF (pdf-data-mapper.service.ts:1892). | Only once ACTIVE. Pending accounts cannot reach the ONEFOP form. |
| `react-web/src/lib/user-types.ts:105-116`, `api-client.ts:566-569`, `companies-directory.ts:23`, `onefop-submission.ts:69-73` | n/a | Types (`establishmentId?: string \| null`) | Nullable |
| **Flutter** `lib/screens/register_screen.dart:529-560, 677-692` | Receipt "REÇU D'ENREGISTREMENT", "IDENTIFIANT ÉTABLISSEMENT" | **Branches on `establishmentId != null`.** With an ID it shows `RegistrationReceipt` (register_receipt.dart; note app_fr.arb:213: "Conservez cet identifiant… accéder à vos formulaires ONEFOP… à la place de votre e-mail pour vous connecter"). Otherwise it shows the "file awaiting review" dialog, with the comment "R.1: no establishment ID is issued at self-registration any more, so this is the live path for every company". | **Yes** |
| `lib/screens/home_screen.dart:562-572` | "ID établissement manquant. Veuillez contacter l'administrateur." (app_fr.arb:1326) | Blocks opening ONEFOP without an ID; the ID keys local drafts (:645-696) and `__meta_establishment_id` | Yes (null means blocked) |
| `lib/screens/home_screen.dart:2144` | VT1_1 | Same prefill as React | n/a |
| `lib/screens/login_portal_screen.dart:438-451, 619, 775` | "Identifiant", hint `nom@entreprise.cm ou EN26000112` | Flutter login accepts free text (no email validator); shows the forgot-ID result | No |
| `lib/screens/admin/companies_screen.dart:149, 300, 511`; `lib/screens/onefop/submissions_viewer_screen.dart:449-2928` | "ID …" / "ID établissement : …" | Display. The submissions viewer prints `OnefopSubmission.establishmentId`, which is the UUID. | No |
| `lib/services/draft_service.dart:18-34`; `onefop_form_controller.dart:95, 1675-1716` | n/a | Local draft key `est_{id}_{quarter}`; sends the code as `dto.establishmentId`, and the backend resolves it via `-01` | Needs an ID |

---

## 3. Constraints, format and concurrency (summary)

- **`Company.establishmentId`:** `String? @unique`, plus `@@index` (schema.prisma:308, :324). The unique index came in migration `20261002160000_unique_company_establishment_id`. Postgres allows repeated NULLs.
- **`OnefopSubmission.establishmentId`:** `String`, required, FK to `Establishment.id` (a UUID). It is not unique on its own. Live returns are unique per (establishment, quarter) through a partial index (E.1 step 9).
- **`Establishment.code`:** `@unique`. There is also a partial unique index: one principal establishment per company (`establishments_company_principal_uidx`, E.1 step 2).
- **Examples:** `EN26000112`, `AD26000412`, `EN26000101` (with site `EN26000101-01`). Sources are listed in §1.1.
- **Counter:** MAX()+1 over `companies`, scoped by (prefix, YY), serialised by a transaction-scoped advisory lock. P2002 on the unique index is the backstop, with one retry.
- **Year reset:** yes. The serial restarts at 0001 for each new YY.

---

## 4. Pending entities

- **Is the ID null while a file is pending?** Yes, for every route except public self-registration of ADMINISTRATION, which is auto-approved in the same request. Assisted ADMINISTRATION files queue without an ID (auth.service.ts:885-887; assisted-registration.spec.ts:121-133).
- **The "no ID yet" state is visible here:**
  - React receipt: the ID row is hidden, but the status row still says "Compte opérationnel".
  - Flutter: the pending dialog instead of the receipt.
  - `/admin/etablissements`: the Identifiant column shows the not-provided marker, the row id falls back to the UUID, and the detail page cannot be opened.
  - `/admin/annuaire`: `—`.
  - `/admin/inscriptions`: the ID is not shown at all.
  - Assisted result: shows the email as "Identifiant".
  - Login forgot-ID: 400 "Identifiant non disponible…".
  - Flutter home: "ID établissement manquant".
  - Drafts: 400 "…code site…".
  - Exports: Excel falls back to the submission UUID. Pending companies have no submissions anyway.
- **Code that assumes null means pending:**
  - `if (!issued)` at auth.service.ts:982 and :1690.
  - `!match.establishmentId` at :1063.
  - `!company.establishmentId` at onefop.service.ts:134.
  - `c.establishmentId || c.id` at etablissements/page.tsx:177.
  - `c.establishmentId ?? null` at :182.
  - `result.establishmentId &&` at register/page.tsx:1020.
  - `res.establishmentId ?? res.matricule` at login/page.tsx:153.
  - `s.company?.establishmentId ?? s.establishmentId` at data-management.service.ts:1277.
  - `submittingCompany.establishmentId || ''` at questionnaires.service.ts:581.
  - `establishmentId || company.establishmentId` at onefop.service.ts:74 (dead code).
  - Flutter `establishmentId != null` (register_screen.dart:534) and `establishmentId == null || isEmpty` (home_screen.dart:567).
  - Backfill `establishmentId: null` filter (backfill script :137).
  - `hasEstablishmentId` (pilotage-coverage.ts:58).
- **Does today's receipt show any identifier?** For pending files, no; the only exception is an auto-approved ADMINISTRATION. The React receipt shows only name, entity type, respondent name and email, and the (misleading) status. The assisted-registration result shows the email as "Identifiant".

---

## 5. Resubmission, rejection, deletion

- **Resubmission** (`AuthService.resubmitRegistration`, auth.service.ts:1355-…; UI `react-web/src/app/home/inscription-en-attente/page.tsx`):
  - establishmentId is **not** correctable. It is absent from `CORRECTABLE_COMPANY_FIELDS` (:1342-1353) and from the DTO (the whitelist rejects it).
  - **But the respondent can change `entityType` (:1352; UI :132-133, :218-225) and the whole territory chain including `subdivisionId` (:1407-1427; UI :135-148).** Those are exactly the inputs that make up the ID's prefix and suffix.
- **Rejection** (`rejectUser`, :1137-1205): updates **only the User** (`status: REJECTED, isActive: false, rejectionReason, rejectedAt`) and writes an audit row. The User and Company rows are both kept. establishmentId is not touched. The rejected state is final: there is no path from REJECTED back to pending (rejection, complements and approval all require PENDING_APPROVAL or COMPLEMENTS_REQUESTED).
- **Deletion** (`deleteUser`, :2153-2172): hard `user.delete`. `companies_userId_fkey` is `ON DELETE RESTRICT` (init migration:867), so deleting any COMPANY user that has a Company row fails with P2003, and the caller gets the 409 "Suspendez le compte à la place". Through the API, a company (and therefore its ID) cannot be deleted. **However, migration `20261004130000_remove_pending_subdivisions` deleted a company by raw SQL**, which shows that rows can disappear outside the API.

---

## 6. Timing assumptions (file:line and quote)

| Assumption | Where | Quote |
|---|---|---|
| A pending file has no ID | schema.prisma:306-307 | "Nullable, and Postgres allows repeated NULLs, so companies still awaiting approval are unaffected." |
| | auth.service.ts:685-686 | "Establishment IDs are issued at staff approval, except for the entity types in AUTO_APPROVE_ENTITY_TYPES" |
| | auth.service.ts:1336-1339 | "so establishmentId stays unreachable: it is issued by a reviewer at approval." |
| | react-web/src/lib/inscriptions.ts:86 | "null until a reviewer approves the file — assisted ones always queue." |
| | lib/screens/register_screen.dart:548-551 | "R.1: no establishment ID is issued at self-registration any more, so this is the live path for every company." |
| | backfill script :14-16 | "companies whose user is PENDING_APPROVAL … get their ID from the normal approval path" |
| | migration 20261002160000:8-10 | "companies awaiting approval … are unaffected." |
| An approved file always has one | auth.service.ts:772-774 | "so a failure here leaves a normal PENDING_APPROVAL file for staff review rather than an active account with no ID." |
| (contradicted for legacy rows) | active-company.guard.ts:49 | "Do NOT check establishmentId (29 active companies have none until R.1's backfill)" |
| (contradicted for legacy rows) | active-company.integration.spec.ts:280 | "allows ACTIVE company with NO establishmentId (29-company case)" |
| | pilotage-coverage.ts:63 | `isRegistered` requires both ACTIVE and an ID |
| | pilotage-coverage.ts:67 | `registeredAt = establishmentIdGeneratedAt ?? createdAt`, i.e. the ID date stands in for the approval date |
| Generated inside the approval transaction | auth.service.ts:1680-1696 | `let issued = company.establishmentId; if (!issued) { issued = await EstablishmentIdGenerator.generate(tx, …)` |
| | auth.service.ts:1666 | "Checked before the transaction, so a refusal issues no establishment ID and writes no audit row." |
| Generated during registration, but in its own transaction | auth.service.ts:972-988 (autoApproveRegistration) | Same `if (!issued)`. `user.create` and `company.create` (:698, :716) are **outside** any transaction. |
| Never outside a transaction | establishment-id.generator.ts:26-29 | "Must only be called inside prisma.$transaction(...)." |
| | auth.service.ts:940-943 | "the generate/update pair must stay inside $transaction" |
| Establishment `-01` is created together with the ID at approval | auth.service.ts:1697-1699 and :989-991 | `code: \`${issued}-01\`` |
| ONEFOP submission needs an Establishment row, which exists only after approval | questionnaires.service.ts:570-577 | "Établissement introuvable ou non associé à cette entreprise." |
| The ID depends on the subdivision code | auth.service.ts:977-980, :1685-1688 | "Code d'arrondissement introuvable pour cet établissement." then `subdivision.code.slice(-2)` |
| VT1_1 autofill | onefop-autofill.ts:239 | `setIfPresent(data, "VT1_1", comp.establishmentId)`. The AST calls it admin-assigned, "A ne pas remplir". |
| SYS_08 | canonical-schema-adapter.service.ts:639 | `sourcePath: 'submission.establishmentId'` (a UUID; does not depend on timing) |
| Tests: null before, non-null after | auth.registration-approval.spec.ts:30, :363 | fixtures `establishmentId: null` |
| | auth.registration-approval.spec.ts:94-108 | "approves a COMPANY: issues an establishmentId" plus `/^EN\d{6}12$/` |
| | :112-120 | `-01` with `/^EN\d{6}12-01$/` |
| | :~176-181 | "Refused before the transaction: no establishment ID" (`company.update` not called) |
| | assisted-registration.spec.ts:121-133 | "autoApproveRegistration would have … allocated an establishment id. DECISION 2 says it must not run here." |
| | backfill spec :15, :181 | |
| | Note | There is **no** unit test of public ADMINISTRATION auto-approval. |

---

## 7. Races and ordering

### 7.1 Under the current generator
- **Same (prefix, YY):** serialised by the transaction lock. The second caller waits, then sees the committed maximum and takes the next serial. P2002 on `companies_establishmentId_key` is practically unreachable through the API. It could come from a writer that skips the lock (raw SQL) or from a year-boundary difference.
- **Different prefixes, or a different YY:** no shared counter, so no collision. A 32-bit hash collision between two keys would only add extra serialisation.
- **Rollback:** MAX()+1 is computed from committed rows. A rolled-back transaction (failed Establishment insert, audit failure, timeout) leaves **no gap**: the next caller is given the same number. So the current mechanism produces no gaps and silently re-issues numbers that were never committed.
- **Reuse:** if the company holding the highest serial for a (prefix, YY) disappears or has its ID set to null, its number is issued again. Deleting through the API is blocked by the FK, but the 2026-10-04 migration deleted a company by SQL.
- **The P2002 retry also catches** `establishments_code_key` and `establishments_company_principal_uidx`. If an Establishment `-01` already exists for the company (for example, an ID was set without a successful approval), both attempts fail and the user sees the "existe déjà pour ce territoire" 409. That message is misleading: allocation is not territory-scoped.
- **Lock duration:** the lock lasts as long as the whole approval transaction (5 writes; Prisma's default interactive-transaction timeout is 5 s), and as long as the whole backfill run (up to 180 s). Waiters count toward their own timeout.
- **Subdivision suffix:** two subdivisions with the same last two digits share a suffix. Uniqueness comes entirely from the serial.

### 7.2 Under the policy target (generate at registration; counter; gaps OK; no reuse)
- **Registration flow:** `createCompanyRegistration` creates the User and the Company in two separate statements without a transaction (:698, :716). Generating there inside a transaction requires wrapping, or a follow-up transaction like auto-approval does today. Every registration of a type then takes the (prefix, YY) lock. Public registration is unauthenticated (throttled per IP), so spam or abandoned registrations of one type serialise each other and **consume serials permanently**. That brings the 9999 per (prefix, YY) ceiling closer.
- **MAX()+1 vs the policy:**
  - It cannot provide "no reuse": numbers come back if the top row is deleted or nulled.
  - It does not produce the gaps the policy allows: rolled-back numbers are re-issued.
  - Only durable state that advances on generation (a sequence or counter row) matches "counter advances on generation". This is a statement of mismatch, not a proposal.
- **Rollback at registration:** if the ID is generated in the same transaction as `company.create` and anything later fails (taxNumber P2002, email P2002), the number is re-issued under MAX()+1, but lost (a gap) under a sequence. Postgres sequences do not roll back.
- **Order of operations:** the ID must be known before `company.create`, or set by an update afterwards. Today's `if (!issued)` in both approval paths would then skip generation and only create the `-01` Establishment. That is compatible, provided registration does not also create the Establishment; if it did, approval's `establishment.create` would hit P2002 on the principal index.
- **Year:** the ID's YY becomes the registration year. A file registered in December and approved in January keeps the earlier YY.

---

## 8. What would break or change if generation moved to registration

1. **Resubmission can change the inputs of the ID.** `entityType` and `subdivisionId` are correctable (auth.service.ts:1352, :1407-1427). An ID generated at registration would carry a stale prefix or suffix (e.g. a `EN…` ID for a company corrected to COOPERATIVE). Approval's `if (!issued)` would keep the stale ID, and `-01` would be created with the new subdivision but the old code. The policy says IDs are permanent, so either the ID stops encoding entityType and subdivision reliably, or those corrections would need a decision.
2. **Rejected and abandoned files keep IDs forever.** The company is kept on rejection (§5), so:
   - `validateUser` resolves the ID to the rejected user, who gets REJECTED_LOGIN_MESSAGE after the password check.
   - `findIdentifier` would return IDs for pending and rejected companies. Today it returns 400 for them.
   - Search, directories and Excel would show IDs for files that never became establishments.
3. **Pilotage statistics.** `registeredAt = establishmentIdGeneratedAt` (pilotage-coverage.ts:67) would become the registration date instead of the approval date, which moves `registeredInYear` across a year boundary for files approved in a later year. `isRegistered` still requires ACTIVE, so the stock counts themselves are unaffected.
4. **Receipts.**
   - React `/register`: would show "Identifiant d'établissement" for every file, under a heading "Attestation officielle d'enregistrement" and a status "Compte opérationnel" that are already wrong for pending files.
   - Flutter `register_screen.dart:534`: would always take the receipt branch, so the pending-review dialog becomes unreachable. The receipt note promises the ID gives access to the ONEFOP forms, which a pending account cannot use.
   - Assisted result: would have an ID to show, and the `inscriptions.ts:86` comment would become wrong.
5. **Comments, docs and tests that assert approval-time issuance:**
   - schema.prisma:306, auth.service.ts:685, :1336-1339, :1666, inscriptions.ts:86, register_screen.dart:548, backfill script header, migration 20261002160000 comment.
   - auth.registration-approval.spec.ts fixtures (`establishmentId: null`, generation expected at approval) and the "refused before the transaction: no establishment ID" test.
   - assisted-registration.spec.ts:121-133 (wording only).
6. **Things that would start working for pending files:**
   - `/admin/etablissement-detail` lookup (pending files currently get "not found" via the UUID fallback).
   - The Flutter home gate.
   - `saveDraft`. It is still blocked by ActiveCompanyGuard, so nothing changes there for pending.
7. **Subdivision-code dependency moves to registration.** A subdivision without a code would then fail or affect **registration** rather than approval (today it is a 400 at approval). Auto-approval already behaves this way for ADMINISTRATION, and its failure leaves a pending file without an ID.
8. **Not affected:**
   - SYS_08, report.service, campaign sync and eligibility, which all use the Establishment UUID.
   - The attestation, which is still issued at approval and keyed by ID.
   - ActiveCompanyGuard.
   - The ONEFOP submission path. It needs the Establishment row, which is still created at approval unless that moves too.

---

## 9. Open questions for the human

1. When a pending file's `entityType` or subdivision is corrected on resubmission, what happens to an already-generated ID? Options: keep the stale prefix/suffix, forbid those corrections, or accept that the format no longer encodes them.
2. Should the YY in the ID be the registration year (policy) even when approval happens in a later year? Should pilotage's "registered in year" keep using `establishmentIdGeneratedAt`, or switch to `User.approvedAt`?
3. Should a pending or rejected company be able to log in with, or recover (`findIdentifier`), its ID? Today recovery returns 400 for files without an ID.
4. Should the `-01` Establishment row stay approval-time (so ONEFOP submission stays gated on approval) while the code moves to registration?
5. "No reuse" with today's MAX()+1 is not guaranteed (raw-SQL deletes have happened; rolled-back numbers are re-issued). Is a durable counter in scope, which would be a schema/migration change needing human review? And is 9999 per (type, year) enough once abandoned registrations consume numbers?
6. Should assisted registrations, which always queue under DECISION 2, also receive an ID at creation?
7. Some bugs already exist and do not depend on timing:
   - SYS_08 "ID établissement" and the Excel fallback export the Establishment **UUID**, not the code.
   - `campaign.service` `getCampaignSubmissions` matches UUIDs against codes.
   - `saveDraft` and `getDrafts` use the bare code while E.1-migrated drafts carry `-01`.
   - The React login input is `type="email"`, so the ID that "Retrouver mon identifiant" hands out cannot be used to log in on the web.
   - `/admin/etablissements` maps COMPLEMENTS_REQUESTED and REJECTED to ACTIF or SUSPENDU.

   Should these be tracked separately?
