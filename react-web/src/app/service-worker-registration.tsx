"use client";

import { useEffect } from "react";

/** Enables the cached registration page in production and on localhost. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        if (cancelled || !window.location.pathname.replace(/\/$/, "").endsWith("/register")) return;

        const worker = registration.active ?? navigator.serviceWorker.controller;
        worker?.postMessage({
          type: "CACHE_REGISTRATION_PAGE",
          path: window.location.pathname,
        });
      })
      .catch(() => {
        // Online signup remains available if this browser blocks service workers.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
