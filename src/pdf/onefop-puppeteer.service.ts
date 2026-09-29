// src/pdf/onefop-puppeteer.service.ts

import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';  // ← plain puppeteer, no chromium
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

// Every real call site passes the camelCase dispatch value
// ('vocationalTraining', matching the .hbs filename and
// MAPPER_ENTITY_TYPE's value — see onefop-submission-pdf.service.ts and
// questionnaires.controller.ts). Accepts the SCREAMING_SNAKE_CASE Prisma
// enum spelling too since it costs nothing — exported as a standalone
// function so the VT-specific footer/margin condition below is directly
// unit-testable without exercising Puppeteer itself (VT-6 Finding 2).
export function isVocationalTrainingFormType(formType?: string): boolean {
    return formType === 'vocationalTraining' || formType === 'VOCATIONAL_TRAINING';
}

function loadI18nDict(filename: string): Record<string, any> {
    const candidates = [
        path.join(__dirname, 'i18n', filename),
        path.join(__dirname, '..', 'src', 'pdf', 'i18n', filename),
        path.join(process.cwd(), 'src', 'pdf', 'i18n', filename),
        path.join(process.cwd(), 'dist', 'pdf', 'i18n', filename),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            try {
                return JSON.parse(fs.readFileSync(p, 'utf-8'));
            } catch (err) {
                console.error(`❌ Failed to parse ${p}:`, err);
            }
        }
    }
    console.warn(`⚠️ Could not find i18n file ${filename}`);
    return {};
}

function getNestedValue(obj: any, keyPath: string): any {
    if (!obj || !keyPath) return undefined;
    const parts = keyPath.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    return current;
}

