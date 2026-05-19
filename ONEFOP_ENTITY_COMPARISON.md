# ONEFOP Entity Type Comparison - Quick Reference

## Section 1 (IDENTIFICATION) FIELD COUNT BY ENTITY TYPE

```
ENTREPRISES:    12 questions (S1Q01 → S1Q12)
COOPERATIVE:    12 questions (S1Q01 → S1Q12)
CTD:            10 questions (S1Q01 → S1Q10, SKIP S1Q11, S1Q12)
ONG:            11 questions (S1Q01 → S1Q11, SKIP S1Q12)
```

## Section 1 Field Mapping & Entity-Specific Content

| Q Code | ENTREPRISES | COOPERATIVE | CTD | ONG |
|--------|-------------|-------------|-----|-----|
| **S1Q01** | Legal Status (SARL\|SA\|EIRL\|Auto-entr) | Coop Type (Comptab\|Comptab Simple) | CTD Type (Région\|Dpt\|Commune) | NGO Name |
| **S1Q02** | Company Name | Cooperative Name | Commune Type (if S1Q01=2) | Siège social |
| **S1Q03** | Area (Urban\|Rural) | Creation Year | Creation Year | Creation Year |
| **S1Q04** | Region | Area (Urban\|Rural) | Area (Urban\|Rural) | Area (Urban\|Rural) |
| **S1Q05** | Tel 1 | Region | Region | Region |
| **S1Q06** | Tel 1 / Tel 2 | Tel 1 / Tel 2 | Tel 1 / Tel 2 | Tel 1 / Tel 2 |
| **S1Q07** | Business Sector | Business Sector | Business Sector | Business Sector |
| **S1Q08** | Branch of Activity | Branch of Activity | Branch of Activity | Branch of Activity |
| **S1Q09** | HQ Address | Main Activity | Main Activity | PRIMARY MISSION |
| **S1Q10** | # Permanent Staff | # Permanent Staff | # Permanent Staff | # Permanent Staff |
| **S1Q11** | # Vacancies | # Vacancies | # Vacancies | # Vacancies |
| **S1Q12** | Enterprise Size (TP\|PME\|ETM\|ETL) | Coop Type (Comptab Options) | ✗ NOT PRESENT | ✗ NOT PRESENT |

## Sections 2-4 Comparison (Employment, Departures, Training)

| Section | ENTREPRISES | COOPERATIVE | CTD | ONG |
|---------|-------------|-------------|-----|-----|
| **S2 (Employment)** | ✓ All identical | ✓ All identical | ✓ All identical | ✓ All identical |
| S21Q01 - Job Applications | 7×13 | 7×13 | 7×13 | 7×13 |
| S22Q01 - Permanent Recruit | 14×13 | 14×13 | 14×13 | 14×13 |
| S22Q02 - Temporary Recruit | (cont. S22) | (cont. S22) | (cont. S22) | (cont. S22) |
| S22Q03 - By Education | 16×13 | 16×13 | 16×13 | 16×13 |
| S22Q04 - Disabilities | 14×8 | 14×8 | 14×8 | 14×8 |
| S22Q05 - Vulnerable | (cont. S22Q04) | (cont. S22Q04) | (cont. S22Q04) | (cont. S22Q04) |
| S23Q01 - First-time Seekers | 19×23 | 19×23 | 19×23 | 19×23 |
| S23Q02 - First-time Workers | 19×23 | 19×23 | 19×23 | 19×23 |
| **S3 (Departures)** | ✓ All identical | ✓ All identical | ✓ All identical | ✓ All identical |
| S3Q01 - Departures | 13×19 | 13×19 | 13×19 | 13×19 |
| S3Q02 - Motives | (cont. S3Q01) | (cont. S3Q01) | (cont. S3Q01) | (cont. S3Q01) |
| S3Q03 - Dismissals | 7×8 | 7×8 | 7×8 | 7×8 |
| **S4 (Training)** | ✓ All identical | ✓ All identical | ✓ All identical | ✓ All identical |
| S4Q01 - Internships | 22×4 | 22×4 | 22×4 | 22×4 |
| S4Q02 - Skills | (cont. S4) | (cont. S4) | (cont. S4) | (cont. S4) |
| S4Q03 - Training | (cont. S4) | (cont. S4) | (cont. S4) | (cont. S4) |

