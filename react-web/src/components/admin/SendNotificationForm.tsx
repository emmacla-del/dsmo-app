"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import {
  NOTIFICATION_STATUSES,
  sendNotification,
} from "@/lib/notifications";
import {
  useTerritoryDepartments,
  useTerritoryRegions,
} from "@/hooks/useTerritoryStructure";

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--cam-font-size-sm)",
  fontWeight: 600,
  marginBottom: "var(--cam-space-1)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "var(--cam-form-field-height)",
  border: "var(--cam-border-width) solid var(--cam-border-strong)",
  borderRadius: "var(--cam-radius-sm)",
  padding: "0 var(--cam-space-3)",
  fontSize: "var(--cam-font-size-base)",
  fontFamily: "inherit",
};

const fieldWrapperStyle: React.CSSProperties = { marginBottom: "var(--cam-space-4)" };

/**
 * Faithful port of send_notification_screen.dart's form (subject, message,
 * region/department/status filters) — real backend wiring, no visual
 * chrome ported (gradients/cards/animations are cosmetic, not behavior).
 *
 * Two deliberate deviations from the Flutter source, both noted rather than
 * silently applied:
 *  - The "destinataires estimés" number is dropped entirely. Flutter's own
 *    code comment admits it's fake ("Rough visual estimate — replace with
 *    real API call if desired": hardcoded 12 or 148 depending only on
 *    whether a region is picked). Showing a fabricated number to someone
 *    about to email real companies is worse than showing none.
 *  - notification.service.ts auto-scopes DIVISIONAL_ADMIN/REGIONAL_ADMIN senders to
 *    their own department/region and 403s if their filter picks a
 *    different one — Flutter's UI doesn't reflect this (same free-choice
 *    dropdowns for every role), so this port doesn't invent that guidance
 *    either; a DIVISIONAL_ADMIN/REGIONAL_ADMIN sender picking a mismatched filter will
 *    see the real backend error, same as in Flutter today.
 */
