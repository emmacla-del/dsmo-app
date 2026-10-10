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
// The required marker is its own element carrying aria-hidden, never appended
// to the label text: a screen reader announcing "Prenom star" is noise, and
// the information it carries is already on the control as aria-required. The
// caller owns that attribute, since the control is passed in as children.
//
// `hint` renders directly under the input, never between the label and the
// control -- example values belong in the control's own placeholder instead.
//
// There is no optional marker. A trailing "(optionnel)" was the second thing
// on every optional label, which pushed those labels onto two lines and made
// the label wrap on a parenthesis rather than on a field name.
// Optionality is said in the control instead, by a "Facultatif" placeholder:
// it is in the box the respondent is deciding whether to fill, and it costs
// the label nothing.
export function FormRow({
  htmlFor,
  label,
  required = false,
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
        {required && (
          <span className="field-required-mark" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
