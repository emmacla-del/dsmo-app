interface Employee {
    fullName: string;
    gender: string;
    age: number;
    nationality: string;
    diploma?: string;
    function: string;
    seniority: number;
    salaryCategory?: string;
    salary?: number;
}
interface MovementBreakdown {
    cat1_3: number;
    cat4_6: number;
    cat7_9: number;
    cat10_12: number;
    catNonDeclared: number;
}
interface Company {
    name: string;
    parentCompany?: string;
    mainActivity: string;
    secondaryActivity?: string;
    region: string;
    department: string;
    subdivision: string;
    address: string;
    fax?: string;
    taxNumber: string;
    cnpsNumber?: string;
    socialCapital?: number;
    totalEmployees: number;
    menCount?: number;
    womenCount?: number;
    lastYearMenCount?: number;
    lastYearWomenCount?: number;
    lastYearTotal?: number;
    recruitments?: MovementBreakdown;
    promotions?: MovementBreakdown;
    dismissals?: MovementBreakdown;
    retirements?: MovementBreakdown;
    deaths?: MovementBreakdown;
}
interface Qualitative {
    hasTrainingCenter?: boolean;
    recruitmentPlansNext?: boolean;
    camerounisationPlan?: boolean;
    usesTempAgencies?: boolean;
    tempAgencyDetails?: string;
}
export interface ProcessingServiceInfo {
    name: string;
    nameEn?: string | null;
    acronym?: string | null;
    parentName?: string | null;
    parentNameEn?: string | null;
    parentAcronym?: string | null;
}
export interface PdfData {
    trackingNumber: string;
    year: number;
    fillingDate?: string;
    company: Company;
    qualitative?: Qualitative;
    employees: Employee[];
    language?: 'fr' | 'en';
    processingService?: ProcessingServiceInfo;
}
export declare class PdfService {
    private readonly PDFDocument;
    private readonly supabase;
    private readonly bucketName;
    private readonly signedUrlExpirySeconds;
    private coatOfArmsBuffer;
    constructor();
    private loadCoatOfArms;
    private getStoragePath;
    generateDeclarationPdfs(data: PdfData): Promise<{
        urls: string[];
        hashes: string[];
    }>;
    getSignedUrl(trackingNumber: string, year: number, copy: number, expiresInSeconds?: number): Promise<string>;
    pdfExists(trackingNumber: string, year: number, copy: number): Promise<boolean>;
    getPublicUrl(trackingNumber: string, year: number, copy: number): string;
    getFilePath(trackingNumber: string, year: number, copy: number): string;
    private buildPdf;
    private drawWatermark;
    private drawBilingualHeader;
    private drawPartA;
    private drawBottomBlock;
    private drawPartB;
    private drawLegalFooter;
    generateDeclarationPdf(_c: any, _e: any[], _y: number): Promise<Buffer>;
    generateReceipt(_id: string, _name: string, _year: number): Promise<Buffer>;
}
export {};
