"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { isOptionalField } from "@/lib/onefop-validation";

/** next-intl's useLocale() returns a plain string ("fr"/"en"/"fr-FR"...);
 * localized() wants the narrow union. */
function vtLocale(locale: string): "fr" | "en" {
  return locale.startsWith("en") ? "en" : "fr";
}

// Every question label, whatever the control: 15px bold in text colour,
// under the subsection title (18px) and set apart from the typed answer
// (15px regular) by weight. Radio/checkbox questions used to be 16px bold
// and text inputs 15px, so two questions side by side read as two levels.
const labelStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--cam-font-sans)",
  fontSize: "var(--cam-font-size-base)",
  // Bold, not semibold: the question must read apart from the answer under
  // it (15px regular) at a glance (owner, 2026-10-10).
  fontWeight: "var(--cam-font-weight-bold)",
  lineHeight: "var(--cam-line-height-label)",
  color: "var(--cam-text)",
  marginBottom: "var(--cam-space-1)",
};

const questionLabelStyle: CSSProperties = labelStyle;

// The hint ("Ex : DRH", "A ne pas remplir") sits between the question and
// its box, where it is read before answering, as on government forms; under
// the box it was read after the answer, or not at all.
function VtFieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      style={{
        fontSize: "var(--cam-microcopy-size)",
        color: "var(--cam-microcopy-color)",
        lineHeight: "var(--cam-line-height-ui)",
        margin: "0 0 var(--cam-space-2)",
      }}
    >
      {children}
    </p>
  );
}

// Fields whose answer is a short code: a medium box, not a full line.
const VT_MEDIUM_WIDTH_IDS = new Set(["VT1_1", "VT1_3"]);

