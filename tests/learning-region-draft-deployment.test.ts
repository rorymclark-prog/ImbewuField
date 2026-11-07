import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLearningRegionReviewData } from '../lib/international/locales/learning-region-review-server.ts';

// The mass worksheet previously deployed without its looped runtime files. The
// learning worksheet must carry its own exact evidence bundle for the same reader
// pattern. This checks installed Next's include semantics and the actual loader;
// it is not a full NFT trace, production build or deployed-page verification.
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
// Match the implementations and options in Next 14 collect-build-traces so a
// different glob or route matcher cannot make a broken include declaration pass.
const glob = require('next/dist/compiled/glob') as (pattern: string,
  options: { cwd: string; nodir: true; dot: true }, callback: (error: Error | null, files: string[]) => void) => void;
const picomatch = require('next/dist/compiled/picomatch') as (pattern: string | string[],
  options: { dot: true; contains: true }) => (path: string) => boolean;
const { normalizeAppPath } = require('next/dist/shared/lib/router/utils/app-paths') as { normalizeAppPath: (path: string) => string };
const { configSchema } = require('next/dist/server/config-schema') as {
  configSchema: { safeParse: (value: unknown) => { success: boolean; error?: { message: string } } };
};
const packetRoot = 'lib/international/locales/learning-region-drafts';
const locales = ['fr', 'es', 'pt-BR', 'sw', 'hi', 'bn', 'id', 'de', 'it', 'nl', 'pl'];
const component = 'components/studies/LearningRegionNotice.tsx';
const expected = [`${packetRoot}/source.json`, ...locales.map(locale => `${packetRoot}/${locale}.json`), component].sort();
const fixedKeys = ['learningRegionUi014', 'learningRegionUi021'];
const expectedState = (key: string) => fixedKeys.includes(key) ? 'fixed-literal' : 'draft';
const routeKey = '/international/locales/learning-region';
const route = normalizeAppPath('app/international/locales/learning-region/page');
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
  const directory = mkdtempSync(join(tmpdir(), 'imbewu-learning-review-assets-'));
  try {
    for (const file of files) {
      assert.equal(isAbsolute(file), false); assert.notEqual(file, '..'); assert.equal(file.startsWith('../'), false);
      // Refuse unrelated app, account, credential or private research files before
      // copying anything outside the worksheet's exact public evidence allowlist.
      assert.ok(expected.includes(file), `Unexpected learning-review asset: ${file}`);
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
    // No yield is allowed while this synchronous reader uses the process-wide
    // cwd. Restore it on success and on failure before any other test can run.
    return loadLearningRegionReviewData();
  } finally { process.chdir(previous); }
}

test('installed Next 14 traces only the learning worksheet evidence and its real loader keeps every draft unapproved', async () => {
  const parsed = configSchema.safeParse(actualConfig);
  assert.equal(parsed.success, true, parsed.error?.message);
  assert.deepEqual(actualConfig.experimental?.outputFileTracingIncludes?.[routeKey]?.slice().sort(),
    expected.map(file => `./${file}`).sort(), 'name all thirteen public assets explicitly; a broad glob is not a review-data contract');
  await withBundle(actualConfig, (directory, files) => {
    assert.deepEqual(files, expected);
    const data = loadFromBundle(directory);
    assert.equal(data.issue, null); assert.equal(data.source.status, 'matched');
    assert.equal(data.source.currentSha256, data.source.capturedSha256);
    assert.equal(data.sourceCommit, null); assert.deepEqual(data.languages.map(language => language.locale), locales);
    assert.equal(data.languages.flatMap(language => language.rows).length, 308);
    const frozen = JSON.parse(readFileSync(join(directory, packetRoot, 'source.json'), 'utf8'));
    assert.equal(frozen.sourceCommit, null);
    for (const language of data.languages) {
      const packet = JSON.parse(readFileSync(join(directory, packetRoot, `${language.locale}.json`), 'utf8'));
      assert.equal(packet.sourceCommit, null); assert.equal(packet.runtimeActivation, false);
      assert.equal(packet.humanReview, false); assert.equal(packet.reviewStatus, 'unreviewed-ai-draft');
      assert.equal(language.packetStatus, 'valid'); assert.equal(language.issue, null);
      assert.equal(language.rows.length, 28);
      assert.equal(language.rows.filter(row => row.state === 'draft' && row.kind === 'ai-draft').length, 26);
      assert.equal(language.rows.filter(row => row.state === 'fixed-literal' && row.kind === 'fixed-literal').length, 2);
      for (let index = 0; index < language.rows.length; index++) {
        const { kind, state, currentEnglish, translation, issues, ...metadata } = language.rows[index];
        assert.deepEqual(metadata, frozen.messages[index]);
        assert.equal(state, expectedState(metadata.key)); assert.equal(currentEnglish, metadata.english);
        assert.equal(metadata.bindings[0].sourceCommit, null); assert.ok(translation?.trim()); assert.deepEqual(issues, []);
        if (kind === 'fixed-literal') assert.equal(translation, metadata.english);
      }
    }
  });
});

