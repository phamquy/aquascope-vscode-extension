#!/usr/bin/env node
// Usage: npm run task -- new "Title" [--feature 001-slug] [--priority medium]
//        npm run task -- set T-001 doing
//        npm run task -- list
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'vault', 'tasks');
const STATUSES = ['todo', 'doing', 'review', 'done'];
const [cmd, ...rest] = process.argv.slice(2);
const flag = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d; };
const files = () => readdirSync(dir).filter((f) => /^T-\d+/.test(f));

if (cmd === 'new') {
  const title = rest[0];
  if (!title) { console.error('title required'); process.exit(1); }
  const next = Math.max(0, ...files().map((f) => +f.match(/^T-(\d+)/)[1])) + 1;
  const id = `T-${String(next).padStart(3, '0')}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const feature = flag('feature', '');
  const body = `---\nid: ${id}\ntitle: "${title}"\nstatus: todo\npriority: ${flag('priority', 'medium')}\nfeature: "${feature}"\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n# ${id} ${title}\n\n${feature ? `Spec: [[specs/features/${feature}/spec.md]]\n\n` : ''}## Done when\n\n- [ ] \n\n## Notes\n`;
  writeFileSync(join(dir, `${id}-${slug}.md`), body);
  console.log(`${id}-${slug}.md`);
} else if (cmd === 'set') {
  const [id, status] = rest;
  if (!STATUSES.includes(status)) { console.error(`status must be one of ${STATUSES}`); process.exit(1); }
  const f = files().find((x) => x.startsWith(id));
  if (!f) { console.error(`no task ${id}`); process.exit(1); }
  const p = join(dir, f);
  writeFileSync(p, readFileSync(p, 'utf8').replace(/^status: .*/m, `status: ${status}`));
  console.log(`${id} -> ${status}`);
} else if (cmd === 'list') {
  for (const f of files()) {
    const s = readFileSync(join(dir, f), 'utf8').match(/^status: (.*)/m)?.[1];
    console.log(`${s?.padEnd(7)} ${f}`);
  }
} else {
  console.error('commands: new | set | list'); process.exit(1);
}
