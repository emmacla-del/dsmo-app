// src/analytics/helpers/analytics-period.helper.ts

export interface AnalyticsPeriod {
    year?: number;
    /**
     * Alias for `year` used by the domain/facade analytics services
     * (src/analytics/core/analytics-types.ts's AnalyticsFilter). Both are
     * accepted so buildPeriodWhere works for either filter shape — see the
     * fix for the bug where this only checked `year` and silently ignored
     * every surveyYear-based filter, making the year/period selector a
     * no-op across the whole ONEFOP analytics module.
     */
    surveyYear?: number;
    fromQuarter?: string;
    toQuarter?: string;
    startDate?: Date;
    endDate?: Date;
    granularity?: 'month' | 'quarter' | 'semester' | 'year';
}

export interface AnalyticsScope extends AnalyticsPeriod {
    region?: string;
    department?: string;
    subdivision?: string;
}

export function buildPeriodWhere(scope: AnalyticsScope) {
    const where: any = {};

    // Year filtering (coarse) — surveyYear takes precedence since that's
    // the field name the current domain/facade services actually set.
    const year = scope.surveyYear ?? scope.year;
    if (year) {
        where.surveyYear = year;
    }

    // Quarter filtering (precise)
    if (scope.fromQuarter && scope.toQuarter) {
        where.quarterCode = {
            gte: scope.fromQuarter,
            lte: scope.toQuarter,
        };
    }

    // Date range filtering (most precise)
    if (scope.startDate && scope.endDate) {
        where.submissionDate = {
            gte: scope.startDate,
            lte: scope.endDate,
        };
    }

    return where;
}

export function parseQuarter(quarterCode: string): { year: number; quarter: number } {
    const [year, quarterPart] = quarterCode.split('-T');
    return {
        year: parseInt(year),
        quarter: parseInt(quarterPart),
    };
}

export function quarterToDateRange(quarterCode: string): { startDate: Date; endDate: Date } {
    const { year, quarter } = parseQuarter(quarterCode);
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;

    return {
        startDate: new Date(year, startMonth, 1),
        endDate: new Date(year, endMonth + 1, 0), // Last day of last month
    };
}