// jsdom environment for component tests (*.test.tsx). Imported first by
// src/test/render.tsx, so it only ever runs in a component-test process:
// node --test gives every test file its own process, and the pure-logic
// *.test.ts files never import it.
import globalJsdom from "global-jsdom";

globalJsdom(undefined, { url: "http://localhost:3000/" });

// Node has its own CustomEvent, so global-jsdom leaves it in place, and jsdom
// refuses to dispatch it ("parameter 1 is not of type 'Event'"). Radix's
// popover and focus scope build theirs from the global, so opening any
// popover in a test threw. Use the window's, which jsdom accepts.
globalThis.CustomEvent = window.CustomEvent as unknown as typeof CustomEvent;

// Tells React 19 that updates are wrapped in act() (Testing Library does so).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Layout APIs jsdom does not implement. No-ops: nothing is laid out.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
}
if (!window.HTMLElement.prototype.scrollTo) {
  window.HTMLElement.prototype.scrollTo = function scrollTo() {};
}
// Radix Popover/Popper measures its trigger with ResizeObserver, which jsdom
// lacks: opening any popover (a filter pill, for one) threw inside act().
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  (window as unknown as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
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

// jsdom parses <dialog> but implements none of its behaviour, so showModal()
// and close() are missing outright. Enough of them is supplied here for a
// component that opens a dialog to be testable at all: the `open` property
// tracks state, and close() fires the `close` event React listens for. The
// real focus trap, Escape handling and inert background come from the
// browser and are not modelled — a test can assert that a dialog opened,
// not that the platform behaved.
if (!window.HTMLDialogElement.prototype.showModal) {
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}
if (!window.HTMLDialogElement.prototype.close) {
  window.HTMLDialogElement.prototype.close = function close(returnValue?: string) {
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new window.Event("close"));
  };
}

// Component tests never reach the network: a component that fetches without
// its data being seeded (renderWithProviders' `queryData`) fails loudly.
globalThis.fetch = ((input: RequestInfo | URL) =>
  Promise.reject(
    new Error(`Network access in a component test: ${String(input)}. Seed the query with renderWithProviders({ queryData }).`),
  )) as typeof fetch;
