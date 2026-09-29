import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import {
    mapEnterpriseData,
    mapCooperativeData,
    mapCtdData,
    mapOngData,
    buildDiplomaCspGroups,
    buildDiplomaGrandTotals,
} from './pdf-data-mapper.service';

describe('PDF Data Mapper - S22Q03 (Option A CSP-Grouped)', () => {
    beforeAll(() => {
        // Register helpers used by the templates
        Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
        Handlebars.registerHelper('neq', (a: any, b: any) => a !== b);
        Handlebars.registerHelper('or', (a: any, b: any) => a || b);
        Handlebars.registerHelper('and', (a: any, b: any) => a && b);
        Handlebars.registerHelper('add', (a: any, b: any) => (a ?? 0) + (b ?? 0));
        Handlebars.registerHelper('formatCell', (value: any) => {
            if (value === null || value === undefined || value === 0) return '';
            return `<span style="color:#1F3864;font-weight:bold">${value}</span>`;
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

        const frDict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pdf', 'i18n', 'fr.json'), 'utf-8'));
        const enDict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pdf', 'i18n', 'en.json'), 'utf-8'));
        function getNested(obj: any, keyPath: string): any {
            return keyPath.split('.').reduce((prev, curr) => (prev && prev[curr] !== undefined ? prev[curr] : undefined), obj);
        }
        Handlebars.registerHelper('t', function (this: any, key: string, options: any) {
            if (!key) return '';
            const root = options?.data?.root || {};
            const lang = root.lang || root.locale || 'fr';
            let val = lang === 'en' ? getNested(enDict, key) : getNested(frDict, key);
            if (val === undefined && lang === 'en') val = getNested(frDict, key);
            if (val === undefined) return new Handlebars.SafeString(key);
            if (typeof val === 'string' && options?.hash) {
                let strVal = val;
                for (const [k, v] of Object.entries(options.hash)) {
                    strVal = strVal.replace(new RegExp(`{{${k}}}`, 'g'), String(v ?? ''));
                }
                return new Handlebars.SafeString(strVal);
            }
            return new Handlebars.SafeString(val);
        });

        const partialsDir = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'partials');
        if (fs.existsSync(partialsDir)) {
            const files = fs.readdirSync(partialsDir);
            for (const file of files) {
                if (file.endsWith('.hbs')) {
                    const name = path.basename(file, '.hbs');
                    const content = fs.readFileSync(path.join(partialsDir, file), 'utf-8');
                    Handlebars.registerPartial(name, content);
                }
            }
        }
    });

    const mock4dFlatData: Record<string, unknown> = {
        S0Q01: 'Jean Dupont',
        surveyYear: 2026,
        // Cadres CEP
        s22q03_cadres_cep_male_15_24: 2,
        s22q03_cadres_cep_male_25_34: 3,
        s22q03_cadres_cep_male_total: 5,
        s22q03_cadres_cep_female_15_24: 1,
        s22q03_cadres_cep_female_total: 1,
        // Cadres subtotal explicitly provided or computed
        s22q03_cadres_total_male_15_24: 2,
        s22q03_cadres_total_male_25_34: 3,
        s22q03_cadres_total_male_total: 5,
        s22q03_cadres_total_female_15_24: 1,
        s22q03_cadres_total_female_total: 1,
        // Foremen BTS
        s22q03_foremen_bts_male_25_34: 4,
        s22q03_foremen_bts_male_total: 4,
        s22q03_foremen_bts_female_25_34: 2,
        s22q03_foremen_bts_female_total: 2,
        // Workers Sans diplôme
        s22q03_workers_sans_diplome_male_35_plus: 7,
        s22q03_workers_sans_diplome_male_total: 7,
    };

    const mockLegacy3dFlatData: Record<string, unknown> = {
        S0Q01: 'Marie Curie',
        surveyYear: 2026,
        s22q03_cep_male_15_24: 4,
        s22q03_cep_male_total: 4,
        s22q03_bac_female_25_34: 6,
        s22q03_bac_female_total: 6,
        s22q03_total_male_15_24: 4,
        s22q03_total_male_total: 4,
        s22q03_total_female_25_34: 6,
        s22q03_total_female_total: 6,
    };

    describe('buildDiplomaCspGroups', () => {
        it('should build 3 CSP groups with 12 diploma rows each', () => {
            const groups = buildDiplomaCspGroups(mock4dFlatData, 's22q03');
            expect(groups).toHaveLength(3);
            expect(groups[0].csp).toBe('cadres');
            expect(groups[1].csp).toBe('foremen');
            expect(groups[2].csp).toBe('workers');

            expect(groups[0].rows).toHaveLength(12);
            expect(groups[0].rows[0].label).toContain('CEP');
            expect(groups[0].rows[0].male.age15_24).toBe(2);
            expect(groups[0].rows[0].male.age25_34).toBe(3);
            expect(groups[0].rows[0].male.total).toBe(5);
            expect(groups[0].rows[0].female.age15_24).toBe(1);
            expect(groups[0].rows[0].total.age15_24).toBe(3); // 2 male + 1 female
            expect(groups[0].rows[0].total.total).toBe(6);

            // Subtotals
            expect(groups[0].totals.label).toContain('CADRES');
            expect(groups[0].totals.male.total).toBe(5);
            expect(groups[0].totals.female.total).toBe(1);
            expect(groups[0].totals.total.total).toBe(6);
        });

        it('should aggregate grand totals across all 3 groups', () => {
            const groups = buildDiplomaCspGroups(mock4dFlatData, 's22q03');
            const grandTotals = buildDiplomaGrandTotals(groups, mock4dFlatData, 's22q03');
            expect(grandTotals.label).toContain('TOTAL');
            // cadres: 5 male, foremen: 4 male, workers: 7 male = 16 male
            expect(grandTotals.male.total).toBe(16);
            // cadres: 1 female, foremen: 2 female, workers: 0 female = 3 female
            expect(grandTotals.female.total).toBe(3);
            // grand total: 16 + 3 = 19
            expect(grandTotals.total.total).toBe(19);
        });
    });

    describe('mapEnterpriseData', () => {
        it('should populate recruitmentsByDiplomaGroups and grandTotals when 4D data is present', () => {
            const mapped = mapEnterpriseData(mock4dFlatData, '2026-Q1');
            expect(mapped.recruitmentsByDiplomaGroups).toBeDefined();
            expect(mapped.recruitmentsByDiplomaGroups).toHaveLength(3);
            expect(mapped.recruitmentsByDiplomaGrandTotals).toBeDefined();
            // Also retains collapsed 3D rows for backward compatibility
            expect(mapped.recruitmentsByDiplomaRows).toBeDefined();
            expect(mapped.recruitmentsByDiplomaRows).toHaveLength(12);
        });

        it('should populate recruitmentsByDiplomaGroups even when only legacy 3D data is present', () => {
            const mapped = mapEnterpriseData(mockLegacy3dFlatData, '2026-Q1');
            expect(mapped.recruitmentsByDiplomaGroups).toBeDefined();
            expect(mapped.recruitmentsByDiplomaGroups).toHaveLength(3);
            expect(mapped.recruitmentsByDiplomaGrandTotals).toBeDefined();
            expect(mapped.recruitmentsByDiplomaRows).toBeDefined();
            expect(mapped.recruitmentsByDiplomaRows).toHaveLength(12);
            expect(mapped.recruitmentsByDiplomaRows[0].male.age15_24).toBe(4);
            // CEP (mapped to workers) should carry the male 15-24 value (4)
            const workersGroup = mapped.recruitmentsByDiplomaGroups!.find((g: any) => g.csp === 'workers');
            expect(workersGroup).toBeDefined();
            expect(workersGroup!.rows[0].male.age15_24).toBe(4);
        });

        it('should populate recruitmentsByDiplomaGroups with Option A on blank/empty form preview', () => {
            const mapped = mapEnterpriseData({}, '2026-Q1');
            expect(mapped.recruitmentsByDiplomaGroups).toBeDefined();
            expect(mapped.recruitmentsByDiplomaGroups).toHaveLength(3);
            expect(mapped.recruitmentsByDiplomaGrandTotals).toBeDefined();
        });
    });

    describe('Template compilation & rendering with Option A', () => {
        const templates = ['enterprise.hbs', 'cooperative.hbs', 'ctd.hbs', 'ong.hbs'];

        templates.forEach((templateName) => {
            it(`should correctly render Option A table in ${templateName} with 4D data`, () => {
                const templatePath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', templateName);
                const templateHtml = fs.readFileSync(templatePath, 'utf-8');
                const compiled = Handlebars.compile(templateHtml);

                let mappedData: any;
                if (templateName === 'enterprise.hbs') {
                    mappedData = mapEnterpriseData(mock4dFlatData, '2026-Q1');
                } else if (templateName === 'cooperative.hbs') {
                    mappedData = mapCooperativeData(mock4dFlatData, '2026-Q1');
                } else if (templateName === 'ctd.hbs') {
                    mappedData = mapCtdData(mock4dFlatData, '2026-Q1');
                } else {
                    mappedData = mapOngData(mock4dFlatData, '2026-Q1');
                }

                const rendered = compiled(mappedData);
                expect(rendered).toContain('Cadres');
                expect(rendered).toContain('Agents de maîtrise');
                expect(rendered).toContain('Ouvriers');
                expect(rendered).toContain('SOUS-TOTAL');
                expect(rendered).toContain('TOTAL GÉNÉRAL');
            });

            it(`should correctly render Option A table in ${templateName} even with legacy 3D data`, () => {
                const templatePath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', templateName);
                const templateHtml = fs.readFileSync(templatePath, 'utf-8');
                const compiled = Handlebars.compile(templateHtml);

                let mappedData: any;
                if (templateName === 'enterprise.hbs') {
                    mappedData = mapEnterpriseData(mockLegacy3dFlatData, '2026-Q1');
                } else if (templateName === 'cooperative.hbs') {
                    mappedData = mapCooperativeData(mockLegacy3dFlatData, '2026-Q1');
                } else if (templateName === 'ctd.hbs') {
                    mappedData = mapCtdData(mockLegacy3dFlatData, '2026-Q1');
                } else {
                    mappedData = mapOngData(mockLegacy3dFlatData, '2026-Q1');
                }

                const rendered = compiled(mappedData);
                // Should render CEP row from 3D data
                expect(rendered).toContain('CEP');
                // Should contain the CSP subheaders inside S22Q03
                expect(rendered).toContain('SOUS-TOTAL CADRES');
                expect(rendered).toContain('TOTAL GÉNÉRAL');
            });
        });
    });

    describe('Localization (FR vs EN)', () => {
        it('should localize enterprise mapped data and banner for English (EN)', () => {
            const mappedEn = mapEnterpriseData(mock4dFlatData, '2026-Q1', 'en');
            expect(mappedEn.officialBannerText).toBe(
                'Official ONEFOP Form · Document generated via the CAM-LEAP platform',
            );
            expect(mappedEn.recruitmentsByDiplomaGroups![0].label).toBe('1. Managers');
            expect(mappedEn.recruitmentsByDiplomaGroups![0].totals.label).toBe('SUBTOTAL MANAGERS');
            expect(mappedEn.recruitmentsByDiplomaGrandTotals!.label).toBe('GRAND TOTAL');

            const templatePath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'enterprise.hbs');
            const templateHtml = fs.readFileSync(templatePath, 'utf-8');
            const compiled = Handlebars.compile(templateHtml);
            const rendered = compiled(mappedEn);

            expect(rendered).toContain('Official ONEFOP Form');
            expect(rendered).toContain('1. Managers');
            expect(rendered).toContain('SUBTOTAL MANAGERS');
            expect(rendered).toContain('GRAND TOTAL');
        });

        it('should localize enterprise mapped data and banner for French (FR)', () => {
            const mappedFr = mapEnterpriseData(mock4dFlatData, '2026-Q1', 'fr');
            expect(mappedFr.officialBannerText).toBe(
                'Formulaire officiel ONEFOP · Document généré via la plateforme CAM-LEAP',
            );
            expect(mappedFr.recruitmentsByDiplomaGroups![0].label).toBe('1. Cadres');
            expect(mappedFr.recruitmentsByDiplomaGroups![0].totals.label).toBe('SOUS-TOTAL CADRES');
            expect(mappedFr.recruitmentsByDiplomaGrandTotals!.label).toBe('TOTAL GÉNÉRAL');

            const templatePath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'enterprise.hbs');
            const templateHtml = fs.readFileSync(templatePath, 'utf-8');
            const compiled = Handlebars.compile(templateHtml);
            const rendered = compiled(mappedFr);

            expect(rendered).toContain('Formulaire officiel ONEFOP');
            expect(rendered).toContain('1. Cadres');
            expect(rendered).toContain('SOUS-TOTAL CADRES');
            expect(rendered).toContain('TOTAL GÉNÉRAL');
        });
    });
});
