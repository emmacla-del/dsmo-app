export declare class OnefopExportDto {
    format: 'csv' | 'excel' | 'json';
    startDate?: string;
    endDate?: string;
    entityType?: string;
    exportType?: 'summary' | 'detailed' | 'raw';
    language?: 'fr' | 'en';
}
