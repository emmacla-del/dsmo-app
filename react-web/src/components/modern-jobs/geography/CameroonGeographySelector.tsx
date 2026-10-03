"use client";

import React, { useEffect, useMemo, useState, useId } from "react";
import { useTranslations } from "next-intl";
import type { FormData } from "@/lib/onefop-schema";
import type { Department, Region, Subdivision } from "@/lib/user-types";
import {
  REGION_NAME_EN,
  useTerritoryStructure,
} from "@/hooks/useTerritoryStructure";

export interface CameroonGeographySelectorProps {
  /** The field ID for Region, e.g. "S1Q04_REGION" or "COOP_S1Q05_REGION" */
  regionFieldId: string;
  /** The field ID for Department, e.g. "S1Q04_DEPT" or "COOP_S1Q05_DEPT" */
  departmentFieldId: string;
  /** The field ID for Subdivision (Arrondissement), e.g. "S1Q04_SUBDIV" or "COOP_S1Q05_SUBDIV" */
  subdivisionFieldId: string;
  /** Optional field ID for Locality (Quartier/Village), e.g. "S1Q04_LOCALITY" */
  localityFieldId?: string;
  /** Form data map containing existing values */
  data: FormData;
  /** Update callback */
  onChange: (fieldId: string, value: unknown) => void;
  /** Active user locale */
  locale?: "fr" | "en";
  /** Whether the fields are disabled */
  disabled?: boolean;
  /** Whether fields are required */
  required?: boolean;
  /** Validation errors map (fieldId -> errorMessage) */
  errors?: Record<string, string>;
}