export function SendNotificationForm() {
  const t = useTranslations();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [region, setRegion] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [touched, setTouched] = useState(false);

  const { regions } = useTerritoryRegions();
  const { departments } = useTerritoryDepartments(region);

  const mutation = useMutation({
    mutationFn: () =>
      sendNotification(subject, message, {
        regionFilter: region || undefined,
        departmentFilter: department || undefined,
        submissionStatus: status || undefined,
      }),
    onSuccess: () => {
      setSubject("");
      setMessage("");
      setRegion("");
      setDepartment("");
      setStatus("");
      setTouched(false);
    },
  });

  const subjectError = touched && !subject.trim() ? t("sendNotificationForm.subjectRequired") : null;
  const messageError = touched && !message.trim() ? t("sendNotificationForm.messageRequired") : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!subject.trim() || !message.trim()) return;
        if (window.confirm(t("sendNotificationForm.confirmSendDialog"))) {
          mutation.mutate();
        }
      }}
      style={{ maxWidth: 560 }}
    >
      <div
        style={{
          border: "var(--cam-border-width) solid var(--cam-border)",
          borderRadius: "var(--cam-radius-md)",
          padding: "var(--cam-space-4)",
          marginBottom: "var(--cam-space-4)",
          background: "var(--cam-surface)",
        }}
      >
        <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: "0 0 var(--cam-space-3)" }}>
          {t("sendNotificationForm.recipientFiltersHeading")}
        </h2>
        <div style={fieldWrapperStyle}>
          <label style={fieldLabelStyle} htmlFor="notif-region">
            {t("sendNotificationForm.regionLabel")}
          </label>
          <select
            id="notif-region"
            style={inputStyle}
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setDepartment("");
            }}
          >
            <option value="">{t("sendNotificationForm.allRegionsOption")}</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div style={fieldWrapperStyle}>
          <label style={fieldLabelStyle} htmlFor="notif-department">
            {t("sendNotificationForm.departmentLabel")}
          </label>
          <select
            id="notif-department"
            style={inputStyle}
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">{t("sendNotificationForm.allDivisionsOption")}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 0 }}>
          <label style={fieldLabelStyle} htmlFor="notif-status">
            {t("sendNotificationForm.statusLabel")}
          </label>
          <select id="notif-status" style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("sendNotificationForm.allStatusesOption")}</option>
            {NOTIFICATION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          border: "var(--cam-border-width) solid var(--cam-border)",
          borderRadius: "var(--cam-radius-md)",
          padding: "var(--cam-space-4)",
          marginBottom: "var(--cam-space-4)",
          background: "var(--cam-surface)",
        }}
      >
        <h2 style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: "0 0 var(--cam-space-3)" }}>
          {t("sendNotificationForm.messageContentHeading")}
        </h2>
        <div style={fieldWrapperStyle}>
          <label style={fieldLabelStyle} htmlFor="notif-subject">
            {t("sendNotificationForm.subjectLabel")}
          </label>
          <input
            id="notif-subject"
            type="text"
            maxLength={200}
            style={inputStyle}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("sendNotificationForm.subjectPlaceholder")}
          />
          {subjectError && (
            <p role="alert" style={{ color: "var(--cam-error)", fontSize: "var(--cam-font-size-sm)", margin: "var(--cam-space-1) 0 0" }}>
              {subjectError}
            </p>
          )}
        </div>
        <div style={{ marginBottom: 0 }}>
          <label style={fieldLabelStyle} htmlFor="notif-message">
            {t("sendNotificationForm.messageLabel")}
          </label>
          <textarea
            id="notif-message"
            maxLength={1000}
            rows={6}
            style={{ ...inputStyle, height: "auto", padding: "var(--cam-space-3)" }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("sendNotificationForm.messagePlaceholder")}
          />
          {messageError && (
            <p role="alert" style={{ color: "var(--cam-error)", fontSize: "var(--cam-font-size-sm)", margin: "var(--cam-space-1) 0 0" }}>
              {messageError}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--cam-space-3)" }}>
        <button
          type="submit"
          disabled={mutation.isPending}
          style={{
            flex: 1,
            height: "var(--cam-form-field-height)",
            background: "var(--cam-green)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--cam-radius-sm)",
            fontWeight: 600,
            cursor: mutation.isPending ? "not-allowed" : "pointer",
          }}
        >
          {mutation.isPending ? t("sendNotificationForm.sending") : t("sendNotificationForm.sendButton")}
        </button>
        <button
          type="button"
          onClick={() => {
            setSubject("");
            setMessage("");
            setRegion("");
            setDepartment("");
            setStatus("");
            setTouched(false);
          }}
          style={{
            height: "var(--cam-form-field-height)",
            padding: "0 var(--cam-space-4)",
            background: "none",
            border: "var(--cam-border-width) solid var(--cam-border-strong)",
            borderRadius: "var(--cam-radius-sm)",
            cursor: "pointer",
          }}
        >
          {t("sendNotificationForm.clearFormButton")}
        </button>
      </div>

      {mutation.isSuccess && (
        <p
          role="status"
          style={{
            marginTop: "var(--cam-space-4)",
            padding: "var(--cam-space-3)",
            background: "var(--cam-success-bg)",
            color: "var(--cam-success)",
            borderRadius: "var(--cam-radius-sm)",
          }}
        >
          {t("sendNotificationForm.sendSuccessMessage", {
            successCount: mutation.data.successfulSends,
            failedCount: mutation.data.failedSends,
            skippedCount: mutation.data.skippedByPreference,
            hasFailed: mutation.data.failedSends > 0 ? "true" : "false",
            hasSkipped: mutation.data.skippedByPreference > 0 ? "true" : "false",
          })}
        </p>
      )}
      {mutation.isError && (
        <p
          role="alert"
          style={{
            marginTop: "var(--cam-space-4)",
            padding: "var(--cam-space-3)",
            background: "var(--cam-error-bg)",
            color: "var(--cam-error)",
            borderRadius: "var(--cam-radius-sm)",
          }}
        >
          {t("sendNotificationForm.sendErrorPrefix", { error: (mutation.error as ApiError).message })}
        </p>
      )}
    </form>
  );
}
