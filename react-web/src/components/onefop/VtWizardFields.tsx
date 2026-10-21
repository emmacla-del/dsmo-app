"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { questionCodeText } from "@/lib/question-code";
import { CodedLabel } from "@/components/onefop/ui/QuestionCode";
import { VT_ADMIN_ONLY_IDS, VT_BLOCK_PAPER_CODES, VT_NO_STEPPER_IDS } from "./vt-wizard-utils";
import { VT_FIELD_TOOLTIPS } from "./vt-field-tooltips";
import {
  findCameroonDepartment,
  findCameroonRegion,
  regionDisplayName,
  useTerritoryStructure,
  type LocationRegion,
} from "@/hooks/useTerritoryStructure";
import { RadioGroup, type RadioOption } from "./form/Radio";
import { CheckboxGroup, type CheckboxOption } from "./form/Checkbox";
import { NumberStepper } from "./form/NumberStepper";
import { Microcopy } from "./form/Microcopy";
import { OptionalSuffix } from "./ui/OptionalSuffix";
import { isOptionalField, isYearField, VT_DATE_FIELD_ID } from "@/lib/onefop-validation";
import { yearOptions } from "@/lib/year-options";
import { respondentFunctionLabel } from "@/lib/display-labels";

/** next-intl's useLocale() returns a plain string ("fr"/"en"/"fr-FR"...);
 * localized() wants the narrow union. */
function vtLocale(locale: string): "fr" | "en" {
  return locale.startsWith("en") ? "en" : "fr";
}

// Every question label, whatever the control: the --cam-question-* tokens
// every respondent form shares (15px medium), under the subsection title
// (18px) and set apart from the answer (--cam-answer-size, 14px regular).
// Radio/checkbox questions used to be 16px bold and text inputs 15px, so
// two questions side by side read as two levels.
const labelStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--cam-font-sans)",
  fontSize: "var(--cam-question-size)",
  fontWeight: "var(--cam-question-weight)",
  lineHeight: "var(--cam-question-line-height)",
  color: "var(--cam-text)",
  marginBottom: "var(--cam-field-stack-gap)",
};

const questionLabelStyle: CSSProperties = labelStyle;

// The hint ("Ex : DRH", "A ne pas remplir") is shown inside its box, as the
// placeholder, and no longer as a line between the question and the box
// (owner, 2026-10-12). A placeholder is gone once the box is typed in and is
// not reliably read out, so the hint is also kept here, invisible, as the
// control's description. On a question without a text box it goes in the
// question's tooltip instead (vtHintPlacement).
const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function VtFieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} style={visuallyHidden}>
      {children}
    </span>
  );
}

/**
 * Where a VT question's hint goes: into the box as its placeholder when the
 * question has one text box, otherwise appended to the question's tooltip.
 */
/**
 * A box's example when the schema gives none: an e-mail in the screen's
 * language (1.16 showed a French one on the English form), and the
 * DD/MM/YYYY form of 2.1.13's order date, the format it is stored in.
 */
function fallbackPlaceholder(field: OnefopField, locale: string): string | undefined {
  const en = locale.startsWith("en");
  if (field.type === "email") return en ? "E.g. name@example.com" : "Ex : nom@exemple.com";
  if (field.id === VT_DATE_FIELD_ID) return en ? "DD/MM/YYYY" : "JJ/MM/AAAA";
  return undefined;
}

export function vtHintPlacement(
  field: OnefopField,
  hint: string | undefined,
  tooltip: string | undefined,
): { placeholder?: string; tooltip?: string } {
  if (!hint) return { tooltip };
  // 1.1 is filled in for the respondent: the paper's "A ne pas remplir" is
  // not shown under (or in) a box that already holds the code (defect 18).
  if (VT_ADMIN_ONLY_IDS.has(field.id)) return { tooltip };
  // A year is a dropdown now, which has no placeholder to hold a hint.
  const textBox =
    ["text", "email", "tel", "textarea"].includes(field.type) && field.id !== "VT9_3" && field.id !== "VT9_4";
  if (textBox) return { placeholder: hint, tooltip };
  return { tooltip: tooltip ? `${tooltip} ${hint}` : hint };
}

// Fields whose answer is a short code: a medium box, not a full line.
// Text answers shorter than a line: codes, initials, a PO box, a city, an
// order number and its date.
const VT_MEDIUM_WIDTH_IDS = new Set(["VT1_1", "VT1_3", "VT2_11", "VT2_11_CITY", "VT2_16", "VT2_17"]);

