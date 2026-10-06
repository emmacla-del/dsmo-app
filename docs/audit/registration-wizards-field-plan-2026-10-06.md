# Registration wizards and correction flow: field plan (2026-10-06)

Read-only survey before the field changes. No code, schema or test was changed and no
test was run. This document reports what the code does today and lays out the plan.
It contains no proposed code. Pasted excerpts are existing code.

**Confirmed decisions this plan follows**

- **Two distinct phones.** The entity phone (`Company.phone`) and the declarant phone (`Company.respondentPhone`) are separate fields. Only the entity phone is relabelled, to "Téléphone / WhatsApp".
- **One email field.** `User.email` serves as both the login and the ONEFOP contact. No new column, no migration.
- **Correction flow.** The flow (`/home/inscription-en-attente`) gains the ability to change the entity phone and the email.
- **CNPS.** Becomes required for enterprise, cooperative, ctd, ong and vocationalTraining (from the review-redesign decisions). Administration and projectProgram are unchanged.

This plan supersedes two points of `docs/audit/inscriptions-review-redesign-2026-10-06.md`:
its `Company.contactEmail` column and migration are dropped, and the "phone 1" label
question is settled in favour of the entity phone.

---

## Step 1: Public wizard (`/register`), contact fields

### 1.1 Section 3 ("entityInfo") fields matching Téléphone / Email / Courriel / BP / Boîte postale / CNPS

Section 3 is built from `ENTITY_CONFIGS[type].fields`
(`react-web/src/lib/register-constants.ts`). The fields are grouped by
`ENTITY_SECTION_LAYOUT` (`react-web/src/lib/register-entity-sections.ts`) and rendered
by `renderEntityField` (`react-web/src/app/register/page.tsx:323`). The shared
contact constants are at `register-constants.ts:149-170`:

```ts
const PHONE:   EntityField = { key: "phone",  label: { fr: "Téléphone",   en: "Phone" },   hint: { fr: "Ex : 655000000", en: "E.g. 655000000" }, required: true,  kind: "tel" };
const PHONE_2: EntityField = { key: "phone2", label: { fr: "Téléphone 2", en: "Phone 2" },                                                  required: false, kind: "tel" };
const PO_BOX:  EntityField = { key: "poBox",  label: { fr: "Boîte postale", en: "P.O. box" },                                               required: false, kind: "text" };
```

| Entity type | Label shown (fr) | Request key | Schema column | Required |
|---|---|---|---|---|
| enterprise | Téléphone | `phone` | `Company.phone` | Yes |
| enterprise | Téléphone 2 | `phone2` | `Company.phone2` | No |
| enterprise | Boîte postale | `poBox` | `Company.poBox` | No |
| enterprise | N° CNPS | `cnpsNumber` | `Company.cnpsNumber` | **No** |
| cooperative | Téléphone | `phone` | `Company.phone` | Yes |
| cooperative | Téléphone 2 | `phone2` | `Company.phone2` | No |
| cooperative | Boîte postale | `poBox` | `Company.poBox` | No |
| ctd | Téléphone · Téléphone 2 · Boîte postale | `phone` · `phone2` · `poBox` | `Company.phone` · `phone2` · `poBox` | Yes · No · No |
| ong | Téléphone · Téléphone 2 · Boîte postale | same | same | Yes · No · No |
| administration | Téléphone · Téléphone 2 · Boîte postale | same | same | Yes · No · No |
| projectProgram | Téléphone · Téléphone 2 · Boîte postale | same | same | Yes · No · No |
| vocationalTraining | Téléphone · Téléphone 2 · Boîte postale | same | same | Yes · No · No |
| vocationalTraining | Promoteur — Tél. 1 | `promoterPhone1` | `Company.promoterPhone1` | Yes |
| vocationalTraining | Promoteur — Tél. 2 | `promoterPhone2` | `Company.promoterPhone2` | No |

The VT promoter phones are labelled "Tél.", not "Téléphone". They are listed for
completeness, since they are the third phone pair in VT's section 3.

**No section-3 field has a label containing "Email" or "Courriel" for any type.**

