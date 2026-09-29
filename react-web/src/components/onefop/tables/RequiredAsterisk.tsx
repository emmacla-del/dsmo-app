/** Red required mark. Hidden from assistive tech; the control carries aria-required. */
export function RequiredAsterisk() {
  return (
    <span aria-hidden="true" style={{ color: "var(--cam-error, #b3261e)", fontWeight: 700, marginLeft: 2 }}>
      *
    </span>
  );
}