const errorStyle: CSSProperties = {
  fontSize: "var(--cam-font-size-xs)",
  fontWeight: 600,
  color: "var(--cam-error)",
  margin: "4px 0 0",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

/**
 * Locked VT1_4/5/6 values (field id -> company value) when the server will
 * store the company record's geography, or null when they stay editable.
 * Provided by VtWizardSectionScreen.
 */
export const VtGeographyLockContext = createContext<Record<string, string> | null>(null);

// Each field's paper code in the current section, so a follow-up ("Si oui,
// …") can tell that it shares its question's code and not repeat it. The
// code belongs to the question and is shown once, on the question.
export const VtPaperCodeContext = createContext<ReadonlyMap<string, string | null | undefined> | null>(null);

// Fields that share their number with the field just before them at the
// same level (2.1.10 PO box then City, 2.1.15 trainees then trainers, the
// 7.1.1 sub-items): the number is printed once, on the first, as 2.1.7
// prints "Total" then "of which female". Provided by VtWizardSectionScreen.
export const VtSharedCodeContext = createContext<ReadonlySet<string> | null>(null);

/** Stable id of a VT field's error message, referenced by the control's
 * aria-describedby (same `${id}-error` convention as FieldRenderer). */
export function vtFieldErrorId(fieldId: string): string {
  return `${fieldId}-error`;
}

export function VtWizardFieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" style={errorStyle}>
      {message}
    </p>
  );
}

/**
 * ⓘ info badge shown next to labels that have a kFieldTooltips entry —
 * matches Flutter's _VtWizardInfoBadge: hover shows a tinted popover, and
 * (since hover isn't available on touch) tapping also toggles it open.
 */
export function VtWizardInfoBadge({ tooltip }: { tooltip: string }) {
  const [open, setOpen] = useState(false);
  // Opened by a click (or tap) stays open; opened by hover closes when the
  // pointer leaves. Hover alone used to leave notes open over the questions.
  const [pinned, setPinned] = useState(false);
  const [align, setAlign] = useState<"left" | "right">("left");
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLSpanElement | null>(null);
  const popoverId = useId();

  // Reposition against the viewport's right edge instead of a fixed
  // left: 0, which clipped offscreen whenever the field sat in the right
  // column of a multi-column row.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = wrapperRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const triggerRect = trigger.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth;
    const overflowsRight = triggerRect.left + popoverWidth > window.innerWidth - 16;
    setAlign(overflowsRight ? "right" : "left");
  }, [open]);

  // Close on Escape and on any click outside the badge, instead of the old
  // onBlur, which collapsed the popover the instant focus left the trigger
  // button — before a mouse click inside the tooltip text could register.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPinned(false);
        wrapperRef.current?.querySelector("button")?.focus();
      }
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={tooltip}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          const next = !pinned;
          setPinned(next);
          setOpen(next);
        }}
        onMouseEnter={() => setOpen(true)}
        className="cam-info-badge"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="11" />
          <circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <span
          ref={popoverRef}
          id={popoverId}
          role="tooltip"
          className="cam-info-popover"
          style={{
            top: "calc(100% + var(--cam-space-1))",
            left: align === "left" ? 0 : "auto",
            right: align === "right" ? 0 : "auto",
          }}
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}

function vtFieldTooltip(fieldId: string, locale: string): string | undefined {
  const entry = VT_FIELD_TOOLTIPS[fieldId];
  if (!entry) return undefined;
  return locale.startsWith("en") ? entry.en : entry.fr;
}

interface VtAdminSuggestionItem {
  /** The stored form value — always the French canonical name, since it's
   * also the lookup key into CAMEROON_ADMIN_HIERARCHY. */
  value: string;
  /** What the chip displays — English name for regions when locale is en;
   * unchanged for departments/subdivisions/communes, which are place names
   * with no distinct English form. */
  label: string;
}

interface VtAdminSuggestions {
  header: string | null;
  items: VtAdminSuggestionItem[];
}

/**
 * Cascading Région → Département → Arrondissement suggestion
 * chips for VT1_4-VT1_6, matching Flutter's VtWizardTextField cascading
 * logic (vt_wizard_fields.dart:316-354). Flutter's own header strings are
 * French-only there, but this app's chrome switches with the active
 * locale everywhere else, so the headers below do too.
 */
