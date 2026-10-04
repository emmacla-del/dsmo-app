import type { ReactNode } from "react";

// The single label/field layout for the registration wizard's sections.
//
// Layout lives in CSS (.field, plus the @container rule in globals.css): the
// label and every non-label child are grid items, so at container widths
// >= 560px the label sits in a fixed right-aligned column beside its input,
// and below that it stacks above the input. Nothing here measures anything --
// no window.innerWidth, no ResizeObserver -- which is what keeps the layout
// correct relative to the form's own width rather than the viewport's.
//
// The required marker is its own element carrying aria-hidden, never appended
// to the label text: a screen reader announcing "Prenom star" is noise, and
// the information it carries is already on the control as aria-required. The
// caller owns that attribute, since the control is passed in as children.
//
// `hint` renders under the input, inside the input column, never under the
// label -- example values belong in the control's own placeholder instead.
//
// There is no optional marker. A trailing "(optionnel)" was the second thing
// on every optional label, which pushed those labels onto two lines and made
// the label column size itself to a parenthesis rather than to a field name.
// Optionality is said in the control instead, by a "Facultatif" placeholder:
// it is in the box the respondent is deciding whether to fill, and it costs
// the label column nothing.
export function FormRow({
  htmlFor,
  label,
  required = false,
  hint,
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
    <div className={gated ? "field field--gated" : "field"}>
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
