// Render helper for component tests (*.test.tsx). Import it FIRST in a test
// file: it installs jsdom (./setup-dom) before Testing Library loads.
//
//   import { renderWithProviders, screen } from "@/test/render";
//
// Wraps the component in what the app's root layout provides: next-intl
// (messages/fr.json by default) and a fresh React Query client. next/navigation
// is replaced at module-resolution time (see ./mocks/next-navigation.ts).
import "./setup-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach } from "node:test";
import type { ReactElement, ReactNode } from "react";
import { cleanup, render, type RenderOptions, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { navigationMock } from "./mocks/next-navigation";

export * from "@testing-library/react";
export { userEvent, navigationMock };

const root = process.env.REACT_WEB_ROOT ?? process.cwd();
const messageCache = new Map<string, AbstractIntlMessages>();

/** The app's real messages/<locale>.json. */
export function loadMessages(locale: "fr" | "en" = "fr"): AbstractIntlMessages {
  let messages = messageCache.get(locale);
  if (!messages) {
    messages = JSON.parse(readFileSync(join(root, "messages", `${locale}.json`), "utf-8")) as AbstractIntlMessages;
    messageCache.set(locale, messages);
  }
  return messages;
}

/** A QueryClient for one test: no retries (a failure surfaces at once) and
 * no garbage-collection timer (it would keep the test process alive). */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export interface ProviderOptions {
  locale?: "fr" | "en";
  /** Defaults to the app's messages/<locale>.json. */
  messages?: AbstractIntlMessages;
  queryClient?: QueryClient;
  /** Query results to seed, so components that fetch render without network. */
  queryData?: Array<[QueryKey, unknown]>;
}

export type RenderWithProvidersResult = RenderResult & {
  queryClient: QueryClient;
  user: ReturnType<typeof userEvent.setup>;
};

export function renderWithProviders(
  ui: ReactElement,
  { locale = "fr", messages, queryClient, queryData = [], ...options }: ProviderOptions & Omit<RenderOptions, "wrapper"> = {},
): RenderWithProvidersResult {
  navigationMock.reset();
  const client = queryClient ?? createTestQueryClient();
  for (const [key, data] of queryData) client.setQueryData(key, data);
  const intlMessages = messages ?? loadMessages(locale);

  function Providers({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={intlMessages}
        timeZone="Africa/Douala"
        // A missing or malformed message fails the test instead of rendering
        // the key: messages/*.json are part of what is under test.
        onError={(error) => {
          throw error;
        }}
      >
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }

  // userEvent before render, as Testing Library recommends.
  const user = userEvent.setup();
  const result = render(ui, { wrapper: Providers, ...options });
  return { ...result, queryClient: client, user };
}

// node:test has no global afterEach, so Testing Library cannot unmount on its
// own: registered here, it applies to every test of the importing file.
afterEach(() => {
  cleanup();
});
