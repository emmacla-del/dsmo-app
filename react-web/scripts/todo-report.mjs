// scripts/todo-report.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = 'src';
const PATTERN = /\/\/\s*TODO\((backend|design)(?:\s*,\s*([SML]))?\):\s*(.+)/g;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield path;
  }
}

const todos = [];
for await (const file of walk(ROOT)) {
  const content = await readFile(file, 'utf8');
  content.split('\n').forEach((line, i) => {
    PATTERN.lastIndex = 0;
    let m;
    while ((m = PATTERN.exec(line)) !== null) {
      todos.push({
        type: m[1],
        size: m[2] || '—',
        text: m[3].trim(),
        file: relative('.', file),
        line: i + 1,
      });
    }
  });
}

const backend = todos.filter(t => t.type === 'backend');
const design  = todos.filter(t => t.type === 'design');

const render = (title, items) =>
  items.length === 0
    ? `## ${title}\n\n_None._\n`
    : `## ${title}\n\n| Size | Task | Location |\n|---|---|---|\n` +
      items.map(t => `| ${t.size} | ${t.text} | \`${t.file}:${t.line}\` |`).join('\n') + '\n';

const out = `# Pending work — auto-generated

> Generated from \`// TODO(backend, S|M|L)\` and \`// TODO(design)\` comments in \`src/\`.
> **Do not edit by hand.** Run \`npm run todo:report\` to regenerate.

Total: **${todos.length}** — ${backend.length} backend, ${design.length} design

${render('Backend', backend)}
${render('Design', design)}
`;

await writeFile('docs/pending-work.md', out);
console.log(`Wrote docs/pending-work.md — ${todos.length} items.`);
