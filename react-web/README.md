This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Tests

```bash
npm test                    # every src/**/*.test.ts and src/**/*.test.tsx
npm test -- VtScopeQuiz     # only files whose path contains the filter
```

Node's built-in test runner (`node:test`, `node:assert`) runs everything; there is
no Jest or Vitest. `scripts/run-unit-tests.mjs` finds the files and
`scripts/test-resolve.mjs` resolves `@/...` imports.

- **`*.test.ts`** - pure logic, no DOM. Node strips the types natively.
- **`*.test.tsx`** - component tests with React Testing Library in jsdom. The
  resolver compiles JSX with esbuild and replaces `next/navigation` with
  `src/test/mocks/next-navigation.ts`.

A component test imports `@/test/render` **first** (it installs jsdom before
Testing Library loads) and renders through `renderWithProviders`, which wraps
the component in next-intl (the real `messages/fr.json`, or `{ locale: "en" }`)
and a fresh React Query client:

```tsx
import { renderWithProviders, screen } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaField } from "@/test/schema"; // real public/schemas/onefop.schema.json

test("1.1 is read-only", async () => {
  const { user } = renderWithProviders(<VtWizardField field={schemaField("vocationalTraining", "VT1_1")} ... />, {
    queryData: [[["locations", "structure"], []]], // seed queries: tests never fetch
  });
  assert.equal(screen.getByRole("textbox", { name: /Code de la Structure/ }).getAttribute("aria-readonly"), "true");
});
```

- Query by role and accessible name, and drive the UI with `user` (user-event):
  assert what a respondent sees and what reaches `onChange`, not markup.
- `fetch` rejects in component tests: seed what a component reads with `queryData`.
- A missing translation key fails the test.
- Router calls are recorded in `navigationMock` (`pushed`, `replaced`), exported by `@/test/render`.
- A known bug can be recorded as `test("...", { todo: "why" }, ...)`: it is
  reported but does not fail `npm test`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
