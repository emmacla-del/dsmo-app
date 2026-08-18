// src/campaign/campaign-period.helper.ts

/**
 * The questionnaire's data-collection period — the calendar quarter,
 * semester, or year a campaign covers (e.g. any QUARTERLY campaign whose
 * startDate falls in Q1 2026 collects for 01/01/2026-31/03/2026, same
 * logic as SEMESTER/ANNUAL). This is what period-based questions
 * (S21Q01 and its siblings — see OnefopFormController.kPeriodBasedQuestionIds
 * on the Flutter side, and the corresponding {{collectionPeriodFr}}/
 * {{collectionPeriodEn}} template vars in src/pdf/templates/dynamic/*.hbs)
 * display, and it is deliberately independent of the campaign's
 * deadline/extendedDeadline — the *submission timeline* (collection start
 * date to collection end date), which can be extended via
 * CampaignService.extendDeadline() without changing what period the
 * collected data itself actually covers.
 */
export interface CollectionPeriod {
    periodStart: Date;
    periodEnd: Date;
}

// Shared by both entry points below so a live campaign (computeCollectionPeriod,
// keyed off its own startDate) and a PDF regenerated from a stored submission's
// quarterCode alone (collectionPeriodFromQuarterCode, no DB row required) always
// agree on the same calendar math.
function calendarPeriodFor(type: string, year: number, quarter: number): CollectionPeriod {
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

export function computeCollectionPeriod(type: string, referenceDate: Date): CollectionPeriod {
    const year = referenceDate.getFullYear();
    const quarter = Math.ceil((referenceDate.getMonth() + 1) / 3); // 1..4
    return calendarPeriodFor(type, year, quarter);
}

// Matches codes minted by CampaignService.generateCampaignCode(), e.g.
// "QUARTERLY_2026_T1_001", "SEMESTER_2026_S1_001", "ANNUAL_2026_AN_001".
const CAMPAIGN_CODE_RE = /^(QUARTERLY|SEMESTER|ANNUAL)_(\d{4})_(?:T([1-4])|S([12])|AN)_\d+$/;
// Legacy/manually-seeded quarterCode shape ("2025-T1"), if one is ever
// encountered on an old round.
const LEGACY_QUARTER_CODE_RE = /^(\d{4})-T([1-4])$/;

export function parseCampaignCode(
    code?: string | null,
): { type: string; year: number; quarter: number } | null {
    if (!code) return null;
    const m = CAMPAIGN_CODE_RE.exec(code);
    if (m) {
        const type = m[1];
        const year = parseInt(m[2], 10);
        // Semester quarter is a stand-in that only needs to land on the right
        // side of calendarPeriodFor's "quarter <= 2" split — S1 -> 1, S2 -> 3.
        const quarter = m[3] ? parseInt(m[3], 10) : m[4] === '1' ? 1 : 3;
        return { type, year, quarter };
    }
    const legacy = LEGACY_QUARTER_CODE_RE.exec(code);
    if (legacy) {
        return { type: 'QUARTERLY', year: parseInt(legacy[1], 10), quarter: parseInt(legacy[2], 10) };
    }
    return null;
}

/**
 * Same data-collection period as computeCollectionPeriod(), but derived
 * purely from the campaign/round's own code string — no DB lookup. Used by
 * PDF generation (see pdf-data-mapper.service.ts), which must still render
 * the correct period for a submission filed under a campaign that has since
 * been closed, edited, or deleted.
 */
export function collectionPeriodFromQuarterCode(quarterCode?: string | null): CollectionPeriod | null {
    const parsed = parseCampaignCode(quarterCode);
    if (!parsed) return null;
    return calendarPeriodFor(parsed.type, parsed.year, parsed.quarter);
}

function fmtDate(d: Date): string {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

// Matches the "dd/MM/yyyy" convention used everywhere else this period is
// displayed (OnefopFormController._fmtCampaignDate, campaign_management_screen.dart,
// company_workspace_dashboard.dart).
export function formatCollectionPeriodFr(period: CollectionPeriod): string {
    return `${fmtDate(period.periodStart)} au ${fmtDate(period.periodEnd)}`;
}

export function formatCollectionPeriodEn(period: CollectionPeriod): string {
    return `${fmtDate(period.periodStart)} to ${fmtDate(period.periodEnd)}`;
}
