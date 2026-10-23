import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w17-02: MyRecords card captions use --text-secondary, not --text-muted', () => {
  const src = read('components/MyRecords.tsx');
  for (const key of ['myRecordsTotalHarvested', 'myRecordsNoDesigns']) {
    const i = src.indexOf(`t('${key}')`);
    assert.ok(i > 0, key);
    const before = src.slice(Math.max(0, i - 220), i);
    assert.ok(!before.includes("color: 'var(--text-muted)'"), `${key} still muted`);
    assert.ok(before.includes("color: 'var(--text-secondary)'"), `${key} not secondary`);
  }
});

test('w17-03: network sort chip text uses forest-800 (>=4.5:1 on its tint in every column)', () => {
  const src = read('app/network/page.tsx');
  assert.ok(src.includes("sort === key ? 'var(--color-forest-800)' : INK_MUTED"));
  assert.ok(!src.includes("sort === key ? 'var(--emerald)'"));
});

test('w17-05: /samples/production print + source links get a 44px hit area', () => {
  const src = read('app/samples/production/page.tsx');
  const hit = "before:-inset-y-[13px]";
  assert.match(src, /<a href="#print" className="[^"]*before:-inset-y-\[13px\]/);
  assert.match(src, /href=\{source\.url\} target="_blank" rel="noreferrer" className="[^"]*before:-inset-y-\[13px\]/);
  assert.ok(hit);
});

// w17-07: an input/textarea/select that kills the browser outline must carry a focus-visible ring.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const CODEX = [/^components\/crop/, /^app\/facilitator\/crops\//, /^app\/cropplan\//];
// owned by another track, wave 17: not in this track's file list, so reported rather than fixed here.
const ALLOW = new Set([
  'components/SiteSurveySheet.tsx',
  'components/design/DesignCanvas.tsx',
  'app/community/profile/page.tsx',
  'app/community/page.tsx',
  'app/community/messages/[threadId]/page.tsx',
  'app/community/u/[uid]/page.tsx',
  'app/contact/page.tsx',
]);

function tagsOf(src: string): string[] {
  const tags: string[] = [];
  const re = /<(input|textarea|select)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    tags.push(src.slice(m.index, i + 1));
  }
  return tags;
}

test('w17-07: outline:none on form fields always pairs with a focus-visible ring', () => {
  const offenders: string[] = [];
  const allowed: string[] = [];
  for (const file of [...walk('components'), ...walk('app')]) {
    if (CODEX.some(r => r.test(file))) continue;
    const src = read(file);
    if (!/outline:\s*(?:'none'|0\b)/.test(src)) continue;
    const shared = [...src.matchAll(/const (\w+)(?::[^=]+)?= \{[^}]*outline:\s*(?:'none'|0\b)[^}]*\}/g)].map(m => m[1]);
    for (const tag of tagsOf(src)) {
      const bare = /outline:\s*(?:'none'|0\b)/.test(tag) || shared.some(n => new RegExp(`\\.\\.\\.${n}\\b|style=\\{${n}\\}`).test(tag));
      if (bare && !/focus-visible:ring/.test(tag)) (ALLOW.has(file) ? allowed : offenders).push(`${file}: ${tag.slice(0, 60)}`);
    }
  }
  assert.deepEqual(offenders, []);
  assert.ok(allowed.length > 0, 'allow-list is stale: remove files that are now fixed');
});

test('w17-07: the six named inputs carry the ring', () => {
  for (const f of ['components/EvidenceSheet.tsx', 'components/ProfileSheet.tsx', 'components/SiteManageMenu.tsx', 'components/exchange/ExchangeBoard.tsx', 'components/exchange/NewListingForm.tsx', 'components/journal/JournalEntrySheet.tsx']) {
    assert.match(read(f), /focus-visible:ring-2 focus-visible:ring-\[var\(--gold\)\] focus-visible:ring-offset-1/, f);
  }
});
