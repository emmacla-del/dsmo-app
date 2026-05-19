# ONEFOP Questionnaire Form Structure Analysis

## FORM 1: ENTREPRISES (ENTERPRISES)

**File:** Questionnaire_ENTREPRISES ONEFOP .docx  
**Total Paragraphs:** 40  
**Total Tables:** 11  
**Pages:** 2+ (standard format based on structure)

### Header Section
- Row 0: "REPUBLIQUE DU CAMEROUN / Paix – Travail – Patrie" | "" | "REPUBLIC OF CAMEROON / Peace – Work – Fatherland"
- Row 1: "----------" | "" | "----------"
- Row 2: "MINISTERE DE L'EMPLOI ET DE LA FORMATION PROFESSIO[NNELLE]" | "" | "MINISTRY OF EMPLOYMENT AND VOCATIONAL TRAINING"
- Row 4: "SECRETARIAT GENERAL" | "" | "SECRETARIAT GENERAL"
- Row 6: "OBSERVATOIRE NATIONAL DE L'EMPLOI ET DE LA FORMATI[ON]" | "" | "NATIONAL OBSERVATORY OF EMPLOYMENT AND VOCATIONAL [TRAINING]"

---

### Section 0 (IDENTIFICATION DU REPONDANT / RESPONDENT IDENTIFICATION)
**Location:** Paragraph 13  
**Q Codes & Fields:**
- **S0Q01:** Noms, prénoms du répondant / Respondent's full name
- **S0Q02:** Fonction du répondant / Respondent's function : ___
- **S0Q03:** Contacts répondant / RespondentŒs contacts : Tél 1

**Table:** 3 rows × 2 cols (Table 1)

---

### Section 1 (IDENTIFICATION DE L'ENTREPRISE / COMPANY DETAILS)
**Location:** Paragraph 15  
**Q Codes & Fields (12 questions):**
- **S1Q01:** Quelle est le régime/statut juridique de votre institution / What is the legal status/regime of your institution
  - 1. SARL / LLC
  - 2. SA / LTD
  - 3. EIRL / Sole Proprietorship
  - 4. AUTO-ENTREPRENEUR / Self-employed
- **S1Q02:** Nom de l'entreprise / Company name : ______________
- **S1Q03:** Milieu de résidence / Area : 1.Urbain / Urban 2.Rural / Rural
- **S1Q04:** Région / Region : _______________________|__|__|
- **S1Q05:** Tél 1 / Tel 1 : |__|__|__|__|__|__|__|__|__|
- **S1Q06:** Tél 2 / Tel 2 : |__|__|__|__|__|__|__|__|__|
- **S1Q07:** Secteur d'activité / Business sector : 1.Primaire / Primary
- **S1Q08:** Branche d'activité / Branch of activity : ___________
- **S1Q09:** Activité principale / Main activity : _______________
        Siège social de l'entreprise / Company's head office : _______________
- **S1Q10:** Nombre d'employé permanent / Number of permanent workers : |__|__|__|__|
- **S1Q11:** Nombre de poste vacant / Number of vacancies : |__|__|__|
- **S1Q12:** Taille de l'entreprise / Enterprise size : 1.TP|2.PME|3.ETM|4.ETL

**Table:** 12 rows × 5 cols (Table 2)

---

### Section 2 (EMPLOI ET TRAVAIL / EMPLOYMENT AND LABOUR)
**Location:** Paragraphs 17-34

#### S2.1 - DEMANDE D'EMPLOIS / JOB APPLICATIONS
**Q Code:** S21Q01  
**Question:** Combien de demandes d'emplois avez-vous reçues depuis le ... / How many job applications have you received since...

**Table Structure (S21Q01):** 7 rows × 13 cols (Table 3)
- **Row Headers:**
  - Sexe / Sex: Masculin / Male, Feminin / Female, TOTAL
  - Tranche d'âge (ans) / Age group (years): 15 à 24 / 15 to 24, 25 à 34 / 25 to 34, 35 et + / 35 and above, Total
