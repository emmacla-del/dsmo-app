// Screenshot and computed-typography capture for /admin/dossiers.
//
// This script used to diff the running app against an HTML mockup held
// outside the repository. The mockup comparison is gone: the console's
// design source is docs/standards/ui-grammar.md and src/app/tokens.css,
// not a picture. What remains is evidence capture — screenshots plus the
// computed font and colour facts of the page's key surfaces, so a visual
// change can be stated in numbers rather than argued from a screenshot.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.ADMIN_DOSSIERS_BASE_URL ?? "http://localhost:3000";
const outputDir = resolve(process.env.ADMIN_DOSSIERS_OUTPUT ?? ".visual-check/admin-dossiers");
const typographySelectors = {
  title: ".cam-admin-page-title",
  subtitle: ".cam-admin-page-subtitle",
  tab: ".cam-admin-tab",
  campaignLabel: ".cam-dossier-campaign > span",
  campaignSelect: ".cam-dossier-campaign select",
  kpiLabel: ".cam-dossier-kpi div > span",
  kpiValue: ".cam-dossier-kpi strong",
  sectionHeading: ".cam-dossier-submissions-card h2",
  table: ".cam-dossier-submissions-table table",
  tableHeader: ".cam-dossier-submissions-table th",
  tableCell: ".cam-dossier-submissions-table td",
  completedTable: ".cam-dossier-completed-table table",
  coverageTable: ".cam-dossier-coverage-table table",
  filter: ".cam-dossier-submissions-card select",
  search: ".cam-dossier-submissions-card input",
  badge: '.cam-dossier-submissions-table [data-slot="badge"]',
  footer: ".cam-dossier-view--submissions > div.flex.flex-wrap.items-center.justify-end",
};
async function readTypography(page) {
  return page.evaluate((selectors) => Object.fromEntries(
    Object.entries(selectors).map(([name, selector]) => {
      const element = document.querySelector(selector);
      if (!element) return [name, null];
      const style = getComputedStyle(element);
      return [name, {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
      }];
    }),
  ), typographySelectors);
}
async function verifyFilterDisclosure(page, { active = false, locale = "fr" } = {}) {
  const disclosure = page.locator(".cam-admin-filter-disclosure").first();
  await disclosure.waitFor();
  const summary = disclosure.locator(":scope > summary");
  const metrics = await summary.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
  }));
  if (metrics.height < 40 || metrics.fontSize < 14) {
    throw new Error(`Filter disclosure trigger is too small: ${JSON.stringify(metrics)}.`);
  }
  const expectedLabel = locale === "fr" ? "Plus de filtres" : "More filters";
  if (!(await summary.innerText()).includes(expectedLabel)) {
    throw new Error(`Filter disclosure label is not translated for ${locale}.`);
  }
  const initiallyOpen = await disclosure.evaluate((element) => element.open);
  if (active && !initiallyOpen) throw new Error("An active advanced filter did not open its disclosure.");
  if (!active && initiallyOpen) throw new Error("The disclosure should stay closed when no advanced filter is active.");
  if (!initiallyOpen) {
    await summary.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".cam-admin-filter-disclosure")?.open === true);
  }
  const fieldMetrics = await disclosure.locator(".cam-admin-filter-disclosure-panel label").first().evaluate((label) => {
    const field = label.parentElement?.querySelector("select, input");
    if (!field) return null;
    const style = getComputedStyle(field);
    return {
      labelFontSize: Number.parseFloat(getComputedStyle(label).fontSize),
      fieldFontSize: Number.parseFloat(style.fontSize),
      fieldHeight: field.getBoundingClientRect().height,
    };
  });
  if (!fieldMetrics || fieldMetrics.labelFontSize < 14 || fieldMetrics.fieldFontSize < 14 || fieldMetrics.fieldHeight < 40) {
    throw new Error(`Expanded filter fields are not legible: ${JSON.stringify(fieldMetrics)}.`);
  }
  await summary.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".cam-admin-filter-disclosure")?.open === false);
  if (initiallyOpen) {
    await page.waitForTimeout(150);
    if (await disclosure.evaluate((element) => element.open)) {
      throw new Error("Users could not close the disclosure while advanced filters were active.");
    }
  }
  await summary.evaluate((element) => element.blur());
}
const campaign = {
  id: "fixture-campaign",
  name: "Collecte ONEFOP",
  code: "T4-2026",
  collectionType: "ONEFOP",
  status: "ACTIVE",
  startDate: "2026-10-01T00:00:00.000Z",
  endDate: "2026-12-31T23:59:59.000Z",
  referenceYear: 2026,
  referenceQuarter: 4,
};
const metrics = {
  quota: 20,
  received: 8,
  approved: 5,
  pendingReview: 2,
  correctionRequested: 1,
  onTime: 6,
  late: 2,
  gap: 12,
  quotaRate: 0.4,
  onTimeRate: 0.75,
  registeredStock: 24,
  responseRate: 0.33,
};
const queues = {
  blockingAnomaliesCount: 0,
  pendingNationalVisasCount: 0,
  correctionsUnderReviewCount: 0,
  statisticallyReadyCount: 0,
  totalSubmissionsCount: 0,
  statusCounts: { PENDING_REVIEW: 0, APPROVED: 0, CORRECTION_REQUESTED: 0, REJECTED: 0, SUPERSEDED: 0 },
  countsView: "queue",
  approvedCount: 0,
  regionCounts: [],
  reviewDelay: { thresholdDays: 5, oldestPendingSubmittedAt: null, pendingOverThresholdCount: 0, windowDays: 30, decidedMedianDays: null, decidedCount: 0 },
};
const returns = {
  campaign,
  central: null,
  unassigned: null,
  regions: ["Adamaoua", "Centre", "Est", "Littoral", "Nord"].map((name, index) => ({
    ...metrics,
    regionId: `fixture-region-${index + 1}`,
    name,
    mode: "DEPARTMENT",
    departments: index === 1 ? [{ ...metrics, departmentId: "fixture-department", name: "Mfoundi" }] : [],
  })),
  totals: metrics,
  byEntityType: [],
  untypedRegisteredStock: 0,
};
const adminUser = {
  id: "fixture-admin",
  email: "admin@example.test",
  firstName: "Amina",
  lastName: "Admin",
  role: "SUPER_ADMIN",
  isActive: true,
  emailVerified: true,
  mustChangePassword: false,
  emailNotificationsEnabled: false,
  pushNotificationsEnabled: false,
  weeklyDigestEnabled: false,
  smsNotificationsEnabled: false,
  twoFactorEnabled: false,
  features: { onefopBasicAnalytics: true, onefopBenchmarking: false, onefopHasDraft: false },
};
const readOnlyUser = { ...adminUser, role: "CENTRAL_AGENT" };
let emptyFixture = false;
let errorFixture = false;
let readOnlyFixture = false;

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(({ user }) => {
    localStorage.setItem("camleap.access_token", "visual-fixture-token");
    localStorage.setItem("camleap.cached_user", JSON.stringify(user));
  }, { user: adminUser });
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "fr", url: baseUrl }]);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/api$/, "");
    let body = {};
    if (path.endsWith("/auth/me")) body = readOnlyFixture ? readOnlyUser : adminUser;
    else if (path.endsWith("/admin/pilotage/campaigns/active")) body = [{ ...campaign, periodicity: "QUARTERLY" }];
    else if (path.endsWith(`/admin/pilotage/campaigns/${campaign.id}/returns`)) body = returns;
    else if (path.endsWith("/admin/questionnaires/pilotage/queues")) body = {
      ...queues,
      totalSubmissionsCount: 1,
      statusCounts: { ...queues.statusCounts, PENDING_REVIEW: 1, APPROVED: 1 },
      countsView: url.searchParams.get("view") ?? "queue",
    };
    else if (path.endsWith("/admin/questionnaires")) {
      const view = url.searchParams.get("view") ?? "queue";
      const completed = view === "completed";
      body = {
        items: emptyFixture || errorFixture ? [] : Array.from({ length: completed ? 4 : 5 }, (_, index) => {
          const completedStatuses = ["APPROVED", "SUPERSEDED", "REJECTED", "APPROVED"];
          const queueStatuses = ["PENDING_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUESTED", "APPROVED"];
          return {
            id: `fixture-${completed ? "completed" : "queue"}-${index + 1}`,
            submissionId: `FIXTURE-${String(index + 1).padStart(3, "0")}`,
            projectProgramDetail: { name: `Fixture ${completed ? "completed dossier" : "submission"} ${index + 1}` },
            respondent: { respondentName: `Demo respondent ${index + 1}` },
            region: ["Adamaoua", "Centre", "Est", "Littoral", "Nord"][index],
            department: index === 1 ? "Mfoundi" : null,
            formType: "PROJECT_PROGRAM",
            status: completed ? completedStatuses[index] : queueStatuses[index],
            companyRegistrationStatus: index % 2 === 0 ? "ACTIVE" : "PENDING_APPROVAL",
            campaignName: "Collecte ONEFOP",
            quarterCode: "T4 2026",
            reviewedBy: completed ? "Fixture reviewer" : null,
            reviewedAt: completed ? `2026-10-${19 - index}T06:27:00.000Z` : null,
            submissionDate: `2026-10-${18 - index}T14:32:00.000Z`,
            isLate: index === 2,
            anomalies: index === 2 ? [{ isBlocking: true, status: "OPEN" }] : [],
            updatedAt: "2026-10-19T06:27:00.000Z",
          };
        }),
        total: emptyFixture || errorFixture ? 0 : completed ? 4 : 5,
        countsView: view,
        counts: {},
      };
    }
    else if (path.endsWith("/auth/company-registrations")) body = {
      items: [],
      total: 0,
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: 8,
      counts: { pending: 0, complements: 0, approved: 0, rejected: 0, overdue: 0 },
      countsView: url.searchParams.get("view") ?? "queue",
      overdueDays: 7,
    };
    else if (path.endsWith("/locations/structure") || path.endsWith("/locations")) body = [];
    else if (path.endsWith("/auth/me/notifications/unread-count")) body = { count: 0 };
    else if (path.endsWith("/auth/me/notifications")) body = [];
    await route.fulfill({
      status: errorFixture && path.endsWith("/admin/questionnaires") ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(errorFixture && path.endsWith("/admin/questionnaires") ? { message: "Deterministic visual fixture error" } : body),
    });
  });

  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !errorFixture) errors.push(message.text()); });
  page.on("requestfailed", (request) => errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`));
  await page.goto(`${baseUrl}/admin/dossiers`, { waitUntil: "networkidle" });
  await page.locator("#dossier-view-submissions").waitFor();
  await page.waitForTimeout(1_000);
  for (const section of ["submissions", "completed", "coverage"]) {
    const expectedCount = section === "submissions" ? 1 : 0;
    if (await page.locator(`#dossier-view-${section}`).count() !== expectedCount) {
      throw new Error(`The default view should show only submissions; unexpected section: ${section}`);
    }
  }
  const unsupportedControls = page.getByLabel(/qualité des données|data quality|éligibilité statistique|statistical eligibility/i);
  if (await unsupportedControls.count()) throw new Error("Unsupported derived-field filters are visible.");
  const queueColumnCount = await page.locator(".cam-dossier-submissions-table thead th").count();
  const queueFirstRowCells = await page.locator(".cam-dossier-submissions-table tbody tr").first().locator("td").count();
  if (queueColumnCount !== 10 || queueFirstRowCells !== queueColumnCount) {
    throw new Error(`Expected 10 purpose-driven submission columns; found ${queueColumnCount} headers and ${queueFirstRowCells} row cells.`);
  }
  await verifyFilterDisclosure(page, { locale: "fr" });
  const appBaseline = resolve(outputDir, "app-1440x900.png");
  const appTypography = await readTypography(page);
  await page.screenshot({ path: appBaseline });
  await page.locator(".cam-admin-filter-disclosure > summary").click();
  await page.screenshot({ path: resolve(outputDir, "app-filter-expanded-1440x900.png") });
  await page.locator(".cam-admin-filter-disclosure > summary").click();
  await page.locator(".cam-admin-filter-disclosure > summary").evaluate((element) => element.blur());
  await page.setViewportSize({ width: 1150, height: 900 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(outputDir, "app-1150.png"), fullPage: true });
  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(outputDir, "app-800.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(outputDir, "app-mobile.png"), fullPage: true });
  await page.locator(".cam-admin-filter-disclosure > summary").click();
  const mobileFilterColumns = await page.locator(".cam-admin-filter-disclosure-panel").evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length);
  if (mobileFilterColumns !== 1) throw new Error(`Expanded filters did not collapse to one mobile column: ${mobileFilterColumns}.`);
  await page.screenshot({ path: resolve(outputDir, "app-filter-expanded-mobile.png"), fullPage: true });
  await page.locator(".cam-admin-filter-disclosure > summary").click();
  await page.locator(".cam-admin-filter-disclosure > summary").evaluate((element) => element.blur());
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [view, path, selector] of [
    ["queue", "admin/inscriptions?vue=queue", ".cam-registration-queue-table"],
    ["rejected", "admin/inscriptions?vue=queue&status=REJECTED", ".cam-registration-queue-table"],
    ["register", "admin/etablissements", ".cam-register-table"],
  ]) {
    await page.goto(`${baseUrl}/${path}`, { waitUntil: "networkidle" });
    await page.locator(selector).waitFor();
    await page.screenshot({ path: resolve(outputDir, `app-registrations-${view}-1440x900.png`) });
  }

  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseUrl }]);
  await page.goto(`${baseUrl}/admin/inscriptions?vue=queue`, { waitUntil: "networkidle" });
  await page.locator(".cam-registration-queue-table").waitFor();
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "fr", url: baseUrl }]);
  await page.goto(`${baseUrl}/admin/dossiers?formType=PROJECT_PROGRAM`, { waitUntil: "networkidle" });
  if (!(await page.locator(".cam-dossier-submissions-table thead th").filter({ hasText: "Type" }).locator("button").count())) throw new Error("Dossier type filter is not attached to its column header.");

  await page.goto(`${baseUrl}/admin/dossiers?vue=submissions&submissionsStatus=COMPLETED`, { waitUntil: "networkidle" });
  await page.locator("#dossier-view-submissions").waitFor();
  await page.screenshot({ path: resolve(outputDir, "app-completed-1440x900.png") });

  for (const view of ["coverage"]) {
    await page.goto(`${baseUrl}/admin/dossiers?vue=${view}`, { waitUntil: "networkidle" });
    const target = page.locator(`#dossier-view-${view}`);
    await target.waitFor();
    await page.screenshot({ path: resolve(outputDir, `app-${view}-1440x900.png`) });
    const viewState = await page.evaluate(() => ({
      activeTab: document.querySelector('.cam-admin-tab[aria-current="page"]')?.textContent,
      shownViews: [...document.querySelectorAll(".cam-dossier-view")].map((section) => section.id),
    }));
    if (viewState.shownViews.length !== 1 || viewState.shownViews[0] !== `dossier-view-${view}`) {
      throw new Error(`vue=${view} did not show only its matching dossier section.`);
    }
    if (view === "coverage" && !(await page.locator(".cam-dash-table button[aria-expanded='false']").count())) {
      throw new Error("Coverage fixture did not render its region rows.");
    }
    if (view === "coverage") {
      const search = page.locator(".cam-dossier-coverage-filters input");
      await search.fill("Mfoundi");
      await page.waitForFunction(() => new URLSearchParams(location.search).get("coverageSearch") === "Mfoundi");
      if (await page.locator(".cam-target-dept").count() !== 1) throw new Error("Coverage search did not return the matching department row.");
      await page.locator(".cam-dossier-coverage-filters select").selectOption({ label: "Centre" });
      await page.waitForFunction(() => Boolean(new URLSearchParams(location.search).get("coverageRegion")));
      if (await page.locator(".cam-target-region").count() !== 1 || await page.locator("tfoot").count()) {
        throw new Error("Coverage region filtering did not narrow the live rows and suppress the unfiltered total.");
      }
    }
    const expectedTab = view === "completed" ? "Dossiers terminés" : "Couverture";
    if (!viewState.activeTab?.includes(expectedTab)) throw new Error(`vue=${view} did not select its matching tab.`);
  }

  await page.goto(`${baseUrl}/admin/dossiers?vue=completed&status=APPROVED`, { waitUntil: "networkidle" });
  const legacyCompletedStatus = await page.locator(".cam-dossier-view--completed .cam-admin-views-item[aria-pressed='true']").innerText();
  if (!legacyCompletedStatus.includes("Visés")) throw new Error("Legacy ?status= did not seed the completed section selected by vue.");
  await page.goto(`${baseUrl}/admin/dossiers?vue=completed&includeArchived=false`, { waitUntil: "networkidle" });
  const archiveCheckbox = page.locator(".cam-dossier-view--completed [data-slot='checkbox']");
  if (await archiveCheckbox.getAttribute("aria-checked") !== "false") throw new Error("Legacy includeArchived=false was not applied to completed dossiers.");
  await page.goto(`${baseUrl}/admin/dossiers?vue=submissions&submissionsStatus=PENDING_REVIEW&completedStatus=APPROVED`, { waitUntil: "networkidle" });
  const submissionStatus = await page.locator(".cam-dossier-view--submissions .cam-admin-views-item[aria-pressed='true']").innerText();
  if (!submissionStatus.includes("En instance")) throw new Error("The submissions filter was not restored from its scoped URL parameter.");
  await page.locator(".cam-admin-tab").filter({ hasText: "Dossiers terminés" }).click();
  await page.waitForFunction(() => new URLSearchParams(location.search).get("vue") === "completed");
  let completedStatus = await page.locator(".cam-dossier-view--completed .cam-admin-views-item[aria-pressed='true']").innerText();
  if (!completedStatus.includes("Visés")) throw new Error("The completed filter was not restored when navigating between subpages.");
  await page.locator(".cam-dossier-view--completed .cam-admin-views-item").filter({ hasText: "Rejetés" }).click();
  await page.waitForFunction(() => new URLSearchParams(location.search).get("completedStatus") === "REJECTED");
  const scopedStatusUrl = new URL(page.url());
  if (scopedStatusUrl.searchParams.get("submissionsStatus") !== "PENDING_REVIEW" || scopedStatusUrl.searchParams.has("status")) {
    throw new Error("Changing a completed filter changed submissions state or wrote a legacy generic filter.");
  }
  await page.locator(".cam-admin-tab").filter({ hasText: "Déclarations" }).click();
  await page.waitForFunction(() => new URLSearchParams(location.search).get("vue") === "submissions");
  const restoredSubmissionStatus = await page.locator(".cam-dossier-view--submissions .cam-admin-views-item[aria-pressed='true']").innerText();
  if (!restoredSubmissionStatus.includes("En instance")) throw new Error("Navigating back changed the submissions filter.");

  emptyFixture = true;
  await page.goto(`${baseUrl}/admin/dossiers`, { waitUntil: "networkidle" });
  await page.locator(".cam-dossier-view--submissions .cam-admin-empty").waitFor({ timeout: 10_000 });
  emptyFixture = false;

  errorFixture = true;
  await page.goto(`${baseUrl}/admin/dossiers`, { waitUntil: "networkidle" });
  await page.locator(".cam-dossier-view--submissions [role='alert']").waitFor({ timeout: 15_000 });
  errorFixture = false;

  readOnlyFixture = true;
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#dossier-view-submissions").waitFor();
  if (await page.locator(".cam-dossier-view--submissions .cam-dossier-submissions-table [data-slot='checkbox']").count()) {
    throw new Error("Read-only role received dossier selection controls.");
  }
  if (await page.getByRole("button", { name: /Exporter/ }).count()) throw new Error("Read-only role received export actions.");
  readOnlyFixture = false;

  // Computed type and colour facts for the page's key surfaces. Compare two
  // runs of this file to state a visual change in numbers.
  await import("node:fs/promises").then(({ writeFile }) => writeFile(
    resolve(outputDir, "typography.json"),
    JSON.stringify(appTypography, null, 2),
  ));
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  console.log(`Visual check passed. Screenshots and typography.json: ${outputDir}`);
  console.log(`Baseline screenshot: ${appBaseline}`);
} finally {
  await browser.close();
}
