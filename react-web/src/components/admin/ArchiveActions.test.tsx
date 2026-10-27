import { renderWithProviders, screen, userEvent } from "@/test/render";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ArchiveActions } from "./ArchiveActions";

const labels = {
  resourceName: "Registered organisation",
  archiveLabel: "Archive",
  restoreLabel: "Restore",
  confirmTitle: "Archive this record?",
  reasonLabel: "Archive reason",
  cancelLabel: "Cancel",
};

function renderActions(archived: boolean, onArchive: (reason: string) => void = () => {}, onRestore: () => void = () => {}) {
  return renderWithProviders(<ArchiveActions
    {...labels}
    archived={archived}
    canManage
    onArchive={onArchive}
    onRestore={onRestore}
  />);
}

test("P4-22 registration archive requires a reason and submits it", async () => {
  const submitted: string[] = [];
  const onArchive = (reason: string) => submitted.push(reason);
  const user = renderActions(false, onArchive).user;
  await user.click(screen.getByRole("button", { name: "Archive" }));
  assert.equal(screen.getByLabelText(/Archive reason/).getAttribute("required"), "");
  assert.equal((screen.getAllByRole("button", { name: "Archive" })[1] as HTMLButtonElement).disabled, true);
  await user.type(screen.getByLabelText(/Archive reason/), "Duplicate registration");
  await user.click(screen.getAllByRole("button", { name: "Archive" })[1]);
  assert.deepEqual(submitted, ["Duplicate registration"]);
});

test("P4-23 declaration archive uses the same required reason confirmation", async () => {
  const submitted: string[] = [];
  const onArchive = (reason: string) => submitted.push(reason);
  const user = renderActions(false, onArchive).user;
  await user.click(screen.getByRole("button", { name: "Archive" }));
  await user.type(screen.getByLabelText(/Archive reason/), "Duplicate declaration");
  await user.click(screen.getAllByRole("button", { name: "Archive" })[1]);
  assert.deepEqual(submitted, ["Duplicate declaration"]);
});

test("P4-24 archived rows expose Restore and do not expose Archive", async () => {
  let restored = 0;
  const onRestore = () => { restored += 1; };
  const user = renderActions(true, undefined, onRestore).user;
  assert.equal(screen.queryByRole("button", { name: "Archive" }), null);
  await user.click(screen.getByRole("button", { name: "Restore" }));
  assert.equal(restored, 1);
});
