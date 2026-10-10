// The official ONEFOP logo (public/images/onefop_logo.png, 218x214), shown
// where the portal identifies itself: the landing page and the registration
// panel. It replaced a decorative map of Cameroon in the flag's colours
// (owner, 2026-10-10: government sites identify themselves with the official
// mark, not an illustration). The image is never scaled above its native
// size, so callers size the box and the image fits inside it.
export function OfficialLogo({ label, className }: { label: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/onefop_logo.png"
      alt={label}
      width={218}
      height={214}
      className={className}
      style={{ display: "block", width: "100%", height: "auto" }}
    />
  );
}
