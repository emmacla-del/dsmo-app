// The respondent rail's items while a registration awaits approval (defect 8
// of the 2026-10-15 VT run). Until ONEFOP approves it, the /home layout sends
// every page back to the registration status page, and the server refuses a
// pending account's requests. The rail listed every page anyway, so each
// click silently landed back on the status page.
import type { NavItem } from "./role-navigation";

export const REGISTRATION_STATUS_ROUTE = "/home/inscription-en-attente";

const REGISTRATION_STATUS_ITEM: NavItem = {
  slug: "inscription-en-attente",
  labelKey: "homeNav.item.registrationStatus",
  route: REGISTRATION_STATUS_ROUTE,
};

/** The rail's items: the role's own, or only the status page while awaiting approval. */
export function respondentRailItems(items: NavItem[], awaitingApproval: boolean): NavItem[] {
  return awaitingApproval ? [REGISTRATION_STATUS_ITEM] : items;
}