- **CSP Categories (Row Labels):**
  - Cadres / Executives
  - Agents de Maîtrise / Foremen
  - Agents d'exécution / Field workers
  - TOTAL
- **Total Columns:** 13
  - M: 15-24, 25-34, 35+, Total
  - F: 15-24, 25-34, 35+, Total
  - TOTAL: 15-24, 25-34, 35+, Total

---

#### S2.2 - RECRUTEMENTS / RECRUITMENTS
**Location:** Paragraph 20

##### S22Q01: Combien de permanents avez-vous recruté depuis...
**Table Structure:** 14 rows × 13 cols (Table 4)
- **Section Rows 0-6:** S22Q01 — Permanents recruitment
  - Same CSP structure (Cadres, Agents de Maîtrise, Agents d'exécution, TOTAL)
  - Same gender/age structure
- **Section Rows 7-13:** S22Q02 — Temporaires recruitment (same structure)

**Column Structure:** Same as S21Q01 (13 cols: by gender, age group, and totals)

##### S22Q03: Combien de personnes avez-vous recruté selon le diplôme...
**Table Structure:** 16 rows × 13 cols (Table 5)
**Row Labels (Education Levels):**
- CEP / CEPE / FSLC/
- BEPC / CAP / GCE-OL
- PROBATOIRE / Lower sixth
- BAC / GCE-AL
- BTS/DUT / HND
- Licence (Bac+3) / Bachelor
- Maîtrise (Bac +4) / Master 1
- Master (Bac +5) / Master 2
- DQP / PQD
- CQP / CPQ
- Autres / Others
- Sans diplôme / Without diploma
- TOTAL

**Column Structure:** Identical to S21Q01 (13 cols)

##### S22Q04: Personnes en situation de handicap
**Table Structure:** 14 rows × 8 cols (Table 6)
- **Rows 0-6:** S22Q04 — Persons with disabilities
  - CSP / SPC categories
  - Column headers: Permanent (M, F, T), Temporaire (M, F, T), Total
- **Rows 7-13:** S22Q05 — Vulnerable persons
  - **Row Labels:** Cadres, Agents de Maîtrise, Agents d'exécution, TOTAL
  - **Vulnerability Types:** Déplacés internes / Internal displaced, Réfugiés / Refugees, Orphelins / Orphans
  - Same column structure as S22Q04

---

#### S2.3 - PRIMO DEMANDEUR / FIRST-TIME JOB SEEKERS
**Location:** Paragraph 28

##### S23Q01: Combien de personnes recherchant leur premier emploi avez-vous recruté...
**Table Structure:** 19 rows × 23 cols (Table 7)
- **Header Row Pattern:** Sexe/Sex, Multiple age groups with duplicates for M/F subcategories
- **CSP Categories:**
  - Cadres / Executives
  - Agents de Maîtrise / Foremen
  - Agents d'exécution / Field workers
  - TOTAL
- **Column Structure:** Complex multi-level headers
  - Sexe/Sex: Masculin/Male, Feminin/Female, TOTAL
  - Dans chaque : 15 à 24, 25 à 34, 35 et +, Total
  - Leading to 23 columns total

##### S23Q02: Combien de personnes travaillant pour la première fois avez-vous recruté...
**Table Structure:** 19 rows × 23 cols (Row 7 of Table 7)
- **Status Types:**
  - Permanent / Permanent
  - Temporaire / Temporary
  - TOTAL
- **CSP Categories (within each status):**
  - Cadres / Executives
  - Agents de Maîtrise / Foremen
  - Agents d'exécution / Field workers
  - Total (for each status)
- **Column Structure:** Same multi-level as S23Q01

---

### Section 3 (DEPARTS / DEPARTURES)
**Location:** Paragraph 35

#### S3Q01: Combien de départs avez-vous enregistrés...
**Table Structure:** 13 rows × 19 cols (Table 8)
- **Departure Type Columns:**
  - Licenciements / Dismissal (M, F, T)
  - Démissions / Resignation (M, F, T)
  - Départ à la retraite / Retirement (M, F, T, T)
  - Autres départs / Other departure (M, F, F, T)
  - Ensemble / Whole (M, M, F, T)
- **CSP Categories (Row Labels):**
  - Cadres / Executives
  - Agents de Maîtrise / Foremen
  - Agents d'exécution / Field workers
  - Total

#### S3Q02: Quels sont les principaux motifs de licenciement...
**Table Structure:** 13 rows × 19 cols (Rows 7-12 of Table 8)
- **Motif Fields:**
  - Motif 1 / Reason 1 : ______________________________
  - Motif 2 / Reason 2 : ______________________________
  - Motif 3 / Reason 3 : ______________________________
  - Total (row label)

#### S3Q03: Combien de personnes avez-vous licenciées pour motif économique...
**Table Structure:** 7 rows × 8 cols (Table 9)
- **Dismissal Type Columns:**
  - Licenciement / Dismissal (M, F, Total)
  - Chômage technique / Technical unemployment (M, F, Total)
  - Total
- **CSP Categories:**
  - Cadres / Executives
  - Agents de Maîtrise / Foremen
  - Agents d'exécution / Field workers
  - TOTAL

---

### Section 4 (STAGE ET FORMATION / INTERNSHIP AND TRAINING)
**Location:** Paragraph 37

#### S4Q01: Combien de stagiaires avez-vous recrutés...
**Table Structure:** 22 rows × 4 cols (Table 10)

**Internship Types (Rows 3-7):**
- Stage de vacance / Holiday jobs
- Stage académique / Academic internship
- Stage professionnelle / Professional internship
- Stage pré-emploi / Pre-work internship
- Total

**Columns:** Nature du stage / Nature of internship, Sexe/M, Sexe/F, Total

#### S4Q02: Quels sont les besoins en compétence de votre entity...
**Table Structure (Rows 8-14):**
- **Skill Fields:**
  - Compétence 1 / Skill 1 : ___________________________
  - Compétence 2 / Skill 2 : ___________________________
  - Compétence 3 / Skill 3 : ___________________________
  - Total

**Columns:** Compétence/Skill, Sexe/M, Sexe/F, Total

#### S4Q03: Quels sont les besoins en formation des personnes...
**Table Structure (Rows 15-21):**
- **Training Domains:**
  - Domaine 1 / Domain 1 : ____________________________
  - Domaine 2 / Domain 2 : ____________________________
  - Domaine 3 / Domain 3 : ____________________________
  - Total

**Columns:** Domaine de formation/Domain of training, Sexe/M, Sexe/F, Total

---

## FORM 2: COOPERATIVE

**File:** Questionnaire_Coopérative ONEFOP .docx  
**Total Paragraphs:** 40  
**Total Tables:** 11  
**Pages:** 2+ (standard format based on structure)

### Key Differences from ENTREPRISES

#### Section 0 - IDENTICAL
- S0Q01, S0Q02, S0Q03 (same)

#### Section 1 (IDENTIFICATION DE LA COOPERATIVE / COOPERATIVE DETAILS)
**Q Codes & Fields (12 questions):**
- **S1Q01:** Nom de la coopérative / Cooperative name : ________
- **S1Q02:** Siège social : ___________________________________
- **S1Q03:** Année de création de la coopérative / Cooperative creation year : ___
- **S1Q04:** Milieu de résidence / Area : 1.Urbain / Urban 2.Rural / Rural
- **S1Q05:** Région / Region
- **S1Q06:** Tél 1 / Tel 1, Tél 2 / Tel 2
- **S1Q07:** Secteur d'activité / Business sector
- **S1Q08:** Branche d'activité / Branch of activity
- **S1Q09:** Activité principale / Main activity
- **S1Q10:** Type de la coopérative : 1. Coopérative à comptabilité 2. Coopérative à comptabilité simplifiée
- **S1Q11:** Nombre d'employé permanent / Number of permanent workers
- **S1Q12:** Nombre de poste vacant / Number of vacancies

#### Sections 2, 3, 4 - IDENTICAL to ENTREPRISES
- Same table structures for S21Q01, S22Q01-S22Q05, S23Q01-S23Q02
- Same S3Q01-S3Q03 structures
- Same S4Q01-S4Q03 structures

---

## FORM 3: CTD (REPRÉSENTATION LÉGALE DÉCENTRALISÉE / RLA)

**File:** Questionnaire_CTD ONEFOP .docx  
**Total Paragraphs:** 40  
**Total Tables:** 11  
**Pages:** 2+ (standard format based on structure)

### Key Differences from ENTREPRISES

#### Section 0 - IDENTICAL
- S0Q01, S0Q02, S0Q03 (same)
- **Text Change:** "IDENTIFICATION DU REPONDANT DE LA CTD / IDENTIFICATION OF RLA RESPONDENT"

#### Section 1 (IDENTIFICATION DE LA CTD / RLA DETAILS)
**Table:** 10 rows × 4 cols (Table 2) — **Note: Shorter than ENTREPRISES (12 rows)**

**Q Codes & Fields (10 questions - REDUCED):**
- **S1Q01:** Type de CTD / Type of RLA : 1. Région / Region 2. Département / Department 3. Commune / Municipality
- **S1Q02:** Si 2, Quel est le type de Commune / If 2, what type of Commune
- **S1Q03:** Année de création de la CTD / Year of creation of RLA
- **S1Q04:** Milieu de résidence / Area : 1.Urbain / Urban 2.Rural / Rural
- **S1Q05:** Région / Region
- **S1Q06:** Tél 1 / Tel 1, Tél 2 / Tel 2
- **S1Q07:** Secteur d'activité / Business sector
- **S1Q08:** Branche d'activité / Branch of activity
- **S1Q09:** Nombre d'employé permanent / Number of permanent workers
- **S1Q10:** Nombre de poste vacant / Number of vacancies

**Skipped Questions:** NO S1Q11 (Type), NO S1Q12 (Size) compared to ENTREPRISES

#### Sections 2, 3, 4 - IDENTICAL to ENTREPRISES
- Same table structures for all employment, departures, and training sections

---

## FORM 4: ONG (NON-GOVERNMENTAL ORGANIZATION)

**File:** Questionnaire_ONG ONEFOP .docx  
**Total Paragraphs:** 40  
**Total Tables:** 11  
**Pages:** 2+ (standard format based on structure)

### Key Differences from ENTREPRISES

#### Section 0 - IDENTICAL
- S0Q01, S0Q02, S0Q03 (same)
- **Text Change:** "IDENTIFICATION DU REPONDANT DE L'ENTREPRISE / IDENTIFICATION OF ENTERPRISE RESPONDENT" (NOTE: Same as ENTREPRISES, not updated)

#### Section 1 (IDENTIFICATION DE L'ONG / NGO DETAILS)
**Table:** 11 rows × 5 cols (Table 2) — **Intermediate length between ENTREPRISES (12) and CTD (10)**

**Q Codes & Fields (11 questions):**
- **S1Q01:** Nom de l'ONG / NGOŒs name : _______________________
- **S1Q02:** Siège social / NGO head office : __________________
- **S1Q03:** Année de création de l'ONG / Year of creation of NGO
- **S1Q04:** Milieu de résidence / Area : 1.Urbain / Urban 2.Rural / Rural
- **S1Q05:** Région / Region
- **S1Q06:** Tél 1 / Tel 1, Tél 2 / Tel 2
- **S1Q07:** Secteur d'activité / Business sector
- **S1Q08:** Branche d'activité / Branch of activity
- **S1Q09:** Quelle est votre mission principale ? / What is your primary mission ?
- **S1Q10:** Nombre d'employé permanent / Number of permanent workers
- **S1Q11:** Nombre de poste vacant / Number of vacancies

**Skipped Questions:** NO S1Q12 (Size/Type comparison to ENTREPRISES)  
**Extra Question:** S1Q09 replaces ENTREPRISES section about headquarters — asks about NGO mission instead

#### Sections 2, 3, 4 - IDENTICAL to ENTREPRISES
- Same table structures for all employment, departures, and training sections

---

## COMPARISON MATRIX: SECTIONS BY ENTITY TYPE

| Section | Element | ENTREPRISES | COOPERATIVE | CTD | ONG |
|---------|---------|------------|-------------|-----|-----|
| **S0** | Respondent Info | ✓ S0Q01-03 | ✓ S0Q01-03 | ✓ S0Q01-03 | ✓ S0Q01-03 |
| **S1** | Entity ID Fields | 12 Questions | 12 Questions | 10 Questions | 11 Questions |
| **S1Q01** | Legal Status / Type | Status (SARL, SA, EIRL, Auto-entrepreneur) | Type (Simple/Complex Accounting) | Type (Région, Département, Commune) | Name Only |
| **S1Q02** | Entity Name / Status | Company Name | Cooperative Name | Commune Type | NGO Name |
| **S1Q09** | Primary Activity / HQ | Company HQ Address | Main Activity | Main Activity | NGO Mission |
| **S1Q10-11** | Staff & Vacancies | ✓ Both present | ✓ Both present | ✓ Both present | ✓ Both present |
| **S1Q12** | Size/Subtype | Enterprise Size (TP/PME/ETM/ETL) | Cooperative Type | ✗ NOT PRESENT | ✗ NOT PRESENT |
| **S2 (Employment)** | All subsections | ✓ S21, S22, S23 | ✓ S21, S22, S23 | ✓ S21, S22, S23 | ✓ S21, S22, S23 |
| **S21Q01** | Job Applications Table | ✓ 7x13 | ✓ 7x13 | ✓ 7x13 | ✓ 7x13 |
| **S22Q01-02** | Permanent/Temporary Recruit | ✓ Both | ✓ Both | ✓ Both | ✓ Both |
| **S22Q03** | By Education Level | ✓ 16x13 | ✓ 16x13 | ✓ 16x13 | ✓ 16x13 |
| **S22Q04** | Persons with Disabilities | ✓ 7x8 | ✓ 7x8 | ✓ 7x8 | ✓ 7x8 |
| **S22Q05** | Vulnerable Persons | ✓ 7x8 (Displaced, Refugees, Orphans) | ✓ 7x8 (Displaced, Refugees, Orphans) | ✓ 7x8 (Displaced, Refugees, Orphans) | ✓ 7x8 (Same) |
| **S23Q01** | First-time Job Seekers | ✓ 19x23 | ✓ 19x23 | ✓ 19x23 | ✓ 19x23 |
| **S23Q02** | First-time Workers | ✓ 19x23 | ✓ 19x23 | ✓ 19x23 | ✓ 19x23 |
| **S3 (Departures)** | All sections | ✓ S3Q01-03 | ✓ S3Q01-03 | ✓ S3Q01-03 | ✓ S3Q01-03 |
| **S3Q01** | Departures by Type | ✓ 13x19 | ✓ 13x19 | ✓ 13x19 | ✓ 13x19 |
| **S3Q02** | Dismissal Motives | ✓ 13x19 | ✓ 13x19 | ✓ 13x19 | ✓ 13x19 |
| **S3Q03** | Dismissals Detail | ✓ 7x8 | ✓ 7x8 | ✓ 7x8 | ✓ 7x8 |
| **S4 (Training)** | All sections | ✓ S4Q01-03 | ✓ S4Q01-03 | ✓ S4Q01-03 | ✓ S4Q01-03 |
| **S4Q01** | Internships | ✓ 7 types x 4 cols | ✓ 7 types x 4 cols | ✓ 7 types x 4 cols | ✓ 7 types x 4 cols |
| **S4Q02** | Skill Needs | ✓ 3 skills x 4 cols | ✓ 3 skills x 4 cols | ✓ 3 skills x 4 cols | ✓ 3 skills x 4 cols |
| **S4Q03** | Training Domains | ✓ 3 domains x 4 cols | ✓ 3 domains x 4 cols | ✓ 3 domains x 4 cols | ✓ 3 domains x 4 cols |

---

## CRITICAL TABLE DIMENSIONS SUMMARY

### Key Tables Used Across All Forms

| Question Code | Description | Rows | Cols | CSP Categories | Notable Row Types |
|---------------|-------------|------|------|-----------------|-------------------|
| **S21Q01** | Job Applications | 7 | 13 | 3 (Cadres, Agents Maîtrise, Agents Exécution) | Gender/Age breaks |
| **S22Q01-02** | Permanent & Temporary Recruitment | 14 | 13 | 3 CSP | Combined section in same table |
| **S22Q03** | Education Level Recruitment | 16 | 13 | 12 education levels | CEP through Sans diplôme |
| **S22Q04** | Persons with Disabilities | 14 | 8 | 3 CSP | Permanent/Temporary status |
| **S22Q05** | Vulnerable Persons | 14 | 8 | 3 CSP + 3 vulnerability types | Permanent/Temporary status |
| **S23Q01** | First-time Job Seekers | 19 | 23 | 3 CSP | Complex multi-level headers |
| **S23Q02** | First-time Workers | 19 | 23 | 3 CSP × 2 status types | Permanent/Temporary bifurcation |
| **S3Q01** | Departures Summary | 13 | 19 | 3 CSP | 4 departure types |
| **S3Q02** | Dismissal Motives | 13 | 19 | 3 Motif fill-ins | Free text reasons |
| **S3Q03** | Dismissals Detail | 7 | 8 | 3 CSP | Dismissal/Technical unemployment |
| **S4Q01** | Internships | 22 | 4 | 4 internship types + skills + domains | Multiple subsections in one table |
| **S4Q02** | Skill Needs | 22 | 4 | 3 skill fields | Free text entries |
| **S4Q03** | Training Domains | 22 | 4 | 3 training domains | Free text entries |

---

## STANDARD CSP & AGE GROUPING STRUCTURE

**Personnel Categories (CSP):**
- Cadres / Executives
- Agents de Maîtrise / Foremen
- Agents d'exécution / Field workers
- TOTAL

**Age Groups:**
- 15 à 24 / 15 to 24 years
- 25 à 34 / 25 to 34 years
- 35 et + / 35 and above years
- Total

**Gender Breakdown:**
- Masculin / Male
- Féminin / Female
- TOTAL

**Combined Structure in Major Tables:**
- 3 CSP × (Gender (M, F, TOTAL) × 3 Age Groups + Total) = typically 13 columns per CSP section
- Multiple sections per table for different status types (Permanent vs Temporary, etc.)

---

## ENTITY-TYPE SPECIFIC DIFFERENCES SUMMARY

### ENTREPRISES
- Most comprehensive form (12 questions in S1)
- Includes enterprise size classification (TP/PME/ETM/ETL) — S1Q12
- Includes legal status options (SARL, SA, EIRL, Auto-entrepreneur) — S1Q01
- Headquarters address field — S1Q09

### COOPERATIVE
- Same as ENTREPRISES in structure (12 questions)
- **Key Difference:** S1Q01 asks for "Type de coopérative" with accounting complexity options instead of legal status
- Removes: Enterprise size question; keeps everything else identical
- All table structures match ENTREPRISES exactly

### CTD (Représentation Légale Décentralisée)
- **SHORTEST Section 1** (10 questions — removes S1Q10 "Type of CTD" and S1Q12 "Size")
- **Unique:** S1Q01 asks "Type de CTD" with Regional/Departmental/Municipal options
- **Unique:** S1Q02 conditional question "Si 2, Quel est le type de Commune"
- All other sections (S2, S3, S4) identical to ENTREPRISES
- No distinction for entity classification beyond regional structure

### ONG
- **Intermediate Section 1** (11 questions)
- **Unique:** S1Q01 is simple "NGO Name" (replaces Complex enterprise legal status)
- **Unique:** S1Q09 is "Quelle est votre mission principale / What is your primary mission?"
- Removes: No S1Q12 (Size/Type)
- All table structures identical to ENTREPRISES for S2-S4

---

## VULNERABILITY TYPES IN S22Q05

**Applied for all entity types:**
- Déplacés internes / Internal displaced persons
- Réfugiés / Refugees
- Orphelins / Orphans

---

## EDUCATION LEVELS IN S22Q03

**Standardized across all entity types:**
1. CEP / CEPE / FSLC/
2. BEPC / CAP / GCE-OL
3. PROBATOIRE / Lower sixth
4. BAC / GCE-AL
5. BTS/DUT / HND
6. Licence (Bac+3) / Bachelor
7. Maîtrise (Bac +4) / Master 1
8. Master (Bac +5) / Master 2
9. DQP / PQD
10. CQP / CPQ
11. Autres / Others
12. Sans diplôme / Without diploma
13. TOTAL

---

## INTERNSHIP TYPES IN S4Q01

**Standardized across all entity types:**
- Stage de vacance / Holiday jobs
- Stage académique / Academic internship
- Stage professionnelle / Professional internship
- Stage pré-emploi / Pre-work internship
- Total

---

## DEPARTURE TYPES IN S3Q01

**Categories:**
- Licenciements / Dismissals
- Démissions / Resignations
- Départ à la retraite / Retirement
- Autres départs / Other departures
- Ensemble / Whole (aggregate)

---

## DISMISSAL REASON FIELDS IN S3Q02

**Free text fields:**
- Motif 1 / Reason 1 : ______________________________
- Motif 2 / Reason 2 : ______________________________
- Motif 3 / Reason 3 : ______________________________

---

## CRITICAL IMPLEMENTATION NOTES

### For PDF Code Generation:

1. **Section 1 (S1) is the PRIMARY DIFFERENTIATOR** between entity types
   - All other sections (S2, S3, S4) are identical across types
   - Focus entity-specific variations on S1 table construction

2. **Table Headers Structure is Complex:**
   - Multi-level headers with repeated text in cells (e.g., S21Q01-S21Q05 all in one cell with newlines)
   - Gender/Age combinations must be aligned correctly

3. **CSP Categories appear in TWO contexts:**
   - As row headers (defining employment classification)
   - As column categorizations in some tables (S22Q05, S3Q01)

4. **Vulnerability Categories in S22Q05** are different from standard CSP:
   - Should be row headers instead of CSP rows
   - Permanent/Temporary distinction is column-based (not row-based like S22Q01)

5. **Complex Multi-level Headers in S23Q01-S23Q02:**
   - Requires careful cell merging and alignment
   - Status type distinction (Permanent vs Temporary) is row-based
   - CSP distinctions within each status

6. **S4Q01 is a Combined Table:**
   - Section 1 (Rows 3-7): Internship types
   - Section 2 (Rows 11-14): Skills
   - Section 3 (Rows 18-21): Training domains
   - All share same 4-column structure

7. **Motif Section (S3Q02) Has Unique Structure:**
   - Multiple free-text entry fields without pre-defined options
   - Total row for counting responses
   - Mixed with preceding S3Q01 data in same table section

---

## NOTES ON SPECIAL CHARACTERS & ENCODING

- "Œ" Used in place of "'" (RespondentŒs vs Respondent's)
- "–" Used instead of hyphen (Paix – Travail – Patrie)
- Non-breaking spaces used after Q codes (S0Q01, etc.)
- Accented characters: é, è, à, ç, ô, î, etc. (UTF-8 required)

---

## ESTIMATED PDF DIMENSIONS

- Each form: ~2-3 pages depending on nesting/spacing
- Header section: ~0.5 page
- Section 0: ~0.2 page
- Section 1: ~0.5-0.8 page (varies by entity type S1 length)
- Section 2: ~0.8-1.0 page (S21, S22 combined)
- Section 3: ~0.5 page (S3Q01-Q03)
- Section 4: ~0.3-0.4 page (S4 combined)
- Footer/Copy info: ~0.2 page

