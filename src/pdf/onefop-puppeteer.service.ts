// src/pdf/onefop-puppeteer.service.ts

import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer-core';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OnefopPuppeteerService {
    private browser: any = null;

    async generate(data: any): Promise<Buffer> {
        try {
            console.log(`📄 Generating PDF for: ${data.formType}`);

            this.registerHelpers();

            const templatePath = this.getTemplatePath(data.formType);
            console.log(`📁 Template path: ${templatePath}`);

            const templateHtml = fs.readFileSync(templatePath, 'utf-8');
            const template = Handlebars.compile(templateHtml);

            const templateData = this.prepareDynamicData(data);

            // ── DEBUG: log what the template actually receives ──────────
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
            // ────────────────────────────────────────────────────────────

            const html = template(templateData);
            const pdf = await this.htmlToPdf(html);
            console.log(`✅ PDF generated successfully (${pdf.length} bytes)`);

            return pdf;

        } catch (error) {
            console.error('❌ PDF generation error:', error);
            throw error;
        }
    }

    /**
     * prepareDynamicData
     *
     * The mapper (mapCooperativeData / mapEnterpriseData …) already builds
     * every array the template needs and names them exactly as the template
     * expects (jobApplicationsRows, recruitmentsPermanentRows, …).
     *
     * All this method needs to do is:
     *   1. Pass everything through with spread.
     *   2. Inject the logo (not available in the mapper).
     *   3. Nothing else — do NOT re-map or rename any key.
     *
     * Previous version was calling tableToRows() / prepareList() on the
     * already-built arrays, receiving `undefined` for every table key, and
     * silently producing empty arrays for the whole PDF.
     */
    private prepareDynamicData(data: any): any {
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'assets', 'onefop_logo.png');
            logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
        } catch (_) { /* logo missing — header renders without it */ }

        return {
            ...data,          // ← pass ALL mapper output straight through
            logoBase64,       // ← only addition this layer makes
        };
    }

    private registerHelpers(): void {
        // Used by every checkbox: {{#if (eq cooperativeType 1)}}☑{{else}}☐{{/if}}
        Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
        Handlebars.registerHelper('neq', (a: any, b: any) => a !== b);
        Handlebars.registerHelper('or', (a: any, b: any) => a || b);
        Handlebars.registerHelper('and', (a: any, b: any) => a && b);
        Handlebars.registerHelper('add', (a: any, b: any) => (a ?? 0) + (b ?? 0));

        // Used by every table cell: {{formatCell male.age15_24}}
        // Returns '' for zero/null (cleaner than '0' in empty cells),
        // but returns the actual value when non-zero.
        Handlebars.registerHelper('formatCell', (value: any) => {
            if (value === null || value === undefined || value === 0) return '';
            return `<span style="color:#1F3864;font-weight:bold">${value}</span>`;
        });
    }

    private getTemplatePath(formType: string): string {
        return path.join(__dirname, 'templates', 'dynamic', `${formType}.hbs`);
    }

    private async htmlToPdf(html: string): Promise<Buffer> {
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

        } catch (error) {
            if (page) {
                try { await page.close(); } catch (_) { /* ignore */ }
            }

            console.error('⚠️ Error during PDF generation:', (error as Error).message);

            if (this.browser) {
                try { await this.browser.close(); } catch (_) { /* ignore */ }
                this.browser = null;
            }

            throw error;
        }
    }

    private async initializeBrowser(): Promise<void> {
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

    private getChromePath(): string {
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        ];

        for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath)) return chromePath;
        }

        throw new Error('Google Chrome not found. Please install Chrome.');
    }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}