function vtAdminSuggestionsFor(
  fieldId: string,
  data: FormData | undefined,
  locale: string,
  tree: LocationRegion[] | undefined | null,
): VtAdminSuggestions {
  const isEn = locale.startsWith("en");
  const region = (data?.VT1_4 as string | undefined)?.trim();
  const dept = (data?.VT1_5 as string | undefined)?.trim();
  const plain = (names: string[]): VtAdminSuggestionItem[] => names.map((name) => ({ value: name, label: name }));

  if (!tree || tree.length === 0) return { header: null, items: [] };

  if (fieldId === "VT1_4") {
    return {
      header: null,
      items: tree.map((r) => ({ value: r.name, label: regionDisplayName(r.name, locale) })),
    };
  }
  if (fieldId === "VT1_5") {
    const regObj = findCameroonRegion(tree, region);
    if (!regObj) return { header: null, items: [] };
    return {
      header: isEn ? `Departments (${region})` : `Départements (${region})`,
      items: plain(regObj.departments.map((d) => d.name)),
    };
  }
  if (fieldId === "VT1_6") {
    const deptObj = findCameroonDepartment(tree, dept, region);
    if (!deptObj) return { header: null, items: [] };
    return {
      header: isEn ? `Subdivisions (${dept})` : `Arrondissements (${dept})`,
      items: plain(deptObj.subdivisions.map((s) => s.name)),
    };
  }
  // No chips for the commune (VT1_7): it is filled from the arrondissement
  // (use-vt-derived-commune.ts), and the chips offered the department's
  // other arrondissements under a "Communes" heading (owner, 2026-10-12).
  return { header: null, items: [] };
}