test('removing learning tracing includes holds the worksheet instead of treating the frozen snapshot as current English', async () => {
  const includes = { ...actualConfig.experimental?.outputFileTracingIncludes };
  delete includes[routeKey];
  const withoutIncludes: TraceConfig = { ...actualConfig,
    experimental: { ...actualConfig.experimental, outputFileTracingIncludes: includes } };
  await withBundle(withoutIncludes, (directory, files) => {
    assert.deepEqual(files, []);
    const data = loadFromBundle(directory);
    assert.ok(data.issue); assert.deepEqual(data.languages, []);
    assert.equal(data.source.status, 'invalid'); assert.equal(data.source.currentSha256, null);
    assert.equal(data.sourceCommit, null);
  });
});

for (const missing of expected) test(`omitting traced ${missing} withdraws only the evidence it can establish`, async () => {
  await withBundle(actualConfig, (directory, files) => {
    assert.equal(files.length, 12); assert.equal(files.includes(missing), false);
    const data = loadFromBundle(directory);
    assert.equal(data.sourceCommit, null);
    if (missing === `${packetRoot}/source.json`) {
      assert.ok(data.issue); assert.deepEqual(data.languages, []);
      assert.equal(data.source.status, 'invalid');
      assert.equal(data.source.currentSha256, data.source.capturedSha256); return;
    }
    assert.equal(data.issue, null); assert.equal(data.languages.length, 11);
    assert.equal(data.languages.flatMap(language => language.rows).length, 308);
    if (missing === component) {
      assert.equal(data.source.status, 'unavailable'); assert.equal(data.source.currentSha256, null);
      for (const language of data.languages) {
        assert.equal(language.packetStatus, 'valid'); assert.equal(language.issue, null);
        for (const row of language.rows) {
          assert.equal(row.currentEnglish, null); assert.equal(row.state, 'source-missing');
          assert.ok(row.translation?.trim()); assert.ok(row.issues.length);
        }
      }
    } else {
      assert.equal(data.source.status, 'matched');
      const locale = missing.slice(packetRoot.length + 1, -'.json'.length);
      assert.ok(data.languages.some(language => language.locale === locale), 'the absent locale remains visible');
      for (const language of data.languages) {
        assert.equal(language.rows.length, 28);
        assert.equal(language.packetStatus, language.locale === locale ? 'missing' : 'valid');
        if (language.locale === locale) assert.ok(language.issue); else assert.equal(language.issue, null);
        for (const row of language.rows) {
          assert.equal(row.currentEnglish, row.english);
          assert.equal(row.state, language.locale === locale ? 'missing' : expectedState(row.key));
          if (language.locale === locale) { assert.equal(row.translation, null); assert.ok(row.issues.length); }
          else { assert.ok(row.translation?.trim()); assert.deepEqual(row.issues, []); }
        }
      }
    }
  }, missing);
});

// Next uses contains:true for route globs. Check actual unrelated routes rather
// than inventing stricter matching for hypothetical suffix URLs.
for (const otherEntry of ['app/international/locales/nursery-field-planting/page', 'app/facilitator/crops/page']) {
  test(`learning-review assets are not additionally bundled for unrelated ${otherEntry}`, async () => {
    assert.deepEqual(await includedFiles(actualConfig, normalizeAppPath(otherEntry)), []);
  });
}
