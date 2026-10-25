/**
 * Radix's Select reserves the empty string to clear a value, so a filter's
 * "all" option cannot carry `value=""` the way a native <select> did.
 *
 * These helpers keep that a presentation detail: the UI holds the sentinel,
 * state and query parameters keep the "" the backend has always been sent.
 * Never persist ALL, and never pass it to an API.
 */
export const ALL = "__all";

/** Sentinel → the value the rest of the app uses. */
export const fromAll = (value: string) => (value === ALL ? "" : value);

/** State value → what the Select should show. */
export const toAll = (value: string) => (value === "" ? ALL : value);
