import type { ReactNode } from "react";
import { OfficialBand } from "@/components/brand/OfficialBand";

// The sign-in family opens under the official band, like the public site
// (owner, 2026-11-11, option D). The page itself is unchanged.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <OfficialBand />
      {children}
    </>
  );
}
