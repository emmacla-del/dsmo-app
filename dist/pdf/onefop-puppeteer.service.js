"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnefopPuppeteerService = void 0;
const common_1 = require("@nestjs/common");
const puppeteer = require("puppeteer-core");
const Handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
let OnefopPuppeteerService = class OnefopPuppeteerService {
    constructor() {
        this.browser = null;
    }
    async generate(data) {
        try {
            console.log(`📄 Generating PDF for: ${data.formType}`);
            this.registerHelpers();
            const templatePath = this.getTemplatePath(data.formType);
            console.log(`📁 Template path: ${templatePath}`);
            const templateHtml = fs.readFileSync(templatePath, 'utf-8');
            const template = Handlebars.compile(templateHtml);
            const templateData = this.prepareDynamicData(data);
            console.log('🗺️  Template data (S0/S1 sample):');
            console.log(JSON.stringify({
                respondentName: templateData.respondentName,
                cooperativeName: templateData.cooperativeName,
                cooperativeType: templateData.cooperativeType,
                area: templateData.area,
                businessSector: templateData.businessSector,
                yearOfCreation: templateData.yearOfCreation,
                jobApplicationsRows: templateData.jobApplicationsRows?.length,
                recruitmentsByDiplomaRows: templateData.recruitmentsByDiplomaRows?.length,
                internshipsRows: templateData.internshipsRows?.length,
            }, null, 2));
            const html = template(templateData);
            const pdf = await this.htmlToPdf(html);
            console.log(`✅ PDF generated successfully (${pdf.length} bytes)`);
            return pdf;
        }
        catch (error) {
            console.error('❌ PDF generation error:', error);
            throw error;
        }
    }
    prepareDynamicData(data) {
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'assets', 'onefop_logo.png');
            logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
        }
        catch (_) { }
        return {
            ...data,
            logoBase64,
        };
    }
    registerHelpers() {
        Handlebars.registerHelper('eq', (a, b) => a === b);
        Handlebars.registerHelper('neq', (a, b) => a !== b);
        Handlebars.registerHelper('or', (a, b) => a || b);
        Handlebars.registerHelper('and', (a, b) => a && b);
        Handlebars.registerHelper('add', (a, b) => (a ?? 0) + (b ?? 0));
        Handlebars.registerHelper('formatCell', (value) => {
            if (value === null || value === undefined || value === 0)
                return '';
            return `<span style="color:#1F3864;font-weight:bold">${value}</span>`;
        });
    }
    getTemplatePath(formType) {
        return path.join(__dirname, 'templates', 'dynamic', `${formType}.hbs`);
    }
    async htmlToPdf(html) {
        let page;
        try {
            if (!this.browser || this.browser.isConnected === false) {
                await this.initializeBrowser();
            }
            if (!this.browser.isConnected()) {
                console.warn('⚠️ Browser connection lost, reinitializing...');
                this.browser = null;
                await this.initializeBrowser();
            }
            page = await this.browser.newPage();
            await page.setViewport({
                width: 1240,
                height: 1754,
                deviceScaleFactor: 1,
            });
            await page.setContent(html, {
                waitUntil: 'networkidle0',
                timeout: 30000,
            });
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '15mm',
                    bottom: '15mm',
                    left: '15mm',
                    right: '15mm',
                },
            });
            await page.close();
            return Buffer.from(pdf);
        }
        catch (error) {
            if (page) {
                try {
                    await page.close();
                }
                catch (_) { }
            }
            console.error('⚠️ Error during PDF generation:', error.message);
            if (this.browser) {
                try {
                    await this.browser.close();
                }
                catch (_) { }
                this.browser = null;
            }
            throw error;
        }
    }
    async initializeBrowser() {
        const chromePath = this.getChromePath();
        console.log(`🌐 Launching Chrome from: ${chromePath}`);
        this.browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-resources',
                '--disable-extensions',
            ],
        });
        this.browser.on('disconnected', () => {
            console.warn('⚠️ Browser connection disconnected');
            this.browser = null;
        });
    }
    getChromePath() {
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        ];
        for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath))
                return chromePath;
        }
        throw new Error('Google Chrome not found. Please install Chrome.');
    }
    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
};
exports.OnefopPuppeteerService = OnefopPuppeteerService;
exports.OnefopPuppeteerService = OnefopPuppeteerService = __decorate([
    (0, common_1.Injectable)()
], OnefopPuppeteerService);
//# sourceMappingURL=onefop-puppeteer.service.js.map