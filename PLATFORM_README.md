# DSM-O CAMEROUN - National Workforce Intelligence Platform

A comprehensive digital platform for managing and analyzing the DSMO (Déclaration sur la Situation de la Main d'Œuvre - Manpower Report) for the Ministry of Employment and Vocational Training in Cameroon.

## 🎯 Project Overview

This platform transforms the paper-based DSMO form into a real-time labor market intelligence system that enables:

- **Companies** to submit workforce declarations digitally
- **Divisional Delegates** to review and approve declarations at the divisional level
- **Regional Delegates** to validate declarations at the regional level
- **Central Ministry** to analyze national employment trends and make data-driven policy decisions
- **Ministry Staff** to send notifications to companies about submission deadlines

## 🧱 Tech Stack

### Backend
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Email**: Nodemailer
- **Runtime**: Node.js

### Frontend
- **Framework**: Flutter (Web & Mobile)
- **State Management**: Riverpod
- **UI Components**: Material Design
- **Charts**: fl_chart
- **HTTP Client**: Dio

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Flutter Frontend                        │
│  (Web, Android, iOS) with Riverpod State Management         │
└──────────────────────┬──────────────────────────────────────┘
                       │
              HTTP/REST API (JSON)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   NestJS Backend                             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Controllers                                         │   │
│  │ - DsmoController (Declarations & Analytics)        │   │
│  │ - AuthController (User Management)                 │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │ Services                                            │   │
│  │ - DsmoService (Declaration Management)             │   │
│  │ - ValidationService (Data Validation)              │   │
│  │ - NotificationService (Email & Alerts)             │   │
│  │ - AnalyticsService (Intelligence & Forecasts)      │   │
│  │ - AuditService (Audit Trail)                       │   │
│  │ - PdfService (Document Generation)                 │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │ Prisma ORM                                          │   │
│  └────────────────────┬────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              PostgreSQL Database                             │
│                                                              │
│  Tables:                                                     │
│  - users, companies, declarations, employees                │
│  - declaration_movements, qualitative_questions              │
│  - validation_steps, audit_logs                              │
│  - notifications, notification_recipients                    │
│  - analytics_snapshots                                       │
└──────────────────────────────────────────────────────────────┘
```

## 📋 Database Schema

### Core Models

#### User
- `id` (UUID): Primary key
- `email` (String): Unique email address
- `passwordHash` (String): Bcrypt hashed password
- `firstName`, `lastName` (String): User name
- `role` (Enum): COMPANY, DIVISIONAL, REGIONAL, CENTRAL
- `region`, `department` (String): Geographic assignment

#### Company
- `id` (UUID): Primary key
- `userId` (UUID): Reference to User
- `name`, `mainActivity`, `secondaryActivity` (String)
- `region`, `department`, `district`, `address` (String)
- `taxNumber`, `cnpsNumber` (String): Identification numbers
- `socialCapital` (Float): Capital social

#### Declaration
- `id` (UUID): Primary key
- `companyId` (UUID): Reference to Company
- `year` (Int): Declaration year
- `region`, `division` (String): Geographic identifiers
- `status` (Enum): DRAFT, SUBMITTED, DIVISION_APPROVED, REGION_APPROVED, FINAL_APPROVED, REJECTED
- `submittedAt`, `validatedAt` (DateTime)
- `employees` (Relation): Array of Employee records
- `movements` (Relation): Array of DeclarationMovement records
- `qualitativeAnswers` (Relation): Qualitative question responses
- `validationSteps` (Relation): Validation audit trail

#### Employee
- `id`, `declarationId` (UUID)
- `fullName`, `gender`, `nationality`, `function` (String)
- `age`, `seniority` (Int)
- `diploma`, `salaryCategory` (String): "1-3", "4-6", "7-9", "10-12", "non-declared"

#### DeclarationMovement
- `id`, `declarationId` (UUID)
- `movementType` (Enum): RECRUITMENT, PROMOTION, DISMISSAL, RETIREMENT, DEATH
- `cat1_3`, `cat4_6`, `cat7_9`, `cat10_12`, `catNonDeclared` (Int): Count by category

#### Notification
- `id`, `sentBy` (UUID): Sender user
- `subject`, `message` (String): Notification content
- `regionFilter`, `departmentFilter` (String): Target filters
- `recipientCount` (Int)
- `sentAt` (DateTime)
- `recipients` (Relation): Array of NotificationRecipient records

#### AuditLog
- `id`, `userId`, `declarationId` (UUID)
- `action` (String): "SUBMIT", "APPROVE", "REJECT", etc.
- `resourceType`, `resourceId` (String): What was changed
- `previousValue`, `newValue` (JSON): Before/after values
- `timestamp` (DateTime)

## 🔑 User Roles & Permissions

### COMPANY
- Submit DSMO declarations
- View own declarations
- Edit DRAFT declarations
- Download declaration receipts

### DIVISIONAL
- View declarations in their division
- Approve SUBMITTED declarations → DIVISION_APPROVED
- Reject declarations with reason
- Send notifications to companies in their division
- View audit logs for their division

### REGIONAL
- View declarations in their region
- Approve DIVISION_APPROVED declarations → REGION_APPROVED
- Reject declarations with reason
- Send notifications to companies in their region
- View analytics for their region

### CENTRAL
- Full access to all declarations
- Approve REGION_APPROVED declarations → FINAL_APPROVED
- Send notifications to all companies
- Access full analytics dashboard
- View national employment trends
- Generate policy reports
- View all audit logs

## 📱 REST API Endpoints

### Authentication
```
POST   /auth/register          - Register new user
POST   /auth/login             - Login and get JWT token
POST   /auth/refresh           - Refresh JWT token
GET    /auth/me                - Get current user info
```

### DSMO Declarations
```
POST   /dsmo/declaration                      - Submit declaration
GET    /dsmo/declarations                     - List declarations (filtered by role)
GET    /dsmo/declarations/:id                 - Get declaration details
GET    /dsmo/declarations/pending              - Get pending declarations to approve
PATCH  /dsmo/declarations/:id/approve         - Approve declaration
PATCH  /dsmo/declarations/:id/reject          - Reject declaration
GET    /dsmo/declarations/:id/stats           - Declaration statistics
```

### Notifications
```
POST   /dsmo/notifications/send               - Send notification to companies
POST   /dsmo/notifications/deadline-reminder  - Send deadline reminders
GET    /dsmo/notifications                    - List sent notifications
GET    /dsmo/notifications/:id                - Get notification details
GET    /dsmo/notifications/:id/stats          - Get engagement stats
```

### Analytics (CENTRAL only)
```
GET    /dsmo/analytics/dashboard-summary       - National employment overview
GET    /dsmo/analytics/employment-by-region    - Employment by region
GET    /dsmo/analytics/employment-trends       - Employment trends over years
GET    /dsmo/analytics/sector-distribution     - Top sectors by employment
GET    /dsmo/analytics/gender-distribution     - Gender breakdown
GET    /dsmo/analytics/category-distribution   - Socio-professional categories
GET    /dsmo/analytics/recruitment-forecast    - Future recruitment projections
GET    /dsmo/analytics/unemployment-risk       - High-risk regions
GET    /dsmo/analytics/labor-shortages         - Sectors needing workers
GET    /dsmo/analytics/recruitment-plans       - Companies planning to hire
```

## 🚀 Deployment Guide

### Prerequisites
- Node.js >= 16.0
- PostgreSQL >= 12
- Flutter SDK (for frontend)
- Docker & Docker Compose (optional)

### Backend Setup

1. **Clone repository**
   ```bash
   git clone https://github.com/ministry/dsmo-platform.git
   cd dsmo-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and settings
   ```

4. **Setup database**
   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed  # Load sample data
   ```

5. **Start backend**
   ```bash
   npm run start:dev   # Development
   npm run start       # Production
   ```

### Frontend Setup

1. **Navigate to Flutter app**
   ```bash
   cd frontend  # or wherever Flutter app is located
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Configure API base URL**
   Edit `lib/data/api_client.dart`:
   ```dart
   const String apiBaseUrl = 'https://api.dsmo.ministry.cm';
   ```

4. **Build and run**
   ```bash
   flutter run -d chrome          # Web
   flutter run -d android          # Android emulator
   flutter run -d ios             # iOS simulator
   ```

### Email Configuration

Set these environment variables for email notifications:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=dsmo@ministry.cm
APP_URL=https://dsmo.ministry.cm
```

## 📊 Key Features

### 1. Declaration Management
- **Digital Form**: Complete DSMO Part A (enterprise data) and Part B (employee list)
- **Data Validation**: Real-time validation with clear error messages
- **Draft Saving**: Save declarations as drafts and return later
- **PDF Receipt**: Generate and download declaration receipt with QR code

### 2. Hierarchical Approval Workflow
```
DRAFT → SUBMITTED → DIVISION_APPROVED → REGION_APPROVED → FINAL_APPROVED
         ↓              ↓                    ↓
      (Divisional)   (Regional)          (Central)
      can reject     can reject          can reject
```

### 3. Notification System
Ministry delegates can:
- Send custom notifications to companies
- Filter recipients by region, department, submission status
- Preview recipient count before sending
- Track notification delivery and open rates
- Schedule deadline reminders

### 4. Workforce Analytics
CENTRAL users access:
- **Dashboard**: National employment overview with key metrics
- **Regional Analysis**: Compare employment by region
- **Sector Analysis**: Top sectors by employment and growth
- **Trend Analysis**: Historical employment changes
- **Forecasting**: Predict recruitment needs
- **Risk Analysis**: Identify regions with unemployment risk
- **Labor Insights**: Sectors with shortages and companies planning recruitment

### 5. Audit Trail
Complete logging of:
- All user actions (submit, approve, reject)
- Data changes with before/after values
- User identity and timestamp
- Queryable by declaration, user, or action type

## 📈 Data Export Features

- **CSV Export**: Download declarations and employee data
- **Excel Export**: Generate analytics reports
- **PDF Reports**: National employment summaries for policy makers

## 🔐 Security Features

### Authentication
- JWT-based authentication with refresh tokens
- Bcrypt password hashing
- Secure session management

### Authorization
- Role-based access control (RBAC)
- Granular permissions per endpoint
- Geographic filtering (region/division isolation)

### Data Protection
- All declarations encrypted in transit (HTTPS)
- Sensitive data fields encrypted at rest
- PII handling compliance

## 📚 Sample Data

The platform includes sample data for:
- 100+ companies across 10 regions
- 5000+ employees with diverse profiles
- Historical declarations for 2021-2024
- Sample notifications and audit logs

Load sample data:
```bash
npx prisma db seed
```

## 📖 API Documentation

Full interactive API documentation available at:
```
http://localhost:3000/api/docs
```

Swagger UI with ability to test all endpoints.

## 🧪 Testing

### Backend Tests
```bash
npm run test              # Unit tests
npm run test:e2e         # End-to-end tests
npm run test:cov         # Coverage report
```

### Frontend Tests
```bash
flutter test
```

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
psql -U postgres -h localhost

# Reset database
npx prisma migrate reset
```

### Email Not Sending
- Verify SMTP credentials in .env
- Check SSL/TLS settings (Gmail requires app-specific password)
- Enable "Less secure app access" if using Gmail

### Flutter Build Issues
```bash
flutter clean
flutter pub get
flutter pub upgrade
```

## 📞 Support & Contact

For technical support:
- Email: support@dsmo.ministry.cm
- Slack: #dsmo-platform-support
- GitHub Issues: Report bugs and feature requests

## 📄 License

This project is licensed under the Government of Cameroon License - See LICENSE file for details.

## 🙏 Acknowledgments

Built for the Ministry of Employment and Vocational Training (MINEFOP) of Cameroon to modernize workforce reporting and enable data-driven employment policy making.

---

**Version**: 1.0.0  
**Last Updated**: April 2026  
**Status**: Production Ready
