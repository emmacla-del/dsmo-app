"use client";

// 8.8's Guided mode: add one member of staff at a time, then the list of
// those added. The grid is VtRosterGrid; both write the same cells. Styled by
// .cam-roster-* (globals.css): one column of questions like the rest of the
// wizard, no card, one green action per screen (Next), so Save is secondary.

import React, { useContext, useState, useId } from "react";
import { TableHeadingShownContext } from "../table-heading-context";
import { useLocale, useTranslations } from "next-intl";
import type { FormData } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import {
  type NominalRosterDefinition,
  type RosterFieldDefinition,
  type RosterRowSlot,
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
  // The screen's heading already names the table (VT Section 8).
  const headingShown = useContext(TableHeadingShownContext);

  // Active records currently present in FormData
  const activeRecords = getRosterActiveRecords(definition, data);
  const capacityState = getRosterCapacityState(definition, data);

  // Local state for add/edit form
  const [selectedSlot, setSelectedSlot] = useState<RosterRowSlot | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  // The required answers a Save was refused for, so the form says which
  // ones instead of saving a row Suivant will then stop (audit R6).
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<RosterRowSlot | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  const noun = localized(definition.recordNoun ?? null, locale) || t("recordsNoun");
  const singularNoun = localized(definition.singularRecordNoun ?? null, locale) || t("recordNoun");
  // The answers a row cannot be saved without — the same ones validation
  // owes for a row begun (8.8: the name, the first name, the sex).
  const requiredFields = definition.fields.filter((f) => f.required || f.key === definition.primaryKeyField);

  const clearForm = () => {
    setSelectedSlot(null);
    setFormValues({});
    setMissingRequired([]);
  };

  const handleFieldChange = (fieldKey: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [fieldKey]: value }));
    setMissingRequired((prev) => (prev.includes(fieldKey) ? prev.filter((k) => k !== fieldKey) : prev));
  };

  const handleStartEdit = (slot: RosterRowSlot) => {
    if (disabled) return;
    setSelectedSlot(slot);
    const initialValues: Record<string, unknown> = {};
    for (const f of definition.fields) {
      initialValues[f.key] = data[slot.cellKeys[f.key]] ?? null;
    }
    setFormValues(initialValues);
    setMissingRequired([]);
    setConfirmDeleteSlot(null);
    setAnnouncement(
      t("announceEditing", { name: String(initialValues[definition.primaryKeyField] || singularNoun) })
    );
  };

  const handleSave = () => {
    if (disabled) return;

    // Every required answer, not the name alone: a row saved without one of
    // them blocked Suivant later, on a screen that had said it was saved.
    const missing = requiredFields.filter((f) => {
      const value = formValues[f.key];
      return value === undefined || value === null || String(value).trim() === "";
    });
    if (missing.length > 0) {
      setMissingRequired(missing.map((f) => f.key));
      setAnnouncement(t("fieldRequired", { field: localized(missing[0].label, locale) }));
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
  const optionalText = locale === "en" ? "(optional)" : "(facultatif)";

  const textField = (f: RosterFieldDefinition) => {
    const hasError = missingRequired.includes(f.key);
    const inputId = `${baseId}_field_${f.key}`;
    return (
      <div key={f.key} className="cam-roster-field">
        {/* "(optional)" on the optional ones; no asterisk on the required
            ones (audit R10). */}
        <label htmlFor={inputId} className="cam-question">
          {localized(f.label, locale)}
          {!f.required && <span className="cam-roster-optional"> {optionalText}</span>}
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
          className={`sovereign-text-input cam-roster-control${hasError ? " has-error" : ""}`}
        />
        {hasError && (
          <p id={`${inputId}_err`} className="cam-roster-error">
            {t("fieldRequired", { field: localized(f.label, locale) })}
          </p>
        )}
      </div>
    );
  };

  const choiceField = (f: RosterFieldDefinition) => {
    const hasError = missingRequired.includes(f.key);
    const inputId = `${baseId}_field_${f.key}`;
    const val = (formValues[f.key] as string) ?? "";
    return (
      <div key={f.key} className="cam-roster-field">
        <label htmlFor={inputId} className="cam-question">
          {localized(f.label, locale)}
        </label>
        <select
          id={inputId}
          disabled={disabled || isFull}
          value={val}
          onChange={(e) => handleFieldChange(f.key, e.target.value || null)}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}_err` : undefined}
          className={`sovereign-select cam-roster-control${val ? "" : " cam-roster-unset"}${hasError ? " has-error" : ""}`}
        >
          {/* A prompt, not a choice: disabled and hidden from the open
              list, as in the grid and in FieldControl. */}
          <option value="" disabled hidden>
            {t("selectPlaceholder")}
          </option>
          {f.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {localized(opt.label, locale)}
            </option>
          ))}
        </select>
        {hasError && (
          <p id={`${inputId}_err`} className="cam-roster-error">
            {t("fieldRequired", { field: localized(f.label, locale) })}
          </p>
        )}
      </div>
    );
  };

  const booleanField = (f: RosterFieldDefinition) => {
    // Oui and Non, neither of them chosen until the respondent chooses: a
    // tick box would have made "not answered" look like Non (§9), and the
    // grid offers the same three states.
    const val = formValues[f.key];
    const name = `${baseId}_field_${f.key}`;
    return (
      <fieldset key={f.key} className="cam-roster-field">
        <legend className="cam-question">{localized(f.label, locale)}</legend>
        {([true, false] as const).map((answer) => (
          <label key={String(answer)} className="cam-roster-check cam-answer">
            <input
              type="radio"
              name={name}
              value={String(answer)}
              disabled={disabled || isFull}
              checked={val === answer || val === String(answer)}
              onChange={() => handleFieldChange(f.key, answer)}
            />
            <span>{answer ? t("yes") : t("no")}</span>
          </label>
        ))}
      </fieldset>
    );
  };

  const renderField = (f: RosterFieldDefinition) =>
    f.kind === "text" ? textField(f) : f.kind === "boolean" ? booleanField(f) : choiceField(f);

  // The questions in the paper's own order, and the band it prints over
  // some of them (8.8's "Si formateur" over the two qualifications) as a
  // heading of their own — the grid heads the same columns with it.
  const bands: { group: string | null; fields: RosterFieldDefinition[] }[] = [];
  for (const f of definition.fields) {
    const group = f.group ? localized(f.group, locale) : null;
    const open = bands[bands.length - 1];
    if (open && group !== null && open.group === group) open.fields.push(f);
    else bands.push({ group, fields: [f] });
  }

  return (
    <div className={`nominal-roster-renderer cam-roster ${className}`} data-testid="nominal-roster-container">
      {/* Live Region for Screen Reader Announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* The caption; the title too where the screen's heading does not
          already name the table. */}
      {headingShown ? (
        definition.caption && <p className="cam-hint">{localized(definition.caption, locale)}</p>
      ) : (
        <div>
          <h3 className="cam-roster-title">
            <CodedLabel code={definition.paperCode} text={localized(definition.title, locale)} />
          </h3>
          {definition.caption && <p className="cam-hint">{localized(definition.caption, locale)}</p>}
        </div>
      )}

      {/* Add / edit: one column of questions, like the rest of the wizard. */}
      <fieldset className={`cam-roster-form${isEditing ? " is-editing" : ""}`}>
        <legend className="cam-roster-legend">
          {isEditing ? t("editHeading", { noun: singularNoun }) : t("addHeading", { noun: singularNoun })}
        </legend>

        {bands.map((band) =>
          band.group === null ? (
            band.fields.map(renderField)
          ) : (
            <fieldset key={band.group} className="cam-roster-group">
              <legend className="cam-roster-band">{band.group}</legend>
              {band.fields.map(renderField)}
            </fieldset>
          ),
        )}

        {/* Secondary: the screen's one green action stays Next (§11). */}
        <div className="cam-roster-actions">
          <button
            type="button"
            disabled={disabled || isFull}
            onClick={handleSave}
            className="cam-button cam-button-secondary"
          >
            {isEditing ? t("saveChanges") : isFull ? t("capacityReached") : t("saveRecord", { noun: singularNoun })}
          </button>
          {isEditing && (
            <button type="button" onClick={clearForm} className="cam-text-button">
              {t("cancel")}
            </button>
          )}
        </div>
      </fieldset>

      {/* Registered records: a plain ruled list with text actions. */}
      <section className="cam-roster-list">
        <div className="cam-roster-list-head">
          <h4 className="cam-roster-legend">
            {t("registeredHeading", { noun, Noun: noun.charAt(0).toUpperCase() + noun.slice(1) })}
          </h4>
          <span className="cam-hint">
            {/* One of them is a trainer, not trainers. */}
            {t("countOfCapacity", {
              count: activeRecords.length,
              noun: activeRecords.length === 1 ? singularNoun : noun,
              capacity: definition.rosterCapacity,
            })}
          </span>
        </div>

        {activeRecords.length === 0 ? (
          <p className="cam-hint">{localized(definition.emptyStateMessage ?? null, locale) || t("noRecords")}</p>
        ) : (
          <ul className="cam-roster-items">
            {activeRecords.map(({ slot, values }) => {
              const isSlotEditing = selectedSlot?.rowId === slot.rowId;
              const titleText = definition.titleBuilder
                ? definition.titleBuilder(values)
                : `${(values.lastName as string) ?? ""} ${(values.firstName as string) ?? ""}`.trim() || slot.rowId;
              const subtitleText = definition.subtitleBuilder ? definition.subtitleBuilder(values, locale) : "";
              const isPromptingDelete = confirmDeleteSlot?.rowId === slot.rowId;

              return (
                <li
                  key={slot.rowId}
                  data-slot-id={slot.rowId}
                  className={`cam-roster-item${isSlotEditing ? " is-editing" : ""}`}
                >
                  <div className="cam-roster-item-row">
                    <div className="cam-roster-item-text">
                      <p className="cam-roster-item-name">{titleText}</p>
                      {subtitleText && <p className="cam-hint">{subtitleText}</p>}
                    </div>
                    <div className="cam-roster-item-actions">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleStartEdit(slot)}
                        aria-label={t("editItem", { name: titleText })}
                        className="cam-text-button"
                      >
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setConfirmDeleteSlot(slot)}
                        aria-label={t("deleteItem", { name: titleText })}
                        className="cam-text-button is-danger"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </div>

                  {/* Accessible inline confirmation for deletion */}
                  {isPromptingDelete && (
                    <div role="alertdialog" aria-labelledby={`del_title_${slot.rowId}`} className="cam-roster-confirm">
                      <p id={`del_title_${slot.rowId}`}>
                        {localized(definition.removeConfirmationMessage ?? null, locale) || t("removeConfirm")}
                      </p>
                      <div className="cam-roster-actions">
                        <button
                          type="button"
                          onClick={() => handleRemove(slot)}
                          className="cam-button cam-button-danger cam-button-sm"
                        >
                          {t("confirmDelete")}
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteSlot(null)} className="cam-text-button">
                          {t("cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
