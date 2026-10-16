// src/pdf/onefop-puppeteer.service.ts

import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Every real call site passes the camelCase dispatch value
// ('vocationalTraining', matching the .hbs filename and
// MAPPER_ENTITY_TYPE's value — see onefop-submission-pdf.service.ts and
// questionnaires.controller.ts). Accepts the SCREAMING_SNAKE_CASE Prisma
// enum spelling too since it costs nothing — exported as a standalone
// function so the VT-specific footer/margin condition below is directly
// unit-testable without exercising WeasyPrint itself (VT-6 Finding 2).
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
    private helpersRegistered = false;  // ← guard: prevents "Helper already registered" error

    renderHtml(data: any): string {
        this.registerHelpers();

        const templatePath = this.getTemplatePath(data.formType);
        const templateHtml = fs.readFileSync(templatePath, 'utf-8');
        const template = Handlebars.compile(templateHtml);

        const templateData = this.prepareDynamicData(data);
        return template(templateData);
    }

    async generate(data: any): Promise<Buffer> {
        try {
            console.log(`📄 Generating PDF via WeasyPrint for: ${data.formType}`);

            const html = this.renderHtml(data);
            const templateData = this.prepareDynamicData(data);

            const pdf = await this.htmlToPdf(html, data.formType, templateData.lang);
            console.log(`✅ PDF generated successfully via WeasyPrint (${pdf.length} bytes)`);

            return pdf;
        } catch (error) {
            console.error('❌ PDF generation error:', error);
            throw error;
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

    private async htmlToPdf(html: string, formType?: string, locale?: string): Promise<Buffer> {
        const isVocationalTraining = isVocationalTrainingFormType(formType);
        const isEnglish = locale === 'en';
        const footerBanner = isEnglish
            ? 'Official ONEFOP Form · Document generated via the CAM-LEAP platform'
            : 'Formulaire officiel ONEFOP · Document généré via la plateforme CAM-LEAP';
        const pageText = isEnglish
            ? '"Page " counter(page) " of " counter(pages)'
            : `"Page " counter(page) "${isVocationalTraining ? ' sur ' : ' / '}" counter(pages)`;

        const bottomMargin = isVocationalTraining ? '18mm' : '16mm';

        // CSS Paged Media rules natively supported by WeasyPrint
        const pagedMediaCss = `
<style>
@page {
    size: A4;
    margin-top: 15mm;
    margin-bottom: ${bottomMargin};
    margin-left: 15mm;
    margin-right: 15mm;
    @bottom-left {
        content: "${footerBanner}";
        font-size: 7pt;
        color: #555;
        font-family: 'Arial Narrow', Arial, sans-serif;
    }
    @bottom-right {
        content: ${pageText};
        font-size: 7pt;
        color: #555;
        font-family: 'Arial Narrow', Arial, sans-serif;
    }
}
</style>
`;

        const styledHtml = html.includes('</head>')
            ? html.replace('</head>', `${pagedMediaCss}</head>`)
            : `${pagedMediaCss}${html}`;

        try {
            return await this.renderWithWeasyprint(styledHtml);
        } catch (weasyErr: any) {
            console.warn(`⚠️ WeasyPrint execution failed (${weasyErr.message}), falling back to Playwright`);
            return await this.renderWithPlaywright(html);
        }
    }

    private async renderWithPlaywright(html: string): Promise<Buffer> {
        const { chromium } = require('playwright');
        const browser = await chromium.launch({ headless: true });
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'load' });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
            });
            return Buffer.from(pdfBuffer);
        } finally {
            await browser.close();
        }
    }

    private async renderWithWeasyprint(html: string): Promise<Buffer> {
        const isWin = process.platform === 'win32';
        const candidates: Array<{ cmd: string; args: string[] }> = [
            { cmd: 'weasyprint', args: ['-', '-', '--encoding', 'utf-8', '--media-type', 'print'] },
            ...(isWin ? [{ cmd: 'weasyprint.exe', args: ['-', '-', '--encoding', 'utf-8', '--media-type', 'print'] }] : []),
            { cmd: 'python3', args: ['-m', 'weasyprint', '-', '-', '--encoding', 'utf-8', '--media-type', 'print'] },
            { cmd: 'python', args: ['-m', 'weasyprint', '-', '-', '--encoding', 'utf-8', '--media-type', 'print'] },
        ];

        let lastError: Error | null = null;

        for (const { cmd, args } of candidates) {
            try {
                return await new Promise<Buffer>((resolve, reject) => {
                    const proc = spawn(cmd, args);
                    const stdoutChunks: Buffer[] = [];
                    const stderrChunks: Buffer[] = [];

                    proc.stdout.on('data', (d) => stdoutChunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
                    proc.stderr.on('data', (d) => stderrChunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));

                    proc.on('error', (err) => reject(err));
                    proc.stdin.on('error', () => {
                        // Prevent unhandled stream error (write EOF / EPIPE) if child exits prematurely
                    });

                    proc.on('close', (code) => {
                        if (code === 0) {
                            resolve(Buffer.concat(stdoutChunks));
                        } else {
                            const errOutput = Buffer.concat(stderrChunks).toString('utf-8');
                            reject(new Error(`${cmd} exited with code ${code}: ${errOutput}`));
                        }
                    });

                    proc.stdin.write(html);
                    proc.stdin.end();
                });
            } catch (err: any) {
                lastError = err;
                continue;
            }
        }

        throw new Error(
            `WeasyPrint could not be executed. Details: ${lastError?.message}`,
        );
    }
}

export { OnefopPuppeteerService as OnefopPdfService };