export function CameroonGeographySelector({
  regionFieldId,
  departmentFieldId,
  subdivisionFieldId,
  localityFieldId,
  data,
  onChange,
  locale = "fr",
  disabled = false,
  required = true,
  errors = {},
}: CameroonGeographySelectorProps) {
  const t = useTranslations("modernJobs.geography");
  const { data: tree, isLoading: loadingRegions } = useTerritoryStructure();

  // Stored values stay the canonical (French) names; only the label shown follows the locale.
  const displayName = (item: { name: string; nameEn?: string | null }) =>
    locale === "en" && item.nameEn ? item.nameEn : item.name;
  const baseId = useId();

  // Raw stored string names in FormData
  const storedRegion = String(data[regionFieldId] ?? "").trim();
  const storedDept = String(data[departmentFieldId] ?? "").trim();
  const storedSubdiv = String(data[subdivisionFieldId] ?? "").trim();
  const storedLocality = localityFieldId ? String(data[localityFieldId] ?? "") : "";

  // Selected IDs internally mapped for cascading UI
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");

  // ── 1. Regions from territory structure query ─────────────────────────────
  const regions: Region[] = useMemo(() => {
    return (
      tree?.map((r) => ({
        id: r.id,
        name: r.name,
        nameEn: REGION_NAME_EN[r.name] ?? null,
      })) ?? []
    );
  }, [tree]);

  // ── 2. Sync / Hydrate Region ID from stored name ────────────────────────
  useEffect(() => {
    if (!storedRegion || regions.length === 0) {
      if (!storedRegion) {
        setSelectedRegionId("");
        setSelectedDeptId("");
      }
      return;
    }

    const matched = regions.find(
      (r) =>
        r.id === storedRegion ||
        r.name.toLowerCase() === storedRegion.toLowerCase() ||
        (r.nameEn && r.nameEn.toLowerCase() === storedRegion.toLowerCase()),
    );

    if (matched && matched.id !== selectedRegionId) {
      setSelectedRegionId(matched.id);
    }
  }, [storedRegion, regions, selectedRegionId]);

  // ── 3. Departments from selected region ──────────────────────────────────
  const departments: Department[] = useMemo(() => {
    if (!selectedRegionId || !tree) return [];
    const reg = tree.find((r) => r.id === selectedRegionId);
    if (!reg) return [];
    return reg.departments.map((d) => ({
      id: d.id,
      name: d.name,
      regionId: reg.id,
    }));
  }, [selectedRegionId, tree]);

  // ── 4. Sync / Hydrate Department ID from stored name ────────────────────
  useEffect(() => {
    if (!storedDept || departments.length === 0) {
      if (!storedDept) {
        setSelectedDeptId("");
      }
      return;
    }

    const matched = departments.find(
      (d) =>
        d.id === storedDept ||
        d.name.toLowerCase() === storedDept.toLowerCase() ||
        (d.nameEn && d.nameEn.toLowerCase() === storedDept.toLowerCase()),
    );

    if (matched && matched.id !== selectedDeptId) {
      setSelectedDeptId(matched.id);
    }
  }, [storedDept, departments, selectedDeptId]);

  // ── 5. Subdivisions from selected department ────────────────────────────
  const subdivisions: Subdivision[] = useMemo(() => {
    if (!selectedDeptId || !tree) return [];
    for (const reg of tree) {
      const dept = reg.departments.find((d) => d.id === selectedDeptId);
      if (dept) {
        return dept.subdivisions.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          departmentId: dept.id,
        }));
      }
    }
    return [];
  }, [selectedDeptId, tree]);

  // ── Event Handlers with Cascading Resets ─────────────────────────────────

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rId = e.target.value;
    setSelectedRegionId(rId);
    setSelectedDeptId("");

    const rObj = regions.find((r) => r.id === rId);
    const standardName = rObj ? rObj.name : "";

    // Update region, reset downstream
    onChange(regionFieldId, standardName);
    onChange(departmentFieldId, "");
    onChange(subdivisionFieldId, "");
    if (localityFieldId) {
      onChange(localityFieldId, "");
    }
  };

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dId = e.target.value;
    setSelectedDeptId(dId);

    const dObj = departments.find((d) => d.id === dId);
    const standardName = dObj ? dObj.name : "";

    // Update department, reset downstream subdivision
    onChange(departmentFieldId, standardName);
    onChange(subdivisionFieldId, "");
    if (localityFieldId) {
      onChange(localityFieldId, "");
    }
  };

  const handleSubdivChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    const sObj = subdivisions.find((s) => s.id === sId);
    const standardName = sObj ? sObj.name : "";

    onChange(subdivisionFieldId, standardName);
    if (localityFieldId) {
      onChange(localityFieldId, "");
    }
  };

  const handleLocalityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (localityFieldId) {
      onChange(localityFieldId, e.target.value);
    }
  };

  return (
    <div
      role="group"
      aria-label={t("ariaLabel")}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 12, color: "var(--cam-text-muted, #64748b)", marginBottom: 8, fontStyle: "italic" }}>
          {t("dependsHint")}
        </div>

        {/* ── 1. Région ── */}
        <div>
          <label
            htmlFor={`${baseId}-region`}
            style={{
              display: "block",
              fontSize: "var(--cam-font-size-base, 0.9375rem)",
              fontWeight: 600,
              color: "var(--cam-text, #0b1f14)",
              marginBottom: 4,
            }}
          >
            {t("region")}
            {required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
          </label>
          <select
            id={`${baseId}-region`}
            name={regionFieldId}
            value={selectedRegionId}
            disabled={disabled || loadingRegions}
            onChange={handleRegionChange}
            aria-required={required}
            aria-invalid={!!errors[regionFieldId]}
            className={`sovereign-select ${errors[regionFieldId] ? "has-error" : ""}`}
            style={{
              width: "100%",
              height: 42,
              padding: "0 12px",
              fontSize: 14,
              borderRadius: 6,
              background: disabled ? "#f8fafc" : "#ffffff",
              color: "#0f172a",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <option value="">
              {loadingRegions
                ? t("loadingRegions")
                : t("selectRegion")}
            </option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {displayName(r)}
              </option>
            ))}
          </select>
          {errors[regionFieldId] && (
            <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 4, display: "block" }}>
              {errors[regionFieldId]}
            </span>
          )}
        </div>

        {/* ── 2. Département (Cascading from Region) ── */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span
            style={{
              fontSize: 16,
              color: !selectedRegionId ? "#cbd5e1" : "#64748b",
              lineHeight: 1,
              marginTop: 30,
              userSelect: "none",
            }}
            aria-hidden="true"
          >
            ↳
          </span>
          <div style={{ flex: 1 }}>
            <label
              htmlFor={`${baseId}-department`}
              style={{
                display: "block",
                fontSize: "var(--cam-font-size-base, 0.9375rem)",
                fontWeight: 600,
                color: !selectedRegionId ? "#94a3b8" : "var(--cam-text, #0b1f14)",
                marginBottom: 4,
              }}
            >
              {t("department")}
              {required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
            </label>
            <select
              id={`${baseId}-department`}
              name={departmentFieldId}
              value={selectedDeptId}
              disabled={disabled || !selectedRegionId}
              onChange={handleDeptChange}
              aria-required={required}
              aria-invalid={!!errors[departmentFieldId]}
              className={`sovereign-select ${errors[departmentFieldId] ? "has-error" : ""}`}
              style={{
                width: "100%",
                height: 42,
                padding: "0 12px",
                fontSize: 14,
                borderRadius: 6,
                background: disabled || !selectedRegionId ? "#f8fafc" : "#ffffff",
                color: !selectedRegionId ? "#94a3b8" : "#0f172a",
                cursor: disabled || !selectedRegionId ? "not-allowed" : "pointer",
              }}
            >
              <option value="">
                {!selectedRegionId
                  ? t("chooseRegionFirst")
                  : t("selectDepartment")}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {displayName(d)}
                </option>
              ))}
            </select>
            {errors[departmentFieldId] && (
              <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 4, display: "block" }}>
                {errors[departmentFieldId]}
              </span>
            )}
          </div>
        </div>

        {/* ── 3. Arrondissement (Cascading from Department) ── */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span
            style={{
              fontSize: 16,
              color: !selectedDeptId ? "#cbd5e1" : "#64748b",
              lineHeight: 1,
              marginTop: 30,
              userSelect: "none",
            }}
            aria-hidden="true"
          >
            ↳
          </span>
          <div style={{ flex: 1 }}>
            <label
              htmlFor={`${baseId}-subdivision`}
              style={{
                display: "block",
                fontSize: "var(--cam-font-size-base, 0.9375rem)",
                fontWeight: 600,
                color: !selectedDeptId ? "#94a3b8" : "var(--cam-text, #0b1f14)",
                marginBottom: 4,
              }}
            >
              {t("subdivision")}
              {required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
            </label>
            <select
              id={`${baseId}-subdivision`}
              name={subdivisionFieldId}
              value={
                subdivisions.find((s) => s.name.toLowerCase() === storedSubdiv.toLowerCase())?.id ?? ""
              }
              disabled={disabled || !selectedDeptId}
              onChange={handleSubdivChange}
              aria-required={required}
              aria-invalid={!!errors[subdivisionFieldId]}
              className={`sovereign-select ${errors[subdivisionFieldId] ? "has-error" : ""}`}
              style={{
                width: "100%",
                height: 42,
                padding: "0 12px",
                fontSize: 14,
                borderRadius: 6,
                background: disabled || !selectedDeptId ? "#f8fafc" : "#ffffff",
                color: !selectedDeptId ? "#94a3b8" : "#0f172a",
                cursor: disabled || !selectedDeptId ? "not-allowed" : "pointer",
              }}
            >
              <option value="">
                {!selectedDeptId
                  ? t("chooseDepartmentFirst")
                  : t("selectSubdivision")}
              </option>
              {subdivisions.map((s) => (
                <option key={s.id} value={s.id}>
                  {displayName(s)}
                </option>
              ))}
            </select>
            {errors[subdivisionFieldId] && (
              <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 4, display: "block" }}>
                {errors[subdivisionFieldId]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Optional Locality (Quartier/Village) ── */}
      {localityFieldId && (
        <div style={{ marginTop: 16 }}>
          <label
            htmlFor={`${baseId}-locality`}
            style={{
              display: "block",
              fontSize: "var(--cam-font-size-base, 0.9375rem)",
              fontWeight: 600,
              color: "var(--cam-text, #0b1f14)",
              marginBottom: 4,
            }}
          >
            {t("locality")}
            {required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
          </label>
          <input
            id={`${baseId}-locality`}
            name={localityFieldId}
            type="text"
            value={storedLocality}
            disabled={disabled}
            onChange={handleLocalityChange}
            aria-required={required}
            aria-invalid={!!errors[localityFieldId]}
            placeholder={
              t("localityPlaceholder")
            }
            className={`sovereign-text-input ${errors[localityFieldId] ? "has-error" : ""}`}
            style={{
              width: "100%",
              height: 42,
              padding: "0 12px",
              fontSize: 14,
              borderRadius: 6,
              background: disabled ? "#f8fafc" : "#ffffff",
              color: "#0f172a",
            }}
          />
          {errors[localityFieldId] && (
            <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 4, display: "block" }}>
              {errors[localityFieldId]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