function VtWizardAdminSuggestionChips({
  fieldId,
  value,
  data,
  onChange,
}: {
  fieldId: string;
  value: unknown;
  data: FormData | undefined;
  onChange: (fieldId: string, value: unknown) => void;
}) {
  const locale = useLocale();
  const { data: tree } = useTerritoryStructure();
  const { header, items } = vtAdminSuggestionsFor(fieldId, data, locale, tree);
  if (items.length === 0) return null;
  return (
    <div className="cam-suggest">
      {header && <div className="cam-hint">{header}</div>}
      <div className="cam-suggest-list">
        {items.map((item) => {
          const active = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(fieldId, item.value)}
              className="cam-suggest-chip"
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The same list the validation checks as a year (VT1_14, VT2_15), not a
// guess from the label: "année" also appears in counts "au cours de l'année".
export function isVtYearField(field: OnefopField): boolean {
  return field.type === "number" && isYearField(field);
}

export function VtWizardNumberStepper({
  field,
  value,
  onChange,
  compactBox = false,
  describedBy,
  invalid = false,
  hasError = false,
  required = false,
}: {
  field: OnefopField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  compactBox?: boolean;
  describedBy?: string;
  invalid?: boolean;
  /** Red edge and aria-invalid: the box itself is what is wrong. */
  hasError?: boolean;
  required?: boolean;
}) {
  return (
    <NumberStepper
      id={field.id}
      value={value}
      onChange={onChange}
      compact={compactBox}
      showButtons={compactBox ? false : !VT_NO_STEPPER_IDS.has(field.id)}
      describedBy={describedBy}
      invalid={invalid}
      hasError={hasError}
      required={required}
    />
  );
}

export function VtWizardInlineCountBox({
  field,
  value,
  onChange,
  errorMessage,
}: {
  field: OnefopField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  /** The count's own issue. It was never passed, so a missing count made
   *  the block say "to fix" with nothing marked on screen. */
  errorMessage?: string;
}) {
  const locale = useLocale();
  const errorId = vtFieldErrorId(field.id);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--cam-space-2)" }}>
        {/* The count's own question ("If yes, specify the number of study
            guides…"), not a bare "Number:": the label and the error now
            name the same thing (defect 18 of the 2026-10-16 run). */}
        <label htmlFor={field.id} style={{ ...labelStyle, marginBottom: 0 }}>
          {localized(field.label, vtLocale(locale))}
        </label>
        <VtWizardNumberStepper
          field={field}
          value={value}
          onChange={onChange}
          compactBox
          hasError={!!errorMessage}
          describedBy={errorMessage ? errorId : undefined}
          required={!isOptionalField(field)}
        />
      </div>
      <VtWizardFieldError id={errorId} message={errorMessage} />
    </div>
  );
}

export function VtWizardRadioGroup({
  field,
  value,
  onChange,
  inlineExtra,
  describedBy,
  invalid = false,
  required = false,
}: {
  field: OnefopField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  inlineExtra?: ReactNode;
  describedBy?: string;
  invalid?: boolean;
  required?: boolean;
}) {
  const locale = vtLocale(useLocale());
  const opts = field.options ?? [];
  const hasDescriptions = opts.some((o) => localized(o.label, locale).includes(" - "));
  const isShort = opts.every((o) => localized(o.label, locale).length <= 25);
  const horizontal = opts.length >= 2 && opts.length <= 3 && isShort && !hasDescriptions;

  const options: RadioOption[] = opts.map((opt) => {
    const labelText = localized(opt.label, locale);
    const dashIdx = labelText.indexOf(" - ");
    return {
      value: opt.value,
      label: dashIdx >= 0 ? labelText.substring(0, dashIdx) : labelText,
      caption: dashIdx >= 0 ? labelText.substring(dashIdx + 3) : undefined,
    };
  });

  return (
    <div>
      <RadioGroup
        fieldId={field.id}
        options={options}
        value={value}
        onChange={onChange}
        ariaLabel={localized(field.label, locale)}
        layout={horizontal ? "horizontal" : "vertical"}
        describedBy={describedBy}
        invalid={invalid}
        required={required}
      />
      {inlineExtra && <div style={{ marginTop: 10 }}>{inlineExtra}</div>}
    </div>
  );
}

export function VtWizardCheckboxGroup({
  field,
  value,
  onChange,
  describedBy,
  invalid = false,
}: {
  field: OnefopField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const t = useTranslations();
  const locale = vtLocale(useLocale());
  const opts = field.options ?? [];
  const current = Array.isArray(value) ? (value as unknown[]).map(String) : [];

  const options: CheckboxOption[] = opts.map((opt) => ({
    value: opt.value,
    label: localized(opt.label, locale),
  }));

  return (
    <div>
      <Microcopy variant="instruction">
        {t("vtWizard.selectAllThatApply", { default: "Sélectionnez toutes les options applicables" })}
      </Microcopy>
      <CheckboxGroup
        fieldId={field.id}
        options={options}
        value={current}
        onChange={onChange}
        ariaLabel={localized(field.label, locale)}
        // One column at any length: two columns read across (1 2 / 3 4),
        // not down in the paper's order, and differed from short lists.
        columns={1}
        describedBy={describedBy}
        invalid={invalid}
      />
    </div>
  );
}

function VtFiveSlotsField({
  field,
  value,
  onChange,
  onFieldTouch,
  labelNode,
  optionalSuffix,
  tooltip,
  hint,
  hintId,
  errorId,
  errorMessage,
  hasError,
  locale,
}: {
  field: OnefopField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  onFieldTouch?: (fieldId: string) => void;
  labelNode: ReactNode;
  optionalSuffix: ReactNode;
  tooltip?: string;
  hint?: string;
  hintId?: string;
  errorId?: string;
  errorMessage?: string;
  hasError: boolean;
  locale: string;
}) {
  const isEn = locale.startsWith("en");
  const isPerspectives = field.id === "VT9_4";
  const slotPrefix = isPerspectives
    ? (isEn ? "Outlook" : "Perspective")
    : (isEn ? "Other" : "Autre");

  const currentArray = useMemo(() => {
    let arr: string[] = [];
    if (Array.isArray(value)) {
      arr = value.map((v) => String(v ?? ""));
    } else if (typeof value === "string" && value.trim() !== "") {
      arr = value.split(/\r?\n+/);
    }
    while (arr.length < 5) arr.push("");
    return arr.slice(0, 5);
  }, [value]);

  const handleSlotChange = (index: number, text: string) => {
    const next = [...currentArray];
    next[index] = text;
    onChange(field.id, next);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={questionLabelStyle}>
        {labelNode}
        {optionalSuffix}
        {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
      </div>
      {hintId ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginTop: "8px",
          maxWidth: "var(--cam-field-width-full)",
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const isSlotRequired = isPerspectives && i === 0;
          // Each line is named by its visible label (defect 17 of the
          // 2026-10-16 run: the placeholder was its only accessible name).
          const slotId = `${field.id}-slot-${i + 1}`;
          const slotInvalid = hasError && isSlotRequired && !currentArray[0]?.trim();
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label
                htmlFor={slotId}
                style={{
                  minWidth: "115px",
                  fontSize: "var(--cam-answer-size)",
                  fontWeight: 600,
                  color: "var(--cam-text-muted)",
                }}
              >
                {slotPrefix} {i + 1}
                {/* Required unless marked optional, the form's rule: no asterisk. */}
                {!isSlotRequired && (
                  <span style={{ color: "var(--cam-text-muted)", fontWeight: 400, marginLeft: "4px", fontSize: "var(--cam-font-size-3xs)" }}>
                    ({isEn ? "optional" : "facultatif"})
                  </span>
                )}
              </label>
              <input
                id={slotId}
                type="text"
                aria-required={isSlotRequired || undefined}
                aria-invalid={slotInvalid || undefined}
                aria-describedby={slotInvalid && errorId ? errorId : undefined}
                value={currentArray[i] ?? ""}
                onChange={(e) => handleSlotChange(i, e.target.value)}
                onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
                className={`sovereign-text-input ${slotInvalid ? "has-error" : ""}`}
                style={{ flex: 1, minHeight: "38px" }}
                placeholder={
                  isPerspectives
                    ? (isEn ? `Key priority #${i + 1}` : `Priorité stratégique #${i + 1}`)
                    : (isEn ? `Additional difficulty #${i + 1}` : `Difficulté supplémentaire #${i + 1}`)
                }
              />
            </div>
          );
        })}
      </div>
      <VtWizardFieldError id={errorId} message={errorMessage} />
    </div>
  );
}

export function VtWizardField({
  field,
  value,
  onChange,
  sectionId,
  errorMessage,
  inlineExtra,
  data,
  onFieldTouch,
}: {
  field: OnefopField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  sectionId: string;
  errorMessage?: string;
  /** No longer changes anything: it sized the removed Sexe switch. */
  compact?: boolean;
  inlineExtra?: ReactNode;
  /** Full form data — only needed for the VT1_4-VT1_7 cascading admin-area
   * suggestion chips, which read sibling region/department/subdivision
   * values. Every other field type ignores it. */
  data?: FormData;
  onFieldTouch?: (fieldId: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const lockedValue = useContext(VtGeographyLockContext)?.[field.id];
  const labelText = localized(field.label, vtLocale(locale));
  // Plain text (aria) + badge node (display) — every question shows its code.
  const label = questionCodeText(field.paperCode, labelText);
  // The code is shown once per question: not on the fields of a 1.15 / 1.16
  // block (the block heading carries it), and not on a follow-up that shares
  // its parent question's code.
  const paperCodes = useContext(VtPaperCodeContext);
  const parentCode = field.visibility?.dependsOn ? paperCodes?.get(field.visibility.dependsOn) : undefined;
  const sharedCode = useContext(VtSharedCodeContext);
  const repeatsCode =
    VT_BLOCK_PAPER_CODES.has(field.paperCode ?? "") ||
    (!!parentCode && parentCode === field.paperCode) ||
    !!sharedCode?.has(field.id);
  const labelNode = <CodedLabel code={repeatsCode ? null : field.paperCode} text={labelText} />;
  const hint = localized(field.hint, vtLocale(locale));
  // Every one-choice question, the Sexe questions included, is a plain radio
  // group (VtWizardRadioGroup); the two-button switch is gone (owner,
  // 2026-10-10: "make it simple").
  const isYear = isVtYearField(field);
  const isTel = field.type === "tel";
  const hasError = !!errorMessage;
  const { placeholder: hintPlaceholder, tooltip } = vtHintPlacement(field, hint, vtFieldTooltip(field.id, locale));
  // Associates the error message with the control (or its radio/checkbox
  // group) so screen readers announce it on focus, not only once on render.
  const errorId = hasError ? vtFieldErrorId(field.id) : undefined;
  // A hint moved into the tooltip is read there, not twice.
  const hintId = hintPlaceholder ? `${field.id}-hint` : undefined;
  // The error and the hint both describe the control, error first.
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  // Required-ness is said once per section (RequiredQuestionsNote) and on
  // the control itself; only optional questions carry a visible mark.
  const required = !isOptionalField(field);
  const a11yProps = {
    "aria-describedby": describedBy,
    "aria-invalid": hasError || undefined,
    "aria-required": required || undefined,
  };
  const optionalSuffix = <OptionalSuffix field={field} />;

  if (field.type === "radio" && field.options) {
    return (
      <div style={{ marginBottom: 4 }}>
        <div style={questionLabelStyle}>
          {labelNode}
          {optionalSuffix}
          {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
        </div>
        {hintId ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        <VtWizardRadioGroup field={field} value={value} onChange={onChange} inlineExtra={inlineExtra} describedBy={describedBy} invalid={hasError} required={required} />
        <VtWizardFieldError id={errorId} message={errorMessage} />
      </div>
    );
  }

  if (field.type === "checkbox" && field.options) {
    return (
      <div style={{ marginBottom: 4 }}>
        <div style={questionLabelStyle}>
          {labelNode}
          {optionalSuffix}
          {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
        </div>
        {hintId ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        <VtWizardCheckboxGroup field={field} value={value} onChange={onChange} describedBy={describedBy} invalid={hasError} />
        <VtWizardFieldError id={errorId} message={errorMessage} />
      </div>
    );
  }

  if (field.type === "number" && !isYear) {
    return (
      <div style={{ marginBottom: 4 }}>
        <label htmlFor={field.id} style={labelStyle}>
          {labelNode}
          {optionalSuffix}
          {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
        </label>
        {hintId ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        <VtWizardNumberStepper field={field} value={value} onChange={onChange} describedBy={describedBy} invalid={hasError} required={required} />
        <VtWizardFieldError id={errorId} message={errorMessage} />
      </div>
    );
  }

  if (isYear) {
    return (
      <div style={{ marginBottom: 4 }}>
        <label htmlFor={field.id} style={labelStyle}>
          {labelNode}
          {optionalSuffix}
          {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
        </label>
        {hintId ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        {/* Picked from a list, as at registration: no "20", no next year.
            Same closed select as the wizard's other dropdowns. */}
        <div style={{ position: "relative", maxWidth: "var(--cam-field-width-short)" }}>
          <select
            id={field.id}
            {...a11yProps}
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(field.id, e.target.value)}
            onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
            className={`sovereign-select ${hasError ? "has-error" : ""}`}
            style={{
              paddingRight: "var(--cam-space-6)",
              color: value ? "var(--cam-text)" : "var(--cam-text-muted)",
              appearance: "none",
              WebkitAppearance: "none",
              cursor: "pointer",
            }}
          >
            <option value="" disabled hidden>
              {t("vtWizard.select", { default: "Sélectionner…" })}
            </option>
            {yearOptions(value).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              fontSize: "var(--cam-font-size-3xs)",
              color: "var(--cam-text-muted)",
            }}
          >
            ▼
          </span>
        </div>
        <VtWizardFieldError id={errorId} message={errorMessage} />
      </div>
    );
  }

  if (isTel) {
    return (
      <div style={{ marginBottom: 4 }}>
        <label htmlFor={field.id} style={labelStyle}>
          {labelNode}
          {optionalSuffix}
          {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
        </label>
        {hintId ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        <div
          className={`sovereign-text-input ${hasError ? "has-error" : ""}`}
          style={{ display: "flex", alignItems: "center", maxWidth: "var(--cam-field-width-medium)" }}
        >
          <span style={{ color: "var(--cam-text-muted)" }}>
            +237
          </span>
          <div style={{ width: 1, height: 20, backgroundColor: "var(--cam-border)", margin: "0 10px" }} />
          <input
            id={field.id}
            {...a11yProps}
            type="tel"
            maxLength={9}
            placeholder={hintPlaceholder ?? "6XX XX XX XX"}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(field.id, e.target.value.replace(/\D/g, "").slice(0, 9))}
            onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              font: "inherit",
              backgroundColor: "transparent",
              color: "var(--cam-text)",
            }}
          />
        </div>
        <VtWizardFieldError id={errorId} message={errorMessage} />
      </div>
    );
  }

  if (field.id === "VT9_4" || field.id === "VT9_3") {
    return (
      <VtFiveSlotsField
        field={field}
        value={value}
        onChange={onChange}
        onFieldTouch={onFieldTouch}
        labelNode={labelNode}
        optionalSuffix={optionalSuffix}
        tooltip={tooltip}
        hint={hint}
        hintId={hintId}
        errorId={errorId}
        errorMessage={errorMessage}
        hasError={hasError}
        locale={locale}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <div style={{ marginBottom: 4 }}>
        <label htmlFor={field.id} style={labelStyle}>
          {labelNode}
          {optionalSuffix}
          {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
        </label>
        {hintId ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        <textarea
          id={field.id}
          {...a11yProps}
          rows={4}
          placeholder={hintPlaceholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
          onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
          className={`sovereign-text-input ${hasError ? "has-error" : ""}`}
          style={{ minHeight: 112, resize: "vertical" }}
        />
        <VtWizardFieldError id={errorId} message={errorMessage} />
      </div>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <div style={{ marginBottom: 4 }}>
        <label htmlFor={field.id} style={labelStyle}>
          {labelNode}
          {optionalSuffix}
          {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
        </label>
        {hintId ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        <div style={{ position: "relative", maxWidth: "35rem" }}>
          <select
            id={field.id}
            {...a11yProps}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(field.id, e.target.value)}
            onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
            className={`sovereign-select ${hasError ? "has-error" : ""}`}
            style={{
              paddingRight: "var(--cam-space-6)",
              color: value ? "var(--cam-text)" : "var(--cam-text-muted)",
              appearance: "none",
              WebkitAppearance: "none",
              cursor: "pointer",
            }}
          >
            <option value="" disabled hidden>
              {t("vtWizard.select", { default: "Sélectionner…" })}
            </option>
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {localized(opt.label, vtLocale(locale))}
              </option>
            ))}
          </select>
          <span
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              fontSize: "var(--cam-font-size-3xs)",
              color: "var(--cam-text-muted)",
            }}
          >
            ▼
          </span>
        </div>
        <VtWizardFieldError id={errorId} message={errorMessage} />
      </div>
    );
  }

  if (lockedValue !== undefined) {
    // Region/department/subdivision come from the company record; shown
    // read-only but kept in the tab order so they are read out. The note
    // saying where they come from is in the tooltip of the last of the
    // three (VT1_6), not a line on the page (owner, 2026-10-12); it stays
    // the three boxes' description for screen readers.
    const noteId = "vt-geography-locked-note";
    const lockedNote = t("modernJobs.geography.lockedNote");
    return (
      <div style={{ marginBottom: 4 }}>
        <label htmlFor={field.id} style={labelStyle}>
          {labelNode}
          {field.id === "VT1_6" ? <VtWizardInfoBadge tooltip={lockedNote} /> : null}
        </label>
        <input
          id={field.id}
          type="text"
          value={field.id === "VT1_4" ? regionDisplayName(lockedValue, locale) : lockedValue}
          readOnly
          aria-readonly="true"
          aria-describedby={noteId}
          className="sovereign-text-input"
        />
        {field.id === "VT1_6" ? <VtFieldHint id={noteId}>{lockedNote}</VtFieldHint> : null}
      </div>
    );
  }

  // 1.1 Code de la Structure is an administrative code ("A ne pas remplir"
  // on the paper form): shown, pre-filled with the establishment ID, but
  // never editable by the respondent.
  const adminOnly = VT_ADMIN_ONLY_IDS.has(field.id);

  return (
    <div style={{ marginBottom: 4 }}>
      <label htmlFor={field.id} style={labelStyle}>
        {labelNode}
        {optionalSuffix}
        {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
      </label>
      {hintId ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
      <input
        id={field.id}
        {...a11yProps}
        type={field.type === "email" ? "email" : "text"}
        placeholder={hintPlaceholder ?? fallbackPlaceholder(field, locale)}
        value={field.id === "VT1_15_FUNCTION" ? respondentFunctionLabel(value as string, vtLocale(locale)) : ((value as string) ?? "")}
        readOnly={adminOnly}
        aria-readonly={adminOnly || undefined}
        onChange={adminOnly ? undefined : (e) => onChange(field.id, e.target.value)}
        onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
        className={`sovereign-text-input ${hasError ? "has-error" : ""}`}
        style={VT_MEDIUM_WIDTH_IDS.has(field.id) ? { maxWidth: "var(--cam-field-width-medium)" } : undefined}
      />
      {/* The error right under the box it is about, before the suggestions. */}
      <VtWizardFieldError id={errorId} message={errorMessage} />
      <VtWizardAdminSuggestionChips fieldId={field.id} value={value} data={data} onChange={onChange} />
    </div>
  );
}

