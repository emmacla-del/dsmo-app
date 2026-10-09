// Test double for "next/navigation", substituted for the real module by
// scripts/test-resolve.mjs (the real hooks need the Next app router).
// Tests read and set the state through `navigationMock`:
//
//   import { navigationMock } from "@/test/render";
//   navigationMock.pathname = "/onefop";      // after renderWithProviders resets it
//   ... click ...
//   assert.deepEqual(navigationMock.pushed, ["/home"]);
//
// renderWithProviders() resets it before every render.

export const navigationMock = {
  pathname: "/",
  searchParams: new URLSearchParams(),
  params: {} as Record<string, string | string[]>,
  /** Every href passed to router.push, in order. */
  pushed: [] as string[],
  /** Every href passed to router.replace, in order. */
  replaced: [] as string[],
  backCalls: 0,
  refreshCalls: 0,
  reset() {
    this.pathname = "/";
    this.searchParams = new URLSearchParams();
    this.params = {};
    this.pushed = [];
    this.replaced = [];
    this.backCalls = 0;
    this.refreshCalls = 0;
  },
};

const router = {
  push: (href: string) => {
    navigationMock.pushed.push(href);
  },
  replace: (href: string) => {
    navigationMock.replaced.push(href);
  },
  back: () => {
    navigationMock.backCalls += 1;
  },
  forward: () => {},
  refresh: () => {
    navigationMock.refreshCalls += 1;
  },
  prefetch: () => {},
};

export function useRouter() {
  return router;
}

export function usePathname(): string {
  return navigationMock.pathname;
}

export function useSearchParams(): URLSearchParams {
  return navigationMock.searchParams;
}

export function useParams(): Record<string, string | string[]> {
  return navigationMock.params;
}

export function useSelectedLayoutSegment(): string | null {
  return null;
}

export function useSelectedLayoutSegments(): string[] {
  return [];
}

export function redirect(href: string): never {
  throw new Error(`redirect(${href}) called in a component test`);
}

export function permanentRedirect(href: string): never {
  throw new Error(`permanentRedirect(${href}) called in a component test`);
}

export function notFound(): never {
  throw new Error("notFound() called in a component test");
}
