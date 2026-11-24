import { renderWithProviders, screen, navigationMock } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CampaignNonRespondentsResponse, NonRespondentRow } from "@/lib/pilotage-targets";
import { CampaignNonRespondentsTable } from "./CampaignNonRespondentsTable";

function respondent(index: number, regionName = "Littoral", departmentName = "Wouri"): NonRespondentRow {
  return {
    companyId: `company-${index}`,
    name: `Establishment ${index}`,
    establishmentId: `ID-${index}`,
    entityType: "ONG",
    bucket: "department",
    regionId: regionName === "Centre" ? "region-centre" : "region-littoral",
    regionName,
    departmentId: departmentName === "Mfoundi" ? "department-mfoundi" : "department-wouri",
    departmentName,
    contactEmail: `contact${index}@example.cm`,
    contactName: `Contact ${index}`,
    contactPhone: "655000000",
    latestFollowUp: {
      channel: "PHONE",
      outcome: "SENT_CONFIRMED",
      messageLanguage: null,
      createdAt: "2026-10-20T10:00:00.000Z",
      actorName: "Agent",
      actorTitle: null,
    },
    fileState: "NONE",
  };
}

const data: CampaignNonRespondentsResponse = {
  campaign: {
    id: "round-1",
    name: "October round",
    code: "2026-T4",
    collectionType: "ONEFOP",
    status: "ACTIVE",
    startDate: null,
    endDate: null,
    referenceYear: 2026,
    referenceQuarter: 4,
    deadline: null,
  },
  lastReminder: null,
  registered: 40,
  establishments: [
    ...Array.from({ length: 16 }, (_, index) => respondent(index + 1)),
    respondent(17, "Centre", "Mfoundi"),
  ],
};
const territories = [
  { name: "Centre", departments: [{ name: "Mfoundi" }] },
  { name: "Littoral", departments: [{ name: "Wouri" }] },
];

test("follow-up controls, chips and page restore from URL state", () => {
  const savedQuery = "vue=followup&campaignId=round-1&submissionsStatus=APPROVED&followupSearch=Establishment&followupRegion=Littoral&followupDepartment=Wouri&followupType=ONG&followupOutcome=CONTACTED&followupPage=2";
  const result = renderWithProviders(
    <CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />,
    { locale: "en" },
  );
  navigationMock.pathname = "/admin/dossiers";
  navigationMock.searchParams = new URLSearchParams(savedQuery);
  result.rerender(<CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />);

  assert.equal((screen.getByLabelText("Search") as HTMLInputElement).value, "Establishment");
  assert.equal((screen.getByLabelText("Filter by region") as HTMLSelectElement).value, "Littoral");
  assert.equal((screen.getByLabelText("Filter by department") as HTMLSelectElement).value, "Wouri");
  assert.equal((screen.getByLabelText("Filter by type") as HTMLSelectElement).value, "ONG");
  assert.equal((screen.getByLabelText("Follow-up status") as HTMLSelectElement).value, "CONTACTED");
  assert.ok(screen.getByRole("group", { name: "Active filters" }));
  assert.ok(screen.getByText("Page 2 of 2"));
  assert.ok(screen.getByText("Showing 16–16 of 16 establishments"));
  assert.equal(navigationMock.replaced.length, 0);

  // App Router supplies the new search params on Back and Forward. The
  // controls and rows are derived from that URL, so they restore together.
  navigationMock.searchParams = new URLSearchParams("vue=followup&campaignId=round-1&submissionsStatus=APPROVED");
  result.rerender(<CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />);
  assert.equal((screen.getByLabelText("Search") as HTMLInputElement).value, "");
  assert.equal((screen.getByLabelText("Filter by region") as HTMLSelectElement).value, "");
  assert.equal((screen.getByLabelText("Filter by department") as HTMLSelectElement).value, "");
  assert.equal(screen.queryByRole("group", { name: "Active filters" }), null);
  assert.ok(screen.getByText("Establishment 1"));

  navigationMock.searchParams = new URLSearchParams(savedQuery);
  result.rerender(<CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />);
  assert.equal((screen.getByLabelText("Filter by region") as HTMLSelectElement).value, "Littoral");
  assert.equal((screen.getByLabelText("Filter by department") as HTMLSelectElement).value, "Wouri");
  assert.ok(screen.getByText("Page 2 of 2"));
});

test("follow-up pagination labels are translated in French", () => {
  const result = renderWithProviders(
    <CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />,
    { locale: "fr" },
  );
  navigationMock.pathname = "/admin/dossiers";
  navigationMock.searchParams = new URLSearchParams(
    "vue=followup&campaignId=round-1&followupSearch=Establishment&followupRegion=Littoral&followupDepartment=Wouri&followupType=ONG&followupOutcome=CONTACTED&followupPage=2",
  );
  result.rerender(<CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />);

  assert.ok(screen.getByText("Affichage de 16 à 16 sur 16 établissements"));
  assert.ok(screen.getByText("Page 2 sur 2"));
  assert.ok(screen.getByRole("button", { name: "Précédent" }));
  assert.ok(screen.getAllByRole("button", { name: "Suivant" }).length >= 1);
});

