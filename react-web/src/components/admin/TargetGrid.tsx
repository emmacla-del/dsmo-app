"use client";

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
  if (regions.length === 0) {
    return (
      <p className="cam-admin-lede">Aucun territoire n&apos;est associé à ce compte.</p>
    );
  }

  return (
    <div className="cam-dash-table-wrap">
      <table className="cam-dash-table cam-target-table">
        <thead>
          <tr>
            <th scope="col">Territoire</th>
            <th scope="col">Mode</th>
            <th scope="col" className="is-num">Objectif</th>
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
              <th scope="row">Niveau central</th>
              <td>—</td>
              <td className="is-num">
                {canWrite ? (
                  <TargetInput
                    ariaLabel="Objectif niveau central"
                    value={centralInput}
                    onChange={onCentralChange}
                  />
                ) : (
                  <span>{centralInput.trim() === "" ? "—" : Number(centralInput).toLocaleString("fr-FR")}</span>
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
  const mode = draft?.mode ?? null;
  const liveSum = draft ? sumFilled(draft.departmentInputs) : null;
  const regionDisplay =
    draft?.clear
      ? "Non défini"
      : mode === "DEPARTMENT"
        ? liveSum == null
          ? "—"
          : liveSum.toLocaleString("fr-FR")
        : mode === "REGION"
          ? null
          : region.target == null
            ? "—"
            : region.target.toLocaleString("fr-FR");

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
            <span className={modeBadgeClass(region.mode)}>{modeLabel(region.mode)}</span>
          )}
        </td>
        <td className="is-num">
          {canWrite && mode === "REGION" ? (
            <TargetInput
              ariaLabel={`Objectif régional ${region.name}`}
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
              Cette région mélange un objectif régional et des objectifs départementaux. Choisissez un mode avant d&apos;enregistrer.
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
                  ? "Enregistrez ou annulez vos modifications avant d'effacer une région"
                  : undefined
              }
            >
              <button
                type="button"
                className="cam-button cam-button-danger cam-button-sm"
                disabled={hasUnsavedChanges}
                onClick={onClear}
              >
                Effacer les cibles de la région
              </button>
            </span>
          </td>
        </tr>
      )}
      {open &&
        region.departments.map((department) => {
          const stored = department.target == null ? "—" : department.target.toLocaleString("fr-FR");
          const editable = canWrite && mode === "DEPARTMENT";
          return (
            <tr key={department.departmentId} className="cam-target-dept">
              <th scope="row">{department.name}</th>
              <td></td>
              <td className="is-num">
                {editable ? (
                  <TargetInput
                    ariaLabel={`Objectif ${department.name}`}
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
  return (
    <div className="cam-target-modes" role="radiogroup" aria-label="Mode d'objectif">
      <label className="cam-admin-choice">
        <input
          type="radio"
          name={`mode-${name}`}
          checked={mode === "DEPARTMENT"}
          onChange={() => onChange("DEPARTMENT")}
        />
        Par département
      </label>
      <label className="cam-admin-choice">
        <input
          type="radio"
          name={`mode-${name}`}
          checked={mode === "REGION"}
          onChange={() => onChange("REGION")}
        />
        Région seule
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

function modeBadgeClass(mode: NormalizedRegion["mode"]): string {
  if (mode === "DEPARTMENT") return "cam-badge cam-badge-info";
  if (mode === "REGION") return "cam-badge cam-badge-success";
  if (mode === "MIXED") return "cam-badge cam-badge-warning";
  return "cam-badge cam-badge-neutral";
}
