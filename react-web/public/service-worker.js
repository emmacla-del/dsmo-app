/* Cache only the public registration shell and immutable Next.js assets. */
const CACHE_NAME = "camleap-registration-v1";
const REGISTRATION_PATH = /(?:^|\/)register\/?$/;
const STATIC_PREFIX = "/_next/static/";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("camleap-registration-") && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

async function cacheRegistrationPage(path) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin || !REGISTRATION_PATH.test(url.pathname)) return;

  const request = new Request(url.href, { method: "GET", credentials: "same-origin" });
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
}

async function cacheLocale(locale) {
  if (locale !== "fr" && locale !== "en") return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    `${self.location.origin}/__camleap_offline_locale__`,
    new Response(locale, { headers: { "Content-Type": "text/plain; charset=utf-8" } }),
  );
}

async function offlineRegistrationResponse(cache) {
  const localeResponse = await cache.match(`${self.location.origin}/__camleap_offline_locale__`);
  const locale = localeResponse ? await localeResponse.text() : "en";
  const message = locale === "fr"
    ? "Cette page d'inscription n'a pas encore été enregistrée sur cet appareil. Ouvrez-la lorsque vous êtes en ligne, puis réessayez hors connexion."
    : "The registration page has not been saved on this device yet. Open it while online, then try again offline.";
  return new Response(message, {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_REGISTRATION_PAGE" || typeof event.data.path !== "string") return;
  event.waitUntil(
    Promise.all([
      cacheRegistrationPage(event.data.path),
      cacheLocale(event.data.locale),
    ]).catch(() => undefined),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  if (request.mode === "navigate" && REGISTRATION_PATH.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok && response.type === "basic") {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const exact = await cache.match(request);
          if (exact) return exact;
          const canonical = await cache.match(`${url.origin}${url.pathname}`);
          if (canonical) return canonical;
          return offlineRegistrationResponse(cache);
        }),
    );
    return;
  }

  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
