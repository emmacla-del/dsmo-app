import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, with later Tailwind utilities beating earlier ones.
 * This is the helper every component under `src/components/ui/**` expects;
 * it does not replace the `cam-*` class vocabulary, which stays the source
 * of truth for colour and spacing (docs/standards/ui-grammar.md, G1/G14).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
