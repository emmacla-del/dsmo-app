# DSMO Platform - Developer Implementation Guide

## 📚 Table of Contents
1. [Notification System](#notification-system)
2. [Analytics Engine](#analytics-engine)
3. [Validation System](#validation-system)
4. [Approval Workflow](#approval-workflow)
5. [Key Implementation Details](#key-implementation-details)

---

## 🔔 Notification System

### Overview
The notification system allows ministry delegates (DIVISIONAL, REGIONAL, and CENTRAL roles) to send targeted email notifications to companies about DSMO submission deadlines and other important announcements.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           NotificationService (notification.service.ts)     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  sendNotification()                                          │
│  ├─ Verify user role (DIVISIONAL/REGIONAL/CENTRAL)        │
│  ├─ Build recipient filter based on region/department       │
│  ├─ Query companies matching filters                        │
│  ├─ Create Notification record                             │
│  ├─ Loop through companies:                                │
│  │  ├─ Create NotificationRecipient                        │
│  │  ├─ Send email via Nodemailer                           │
│  │  └─ Log audit event                                     │
│  └─ Return delivery statistics                             │
│                                                              │
│  sendDeadlineReminders()                                   │
│  ├─ Query companies WITHOUT submitted declaration          │
│  ├─ For each company, send deadline email                 │
│  └─ Track sent/failed counts                              │
│                                                              │
│  getNotifications()                                        │
│  ├─ Retrieve notifications sent by current user           │
│  ├─ Apply role-based filtering                            │
│  └─ Return paginated results with statistics              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Methods

#### 1. **sendNotification()**
Sends targeted notifications to companies.

**Request:**
```json
{
  "subject": "Rappel: Échéance de soumission DSM-O 2024",
  "message": "Veuillez soumettre votre déclaration avant le 31 décembre 2024...",
  "filters": {
    "regionFilter": "Région Centre",
    "departmentFilter": "Division Mfoundi",
    "submissionStatus": "SUBMITTED"
  }
}
```

**Response:**
```json
{
  "notificationId": "uuid...",
  "totalRecipients": 45,
  "successfulSends": 43,
  "failedSends": 2,
  "failures": [
    {
      "companyId": "uuid...",
      "email": "old@example.com",
      "reason": "Invalid email address"
    }
  ]
}
```

**Access Control:**
- DIVISIONAL: Can only send to companies in their department
- REGIONAL: Can only send to companies in their region
- CENTRAL: Can send to all companies, with optional region/department filters

#### 2. **sendDeadlineReminders()**
Automated deadline reminder system.

**Usage:**
```typescript
await notificationService.sendDeadlineReminders(
  2024,                          // year
  new Date('2024-12-31'),        // deadline date
  'Région Centre',               // optional region filter
  null                           // optional department filter
);
```

**Logic:**
1. Queries companies that have NOT submitted declaration for year 2024
2. Sends personalized email to each company's contact
3. Includes link to DSMO platform

#### 3. **getNotificationStats()**
Tracks engagement metrics.

**Returns:**
```json
{
  "notificationId": "uuid...",
  "subject": "Rappel de soumission",
  "totalRecipients": 100,
  "sent": 98,
  "failed": 2,
  "bounced": 1,
  "opened": 45,
  "openRate": "45.00%",
  "sentAt": "2024-04-07T10:30:00Z"
}
```

### Email Template
The system generates HTML emails with:
- Ministry header (DSMO branding)
- Company name personalization
- Message content
- Call-to-action button to DSMO platform
- Footer with contact information

### Database Schema for Notifications

```sql
-- Notification (one per send action)
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  sentBy UUID REFERENCES auth.users(id),
  regionFilter TEXT,
  departmentFilter TEXT,
  submissionStatus DeclarationStatus,
  subject TEXT,
  message TEXT,
  recipientCount INT,
  sentAt TIMESTAMP DEFAULT now()
);

-- NotificationRecipient (one per company notified)
CREATE TABLE notification_recipients (
  id UUID PRIMARY KEY,
  notificationId UUID REFERENCES notifications(id) ON DELETE CASCADE,
  companyId UUID REFERENCES companies(id),
  email TEXT,
  status NotificationStatus,  -- SENT, FAILED, BOUNCED, OPENED
  sentAt TIMESTAMP,
  openedAt TIMESTAMP
);
```

---

## 📊 Analytics Engine

### Overview
The analytics system provides real-time workforce intelligence to CENTRAL ministry users for policy-making and strategic planning.

### Key Analytics Features

#### 1. **Employment by Region**
```typescript
async getEmploymentByRegion(year: number)
```

Returns employment data aggregated by region:
```json
[
  {
    "region": "Région Centre",
    "totalEmployees": 150000,
    "maleEmployees": 95000,
    "femaleEmployees": 55000,
    "companyCount": 1200,
    "avgEmployeesPerCompany": 125
  }
]
```

#### 2. **Employment Trends**
```typescript
async getEmploymentTrends(startYear: number, endYear: number)
```

Shows historical recruitment and dismissal patterns:
```json
[
  {
    "year": 2022,
    "totalEmployees": 500000,
    "totalRecruitments": 50000,
    "totalDismissals": 10000,
    "netChange": 40000
  }
]
```

#### 3. **Sector Distribution**
```typescript
async getSectorDistribution(year: number)
```

Top sectors by employment and growth:
```json
[
  {
    "sector": "Agriculture",
    "employees": 75000,
    "companies": 450,
    "avgEmployeesPerCompany": 167
  },
  {
    "sector": "Manufacturing",
    "employees": 120000,
    "companies": 380,
    "avgEmployeesPerCompany": 316
  }
]
```

#### 4. **Gender Distribution**
```typescript
async getGenderDistribution(year: number, region?: string)
```

Gender breakdown with percentages:
```json
{
  "male": { "count": 350000, "percentage": "63.64" },
  "female": { "count": 200000, "percentage": "36.36" },
  "total": 550000
}
```

#### 5. **Recruitment Forecast**
```typescript
async getRecruitmentForecast(years: number = 3, forecastYears: number = 2)
```

Uses moving average to project future recruitment:
```json
[
  { "year": 2025, "forecastedRecruitment": 48000, "confidence": "Medium" },
  { "year": 2026, "forecastedRecruitment": 45000, "confidence": "Medium" }
]
```

#### 6. **Unemployment Risk Assessment**
```typescript
async getUnemploymentRiskRegions(year: number)
```

Identifies regions with low recruitment relative to workforce:
```json
[
  {
    "region": "Région Nord",
    "riskScore": 0.02,
    "totalEmployees": 50000,
    "recruitments": 1000,
    "riskLevel": "HIGH"
  }
]
```

Scoring logic:
- Risk = Recruitments / Total Employees
- HIGH: if recruitment < 5% of workforce
- MEDIUM: 5-10% of workforce

#### 7. **Labor Shortage Identification**
```typescript
async getSectorLaborShortages(year: number)
```

Sectors with high recruitment demand:
```json
[
  {
    "sector": "Healthcare",
    "employees": 20000,
    "recruitments": 3000,
    "shortageIndex": 15.0
  }
]
```

Shortage Index = (Recruitments / Employees) × 100

#### 8. **Recruitment Planning**
```typescript
async getCompaniesWithRecruitmentPlans(year: number, limit: number = 20)
```

Companies planning to hire:
```json
[
  {
    "company": "Company A",
    "sector": "Manufacturing",
    "region": "Région Centre",
    "plannedRecruitments": 50,
    "hasCamerunisationPlan": true
  }
]
```

Data comes from `qualitativeAnswers` table where `recruitmentPlansNext = true`

### Dashboard Summary Endpoint

```typescript
async getDashboardSummary(year: number, region?: string)
```

Comprehensive overview for CENTRAL users:
```json
{
  "year": 2024,
  "region": "National",
  "totalDeclarations": 5000,
  "totalEmployees": 600000,
  "employmentGrowthRate": "8.5%",
  "genderDistribution": {
    "male": "63.64%",
    "female": "36.36%"
  },
  "topSectors": [
    { "sector": "Agriculture", "employees": 150000 },
    { "sector": "Manufacturing", "employees": 120000 }
  ],
  "totalRecruitments": 50000,
  "totalDismissals": 10000,
  "netChange": 40000
}
```

---

## ✔️ Validation System

### Overview
The validation system ensures data integrity before declarations are submitted.

### Validation Rules

#### 1. **Gender Sum Validation**
```
Males + Females = Total Employees
```
If not equal, declaration is rejected with error message.

#### 2. **Category Sum Validation**
```
cat1_3 + cat4_6 + cat7_9 + cat10_12 + nonDeclared = Total Employees
```

#### 3. **Movement Consistency**
```
Total movements should not exceed workforce size × 2
(Indicates unrealistic turnover)
```

#### 4. **Workforce Growth Check**
```
Year-over-year growth should not exceed 50%
(Flags for manual review, not hard error)
```

#### 5. **Employee Data Validation**
Per-employee checks:
- `fullName`: Not empty
- `gender`: M, F, or Other
- `age`: 15-100
- `seniority`: ≥ 0
- `salaryCategory`: Valid category

### Validation Flow

```
Declaration Submission
  ↓
Run All Validations
  ├─ Gender Sum Check
  ├─ Category Sum Check
  ├─ Movement Consistency
  ├─ Workforce Growth
  └─ Employee Data Validation
  ↓
All Pass? ─── NO ──→ Return Error Messages (REJECT)
  │
  YES
  ↓
Create Validation Steps (Audit)
  ↓
Update Status to SUBMITTED
  ↓
Success
```

### ValidationStep Records

Each validation check creates a record:

```json
{
  "stepType": "GENDER_SUM",
  "isValid": true,
  "message": null,
  "checkedAt": "2024-04-07T10:30:00Z"
}
```

---

## 🔄 Approval Workflow

### Declaration Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPANY                                  │
│  Creates DRAFT declaration, adds employees, saves file       │
└──────────────────────┬──────────────────────────────────────┘
                       │ Submit & Validate
                       ↓
        ┌──────────────────────────────────┐
        │       SUBMITTED                  │
        │  Awaiting divisional review      │
        └──────────────┬───────────────────┘
                       │
        ┌──────────────▼───────────────────┐
        │    DIVISIONAL REVIEW             │
        │  (Divisional Delegate)           │
        │  - Reviews company data          │
        │  - Checks validation steps       │
        │  - Approves or rejects with note │
        └──────────────┬───────────────────┘
                       │ Approve
                       ↓
        ┌──────────────────────────────────┐
        │ DIVISION_APPROVED                 │
        │  Forwarded to region              │
        └──────────────┬───────────────────┘
                       │
        ┌──────────────▼───────────────────┐
        │    REGIONAL REVIEW               │
        │  (Regional Delegate)             │
        │  - Reviews compliance            │
        │  - Compares with regional data   │
        │  - Approves or rejects           │
        └──────────────┬───────────────────┘
                       │ Approve
                       ↓
        ┌──────────────────────────────────┐
        │ REGION_APPROVED                   │
        │  Forwarded to ministry center     │
        └──────────────┬───────────────────┘
                       │
        ┌──────────────▼───────────────────┐
        │     CENTRAL FINAL REVIEW         │
        │  (Ministry Central Authority)    │
        │  - Final validation              │
        │  - Aggregate statistics          │
        │  - Approves for analytics        │
        └──────────────┬───────────────────┘
                       │ Approve
                       ↓
        ┌──────────────────────────────────┐
        │    FINAL_APPROVED                 │
        │  Declaration complete & locked   │
        │  Data included in analytics      │
        └──────────────────────────────────┘
```

### Rejection Path

At any stage, a reviewer can reject with reason:

```
Current Status ─── REJECT ──→ REJECTED
                    + Reason
                    + Timestamp
                    + Reviewer ID

Company can:
- View rejection reason
- Create new DRAFT
- Resubmit corrected declaration
```

### Approval Process Implementation

```typescript
// Approve declaration
async approveDeclaration(
  declarationId: string,
  userId: string,
  notes?: string
): Promise<Declaration>

// Reject declaration
async rejectDeclaration(
  declarationId: string,
  userId: string,
  reason: string
): Promise<Declaration>

// Both methods:
// 1. Verify user role and authorization
// 2. Check current declaration status
// 3. Validate status transition is allowed
// 4. Update declaration record
// 5. Log audit trail
// 6. Return updated declaration
```

---

## 🛠️ Key Implementation Details

### 1. Role-Based Access Control (RBAC)

**Implemented via:**
- JWT claims including `role`, `region`, `department`
- `@Roles()` decorator on controller methods
- `RolesGuard` middleware for authorization
- Query filters applied by service methods

**Example:**
```typescript
@Get('declarations/pending')
@Roles('DIVISIONAL', 'REGIONAL', 'CENTRAL')
async getPending(@Req() req) {
  // Service filters based on req.user.role
  //  - DIVISIONAL: only own department
  //  - REGIONAL: only own region
  //  - CENTRAL: all
  return this.dsmoService.getPendingDeclarations(req.user);
}
```

### 2. Audit Trail

Every action is logged with:
```json
{
  "userId": "uuid",
  "action": "APPROVE_DECLARATION",
  "resourceType": "Declaration",
  "resourceId": "uuid",
  "previousValue": { "status": "SUBMISSION_APPROVED" },
  "newValue": { "status": "REGION_APPROVED" },
  "timestamp": "2024-04-07T10:30:00Z"
}
```

Query audit for declaration:
```typescript
const trail = await auditService.getDeclarationAuditTrail(declarationId);
// Returns chronological list of all changes
```

### 3. Email Template System

HTML email generation with:
- Ministry branding (emerald color scheme)
- Company name personalization
- Dynamic message content
- Embedded action button
- Footer with contact info

Customizable via `generateEmailHtml()` method.

### 4. Concurrent Request Handling

The system is designed to handle:
- Multiple simultaneous company submissions
- Parallel approvals by different delegates
- Concurrent notification sends
- Analytics queries during heavy use

Using:
- Connection pooling in Prisma
- Async/await for non-blocking operations
- Database indexes on frequently queried fields

### 5. Error Handling

Consistent error responses:
```json
{
  "statusCode": 400,
  "message": "Validation failed: Males (100) + Females (102) ≠ Total (200)",
  "error": "BadRequestException"
}
```

Common scenarios:
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Missing/invalid JWT
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Status conflict (e.g., approval when not in SUBMITTED state)

---

## 📈 Performance Considerations

### Database Optimization
- Indexes on `userId`, `companyId`, `year`, `status`, `region`, `department`
- Foreign key constraints for referential integrity
- Pagination for large result sets (max 100 per page)

### Query Performance
- Aggregate queries use GROUP BY and materialized views
- Trend queries cached for 1 hour
- Analytics dashboard data pre-computed nightly

### Scalability
- Stateless API servers (can run multiple instances)
- Database connection pooling (max 20 connections)
- Email sending offloaded to queue (Nodemailer with retries)

---

## 🧪 Testing

### Unit Tests (Jest)
```bash
npm test -- notification.service.spec.ts
npm test -- validation.service.spec.ts
npm test -- analytics.service.spec.ts
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e -- dsmo.e2e-spec.ts
```

---

## 📖 Additional Resources

- [REST API Documentation](./API.md)
- [Database Schema](./DATABASE.md)
- [Flutter Implementation Guide](./FLUTTER.md)
- [Deployment Checklist](./DEPLOYMENT.md)

---

**Document Version**: 1.0.0  
**Last Updated**: April 2026  
**Author**: Ministry of Employment and Vocational Training, Cameroon
