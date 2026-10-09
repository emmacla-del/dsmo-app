import { renderWithProviders, screen, navigationMock } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";

// Checks of the component-test harness itself: next/navigation is the mock,
// next-intl serves the real messages, React Query is isolated and offline.

function NavProbe() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <button type="button" onClick={() => router.push(`/next?from=${pathname}&q=${params.get("q") ?? ""}`)}>
      go
    </button>
  );
}

test("next/navigation resolves to the test double: router.push is recorded, not performed", async () => {
  const { user } = renderWithProviders(<NavProbe />);
  await user.click(screen.getByRole("button", { name: "go" }));
  assert.deepEqual(navigationMock.pushed, ["/next?from=/&q="]);
});

test("renderWithProviders resets the navigation state between renders", () => {
  renderWithProviders(<NavProbe />);
  assert.deepEqual(navigationMock.pushed, []);
  assert.equal(navigationMock.pathname, "/");
});

function Translated() {
  const t = useTranslations("onefopUi");
  return <p>{t("optionalSuffix")}</p>;
}

test("next-intl serves the app's French messages by default", () => {
  renderWithProviders(<Translated />);
  assert.ok(screen.getByText("(facultatif)"));
});

test("next-intl serves the English messages when locale is en", () => {
  renderWithProviders(<Translated />, { locale: "en" });
  assert.ok(screen.getByText("(optional)"));
});

function Fetching() {
  const q = useQuery({ queryKey: ["probe"], queryFn: () => fetch("http://localhost:3001/api/probe").then((r) => r.json()) });
  return <p>{q.isError ? `error: ${(q.error as Error).message}` : q.isSuccess ? `data: ${String(q.data)}` : "loading"}</p>;
}

test("seeded query data renders without any request", () => {
  renderWithProviders(<Fetching />, { queryData: [[["probe"], "seeded"]] });
  assert.ok(screen.getByText("data: seeded"));
});

test("an unseeded query never reaches the network: fetch rejects and the query fails at once (retry off)", async () => {
  renderWithProviders(<Fetching />);
  assert.match((await screen.findByText(/^error:/)).textContent ?? "", /Network access in a component test/);
});
