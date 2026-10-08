# RFC: Evaluation of Macro Scoping Pre-Quiz vs. Field-Level Conditional Rules for Vocational Training (VT / Formulaire 7)

- **Status**: Deferred to v3 / Rejected for v2 (Retain Field-Level Conditional Visibility)
- **Author**: Platform & Statistical Architecture Team
- **Target Subsystem**: `react-web/src/components/onefop/`, `react-web/src/lib/onefop-schema.ts`
- **Related Issues**: `D5` (Cascading visibility invalidation), `D10` (Transparency of zeroed/omitted tables), `V1` (Dual-layer submission validation)

---

## 1. Executive Summary

During the declaration remediation audit, a proposal was raised to introduce a preliminary "scoping pre-quiz" for Vocational Training (VT / Formulaire 7), analogous to the pre-quiz questionnaire utilized in the Modern Jobs / Enterprise flow (`ModernJobsWizard`). The intention of such a quiz would be to allow respondents to toggle high-level questions upfront (e.g., "Do you host apprentices?", "Did you receive external funding?") and skip entire non-applicable tables or sections.

Following thorough technical and statistical review, **this RFC recommends against introducing a macro scoping pre-quiz for VT in v2**. Instead, VT will continue to utilize its **61 canonical field-level visibility rules**, reinforced with **recursive dependency invalidation (`cleanHiddenDependentFields` - Task 3.2 / D5)** and **transparent certified zeroing (`getZeroedTablesList` - Task 3.1 / D10)**.

A macro scoping quiz for VT may only be revisited in v3 after a formal domain review by MINEFOP statistical directors and vocational training inspectors.

---

## 2. Background and Context

### 2.1 The Modern Jobs Model
In the Modern Jobs / Enterprise declaration (`Formulaire 1`), sections such as Headcount (`T1`), Terminations (`T2`), and Vacancies (`T3`) are relatively modular. A pre-quiz with 4 coarse-grained yes/no questions enables businesses with zero job movements to certify sections as `NONE` (0) upfront, reducing a 20-minute survey to under 3 minutes while maintaining statistical rigor.

### 2.2 The Vocational Training (VT) Reality
VT (`Formulaire 7 - Formation Professionnelle`) is fundamentally different in structure, legal governance, and operational reality:
1. **Official Legal Instrument**: Formulaire 7 is codified by decree under Cameroonian Law N° 91/023. The paper booklet issued to vocational training centres consists of **9 tightly serialized sections** (Identification, Infrastructure, Equipment, Pedagogical Programs, Enrollment, Apprenticeships/Internships, Assessment/Certification, Personnel & Trainers, Budget & Finances).
2. **Data Collection Reality**: In practice, survey enumerators and administrative officers at training institutions complete physical paper booklets on-site before transcribing entries into the digital platform. Any deviation from the physical booklet's linear sequence creates significant cognitive dissonance and transcription errors.
3. **Pervasive Granular Dependencies**: Unlike Modern Jobs where entire tables are toggled, Formulaire 7 relies on **61 fine-grained conditional rules** embedded directly into the survey logic.

---

## 3. Analysis of Existing VT Conditional Architecture (61 Rules)

A comprehensive audit of `react-web/src/lib/onefop-schema.ts` and `table.vt.cells` reveals 61 field-level visibility rules active across Formulaire 7. These rules operate at varying levels of depth:

| Section | Rule Target | Trigger Field | Condition | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Section 1: Identification & Agrément** | `VT1_13` (Date of decree), `VT1_13_OTHER` | `VT1_12` (Has ministry decree?) | `equals: "Oui"` | Conditionally requires legal accreditation metadata. |
| **Section 2: Infrastructure & Bâtiments** | Specific capacity sub-metrics | Ownership status / premise types | `equals: ...` | Hides leasehold fields if premises are owned. |
| **Section 4: Formations & Métiers** | `VT4_4` (Specialized modules) | `VT4_3` (Offers modular programs?) | `equals: "Oui"` | Hides curriculum detail if only general track. |
| **Section 5: Apprenants & Effectifs** | Specific disability/gender matrices | `VT5_2` (Enrolls vulnerable/disabled?) | `equals: "Oui"` | Conditionally prompts for demographic disaggregation. |
| **Section 6: Stages & Insertion** | `VT6_2` through `VT6_6` | `VT6_1` (Organizes internships/stages?) | `equals: "Oui"` | Gating an entire subsection of 5 dependent tables. |
| **Section 7: Évaluation & Examens** | Certifications & pass rates | Official examination registration | `equals: "Oui"` | Hides exam statistics if not an examination centre. |
| **Section 8: Formateurs & Roster** | `VT8_8` (Trainer qualifications/PII) | `VT8_7` (Employs external contractuals?) | `equals: "Oui"` | Hides external trainer rosters when all staff are civil servants. |

