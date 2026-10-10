"use client";

import React, { useState, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import {
  type NominalRosterDefinition,
  type RosterRowSlot,
  type RosterFieldDefinition,
  getRosterActiveRecords,
  getRosterNextAvailableSlot,
  getRosterCapacityState,
  clearRosterSlotData,
} from "./StatisticalTableDefinition";

export interface NominalRosterRendererProps {
  definition: NominalRosterDefinition;
  data: FormData;
  onChange: (fieldKey: string, value: unknown) => void;
  disabled?: boolean;
  className?: string;
}

const accentGreen = "#006633";
const ink = "#1a1a1a";
const inkSoft = "#555555";
const borderLight = "#d0d7de";
const bgCard = "#ffffff";
const bgMuted = "#f6f8fa";
const errRed = "#cf222e";

export function NominalRosterRenderer({
  definition,
  data,
  onChange,
  disabled = false,
  className = "",
}: NominalRosterRendererProps) {
  const locale = useLocale().startsWith("en") ? "en" : "fr";
  const t = useTranslations("modernJobs.roster");
  const baseId = useId();

  // Active records currently present in FormData
  const activeRecords = getRosterActiveRecords(definition, data);
  const capacityState = getRosterCapacityState(definition, data);

  // Local state for add/edit form
  const [selectedSlot, setSelectedSlot] = useState<RosterRowSlot | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [primaryKeyError, setPrimaryKeyError] = useState(false);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<RosterRowSlot | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  const noun = localized(definition.recordNoun ?? null, locale) || t("recordsNoun");
  const singularNoun = localized(definition.singularRecordNoun ?? null, locale) || t("recordNoun");

  const clearForm = () => {
    setSelectedSlot(null);
    setFormValues({});
    setPrimaryKeyError(false);
  };

  const handleFieldChange = (fieldKey: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [fieldKey]: value }));
    if (fieldKey === definition.primaryKeyField && primaryKeyError) {
      setPrimaryKeyError(false);
    }
  };

  const handleStartEdit = (slot: RosterRowSlot) => {
    if (disabled) return;
    setSelectedSlot(slot);
    const initialValues: Record<string, unknown> = {};
    for (const f of definition.fields) {
      initialValues[f.key] = data[slot.cellKeys[f.key]] ?? null;
    }
    setFormValues(initialValues);
    setPrimaryKeyError(false);
    setConfirmDeleteSlot(null);
    setAnnouncement(
      t("announceEditing", { name: String(initialValues[definition.primaryKeyField] || singularNoun) })
    );
  };

  const handleSave = () => {
    if (disabled) return;
    const pkVal = formValues[definition.primaryKeyField];
    const trimmedPk = typeof pkVal === "string" ? pkVal.trim() : pkVal != null ? String(pkVal).trim() : "";

    if (!trimmedPk) {
      setPrimaryKeyError(true);
      return;
    }

    // Determine target slot (selected slot or next available)
    const targetSlot = selectedSlot ?? getRosterNextAvailableSlot(definition, data);
    if (!targetSlot) {
      // Capacity reached
      return;
    }

    // Write all fields into FormData
    for (const f of definition.fields) {
      const cellKey = targetSlot.cellKeys[f.key];
      const val = formValues[f.key];
      const sanitizedVal =
        typeof val === "string" ? val.trim() : val === undefined ? null : val;
      onChange(cellKey, sanitizedVal);
    }

    const wasEditing = selectedSlot !== null;
    clearForm();
    setAnnouncement(
      wasEditing
        ? t("announceUpdated", { noun: singularNoun })
        : t("announceAdded", { noun: singularNoun })
    );
  };

  const handleRemove = (slot: RosterRowSlot) => {
    if (disabled) return;
    const cleared = clearRosterSlotData(definition, slot);
    for (const [cellKey, val] of Object.entries(cleared)) {
      onChange(cellKey, val);
    }
    if (selectedSlot?.rowId === slot.rowId) {
      clearForm();
    }
    setConfirmDeleteSlot(null);
    setAnnouncement(
      t("announceRemoved", { noun: singularNoun })
    );
  };

  const isEditing = selectedSlot !== null;
  const isFull = capacityState.isFull && !isEditing;

  return (
    <div
      className={`nominal-roster-renderer ${className}`}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
      data-testid="nominal-roster-container"
    >
      {/* Live Region for Screen Reader Announcements */}
      <div
        role="status"
        aria-live="polite"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
      >
        {announcement}
      </div>

      {/* Header Box */}
      <div
        style={{
          borderLeft: `4px solid ${accentGreen}`,
          padding: "10px 14px",
          background: bgMuted,
          borderRadius: 4,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ink }}>
          <CodedLabel code={definition.paperCode} text={localized(definition.title, locale)} />
        </h3>
        {definition.caption && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: inkSoft }}>
            {localized(definition.caption, locale)}
          </p>
        )}
      </div>

      {/* Form Card (Add / Edit) */}
      <div
        style={{
          background: bgCard,
          border: `1px solid ${isEditing ? accentGreen : borderLight}`,
          borderRadius: 8,
          padding: 16,
          boxShadow: isEditing ? "0 0 0 1px " + accentGreen : "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h4
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: isEditing ? accentGreen : ink,
            }}
          >
            {isEditing
              ? t("editHeading", { noun: singularNoun })
              : t("addHeading", { noun: singularNoun })}
          </h4>
          {isEditing && (
            <button
              type="button"
              onClick={clearForm}
              style={{
                background: "none",
                border: "none",
                color: inkSoft,
                cursor: "pointer",
                fontSize: 12,
                textDecoration: "underline",
              }}
            >
              {t("cancelEdit")}
            </button>
          )}
        </div>

        {/* Fields grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Text Identity Fields (lastName, firstName) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {definition.fields
              .filter((f) => f.kind === "text")
              .map((f) => {
                const isPk = f.key === definition.primaryKeyField;
                const hasError = isPk && primaryKeyError;
                const inputId = `${baseId}_field_${f.key}`;
                return (
                  <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label
                      htmlFor={inputId}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: hasError ? errRed : ink,
                      }}
                    >
                      {localized(f.label, locale)}
                      {f.required && " *"}
                    </label>
                    <input
                      id={inputId}
                      type="text"
                      disabled={disabled || isFull}
                      value={(formValues[f.key] as string) ?? ""}
                      onChange={(e) => handleFieldChange(f.key, e.target.value)}
                      placeholder={localized(f.placeholder ?? null, locale)}
                      aria-invalid={hasError}
                      aria-describedby={hasError ? `${inputId}_err` : undefined}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 4,
                        border: `1px solid ${hasError ? errRed : borderLight}`,
                        fontSize: 14,
                        color: ink,
                        outline: "none",
                        minHeight: 40,
                      }}
                    />
                    {hasError && (
                      <span id={`${inputId}_err`} style={{ fontSize: 11, color: errRed }}>
                        {t("fieldRequired", { field: localized(f.label, locale) })}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Select and Radio Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {definition.fields
              .filter((f) => f.kind === "select" || f.kind === "radio")
              .map((f) => {
                const inputId = `${baseId}_field_${f.key}`;
                const val = (formValues[f.key] as string) ?? "";
                return (
                  <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label
                      htmlFor={inputId}
                      style={{ fontSize: 12, fontWeight: 600, color: ink }}
                    >
                      {localized(f.label, locale)}
                    </label>
                    <select
                      id={inputId}
                      disabled={disabled || isFull}
                      value={val}
                      onChange={(e) => handleFieldChange(f.key, e.target.value || null)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 4,
                        border: `1px solid ${borderLight}`,
                        fontSize: 13,
                        color: ink,
                        backgroundColor: bgCard,
                        minHeight: 40,
                        cursor: disabled || isFull ? "default" : "pointer",
                      }}
                    >
                      <option value="">
                        {t("selectPlaceholder")}
                      </option>
                      {f.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {localized(opt.label, locale)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
          </div>

          {/* Boolean Fields */}
          {definition.fields
            .filter((f) => f.kind === "boolean")
            .map((f) => {
              const inputId = `${baseId}_field_${f.key}`;
              const val = formValues[f.key];
              const isChecked = val === true || val === "true";
              return (
                <div
                  key={f.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                  }}
                >
                  <label
                    htmlFor={inputId}
                    style={{ fontSize: 13, fontWeight: 600, color: ink, cursor: "pointer" }}
                  >
                    {localized(f.label, locale)}
                  </label>
                  <input
                    id={inputId}
                    type="checkbox"
                    disabled={disabled || isFull}
                    checked={isChecked}
                    onChange={(e) => handleFieldChange(f.key, e.target.checked)}
                    style={{ width: 20, height: 20, cursor: disabled || isFull ? "default" : "pointer" }}
                  />
                </div>
              );
            })}

          {/* Save / Submit Button */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              disabled={disabled || isFull}
              onClick={handleSave}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: accentGreen,
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 14,
                cursor: disabled || isFull ? "not-allowed" : "pointer",
                opacity: disabled || isFull ? 0.5 : 1,
                minHeight: 44,
              }}
            >
              {isEditing
                ? t("saveChanges")
                : isFull
                ? t("capacityReached")
                : t("saveRecord", { noun: singularNoun })}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={clearForm}
                style={{
                  padding: "10px 16px",
                  background: "transparent",
                  color: inkSoft,
                  border: `1px solid ${borderLight}`,
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                {t("cancel")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Registered Records Section */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: accentGreen }}>
            {t("registeredHeading", { noun, Noun: noun.charAt(0).toUpperCase() + noun.slice(1) })}
          </h4>
          <span style={{ fontSize: 12, color: inkSoft }}>
            {t("countOfCapacity", { count: activeRecords.length, noun, capacity: definition.rosterCapacity })}
          </span>
        </div>

        {activeRecords.length === 0 ? (
          <p style={{ fontSize: 13, color: inkSoft, margin: "4px 0" }}>
            {localized(definition.emptyStateMessage ?? null, locale) ||
              t("noRecords")}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeRecords.map(({ slot, values }) => {
              const isSlotEditing = selectedSlot?.rowId === slot.rowId;
              const titleText = definition.titleBuilder
                ? definition.titleBuilder(values)
                : `${(values.lastName as string) ?? ""} ${(values.firstName as string) ?? ""}`.trim() ||
                  slot.rowId;
              const subtitleText = definition.subtitleBuilder
                ? definition.subtitleBuilder(values)
                : "";
              const isPromptingDelete = confirmDeleteSlot?.rowId === slot.rowId;

              return (
                <div
                  key={slot.rowId}
                  data-slot-id={slot.rowId}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "10px 12px",
                    background: isSlotEditing ? "#eef6ee" : bgMuted,
                    border: `1px solid ${isSlotEditing ? accentGreen : borderLight}`,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 700,
                          color: ink,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {titleText}
                      </p>
                      {subtitleText && (
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: inkSoft }}>
                          {subtitleText}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleStartEdit(slot)}
                        aria-label={
                          t("editItem", { name: titleText })
                        }
                        style={{
                          background: bgCard,
                          border: `1px solid ${borderLight}`,
                          borderRadius: 4,
                          padding: "6px 10px",
                          cursor: disabled ? "default" : "pointer",
                          fontSize: 14,
                          minHeight: 36,
                          minWidth: 36,
                        }}
                      >
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setConfirmDeleteSlot(slot)}
                        aria-label={
                          t("deleteItem", { name: titleText })
                        }
                        style={{
                          background: bgCard,
                          border: `1px solid ${borderLight}`,
                          borderRadius: 4,
                          padding: "6px 10px",
                          cursor: disabled ? "default" : "pointer",
                          fontSize: 14,
                          minHeight: 36,
                          minWidth: 36,
                          color: errRed,
                        }}
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </div>

                  {/* Accessible inline confirmation for deletion */}
                  {isPromptingDelete && (
                    <div
                      role="alertdialog"
                      aria-labelledby={`del_title_${slot.rowId}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        background: "#ffebe9",
                        border: `1px solid ${errRed}`,
                        borderRadius: 4,
                        padding: 10,
                        marginTop: 4,
                      }}
                    >
                      <span id={`del_title_${slot.rowId}`} style={{ fontSize: 12, fontWeight: 600, color: errRed }}>
                        {localized(definition.removeConfirmationMessage ?? null, locale) ||
                          t("removeConfirm")}
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleRemove(slot)}
                          style={{
                            background: errRed,
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            minHeight: 36,
                          }}
                        >
                          {t("confirmDelete")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSlot(null)}
                          style={{
                            background: bgCard,
                            border: `1px solid ${borderLight}`,
                            borderRadius: 4,
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            minHeight: 36,
                          }}
                        >
                          {t("cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
