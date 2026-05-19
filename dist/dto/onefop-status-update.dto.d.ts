export declare class OnefopStatusUpdateDto {
    status: 'submitted' | 'verified' | 'rejected';
    rejectionReason?: string;
    notes?: string;
}
