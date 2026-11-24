// Title + optional description block that opens every section of the
// registration wizard. Replaces the ad-hoc <h2>/<p> pair that each step
// declared inline with its own font sizes, so a change to the step typography
// happens here (and in the .step-header* rules) rather than in six places.
//
// Section heading used throughout the continuous registration form.
// tabIndex -1 keeps it available as a focus target for review edit links
// without putting it in the normal Tab order.
export function StepHeader({
  title,
  subtitle,
  titleId,
}: {
  title: string;
  subtitle?: string;
  // Lets the surrounding section card point aria-labelledby at this heading,
  // so a screen reader announces which section it has entered.
  titleId?: string;
}) {
  return (
    <div className="step-header">
      <h2 className="step-header-title" id={titleId} tabIndex={-1}>
        {title}
      </h2>
      {subtitle && <p className="step-header-subtitle">{subtitle}</p>}
    </div>
  );
}