**Server-side requiredness.** All of these keys are `@IsOptional() @IsString()` in
`CompanyRegistrationFieldsDto` (`src/auth/dto/register-company.dto.ts`). The
requiredness above is enforced by the client only.

### 1.2 Declarant fields (section 2, "respondent", `register/page.tsx:1174-1297`)

| Label shown (fr) | Wizard state | Request key | Schema column | Required |
|---|---|---|---|---|
| Téléphone 1 | `respondent.phone1` | `respondentPhone` | `Company.respondentPhone` | Yes |
| Téléphone 2 | `respondent.phone2` | `respondentPhone2` (sent only if non-empty) | `Company.respondentPhone2` | No |
| Email professionnel | `respondent.email` | `email` | `User.email` (@unique) | Yes. Debounced availability check through `GET /auth/check-email` (`page.tsx:244-256`); `firstFailure()` blocks on `emailAvailable === false`. |

### 1.3 Confirmations

- **The entity phone is section 3's `phone`.** It is labelled "Téléphone" and is the `PHONE` constant, present in all seven types. It travels as `phone: visibleData.phone` (`register/page.tsx:588`), the controller maps it as `phone: body.phone` (`auth.controller.ts:134`), and the service writes `Company.phone` (`auth.service.ts:743`). The declarant's "Téléphone 1" (`respondentPhone`) is a different field in a different section.
- **Only enterprise collects CNPS today**, as an optional "N° CNPS" field (`register-constants.ts:216`) in the "Fiscalité et affiliation" block. The other six types do not declare `cnpsNumber`, so `visibleEntityDataForType` drops the key and nothing is sent.
- **The email label does not mention its dual role.** It reads "Email professionnel", with placeholder "Ex : contact@organisation.cm", under the section title "Répondant". The section subtitle is "Coordonnées de la personne habilitée à effectuer les déclarations officielles pour l'établissement". Nothing on the page says the address is the login identifier, nor that it is the ONEFOP contact for the entity. The placeholder's `contact@organisation` form hints at an organisational mailbox, while the section frames it as the person's.

---

## Step 2: Assisted wizard (`/admin/inscriptions/nouvelle`), contact fields

### 2.1 Section-3 fields

The assisted form renders `ENTITY_CONFIGS[type].fields` through `EntityFieldInput`
(`nouvelle/page.tsx:453-491`), using the French labels (`LOCALE = "fr"`). **The
section-3 contact fields are therefore identical to §1.1** in labels, keys, columns
and requiredness. Requiredness is checked by `firstProblem()`, which loops over
`visibleFields` (`:142-146`). The payload in `submit()` lists every key explicitly
(`:161-202`). It already includes `phone`, `phone2`, `poBox`, `cnpsNumber`,
`promoterPhone1` and `promoterPhone2`.

### 2.2 Declarant fields (`nouvelle/page.tsx:265-274`)

| Label shown | Request key | Schema column | Required |
|---|---|---|---|
| Téléphone | `respondentPhone` (`respondent.phone1 \|\| undefined`) | `Company.respondentPhone` | **No** |
| Téléphone 2 | `respondentPhone2` | `Company.respondentPhone2` | No |
| Adresse e-mail (hint: "Identifiant de connexion du déclarant.") | `email` | `User.email` | Yes |

### 2.3 Where the assisted form differs

| Aspect | Public | Assisted |
|---|---|---|
| Declarant phone label | "Téléphone 1" | "Téléphone". **The same text as the entity phone's current label**, on the same page. |
| Declarant phone requiredness | Required | Optional |
| Email label | "Email professionnel", with no mention of the login role | "Adresse e-mail", hint "Identifiant de connexion du déclarant." Mentions the login role, not the ONEFOP-contact role. |
| Email availability check | Debounced `check-email`, blocks submit | None. A taken email surfaces only as the server's 409 "Un utilisateur avec cet email existe déjà". |
| Section-3 layout | Grouped under block headings, auto-advance | One flat grid "Identification — {type}". **No auto-advance**, so the last-field rule does not apply to this form. |
| Label locale | fr / en by `useLocale` | Always fr |

