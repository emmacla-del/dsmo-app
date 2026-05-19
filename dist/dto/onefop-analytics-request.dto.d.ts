export declare class OnefopAnalyticsRequestDto {
    startDate?: string;
    endDate?: string;
    entityType?: string;
    region?: string;
    department?: string;
    groupBy?: 'month' | 'quarter' | 'year' | 'entityType' | 'region';
}
