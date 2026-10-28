"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { count } from "@/lib/admin-data-state";
import { formatCampaignDate } from "@/lib/campaigns";
import { isValidCameroonPhone, normalizeCameroonPhone } from "@/lib/cameroon-phone";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import { getFollowUpPublicConfig } from "@/lib/follow-up-config";
import { buildCampaignFollowUpMessage, type FollowUpMessageLanguage } from "@/lib/campaign-follow-up-message";
import { asUiLocale } from "@/lib/register-i18n";
import { whatsappHref } from "@/lib/staff-invitations";
import { useAuthStore } from "@/lib/auth-store";
import {
  recordCampaignFollowUp,
  type CampaignFollowUpChannel,
  type CampaignFollowUpOutcome,
  type NonRespondentRow,
  type RecordCampaignFollowUpInput,
  type CampaignNonRespondentsResponse,
} from "@/lib/pilotage-targets";
import { referencePeriodLabel } from "@/lib/onefop-period-label";

const OUTCOME_KEYS: Record<CampaignFollowUpOutcome, string> = {
  SENT_CONFIRMED: "nonRespOutcomeSent",
  NO_ANSWER: "nonRespOutcomeNoAnswer",
  WRONG_NUMBER: "nonRespOutcomeWrongNumber",
  CALLBACK_REQUESTED: "nonRespOutcomeCallback",
  ALREADY_SUBMITTED: "nonRespOutcomeSubmitted",
  DO_NOT_CONTACT: "nonRespOutcomeDoNotContact",
};

const CHANNEL_KEYS: Record<CampaignFollowUpChannel, string> = {
  WHATSAPP: "nonRespChannelWhatsApp",
  PHONE: "nonRespChannelPhone",
  EMAIL: "nonRespChannelEmail",
};

function formatFollowUpTimestamp(value: string, locale: "en" | "fr"): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Douala",
  }).format(date);
}

/**
 * Registered establishments in the reader's territory that have not declared
 * for the campaign. Contact details and follow-up actions are role-gated.
 */
