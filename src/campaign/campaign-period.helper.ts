// src/campaign/campaign-period.helper.ts

/**
 * The questionnaire's data-collection period — the calendar quarter,
 * semester, or year a campaign covers (e.g. any QUARTERLY campaign whose
 * startDate falls in Q1 2026 collects for 01/01/2026-31/03/2026, same
 * logic as SEMESTER/ANNUAL). This is what period-based questions
 * (S21Q01 and its siblings — see OnefopFormController.kPeriodBasedQuestionIds
 * on the Flutter side) display, and it is deliberately independent of the
 * campaign's deadline/extendedDeadline — the *submission timeline*
 * (collection start date to collection end date), which can be extended via
 * CampaignService.extendDeadline() without changing what period the
 * collected data itself actually covers.
 */
export function computeCollectionPeriod(
    type: string,
    referenceDate: Date,
): { periodStart: Date; periodEnd: Date } {
    const year = referenceDate.getFullYear();
    const quarter = Math.ceil((referenceDate.getMonth() + 1) / 3); // 1..4

    if (type === 'ANNUAL') {
        return { periodStart: new Date(year, 0, 1), periodEnd: new Date(year, 11, 31) };
    }
    if (type === 'SEMESTER') {
        const startMonth = quarter <= 2 ? 0 : 6; // Jan or Jul
        return {
            periodStart: new Date(year, startMonth, 1),
            periodEnd: new Date(year, startMonth + 6, 0), // last day of the 6th month
        };
    }
    // QUARTERLY, and any other/unset type — mirrors CampaignService's own
    // buildPeriodSuffix()/generateCampaignCode() fallback to quarterly.
    const startMonth = (quarter - 1) * 3;
    return {
        periodStart: new Date(year, startMonth, 1),
        periodEnd: new Date(year, startMonth + 3, 0), // last day of the 3rd month
    };
}
