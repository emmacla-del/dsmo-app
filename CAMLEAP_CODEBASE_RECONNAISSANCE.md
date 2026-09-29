# CAM-LEAP (ONEFOP & DSMO) CODEBASE RECONNAISSANCE BRIEFING

**Document Version:** 1.0.0  
**Target Audience:** AI Software Engineering & Systems Architecture Team  
**System Designation:** CAM-LEAP / ONEFOP / DSMO Digital Declaration Platform  
**Governing Institution:** Ministry of Employment and Vocational Training (MINEFOP), Republic of Cameroon  
**Observatory:** Observatoire National de l'Emploi et de la Formation Professionnelle (ONEFOP)  

---

## 1. PROJECT OVERVIEW

### 1.1 What CAM-LEAP Currently Does
CAM-LEAP (Cameroon Labour Market Information System & Employment Observatory Platform) is the national digital platform for statutory employment, manpower, and vocational training data collection in Cameroon. It operationalizes two statutory reporting streams:
1. **ONEFOP Questionnaires (Forms 1 through 7):** Comprehensive quarterly/annual statistical declarations covering seven economic and institutional entity types: Enterprises, Cooperatives, Decentralized Territorial Collectivities (CTD / Communes), NGOs / Associations, Public Administrations, Projects / Programs, and Vocational Training Centers (VTC / PVTC).
2. **DSMO (Déclaration sur la Situation de la Main d'Œuvre):** The historical manpower report mandated by Cameroon labour legislation, capturing establishment-level workforce counts, employee nominal rosters, movements (hires/dismissals), and qualitative operational questions.

### 1.2 Main Purpose
The platform transitions Cameroon's national labour reporting from manual, error-prone paper questionnaires to a centralized, real-time statistical intelligence infrastructure. It achieves:
- Direct self-declaration by economic entities with automated validation and arithmetic coherence checks.
- Hierarchical decentralized administrative review matching Cameroon’s territorial administration: **Divisional Delegations → Regional Delegations → Central Ministry**.
- Multi-channel analytics, workforce forecasting, and statistical export directly into **SPSS (`.sps` syntax + CSV)** and **Excel (`.xlsx`)** for official national econometric reporting.
- High-fidelity PDF generation reproducing official ministerial print documents with barcoded certification and legal signatures.

### 1.3 Currently Implemented Modules & Features
- **Modern Jobs Declaration Wizard (`react-web`):** The primary self-declaration interface for non-VT entities, featuring:
  - Single administrative masthead with Cameroon tricolor branding and live auto-save feedback (`✓ Brouillon sauvegardé`).
  - Fixed-height, zero-scroll 280px sidebar displaying section completion status and table progress (`1/3`).
  - Step pills row stripping raw code prefixes in favor of clean ordinals (`1. Demande d'emplois`, `2. Recrutements`, etc.).
  - Prompt-first question cards suppressing duplicate headers, with inline `ⓘ` tooltips hiding internal question codes (`S21Q01`).
  - Dual-mode statistical presentation: **Tableau** (full matrix grid with arrow-key navigation) and **Guidé** (step-by-step single cell entry).
  - Progressive disclosure via conversational Gateway Questions (`GATEWAY_CATALOG`).
  - Preliminary Declaration Quiz (`EventFactInterview` / `ScopeConfigurationWizard`) to eliminate irrelevant questions upfront.
- **Vocational Training Center (VT) Wizard (`react-web` & `Flutter`):** Specialized wizard for vocational training centers handling multi-dimensional matrices (trainees by age, sex, specialty, trainers, infrastructure, vulnerable groups).
- **Offline Self-Hosted Typography:** Complete elimination of Google Fonts CDN runtime dependencies; self-hosted `IBM Plex Sans` and `Zilla Slab` via `next/font/local` and design tokens in `tokens.css`.
- **Client-Side Draft Engine:** Multi-tier persistence combining browser `IndexedDB` (via `Dexie`) with debounced (600ms) background synchronization to the backend `/onefop/draft` endpoint.
- **Legal Acknowledgment Gate:** Formal criminal code and labour law disclosure screen requiring declaration of respondent identity and legal capacity prior to accessing questionnaires.
- **Administrative Portal (`react-web` & `Flutter`):**
  - Combined Declaration History (`/home/declarations`): Unified timeline of DSMO and ONEFOP submissions filtered by status.
  - Directories (`/home/annuaire`): Real-time management of registered establishments and administrative users with role/region assignment.
  - Communication Center (`/home/communication`): Campaign creation, deadline broadcast engine, and email notification dispatch.
- **Backend Statistical Processing (`src/`):**
  - Dynamic PDF compilation via Puppeteer 22 and Handlebars templates.
  - Streaming multi-sheet Excel generation (ExcelJS) and SPSS syntax (`.sps`) manifest creation.
  - Coherence validation rules verifying arithmetic constraints across tables.

### 1.4 Features Planned or Partially Implemented
- **Analytics & Forecasting Dashboard in React Web:** The NestJS backend contains complete analytics endpoints (`src/analytics/`), and the Flutter app has a full graphical analytics dashboard (`fl_chart`), but the React Web app currently routes `/home/analytics` to an honest placeholder (`home/[slug]/page.tsx`).
- **Automated Tests for React Web:** While the backend has 15 Jest test suites and Flutter has 76 Dart test suites, `react-web/` currently has **0 automated unit/integration test files**.
- **HttpOnly Cookie Authentication:** Planned in architectural notes, but currently implemented using Bearer JWT tokens stored in `localStorage` / `sessionStorage`.

### 1.5 Current Development Status
- **Backend (NestJS):** Production-ready, deployed on Render (`https://dsmo-app-2.onrender.com/api`) connecting to a PostgreSQL database on Supabase.
- **Frontend Web (`react-web`):** Next.js 16 (Turbopack) application. Fully compiles with 0 errors across all 18 routes. Active migration target replacing Flutter Web.
- **Mobile/Desktop (`lib/`):** Existing production Flutter client covering mobile (Android/iOS) and legacy desktop/web.

### 1.6 Monorepo Sub-Packages & Services
The repository is a hybrid monorepo containing three distinct codebases:
1. **Root (`./`):** NestJS TypeScript backend API server (`src/`), Prisma ORM (`prisma/`), and orchestration scripts.
2. **`react-web/`:** Next.js 16 React web application (modern frontend target).
3. **`lib/` + platform folders (`android/`, `ios/`, `windows/`, `macos/`, `linux/`, `web/`):** Flutter cross-platform mobile/desktop application.
4. **`assets/schemas/` & `public/schemas/`:** Generated JSON schema artifact (`onefop.schema.json`) produced by the Dart AST compiler (`test/tools/export_onefop_schema_test.dart`).

---

## 2. TECHNOLOGY STACK

| Layer | Confirmed Technology | Implementation Location / Notes |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js 16.3.5 (Turbopack, App Router) | `react-web/package.json`, `react-web/src/app` |
| **Frontend Runtime** | React 19.2.8, TypeScript 5.x | `react-web/` |
| **State Management** | Zustand 5.0.15 + TanStack React Query 5.102.8 | `react-web/src/lib/auth-store.ts`, `query-provider.tsx` |
| **Client Database / Cache** | Dexie 4.4.6 (IndexedDB wrapper) | `react-web/src/lib/onefop-drafts.ts` |
| **Internationalization** | `next-intl` 4.14.4 (French & English) | `react-web/src/i18n`, `messages/fr.json`, `messages/en.json` |
| **CSS & Design System** | Tailwind CSS v4 + CAM-LEAP Tokens (`tokens.css`) | `react-web/src/app/tokens.css`, `globals.css` |
| **Typography (Self-Hosted)** | IBM Plex Sans (Sans) + Zilla Slab (Serif) | `react-web/src/app/fonts/`, `react-web/src/app/layout.tsx` |
| **Secondary Frontend** | Flutter 3.x / Dart 3.x (Riverpod, Dio, fl_chart) | `lib/`, `pubspec.yaml` |
| **Backend Framework** | NestJS 11.1.19 (Express 4.17.25) | `package.json`, `src/main.ts`, `src/app.module.ts` |
| **Backend Language** | TypeScript 5.4, Node.js >= 20.x | `tsconfig.json`, `package.json` |
| **Database** | PostgreSQL (hosted on Supabase) | `prisma/schema.prisma` (Pooled & Direct URLs) |
| **ORM** | Prisma ORM 5.22.0 | `prisma/schema.prisma`, `src/prisma/` |
| **Authentication** | Passport-JWT 4.0.1, Passport-Local, Bcrypt 5.1.0 | `src/auth/` (Bearer Tokens, optional 2FA TOTP) |
| **2FA / OTP** | `otplib` 13.4.1 | `src/auth/` |
| **PDF Generation** | Puppeteer 22.15.0 + Handlebars 4.7.9, PDFKit 0.18.0 | `src/pdf/` (`onefop-puppeteer.service.ts`) |
| **Data Export Engines** | ExcelJS 4.4.0 (Streaming .xlsx), Custom SPSS (.sps + CSV) | `src/data-management/data-management.service.ts` |
| **Email Transport** | Nodemailer 8.0.4, Resend 6.14.0 | `src/email/`, `src/dsmo/notification.service.ts` |
| **Validation Libraries** | `class-validator` 0.14.4, `class-transformer` 0.5.1 | `src/dto/`, custom client engines in `onefop-validation.ts` |
| **Backend Testing** | Jest 30.4.2, ts-jest 29.4.11 | `src/**/*.spec.ts` (15 test suites) |
| **Dart Testing** | `flutter_test` | `test/` (76 test suites) |
| **Frontend Testing** | **None configured** | `react-web/` has 0 test files |
| **Hosting (Backend)** | Render (`render.yaml`, `https://dsmo-app-2.onrender.com`) | Node.js web service |
| **Hosting (Database)** | Supabase Managed PostgreSQL | `DATABASE_URL`, `DIRECT_URL` |

---

## 3. REPOSITORY STRUCTURE & ARCHITECTURE TREE

```
c:\Users\win\dsmo_app
├── assets/                       # Static runtime assets for backend and schema compiler
│   └── schemas/onefop.schema.json # Canonical compiled JSON schema artifact
├── prisma/                       # Database layer
│   ├── schema.prisma             # 2,224-line authoritative PostgreSQL schema
│   ├── migrations/               # Prisma migration history
│   └── seed.js                   # Initial administrative seed script
├── src/                          # NestJS Backend API Server
│   ├── analytics/                # Statistical trend analysis, forecasting, employment intelligence
│   ├── auth/                     # JWT authentication, guards, roles, password reset, 2FA
│   ├── campaign/                 # National declaration campaign cycles & deadline tracking
│   ├── common/                   # Shared utilities, interceptors, normalizers (flat-key normalizer)
│   ├── data-management/          # Administrative data CRUD, Excel streaming, SPSS exports
│   ├── dsmo/                     # Legacy DSMO manpower report service, controllers, notifications
│   ├── dto/                      # Data Transfer Objects with class-validator annotations
│   ├── email/                    # Templated email dispatch service (Nodemailer/Resend)
│   ├── onefop/                   # ONEFOP submission lifecycle, drafts, active-quarter queries
│   ├── onefop-schema-validation/ # AST schema loader & shadow validation service
│   ├── pdf/                      # Puppeteer & Handlebars official PDF generation engine
│   ├── questionnaires/           # Questionnaire submission, entity mapper, data ingestion
│   ├── sectors/                  # Sector classifications (Primary, Secondary, Tertiary)
│   └── main.ts                   # NestJS application bootstrap
├── react-web/                    # Next.js 16 React Web Application
│   ├── public/
│   │   ├── fonts/                # Self-hosted woff2 font files
│   │   └── schemas/              # Client-consumed onefop.schema.json
│   └── src/
│       ├── app/                  # Next.js App Router (18 routes)
│       │   ├── fonts/            # Local font binaries (IBM Plex Sans, Zilla Slab)
│       │   ├── home/             # Authenticated user dashboard & administrative views
│       │   ├── login/            # Respondent & administrative authentication
│       │   ├── onefop/preview/   # Primary Questionnaire Wizard route
│       │   ├── register/         # Respondent self-registration flow
│       │   ├── layout.tsx        # Root layout (fonts, providers, locale injection)
│       │   └── tokens.css        # CAM-LEAP design token definitions
│       ├── components/
│       │   ├── admin/            # Admin directories (Users, Companies, Campaigns, Notifications)
│       │   ├── modern-jobs/      # Scope quiz (EventFactInterview) & gateway catalogs
│       │   ├── onefop/           # ModernJobsWizard, SectionRenderer, Sidebar, Nav, Tables
│       │   │   ├── tables/       # AdaptiveStatisticalTable, Grid, Guided entry, Nominal roster
│       │   │   └── ui/           # FormSectionCard, FormGrid, Accessible controls
│       └── lib/                  # Frontend utilities, Dexie DB, API client, validation, formulas
├── lib/                          # Flutter Mobile & Desktop Application
│   ├── core/focus/compiler/      # CANONICAL ONEFOP AST COMPILER (onefop_ast.dart)
│   ├── data/                     # Flutter API client & repository models
│   ├── screens/                  # Flutter views for DSMO, ONEFOP, and Admin
│   └── widgets/                  # Flutter shared UI components
└── test/                         # Dart test suites & AST schema exporter tool
```

---

## 4. FRONTEND ARCHITECTURE (`react-web`)

### 4.1 Routing & Navigation Map
1. **`/` (Root):** Server-side redirect to `/login`.
2. **`/login`:** Secure login supporting email/password, "remember me" persistence selection, and 2FA challenge interception.
3. **`/register`:** 4-step wizard for self-respondents:
   - Step 1: Legal form & institution type (`enterprise`, `cooperative`, `ctd`, `ong`, etc.).
   - Step 2: Commercial identification, tax number (NIU), CNPS registration, and economic sector.
   - Step 3: Geographic jurisdiction (Cameroon 10 Regions → 58 Departments → 360 Subdivisions cascading selector).
   - Step 4: Account credentials with live password complexity validation.
4. **`/verify-email` & `/reset-password`:** Cryptographic token verification and self-service password recovery.
5. **`/home`:** Authenticated landing shell with role-aware sidebar navigation:
   - `/home/declarations`: Active declarations timeline (combines ONEFOP and DSMO).
   - `/home/declarations/new`: Entity selection modal to initiate a declaration.
   - `/home/annuaire`: Directory of establishments and staff accounts (role-guarded).
   - `/home/communication`: Campaign management & email announcement composer.
   - `/home/notifications`: Notification inbox for deadline alerts and review remarks.
   - `/home/[slug]`: Structured placeholder for non-migrated secondary screens.
6. **`/onefop/preview?entity={type}`:** Primary Questionnaire Wizard route.

### 4.2 Application Shell & Layout Structure
- **Root Layout (`layout.tsx`):** Injects self-hosted font variables (`--font-ibm-plex-sans`, `--font-zilla-slab`), mounts `TanStack QueryProvider`, initializes client authentication state from storage, and wraps children in `NextIntlClientProvider`.
- **Wizard Shell (`WizardShell.tsx`):**
  - Detects entity type: routes `vocationalTraining` to `VtWizardSectionScreen`, and the other 6 entities to `ModernJobsWizard`.
  - Coordinates global autosave state, legal gate acknowledgment, and modal dialogs.
- **Modern Jobs Layout (`ModernJobsWizard.tsx`):**
  - Maximum content container constrained to `940px` (`--vt-content-max`) for standard forms; expands to full width (`1360px`) when rendering wide statistical tables.
  - Sticky bottom action bar (`ModernJobsNavigation.tsx`) aligned with a desktop 2-column grid: column 1 matches sidebar width (`280px`), column 2 contains left-aligned `← Précédent` and right-aligned `Continuer vers {next} →`.

### 4.3 Component Hierarchy & Data Flow (Modern Jobs Wizard)
```
OnefopDeclarationPage (/onefop/preview)
  │
  ├── OnefopLegalAcknowledgment (Gate: Must accept criminal code pledge)
  │
  └── WizardShell
        │
        └── ModernJobsWizard
              ├── ModernJobsHeader (Tricolor banner, live auto-save feedback, locale toggle)
              │
              ├── [Between Sec 1 & 2] EventFactInterview / ScopeConfigurationWizard
              │     └── FactsTracker (Preliminary qualitative quiz configuring table relevance)
              │
              ├── Layout Container (280px sidebar + Content Area)
              │     ├── ModernJobsSidebar (Fixed height, section status circles, active 1/3 pill, avatar)
              │     │
              │     └── SectionRenderer
              │           ├── Unified Section Masthead (Zilla Slab title, "n tableaux • m complété", view toggle)
              │           ├── Step Pills Row (Numbered pills: 1. Demande, 2. Recrutements...)
              │           │
              │           └── FormSectionCard (Suppresses title on table cards)
              │                 ├── GatewayQuestion (Conversational yes/no trigger from GATEWAY_CATALOG)
              │                 │
              │                 └── AdaptiveStatisticalTable
              │                       ├── Prompt Header (Zilla Slab prompt, inline ⓘ question code tooltip)
              │                       ├── Mode Toggle ([ Tableau | Guidé ])
              │                       ├── StatisticalGridRenderer (2D matrix with keyboard arrow nav)
              │                       └── GuidedStatisticalEntry (Linear cell-by-cell walkthrough)
              │
              └── ModernJobsNavigation (Sticky bottom bar: Précédent text button + Continuer green button)
```

### 4.4 State Management & Persistence Strategy
- **Zustand (`auth-store.ts`):** Holds user session, active roles, and geographic assignment.
- **Dexie.js (`onefop-drafts.ts`):** Client-side IndexedDB database (`camleap-onefop-drafts`). Saves form state locally per entity type. Debounced at 600ms to guarantee zero input latency while preventing storage thrashing.
- **Backend Sync (`useOnefopDraft.ts`):** Automatically pushes local changes to `POST /onefop/draft` when online.
- **TanStack React Query:** Manages server cache for schemas (`useOnefopSchema`), active quarters, user profiles, and administrative directories.

---

## 5. CAM-LEAP DECLARATION SYSTEM (STATISTICAL QUESTIONNAIRES)

### 5.1 Questionnaire Inventory by Entity Type

| Entity Type | Canonical Name | Target Respondent | Core Sections | Key Statistical Tables |
| :--- | :--- | :--- | :--- | :--- |
| **1. Enterprise** | `enterprise` | Private formal businesses, corporations, LLCs | Sec 0: Respondent<br>Sec 1: Entity ID & Size<br>Sec 2: Employment & Work<br>Sec 3: Departures<br>Sec 4: Internships & Training | **S21Q01:** Job applications (CSP × Sex × Age)<br>**S22Q01:** Permanent hires (CSP × Sex × Age)<br>**S22Q02:** Temporary hires (CSP × Sex × Age)<br>**S22Q03:** Hires by Diploma (Diploma × Sex × Age)<br>**S22Q04:** Hires with Disabilities<br>**S22Q05:** Vulnerable hires<br>**S3Q01-03:** Departures & dismissals<br>**S4Q01-03:** Interns & skill needs |
| **2. Cooperative** | `cooperative` | Agricultural and producer cooperatives | Same 5 sections adapted for coop status | Same table matrix with cooperative-specific agricultural sectors |
| **3. CTD** | `ctd` | Communes and Regional Councils | Same 5 sections adapted for local government | Workforce breakdown by municipal departments and municipal civil service grades |
| **4. NGO** | `ong` | Non-Governmental Organizations & Associations | Same 5 sections adapted for non-profits | Includes volunteer/expatriate distinctions and grant-funded staffing |
| **5. Administration** | `administration` | Public ministries and state organs | Same 5 sections (modified) | **Excludes S22Q02, S22Q03, and S3Q03** (public civil service recruitment follows statutory concours, not open market recruitment) |
| **6. Projects / Programs** | `projectProgram` | State or donor-funded development projects | Sec 0, Sec 1, Sec 2 (Activities), Sec 3 (Jobs) | Structured activities matrix (`PP_S2Q01`) linking project components to job creation |
| **7. Vocational Training** | `vocationalTraining` | Public & Private Vocational Training Centers (VTC/PVTC) | 9 Specialized Sections | **VT2:** Trainees by age/sex flow<br>**VT3:** Emergencies & crises<br>**VT4:** Specialty matrix (trade × enrollment)<br>**VT5:** Pedagogical guides & infrastructure<br>**VT8:** Trainer roster (diplomas, specialties, status) |

### 5.2 Statistical Table Architecture & Entry Modes
1. **Socio-Professional Categories (CSP):** The standard Cameroon 3-tier hierarchy:
   - *Cadres* (Executives / Managers)
   - *Agents de Maîtrise* (Supervisors / Technicians / Foremen)
   - *Agents d'Exécution* (Field Workers / Clerical Staff / Laborers)
2. **Standard Disaggregations:**
   - *Sex:* Masculin, Féminin, Total.
   - *Age Bands:* 15–24 ans (Youth), 25–34 ans, 35 ans et plus, Total.
   - *Diplomas:* Without Diploma, CEP/FSLC, BEPC/GCE OL, CAP, Probatoire, Baccalauréat/GCE AL, BTS/DUT, Licence/Bachelor, Master, Doctorat/PhD.
3. **Dual Entry Modes (`AdaptiveStatisticalTable.tsx`):**
   - **Tableau (Grid Mode):** High-density spreadsheet-like matrix rendering with automated sum recalculation across rows and columns. Supports keyboard navigation (Enter, Tab, Arrow keys).
   - **Guidé (Step-by-Step Mode):** Breaks multi-column tables down into single-question prompts with large touch-friendly steppers, ideal for mobile devices or users unfamiliar with statistical matrices.

### 5.3 Gateway Logic & Scope Interview
To prevent respondent intimidation from seeing empty 13-column tables:
- **Gateway Questions:** Every table is guarded by a preliminary yes/no question (`GATEWAY_CATALOG`). Selecting "Non" assigns status `NONE`, zero-fills the underlying cells, and marks the table as complete.
- **Preliminary Declaration Quiz (`EventFactInterview`):** An optional rapid-interview module positioned between Section 1 and Section 2. The respondent answers 5–7 high-level operational questions (e.g. "Did you dismiss any staff this quarter?"). This automatically pre-populates table gateway states for Sections 2, 3, and 4.

### 5.4 Arithmetic Coherence & Validation Engine
Client-side validation occurs at two levels:
1. **Structural Validation (`onefop-validation.ts`):** Enforces mandatory fields, Cameroon phone format (9 digits starting with 2 or 6), RFC email regex, and non-negative table values. Blocks submission if violated.
2. **Coherence Checker (`onefop-coherence.ts`):** Runs cross-table arithmetic checks and displays non-blocking advisory alerts (`CoherenceHints.tsx`):
   - Total permanent + temporary hires (S22Q01 + S22Q02) must equal total hires by diploma (S22Q03).
   - Departures by cause (S3Q01) must balance with dismissal reasons (S3Q02).
   - Permanent staff count in Section 1 (S1Q10) must be coherent with workforce breakdowns in Section 2.

---

## 6. BACKEND ARCHITECTURE (`src/`)

### 6.1 NestJS Module Topology
The backend is structured into modular domain boundaries:
- **`AppModule` (`app.module.ts`):** Root orchestrator loading configuration, database connection, and feature modules.
- **`AuthModule` (`auth/`):** Handles local authentication, JWT strategy (`ExtractJwt.fromAuthHeaderAsBearerToken`), role guards, password hashing, and 2FA TOTP verification.
- **`QuestionnairesModule` (`questionnaires/`):** Primary data ingestion point for ONEFOP forms. Exposes `POST /onefop/preview` (PDF generation) and `POST /onefop/submit` (atomic relational database persistence).
- **`OnefopModule` (`onefop/`):** Manages submission lifecycle queries, draft persistence (`/onefop/draft`), and active quarter definitions (`/onefop/active-quarter`).
- **`DsmoModule` (`dsmo/`):** Manages legacy DSMO declarations, employee lists, and movement metrics.
- **`DataManagementModule` (`data-management/`):** Administrative data query engine, region/sector configuration, and high-performance streaming exports (Excel and SPSS).
- **`PdfModule` (`pdf/`):** Manages headless Chromium instances via Puppeteer 22 to compile official declaration summaries into PDF format using Handlebars templates.
- **`AnalyticsModule` (`analytics/`):** Aggregates workforce trends, regional distributions, and employment forecasts.
- **`CampaignModule` (`campaign/`):** Manages quarterly declaration campaign windows and automated deadline reminders.

### 6.2 Data Ingestion Pipeline (Frontend → API → Database)
When a declaration is submitted via `POST /onefop/submit`:
```
[Client Payload: Flattened Key-Value JSON + EntityType]
                           │
                           ▼
[QuestionnairesController.submit()]
  │
  ├── 1. Normalize Keys (normalizeFlatKeys): Sanitizes casing, prefixes, and legacy Flutter mappings.
  │
  ├── 2. Map Entity Data (pdf-data-mapper.service): Maps raw flat keys into structured DTOs.
  │
  ├── 3. Execute Coherence Checks: Runs backend arithmetic verifications and builds error flags.
  │
  └── 4. QuestionnairesService.submitQuestionnaire() [Prisma Transaction]
        ├── Write OnefopSubmission (Master record with UUID, quarterCode, status: PENDING_REVIEW)
        ├── Write OnefopRespondent (Respondent identity & legal capacity)
        ├── Write Entity-Specific Detail (e.g. OnefopEnterpriseDetail, OnefopCooperativeDetail)
        ├── Decompose 2D Matrices into Normalized Relational Rows:
        │     ├── OnefopCspGenderAge (Hires/applications broken down by row/col)
        │     ├── OnefopDiplomaData
        │     ├── OnefopDisabilityData / OnefopVulnerableData
        │     ├── OnefopDepartureData / OnefopDismissalReason
        │     └── OnefopInternshipData / OnefopSkillNeed
        └── Write AuditLog record (Logs user ID, timestamp, IP address, action: SUBMISSION)
```

### 6.3 Administrative Review Workflow
Submissions follow a strict state-machine lifecycle:
```
DRAFT ──► PENDING_REVIEW ──► DIVISION_APPROVED ──► REGION_APPROVED ──► APPROVED (Final)
                │                     │                   │
                ▼                     ▼                   ▼
      CORRECTION_REQUESTED / REJECTED (Returns to establishment with reviewer remarks)
```
- **Reviewer Scoping:**
  - `DIVISIONAL` users can only see and review submissions within their assigned Department.
  - `REGIONAL` users can only see and approve submissions within their assigned Region.
  - `CENTRAL` / `SUPER_ADMIN` users have nationwide visibility and grant final approval.

---

## 7. DATABASE ARCHITECTURE (`prisma/schema.prisma`)

The database contains over **45 relational models** in a single normalized PostgreSQL schema:

### 7.1 Geographic & Administrative Hierarchy
- **`regions`:** 10 administrative regions of Cameroon (Adamaoua, Centre, Est, Extrême-Nord, Littoral, Nord, Nord-Ouest, Ouest, Sud, Sud-Ouest).
- **`departments`:** 58 administrative divisions/departments linked to regions.
- **`subdivisions`:** 360 sub-divisions (arrondissements/communes).
- **`minefop_services` & `service_positions`:** Hierarchical modeling of the Ministry's internal organizational chart.

### 7.2 Core Platform Models
- **`users`:** Accounts with hashed credentials, role assignment, assigned region/department, and 2FA status.
- **`companies`:** Registered economic establishments (name, tax number/NIU, CNPS number, legal regime, sector, address, contact details).
- **`sectors`:** National industrial classifications (Primary, Secondary, Tertiary sectors and activity branches).

### 7.3 ONEFOP Submission Models
- **`onefop_submissions` (Master Table):**
  - Primary Key: `id` (UUID).
  - Foreign Keys: `companyId`, `userId`, `regionId`, `departmentId`, `subdivisionId`.
  - Attributes: `quarterCode` (e.g. `2026-T1`), `entityType` (Enum), `status` (Enum), `flags` (JSONB coherence flags), `submittedAt`, `reviewedAt`, `reviewedBy`.
- **`onefop_respondents`:** Name, function, email, and telephone of the legal declarant.
- **Entity Specific Extension Tables (1:1 with submission):**
  - `onefop_enterprise_details`, `onefop_cooperative_details`, `onefop_ctd_details`, `onefop_ong_details`, `onefop_administration_details`, `onefop_project_program_details`, `onefop_vocational_training_details`.
- **Relational Matrix Decomposition Tables (1:Many with submission):**
  - `onefop_csp_gender_age`: Normalized cells for CSP × Sex × Age tables.
  - `onefop_diploma_data`: Normalized counts by diploma qualification.
  - `onefop_departures` & `onefop_dismissal_reasons`: Structured turnover metrics.
  - `onefop_vt_*` (12 tables): Specialized data tables for vocational training enrollments, specialties, trainers, curricula, and equipment.

---

## 8. SECURITY ARCHITECTURE

### 8.1 Authentication & Credential Storage
- **Password Security:** Salted and hashed using `bcrypt` (work factor 10). Passwords are never stored in plaintext.
- **JWT Transport:** Signed with a server secret (`JWT_SECRET`). Tokens contain `sub` (user UUID), `email`, `role`, and assigned geographic jurisdiction.
- **Two-Factor Authentication (2FA):** Implemented via `otplib` supporting RFC 6238 TOTP algorithms (compatible with Google Authenticator).

### 8.2 Authorization & Role-Based Access Control (RBAC)
Seven roles are enforced at the NestJS controller level via `@Roles(...)` decorators and `RolesGuard`:
1. `COMPANY`: Self-respondent establishments. Limited to submitting, drafting, and viewing their own declarations.
2. `DIVISIONAL`: Departmental administrative delegates. Limited to viewing and approving declarations in their assigned department.
3. `REGIONAL`: Regional administrative delegates. Limited to viewing and approving declarations in their assigned region.
4. `CENTRAL`: Central Ministry staff. Full national viewing and final approval authority.
5. `SUPER_ADMIN_DSMO`: Functional administrator dedicated to the DSMO manpower stream.
6. `SUPER_ADMIN_ONEFOP`: Functional administrator dedicated to the ONEFOP statistical stream.
7. `SUPER_ADMIN`: Root platform administrator with unrestricted access to users, roles, services, and configuration.

### 8.3 Geographic & Data-Level Isolation
Security guards and database queries dynamically inject geographic filters (`WHERE regionId = user.regionId AND departmentId = user.departmentId`) based on the authenticated user's profile, preventing horizontal privilege escalation between administrative divisions.

### 8.4 Potential Security Concerns for AI Engineering Attention
1. **Browser Token Storage:** Tokens are saved in `localStorage` / `sessionStorage` in `react-web`. Transitioning to secure `httpOnly`, `SameSite=Strict` cookies should be planned to mitigate XSS exposure.
2. **Prisma Payload Size:** Questionnaire submissions send large JSON objects. The backend uses `ValidationPipe` with relaxed properties on preview routes to handle dynamic fields; strict DTO validation should be progressively enforced.
3. **Puppeteer Sandbox Flags:** The PDF generation engine runs Chromium in headless mode. Production configurations on containerized environments (Render/Docker) require strict `--no-sandbox` isolation parameters.

---

## 9. TESTING AUDIT

| Scope | Test Framework | Test Count | Key Areas Covered | Missing / Untested Areas |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | Jest 30.4.2 (`ts-jest`) | 15 Spec Files | `analytics.controller`, `analytics.service`, `bilan.service`, `campaign-period`, `data-management.service`, `dsmo.service`, `email.service`, `onefop-shadow-validator`, `onefop-puppeteer.service`, `questionnaires.service` | Authentication controller integration tests, direct Prisma migration rollback tests |
| **Flutter Client** | `flutter_test` | 76 Test Suites | AST Schema compilation (`export_onefop_schema_test.dart`), table rendering, age-band switches, desktop excel navigation, golden screenshot tests | Flutter Web performance regression tests |
| **React Web App** | **None** | **0 Test Files** | *None* | **Critical Gap:** Zero unit tests for `onefop-validation.ts`, `onefop-coherence.ts`, `AdaptiveStatisticalTable.tsx`, or registration wizard |

---

## 10. CURRENT UX/UI AUDIT

### 10.1 Design System & Typography
- **Design Tokens:** Strict adherence to CAM-LEAP institutional tokens in `tokens.css` (`--cam-green: #1e6b3a`, `--cam-green-dark: #144a28`, `--cam-gold: #e8a020`, Cameroon flag tricolors).
- **Typography:**
  - Headers & Prompts: **Zilla Slab** (Serif) providing an authoritative, dignified administrative look.
  - Controls, Grids & Body: **IBM Plex Sans** (Sans-serif) offering high legibility on complex statistical data.
  - All font files are self-hosted offline in `.woff2` format.

### 10.2 Wizard Usability & Form Density
- **Clutter Elimination:**
  - Duplicate card headers on table containers have been removed.
  - Raw internal codes (e.g. `S21Q01`) are hidden behind an inline circular info affordance (`ⓘ`).
  - Section titles in the sidebar are formatted to clean sentence case (`Section 0. Identification du répondant`), avoiding aggressive all-caps shouting.
- **Sidebar Behavior:**
  - Fixed-height, non-expanding rail. The nested subsection accordion was eliminated to prevent dual internal scrollbars.
  - Replaces nested trees with a clean trailing progress counter (`1/3`) on multi-table sections.
- **Responsive Handling:**
  - Wide statistical matrices feature horizontal scroll containers with sticky row headers.
  - Dual-mode presentation allows switching to **Guidé** mode for smaller screens or touchscreen devices.

---

## 11. DATA ARCHITECTURE & STATISTICAL EXPORT PIPELINE

### 11.1 The Statistical Data Flow
```
1. Respondent Input (React Web / Flutter)
       │ (Auto-saved locally in Dexie IndexedDB)
       ▼
2. Remote Draft Sync (POST /onefop/draft)
       │
       ▼
3. Submission & Validation (POST /onefop/submit)
       │ (Key normalization + arithmetic coherence checks)
       ▼
4. PostgreSQL Database Insertion (Prisma ORM)
       │ (Normalized into OnefopSubmission + 20 child tables)
       ▼
5. Administrative Hierarchy Review
       │ (Divisional Delegate -> Regional Delegate -> Central Ministry)
       ▼
6. Approved Submissions Pool
       │
       ├──► Multi-Sheet Excel Streaming (POST /data-management/export/submissions/excel)
       │     (Generates sheet per entity type with formatted column headers)
       │
       ├──► SPSS Manifest Export (POST /data-management/export/submissions/spss/manifest)
       │     (Generates .sps syntax script defining VARIABLE LABELS & VALUE LABELS)
       │
       ├──► SPSS Data CSV Streaming (POST /data-management/export/submissions/spss/csv)
       │     (Streams row data matching the .sps dictionary)
       │
       └──► Official PDF Document Generation (Puppeteer + Handlebars)
             (Produces barcoded, stamped ministerial declaration document)
```

---

## 12. DEPLOYMENT & ENVIRONMENT CONFIGURATION

### 12.1 Hosting Architecture
- **Backend Service:** Deployed on **Render** as a Node.js web service running `dist/main.js`.
- **Database Service:** Hosted on **Supabase** (PostgreSQL 15+ with pgvector capabilities).
- **Web Frontend:** Designed for deployment on Vercel, Netlify, or self-hosted Docker/Node.js environments.

### 12.2 Environment Variables Reference

| Variable | Target Service | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | Backend | Pooled PostgreSQL connection string (PgBouncer) |
| `DIRECT_URL` | Backend | Direct PostgreSQL connection string for Prisma migrations |
| `JWT_SECRET` | Backend | Cryptographic secret for signing auth tokens |
| `JWT_EXPIRES_IN` | Backend | Token validity duration (e.g. `24h` or `7d`) |
| `SMTP_HOST` / `PORT` / `USER` / `PASS` | Backend | Mail server credentials for notification engine |
| `RESEND_API_KEY` | Backend | API key for transactional emails via Resend |
| `PUPPETEER_EXECUTABLE_PATH` | Backend | Absolute path to Chromium binary in production containers |
| `NODE_ENV` | Backend / Frontend | Environment flag (`development` vs `production`) |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Base URL pointing to NestJS backend API |

---

## 13. DOCUMENTATION INDEX & SUMMARY OF EXISTING SPECS

The repository contains extensive architectural documentation:
1. **`PLATFORM_README.md`:** Comprehensive technical overview of the DSMO platform, role workflows, database models, and analytics architecture.
2. **`ONEFOP_FORM_STRUCTURE_ANALYSIS.md`:** Paragraph-by-paragraph breakdown of original Word questionnaires (Questionnaire_ENTREPRISES, COOPERATIVES, etc.), mapping raw table cells to statistical question codes.
3. **`ONEFOP_ENTITY_COMPARISON.md`:** Matrix comparing structural differences across the 7 entity types.
4. **`VOCATIONAL_TRAINING_DESIGN_NOTE.md`:** Comprehensive technical spec for the Vocational Training Center (VT) wizard, detailing matrix schemas and specialty classifications.
5. **`NOTIFICATION_USER_GUIDE.md` & `NOTIFICATION_API_REFERENCE.md`:** Operational manual and API documentation for administrative email campaigns and deadline alerts.
6. **`CSP_KEYBOARD_NAVIGATION_GUIDE.md`:** UX guidelines for desktop spreadsheet keyboard navigation in 2D statistical grids.

---

## 14. TECHNICAL DEBT & RISK AUDIT

1. **Test Deficit in Frontend (`react-web`):**
   - *Risk:* `react-web/` contains critical client-side validation logic (`onefop-validation.ts`, `onefop-coherence.ts`) with **0 automated tests**. Regressions in formula recalculations could silently submit corrupt statistical data.
2. **Schema Compilation Source Duality:**
   - *Risk:* The canonical source of truth for the questionnaire schema is written in Dart (`lib/core/focus/compiler/onefop_ast.dart`) and exported via a Dart test (`test/tools/export_onefop_schema_test.dart`). A TypeScript team modifying forms must understand that editing `onefop.schema.json` directly is forbidden because it will be overwritten upon re-export.
3. **Token Storage in Web LocalStorage:**
   - *Risk:* `api-client.ts` stores JWT tokens in `localStorage`. While standard for early proofs, production hardening should adopt `httpOnly` secure cookies.
4. **Memory Footprint of Puppeteer:**
   - *Risk:* Headless Chromium instances are spawned for PDF previews. Under high concurrent submission loads (e.g. campaign deadline day), this could trigger out-of-memory errors on constrained hosting instances.
5. **Entity Name Inconsistencies:**
   - *Risk:* In the schema registry, the entity is named `enterprise` (English), while in legacy backend controllers it is often aliased as `entreprise` (French). Robust normalizers (`normalizeFlatKeys`, `normalizeEntityTypeForPreview`) mitigate this, but strict enum harmonization across all layers remains desirable.

---

# AI ENGINEERING TEAM HANDOFF

### A. Current Architecture Summary
CAM-LEAP is a dual-stream (ONEFOP & DSMO) national statistical declaration platform. The backend is a NestJS 11 application with Prisma ORM and PostgreSQL on Supabase, featuring streaming Excel/SPSS exports and Puppeteer PDF generation. The web frontend is a Next.js 16 (React 19) App Router application using CAM-LEAP design tokens (`tokens.css`), self-hosted typography, and a specialized statistical wizard engine with dual-mode entry (`[ Tableau | Guidé ]`).

### B. Critical Invariants (MUST NOT BREAK)
1. **AST Schema Singularity:** NEVER manually hand-edit `public/schemas/onefop.schema.json` or `assets/schemas/onefop.schema.json`. These files are auto-generated from `lib/core/focus/compiler/onefop_ast.dart`.
2. **Design Token Discipline:** NEVER introduce arbitrary inline hex codes or pixel spacings in `react-web/`. Every visual value must resolve against `--cam-*` or `--vt-*` tokens in `tokens.css`.
3. **Non-Blocking Coherence Checks:** Arithmetic cross-table coherence checks (`onefop-coherence.ts`) must remain advisory warnings (`CoherenceHints.tsx`). They MUST NOT block form progression or submission, as real-world establishments often have justifiable statistical exceptions.
4. **Normalized Relational Decomposition:** When adding or modifying questionnaire tables, never dump raw JSON payloads into a generic unstructured database column. All statistical tables must decompose into their normalized relational Prisma tables (`OnefopCspGenderAge`, `OnefopDiplomaData`, etc.) to support SQL/SPSS aggregation.
5. **Single Primary Button Rule:** On any wizard screen, there must be strictly **one** primary green button (`Continuer vers {next} →`), positioned at the bottom right.

### C. Important Business & Statistical Rules
- **Campaign Windows:** Submissions are tied to official quarter codes (e.g. `2026-T1`). Submissions outside an open campaign must be flagged.
- **Reporting Period Year vs Current Year:** The survey year displayed in PDFs and reports is derived from `quarterCode` (e.g. `2026-T1` → 2026), NOT `new Date().getFullYear()`.
- **Cameroon Phone Convention:** All telephone numbers must be validated as exactly 9 digits, starting with `2` (landline) or `6` (mobile).
- **Public Administration Special Case:** Public administrations DO NOT fill recruitment tables (S22Q02, S22Q03) or dismissal tables (S3Q03), as civil service staffing follows statutory public service regulations.

### D. Known UX Principles
- **Progressive Disclosure:** Respondents must never be confronted with intimidating multi-dimensional matrices without conversational gateway questions (`GATEWAY_CATALOG`).
- **Prompt-First Presentation:** Statistical cards open directly with the serif prompt. Raw technical codes (e.g. `S21Q01`) must remain tucked inside tooltip affordances (`ⓘ`).
- **Zero Nested Scrollbars:** Sidebars and cards must fit within the viewport or rely on standard window scrolling. Nested scroll containers inside the sidebar are strictly forbidden.

### E. High-Risk Areas Requiring Careful Inspection Before Editing
- **`src/questionnaires/questionnaires.service.ts`:** Handles multi-table database transactions during submission. Modifying this without verifying relational constraints can cause database rollbacks.
- **`react-web/src/components/modern-jobs/conditional/gateway-catalog.ts`:** Defines the cascade for table bypass and zero-fill logic. Breaking gateway mappings will result in incomplete submissions.
- **`src/pdf/onefop-puppeteer.service.ts` & Handlebars Templates:** Mapped data keys must match Handlebars variable placeholders exactly, or official PDFs will render blank cells.

### F. Recommended Specialist Boundaries for AI Agents
- **CTO / Systems Architect Agent:** Monorepo orchestration, Prisma schema migrations, authentication transition to httpOnly cookies, Render/Supabase infrastructure.
- **ONEFOP Domain / Statistical Agent:** AST compiler in `onefop_ast.dart`, SPSS export syntax, cross-table coherence rules, questionnaire disaggregations.
- **Frontend / UX Agent:** Next.js 16 App Router, `ModernJobsWizard`, `AdaptiveStatisticalTable`, `tokens.css` compliance, responsive mobile/desktop layout.
- **Backend / API Agent:** NestJS controllers, DTO validation, Prisma transaction pipelines, streaming ExcelJS workbooks.
- **QA / Test Engineering Agent:** Implementation of Jest/Vitest and Playwright test suites for `react-web/` (especially `onefop-validation.ts` and `onefop-coherence.ts`).
- **Security Agent:** RBAC verification, geographic data-isolation query audits, rate limiting, and password policy enforcement.

### G. Suggested First Tasks for the Incoming AI Engineering Team
1. **Task 1 (Frontend QA):** Set up Vitest or Jest in `react-web/` and implement comprehensive unit tests for `onefop-validation.ts` and `onefop-coherence.ts`.
2. **Task 2 (Analytics Migration):** Implement the React Web analytics dashboard at `/home/[slug]` (slug: `statistiques` / `analytics`) consuming the existing NestJS `AnalyticsService` endpoints.
3. **Task 3 (Auth Hardening):** Transition JWT authentication from `localStorage` to secure, encrypted `httpOnly` cookies with CSRF protection.
4. **Task 4 (E2E Test Suite):** Build a Playwright end-to-end test validating the complete declaration lifecycle: Registration → Login → Scope Quiz → Questionnaire Completion → PDF Preview → Submission → Admin Approval.
5. **Task 5 (Admin Review Screen in Web):** Port the administrative review and approval interface from Flutter into `react-web/src/app/home/declarations/[id]/review`, allowing Divisional and Regional delegates to inspect declarations and request corrections.
6. **Task 6 (Entity Normalization Cleanup):** Harmonize all backend and schema entity identifiers so that `enterprise` is used uniformly across all layers, deprecating legacy `entreprise` aliases.
7. **Task 7 (PDF Concurrency & Performance):** Implement a background worker queue (e.g. BullMQ / Redis) for Puppeteer PDF rendering to ensure high-volume submission deadlines do not exhaust server memory.
