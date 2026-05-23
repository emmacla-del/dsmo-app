export declare class OnefopPuppeteerService {
    private browser;
    private helpersRegistered;
    generate(data: any): Promise<Buffer>;
    private prepareDynamicData;
    private registerHelpers;
    private getTemplatePath;
    private htmlToPdf;
    private initializeBrowser;
    onModuleDestroy(): Promise<void>;
}
