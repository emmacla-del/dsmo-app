// src/lib/notifications.ts
//
// POST /dsmo/notifications/send (src/dsmo/dsmo.controller.ts, guarded to
// DIVISIONAL_ADMIN/REGIONAL_ADMIN/ADMIN_ONEFOP/SUPER_ADMIN
// server-side — read directly from dsmo.controller.ts + notification.service.ts,
// not guessed from the Flutter UI). This is a real, consequential,
// mutating action: it queues real emails to real companies. Unlike the
// draft-save/PDF-preview endpoints elsewhere in this app, there is nothing
// safe about exercising this against the live backend outside of an
// explicit, authorized test.
import { apiFetch } from "./api-client";

export interface NotificationFilters {
  regionFilter?: string;
  departmentFilter?: string;
  submissionStatus?: string;
}

export interface SendNotificationResult {
  notificationId: string;
  totalRecipients: number;
  successfulSends: number;
  failedSends: number;
  skippedByPreference: number;
  failures?: { companyId: string; email?: string; reason: string }[];
}

export function sendNotification(subject: string, message: string, filters: NotificationFilters) {
  return apiFetch<SendNotificationResult>("/dsmo/notifications/send", {
    method: "POST",
    body: JSON.stringify({ subject, message, filters }),
  });
}


// DeclarationStatus enum values notification.service.ts accepts as
// submissionStatus, with the same French labels as _statusLabels in
// send_notification_screen.dart.
export const NOTIFICATION_STATUSES: { value: string; label: string }[] = [
  { value: "SUBMITTED", label: "Soumis" },
  { value: "DIVISION_APPROVED", label: "Approuvé (Division)" },
  { value: "REGION_APPROVED", label: "Approuvé (Région)" },
  { value: "FINAL_APPROVED", label: "Approuvé (Final)" },
];
