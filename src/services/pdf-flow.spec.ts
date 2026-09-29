import { normalizeFlatKeys } from '../common/normalizers/flat-key-normalizer';
import {
  mapEnterpriseData,
  mapCooperativeData,
  mapCtdData,
  mapOngData,
  mapAdministrationData,
  mapProjectProgramData,
  mapVocationalTrainingData,
} from './pdf-data-mapper.service';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

describe('PDF Flow end-to-end data and template test', () => {
  beforeAll(() => {
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('neq', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('or', (a: any, b: any) => a || b);
    Handlebars.registerHelper('and', (a: any, b: any) => a && b);
    Handlebars.registerHelper('add', (a: any, b: any) => (a ?? 0) + (b ?? 0));
    Handlebars.registerHelper('inc', (index: any) => (typeof index === 'number' ? index + 1 : index));
    Handlebars.registerHelper('includes', (arr: any, value: any) => Array.isArray(arr) && arr.includes(value));
    Handlebars.registerHelper('t', (key: any) => key);
    Handlebars.registerHelper('yesno', (value: any) => {
      const isYes = value === true;
      const isNo = value === false;
      return new Handlebars.SafeString(
        `<span class="yesno"><span class="circle${isYes ? ' checked' : ''}"></span>Oui</span>`
      );
    });
    Handlebars.registerHelper('checkbox', (checked: any) => {
      return new Handlebars.SafeString(`<span class="checkbox${checked ? ' checked' : ''}"></span>`);
    });
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

    // Register partials
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

  it('checks CTD data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'Maire Paul',
      S0Q02: 'Maire',
      S0Q03_TEL1: '677112233',
      CTD_S1Q01: 'Commune/ Council',
      CTD_S1Q01_NAME: 'Commune de Yaoundé 1',
      CTD_S1Q02: 'Commune d’Arrondissement',
      CTD_S1Q03: '1987',
      CTD_S1Q04: 'Urbain/ Urban',
      CTD_S1Q05_REGION: 'Centre',
      CTD_S1Q05_DEPT: 'Mfoundi',
      CTD_S1Q05_SUBDIV: 'Yaoundé 1',
      CTD_S1Q05_LOCALITY: 'Nlongkak',
      CTD_S1Q06_TEL1: '222111333',
      CTD_S1Q06_BP: '100',
      CTD_S1Q07: 'Tertiaire',
      CTD_S1Q08: 'Administration publique',
      CTD_S1Q09: '120',
      CTD_S1Q10: '10',
      // S3 & S4 text inputs
      S3Q02_REASON_1_TEXT: 'Fin de contrat',
      s3q02_reason_1_male: 5,
      S4Q02_DOMAIN_1_TEXT: 'Gestion de projet',
      s4q02_skill_1_male: 3,
      S4Q03_DOMAIN_1_TEXT: 'Informatique',
      s4q03_domain_1_male: 4,
    };

    const normalized = normalizeFlatKeys(rawData, 'ctd');
    const mapped = mapCtdData(normalized, '2026-T1');

    expect(mapped.ctdName).toBe('Commune de Yaoundé 1');
    expect(mapped.respondentName).toBe('Maire Paul');
    expect(mapped.dismissalReasons[0].text).toBe('Fin de contrat');
    expect(mapped.skills[0].description).toBe('Gestion de projet');
    expect(mapped.trainingNeeds[0].domain).toBe('Informatique');

    // Compile and render ctd.hbs template
    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'ctd.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('Commune de Yaoundé 1');
    expect(html).toContain('Fin de contrat');
    expect(html).toContain('Gestion de projet');
    expect(html).toContain('Informatique');
    expect(html).toContain('<span class="pd">6</span><span class="pd">7</span><span class="pd">7</span>');
    expect(html).not.toContain('<<br />');
    expect(html).not.toContain('<<td');
    expect(html).not.toContain('<<span');
  });

  it('checks Enterprise data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'Jean Dupont',
      S0Q02: 'Directeur',
      S0Q03_TEL1: '+237 671234567',
      S1Q01: 'SARL',
      S1Q02: 'Acme Corp',
      S1Q05_TEL1: '699887766',
      S3Q02_REASON_1_TEXT: 'Restructuration économique',
      S4Q02_DOMAIN_1_TEXT: 'Comptabilité approfondie',
      S4Q03_DOMAIN_1_TEXT: 'Marketing digital',
    };

    const normalized = normalizeFlatKeys(rawData, 'enterprise');
    const mapped = mapEnterpriseData(normalized, '2026-T1');

    expect(mapped.companyName).toBe('Acme Corp');
    expect(mapped.dismissalReasons[0].text).toBe('Restructuration économique');
    expect(mapped.skills[0].description).toBe('Comptabilité approfondie');
    expect(mapped.trainingNeeds[0].domain).toBe('Marketing digital');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'enterprise.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('Acme Corp');
    expect(html).toContain('Restructuration économique');
    expect(html).toContain('Comptabilité approfondie');
    expect(html).toContain('Marketing digital');
    // Verify phone digit boxes were filled directly on server
    expect(html).toContain('<span class="pd">6</span><span class="pd">7</span><span class="pd">1</span>');
  });

  it('checks Cooperative data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'President Jean',
      COOP_S1Q01: 'COOPAGRO',
      COOP_S1Q06_TEL1: '677112233',
      S3Q02_REASON_1_TEXT: 'Départ volontaire',
      S4Q02_DOMAIN_1_TEXT: 'Agronomie',
      S4Q03_DOMAIN_1_TEXT: 'Gestion coopérative',
    };

    const normalized = normalizeFlatKeys(rawData, 'cooperative');
    const mapped = mapCooperativeData(normalized, '2026-T1');

    expect(mapped.cooperativeName).toBe('COOPAGRO');
    expect(mapped.dismissalReasons[0].text).toBe('Départ volontaire');
    expect(mapped.skills[0].description).toBe('Agronomie');
    expect(mapped.trainingNeeds[0].domain).toBe('Gestion coopérative');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'cooperative.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('COOPAGRO');
    expect(html).toContain('Départ volontaire');
    expect(html).toContain('Agronomie');
    expect(html).toContain('Gestion coopérative');
    expect(html).not.toContain('<<br />');
  });

  it('checks ONG data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'Directrice Marie',
      ONG_S1Q01: 'ONG Espoir',
      ONG_S1Q06_TEL1: '699445566',
      S3Q02_REASON_1_TEXT: 'Fin de financement projet',
      S4Q02_DOMAIN_1_TEXT: 'Action humanitaire',
      S4Q03_DOMAIN_1_TEXT: 'Suivi-évaluation',
    };

    const normalized = normalizeFlatKeys(rawData, 'ong');
    const mapped = mapOngData(normalized, '2026-T1');

    expect(mapped.ongName).toBe('ONG Espoir');
    expect(mapped.dismissalReasons[0].text).toBe('Fin de financement projet');
    expect(mapped.skills[0].description).toBe('Action humanitaire');
    expect(mapped.trainingNeeds[0].domain).toBe('Suivi-évaluation');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'ong.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('ONG Espoir');
    expect(html).toContain('Fin de financement projet');
    expect(html).toContain('Action humanitaire');
    expect(html).toContain('Suivi-évaluation');
    expect(html).not.toContain('<<br />');
    expect(html).not.toContain('<<td');
    expect(html).not.toContain('<<span');
  });

  it('checks Administration data flow and template rendering', () => {
    const rawData = {
      S0Q01: 'Secrétaire Général',
      ADMIN_S1Q01: 'MINEFOP',
      ADMIN_S1Q05_TEL1: '222230000',
      S3Q02_REASON_1_TEXT: 'Mutation de service',
      S4Q02_DOMAIN_1_TEXT: 'Management public',
    };

    const normalized = normalizeFlatKeys(rawData, 'administration');
    const mapped = mapAdministrationData(normalized, '2026-T1');

    expect(mapped.administrationName).toBe('MINEFOP');
    expect(mapped.dismissalReasons[0].text).toBe('Mutation de service');
    expect(mapped.skills[0].description).toBe('Management public');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'administration.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('MINEFOP');
    expect(html).toContain('Mutation de service');
    expect(html).toContain('Management public');
    expect(html).not.toContain('<<br />');
    expect(html).not.toContain('<<span');
  });

  it('checks Vocational Training data flow and template rendering', () => {
    const rawData = {
      VT1_15_NAME: 'Directeur VT',
      VT1_15_TITLE: 'Directeur Général',
      VT1_15_TEL1: '670001122',
      VT1_2: 'CFP Excellence',
      VT1_3: 'CFPE',
      VT1_16_NAME: 'Promoteur Pierre',
    };

    const normalized = normalizeFlatKeys(rawData, 'vocationalTraining');
    const mapped = mapVocationalTrainingData(normalized, '2026-T1');

    expect(mapped.identification.nomCFP).toBe('CFP Excellence');
    expect(mapped.identification.respondent.nomPrenoms).toBe('Directeur VT');
    expect(mapped.identification.respondent.qualite).toBe('Directeur Général');
    expect(mapped.identification.respondent.telephone1).toBe('670001122');
    expect(mapped.identification.promoteur.nomPrenoms).toBe('Promoteur Pierre');

    const tplPath = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic', 'vocationalTraining.hbs');
    const template = Handlebars.compile(fs.readFileSync(tplPath, 'utf-8'));
    const html = template(mapped);

    expect(html).toContain('CFP Excellence');
    expect(html).toContain('Directeur VT');
    expect(html).toContain('Promoteur Pierre');
  });
});
