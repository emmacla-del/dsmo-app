/**
 * Scroll reset for content swaps (section / table changes).
 *
 * When the whole content area is replaced, a *smooth* scroll races the new
 * content's layout (the page height changes mid-scroll, tables mount,
 * inputs autofocus) and the result stutters. Standard apps jump to the top
 * instantly and let the entrance fade carry the motion — that is what this
 * does. It is a no-op when the page is already at or above `top`.
 */
export function resetScroll(top = 0): void {
  if (typeof window === "undefined") return;
  if (window.scrollY > top) {
    window.scrollTo({ top, behavior: "instant" });
  }
}