---

## Step 3: The auto-advance rule

### 3.1 The test (`react-web/src/lib/register-required.test.ts:95-106`)

```ts
test("the last field of section 3 is optional for every type", () => {
  // This is WHY the continue link has to exist. Auto-advance is armed by a
  // change to the section's last field, and that field is optional in all
  // seven types -- so a respondent who fills only what is required never
  // arms it and would otherwise be stuck.
  for (const type of ALL_TYPES) {
    const key = lastEntityFieldKey(type, requiredOnlyEntityData(type));
    const field = ENTITY_CONFIGS[type].fields.find((f) => f.key === key);
    assert.ok(field, `${type}: no last field`);
    assert.equal(field.required, false, `${type}: last field ${key} is required, not optional`);
  }
});
```

Two companion tests in the same file guard the setup:

| Test | What it asserts | Effect on this change |
|---|---|---|
| `:65` | Filling only the required fields completes section 3, for every type. | — |
| `:81` | Every type has at least one optional field. | Holds for every type after the change. |

`register-entity-sections.test.ts` adds two more:

| Test | What it asserts | Effect on this change |
|---|---|---|
| `:21` | Every declared field is placed in some group. | Each new `cnpsNumber` needs a layout entry. |
| `:40` | No type needs the "Informations complémentaires" fallback. | Same. |

### 3.2 Which field is last in entityInfo today

`lastEntityFieldKey` (`register-entity-sections.ts:115-123`) returns the last field of
the last rendered group. **Within a group, fields follow their declaration order in
`ENTITY_CONFIGS`**, not the order of the layout's `keys` list (`:93-95`).

| Type | Last group | Last field | Required |
|---|---|---|---|
| enterprise | Siège social et contact | `poBox` | No |
| cooperative | Siège social et contact | `poBox` | No |
| ctd | Siège et contact | `poBox` | No |
| ong | Siège social et contact | `poBox` | No |
| administration | Siège et contact | `poBox` | No |
| projectProgram | Siège et contact | `poBox` | No |
| vocationalTraining | Promoteur / Directeur | `promoterPhone2` | No |

### 3.3 The rule that depends on it

- **Optional fields defer auto-advance.** A section that has optional fields does not open the next section the moment its required fields are filled; otherwise the optional fields would be pulled away mid-entry.
- **A change to the last field arms the advance.** `setEntityField` calls `armFromField(lastEntityFieldKey(type, next) === key)` (`register/page.tsx:269-273`). The auto-advance effect fires only when the frontier section is complete **and** `advanceArmed` is true (`:747-765`).
- **The "continue" link covers respondents who skip optional fields.** Because the last field is optional, someone who fills only the required fields never arms the advance. That is why the link exists: it is shown at the bottom of the frontier section and needs no optional field (`:840-847`). If the last field were required, filling it would advance the frontier immediately. That would cut off any optional fields placed before it in the same section. The test protects the "last is optional" property the comments rely on.

### 3.4 Where new required fields have to sit

New required fields must **not** be the last field of section 3. In practice:

- **CNPS** goes in each type's identification or fiscal block, next to `taxNumber`, never in the contact block. In `ENTITY_CONFIGS` it is declared after `TAX_NUMBER`, so in-group order matches.
- **Contact blocks stay as they are.** `address`, `phone`, `phone2` and `poBox` keep `poBox` (optional) last. The relabel does not change order.
- **VT** keeps the promoter block last. CNPS goes in "Identification du centre".

---

## Step 4: The correction flow (`/home/inscription-en-attente`)

### 4.1 Current fields

The page shows a correction form only when `user.status === "COMPLEMENTS_REQUESTED"`.

- **Prefill:** from `getMyCompany()` → `GET /dsmo/company`, which is exempted for that status.
- **Field list:** the same for every entity type, regardless of which fields that type collected at registration.

