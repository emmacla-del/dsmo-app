// next/link stands in as a plain anchor for component tests: the real module
// needs the Next app router at runtime, the same reason next-navigation.ts
// exists beside it.
//
// The anchor keeps href and the passed-through attributes, so a test asserts
// on a link the way the browser exposes it — getByRole("link", { name }) and
// its href — rather than on a Next-specific element. Link's own routing props
// have no meaning without a router and are dropped.
/* eslint-disable @typescript-eslint/no-unused-vars -- the routing-only props
   below are named precisely so they can be dropped before `rest` spreads onto
   the anchor. Naming them is the mechanism, not an oversight. */
import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string };
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
};

export default function Link({
  href,
  children,
  // Routing-only props: dropped so they never reach the DOM as unknown
  // attributes, which React would warn about.
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  passHref: _passHref,
  ...rest
}: LinkProps) {
  const resolved = typeof href === "string" ? href : (href?.pathname ?? "");
  return createElement("a", { href: resolved, ...rest }, children);
}