### 3.1 The Root Cause of Phantom Data (D5)
Previously, the primary issue with VT was not the absence of a pre-quiz, but **data residue from hidden fields (D5)**:
- When a respondent answered `"Oui"` to `VT6_1`, filled out internship details in `VT6_2`–`VT6_6`, and then later toggled `VT6_1` back to `"Non"`, the UI hid the fields, but the underlying JSON state still contained the detailed entries.
- These phantom values leaked into statistical aggregation, validation counters, and export pipelines.

### 3.2 The v2 Resolution (`cleanHiddenDependentFields`)
Task 3.2 directly resolves this problem at the schema and submission layer:
```typescript
// Multi-pass cascading prune executed before submission & validation
const cleanData = cleanHiddenDependentFields(entity, rawData);
```
With recursive invalidation active, whenever a parent toggle flips to `"Non"`, all child fields (and any deeper sub-dependents, up to 10 traversal depths) have their values and associated matrix cells permanently cleared.

---

## 4. Why a Macro Scoping Pre-Quiz is Detrimental for VT in v2

Introducing a macro pre-quiz for VT was evaluated against four core criteria:

### 4.1 Mismatch with Formulaire 7 Printed Booklet
- **Risk**: Survey respondents cross-referencing physical survey booklets would find the digital wizard disconnected from the paper form.
- **Impact**: When sections are conditionally skipped or re-ordered before the respondent even enters Section 1, field officers cannot follow the standard questionnaire flow, leading to user confusion and abandoned submissions.

### 4.2 Dual-Layer Filtering Fragility
- **Risk**: Combining a macro pre-quiz with 61 intra-table visibility rules introduces two competing gating layers.
- **Example**: If a pre-quiz asks "Do you provide vocational training internships?", but Section 6 also asks `VT6_1` ("Avez-vous des apprenants en stage pendant le trimestre ?"), the system must maintain two-way synchronization between the quiz answer and the section question. If they diverge, validation becomes inconsistent and confusing to debug.

### 4.3 Risk of Statistical Invalidation (PEA & Donor Reporting)
- **Risk**: In vocational training statistics (MINEFOP / PEA / World Bank indicators), the distinction between:
  1. **A true zero (`Néant` / 0)**: The institution operates the program but had zero admissions this quarter;
  2. **Non-applicable (`N/A`)**: The institution does not have the legal mandate or accreditation for this program;
  3. **Omitted / Missing**: The institution failed to report.
- A broad macro quiz tends to collapse these three distinct statistical states into a single skipped state, severely degrading data granularity for policymaking.

---

## 5. Architectural Decision & Roadmap

### 5.1 Final Decision for v2
1. **Maintain Canonical 9-Section Layout**: VT will retain the standard 9 sections matching Formulaire 7.
2. **Enforce Dynamic Invalidation (D5)**: `cleanHiddenDependentFields` is invoked automatically in `prepareSubmissionData` and in section completion calculations (`VtValidationScreen.tsx`).
3. **Surface Transparent Certified Zeroes (D10)**: Whenever a scoping rule or preliminary answer certifies tables to zero, the review screen and PDF modal explicitly notify the respondent while preserving raw keystrokes in `rawData` for administrative traceability.

### 5.2 Prerequisites for any Future v3 VT Quiz
Before any macro scoping mechanism is introduced for VT in future versions:
1. **MINEFOP Domain Panel**: Formal review and written validation by the MINEFOP Division des Statistiques and Direction de la Formation Professionnelle.
2. **Revision of Formulaire 7 Guidelines**: Explicit alignment of the printed booklet instructions to indicate that certain sections are skippable via a preliminary section.
3. **Formal Schema Mapping**: Elimination of redundant field-level toggles in favor of single-source-of-truth quiz variables.

---

## 6. Verification and Compliance

- **Schema Integrity**: All 61 visibility rules verified across `react-web/src/lib/onefop-schema.ts`.
- **Validation**: Hidden fields do not trigger false-positive validation errors in `validateSectionData` or `getSectionStats`.
- **Submission**: Clean payloads verified by `prepareSubmissionData` ensuring zero residual or phantom fields.
