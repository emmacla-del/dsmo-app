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
// control. It is kept for what the respondent needs to answer correctly --
// the shape a number takes, where to find it, what the address is used for
// -- never for a sentence that repeats the label.
//
// Optionality is said in the label, by a muted "(facultatif)" after the
// name (optionalLabel), the one place that is always read.
export function FormRow({
  htmlFor,
  label,
  optionalLabel,
  hint,
  hintId,
  error,
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
  // A status the respondent must read (a department with no arrondissement),
  // or the format or source of the answer.
  hint?: string;
  // The hint's id, for the control's aria-describedby (the caller owns the
  // control, so it owns the reference too).
  hintId?: string;
  // An answer in the wrong shape, said under the control once it has been
  // left. A MISSING field is not reported here: the wizard's pinned notice
  // names those once, rather than "Champ obligatoire" under every row.
  error?: ReactNode;
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
      {/* While an error shows, it carries the rule; the hint would say it twice. */}
      {hint && !error && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error}
    </div>
  );
}
