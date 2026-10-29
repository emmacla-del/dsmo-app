import assert from "node:assert/strict";
import test from "node:test";

import {
  clearFollowUpQuery,
  clampFollowUpPage,
  followUpHref,
  normalizeFollowUpQuery,
  parseFollowUpUrlState,
  updateFollowUpQuery,
  type FollowUpFilterOptions,
} from "./follow-up-url";

const options: FollowUpFilterOptions = {
  regions: ["Centre", "Littoral"],
  departments: [
    { region: "Centre", name: "Mfoundi" },
    { region: "Littoral", name: "Wouri" },
  ],
  types: ["ONG", "ENTREPRISE"],
  canShowContacts: true,
};

test("follow-up URL restores every namespaced control and keeps campaign context", () => {
  assert.deepEqual(
    parseFollowUpUrlState(
      "vue=followup&campaignId=campaign-1&followupSearch=atelier&followupRegion=Centre&followupDepartment=Mfoundi&followupType=ONG&followupOutcome=CONTACTED&followupPage=3",
      options,
    ),
    {
      search: "atelier",
      region: "Centre",
      department: "Mfoundi",
      type: "ONG",
      outcome: "CONTACTED",
      page: 3,
    },
  );
});

test("follow-up normalization drops unsupported values and incompatible departments", () => {
  assert.equal(
    normalizeFollowUpQuery(
      "vue=followup&campaignId=campaign-1&companyId=company-7&followupSearch=%20%20&followupRegion=Centre&followupDepartment=Wouri&followupType=UNKNOWN&followupOutcome=UNKNOWN&followupPage=0",
      options,
    ),
    "vue=followup&campaignId=campaign-1&companyId=company-7&followupRegion=Centre",
  );
  assert.equal(
    normalizeFollowUpQuery("vue=followup&campaignId=campaign-1&followupRegion=Atlantis&followupDepartment=Mfoundi", options),
    "vue=followup&campaignId=campaign-1",
  );
  assert.equal(
    normalizeFollowUpQuery("vue=followup&followupOutcome=CONTACTED", { ...options, canShowContacts: false }),
    "vue=followup",
  );
});

test("filter changes reset Follow-up pagination while page changes preserve the other filters", () => {
  const current = "vue=followup&campaignId=campaign-1&followupRegion=Centre&followupPage=4&companyId=company-7";
  assert.equal(
    updateFollowUpQuery(current, { department: "Mfoundi" }),
    "vue=followup&campaignId=campaign-1&followupRegion=Centre&companyId=company-7&followupDepartment=Mfoundi",
  );
  const pageQuery = updateFollowUpQuery(current, { page: 2 }, false);
  assert.equal(pageQuery, "vue=followup&campaignId=campaign-1&followupRegion=Centre&followupPage=2&companyId=company-7");
  assert.equal(followUpHref("/admin/dossiers", pageQuery), `/admin/dossiers?${pageQuery}`);
});

test("Clear All removes only Follow-up parameters and page clamping uses the filtered total", () => {
  assert.equal(
    clearFollowUpQuery("vue=followup&campaignId=campaign-1&submissionsRegion=Centre&followupSearch=x&followupPage=2&companyId=company-7"),
    "vue=followup&campaignId=campaign-1&submissionsRegion=Centre&companyId=company-7",
  );
  assert.equal(clampFollowUpPage(4, 31), 3);
  assert.equal(clampFollowUpPage(7, 0), 1);
});
