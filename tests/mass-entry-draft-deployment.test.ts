import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMassEntryReviewData } from '../lib/international/locales/mass-entry-review-server.ts';

// The published page returned HTTP 200 and the right build SHA but no source or
// drafts: its looped readFileSync paths were absent from the traced function.
// This exercises installed Next's include semantics and actual runtime reader,
// not a full build, NFT module trace, Vercel deployment or browser verification.
const repository = fileURLToPath(new URL('../', import.meta.url));
const actualConfig = (await import(new URL('../next.config.mjs', import.meta.url).href)).default as TraceConfig;
interface TraceConfig {
  experimental?: {
    outputFileTracingIncludes?: Record<string, string[]>;
    outputFileTracingExcludes?: Record<string, string[]>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
const require = createRequire(import.meta.url);
// These are the implementations called by Next 14 collect-build-traces, rather
// than an independent glob or route matcher that could pass while tracing fails.
const glob = require('next/dist/compiled/glob') as (pattern: string,
  options: { cwd: string; nodir: true; dot: true }, callback: (error: Error | null, files: string[]) => void) => void;
const picomatch = require('next/dist/compiled/picomatch') as (pattern: string | string[],
  options: { dot: true; contains: true }) => (path: string) => boolean;
const { normalizeAppPath } = require('next/dist/shared/lib/router/utils/app-paths') as { normalizeAppPath: (path: string) => string };
const { configSchema } = require('next/dist/server/config-schema') as {
  configSchema: { safeParse: (value: unknown) => { success: boolean; error?: { message: string } } };
};
const packetRoot = 'lib/international/locales/mass-entry-drafts';
// The worksheet now also compares Hindi, Bengali and Indonesian packets. Keep
// all eight original assets and those three exact public JSON files. Wording
// now lives in a shared presenter: trace that twelfth named asset as well,
// retaining the original component as actual delegation/context evidence.
const expected = [`${packetRoot}/source.json`, `${packetRoot}/fr.json`, `${packetRoot}/es.json`,
  `${packetRoot}/pt-BR.json`, `${packetRoot}/sw.json`, `${packetRoot}/hi.json`, `${packetRoot}/bn.json`,
  `${packetRoot}/id.json`, 'components/crops/GrowerEnteredMassField.ts',
  'components/crops/GrowerCycleIntent.ts', 'lib/international/grower-cycle-intent.ts', 'lib/release-notes.ts'].sort();
const component = 'components/crops/GrowerCycleIntent.ts';
const presenter = 'lib/international/grower-cycle-intent.ts';
const changedKey = 'massEntry.readback.planningEstimate';
const changedEnglish = 'This is the grower-entered planning estimate, not this batch’s output or an observed harvest. Repeated whole-demand request weights must not be added together.';
const expectedState = (key: string) => key === changedKey ? 'stale' : 'draft';
const entryName = 'app/international/locales/mass-entry/page';
const route = normalizeAppPath(entryName);
const scan = (pattern: string) => new Promise<string[]>((done, fail) => {
  glob(pattern, { cwd: repository, nodir: true, dot: true }, (error, files) => error ? fail(error) : done(files));
});

async function includedFiles(config: TraceConfig, normalizedRoute = route): Promise<string[]> {
  const includes = new Set<string>(), excludes = new Set<string>();
  for (const [key, patterns] of Object.entries(config.experimental?.outputFileTracingIncludes ?? {})) {
    if (picomatch(key, { dot: true, contains: true })(normalizedRoute)) {
      for (const pattern of patterns) includes.add(pattern.replace(/\\/g, '/'));
    }
  }
  for (const [key, patterns] of Object.entries(config.experimental?.outputFileTracingExcludes ?? {})) {
    if (picomatch(key, { dot: true, contains: true })(normalizedRoute)) {
      for (const pattern of patterns) excludes.add(pattern);
    }
  }
  const files = new Set((await Promise.all([...includes].map(scan))).flat());
  if (excludes.size) {
    const excluded = picomatch([...excludes].map(pattern => join(repository, pattern)), { dot: true, contains: true });
    for (const file of files) if (excluded(join(repository, file))) files.delete(file);
  }
  return [...files].map(file => relative(repository, resolve(repository, file)).split(sep).join('/')).sort();
}
function inventory(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? inventory(join(directory, entry.name), name) : [name];
  }).sort();
}
async function withBundle(config: TraceConfig, run: (directory: string, files: string[]) => void, omitted?: string) {
  const files = (await includedFiles(config)).filter(file => file !== omitted);
  const directory = mkdtempSync(join(tmpdir(), 'imbewu-mass-review-assets-'));
  try {
    for (const file of files) {
      assert.equal(isAbsolute(file), false); assert.notEqual(file, '..'); assert.equal(file.startsWith('../'), false);
      // An exact allowlist catches accidentally broad includes before copying
      // unrelated app, farmer, credential or private research files to the bundle.
      assert.ok(expected.includes(file), `Unexpected mass-review asset: ${file}`);
      const target = join(directory, file); mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(repository, file), target);
    }
    assert.deepEqual(inventory(directory), files);
    run(directory, files);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
function loadFromBundle(directory: string) {
  const previous = process.cwd();
  try {
    process.chdir(directory);
    // The reader is synchronous: never yield while another operation could
    // observe this process-wide temporary cwd, and restore it even on failure.
    return loadMassEntryReviewData();
  } finally { process.chdir(previous); }
}

test('actual Next 14 config accepts a narrowly traced mass-review data/source bundle that the real loader can read', async () => {
  const parsed = configSchema.safeParse(actualConfig);
  assert.equal(parsed.success, true, parsed.error?.message);
  assert.ok(actualConfig.experimental?.outputFileTracingIncludes,
    'looped source and packet paths need the installed framework’s experimental include slot');
  await withBundle(actualConfig, (directory, files) => {
    assert.deepEqual(files, expected, 'the worksheet needs the frozen packet, seven inactive language packets and four actual source/context files');
    const data = loadFromBundle(directory);
    assert.equal(data.issue, null); assert.deepEqual(data.languages.map(language => language.locale), ['fr', 'es', 'pt-BR', 'sw', 'hi', 'bn', 'id']);
    assert.equal(data.languages.flatMap(language => language.rows).length, 84);
    for (const language of data.languages) {
      assert.equal(language.rows.length, 12);
      for (const row of language.rows) {
        assert.equal(row.state, expectedState(row.key), `${language.locale}: ${row.key}`);
        assert.equal(row.currentEnglish, row.key === changedKey ? changedEnglish : row.frozenEnglish, row.key);
        assert.ok(row.translation?.trim(), row.key);
      }
    }
    assert.equal(data.sources.every(source => source.currentSha256 !== null), true);
  });
});

test('removing actual tracing includes reproduces missing runtime English and packets instead of falling back to the frozen source', async () => {
  const withoutIncludes: TraceConfig = { ...actualConfig,
    experimental: { ...actualConfig.experimental, outputFileTracingIncludes: {} } };
  await withBundle(withoutIncludes, (directory, files) => {
    assert.deepEqual(files, []);
    const data = loadFromBundle(directory);
    assert.ok(data.issue); assert.deepEqual(data.languages, []);
    assert.equal(data.sources.every(source => source.status === 'unavailable' && source.currentSha256 === null), true);
  });
});

for (const missing of expected) test(`an omitted traced ${missing} remains visibly unknown rather than borrowing a frozen/runtime dictionary`, async () => {
  await withBundle(actualConfig, (directory, files) => {
    assert.equal(files.includes(missing), false);
    const data = loadFromBundle(directory);
    if (missing === `${packetRoot}/source.json`) {
      assert.ok(data.issue); assert.deepEqual(data.languages, []); return;
    }
    assert.equal(data.issue, null);
    const sourceFile = ['components/crops/GrowerEnteredMassField.ts', component, presenter, 'lib/release-notes.ts'].includes(missing);
    if (sourceFile) {
      assert.equal(data.sources.find(source => source.path === missing)?.status, 'unavailable');
      let held = 0;
      for (const row of data.languages.flatMap(language => language.rows)) {
        if (row.sourceFile === missing || missing === component && row.sourceFile === presenter) {
          held++; assert.equal(row.currentEnglish, null); assert.equal(row.state, 'source-missing'); assert.ok(row.issues.length);
        } else assert.equal(row.state, expectedState(row.key));
      }
      assert.ok(held > 0);
    } else {
      const locale = missing.slice(packetRoot.length + 1, -'.json'.length);
      const unavailable = data.languages.find(language => language.locale === locale);
      assert.ok(unavailable, 'a missing packet must remain a visible comparison, including the three additional languages');
      assert.equal(unavailable.rows.length, 12);
      for (const language of data.languages) for (const row of language.rows) {
        assert.equal(row.state, language.locale === locale ? 'invalid' : expectedState(row.key));
        if (language.locale === locale) { assert.equal(row.translation, null); assert.ok(row.issues.length); }
      }
    }
  }, missing);
});

// Next applies contains:true to route globs. This covers actual unrelated
// application routes, not an invented guarantee about hypothetical suffix URLs.
for (const otherEntry of ['app/international/locales/nursery-field-planting/page', 'app/facilitator/crops/page']) {
  test(`mass-review assets are not additionally bundled for unrelated ${otherEntry}`, async () => {
    assert.deepEqual(await includedFiles(actualConfig, normalizeAppPath(otherEntry)), []);
  });
}