| Label | Key | Source | Control |
|---|---|---|---|
| Raison sociale | `name` | `TEXT_FIELDS` (`page.tsx:26-35`) | text |
| Numéro contribuable (NIU) | `taxNumber` | `TEXT_FIELDS` | text |
| Activité principale | `mainActivity` | `TEXT_FIELDS` | text |
| Activité secondaire | `secondaryActivity` | `TEXT_FIELDS` | text |
| Société mère | `parentCompany` | `TEXT_FIELDS` | text |
| Adresse | `address` | `TEXT_FIELDS` | text |
| Numéro CNPS | `cnpsNumber` | `TEXT_FIELDS` | text |
| Fax | `fax` | `TEXT_FIELDS` | text |
| Capital social (FCFA) | `socialCapital` | separate | number |
| Type d'entité | `entityType` | separate | select of the seven types |
| Région / Département / Arrondissement | `region` / `department` / `subdivision` | `CameroonGeographySelector` | cascade |

### 4.2 Current submit payload

`buildCorrections()` (`page.tsx:119-143`) sends **only the fields that changed**,
compared key by key against the prefilled state:

- **Text fields:** each changed `TEXT_FIELDS` key, as a string.
- **`socialCapital`:** sent as a number, and omitted when cleared.
- **`entityType`:** sent only when changed and non-empty.
- **Territory:** `region`, `department` and `subdivision` travel together whenever any of the three changed. `submit()` refuses a move without a subdivision.

An empty object is a valid resubmission: it is the status flip alone. The request is
`POST /auth/resubmit-registration` (`user-directory.ts:218`), typed by
`RegistrationCorrections` (`user-directory.ts:200-214`).

**Server side** (`auth.controller.ts:357-365`):
- `@AllowInactiveCompany({ statuses: [COMPLEMENTS_REQUESTED] })`.
- The pipe is `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, skipMissingProperties: false })`, so **an unknown key is a 400**.
- The DTO is `ResubmitRegistrationDto` (`src/auth/dto/resubmit-registration.dto.ts`):

  ```ts
  @IsOptional() @IsString() name, taxNumber, mainActivity, secondaryActivity, parentCompany, address, cnpsNumber, fax
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) socialCapital
  @IsOptional() @IsEnum(OnefopEntityType) entityType
  @IsOptional() @IsString() region, department, subdivision, regionId, departmentId, subdivisionId
  ```

**Service:** `AuthService.resubmitRegistration` (`auth.service.ts:1355-1472`) runs one
transaction:

1. Flip `COMPLEMENTS_REQUESTED → PENDING_APPROVAL` with a guarded `updateMany`; a count of 0 is a 409.
2. For each field in `CORRECTABLE_COMPANY_FIELDS` that is present in the body, `record(field, before, after)`. This fills `updates` (for `Company`) and `changes` (for the diff).
3. If any territory key is present, resolve the chain with `resolveAndValidateTerritory` and record the resolved names and ids.
4. Pre-check `taxNumber` uniqueness against other companies (409).
5. `tx.company.update({ data: updates })`. Its `P2002` is mapped to "Une entreprise avec ce numéro contribuable existe déjà".
6. Audit `COMPANY_REGISTRATION_RESUBMITTED` with `{ companyId, previousStatus, changes }`. The reviewer's dialog reads this through `lastResubmissionByUser`.
7. Re-read and return the user plus the company.

### 4.3 What it can change today

`CORRECTABLE_COMPANY_FIELDS` (`auth.service.ts:1342-1353`) lists `name`, `taxNumber`,
`mainActivity`, `secondaryActivity`, `parentCompany`, `address`, `cnpsNumber`, `fax`,
`socialCapital` and `entityType`. The territory chain is handled separately.

**Of the four values the review will verify:**
- **Name and CNPS** are correctable.
- **The entity phone and the email are not.** They are absent from the form, the DTO, `RegistrationCorrections` and the correctable list.

**Side effect of the shared field list.** Because every type sees the same list, a
cooperative or VT applicant can already type a CNPS during correction, even though
their registration form never asked for one.

### 4.4 What adding phone and email requires

**Entity phone (`Company.phone`).** A Company column, so it fits the existing path.