const frDict = loadI18nDict('fr.json');
const enDict = loadI18nDict('en.json');

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
            const pdf = await this.htmlToPdf(html, data.formType, templateData.lang);
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

        const lang = data.lang || data.locale || 'fr';

        return {
            ...data,
            lang,
            locale: lang,
            logoBase64,
            armoiriesBase64,
        };
    }

    private registerHelpers(): void {
        if (this.helpersRegistered) return;  // ← skip if already registered on this instance
        this.helpersRegistered = true;

        // Register letterhead partial
        try {
            const letterheadCandidates = [
                path.join(__dirname, 'templates', 'dynamic', 'partials', 'letterhead.hbs'),
                path.join(process.cwd(), 'src', 'pdf', 'templates', 'dynamic', 'partials', 'letterhead.hbs'),
                path.join(process.cwd(), 'dist', 'pdf', 'templates', 'dynamic', 'partials', 'letterhead.hbs'),
            ];
            for (const lp of letterheadCandidates) {
                if (fs.existsSync(lp)) {
                    Handlebars.registerPartial('letterhead', fs.readFileSync(lp, 'utf-8'));
                    break;
                }
            }
        } catch (err) {
            console.error('❌ Failed to register letterhead partial:', err);
        }

        // i18n translation helper: {{t "key"}}
        Handlebars.registerHelper('t', function (this: any, key: string, options: any) {
            if (!key || typeof key !== 'string') return '';
            const root = options?.data?.root || {};
            const lang = root.lang || root.locale || 'fr';
            let val = lang === 'en' ? getNestedValue(enDict, key) : getNestedValue(frDict, key);
            if (val === undefined && lang === 'en') {
                console.warn(`[i18n] Missing translation for "${key}" in en, falling back to fr`);
                val = getNestedValue(frDict, key);
            }
            if (val === undefined) {
                console.warn(`[i18n] Missing translation for key "${key}"`);
                return new Handlebars.SafeString(key);
            }
            if (typeof val === 'string' && options?.hash) {
                let strVal = val;
                for (const [k, v] of Object.entries(options.hash)) {
                    strVal = strVal.replace(new RegExp(`{{${k}}}`, 'g'), String(v ?? ''));
                }
                return new Handlebars.SafeString(strVal);
            }
            return new Handlebars.SafeString(val);
        });

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
        Handlebars.registerHelper('yesno', function (value: any, options: any) {
            const isYes = value === true;
            const isNo = value === false;
            const root = options?.data?.root || {};
            const lang = root.lang || root.locale || 'fr';
            const yesLabel = lang === 'en' ? 'Yes' : 'Oui';
            const noLabel = lang === 'en' ? 'No' : 'Non';
            return new Handlebars.SafeString(
                `<span class="yesno">` +
                `<span class="opt"><span class="circle${isYes ? ' checked' : ''}"></span>${yesLabel}</span>` +
                `<span class="opt"><span class="circle${isNo ? ' checked' : ''}"></span>${noLabel}</span>` +
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

        Handlebars.registerHelper('phoneBoxes', (value: any, length: any) => {
            const n = typeof length === 'number' ? length : 9;
            let digits = (value === null || value === undefined ? '' : String(value)).replace(/\D/g, '');
            if (digits.length === n + 3 && digits.startsWith('237')) {
                digits = digits.slice(3);
            } else if (digits.length === n + 5 && digits.startsWith('00237')) {
                digits = digits.slice(5);
            }
            let html = `<span class="ph-box" data-val="${digits}">`;
            for (let i = 0; i < n; i++) {
                html += `<span class="pd">${digits.charAt(i) || ''}</span>`;
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

    // --single-process Chrome (required in this container's memory-
    // constrained environment — see maxConcurrentRenders' comment above) has
    // a confirmed, reproducible failure on the very first render right after
    // the browser is (re-)launched: "Navigating frame was detached" in
    // production, "Target closed" in a local Windows repro — different
    // messages for the same underlying single-process frame-initialization
    // race, since printToPDF's own architecture doesn't fully expect
    // single-process mode. Confirmed live in production during the React
    // migration's PDF-preview work: the first PDF request after any browser
    // (re-)launch failed with that exact error every time, while every
    // subsequent request on the same already-launched browser succeeded
    // reliably. Removing --single-process would fix this outright but risks
    // reintroducing the OOM/crash concern that flag exists for under
    // concurrent load, which can't be verified against this host's actual
    // memory limits from here — so instead of touching that flag, this
    // retries exactly once, scoped to only the render that itself triggered
    // a fresh launch (a healthy, already-warm browser never retries), which
    // matches the confirmed failure window precisely.
    private async htmlToPdf(html: string, formType?: string, locale?: string): Promise<Buffer> {
        const wasFreshLaunch = !this.browser || !this.browser.isConnected();
        try {
            return await this.renderPdf(html, formType, locale);
        } catch (error) {
            if (!wasFreshLaunch) throw error;
            console.warn(
                '⚠️ PDF render failed on a freshly-launched browser, retrying once:',
                (error as Error).message,
            );
            return this.renderPdf(html, formType, locale);
        }
    }

    private async renderPdf(html: string, formType?: string, locale?: string): Promise<Buffer> {
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
            // the VT work. See isVocationalTrainingFormType above for why
            // this is a function call rather than an inline comparison
            // (VT-6 Finding 2 — the old inline check never matched the
            // real dispatch value).
            const isVocationalTraining = isVocationalTrainingFormType(formType);
            const isEnglish = locale === 'en';
            const footerBanner = isEnglish
                ? 'Official ONEFOP Form &middot; Document generated via the CAM-LEAP platform'
                : 'Formulaire officiel ONEFOP &middot; Document g&eacute;n&eacute;r&eacute; via la plateforme CAM-LEAP';
            const pageText = isEnglish
                ? 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>'
                : `Page <span class="pageNumber"></span> ${isVocationalTraining ? 'sur' : '/'} <span class="totalPages"></span>`;

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '15mm',
                    bottom: isVocationalTraining ? '18mm' : '16mm',
                    left: '15mm',
                    right: '15mm',
                },
                displayHeaderFooter: true,
                headerTemplate: '<span></span>',
                footerTemplate:
                    '<div style="width:100%;font-size:7pt;color:#555;font-family:\'Arial Narrow\',Arial,sans-serif;display:flex;justify-content:space-between;padding:0 15mm;box-sizing:border-box;">' +
                    `<span>${footerBanner}</span>` +
                    `<span>${pageText}</span>` +
                    '</div>',
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
                ...(process.platform !== 'win32' ? ['--single-process'] : []),
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