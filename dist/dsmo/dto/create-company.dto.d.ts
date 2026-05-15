export declare class CreateCompanyDto {
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
}
