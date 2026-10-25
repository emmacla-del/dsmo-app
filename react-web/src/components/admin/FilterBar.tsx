import { cn } from "@/lib/utils";

/**
 * The filter row a list screen carries above its table.
 *
 * `repeat(auto-fit, minmax(190px, 1fr))` is the rule `.cam-admin-filters`
 * set, kept deliberately: every control is the same width, the number of
 * columns follows the container, and the row reflows instead of leaving one
 * field orphaned below the others. Per-control widths (`w-56`, `w-48`, …) do
 * not survive a narrow viewport and give a ragged right edge, so controls
 * inside a cell stretch to it — pass `className="w-full"` to a SelectTrigger,
 * which is `w-fit` by default. Input already fills its cell.
 *
 * A control that should keep its natural width, such as a Reset button, goes
 * in a plain <div>: a grid item stretches, an inline-flex child of one does
 * not. The gaps are the 12px / 16px the original row used.
 */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // The two `min-w-0` rules are load-bearing. A grid item's default
        // `min-width: auto` is its content width, so one long option label
        // ("In queue (pending + further information)") on a `whitespace-nowrap`
        // SelectTrigger widened its column and scrolled the page sideways.
        // It takes both depths: each field is itself a `grid`, so relaxing
        // only the cell leaves the Label and the trigger inside it unable to
        // shrink, and they overflow the cell instead of the row. Allowed to
        // shrink, SelectValue's own line-clamp truncates the text.
        "grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] items-end gap-x-4 gap-y-3",
        "[&>*]:min-w-0 [&>*>*]:min-w-0",
        className
      )}
    >
      {children}
    </div>
  );
}