| Layer | Change |
|---|---|
| Form | One more `TEXT_FIELDS` entry, labelled "Téléphone / WhatsApp". Prefill already works: `getMyCompany` selects `phone` (`dsmo.service.ts:83`). The diff and payload logic pick it up through the `TEXT_FIELDS` loop. |
| Client type | `RegistrationCorrections` gains `phone`. |
| DTO | `ResubmitRegistrationDto` gains `phone` (optional string). |
| Service | Add `phone` to `CORRECTABLE_COMPANY_FIELDS`. `record()`, `company.update` and the audit diff then handle it unchanged. |
| Reviewer display | `FIELD_LABELS` in `react-web/src/app/admin/inscriptions/page.tsx:45` gains `phone`, so the diff row is not shown under the raw key. |

**Email (`User.email`).** A User column, so the Company path does not cover it.

- **Form:**
  - **Prefill source.** `getMyCompany` returns no email. The form's initial value comes from the authenticated user instead (`useAuthStore((s) => s.user).email`, already loaded on this page). `formStateFrom(profile)` builds state from the company profile only, so the email seed is an addition alongside it.
  - **Diff.** `buildCorrections` compares against the same initial state.
  - **Label.** It should say the address is both the login and the contact address, because changing it changes how the declarant signs in.
- **Client type:** `RegistrationCorrections` gains `email`.
- **DTO:** `ResubmitRegistrationDto` gains `email`, validated as an email (not merely a string). The public registration DTO uses `@IsEmail()` for the same field.
- **Service:** a write to `User` inside the existing transaction, separate from `company.update`. Concretely:
  - **Not through `CORRECTABLE_COMPANY_FIELDS` / `updates`.** Those go to `tx.company.update`, and `Company` has no `email` column.
  - **Recorded in `changes`.** The `COMPANY_REGISTRATION_RESUBMITTED` audit diff and the reviewer's "Corrections envoyées" table should show `email` before and after, like the company fields.
  - **Uniqueness.** `User.email` is `@unique`. Pre-check against other users, excluding the actor, for a readable 409, and catch `P2002` on the user update as a backstop. **The existing `P2002` handler wraps only `company.update` and its message is about the NIU.** Reusing it would tell a declarant their *tax number* is taken when it is their email.
  - **Case sensitivity.** Registration only trims the email; it does not lowercase it. `isEmailAvailable` and the unique index are exact-match. A correction can therefore introduce a case-variant duplicate of another account's address. This exists today at registration too; flag it rather than solve it here.
- **Side effects of changing `User.email`:**
  - **Login.** The new address becomes the login identifier immediately. `establishmentId` is not issued until approval, so a pending applicant has no other identifier. The current session continues: the JWT strategy re-reads the user from the database on every request (`jwt.strategy.ts:41`). After success, `refreshUser()` (`/auth/me`) puts the new email in the auth store.
  - **Notifications.** The approval, rejection and complements emails all read `user.email` at send time, so they go to the new address automatically.
  - **Email verification.** Registration set `emailVerified: false` and mailed a verification link to the *old* address (`auth.service.ts:709`, `:783`). Should an email change reset `emailVerified` and send a link to the new address? `emailVerified` gates nothing today (no guard or UI reads it), so either choice is safe; it needs a ruling.
- **Reviewer display:** `FIELD_LABELS` gains `email`.

**Tests**

| File | Change |
|---|---|
| `src/auth/auth.registration-resubmission.spec.ts`, DTO block (`:20-57`) | Add: `phone` accepted as a string; `email` accepted when valid and refused when malformed; a non-string `phone` refused. The "refuses an unknown key" test (`:27`) uses `establishmentId` and `totalEmployees`, so it is unaffected. |
| same file, service block (`:133+`) | Add: `phone` change written through `tx.company.update` and present in the audit `changes`. `email` change written through a `tx.user` update, **not** through `company.update`, and present in `changes`. Email-only correction → no `company.update`. Taken email → 409 with an email-specific message, and nothing written (the status flip happens inside the same transaction and is rolled back). Unchanged email → no user write and no diff entry. The transaction mock (`tx`) needs the user lookup and update methods this path uses. |
| `react-web` | The correction page has no test file. If the corrections builder is extracted to a pure helper, test that only changed keys, including `phone` and `email`, are emitted. That is optional, and only worth it if the extraction happens. |

