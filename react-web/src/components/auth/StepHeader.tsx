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
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  // « Étape 4 sur 6 » above the title (canvas, option D, 2026-11-11).
  // aria-hidden: the page's own live region already says the step number,
  // and the title must stay the first thing heard when focus lands on it.
  eyebrow?: string;
  // Lets the surrounding section card point aria-labelledby at this heading,
  // so a screen reader announces which section it has entered.
  titleId?: string;
}) {
  return (
    <div className="step-header">
      {eyebrow && (
        <p className="step-header-eyebrow" aria-hidden="true">
          {eyebrow}
        </p>
      )}
      <h2 className="step-header-title" id={titleId} tabIndex={-1}>
        {title}
      </h2>
      {subtitle && <p className="step-header-subtitle">{subtitle}</p>}
    </div>
  );
}
