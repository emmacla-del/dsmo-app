// src/pdf/onefop-puppeteer.service.ts

import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';  // ← plain puppeteer, no chromium
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OnefopPuppeteerService {
    private browser: any = null;
    private helpersRegistered = false;  // ← guard: prevents "Helper already registered" error

    // The browser is launched with --single-process (see initializeBrowser),
    // which can't safely juggle many concurrent pages/tabs — an unbounded
    // burst of preview/submit requests could crash or OOM the one shared
    // Chrome process, taking down every in-flight PDF generation with it.
    // Capping concurrent renders makes a burst queue briefly instead.
    private readonly maxConcurrentRenders = 2;
    private activeRenders = 0;
    private renderQueue: (() => void)[] = [];

    private acquireRenderSlot(): Promise<void> {
        if (this.activeRenders < this.maxConcurrentRenders) {
            this.activeRenders++;
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => this.renderQueue.push(resolve));
    }

    private releaseRenderSlot(): void {
        // Hand the slot directly to the next waiter rather than decrementing
        // then letting it re-increment — avoids a race where a slot freed
        // here is grabbed by a brand-new call before the queued one resumes,
        // which would let activeRenders exceed maxConcurrentRenders.
        const next = this.renderQueue.shift();
        if (next) {
            next();
        } else {
            this.activeRenders--;
        }
    }

    async generate(data: any): Promise<Buffer> {
        await this.acquireRenderSlot();
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
                // ← DEBUG: reasons / skills / training
                dismissalReasons: templateData.dismissalReasons,
                skills: templateData.skills,
                trainingNeeds: templateData.trainingNeeds,
            }, null, 2));

            const html = template(templateData);
            const pdf = await this.htmlToPdf(html, data.formType);
            console.log(`✅ PDF generated successfully (${pdf.length} bytes)`);

            return pdf;

        } catch (error) {
            console.error('❌ PDF generation error:', error);
            throw error;
        } finally {
            this.releaseRenderSlot();
        }
    }

    private prepareDynamicData(data: any): any {
        let logoBase64 = '';
        try {
            const logoPath = path.join(__dirname, 'assets', 'onefop_logo.png');
            logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
        } catch (_) { /* logo missing — header renders without it */ }

        // vocationalTraining.hbs's header shows the national coat of arms
        // (verified against the source PDF's own header), not the ONEFOP
        // logo the other six templates use — the source PDF for the VT
        // questionnaire is issued directly by the Ministry, not ONEFOP as
        // an agency, and its header reflects that. Loaded unconditionally
        // (cheap, same pattern as logoBase64 above) rather than only for
        // formType === 'VOCATIONAL_TRAINING', so this stays a one-line
        // addition if another future template needs the same asset.
        let armoiriesBase64 = '';
        try {
            const armoiriesPath = path.join(__dirname, 'assets', 'armoiries_cameroon.png');
            armoiriesBase64 = `data:image/png;base64,${fs.readFileSync(armoiriesPath).toString('base64')}`;
        } catch (_) { /* armoiries asset missing — header renders without it */ }

        return {
            ...data,
            logoBase64,
            armoiriesBase64,
        };
    }

    private registerHelpers(): void {
        if (this.helpersRegistered) return;  // ← skip if already registered on this instance
        this.helpersRegistered = true;

        Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
        Handlebars.registerHelper('neq', (a: any, b: any) => a !== b);
        Handlebars.registerHelper('or', (a: any, b: any) => a || b);
        Handlebars.registerHelper('and', (a: any, b: any) => a && b);
        Handlebars.registerHelper('add', (a: any, b: any) => (a ?? 0) + (b ?? 0));

        Handlebars.registerHelper('formatCell', (value: any) => {
            if (value === null || value === undefined || value === 0) return '';
            return `<span style="color:#1F3864;font-weight:bold">${value}</span>`;
        });

        // Vocational Training (vocationalTraining.hbs) — its own paper-form
        // replica widgets (digit boxes, Oui/Non circles, tickboxes), styled
        // via that template's own .yesno/.checkbox/.digit-boxes CSS classes.
        // Not used by any of the other six templates.
        Handlebars.registerHelper('yesno', (value: any) => {
            const isYes = value === true;
            const isNo = value === false;
            return new Handlebars.SafeString(
                `<span class="yesno">` +
                `<span class="opt"><span class="circle${isYes ? ' checked' : ''}"></span>Oui / Yes</span>` +
                `<span class="opt"><span class="circle${isNo ? ' checked' : ''}"></span>Non / No</span>` +
                `</span>`
            );
        });

        Handlebars.registerHelper('checkbox', (checked: any) => {
            return new Handlebars.SafeString(`<span class="checkbox${checked ? ' checked' : ''}"></span>`);
        });

        Handlebars.registerHelper('digitBoxes', (value: any, length: any) => {
            const digits = (value === null || value === undefined ? '' : String(value)).replace(/\D/g, '');
            const n = typeof length === 'number' ? length : 0;
            let html = '<span class="digit-boxes">';
            for (let i = 0; i < n; i++) {
                html += `<span class="box">${digits.charAt(i) || ''}</span>`;
            }
            html += '</span>';
            return new Handlebars.SafeString(html);
        });

        Handlebars.registerHelper('inc', (index: any) => (typeof index === 'number' ? index + 1 : index));

        Handlebars.registerHelper('includes', (arr: any, value: any) => Array.isArray(arr) && arr.includes(value));
    }

    private getTemplatePath(formType: string): string {
        return path.join(__dirname, 'templates', 'dynamic', `${formType}.hbs`);
    }

    private async htmlToPdf(html: string, formType?: string): Promise<Buffer> {
        let page: any;
        try {
            if (!this.browser || !this.browser.isConnected()) {
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

            // Only vocationalTraining.hbs's source PDF was verified to
            // print a "Page X sur Y" footer on every page — scoped to that
            // formType rather than added to all seven templates, since the
            // other six haven't been checked against their own source PDFs
            // for this and shouldn't change behavior as a side effect of
            // the VT work.
            const isVocationalTraining = formType === 'VOCATIONAL_TRAINING';

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '15mm',
                    bottom: isVocationalTraining ? '18mm' : '15mm',
                    left: '15mm',
                    right: '15mm',
                },
                ...(isVocationalTraining
                    ? {
                        displayHeaderFooter: true,
                        headerTemplate: '<span></span>',
                        footerTemplate:
                            '<div style="width:100%;font-size:8px;text-align:center;color:#000;">' +
                            'Page <span class="pageNumber"></span> sur <span class="totalPages"></span>' +
                            '</div>',
                    }
                    : {}),
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
        console.log('🌐 Launching bundled Chrome...');

        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote',
            ],
        });

        this.browser.on('disconnected', () => {
            console.warn('⚠️ Browser connection disconnected');
            this.browser = null;
        });
    }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}