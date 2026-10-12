import type { OpenCampaign } from "@/lib/api-client";

/**
 * The next closing date to show on the front door, or null when there is
 * nothing truthful to show.
 *
 * "Next closing date" rather than a named campaign's: ONEFOP questionnaires
 * and DSMO declarations do not map one-to-one onto the portal's doors, so
 * attributing a date to one of them would be a guess. The earliest deadline
 * among the open collections is true whichever collection it belongs to.
 *
 * Open-ended collections carry no date and are skipped — they are still open,
 * which the status line says on its own. A value that is not a usable date is
 * skipped too rather than rendered as "Invalid Date": this reads a public
 * endpoint, and the page has to survive whatever it returns.
 *
 * Compared as instants, not as strings: lexicographic order is only right for
 * ISO strings that share a format and offset, which nothing here guarantees.
 */
export function nextCampaignDeadline(
  campaigns: OpenCampaign[] | undefined,
): string | null {
  let earliest: { iso: string; time: number } | null = null;

  for (const campaign of campaigns ?? []) {
    if (!campaign.closesOn) continue;
    const time = new Date(campaign.closesOn).getTime();
    if (Number.isNaN(time)) continue;
    if (!earliest || time < earliest.time) {
      earliest = { iso: campaign.closesOn, time };
    }
  }

  return earliest?.iso ?? null;
}
