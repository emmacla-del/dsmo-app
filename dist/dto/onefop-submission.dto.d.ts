export declare class OnefopSubmissionDto {
    formId: string;
    userId: string;
    entityType: 'enterprise' | 'cooperative' | 'ctd' | 'ong';
    data: Record<string, any>;
    isDraft?: boolean;
    companyId?: string;
}
