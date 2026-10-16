import { renderWithProviders, screen, navigationMock, act } from "@/test/render";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import HomeLayout from "./layout";
import { meQueryOptions, myCompanyQueryOptions } from "@/lib/shared-queries";

// Defect 8: a respondent whose registration awaits approval sees one rail
// link, a line saying why, and no "Current campaign" standing in for a value.

const pendingUser = { id: "u1", email: "cfp@example.cm", role: "COMPANY", status: "PENDING_APPROVAL", firstName: "Aline", lastName: "Testeur" };

afterEach(() => localStorage.clear());

test("awaiting approval: one rail link, the reason, no campaign label as a value", async () => {
  localStorage.setItem("camleap.access_token", "test-token");
  renderWithProviders(
    <HomeLayout>
      <p>status page</p>
    </HomeLayout>,
    {
      locale: "en",
      queryData: [
        [meQueryOptions.queryKey, pendingUser],
        [myCompanyQueryOptions.queryKey, { name: "CFP Test", entityType: "VOCATIONAL_TRAINING" }],
      ],
    },
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  const nav = document.querySelector("nav") as HTMLElement;
  const links = [...nav.querySelectorAll("a")];
  assert.deepEqual(links.map((a) => a.getAttribute("href")), ["/home/inscription-en-attente"]);
  assert.equal(links[0].textContent, "Registration status");
  assert.ok(screen.getByText("The other pages open once ONEFOP approves your registration."));
  assert.equal(screen.queryByText("Current campaign"), null);
  assert.ok(navigationMock.replaced.includes("/home/inscription-en-attente"), "still sent to the status page");
});
