"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminActiveFilterChips } from "@/components/admin/AdminActiveFilterChips";
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
import {
  FOLLOW_UP_PAGE_SIZE,
  clampFollowUpPage,
  clearFollowUpQuery,
  followUpHref,
  normalizeFollowUpQuery,
  parseFollowUpUrlState,
  updateFollowUpQuery,
} from "@/lib/follow-up-url";

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
  canShowContacts,
  territories,
}: {
  data: CampaignNonRespondentsResponse;
  canShowContacts: boolean;
  territories: readonly { name: string; departments: readonly { name: string }[] }[];
}) {
  const t = useTranslations("adminCiblesPage");
  const tRoot = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const appLocale = asUiLocale(useLocale());
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [dialogRow, setDialogRow] = useState<NonRespondentRow | null>(null);
  const [messageLanguage, setMessageLanguage] = useState<FollowUpMessageLanguage>(appLocale);
  const [channel, setChannel] = useState<CampaignFollowUpChannel>("WHATSAPP");
  const [outcome, setOutcome] = useState<CampaignFollowUpOutcome | "">("");
  const [saveError, setSaveError] = useState(false);
  const [savedFollowUp, setSavedFollowUp] = useState(false);
  const regions = useMemo(() => territories.map((region) => region.name).sort(), [territories]);

  const allDepartments = useMemo(() => {
    return territories.flatMap((region) => region.departments.map((department) => ({
      name: department.name,
      region: region.name,
    })));
  }, [territories]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const est of data.establishments) {
      if (est.entityType) set.add(est.entityType);
    }
    for (const type of Object.keys(ENTITY_TYPE_OPTION_KEYS)) set.add(type);
    return Array.from(set).sort();
  }, [data.establishments]);

  const filterOptions = useMemo(() => ({
    regions,
    departments: allDepartments,
    types,
    canShowContacts,
  }), [allDepartments, canShowContacts, regions, types]);
  const filters = parseFollowUpUrlState(currentQuery, filterOptions);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [searchUrlValue, setSearchUrlValue] = useState(filters.search);
  if (searchUrlValue !== filters.search) {
    setSearchUrlValue(filters.search);
    setSearchInput(filters.search);
  }
  const searchQuery = filters.search;
  const selectedRegion = filters.region;
  const selectedDepartment = filters.department;
  const selectedType = filters.type;
  const selectedOutcome = filters.outcome;

  const departments = allDepartments
    .filter((department) => !selectedRegion || department.region === selectedRegion)
    .map((department) => department.name)
    .sort();

  const filteredEstablishments = data.establishments.filter((row) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesName = row.name.toLowerCase().includes(q);
      const matchesId = row.establishmentId?.toLowerCase().includes(q);
      const matchesContact = row.contactName?.toLowerCase().includes(q);
      if (!matchesName && !matchesId && !matchesContact) return false;
    }
    if (selectedRegion && row.regionName !== selectedRegion) return false;
    if (selectedDepartment && row.departmentName !== selectedDepartment) return false;
    if (selectedType && row.entityType !== selectedType) return false;
    if (canShowContacts) {
      if (selectedOutcome === "NONE" && row.latestFollowUp) return false;
      if (selectedOutcome === "CONTACTED" && !row.latestFollowUp) return false;
      if (selectedOutcome && selectedOutcome !== "NONE" && selectedOutcome !== "CONTACTED") {
        if (row.latestFollowUp?.outcome !== selectedOutcome) return false;
      }
    }
    return true;
  });

  const outcomeFilter = canShowContacts ? selectedOutcome : "";
  const filtersActive = !!(
    searchQuery.trim() || selectedRegion || selectedDepartment || selectedType || outcomeFilter
  );
  const totalFiltered = filteredEstablishments.length;
  const currentPage = clampFollowUpPage(filters.page, totalFiltered);
  const startIdx = (currentPage - 1) * FOLLOW_UP_PAGE_SIZE;
  const pagedEstablishments = filteredEstablishments.slice(startIdx, startIdx + FOLLOW_UP_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalFiltered / FOLLOW_UP_PAGE_SIZE));
  const publicConfig = getFollowUpPublicConfig();

  const updateFilters = (
    changes: Parameters<typeof updateFollowUpQuery>[1],
    history: "push" | "replace" = "push",
    resetPage = true,
  ) => {
    const nextQuery = updateFollowUpQuery(currentQuery, changes, resetPage);
    const href = followUpHref(pathname, nextQuery);
    const currentHref = followUpHref(pathname, currentQuery);
    if (href !== currentHref) router[history](href, { scroll: false });
  };

  const normalizedQuery = normalizeFollowUpQuery(currentQuery, filterOptions);
  const clampedQuery = currentPage > 1
    ? updateFollowUpQuery(normalizedQuery, { page: currentPage }, false)
    : updateFollowUpQuery(normalizedQuery, { page: null }, false);
  useEffect(() => {
    if (clampedQuery !== currentQuery) {
      router.replace(followUpHref(pathname, clampedQuery), { scroll: false });
    }
  }, [clampedQuery, currentQuery, pathname, router]);

  useEffect(() => {
    const search = searchInput.trim();
    if (search === filters.search) return;
    const timer = window.setTimeout(() => {
      const nextQuery = updateFollowUpQuery(currentQuery, { search: search || null });
      const href = followUpHref(pathname, nextQuery);
      if (href !== followUpHref(pathname, currentQuery)) router.replace(href, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [currentQuery, filters.search, pathname, router, searchInput]);

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
        contactName: dialogRow.contactName ?? null,
        contactFunction: dialogRow.contactFunction ?? null,
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

  const outcomeFilterLabel = (value: string) => {
    if (value === "NONE") return t("nonRespOutcomeNone");
    if (value === "CONTACTED") return t("nonRespOutcomeContacted");
    return t(OUTCOME_KEYS[value as CampaignFollowUpOutcome]);
  };
  const activeFilters = [
    ...(filters.search ? [{ key: "search", label: `${t("nonRespSearchLabel")}: ${filters.search}`, onClear: () => { setSearchInput(""); updateFilters({ search: null }); } }] : []),
    ...(selectedRegion ? [{ key: "region", label: `${t("nonRespFilterRegion")}: ${selectedRegion}`, onClear: () => updateFilters({ region: null }) }] : []),
    ...(selectedDepartment ? [{ key: "department", label: `${t("nonRespFilterDepartment")}: ${selectedDepartment}`, onClear: () => updateFilters({ department: null }) }] : []),
    ...(selectedType ? [{ key: "type", label: `${t("nonRespFilterType")}: ${typeLabel(selectedType)}`, onClear: () => updateFilters({ type: null }) }] : []),
    ...(selectedOutcome ? [{ key: "outcome", label: `${t("nonRespFilterOutcome")}: ${outcomeFilterLabel(selectedOutcome)}`, onClear: () => updateFilters({ outcome: null }) }] : []),
  ];
  const clearAllFilters = () => {
    setSearchInput("");
    const nextQuery = clearFollowUpQuery(currentQuery);
    const href = followUpHref(pathname, nextQuery);
    if (href !== followUpHref(pathname, currentQuery)) router.push(href, { scroll: false });
  };

  return (
    <>
      <p className="cam-admin-lede">
        {data.registered === 0
          ? t("nonRespNoRegistered")
          : filtersActive
            ? totalFiltered === 0
              ? t("nonRespNoMatch")
              : t("nonRespFilteredCount", { count: totalFiltered })
            : t("nonRespSummary", { count: totalFiltered, registered: count(data.registered, appLocale) })}
      </p>
      {canShowContacts && savedFollowUp && (
        <p role="status" className="cam-admin-notice cam-admin-notice--success">{t("nonRespFollowUpSaved")}</p>
      )}
      {data.establishments.length > 0 && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2">
              <Label htmlFor="follow-up-search">{t("nonRespSearchLabel")}</Label>
              <Input
                id="follow-up-search"
                type="search"
                placeholder={t("nonRespSearchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-10 w-full"
              />
            </div>
            <div>
              <Label htmlFor="follow-up-region">{t("nonRespFilterRegion")}</Label>
              <select
                id="follow-up-region"
                className="cam-admin-input w-full"
                value={selectedRegion}
                onChange={(e) => {
                  const next = e.target.value;
                  const departmentStillValid = !selectedDepartment || allDepartments.some((item) =>
                    item.name === selectedDepartment && (!next || item.region === next),
                  );
                  updateFilters({ region: next || null, department: departmentStillValid ? selectedDepartment || null : null });
                }}
              >
                <option value="">{t("nonRespAllRegions")}</option>
                {regions.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="follow-up-department">{t("nonRespFilterDepartment")}</Label>
              <select
                id="follow-up-department"
                className="cam-admin-input w-full"
                value={selectedDepartment}
                onChange={(e) => updateFilters({ department: e.target.value || null })}
              >
                <option value="">{t("nonRespAllDepartments")}</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="follow-up-type">{t("nonRespFilterType")}</Label>
              <select
                id="follow-up-type"
                className="cam-admin-input w-full"
                value={selectedType}
                onChange={(e) => updateFilters({ type: e.target.value || null })}
              >
                <option value="">{t("nonRespAllTypes")}</option>
                {types.map((value) => (
                  <option key={value} value={value}>{typeLabel(value)}</option>
                ))}
              </select>
            </div>
            {canShowContacts && (
            <div>
              <Label htmlFor="follow-up-outcome">{t("nonRespFilterOutcome")}</Label>
              <select
                id="follow-up-outcome"
                className="cam-admin-input w-full"
                value={selectedOutcome}
                onChange={(e) => updateFilters({ outcome: e.target.value || null })}
              >
                <option value="">{t("nonRespAllOutcomes")}</option>
                <option value="NONE">{t("nonRespOutcomeNone")}</option>
                <option value="CONTACTED">{t("nonRespOutcomeContacted")}</option>
                <option value="SENT_CONFIRMED">{t("nonRespOutcomeSent")}</option>
                <option value="CALLBACK_REQUESTED">{t("nonRespOutcomeCallback")}</option>
                <option value="DO_NOT_CONTACT">{t("nonRespOutcomeDoNotContact")}</option>
                <option value="NO_ANSWER">{t("nonRespOutcomeNoAnswer")}</option>
                <option value="WRONG_NUMBER">{t("nonRespOutcomeWrongNumber")}</option>
                <option value="ALREADY_SUBMITTED">{t("nonRespOutcomeSubmitted")}</option>
              </select>
            </div>
            )}
          </div>
          <AdminActiveFilterChips
            filters={activeFilters}
            label={t("nonRespActiveFilters")}
            clearAllLabel={t("nonRespClearAllFilters")}
            onClearAll={clearAllFilters}
            removeFilterLabel={(label) => t("nonRespRemoveFilter", { label })}
          />
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
              </tr>
            </thead>
            <tbody>
              {pagedEstablishments.length === 0 ? (
                <tr>
                  <td colSpan={canShowContacts ? 10 : 6} className="py-8 text-center text-muted-foreground">
                    {t("nonRespNoMatch")}
                  </td>
                </tr>
              ) : pagedEstablishments.map((row) => {
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
                        {(row.contactName || row.contactFunction) && (
                          <span className="cam-admin-quiet-note">
                            {t("nonRespContactLabel")}: {[row.contactName, row.contactFunction].filter(Boolean).join(" · ")}
                          </span>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalFiltered > FOLLOW_UP_PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-end gap-3 py-4 text-sm text-muted-foreground">
            <span>
              {t("nonRespShowingRange", {
                start: count(startIdx + 1, appLocale),
                end: count(Math.min(startIdx + FOLLOW_UP_PAGE_SIZE, totalFiltered), appLocale),
                total: totalFiltered,
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => updateFilters({ page: Math.max(1, currentPage - 1) }, "push", false)}
            >
              {t("nonRespPreviousButton")}
            </Button>
            <span>
              {t("nonRespPageOf", { page: currentPage, pages: totalPages })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => updateFilters({ page: Math.min(totalPages, currentPage + 1) }, "push", false)}
            >
              {t("nonRespNextButton")}
            </Button>
          </div>
        )}
      </>
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