## PDF Rendering Logic Decision Tree

```
IF EntityType == "ENTREPRISES"
  → S1: 12 questions
  → S1Q01: Display legal status options (SARL, SA, EIRL, Auto-entrepreneur)
  → S1Q09: "Siège social de l'entreprise..." (HQ address)
  → S1Q12: Display enterprise size (TP, PME, ETM, ETL)

ELSE IF EntityType == "COOPERATIVE"
  → S1: 12 questions (SAME LAYOUT AS ENTREPRISES)
  → S1Q01: Display cooperative type (Comptabilité Simple/Complexe)
  → S1Q09: "Activité principale..." (Main activity)
  → S1Q12: Display cooperative type options (different from enterprise)

ELSE IF EntityType == "CTD"
  → S1: 10 questions (SKIP S1Q11, S1Q12)
  → S1Q01: Display CTD type (Région, Département, Commune)
  → S1Q02: Conditional display (only if S1Q01 == Commune) "Quel est le type de Commune"
  → S1Q09-Q10: Relabeled as non-sequential fields
  → S1Q11: Relabel as "Vacancies" (renumber from S1Q10)

ELSE IF EntityType == "ONG"
  → S1: 11 questions (SKIP S1Q12)
  → S1Q01: Display "Nom de l'ONG..." (NGO name)
  → S1Q09: Display "Quelle est votre mission principale..." (NGO mission)
  → S1Q10-Q11: Keep as before (Staff & Vacancies)

// For all entity types, render identical sections:
  → S2: Employment section (7 tables)
  → S3: Departures section (complex multi-row headers)
  → S4: Training section (combined table)
```

## Critical Field Differences for Code Implementation

### Question Labels That Change by Entity Type

#### S1Q01 Label Changes:
```
ENTREPRISES:  "Quelle est le régime/statut juridique de votre institution"
COOPERATIVE:  "Type de la coopérative : 1. Coopérative à comptabilité..."
CTD:          "Type de CTD / Type of RLA : 1. Région... 2. Département... 3. Commune..."
ONG:          "Nom de l'ONG / NGO's name : _______________________"
```

#### S1Q09 Content Changes:
```
ENTREPRISES:  "Siège social de l'entreprise / Company's head office"
COOPERATIVE:  "Activité principale / Main activity"
CTD:          "Nombre d'employé permanent / Number of permanent workers"  [SHIFTED UP]
ONG:          "Quelle est votre mission principale ? / What is your primary mission ?"
```

### Field Counts Per Section
```
ENTREPRISES:
  - S1: 5 columns (header layout)
  - All Others: Identical

COOPERATIVE:
  - S1: 5 columns (same layout as ENTREPRISES)
  - All Others: Identical

CTD:
  - S1: 4 columns (one less due to fewer rows)
  - All Others: Identical

ONG:
  - S1: 5 columns (same as ENTREPRISES/COOPERATIVE)
  - All Others: Identical
```

## PDF Generation Checklist

### Must-Do for Each Entity Type:

- [ ] ENTREPRISES
  - [ ] S1: 12 rows, legal status dropdown
  - [ ] S1Q12: Enterprise size dropdown
  
- [ ] COOPERATIVE
  - [ ] S1: 12 rows, cooperative type dropdown
  - [ ] S1Q12: Cooperative accounting type dropdown
  
- [ ] CTD
  - [ ] S1: 10 rows only
  - [ ] S1Q01: CTD type options
  - [ ] S1Q02: Conditional "type of commune"
  - [ ] NO S1Q11, S1Q12
  
- [ ] ONG
  - [ ] S1: 11 rows (no S1Q12)
  - [ ] S1Q01: "NGO Name" field
  - [ ] S1Q09: "Mission principale" field

### Always Identical (Don't Optimize Prematurely):

- [ ] Sections 2, 3, 4 (Employment, Departures, Training)
- [ ] All table structures (S21, S22, S23, S3, S4)
- [ ] Header/Footer areas
- [ ] Section 0 (Respondent Info)

