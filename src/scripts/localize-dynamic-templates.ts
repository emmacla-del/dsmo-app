import * as fs from 'fs';
import * as path from 'path';

const dynamicDir = path.join(__dirname, '..', 'pdf', 'templates', 'dynamic');

function cleanTemplate(html: string): string {
    html = html.replace(
        /<th class="g">Tranche d&#8217;&#226;ge \(ans\)\/\s*<br \/>\s*<em>Age group \(years\)<\/em>\s*<\/th>/g,
        '<th class="g">{{t "common.table.age_group"}}</th>'
    );

    html = html.replace(
        /<th class="g">35 et \+\s*<br \/>\s*<em>35 and<br \/>\s*above<\/em>\s*<\/th>/g,
        '<th class="g">{{t "common.table.age_35_plus"}}</th>'
    );

    return html;
}

const templates = ['enterprise.hbs', 'cooperative.hbs', 'ctd.hbs', 'ong.hbs', 'administration.hbs', 'projectProgram.hbs'];

for (const tpl of templates) {
    const filePath = path.join(dynamicDir, tpl);
    let content = fs.readFileSync(filePath, 'utf-8');
    content = cleanTemplate(content);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Cleaned ${tpl}`);
}

console.log('Done!');
