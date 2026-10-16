import type { ReactNode } from "react";

// How wide a field's control (and its hint) may grow.
//
// A 9-digit phone number in a 400px box is not a form, it is a box with a
// phone number lost in it: the width of a field is a readability cue about
// what belongs in it, and every field being full width throws that cue away.
// Three steps rather than a free number, so the page has three alignments
// instead of fourteen.
//
//   short  (220px) phone, year, capital, any count
//   medium (280px) NIU, CNPS, registration numbers -- long codes, but codes
//   full          names, addresses, emails, missions, selects, passwords
export type FieldSize = "short" | "medium" | "full";

const SIZE_CLASS: Record<FieldSize, string> = {
  short: "field--short",
  medium: "field--medium",
  full: "",
};

// The single label/field layout for the registration wizard's sections.
//
// Layout lives in CSS (.field in globals.css): ONE column at every width --
// the label above its control, left-aligned, and the hint directly under the
// control. Owner's decision, 2026-10-10: there is no side-by-side layout and
// no right-aligned label column at any width (the @container cam-form rule
// that did that from 560px was removed); do not reintroduce one. Nothing here
// measures anything -- no window.innerWidth, no ResizeObserver.
//
// No required marker (owner, 2026-10-15): every field is required unless
// its label says "(facultatif)", so a red star on most labels repeated what
// the exception already tells. Required-ness stays on the control as
// aria-required, which the caller owns since the control is passed in as
// children; `required` is still accepted so call sites say it out loud.
//
// `hint` renders directly under the input, never between the label and the
// control -- example values belong in the control's own placeholder instead.
//
// Optionality is said in the label, by a muted "(facultatif)" after the
// name (optionalLabel). It used to be a "Facultatif" placeholder in the box,
// but the wizard carries no placeholders or hints any more (owner,
// 2026-10-15), and the label is the one place left that is always read.
export function FormRow({
  htmlFor,
  label,
  optionalLabel,
  hint,
  size = "full",
  labelPrefix,
  labelId,
  gated = false,
  children,
}: {
  // The id of the control this row labels. A row whose label points at
  // nothing is the accessibility bug this component exists to prevent; rows
  // whose control is a group rather than a single element (none today) would
  // pass labelId instead.
  htmlFor?: string;
  label: string;
  required?: boolean;
  // The word for "optional" in the active language; shown after the label
  // in parentheses. Omit on required fields.
  optionalLabel?: string;
  // Only for a status the respondent must read (a department with no
  // arrondissement), never for an example or an explanation.
  hint?: string;
  // There is no per-field error slot. A missing required field is reported
  // once, by the wizard's pinned notice, and only the first such control is
  // marked aria-invalid (the caller owns that, since the control is passed in
  // as children) -- one message rather than "Champ obligatoire" under every
  // row.
  //
  // Caps everything under the label -- the control and its hint together,
  // so the two stay the same width and keep one right edge.
  size?: FieldSize;
  // Decoration before the label text -- the location step's cascade arrow.
  // Decorative only, so the caller is expected to mark it aria-hidden.
  labelPrefix?: ReactNode;
  labelId?: string;
  // True while the field's own precondition is unmet (a cascade select whose
  // parent is still unanswered). Greys the label to match the disabled
  // control, without touching the control's own disabled state.
  gated?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={["field", gated ? "field--gated" : "", SIZE_CLASS[size]].filter(Boolean).join(" ")}>
      <label htmlFor={htmlFor} id={labelId}>
        {labelPrefix}
        {label}
        {optionalLabel && <span className="field-optional-mark"> ({optionalLabel})</span>}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