export function CampaignNonRespondentsTable({
  data,
  canOpenDetail,
  canShowContacts,
}: {
  data: CampaignNonRespondentsResponse;
  canOpenDetail: boolean;
  canShowContacts: boolean;
}) {
  const t = useTranslations("adminCiblesPage");
  const tRoot = useTranslations();
  const appLocale = asUiLocale(useLocale());
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [dialogRow, setDialogRow] = useState<NonRespondentRow | null>(null);
  const [messageLanguage, setMessageLanguage] = useState<FollowUpMessageLanguage>(appLocale);
  const [channel, setChannel] = useState<CampaignFollowUpChannel>("WHATSAPP");
  const [outcome, setOutcome] = useState<CampaignFollowUpOutcome | "">("");
  const [saveError, setSaveError] = useState(false);
  const [savedFollowUp, setSavedFollowUp] = useState(false);
  const publicConfig = getFollowUpPublicConfig();

  const followUpMutation = useMutation({
    mutationFn: ({ companyId, input }: { companyId: string; input: RecordCampaignFollowUpInput }) =>
      recordCampaignFollowUp(data.campaign.id, companyId, input),
    onSuccess: async () => {
      setDialogRow(null);
      setOutcome("");
      setSaveError(false);
      setSavedFollowUp(true);
      await queryClient.invalidateQueries({
        queryKey: ["admin", "pilotage", "non-respondents", data.campaign.id],
      });
    },
    onError: () => setSaveError(true),
  });

  const typeLabel = (type: string | null) => {
    if (!type) return "—";
    const key = ENTITY_TYPE_OPTION_KEYS[type];
    return key ? tRoot(key) : entityTypeLabel(type);
  };

  const openFollowUp = (row: NonRespondentRow) => {
    setDialogRow(row);
    setSavedFollowUp(false);
    setChannel(
      row.contactPhone && isValidCameroonPhone(row.contactPhone)
        ? "WHATSAPP"
        : row.contactEmail
          ? "EMAIL"
          : "PHONE",
    );
    setMessageLanguage(appLocale);
    setOutcome("");
    setSaveError(false);
  };

  const closeFollowUp = () => {
    if (followUpMutation.isPending) return;
    setDialogRow(null);
    setOutcome("");
    setSaveError(false);
  };

  const messageFields = dialogRow
    ? {
        establishment: dialogRow.name,
        establishmentId: dialogRow.establishmentId,
        campaign: data.campaign.name,
        period: referencePeriodLabel(data.campaign.code, messageLanguage) || data.campaign.code,
        deadline: data.campaign.deadline ? formatCampaignDate(data.campaign.deadline) : null,
        portalUrl: publicConfig.portalUrl,
        supportContact: [publicConfig.supportPhone, publicConfig.supportEmail].filter(Boolean).join(" / ") || null,
        agentName: [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || null,
        agentTitle: user?.positionTitle?.trim() || user?.poste?.trim() || null,
        office: [user?.department, user?.region].filter((value): value is string => Boolean(value?.trim())).join(", ") || null,
      }
    : null;
  const whatsappMessage = messageFields
    ? buildCampaignFollowUpMessage(messageLanguage, messageFields)
    : "";
  const whatsappLink = dialogRow && dialogRow.contactPhone && isValidCameroonPhone(dialogRow.contactPhone)
    ? whatsappHref(whatsappMessage, normalizeCameroonPhone(dialogRow.contactPhone))
    : null;
  const officialDetailsMissing = !publicConfig.portalUrl || (!publicConfig.supportPhone && !publicConfig.supportEmail);
  const agentProfileMissing =
    !user?.firstName?.trim() ||
    !user?.lastName?.trim() ||
    !(user?.positionTitle?.trim() || user?.poste?.trim());

  const recordOutcome = () => {
    if (!dialogRow || !outcome) return;
    followUpMutation.mutate({
      companyId: dialogRow.companyId,
      input: {
        channel,
        outcome,
        ...(channel === "WHATSAPP" ? { messageLanguage } : {}),
      },
    });
  };

  const followUpLabel = (row: NonRespondentRow) => {
    const latest = row.latestFollowUp;
    if (!latest) return t("nonRespNoFollowUp");
    return t("nonRespFollowUpStatus", {
      outcome: t(OUTCOME_KEYS[latest.outcome]),
      channel: t(CHANNEL_KEYS[latest.channel]),
      date: formatFollowUpTimestamp(latest.createdAt, appLocale),
      agent: latest.actorName,
      post: latest.actorTitle ? ` (${latest.actorTitle})` : "",
    });
  };

  return (
    <>
      <p className="cam-admin-lede">
        {data.registered === 0
          ? t("nonRespNoRegistered")
          : t("nonRespSummary", { count: data.establishments.length, registered: count(data.registered, appLocale) })}
      </p>
      {canShowContacts && savedFollowUp && (
        <p role="status" className="cam-admin-notice cam-admin-notice--success">{t("nonRespFollowUpSaved")}</p>
      )}
      {data.establishments.length > 0 && (
        <div className="cam-dash-table-wrap">
          <table className="cam-dash-table cam-target-table">
            <thead>
              <tr>
                <th scope="col">{t("nonRespEstablishmentColumn")}</th>
                <th scope="col">{t("nonRespIdColumn")}</th>
                <th scope="col">{t("nonRespTypeColumn")}</th>
                <th scope="col">{t("nonRespRegionColumn")}</th>
                <th scope="col">{t("nonRespDepartmentColumn")}</th>
                {canShowContacts && <th scope="col">{t("nonRespEmailColumn")}</th>}
                {canShowContacts && <th scope="col">{t("nonRespWhatsAppColumn")}</th>}
                <th scope="col">{t("nonRespFileColumn")}</th>
                {canShowContacts && <th scope="col">{t("nonRespFollowUpColumn")}</th>}
                {canShowContacts && <th scope="col">{t("nonRespPrepareFollowUp")}</th>}
                {canOpenDetail && <th scope="col">{t("actionsColumn")}</th>}
              </tr>
            </thead>
            <tbody>
              {data.establishments.map((row) => {
                const optedOut = row.latestFollowUp?.outcome === "DO_NOT_CONTACT";
                return (
                  <tr key={row.companyId}>
                    <th scope="row">{row.name}</th>
                    <td className="cam-admin-code">{row.establishmentId}</td>
                    <td>{typeLabel(row.entityType)}</td>
                    <td>{row.regionName ?? "—"}</td>
                    <td>{row.departmentName ?? "—"}</td>
                    {canShowContacts && (
                      <td className="cam-followup-email">{row.contactEmail ?? t("nonRespNoEmail")}</td>
                    )}
                    {canShowContacts && (
                      <td>
                        {row.contactPhone ? (
                          <>
                            <span>{row.contactPhone}</span>
                            {!isValidCameroonPhone(row.contactPhone) && (
                              <span className="cam-admin-quiet-note">{t("nonRespInvalidPhone")}</span>
                            )}
                          </>
                        ) : (
                          t("nonRespNoPhone")
                        )}
                      </td>
                    )}
                    <td>
                      {row.fileState === "NONE" ? (
                        t("nonRespFileNONE")
                      ) : (
                        <span className="cam-badge cam-badge-warning">{t(`nonRespFile${row.fileState}`)}</span>
                      )}
                    </td>
                    {canShowContacts && (
                      <td>
                        <span>{followUpLabel(row)}</span>
                        {optedOut && <span className="cam-admin-quiet-note">{t("nonRespDoNotContactNotice")}</span>}
                      </td>
                    )}
                    {canShowContacts && (
                      <td>
                        <button
                          type="button"
                          className="cam-text-button"
                          onClick={() => openFollowUp(row)}
                          disabled={optedOut}
                          aria-label={t("nonRespFollowUpAria", { name: row.name })}
                        >
                          {t("nonRespPrepareFollowUp")}
                        </button>
                      </td>
                    )}
                    {canOpenDetail && (
                      <td>
                        <Link
                          href={`/admin/etablissement-detail?id=${encodeURIComponent(row.establishmentId)}`}
                          className="cam-text-button"
                        >
                          {t("nonRespOpenEstablishment")}
                        </Link>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminDialog
        open={Boolean(dialogRow)}
        onClose={closeFollowUp}
        title={t("nonRespDialogTitle", { name: dialogRow?.name ?? "" })}
        eyebrow={t("nonRespDialogDescription")}
        wide
        dismissible={!followUpMutation.isPending}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--cam-space-3)", width: "100%" }}>
            <button type="button" className="cam-button cam-button-secondary" onClick={closeFollowUp} disabled={followUpMutation.isPending}>
              {tRoot("common.cancel")}
            </button>
            <button
              type="button"
              className="cam-button cam-button-primary"
              onClick={recordOutcome}
              disabled={!outcome || followUpMutation.isPending}
            >
              {followUpMutation.isPending ? t("nonRespSavingFollowUp") : t("nonRespSaveFollowUp")}
            </button>
          </div>
        }
      >
        {dialogRow && (
          <div className="cam-followup-dialog-content">
            {officialDetailsMissing && (
              <div role="note" className="cam-admin-notice cam-admin-notice--warn">
                <span>{t("nonRespOfficialConfigWarning")}</span>
              </div>
            )}
            {agentProfileMissing && (
              <div role="note" className="cam-admin-notice cam-admin-notice--warn">
                <span>{t("nonRespAgentProfileMissing")}</span>
              </div>
            )}
            <div role="note" className="cam-admin-notice cam-admin-notice--info">
              <span>{t("nonRespSenderNotice")}</span>
            </div>
            <div className="cam-followup-dialog-grid">
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="follow-up-language">{t("nonRespMessageLanguage")}</label>
                <select
                  id="follow-up-language"
                  className="cam-select"
                  value={messageLanguage}
                  onChange={(event) => setMessageLanguage(event.target.value as FollowUpMessageLanguage)}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="cam-field">
                <label className="cam-admin-label" htmlFor="follow-up-channel">{t("nonRespContactMethod")}</label>
                <select
                  id="follow-up-channel"
                  className="cam-select"
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as CampaignFollowUpChannel)}
                >
                  {Object.entries(CHANNEL_KEYS).map(([value, key]) => (
                    <option
                      key={value}
                      value={value}
                      disabled={value === "WHATSAPP" && (!dialogRow.contactPhone || !isValidCameroonPhone(dialogRow.contactPhone))}
                    >
                      {t(key)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {channel === "WHATSAPP" && (
              <div className="cam-field">
                <span className="cam-admin-label">{t("nonRespMessagePreview")}</span>
                {!dialogRow.contactPhone || !isValidCameroonPhone(dialogRow.contactPhone) ? (
                  <div role="alert" className="cam-admin-notice cam-admin-notice--warn">
                    <span>{t("nonRespInvalidPhoneDetail")}</span>
                  </div>
                ) : (
                  <pre className="cam-followup-message-preview">{whatsappMessage}</pre>
                )}
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cam-button cam-button-secondary cam-button-sm"
                  >
                    {t("nonRespOpenWhatsAppDraft")}
                  </a>
                )}
              </div>
            )}
            <div className="cam-field">
              <label className="cam-admin-label" htmlFor="follow-up-outcome">{t("nonRespOutcome")}</label>
              <select
                id="follow-up-outcome"
                className="cam-select"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as CampaignFollowUpOutcome | "")}
              >
                <option value="" disabled>{t("nonRespOutcome")}</option>
                {Object.entries(OUTCOME_KEYS).map(([value, key]) => (
                  <option key={value} value={value}>{t(key)}</option>
                ))}
              </select>
            </div>
            {saveError && <p role="alert" className="cam-field-error">{t("nonRespFollowUpFailed")}</p>}
          </div>
        )}
      </AdminDialog>
    </>
  );
}