const errorStyle: CSSProperties = {
  fontSize: 13,
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
        wrapperRef.current?.querySelector("button")?.focus();
      }
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
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
    <span ref={wrapperRef} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}>
      <button
        type="button"
        aria-label={tooltip}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--vt-ink-faint, #7a827f)",
          borderRadius: "50%",
        }}
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
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 6px)",
            left: align === "left" ? 0 : "auto",
            right: align === "right" ? 0 : "auto",
            width: 280,
            maxWidth: "80vw",
            padding: "8px 12px",
            background: "var(--vt-accent-soft, #eaf3ec)",
            border: "1px solid rgba(30,107,58,0.25)",
            borderRadius: 6,
            fontFamily: "var(--vt-font)",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--cam-green-dark)",
            lineHeight: 1.4,
            boxShadow: "0 4px 12px rgba(0,0,0,.12)",
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
 * Cascading Région → Département → Arrondissement → Commune suggestion
 * chips for VT1_4-VT1_7, matching Flutter's VtWizardTextField cascading
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
  const subdiv = (data?.VT1_6 as string | undefined)?.trim();
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
  if (fieldId === "VT1_7") {
    const deptObj = findCameroonDepartment(tree, dept, region);
    if (subdiv) {
      const others = deptObj ? deptObj.subdivisions.map((s) => s.name).filter((s) => s !== subdiv) : [];
      return { header: `Communes (${subdiv})`, items: plain([subdiv, ...others]) };
    }
    if (deptObj) {
      return {
        header: isEn ? "Communes in this department" : "Communes du département",
        items: plain(deptObj.subdivisions.map((s) => s.name)),
      };
    }
    return { header: null, items: [] };
  }
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
    <div style={{ marginTop: 6 }}>
      {header && (
        <div style={{ fontFamily: "var(--cam-font-sans)", fontSize: 11, fontWeight: 600, color: "var(--cam-text-muted)", marginBottom: 4 }}>
          {header}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((item) => {
          const active = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(fieldId, item.value)}
              style={{
                padding: "3px 8px",
                borderRadius: "var(--cam-radius-sm)",
                border: `1px solid ${active ? "var(--cam-green)" : "var(--cam-border)"}`,
                background: active ? "var(--cam-green)" : "#ffffff",
                color: active ? "#ffffff" : "var(--cam-text-muted)",
                fontFamily: "var(--cam-font-sans)",
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function isVtYearField(field: OnefopField): boolean {
  const id = field.id.toUpperCase();
  const fr = (field.label && typeof field.label === "object" ? field.label.fr : String(field.label || "")).toLowerCase();
  return id === "VT1_14" || id.includes("YEAR") || fr.includes("année");
}

export function VtWizardNumberStepper({
  field,
  value,
  onChange,
  compactBox = false,
  describedBy,
  invalid = false,
  required = false,
}: {
  field: OnefopField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
  compactBox?: boolean;
  describedBy?: string;
  invalid?: boolean;
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
      required={required}
    />
  );
}

export function VtWizardInlineCountBox({
  field,
  value,
  onChange,
}: {
  field: OnefopField;
  value: unknown;
  onChange: (fieldId: string, value: unknown) => void;
}) {
  const t = useTranslations();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: "var(--vt-font)", fontWeight: 600, fontSize: 13, color: "var(--vt-ink-soft, #4e5451)" }}>
        {t("vtWizard.number", { default: "Nombre :" })}
      </span>
      <VtWizardNumberStepper field={field} value={value} onChange={onChange} compactBox required={!isOptionalField(field)} />
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
        columns={opts.length > 4 ? 2 : 1}
        describedBy={describedBy}
        invalid={invalid}
      />
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
  const repeatsCode =
    VT_BLOCK_PAPER_CODES.has(field.paperCode ?? "") || (!!parentCode && parentCode === field.paperCode);
  const labelNode = <CodedLabel code={repeatsCode ? null : field.paperCode} text={labelText} />;
  const hint = localized(field.hint, vtLocale(locale));
  // Every one-choice question, the Sexe questions included, is a plain radio
  // group (VtWizardRadioGroup); the two-button switch is gone (owner,
  // 2026-10-10: "make it simple").
  const isYear = isVtYearField(field);
  const isTel = field.type === "tel";
  const hasError = !!errorMessage;
  const tooltip = vtFieldTooltip(field.id, locale);
  // Associates the error message with the control (or its radio/checkbox
  // group) so screen readers announce it on focus, not only once on render.
  const errorId = hasError ? vtFieldErrorId(field.id) : undefined;
  const hintId = hint ? `${field.id}-hint` : undefined;
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
        {hint ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
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
        {hint ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
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
        {hint ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
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
        {hint ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        <input
          id={field.id}
          {...a11yProps}
          type="number"
          maxLength={4}
          placeholder={locale.startsWith("en") ? "YYYY" : "AAAA"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value.slice(0, 4))}
          onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
          className={`sovereign-text-input ${hasError ? "has-error" : ""}`}
          style={{ maxWidth: "var(--cam-field-width-short)" }}
        />
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
        {hint ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
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
            placeholder="6XX XX XX XX"
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

  if (field.type === "textarea") {
    return (
      <div style={{ marginBottom: 4 }}>
        <label htmlFor={field.id} style={labelStyle}>
          {labelNode}
          {optionalSuffix}
          {tooltip ? <VtWizardInfoBadge tooltip={tooltip} /> : null}
        </label>
        {hint ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        <textarea
          id={field.id}
          {...a11yProps}
          rows={4}
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
        {hint ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
        <div style={{ position: "relative", maxWidth: "37.5rem" }}>
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
            <option value="">{t("vtWizard.selectAnOption", { default: "Sélectionner une option" })}</option>
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
              fontSize: 11,
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
    // read-only but kept in the tab order so they are read out. The one
    // explanatory line sits under the last of the three (VT1_6).
    const noteId = "vt-geography-locked-note";
    return (
      <div style={{ marginBottom: 4 }}>
        <label htmlFor={field.id} style={labelStyle}>
          {labelNode}
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
        {field.id === "VT1_6" ? (
          <p
            id={noteId}
            style={{
              fontSize: "var(--cam-microcopy-size)",
              color: "var(--cam-microcopy-color)",
              margin: "var(--cam-microcopy-margin-top) 0 0",
              lineHeight: 1.4,
            }}
          >
            {t("modernJobs.geography.lockedNote")}
          </p>
        ) : null}
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
      {hint ? <VtFieldHint id={hintId}>{hint}</VtFieldHint> : null}
      <input
        id={field.id}
        {...a11yProps}
        type={field.type === "email" ? "email" : "text"}
        placeholder={field.type === "email" ? "exemple@domaine.cm" : undefined}
        value={(value as string) ?? ""}
        readOnly={adminOnly}
        aria-readonly={adminOnly || undefined}
        onChange={adminOnly ? undefined : (e) => onChange(field.id, e.target.value)}
        onBlur={onFieldTouch ? () => onFieldTouch(field.id) : undefined}
        className={`sovereign-text-input ${hasError ? "has-error" : ""}`}
        style={VT_MEDIUM_WIDTH_IDS.has(field.id) ? { maxWidth: "var(--cam-field-width-medium)" } : undefined}
      />
      <VtWizardAdminSuggestionChips fieldId={field.id} value={value} data={data} onChange={onChange} />
      <VtWizardFieldError id={errorId} message={errorMessage} />
    </div>
  );
}

export function VtWizardSignaturesCard() {
  const locale = useLocale();
  const t = useTranslations();
  const isEn = locale.startsWith("en");
  const roles = [
    { fr: "Nom, signature et cachet du Directeur/Promoteur du CFP", en: "Name, signature and stamp of the VTC Director/Promoter" },
    { fr: "Nom, signature et cachet du Délégué Départemental ou Régional", en: "Name, signature and stamp of the Divisional or Regional Delegate" },
    { fr: "Nom, signature et cachet du Secrétaire Technique Régional de l'ONEFOP", en: "Name, signature and stamp of the ONEFOP Regional Technical Secretary" },
  ];
  return (
    <div
      style={{
        marginTop: 24,
        padding: 24,
        background: "#fff",
        border: "1px solid var(--cam-border)",
        borderRadius: "var(--cam-radius-md)",
      }}
    >
      <div style={{ fontFamily: "var(--cam-font-sans)", fontWeight: 700, fontSize: 13, color: "var(--cam-green)", letterSpacing: 0.5, textTransform: "uppercase" }}>
        {t("vtWizard.signaturesApprovals", { default: "Signatures & Approbations" })}
      </div>
      <div style={{ height: 1, background: "var(--cam-border)", margin: "16px 0 20px" }} />
      <div style={{ display: "flex", gap: 20 }}>
        {roles.map((role) => (
          <div
            key={role.fr}
            style={{
              flex: 1,
              padding: 16,
              background: "var(--cam-bg)",
              border: "1px solid var(--cam-border)",
              borderRadius: "var(--cam-radius-sm)",
            }}
          >
            <div style={{ minHeight: 40, fontFamily: "var(--cam-font-sans)", fontWeight: 700, fontSize: 12, color: "var(--cam-text)" }}>
              {isEn ? role.en : role.fr}
            </div>
            <div
              style={{
                marginTop: 12,
                height: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fff",
                border: "1px solid var(--cam-border)",
                borderRadius: "var(--cam-radius-sm)",
                fontSize: 12,
                color: "var(--cam-text-muted)",
              }}
            >
              {t("vtWizard.signatureArea", { default: "Zone de signature" })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

