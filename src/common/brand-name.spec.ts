import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// The platform is CAMLEAP (docs/standards/brand.md). The registration e-mails
// and the official PDF footer said "CAM-LEAP" until 2026-10-17 (§21); this
// keeps the old spelling out of what respondents receive.
describe('respondent-facing output names CAMLEAP, never CAM-LEAP', () => {
    const root = join(__dirname, '..');
    const templates = readdirSync(join(root, 'pdf', 'templates', 'dynamic'))
        .filter((f) => f.endsWith('.hbs'))
        .map((f) => join('pdf', 'templates', 'dynamic', f));
    const files = [
        join('dsmo', 'notification.service.ts'),
        join('pdf', 'onefop-puppeteer.service.ts'),
        join('services', 'pdf-data-mapper.service.ts'),
        ...templates,
    ];

    it.each(files)('%s', (file) => {
        const code = readFileSync(join(root, file), 'utf-8')
            .split('\n')
            .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
            .join('\n');
        expect(code).not.toContain('CAM-LEAP');
    });

    it('finds the PDF templates it checks', () => {
        expect(templates.length).toBeGreaterThanOrEqual(7);
    });
});
