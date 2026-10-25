"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import { count } from "@/lib/admin-data-state";
import { ENTITY_TYPE_OPTION_KEYS, entityTypeLabel } from "@/lib/companies-directory";
import {
  applyEditMode,
  QUOTA_ENTITY_TYPES,
  modeLabel,
  parseTargetInput,
  sumFilled,
  type EditMode,
  type NormalizedRegion,
  type RegionDraft,
} from "@/lib/pilotage-target-payload";

export function TargetGrid({
  regions,
  drafts,
  onDraftChange,
  onClearRegion,
  centralInput,
  onCentralChange,
  showCentral,
  canWrite,
  expanded,
  onToggle,
  hasUnsavedChanges,
}: {
  regions: NormalizedRegion[];
  drafts: Record<string, RegionDraft>;
  onDraftChange: (regionId: string, draft: RegionDraft) => void;
  onClearRegion: (regionId: string) => void;
  centralInput: string;
  onCentralChange: (value: string) => void;
  showCentral: boolean;
  canWrite: boolean;
  expanded: Set<string>;
  onToggle: (regionId: string) => void;
  hasUnsavedChanges?: boolean;
}) {
  const t = useTranslations("adminTargets");
  const locale = asUiLocale(useLocale());
  const [pendingModeChange, setPendingModeChange] = useState<{
    region: NormalizedRegion;
    mode: EditMode;
  } | null>(null);
  if (regions.length === 0) {
    return <p className="cam-admin-lede">{t("noTerritory")}</p>;
  }

  function changeMode(region: NormalizedRegion, nextMode: EditMode) {
    const draft = drafts[region.regionId];
    if (nextMode === draft?.mode) return;
    if (modeChangeWouldDiscardValues(region, draft)) {
      setPendingModeChange({ region, mode: nextMode });
      return;
    }
    applyModeChange(region, nextMode);
  }

  function applyModeChange(region: NormalizedRegion, nextMode: EditMode) {
    const draft = drafts[region.regionId];
    if (nextMode === "REGION" && draft?.mode === "DEPARTMENT") {
      const sum = sumFilled(draft.departmentInputs);
      onDraftChange(region.regionId, {
        ...draft,
        clear: false,
        mode: "REGION",
        regionInput: sum != null ? String(sum) : draft.regionInput,
        departmentInputs: Object.fromEntries(
          Object.keys(draft.departmentInputs).map((id) => [id, ""]),
        ),
      });
      if (expanded.has(region.regionId)) onToggle(region.regionId);
      return;
    }
    onDraftChange(region.regionId, applyEditMode(region, nextMode));
    if (nextMode === "DEPARTMENT" && !expanded.has(region.regionId)) {
      onToggle(region.regionId);
    }
  }

  return (
    <>
      {canWrite && <p className="cam-admin-meta">{t("quotaModeGuidance")}</p>}
      <div className="cam-dash-table-wrap">
        <table className="cam-dash-table cam-target-table">
          <thead>
            <tr>
              <th scope="col">{t("territoryColumn")}</th>
              <th scope="col">{t("modeColumn")}</th>
              <th scope="col" className="is-num">{t("targetColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => {
              const draft = drafts[region.regionId];
              const open = expanded.has(region.regionId);
              const mixedLocked = canWrite && region.mode === "MIXED" && draft?.mode == null && !draft?.clear;
              return (
                <RegionBlock
                  key={region.regionId}
                  region={region}
                  draft={draft}
                  open={open}
                  canWrite={canWrite}
                  mixedLocked={mixedLocked}
                  onToggle={() => onToggle(region.regionId)}
                  onDraftChange={(next) => onDraftChange(region.regionId, next)}
                  onModeChange={(nextMode) => changeMode(region, nextMode)}
                  onClear={() => onClearRegion(region.regionId)}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              );
            })}
          </tbody>
          {showCentral && (
            <tbody>
              <tr>
                <th scope="row">{t("centralLevel")}</th>
                <td>—</td>
                <td className="is-num">
                  {canWrite ? (
                    <TargetInput
                      ariaLabel={t("centralTargetAriaLabel")}
                      value={centralInput}
                      onChange={onCentralChange}
                    />
                  ) : (
                    <span>{centralInput.trim() === "" ? "—" : formatNumber(Number(centralInput), locale)}</span>
                  )}
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
      <AdminDialog
        open={!!pendingModeChange}
        onClose={() => setPendingModeChange(null)}
        title={t("modeChangeTitle")}
        footer={
          <>
            <button type="button" className="cam-button cam-button-secondary" onClick={() => setPendingModeChange(null)}>
              {t("modeChangeCancel")}
            </button>
            <button
              type="button"
              className="cam-button cam-button-primary"
              onClick={() => {
                if (pendingModeChange) applyModeChange(pendingModeChange.region, pendingModeChange.mode);
                setPendingModeChange(null);
              }}
            >
              {t("modeChangeConfirm")}
            </button>
          </>
        }
      >
        {pendingModeChange && (
          <p>{t("modeChangeBody", { region: pendingModeChange.region.name })}</p>
        )}
      </AdminDialog>
    </>
  );
}

function RegionBlock({
  region,
  draft,
  open,
  canWrite,
  mixedLocked,
  onToggle,
  onDraftChange,
  onModeChange,
  onClear,
  hasUnsavedChanges,
}: {
  region: NormalizedRegion;
  draft: RegionDraft | undefined;
  open: boolean;
  canWrite: boolean;
  mixedLocked: boolean;
  onToggle: () => void;
  onDraftChange: (draft: RegionDraft) => void;
  onModeChange: (mode: EditMode) => void;
  onClear: () => void;
  hasUnsavedChanges?: boolean;
}) {
  const t = useTranslations("adminTargets");
  const tRoot = useTranslations();
  const locale = asUiLocale(useLocale());
  const mode: EditMode | null = draft?.mode ?? null;
  const displayMode = canWrite ? mode : region.mode;
  // The figure on the region line is the live sum of whichever cells the
  // chosen mode fills, so it tracks what the writer is typing below.
  const liveSum = draft
    ? sumFilled(displayMode === "ENTITY_TYPE" ? draft.entityTypeInputs : draft.departmentInputs)
    : null;
  const regionDisplay =
    draft?.clear
      ? t("notSet")
      : displayMode === "DEPARTMENT" || displayMode === "ENTITY_TYPE"
        ? liveSum == null
          ? "—"
          : formatNumber(liveSum, locale)
        : displayMode === "REGION"
          ? null
          : region.target == null
            ? "—"
            : formatNumber(region.target, locale);

  return (
    <>
      <tr className="cam-target-region">
        <th scope="row">
          <button type="button" className="cam-target-expand" onClick={onToggle} aria-expanded={open}>
            <span aria-hidden="true">{open ? "▾" : "▸"}</span>
            {region.name}
          </button>
        </th>
        <td>
          {canWrite ? (
            <ModePicker
              name={region.regionId}
              mode={mode}
              onChange={onModeChange}
            />
          ) : (
            <span className={modeBadgeClass(region.mode)}>{modeLabel(region.mode, locale)}</span>
          )}
        </td>
        <td className="is-num">
          {canWrite && mode === "REGION" ? (
            <TargetInput
              ariaLabel={t("regionTargetAriaLabel", { region: region.name })}
              value={draft?.regionInput ?? ""}
              onChange={(value) => draft && onDraftChange({ ...draft, clear: false, regionInput: value })}
            />
          ) : (
            <span>{regionDisplay}</span>
          )}
        </td>
      </tr>
      {mixedLocked && (
        <tr className="cam-target-note">
          <td colSpan={3}>
            <div className="cam-admin-notice cam-admin-notice--warn">
              {t("mixedRegionWarning")}
            </div>
          </td>
        </tr>
      )}
      {canWrite && region.mode !== "UNSET" && (
        <tr className="cam-target-note">
          <td colSpan={3}>
            <span
              title={
                hasUnsavedChanges
                  ? t("clearBlockedTitle")
                  : undefined
              }
            >
              <button
                type="button"
                className="cam-button cam-button-danger cam-button-sm"
                disabled={hasUnsavedChanges}
                onClick={onClear}
              >
                {t("clearRegionButton")}
              </button>
            </span>
          </td>
        </tr>
      )}
      {/* Per-type rows sit directly under the region, not under a
          department: the grain is region x type, so they are the region's
          own breakdown, and they show whether or not the rows are expanded —
          hiding the cells a writer just chose to fill would be a trap. */}
      {displayMode === "ENTITY_TYPE" &&
        QUOTA_ENTITY_TYPES.map((entityType) => (
          <tr key={entityType} className="cam-target-dept">
            <th scope="row">{entityTypeName(entityType, tRoot)}</th>
            <td></td>
            <td className="is-num">
              {canWrite ? (
                <TargetInput
                  ariaLabel={t("entityTypeTargetAriaLabel", { type: entityTypeName(entityType, tRoot) })}
                  value={draft?.entityTypeInputs[entityType] ?? ""}
                  onChange={(value) => {
                    if (!draft) return;
                    onDraftChange({
                      ...draft,
                      clear: false,
                      entityTypeInputs: { ...draft.entityTypeInputs, [entityType]: value },
                    });
                  }}
                />
              ) : (
                <span>
                  {region.byEntityType[entityType] == null
                    ? "—"
                    : formatNumber(region.byEntityType[entityType], locale)}
                </span>
              )}
            </td>
          </tr>
        ))}
      {/* Hidden only under a mode that does not fill department cells, so a
          MIXED or not-yet-set region still discloses the figures it holds --
          those are what a writer resolving MIXED has to see. */}
      {open &&
        displayMode !== "REGION" &&
        displayMode !== "ENTITY_TYPE" &&
        region.departments.map((department) => {
          const stored = department.target == null ? "—" : formatNumber(department.target, locale);
          const editable = canWrite && mode === "DEPARTMENT";
          return (
            <tr key={department.departmentId} className="cam-target-dept">
              <th scope="row">{department.name}</th>
              <td></td>
              <td className="is-num">
                {editable ? (
                  <TargetInput
                    ariaLabel={t("departmentTargetAriaLabel", { department: department.name })}
                    value={draft?.departmentInputs[department.departmentId] ?? ""}
                    onChange={(value) => {
                      if (!draft) return;
                      onDraftChange({
                        ...draft,
                        clear: false,
                        departmentInputs: { ...draft.departmentInputs, [department.departmentId]: value },
                      });
                    }}
                  />
                ) : (
                  <span>{stored}</span>
                )}
              </td>
            </tr>
          );
        })}
    </>
  );
}

function modeChangeWouldDiscardValues(region: NormalizedRegion, draft: RegionDraft | undefined): boolean {
  if (!draft) return false;
  if (draft.mode == null) return region.mode === "MIXED" && !draft.clear;
  if (draft.mode === "REGION") return draft.regionInput.trim() !== "";
  const inputs = draft.mode === "DEPARTMENT" ? draft.departmentInputs : draft.entityTypeInputs;
  return Object.values(inputs).some((value) => value.trim() !== "");
}

function ModePicker({
  name,
  mode,
  onChange,
}: {
  name: string;
  mode: EditMode | null;
  onChange: (mode: EditMode) => void;
}) {
  const t = useTranslations("adminTargets");
  return (
    <div className="cam-target-modes" role="radiogroup" aria-label={t("targetModeAriaLabel")}>
      <label className="cam-admin-choice">
        <input
          type="radio"
          name={`mode-${name}`}
          checked={mode === "DEPARTMENT"}
          onChange={() => onChange("DEPARTMENT")}
        />
        {t("modeByDepartment")}
      </label>
      <label className="cam-admin-choice">
        <input
          type="radio"
          name={`mode-${name}`}
          checked={mode === "REGION"}
          onChange={() => onChange("REGION")}
        />
        {t("modeRegionOnly")}
      </label>
      <label className="cam-admin-choice">
        <input
          type="radio"
          name={`mode-${name}`}
          checked={mode === "ENTITY_TYPE"}
          onChange={() => onChange("ENTITY_TYPE")}
        />
        {t("modeByEntityType")}
      </label>
    </div>
  );
}

function TargetInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const parsed = parseTargetInput(value);
  return (
    <input
      className="cam-input cam-target-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel}
      aria-invalid={parsed === "invalid"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

// Shared formatter (G12): one locale decision, in lib/admin-data-state.
function formatNumber(value: number, locale: UiLocale): string {
  return count(value, locale);
}

function modeBadgeClass(mode: NormalizedRegion["mode"]): string {
  if (mode === "DEPARTMENT") return "cam-badge cam-badge-info";
  if (mode === "REGION") return "cam-badge cam-badge-success";
  if (mode === "MIXED") return "cam-badge cam-badge-warning";
  return "cam-badge cam-badge-neutral";
}

/**
 * An entity type's display name, through the console's own catalogue so the
 * editor and the coverage tables name a type the same way.
 */
function entityTypeName(entityType: string, tRoot: ReturnType<typeof useTranslations>): string {
  const key = ENTITY_TYPE_OPTION_KEYS[entityType];
  return key ? tRoot(key) : entityTypeLabel(entityType);
}
