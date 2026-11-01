import { test } from "node:test";
import assert from "node:assert/strict";
import { dossierWorkspaceHref, withoutDrawerParams } from "./dossier-workspace-link";

const returnTo = "/admin/dossiers?vue=submissions&queueView=mine&submissionsPage=2";

function parse(href: string) {
  const url = new URL(href, "https://camleap.invalid");
  return { path: url.pathname, query: Object.fromEntries(url.searchParams) };
}

test("Examiner les anomalies and Ouvrir le dossier open the workspace with the queue's way back", () => {
  assert.deepEqual(parse(dossierWorkspaceHref("dossier 1", returnTo)), {
    path: "/admin/dossiers/dossier%201",
    query: { returnTo },
  });
});

test("Examiner les anomalies targets the verification section", () => {
  assert.deepEqual(parse(dossierWorkspaceHref("dossier-1", returnTo, { focusVerify: true })), {
    path: "/admin/dossiers/dossier-1",
    query: { returnTo, focus: "verify" },
  });
});

test("Valider opens the workspace with the same way back and asks for the approval dialog", () => {
  assert.deepEqual(parse(dossierWorkspaceHref("dossier-1", returnTo, { openApprove: true })), {
    path: "/admin/dossiers/dossier-1",
    query: { returnTo, openApprove: "1" },
  });
});

test("someone else's file opens read-only, and an archived one says so", () => {
  assert.deepEqual(parse(dossierWorkspaceHref("dossier-1", returnTo, { readOnly: true, includeArchived: true })).query, {
    returnTo,
    readOnly: "true",
    includeArchived: "true",
  });
});

test("an old drawer bookmark keeps every queue filter and loses only the drawer's state", () => {
  assert.equal(
    withoutDrawerParams("vue=submissions&queueView=mine&preview=dossier-1&previewSection=checks&submissionsPage=2"),
    "vue=submissions&queueView=mine&submissionsPage=2",
  );
  assert.equal(withoutDrawerParams("preview=dossier-1"), "");
  assert.equal(withoutDrawerParams("vue=submissions&queueView=mine"), null);
});
