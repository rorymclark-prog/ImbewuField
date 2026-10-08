import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import {
  stIntroRuntimeResidualManifestBefore,
  stIntroRuntimeResidualSourceBefore,
} from './st-intro-runtime-residual-history-checks.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';

const folder = 'docs/study-translation-reviews/core-ordinary-expanded-next-2026-10-07/';
const load = (name: string) => JSON.parse(readFileSync(folder + name, 'utf8'));
const proof = load('exact-text-proof.json');
const plan = load('ordinary-expanded-next-effective-decisions.json');
const native = load('native-proof.json');
const assets = load('render-proof.json');
const hash = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

test('only the independently reviewed six fields and three source-identical deck copies change ordinary text', () => {
  const expected: Record<string, string> = {};
  for (const [file, row] of Object.entries(proof.files) as [string, any][]) {
    assert.equal(hash(row.before), row.beforeSha256);
    assert.equal(hash(row.after), row.afterSha256);
    // The 8 October silent-edition refresh supersedes the dated worker and manifest.
    // Verify its entire authorized layer before retaining this earlier complete-file claim.
    const current = readFileSync(file);
    const afterExpandedLayer = file === 'lib/course-asset-sizes.ts'
      ? stIntroRuntimeResidualManifestBefore(current.toString())
      : stIntroRuntimeResidualSourceBefore(file, current);
    assert.equal(Buffer.from(afterExpandedLayer).toString(), row.after, file + ': complete changed and unlisted bytes after exact newer-layer projection');
    if (file.includes('paired-draft') || file.startsWith('lib/course-translation')) expected[file] = row.before;
  }
  const accepted = plan.rows.filter((r: any) => r.effectiveDecision === 'accept');
  assert.equal(accepted.length, 6);
  for (const r of accepted) {
    const file = r.binding.file;
    if (file.endsWith('.json')) {
      const doc = JSON.parse(expected[file]);
      const slide = doc.slides.find((s: any) => s.n === r.binding.slide);
      const cell = r.binding.field.includes('heading') ? slide.target.heading : slide.target.body[1];
      const index = r.binding.field.includes('heading') ? 1 : 3;
      assert.equal(cell.segments[index].sourceEnglish, r.sourceSegment);
      assert.equal(cell.segments[index].status, 'english-hold');
      cell.segments[index] = { ...cell.segments[index], status: 'draft', text: r.proposedSegment };
      expected[file] = JSON.stringify(doc);
    } else {
      assert.equal(expected[file].split(r.currentTarget).length, 2, r.id + ': exact existing paragraph occurs once');
      expected[file] = expected[file].replace(r.currentTarget, r.proposedComposedTarget);
    }
  }
  for (const lang of ['ve', 'ts']) {
    const file = `docs/narration/vegetables-staples.${lang}.paired-draft.json`;
    const doc = JSON.parse(expected[file]);
    const slide = doc.slides.find((s: any) => s.n === 11);
    const row = accepted.find((r: any) => r.id === `VS-${lang.toUpperCase()}-L2-WATER-LIMITS`);
    assert.equal(slide.english.body[1], row.sourceEnglish);
    assert.equal(slide.target.body[1].text, row.currentTarget);
    slide.target.body[1].text = row.proposedComposedTarget;
    expected[file] = JSON.stringify(doc);
  }
  const reuse = proof.additional_source_identical_reuse;
  const matching = JSON.parse(expected[reuse.file]);
  const match = matching.slides.find((r: any) => r.n === reuse.slide);
  assert.equal(match.english.body[reuse.body], reuse.source);
  assert.equal(match.target.body[reuse.body].text, reuse.beforeTarget);
  match.target.body[reuse.body].text = reuse.afterTarget;
  expected[reuse.file] = JSON.stringify(matching);
  for (const [file, value] of Object.entries(expected)) {
    if (file.endsWith('.json')) assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), JSON.parse(value), file + ': all source cells, safety tails and unrelated drafts stay exact');
    else assert.equal(readFileSync(file, 'utf8'), value, file + ': no additional learner edits');
  }
});

test('resolver-used native modules preserve every source, quiz index and non-target field; changed source falls back', () => {
  for (const [lang, module] of Object.entries({ ve, ts })) {
    assert.deepEqual(module, native.after[lang]);
    const result: any = structuredClone(module);
    for (const row of plan.rows.filter((r: any) => r.effectiveDecision === 'accept' && r.binding.file.startsWith('lib/') && r.language.includes(`(${lang})`))) {
      let count = 0;
      const walk = (obj: any) => { for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string' && obj[key].includes(row.proposedComposedTarget)) { obj[key] = obj[key].replace(row.proposedComposedTarget, row.currentTarget); count++; }
        else if (obj[key] && typeof obj[key] === 'object') walk(obj[key]);
      } };
      walk(result); assert.equal(count, 1, row.id);
    }
    assert.deepEqual(result, native.before[lang], lang + ': every non-target source and assessment survives');
    const source = COURSE_MODULES.find(m => m.id === 'vegetables-staples')!.lessons.find(l => l.id === 'vegetables-staples-l2')!;
    const live = resolveLearnerLessonPresentation(source, lang as 've' | 'ts');
    // The resolver exposes 'draft'; 'machine-draft' is the source-pair review status.
    assert.equal(live.status, 'draft');
    assert.ok(live.content.body.includes(lang === 've' ? 'musi maḓi a tshi fhungudza' : 'loko mati ma hunguta'));
    const changed = resolveLearnerLessonPresentation({ ...source, body: source.body + ' Changed source.' }, lang as 've' | 'ts');
    assert.equal(changed.status, 'english-fallback');
    assert.equal(changed.content.body, source.body + ' Changed source.');
  }
});

