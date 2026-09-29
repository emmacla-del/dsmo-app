import { useEffect, useState } from "react";

export function useViewportSize(): number | null {
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setSize(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}
