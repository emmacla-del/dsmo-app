import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDossierReturnTo,
  buildEstablishmentReturnTo,
  resolveDossierReturnTo,
  resolveEstablishmentReturnTo,
} from "./admin-return";

test("a Dossiers detail return restores the active view, scoped filters, campaign, and page", () => {
  assert.equal(
    buildDossierReturnTo("vue=completed&completedStatus=REJECTED&completedRegion=Centre&completedPage=4&submissionsStatus=APPROVED&campaignId=c1&unknown=drop"),
    "/admin/dossiers?vue=submissions&campaignId=c1&submissionsStatus=REJECTED&submissionsRegion=Centre&submissionsIncludeArchived=true&submissionsPage=4",
  );
});

test("legacy dossier list filters are converted to scoped return state", () => {
  assert.equal(
    buildDossierReturnTo("vue=completed&status=REJECTED&q=atelier&page=3&includeArchived=true&unrelated=drop"),
    "/admin/dossiers?vue=submissions&submissionsStatus=REJECTED&submissionsSearch=atelier&submissionsIncludeArchived=true&submissionsPage=3",
  );
});

test("a dossier return preserves the active review queue view", () => {
  assert.equal(
    buildDossierReturnTo("vue=submissions&queueView=unassigned&campaignId=c1"),
    "/admin/dossiers?vue=submissions&queueView=unassigned&campaignId=c1",
  );
});

test("a dossier return round trip keeps view, filters, and page", () => {
  const queue = "vue=submissions&queueView=mine&campaignId=c1&submissionsRegion=Centre&submissionsQuality=warnings&submissionsPage=5";
  const returnTo = buildDossierReturnTo(queue);
  assert.equal(
    resolveDossierReturnTo(returnTo),
    "/admin/dossiers?vue=submissions&queueView=mine&campaignId=c1&submissionsRegion=Centre&submissionsQuality=warnings&submissionsPage=5",
  );
});

test("an establishment return restores register context and excludes registration-only or unknown filters", () => {
  assert.equal(
    buildEstablishmentReturnTo("search=atelier&status=ACTIVE&region=Centre&department=Mfoundi&page=2&createdBy=u1&unknown=drop"),
    "/admin/etablissements?search=atelier&region=Centre&department=Mfoundi&status=ACTIVE&page=2",
  );
  assert.equal(
    buildEstablishmentReturnTo("status=REJECTED&includeArchived=false"),
    "/admin/etablissements",
  );
});

test("detail returns accept only validated local list routes and allowlisted query keys", () => {
  assert.equal(
    resolveDossierReturnTo("/admin/dossiers?vue=submissions&submissionsSearch=atelier&submissionsPage=2&next=https%3A%2F%2Fevil.example"),
    "/admin/dossiers?vue=submissions&submissionsSearch=atelier&submissionsPage=2",
  );
  assert.equal(
    resolveEstablishmentReturnTo("/admin/inscriptions?vue=organisations&status=ACTIVE&search=atelier&region=Centre&page=2"),
    "/admin/etablissements?search=atelier&region=Centre&page=2",
  );
  assert.equal(
    resolveEstablishmentReturnTo("/admin/inscriptions?vue=organisations&status=REJECTED&search=atelier"),
    "/admin/inscriptions?vue=queue&status=REJECTED&search=atelier",
  );
  assert.equal(
    resolveEstablishmentReturnTo("/admin/etablissements?region=Centre&status=SUSPENDED&next=javascript%3Aalert(1)"),
    "/admin/etablissements?region=Centre&status=SUSPENDED",
  );
});

test("direct detail visits, external URLs, and unsupported paths use safe fallbacks", () => {
  for (const value of [null, "https://evil.example/admin/dossiers", "//evil.example/admin/dossiers", "javascript:alert(1)", "/admin/users"]) {
    assert.equal(resolveDossierReturnTo(value), "/admin/dossiers");
  }
  for (const value of [null, "https://evil.example/admin/etablissements", "//evil.example", "/admin/inscriptions?vue=queue"]) {
    assert.equal(resolveEstablishmentReturnTo(value), "/admin/etablissements");
  }
  assert.equal(resolveEstablishmentReturnTo("/admin/etablissements?search=atelier&next=https://evil.example"), "/admin/etablissements?search=atelier");
});