---

## Entity Type Selection for PDF Service

**Recommended TypeScript/JavaScript Enum:**

```typescript
enum OnefopEntityType {
  ENTREPRISES = 'entreprises',
  COOPERATIVE = 'cooperative',
  CTD = 'ctd',
  ONG = 'ong'
}

interface FormConfig {
  entityType: OnefopEntityType;
  s1FieldCount: number;      // 10, 11, or 12
  hasS1Q12: boolean;          // false for CTD & ONG
  s1Q01Label: string;         // Legal status vs Type vs Name
  s1Q09Label: string;         // HQ vs Activity vs Mission
  s1ColumnCount: number;      // Usually 5, except CTD (4)
}
```

**Configuration Values by Entity Type:**

```typescript
const configs: Record<OnefopEntityType, FormConfig> = {
  [OnefopEntityType.ENTREPRISES]: {
    entityType: 'entreprises',
    s1FieldCount: 12,
    hasS1Q12: true,
    s1Q01Label: 'Legal Status (SARL|SA|EIRL|Auto-entrepreneur)',
    s1Q09Label: 'Company HQ Address',
    s1ColumnCount: 5
  },
  [OnefopEntityType.COOPERATIVE]: {
    entityType: 'cooperative',
    s1FieldCount: 12,
    hasS1Q12: true,
    s1Q01Label: 'Cooperative Accounting Type',
    s1Q09Label: 'Main Activity',
    s1ColumnCount: 5
  },
  [OnefopEntityType.CTD]: {
    entityType: 'ctd',
    s1FieldCount: 10,
    hasS1Q12: false,
    s1Q01Label: 'CTD Type (Région|Département|Commune)',
    s1Q09Label: 'Main Activity',
    s1ColumnCount: 4  // Only 4 columns due to 10 rows vs 12
  },
  [OnefopEntityType.ONG]: {
    entityType: 'ong',
    s1FieldCount: 11,
    hasS1Q12: false,
    s1Q01Label: 'NGO Name',
    s1Q09Label: 'Primary Mission',
    s1ColumnCount: 5
  }
};
```

---

## Table Structure Reference (All Entity Types)

### S21Q01 - Job Applications
```
Rows:    7 (Gender header, Age header, 3 CSP, Total)
Cols:    13 (Gender × Age groups: M[15-24, 25-34, 35+, Total], F[...], TOTAL[...])
```

### S22Q01-Q02 - Recruitment
```
Rows:    14 (S22Q01 header + 3 CSP + Total, then S22Q02 header + 3 CSP + Total)
Cols:    13 (same as S21Q01)
```

### S22Q03 - Education Level
```
Rows:    16 (Age header, 12 education levels, Total)
Cols:    13 (same gender/age breakdown)
```

### S22Q04 - Disabilities
```
Rows:    14 (S22Q04 + 3 CSP + Total, then S22Q05 + 3 vulnerability types + Total)
Cols:    8 (CSP, Perm[M,F,T], Temp[M,F,T], Total)
```

### S23Q01 - First-time Seekers
```
Rows:    19 (2× headers, 3 CSP, Total, + S23Q02 section)
Cols:    23 (complex multi-level: Sexe, then M×Age, F×Age, TOTAL×Age)
```

### S3Q01 - Departures
```
Rows:    13 (multiple headers for departure types, 3 CSP, Total, + S3Q02 motives)
Cols:    19 (Dismissal[M,F,T], Resignation[M,F,T], Retirement[M,F,T,T], Other[M,F,F,T], Whole[M,M,F,T])
```

### S3Q03 - Dismissals Detail
```
Rows:    7 (header, 3 CSP, Total)
Cols:    8 (Dismissal[M,F,Total], Technical Unemployment[M,F,Total], Total)
```

### S4Q01-Q03 - Combined Training
```
Rows:    22 (S4Q01 internships section + S4Q02 skills section + S4Q03 domains section)
Cols:    4 (Category, M, F, Total)
- Rows 3-7: Internship types
- Rows 11-14: Skills
- Rows 18-21: Training domains
```

