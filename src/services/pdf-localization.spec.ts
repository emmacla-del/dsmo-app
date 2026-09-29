import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import {
    mapEnterpriseData,
    mapCooperativeData,
    mapCtdData,
    mapOngData,
    mapAdministrationData,
    mapProjectProgramData,
    mapVocationalTrainingData,
} from './pdf-data-mapper.service';

describe('PDF Localization Purity Tests (Rule 1 & Rule 2)', () => {
    const frDict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pdf', 'i18n', 'fr.json'), 'utf-8'));
    const enDict = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pdf', 'i18n', 'en.json'), 'utf-8'));

    function getNested(obj: any, keyPath: string): any {
        return keyPath.split('.').reduce((prev, curr) => (prev && prev[curr] !== undefined ? prev[curr] : undefined), obj);
    }

    beforeAll(() => {
        Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
        Handlebars.registerHelper('neq', (a: any, b: any) => a !== b);
        Handlebars.registerHelper('or', (a: any, b: any) => a || b);
        Handlebars.registerHelper('and', (a: any, b: any) => a && b);
        Handlebars.registerHelper('add', (a: any, b: any) => (a ?? 0) + (b ?? 0));
        Handlebars.registerHelper('inc', (i: any) => (typeof i === 'number' ? i + 1 : i));
        Handlebars.registerHelper('includes', (arr: any, v: any) => Array.isArray(arr) && arr.includes(v));
        Handlebars.registerHelper('checkbox', (c: any) => (c ? '☑' : '☐'));
        Handlebars.registerHelper('formatCell', (v: any) => (v ? String(v) : ''));
        Handlebars.registerHelper('phoneBoxes', (v: any) => (v ? String(v) : ''));
        Handlebars.registerHelper('digitBoxes', (v: any) => (v ? String(v) : ''));
        Handlebars.registerHelper('yesno', (v: any, options: any) => {
            const root = options?.data?.root || {};
            const lang = root.lang || root.locale || 'fr';
            return v ? (lang === 'en' ? 'Yes' : 'Oui') : (lang === 'en' ? 'No' : 'Non');
        });

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

    const mockFormData = {
        S0Q01: 'John Doe',
        S0Q02: 'Manager',
        S0Q03_TEL1: '677112233',
        S1Q01: 'SARL',
        S1Q02: 'Entity Alpha',
        S1Q05_TEL1: '677112233',
        COOP_S1Q01: 'Coop Alpha',
        CTD_S1Q01: 'Commune/ Council',
        CTD_S1Q01_NAME: 'Commune Alpha',
        ONG_S1Q01: 'ONG Alpha',
        ADMIN_S1Q01: 'Admin Alpha',
        PP_S1Q01: 'Projet',
        PP_S1Q02: 'Project Alpha',
        VT1_2: 'CFP Alpha',
        VT1_15_NAME: 'Director Alpha',
        s22q03_cadres_cep_male_15_24: '2',
    };

    const entities: {
        name: string;
        template: string;
        mapper: (data: any, period: string, locale?: 'fr' | 'en') => any;
    }[] = [
        { name: 'enterprise', template: 'enterprise.hbs', mapper: mapEnterpriseData },
        { name: 'cooperative', template: 'cooperative.hbs', mapper: mapCooperativeData },
        { name: 'ctd', template: 'ctd.hbs', mapper: mapCtdData },
        { name: 'ong', template: 'ong.hbs', mapper: mapOngData },
        { name: 'administration', template: 'administration.hbs', mapper: mapAdministrationData },
        { name: 'projectProgram', template: 'projectProgram.hbs', mapper: mapProjectProgramData },
        { name: 'vocationalTraining', template: 'vocationalTraining.hbs', mapper: mapVocationalTrainingData },
    ];

    entities.forEach(({ name, template, mapper }) => {
        describe(`Entity: ${name}`, () => {
            const templateHtml = fs.readFileSync(
                path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', template),
                'utf-8'
            );
            const compiled = Handlebars.compile(templateHtml);

            it(`renders purely in English when lang="en" (excluding bilingual letterhead)`, () => {
                const data = mapper(mockFormData, '2026-Q1', 'en');
                const html = compiled(data);

                // Strip out the letterhead partial for non-VT or letterhead table for VT
                let nonLetterheadHtml = html;
                const letterheadEnd = html.indexOf('class="hdr-bar"');
                if (letterheadEnd !== -1) {
                    nonLetterheadHtml = html.slice(letterheadEnd);
                } else {
                    const vtHeaderEnd = html.indexOf('class="title-box"');
                    if (vtHeaderEnd !== -1) {
                        nonLetterheadHtml = html.slice(vtHeaderEnd);
                    }
                }

                // Check that no raw translation keys like {{t "..."}} remain unrendered
                expect(nonLetterheadHtml).not.toMatch(/common\.[a-zA-Z0-9_]+/);
                expect(nonLetterheadHtml).not.toMatch(new RegExp(`${name}\\.[a-zA-Z0-9_]+`));

                // Check that bilingual slash patterns like "Sexe/ Sex" or "Cadres / Managers" are gone
                expect(nonLetterheadHtml).not.toContain('Sexe/ <em>Sex</em>');
                expect(nonLetterheadHtml).not.toContain('Masculin/ <em>Male</em>');
                expect(nonLetterheadHtml).not.toContain('Féminin/ <em>Female</em>');
                expect(nonLetterheadHtml).not.toContain('Cadres / Managers');
                expect(nonLetterheadHtml).not.toContain('Permanent/ <em>Permanent</em>');
                expect(nonLetterheadHtml).not.toContain('Temporaire/ <em>Temporary</em>');
                expect(nonLetterheadHtml).not.toContain('1.Urbain/ <em>Urban</em>');
                expect(nonLetterheadHtml).not.toContain('1. Urbain/ <em>Urban</em>');

                // For non-VT entities using Handlebars i18n directly, ensure English content is present and French labels absent
                if (name !== 'vocationalTraining') {
                    expect(nonLetterheadHtml).toContain('Sex');
                    expect(nonLetterheadHtml).toContain('Male');
                    expect(nonLetterheadHtml).toContain('Female');
                    expect(nonLetterheadHtml).not.toContain('>Sexe<');
                    expect(nonLetterheadHtml).not.toContain('>Masculin<');
                    expect(nonLetterheadHtml).not.toContain('>Féminin<');
                }
            });

            it(`renders purely in French when lang="fr" (excluding bilingual letterhead)`, () => {
                const data = mapper(mockFormData, '2026-Q1', 'fr');
                const html = compiled(data);

                let nonLetterheadHtml = html;
                const letterheadEnd = html.indexOf('class="hdr-bar"');
                if (letterheadEnd !== -1) {
                    nonLetterheadHtml = html.slice(letterheadEnd);
                } else {
                    const vtHeaderEnd = html.indexOf('class="title-box"');
                    if (vtHeaderEnd !== -1) {
                        nonLetterheadHtml = html.slice(vtHeaderEnd);
                    }
                }

                // Check that no raw translation keys remain unrendered
                expect(nonLetterheadHtml).not.toMatch(/common\.[a-zA-Z0-9_]+/);
                expect(nonLetterheadHtml).not.toMatch(new RegExp(`${name}\\.[a-zA-Z0-9_]+`));

                // Check that bilingual slash patterns are gone
                expect(nonLetterheadHtml).not.toContain('Sexe/ <em>Sex</em>');
                expect(nonLetterheadHtml).not.toContain('Masculin/ <em>Male</em>');
                expect(nonLetterheadHtml).not.toContain('Féminin/ <em>Female</em>');
                expect(nonLetterheadHtml).not.toContain('Cadres / Managers');
                expect(nonLetterheadHtml).not.toContain('Permanent/ <em>Permanent</em>');
                expect(nonLetterheadHtml).not.toContain('Temporaire/ <em>Temporary</em>');

                // For non-VT entities, ensure French content is present and English labels absent
                if (name !== 'vocationalTraining') {
                    expect(nonLetterheadHtml).toContain('Sexe');
                    expect(nonLetterheadHtml).toContain('Masculin');
                    expect(nonLetterheadHtml).toContain('Féminin');
                    expect(nonLetterheadHtml).not.toContain('>Sex<');
                    expect(nonLetterheadHtml).not.toContain('>Male<');
                    expect(nonLetterheadHtml).not.toContain('>Female<');
                }
            });
        });
    });
});