test('only four measured stills change size and all published bytes match the rendered proof', () => {
  const old = proof.files['lib/course-asset-sizes.ts'].before;
  let expected = old;
  assert.equal(assets.length, 4);
  for (const row of assets) {
    const bytes = readFileSync('public' + row.url);
    assert.equal(bytes.byteLength, row.afterBytes);
    assert.equal(hash(bytes), row.afterSha256);
    assert.equal(COURSE_ASSET_SIZES[row.url], bytes.byteLength);
    expected = expected.replace(`'${row.url}': ${row.beforeBytes},`, `'${row.url}': ${row.afterBytes},`);
  }
  // Ten newer silent-edition measurements must pass their complete manifest guard
  // before the four-card predecessor assertion can inspect the earlier layer.
  assert.equal(stIntroRuntimeResidualManifestBefore(readFileSync('lib/course-asset-sizes.ts', 'utf8')), expected);
});

const changedStills = ['/course-decks/vegetables-staples/ve/slide-04.webp', '/course-decks/intro-permaculture/ve/slide-14.webp', '/course-decks/vegetables-staples/ve/slide-11.webp', '/course-decks/vegetables-staples/ts/slide-11.webp'].sort();

test('the selective worker migration expires exactly four old still paths once and preserves other saved media', async () => {
  const source = readFileSync('app/sw.js/route.ts', 'utf8');
  const name = 'migrateCoreOrdinaryExpandedNextStills';
  const body = source.match(/async function migrateCoreOrdinaryExpandedNextStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const chain = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  assert.equal(chain.filter(value => value === name).length, 1);
  assert.ok(chain.indexOf(name) > chain.indexOf('migrateCoreOrdinaryCompletionNextStills'));
  assert.ok(activation.indexOf('self.clients.claim()') > activation.indexOf(name));
  assert.doesNotMatch(body, /\bfetch\s*\(/);
  const listed = [...body.matchAll(/\/course-decks\/[\w/-]+\.webp/g)].map(match => match[0]).sort();
  assert.deepEqual(listed, changedStills, 'only the four measured corrected cards are retired');

  const origin = 'https://study.test';
  const stale = changedStills.flatMap(path => [path, `${path}?width=390`, `${path}?saved=old`]);
  const preserved = [
    '/course-audio/reading-landscape/st/slide-07.mp3?saved=1',
    '/course-audio/vegetables-staples/ts/slide-06.mp3?saved=1',
    '/course-animations/reading-landscape/flow.mp4?saved=1',
    '/course-decks/reading-landscape/en/slide-07.jpg?saved=1',
    '/course-decks/reading-landscape/ve/slide-13.webp?saved=1',
    '/course-decks/vegetables-staples/st/slide-07.webp?saved=1',
  ];
  const entries = new Map([...stale, ...preserved].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletes = 0, writes = 0, fetches = 0;
  const cache = {
    match: async (key: string) => entries.get(new URL(key, origin).href),
    keys: async () => [...entries.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletes++; return entries.delete(request.url); },
    put: async (key: string, response: Response) => { writes++; entries.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'fetch', `return (async () => {${body}})()`);
  const invoke = () => run({ open: async (key: string) => { assert.equal(key, 'imbewufield-course-v1'); return cache; } }, 'imbewufield-course-v1', Response, () => { fetches++; throw new Error('the migration must not fetch'); });
  await invoke();
  for (const path of stale) assert.equal(entries.has(new URL(path, origin).href), false, `${path}: obsolete still and query forms removed`);
  for (const path of preserved) assert.equal(entries.has(new URL(path, origin).href), true, `${path}: audio, animation, other stills remain`);
  const marker = '/course-decks/.core-ordinary-expanded-next-20261007';
  assert.equal(await entries.get(new URL(marker, origin).href)?.text(), 'Refreshed four source-paired ordinary Study cards');
  assert.equal(deletes, stale.length);
  assert.equal(writes, 1);
  assert.equal(fetches, 0);

  const later = changedStills.map(path => [new URL(`${path}?saved=new`, origin).href, `new pack ${path}`] as const);
  for (const [url, value] of later) entries.set(url, new Response(value));
  await invoke();
  for (const [url, value] of later) assert.equal(await entries.get(url)!.text(), value, `${url}: later saved data is preserved`);
  assert.equal(deletes, stale.length, 'the marker prevents a second purge');
  assert.equal(writes, 1);
  assert.equal(fetches, 0);
});
