# 📧 DSMO Platform - Notification System Quick Start Guide

**For Ministry Delegates (DIVISIONAL, REGIONAL, CENTRAL roles)**

---

## 🎯 Overview

The DSMO platform allows you to send targeted email notifications to companies about important deadlines, announcements, and submission statuses. This guide walks you through the process.

## 📱 Accessing Notification Feature

### Step 1: Login
1. Visit [https://dsmo.ministry.cm](https://dsmo.ministry.cm)
2. Login with your ministry credentials
3. Confirm you see your role: **DIVISIONAL**, **REGIONAL**, or **CENTRAL**

### Step 2: Navigate to Notifications
1. From the main dashboard, click **"Notifications"** in the menu
2. Or click the **"Send Notification"** button if available

## 📧 Sending a Deadline Reminder

### What You Can Do:
- **DIVISIONAL**: Send to companies in your division only
- **REGIONAL**: Send to companies in your region only  
- **CENTRAL**: Send to all companies in Cameroon

### Step-by-Step Process:

#### 1. Click "Send New Notification"
```
Dashboard → Notifications → "Send New Notification" button
```

#### 2. Configure Recipients (Filters)

Choose who should receive this notification:

**Option A: Divisional Delegate**
- Region is auto-set to your region
- Select your specific division(s)
- (Cannot change region)

**Option B: Regional Delegate**
- Region is auto-set to your region
- Can optionally filter by specific divisions
- (Cannot change region)

**Option C: Central Authority**
- Select regions: 
  - "Toutes" (All regions)
  - Or specific regions: Région Centre, Région Littoral, etc.
- Select divisions (optional):
  - "Toutes" (All)
  - Or specific divisions
- Filter by submission status (optional):
  - All submissions
  - SUBMITTED (Pending approval)
  - DIVISION_APPROVED (Approved at divisional level)
  - REGION_APPROVED (Approved at regional level)

#### 3. Review Recipient Count

After setting filters, the system shows:
```
📊 Estimated recipients: 45 companies
```

This helps you verify you're targeting the right companies. Click **"Estimate"** to refresh if needed.

#### 4. Compose Message

**Subject Line:**
- Keep concise (max 200 characters)
- Example: "Rappel: Échéance de soumission DSM-O 2024"

**Message Body:**
- Write in French (platform standard)
- Max 1000 characters
- Example:

```
Madame, Monsieur,

Rappel : La date limite de soumission de votre Déclaration sur la 
Situation de la Main d'Œuvre (DSM-O) pour l'année 2024 est le 
31 décembre 2024.

Veuillez soumettre votre déclaration avant cette date via la plateforme 
DSMO. Les déclarations tardives pourront être sanctionnées.

Pour accéder à la plateforme :
https://dsmo.ministry.cm

Cordialement,
Ministère de l'Emploi et de la Formation Professionnelle
```

#### 5. Preview (Optional)

Before sending, you can see:
- Sample email as companies will receive it
- Subject line
- Message content
- Call-to-action button to DSMO platform
- Ministry footer

#### 6. Send Notification

Click **"ENVOYER LA NOTIFICATION"** (SEND NOTIFICATION)

System will:
1. ✉️ Send email to all recipients
2. 📊 Track delivery status
3. 📋 Log the notification in your history
4. 🔍 Create audit trail

#### 7. Confirmation

You'll see:
```
✅ Notification sent to 45 companies
   - 43 successful sends
   - 2 delivery failures
```

If failures occur, the system shows which companies failed and why:
```
Failures:
- Company A: Invalid email address (contact@company-a.cm)
- Company B: Server rejected delivery (wrong-email@example.cm)
```

## 📨 Built-In Deadline Reminder (Quick Option)

### For Standard Annual Deadlines:

**Step 1:** Click **"Quick Deadline Reminder"**

**Step 2:** Set deadline details:
```
Year: 2024
Deadline Date: 31/12/2024
Recipients: Companies without completed declaration
Region Filter: (optional)
Department Filter: (optional)
```

**Step 3:** Click **"SEND REMINDERS"**

The system automatically:
- Finds companies that haven't submitted for 2024
- Sends personalized reminder email
- Includes link to platform
- Logs all sends

## 📊 Notification History & Analytics

### View Sent Notifications:

1. Go to **"Notifications"** → **"Sent Notifications"**
2. See all notifications you've sent:
   - Date and time sent
   - Number of recipients
   - Subject line
   - Delivery success rate

### Check Engagement:

For each notification, view:
```
✉️ Sent:     42 companies
❌ Failed:    1 company  
📭 Bounced:   0 companies
👁️ Opened:   18 companies
📊 Open Rate: 42.9%
```

### Click for Details:

Click notification to see:
- Full list of recipient companies
- Delivery status for each company
- Email address used
- When email was sent
- If and when email was opened

## 🔒 Permissions & Limits

### What You CAN Do:

| Action | DIVISIONAL | REGIONAL | CENTRAL |
|--------|-----------|----------|---------|
| Send notifications | ✅ Division only | ✅ Region only | ✅ All companies |
| View own notifications | ✅ | ✅ | ✅ |
| View engagement stats | ✅ | ✅ | ✅ |
| Bulk send reminders | ✅ Division | ✅ Region | ✅ All |

### What You CANNOT Do:

- Send outside your geographic scope
- View notifications sent by others
- Modify emails after sending
- Delete notification history

## 📱 Email Content Details

Companies receive emails with:

### Header
- DSMO platform branding
- Official ministry logo
- "Déclaration sur la Situation de la Main d'Œuvre"

### Body
- Company name (personalized)
- Your message content
- Professional tone
- Clear call-to-action

### Footer
- Ministry name and contact
- Year and copyright
- Link to full DSMO platform

### Call-to-Action Button
- Text: "Accéder à la plateforme DSMO"
- Color: Official ministry emerald green
- Links to: [https://dsmo.ministry.cm](https://dsmo.ministry.cm)

## ⚠️ Common Issues & Solutions

### "Invalid email address"
**Problem:** Email on file for company is incorrect
**Solution:** Contact company directly or update in system admin

### "No recipients found"
**Problem:** Filters are too restrictive
**Solution:** Expand filters (remove division filter, increase status options)

### "Delivery failed"
**Problem:** Company email server rejected message
**Solution:** Contact IT support with error message

### "Can't send to that region"
**Problem:** User role doesn't allow accessing that region
**Solution:** Contact your manager if you need expanded access

## 📞 Support

For technical issues:
- Email: support@dsmo.ministry.cm
- Phone: +237 XXX-XXX-XXXX
- Hours: Monday-Friday, 8am-5pm CAT

## 📋 Example Scenarios

### Scenario 1: Monthly Reminder (DIVISIONAL)

You're a divisional delegate in Mfoundi. Send monthly reminders:

```
Region:     Région Centre (auto)
Division:   Division Mfoundi (select)
Subject:    "Reminder: Monthly DSMO Status - March 2024"
Message:    "As a reminder, companies in Mfoundi Division should continue
            monitoring their DSMO status on the platform. If you have 
            questions, please contact your divisional office."
Click:      SEND (45 companies notified)
```

### Scenario 2: Urgent Deadline (REGIONAL)

As regional delegate, urgent notice before deadline:

```
Region:     Région Littoral (auto)
Division:   Leave as "All"
Status:     SUBMITTED (only companies that haven't been approved)
Subject:    "URGENT: LAST CHANCE - Submit DSM-O Before Deadline!"
Message:    "URGENT NOTICE: Only 3 days remaining to submit your 2024 
           DSMO declaration. Late submissions may result in penalties. 
           Access the platform now to complete your submission."
Click:      SEND (120 companies notified)
```

### Scenario 3: National Announcement (CENTRAL)

As central ministry authority, announce policy change:

```
Region:     All (select "All Regions")
Division:   All (select "All")
Status:     (leave blank for all)
Subject:    "Important: New DSMO Reporting Requirements 2024"
Message:    "Effective immediately, all companies must report on 
           environmental compliance as part of DSMO submissions. 
           See updated form in platform. Compliance training available 
           at ministry.cm/training. Questions? Contact us."
Click:      SEND (5,000+ companies notified)
```

---

## ✨ Pro Tips

1. **Draft messages in Word first** - Avoid timing out, paste into form
2. **Send during work hours** - Higher likelihood companies will read immediately
3. **Use Clear Subject Lines** - Include year and keyword (REMINDER, URGENT, ANNOUNCEMENT)
4. **Check Recipient Count** - Always verify before sending to avoid wrong audience
5. **Save Sample Templates** - Note effective wording for future use
6. **Follow Up** - Check open rates after 1-2 days and send reminder if needed

---

**Document Version**: 1.0.0  
**Last Updated**: April 2026  
**Contact**: support@dsmo.ministry.cm
