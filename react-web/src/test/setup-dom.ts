// jsdom environment for component tests (*.test.tsx). Imported first by
// src/test/render.tsx, so it only ever runs in a component-test process:
// node --test gives every test file its own process, and the pure-logic
// *.test.ts files never import it.
import globalJsdom from "global-jsdom";

globalJsdom(undefined, { url: "http://localhost:3000/" });

// Tells React 19 that updates are wrapped in act() (Testing Library does so).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Layout APIs jsdom does not implement. No-ops: nothing is laid out.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
}
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Component tests never reach the network: a component that fetches without
// its data being seeded (renderWithProviders' `queryData`) fails loudly.
globalThis.fetch = ((input: RequestInfo | URL) =>
  Promise.reject(
    new Error(`Network access in a component test: ${String(input)}. Seed the query with renderWithProviders({ queryData }).`),
  )) as typeof fetch;