---

## Step 5: Report

### 5.1 Public wizard (`/register`)

| Field | Label today | Request key | Schema column | Required | Change |
|---|---|---|---|---|---|
| Entity phone (all 7 types) | Téléphone (en: Phone) | `phone` | `Company.phone` | Yes | **Relabel** to "Téléphone / WhatsApp" (en: "Phone / WhatsApp"); keep `hint`, key, requiredness and position. |
| Entity phone 2 (all 7) | Téléphone 2 | `phone2` | `Company.phone2` | No | None |
| P.O. box (all 7) | Boîte postale | `poBox` | `Company.poBox` | No | None. Stays last in the contact block. |
| CNPS, enterprise | N° CNPS | `cnpsNumber` | `Company.cnpsNumber` | No | **Becomes required** |
| CNPS, cooperative | — | — | `Company.cnpsNumber` | — | **Add**, required |
| CNPS, ctd | — | — | `Company.cnpsNumber` | — | **Add**, required |
| CNPS, ong | — | — | `Company.cnpsNumber` | — | **Add**, required |
| CNPS, vocationalTraining | — | — | `Company.cnpsNumber` | — | **Add**, required |
| CNPS, administration / projectProgram | — | — | — | — | None |
| VT promoter phones | Promoteur — Tél. 1 / Tél. 2 | `promoterPhone1` / `promoterPhone2` | `Company.promoterPhone1/2` | Yes / No | None |
| Declarant phone 1 | Téléphone 1 | `respondentPhone` | `Company.respondentPhone` | Yes | None. Not relabelled, per the decision. |
| Declarant phone 2 | Téléphone 2 | `respondentPhone2` | `Company.respondentPhone2` | No | None |
| Email (login + ONEFOP contact) | Email professionnel | `email` | `User.email` | Yes | **Label/help text to state the dual role.** Exact wording is a copy decision. The key, the column and the availability check are unchanged. |

**Fields to add.** `cnpsNumber`, required, labelled "N° CNPS" (the enterprise label), for
cooperative, ctd, ong and vocationalTraining. Each is a new entry in that type's
`ENTITY_CONFIGS[...].fields`. `submit()` already sends `cnpsNumber:
visibleData.cnpsNumber` (`register/page.tsx:578`), so no payload change is needed: the
key stops being filtered out once the type declares it.

**Fields to relabel.** The shared `PHONE` constant, used by all seven types. This one
change covers every type in both wizards, plus the review summary and the
missing-field notices, which read the field label.

**Fields whose requiredness changes.** Enterprise `cnpsNumber`, from `required: false`
to `true`. Two comments describe CNPS as one of the optional fields that motivate
deferred auto-advance, and need updating: the "Advance arming" comment in
`register/page.tsx:259-264` ("optional ones (phone 2, CNPS)") and
`register-entity-sections.ts:111-114` ("CNPS, the second phone"). Neither changes
behaviour.

**Layout impact** (`register-entity-sections.ts`):

| Type | Block that receives `cnpsNumber` | Position in `ENTITY_CONFIGS` | Last field after the change |
|---|---|---|---|
| enterprise | "Fiscalité et affiliation" (already there) | unchanged | `poBox` |
| cooperative | "Identité de la coopérative", which already holds `taxNumber` | after `TAX_NUMBER` | `poBox` |
| ctd | "Identification de la CTD", which holds `taxNumber` | after `TAX_NUMBER` | `poBox` |
| ong | "Enregistrement et mission", which holds `registrationNumber` and `taxNumber` | after `TAX_NUMBER` | `poBox` |
| vocationalTraining | "Identification du centre", which holds `taxNumber` | after `TAX_NUMBER` | `promoterPhone2` |

The last field of section 3 stays optional for every type, so
`register-required.test.ts:95` holds. Every new field has a layout entry, so
`register-entity-sections.test.ts:21` and `:40` hold.

