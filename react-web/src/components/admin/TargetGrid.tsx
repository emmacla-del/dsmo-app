"use client";

import { useLocale, useTranslations } from "next-intl";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import { count } from "@/lib/admin-data-state";
import {
  applyEditMode,
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
  if (regions.length === 0) {
    return <p className="cam-admin-lede">{t("noTerritory")}</p>;
  }

  return (
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
  onClear: () => void;
  hasUnsavedChanges?: boolean;
}) {
  const t = useTranslations("adminTargets");
  const locale = asUiLocale(useLocale());
  const mode = draft?.mode ?? null;
  const liveSum = draft ? sumFilled(draft.departmentInputs) : null;
  const regionDisplay =
    draft?.clear
      ? t("notSet")
      : mode === "DEPARTMENT"
        ? liveSum == null
          ? "—"
          : formatNumber(liveSum, locale)
        : mode === "REGION"
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
              onChange={(next) => {
                if (next === mode) return;
                if (next === "REGION" && draft?.mode === "DEPARTMENT") {
                  const sum = sumFilled(draft.departmentInputs);
                  onDraftChange({
                    ...draft,
                    clear: false,
                    mode: "REGION",
                    regionInput: sum != null ? String(sum) : draft.regionInput,
                    departmentInputs: Object.fromEntries(
                      Object.keys(draft.departmentInputs).map((id) => [id, ""]),
                    ),
                  });
                  return;
                }
                onDraftChange(applyEditMode(region, next));
              }}
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
      {open &&
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
                  <span>{mode === "REGION" ? "—" : stored}</span>
                )}
              </td>
            </tr>
          );
        })}
    </>
  );
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
