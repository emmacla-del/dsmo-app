# 🚀 Quick Reference - Notification System API

## Overview
Simple REST API for sending targeted email notifications to companies about DSMO deadlines.

---

## Core Endpoints

### 1. Send Notification
```http
POST /dsmo/notifications/send
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "subject": "Rappel de soumission DSM-O",
  "message": "Veuillez soumettre votre déclaration avant le 31 décembre...",
  "filters": {
    "regionFilter": "Région Centre",
    "departmentFilter": "Division Mfoundi",
    "submissionStatus": null
  }
}
```

**Response:**
```json
{
  "notificationId": "550e8400-e29b-41d4-a716-446655440000",
  "totalRecipients": 45,
  "successfulSends": 43,
  "failedSends": 2,
  "failures": [
    {
      "companyId": "uuid",
      "email": "old@example.com",
      "reason": "Invalid email address"
    }
  ]
}
```

---

### 2. Send Deadline Reminders
```http
POST /dsmo/notifications/deadline-reminder
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "year": 2024,
  "deadlineDate": "2024-12-31",
  "regionFilter": "Région Centre",
  "departmentFilter": null
}
```

**Response:**
```json
{
  "sent": 42,
  "failed": 1,
  "total": 43
}
```

---

### 3. Get All Notifications
```http
GET /dsmo/notifications?page=1&limit=20
Authorization: Bearer {JWT_TOKEN}
```

**Response:**
```json
[
  {
    "id": "uuid",
    "subject": "Rappel de soumission",
    "message": "Veuillez...",
    "sentBy": "central@ministry.cm",
    "sentAt": "2024-04-07T10:30:00Z",
    "recipientCount": 45,
    "recipients": [
      {
        "id": "uuid",
        "email": "company1@example.cm",
        "status": "SENT",
        "sentAt": "2024-04-07T10:30:00Z",
        "openedAt": null
      }
    ]
  }
]
```

---

### 4. Get Notification Details
```http
GET /dsmo/notifications/{notification_id}
Authorization: Bearer {JWT_TOKEN}
```

---

### 5. Get Engagement Statistics
```http
GET /dsmo/notifications/{notification_id}/stats
Authorization: Bearer {JWT_TOKEN}
```

**Response:**
```json
{
  "notificationId": "uuid",
  "subject": "Rappel de soumission",
  "totalRecipients": 100,
  "sent": 98,
  "failed": 2,
  "bounced": 0,
  "opened": 45,
  "openRate": "45.00%",
  "sentAt": "2024-04-07T10:30:00Z"
}
```

---

## Access Control

### Who Can Send?

| Role | Can Send To |
|------|------------|
| DIVISIONAL | Companies in their division only |
| REGIONAL | Companies in their region only |
| CENTRAL | All companies (with optional region/dept filters) |

### What Filters Are Allowed?

```typescript
interface NotificationFilters {
  regionFilter?: string;        // e.g., "Région Centre"
  departmentFilter?: string;    // e.g., "Division Mfoundi"
  submissionStatus?: string;    // e.g., "SUBMITTED"
}
```

---

## Error Responses

### Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "UnauthorizedException"
}
```

### Forbidden
```json
{
  "statusCode": 403,
  "message": "Cannot send to companies outside your region",
  "error": "ForbiddenException"
}
```

### No Recipients Found
```json
{
  "statusCode": 400,
  "message": "No companies found matching the specified filters",
  "error": "BadRequestException"
}
```

---

## Implementation Example (cURL)

```bash
# Send notification to Division Mfoundi companies
curl -X POST https://api.dsmo.ministry.cm/dsmo/notifications/send \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Rappel: Échéance DSM-O 2024",
    "message": "Veuillez soumettre votre déclaration avant le 31 décembre 2024.",
    "filters": {
      "regionFilter": "Région Centre",
      "departmentFilter": "Division Mfoundi",
      "submissionStatus": null
    }
  }'
```

---

## Backend Service Methods

### NotificationService.ts

```typescript
// Send custom notification
async sendNotification(
  userId: string,
  subject: string,
  message: string,
  filters: {
    regionFilter?: string;
    departmentFilter?: string;
    submissionStatus?: DeclarationStatus;
  }
): Promise<{
  notificationId: string;
  successfulSends: number;
  failedSends: number;
  failures?: any[];
}>