The block headings "Identité de la coopérative" and "Identification de la CTD" do not
mention social security, unlike enterprise's "Fiscalité et affiliation". Whether to
rename them is a copy decision outside this plan.

**Server side, needed for the requiredness to be real.** `CompanyRegistrationFieldsDto`
marks `cnpsNumber` `@IsOptional()`. To enforce the new rule for API clients too,
including the legacy Flutter registration, which does not collect CNPS for the four
types, it needs `@ValidateIf` on the five entity types. That is the same pattern the
VT fields use (`register-company.dto.ts:78-106`). The DTO is shared, so this one
change covers both routes.

### 5.2 Assisted wizard (`/admin/inscriptions/nouvelle`)

| Field | Label today | Request key | Schema column | Required | Change |
|---|---|---|---|---|---|
| Entity phone (all 7) | Téléphone | `phone` | `Company.phone` | Yes | Relabel through `PHONE`, so automatic |
| Entity phone 2 / P.O. box | Téléphone 2 / Boîte postale | `phone2` / `poBox` | `Company.phone2` / `poBox` | No | None |
| CNPS, enterprise | N° CNPS | `cnpsNumber` | `Company.cnpsNumber` | No | Becomes required, automatically |
| CNPS, cooperative / ctd / ong / VT | — | `cnpsNumber` (already in the payload) | `Company.cnpsNumber` | — | Added and required, automatically through `ENTITY_CONFIGS` |
| Declarant phone | **Téléphone** | `respondentPhone` | `Company.respondentPhone` | No | None required by the decision. **Note:** after the relabel the entity phone reads "Téléphone / WhatsApp" and the declarant phone still reads "Téléphone" on the same page. The public wizard calls it "Téléphone 1". Aligning the two is a one-word label decision. |
| Declarant phone 2 | Téléphone 2 | `respondentPhone2` | `Company.respondentPhone2` | No | None |
| Email | Adresse e-mail (hint: "Identifiant de connexion du déclarant.") | `email` | `User.email` | Yes | Hint to state the dual role (login + ONEFOP contact). |

- **Fields to add:** none by hand. The four new CNPS fields arrive through the shared config. `submit()` already sends `cnpsNumber: data.cnpsNumber` (`nouvelle/page.tsx:175`).
- **Fields to relabel:** entity phone, automatically. Declarant phone and email hint, per the notes above.
- **Requiredness:** enterprise CNPS becomes required, automatically. `firstProblem()` reads `field.required`.
- **Layout impact:** none. The flat grid follows `ENTITY_CONFIGS` order and has no auto-advance.

### 5.3 Correction flow (`/home/inscription-en-attente`)

**Fields to add to the form**

| Field | Label | Prefill | Note |
|---|---|---|---|
| `phone` | Téléphone / WhatsApp | `getMyCompany().phone` | A `TEXT_FIELDS` entry |
| `email` | Wording stating login + contact role | `useAuthStore` user `email` | Not from `CompanyProfile`; seeded alongside `formStateFrom`. Same "changed only" rule in `buildCorrections`. |

**Fields to add to the DTO** (`src/auth/dto/resubmit-registration.dto.ts`)

| Field | Validation |
|---|---|
| `phone` | optional, string |
| `email` | optional, email format |

**Client type.** `RegistrationCorrections` (`react-web/src/lib/user-directory.ts:200`)
gains `phone` and `email`.

**Fields to add to the service update path** (`AuthService.resubmitRegistration`)

| Field | How |
|---|---|
| `phone` | Add to `CORRECTABLE_COMPANY_FIELDS`. The existing `record()`, `company.update` and audit diff cover it. |
| `email` | A separate `User` write in the same transaction: compare with `user.email`; pre-check uniqueness against other users (409 with an email-specific message); update the user; record `email` in `changes`; catch `P2002` on that write separately from the NIU-worded handler. Ruling needed on resetting `emailVerified` and re-sending verification to the new address. |