test("zero matching follow-up rows keep the empty state and omit pagination text", () => {
  const result = renderWithProviders(
    <CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />,
    { locale: "en" },
  );
  navigationMock.pathname = "/admin/dossiers";
  navigationMock.searchParams = new URLSearchParams("vue=followup&campaignId=round-1&followupSearch=no-match");
  result.rerender(<CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />);

  assert.ok(screen.getAllByText("No establishment matches these filters.").length >= 1);
  assert.equal(screen.queryByText(/Page \d+ of \d+/), null);
  assert.equal(screen.queryByText(/Showing \d+–\d+ of \d+/), null);
});

test("region changes clear an incompatible department and page while keeping parent context", async () => {
  const result = renderWithProviders(
    <CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />,
    { locale: "en" },
  );
  navigationMock.pathname = "/admin/dossiers";
  navigationMock.searchParams = new URLSearchParams(
    "vue=followup&campaignId=round-1&submissionsRegion=Centre&followupRegion=Centre&followupDepartment=Mfoundi&followupPage=2&other=keep",
  );
  result.rerender(<CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />);

  await result.user.selectOptions(screen.getByLabelText("Filter by region"), "Littoral");

  assert.equal(navigationMock.pushed.length, 1);
  const pushed = new URL(navigationMock.pushed[0], "https://local.invalid");
  assert.equal(pushed.pathname, "/admin/dossiers");
  assert.equal(pushed.searchParams.get("campaignId"), "round-1");
  assert.equal(pushed.searchParams.get("submissionsRegion"), "Centre");
  assert.equal(pushed.searchParams.get("other"), "keep");
  assert.equal(pushed.searchParams.get("followupRegion"), "Littoral");
  assert.equal(pushed.searchParams.has("followupDepartment"), false);
  assert.equal(pushed.searchParams.has("followupPage"), false);

  navigationMock.searchParams = pushed.searchParams;
  result.rerender(<CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />);
  assert.equal((screen.getByLabelText("Filter by region") as HTMLSelectElement).value, "Littoral");
  assert.equal((screen.getByLabelText("Filter by department") as HTMLSelectElement).value, "");
  assert.ok(screen.getByText(/16 establishments match these filters\./));

  await result.user.click(screen.getByRole("button", { name: "Clear all filters" }));
  assert.equal(navigationMock.pushed.length, 2);
  const cleared = new URL(navigationMock.pushed[1], "https://local.invalid");
  assert.equal(cleared.searchParams.get("vue"), "followup");
  assert.equal(cleared.searchParams.get("campaignId"), "round-1");
  assert.equal(cleared.searchParams.get("submissionsRegion"), "Centre");
  assert.equal(cleared.searchParams.get("other"), "keep");
  for (const key of ["followupSearch", "followupRegion", "followupDepartment", "followupType", "followupOutcome", "followupPage"]) {
    assert.equal(cleared.searchParams.has(key), false, `${key} should be cleared`);
  }
});

test("follow-up pagination pushes a shareable page and debounced search replaces the current entry", async () => {
  const result = renderWithProviders(
    <CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />,
    { locale: "en" },
  );
  navigationMock.pathname = "/admin/dossiers";
  navigationMock.searchParams = new URLSearchParams("vue=followup&campaignId=round-1&other=keep");
  result.rerender(<CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />);

  await result.user.click(screen.getByRole("button", { name: "Next" }));
  assert.equal(navigationMock.pushed.length, 1);
  const nextPage = new URL(navigationMock.pushed[0], "https://local.invalid");
  assert.equal(nextPage.searchParams.get("followupPage"), "2");
  assert.equal(nextPage.searchParams.get("campaignId"), "round-1");
  assert.equal(nextPage.searchParams.get("other"), "keep");
  navigationMock.searchParams = nextPage.searchParams;
  result.rerender(<CampaignNonRespondentsTable data={data} canShowContacts territories={territories} />);

  await result.user.type(screen.getByLabelText("Search"), "Littoral");
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(navigationMock.pushed.length, 1, "typing should not add navigation entries");
  assert.equal(navigationMock.replaced.length, 1, "debounced search should replace the current entry once");
  const searched = new URL(navigationMock.replaced[0], "https://local.invalid");
  assert.equal(searched.searchParams.get("followupSearch"), "Littoral");
  assert.equal(searched.searchParams.has("followupPage"), false, "a search change resets paging");
  assert.equal(searched.searchParams.get("campaignId"), "round-1");
  assert.equal(searched.searchParams.get("other"), "keep");
});
