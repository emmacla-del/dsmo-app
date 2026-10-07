import { CAMEROON_OUTLINE } from "./cameroon-outline";
import styles from "./landing.module.css";

// The landing emblem: the outline of Cameroon filled with the three bands of
// the national flag, green, red and yellow, with the star on the red band.
//
// This is the one place on the landing page where the flag's colours appear.
// The bands are thirds of the outline's bounding box, clipped to the outline.
// One instance per page: the clip path has a fixed id.
const CLIP_ID = "cam-emblem-outline";

export function CameroonEmblem({ label }: { label: string }) {
  const { width, height, path, star } = CAMEROON_OUTLINE;
  const band = width / 3;

  return (
    <svg
      className={styles.emblemMap}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id={CLIP_ID}>
          <path d={path} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${CLIP_ID})`}>
        <rect className={styles.flagGreen} x={0} y={0} width={band} height={height} />
        <rect className={styles.flagRed} x={band} y={0} width={band} height={height} />
        <rect className={styles.flagYellow} x={band * 2} y={0} width={band} height={height} />
      </g>
      <path className={styles.flagYellow} d={star} />
    </svg>
  );
}
