// Title + optional description block that opens every section of the
// registration wizard. Replaces the ad-hoc <h2>/<p> pair that each step
// declared inline with its own font sizes, so a change to the step typography
// happens here (and in the .step-header* rules) rather than in six places.
//
// The heading level stays <h2> to match the markup the steps already emitted:
// AuthHeader renders the CAM-LEAP wordmark above, and changing the document
// outline is not part of a layout commit.
export function StepHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="step-header">
      <h2 className="step-header-title">{title}</h2>
      {subtitle && <p className="step-header-subtitle">{subtitle}</p>}
    </div>
  );
}