// Send deadline reminders
async sendDeadlineReminders(
  year: number,
  deadlineDate: Date,
  regionFilter?: string,
  departmentFilter?: string
): Promise<{ sent: number; failed: number; total: number }>

// Get notifications history
async getNotifications(
  userId: string,
  page?: number,
  limit?: number
): Promise<Notification[]>

// Get notification details
async getNotificationDetails(notificationId: string)

// Get engagement stats
async getNotificationStats(notificationId: string): Promise<{
  notificationId: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  bounced: number;
  opened: number;
  openRate: string;
}>

// Mark as opened (called from email tracking)
async markNotificationAsOpened(recipientId: string)
```

---

## Email Configuration

Set in `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=dsmo@ministry.cm
APP_URL=https://dsmo.ministry.cm
```

---

## Database Schema

### notifications table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  sentBy UUID REFERENCES users(id),
  regionFilter TEXT,
  departmentFilter TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  recipientCount INT,
  sentAt TIMESTAMP DEFAULT now()
);
```

### notification_recipients table
```sql
CREATE TABLE notification_recipients (
  id UUID PRIMARY KEY,
  notificationId UUID REFERENCES notifications(id),
  companyId UUID REFERENCES companies(id),
  email TEXT,
  status TEXT,  -- SENT, FAILED, BOUNCED, OPENED
  sentAt TIMESTAMP,
  openedAt TIMESTAMP
);
```

---

## Testing

### Unit Tests
```bash
npm test -- notification.service.spec.ts
```

### Example Test
```typescript
it('should send notification to divisional companies', async () => {
  const result = await notificationService.sendNotification(
    divisionalUserId,
    'Test Subject',
    'Test Message',
    { departmentFilter: 'Division Mfoundi' }
  );

  expect(result.successfulSends).toBeGreaterThan(0);
  expect(result.notificationId).toBeDefined();
});
```

---

## Audit Trail

Every notification is logged:

```json
{
  "userId": "uuid",
  "action": "SEND_NOTIFICATION",
  "resourceType": "Notification",
  "resourceId": "uuid",
  "details": "Sent notification to 45 companies. Subject: Rappel...",
  "timestamp": "2024-04-07T10:30:00Z"
}
```

Query audit trail:
```typescript
const logs = await auditService.getAuditLogsByAction('SEND_NOTIFICATION');
```

---

## Rate Limiting

Default: 100 requests per 15 minutes per user

For notifications:
- Bulk sends: Can send up to 5,000 recipients per request
- Frequency: No limit between sends, but recommend 1+ hour for audit trail clarity

---

## Common Use Cases

### Case 1: Monthly Reminder
```typescript
await notificationService.sendNotification(
  userId,
  'Rappel mensuel - Statut DSM-O',
  'Ce mois-ci, veuillez mettre à jour vos données...',
  { departmentFilter: 'Division Mfoundi' }
);
```

### Case 2: Deadline Alert
```typescript
await notificationService.sendDeadlineReminders(
  2024,
  new Date('2024-12-31'),
  'Région Centre'
);
```

### Case 3: National Announcement
```typescript
await notificationService.sendNotification(
  userId,
  'Annonce: Nouvelles exigences DSM-O 2024',
  'À partir d\'aujourd\'hui, toutes les entreprises doivent...',
  {} // No filters = all companies
);
```

---

## Performance Notes

- **Sending**: Async, non-blocking
- **Email Queue**: Retries up to 3 times on failure
- **Throughput**: ~100 emails/second (depends on SMTP provider)
- **Tracking**: Stored in database, queryable within milliseconds

---

## Troubleshooting

### Email Not Sending
1. Check SMTP credentials in .env
2. Verify firewall allows SMTP port
3. Check spam folder for test emails
4. View `notification_recipients` table for failure reasons

### Wrong Recipients
1. Verify filters applied correctly in request
2. Check role of sending user (can they access that region?)
3. Look at audit logs to verify request details

### High Failure Rate
1. Verify email addresses in `companies` user records
2. Check with email provider about delivery issues
3. Monitor SMTP server logs

---

## API Response Codes

| Code | Meaning |
|------|---------|
| 201 | Notification created successfully |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 500 | Server error |

---

**Quick Start**: See `NOTIFICATION_USER_GUIDE.md` for step-by-step instructions.  
**Full Details**: See `IMPLEMENTATION_GUIDE.md` for architecture deep-dive.