**Reviewer side.** `FIELD_LABELS` in `react-web/src/app/admin/inscriptions/page.tsx`
gains `phone` and `email`, so the "Corrections envoyées" table names them. The diff
itself needs no other change, since it reads `changes` from the audit entry.

**Tests to change.** `src/auth/auth.registration-resubmission.spec.ts`, DTO and service
blocks, as listed in §4.4. No other existing test covers the correction flow.

### 5.4 Tests for the wizard changes

| File | Change |
|---|---|
| `react-web/src/lib/register-constants.test.ts` | Add: enterprise, cooperative, ctd, ong and vocationalTraining declare a required `cnpsNumber`; administration and projectProgram declare none. Every type's `phone` field carries the "Téléphone / WhatsApp" label. |
| `react-web/src/lib/register-required.test.ts` | No edit expected. `:65`, `:81` and `:95` must stay green. Re-run them as the layout check. |
| `react-web/src/lib/register-entity-sections.test.ts` | No edit expected. `:21` and `:40` must stay green. |
| `react-web/src/lib/register-summary.test.ts` | No edit expected. Labels are read from the config. |
| `src/auth/assisted-registration.spec.ts`, plus a DTO-level test for `CompanyRegistrationFieldsDto` | Add: `cnpsNumber` required for the five types and optional for administration and projectProgram, on both routes, since they share the DTO. |
| Authoritative backend run | `jest --runInBand` |

### 5.5 Files affected

| File | Change |
|---|---|
| `react-web/src/lib/register-constants.ts` | `PHONE` label fr and en; enterprise `cnpsNumber` required; new required `cnpsNumber` on cooperative, ctd, ong and vocationalTraining (after `TAX_NUMBER`); optional-field comments updated. |
| `react-web/src/lib/register-entity-sections.ts` | `cnpsNumber` added to the identification block key lists of cooperative, ctd, ong and vocationalTraining; comment at `:111-114` updated. |
| `react-web/src/app/register/page.tsx` | Email label/help text for the dual role (through `messages/*.json`); comment at `:259` updated. No payload change. |
| `react-web/messages/fr.json`, `en.json` | Email label or hint wording (`registerPage.professionalEmailLabel` or a new hint key). |
| `react-web/src/app/admin/inscriptions/nouvelle/page.tsx` | Email hint wording; optionally the declarant phone label. No payload change. |
| `react-web/src/app/home/inscription-en-attente/page.tsx` | `phone` in `TEXT_FIELDS`; `email` field seeded from the auth user and included in `buildCorrections`. |
| `react-web/src/lib/user-directory.ts` | `RegistrationCorrections` gets `phone` and `email`. |
| `react-web/src/app/admin/inscriptions/page.tsx` | `FIELD_LABELS` gets `phone` and `email`. |
| `src/auth/dto/register-company.dto.ts` | `cnpsNumber` `@ValidateIf` for the five types. |
| `src/auth/dto/resubmit-registration.dto.ts` | `phone` (string), `email` (email). |
| `src/auth/auth.service.ts` | `phone` in `CORRECTABLE_COMPANY_FIELDS`; email update path in `resubmitRegistration` (uniqueness, separate `P2002` handling, diff entry). |
| Test files | As in §4.4 and §5.4. |

**No schema change and no migration.**

### 5.6 Decisions still needed

1. **Email copy.** The exact wording that states the dual role (login + ONEFOP contact), in the public label/hint, the assisted hint and the correction field.
2. **Email verification on change.** Should changing the email in the correction flow reset `emailVerified` and send a new verification link? It gates nothing today.
3. **Assisted declarant phone label.** Keep "Téléphone", or align with the public "Téléphone 1" now that the entity phone becomes "Téléphone / WhatsApp" on the same page?
4. **Correction form field list.** It shows the same fields for every entity type, including `parentCompany`, `fax` and `cnpsNumber` for types that never collected them. Out of scope here; noted because adding `phone` and `email` extends the same list.
5. **Legacy Flutter registration** (`lib/screens/register_constants.dart`). It sends no CNPS for cooperative, ctd, ong and VT, so it would be refused once the server enforces the rule. Same caveat as in the review-redesign plan.
