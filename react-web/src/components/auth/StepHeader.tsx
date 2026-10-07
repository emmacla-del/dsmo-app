// Title + optional description block that opens every section of the
// registration wizard. Replaces the ad-hoc <h2>/<p> pair that each step
// declared inline with its own font sizes, so a change to the step typography
// happens here (and in the .step-header* rules) rather than in six places.
//
// The title is the page's <h1>. The wizard hides the CAM-LEAP wordmark (and
// renders it as a div, see AuthHeader), so the section's own title is the
// only heading that names the page. Every revealed section stays mounted, but
// the ones not on screen are `hidden` and so out of the accessibility tree:
// one <h1> is exposed at a time.
//
// tabIndex -1 makes it a focus target the wizard moves to on every section
// change (see headingFocusPendingRef in register/page.tsx) without putting it
// in the Tab order.
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
      <h1 className="step-header-title" id={titleId} tabIndex={-1}>
        {title}
      </h1>
      {subtitle && <p className="step-header-subtitle">{subtitle}</p>}
    </div>
  );
}
