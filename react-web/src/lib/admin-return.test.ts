import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDossierReturnTo,
  buildRegistrationReturnTo,
  resolveDossierReturnTo,
  resolveEstablishmentReturnTo,
} from "./admin-return";

test("a Dossiers detail return restores the active view, scoped filters, campaign, and page", () => {
  assert.equal(
    buildDossierReturnTo("vue=completed&completedStatus=REJECTED&completedRegion=Centre&completedPage=4&submissionsStatus=APPROVED&campaignId=c1&unknown=drop"),
    "/admin/dossiers?vue=completed&campaignId=c1&completedStatus=REJECTED&completedRegion=Centre&completedPage=4",
  );
});

test("legacy dossier list filters are converted to scoped return state", () => {
  assert.equal(
    buildDossierReturnTo("vue=completed&status=REJECTED&q=atelier&page=3&includeArchived=true&unrelated=drop"),
    "/admin/dossiers?vue=completed&completedStatus=REJECTED&completedIncludeArchived=true&completedSearch=atelier&completedPage=3",
  );
});

test("an establishment return restores Organisations context and excludes queue-only or unknown filters", () => {
  assert.equal(
    buildRegistrationReturnTo("vue=organisations&organisation=atelier&status=ACTIVE&region=Centre&page=2&assignedToMe=1&duplicates=with&createdBy=u1&unknown=drop"),
    "/admin/inscriptions?vue=organisations&search=atelier&status=ACTIVE&region=Centre&page=2",
  );
  assert.equal(
    buildRegistrationReturnTo("vue=organisations&status=PENDING_APPROVAL&assignedToMe=1"),
    "/admin/inscriptions?vue=organisations",
  );
});

test("detail returns accept only validated local list routes and allowlisted query keys", () => {
  assert.equal(
    resolveDossierReturnTo("/admin/dossiers?vue=submissions&submissionsSearch=atelier&submissionsPage=2&next=https%3A%2F%2Fevil.example"),
    "/admin/dossiers?vue=submissions&submissionsSearch=atelier&submissionsPage=2",
  );
  assert.equal(
    resolveEstablishmentReturnTo("/admin/inscriptions?vue=organisations&region=Centre&next=javascript%3Aalert(1)"),
    "/admin/inscriptions?vue=organisations&region=Centre",
  );
});

test("direct detail visits, external URLs, and unsupported paths use safe fallbacks", () => {
  for (const value of [null, "https://evil.example/admin/dossiers", "//evil.example/admin/dossiers", "javascript:alert(1)", "/admin/users"]) {
    assert.equal(resolveDossierReturnTo(value), "/admin/dossiers");
  }
  for (const value of [null, "https://evil.example/admin/inscriptions?vue=organisations", "//evil.example", "/admin/inscriptions?vue=queue"]) {
    assert.equal(resolveEstablishmentReturnTo(value), "/admin/etablissements");
  }
  assert.equal(resolveEstablishmentReturnTo("/admin/etablissements?next=https://evil.example"), "/admin/etablissements");
});
