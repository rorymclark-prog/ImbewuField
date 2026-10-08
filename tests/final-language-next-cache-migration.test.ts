// Reading14 adds a guarded independent still; its complete-manifest guard now rejects
// these same corrupt header, unlisted entry and post-initialization drift probes first.
// The newer 15-card layer checks the full manifest before dated reconstruction;
// the same corrupt-header/unlisted-entry cases must fail at that earlier guard.
// The complete fairness file guard now catches these mutations first; retain
// the prior guard names for historical callers and all mutation assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, readdirSync, copyFileSync, symlinkSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { finalLanguageNextMediaProof, validateFinalLanguageNextMedia, verifyFinalLanguageNextAsset } from './final-language-next-media-history-checks.ts';

test('36 final regional stills refresh once including queries without audio/film fetch or later-download loss', async () => {
  const source = readFileSync('app/sw.js/route.ts', 'utf8');
  const body = source.match(/async function migrateFinalLanguageNextStills\(\) \{([\s\S]*?)\n\}/)![1];
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  assert.equal([...activation.matchAll(/\.then\(migrateFinalLanguageNextStills\)/g)].length, 1);
  assert.ok(activation.indexOf('migrateFinalLanguageNextStills') > activation.indexOf('migrateNativePairedResidualStills'));
  assert.ok(activation.indexOf('self.clients.claim()') > activation.indexOf('migrateFinalLanguageNextStills'));
  const changed: string[] = finalLanguageNextMediaProof.frames.map((frame: any) => frame.url);
  assert.equal(new Set(changed).size, 36);
  const origin = 'https://field.test';
  const preserve = Object.keys(COURSE_ASSET_SIZES).filter(url => !changed.includes(url));
  const entries = new Map([...changed.flatMap(url => [url, url + '?old=1', url + '?size=small']), ...preserve, changed[0] + '.bak'].map(url => [new URL(url, origin).href, new Response(url)]));
  let fetches = 0, writes = 0;
  const cache = { match: async (key: string) => entries.get(new URL(key, origin).href), keys: async () => [...entries.keys()].map(url => new Request(url)), delete: async (request: Request) => entries.delete(request.url), put: async (key: string, response: Response) => { writes++; entries.set(new URL(key, origin).href, response); } };
  const run = new (Object.getPrototypeOf(async function () {}).constructor)('caches', 'COURSE_CACHE', 'URL', 'Response', 'fetch', body);
  const args = [{ open: async () => cache }, 'course', URL, Response, () => { fetches++; throw new Error('migration must never fetch'); }];
  await run(...args);
  for (const url of changed) for (const suffix of ['', '?old=1', '?size=small']) assert.equal(entries.has(new URL(url + suffix, origin).href), false);
  for (const url of preserve) assert.equal(entries.has(new URL(url, origin).href), true, url);
  assert.equal(entries.has(new URL(changed[0] + '.bak', origin).href), true);
  entries.set(new URL(changed[0] + '?download=new', origin).href, new Response('new'));
  await run(...args);
  assert.equal(entries.has(new URL(changed[0] + '?download=new', origin).href), true);
  assert.equal(fetches, 0); assert.equal(writes, 1);
});

test('current 36-frame media guard rejects whole-manifest and same-size byte corruption before historical descriptors', () => {
  validateFinalLanguageNextMedia();
  const manifest = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  // The aggregate changes with the later 69-card release; corrupt today's
  // actual generated header so this mutation can still fail for the right reason.
  const header = manifest.match(/^\/\/ \d+ files, [\d.]+ MB total\.$/m)![0];
  const corrupt = manifest.replace(header, header.replace(/[\d.]+ MB/, '9999.9 MB'));
  assert.notEqual(corrupt, manifest);
  assert.throws(() => validateFinalLanguageNextMedia(corrupt), /complete current final-language manifest|complete manifest after only 15 measured changes|complete current manifest after only the ten measured card changes|entire current file matches the reviewed fairness layer|supplied complete Reading14 manifest|entire Reading14 release manifest/);
  assert.throws(() => validateFinalLanguageNextMedia(manifest + "  '/unlisted.webp': 1,\n"), /complete current final-language manifest|complete manifest after only 15 measured changes|complete current manifest after only the ten measured card changes|entire current file matches the reviewed fairness layer|supplied complete Reading14 manifest|entire Reading14 release manifest/);
  const frame = finalLanguageNextMediaProof.frames[0];
  const bytes = readFileSync(frame.path); const altered = Buffer.from(bytes); altered[altered.length - 1] ^= 1;
  assert.equal(altered.length, bytes.length);
  assert.throws(() => verifyFinalLanguageNextAsset(frame.path, altered), /exact current SHA/);
  const unlisted = '/course-decks/intro-permaculture/st/slide-22.webp';
  const old = readFileSync('public' + unlisted); const bad = Buffer.from(old); bad[bad.length - 1] ^= 1;
  assert.throws(() => verifyFinalLanguageNextAsset('public' + unlisted, bad), /exact current SHA/);
});

// Mutate isolated copies, never shared farmer-facing assets during parallel tests.
test('initialized historical descriptors still reject requested same-size corruption and live manifest drift', () => {
  const fixture=mkdtempSync(join(tmpdir(),'imbewu-final-descriptor-mutation-'));
  const root=process.cwd();
  function mirror(source:string,target:string,parts:string[]) {
    mkdirSync(target,{recursive:true});
    for(const name of readdirSync(source)) {
      const from=join(source,name),to=join(target,name);
      if(name===parts[0]) { if(parts.length===1)copyFileSync(from,to);else mirror(from,to,parts.slice(1)); }
      else symlinkSync(from,to,statSync(from).isDirectory()?'dir':'file');
    }
  }
  try {
    symlinkSync(join(root,'app'),join(fixture,'app'),'dir');
    symlinkSync(join(root,'docs'),join(fixture,'docs'),'dir');
    mirror(join(root,'lib'),join(fixture,'lib'),['course-asset-sizes.ts']);
    mirror(join(root,'public'),join(fixture,'public'),['course-images','vegetables-staples','vegetables-staples-l1.jpg']);
    const helper=pathToFileURL(join(root,'tests/native-paired-residual-media-history-checks.ts')).href;
    execFileSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';
      import {readFileSync,writeFileSync} from 'node:fs';
      import {nativePairedResidualMediaBefore} from ${JSON.stringify(helper)};
      const path='public/course-images/vegetables-staples/vegetables-staples-l1.jpg';
      nativePairedResidualMediaBefore(path);
      const original=readFileSync(path);const corrupt=Buffer.from(original);corrupt[corrupt.length-1]^=1;
      writeFileSync(path,corrupt);
      assert.throws(()=>nativePairedResidualMediaBefore(path),error=>error instanceof Error && error.message.includes(path) && /requested current asset SHA|exact current SHA/.test(error.message));
      writeFileSync(path,original);nativePairedResidualMediaBefore(path);
      const manifest='lib/course-asset-sizes.ts',before=readFileSync(manifest,'utf8');
      writeFileSync(manifest,before+'\\n// unlisted corruption');
      // The latest full-file VE frost proof can reject this live unlisted drift before older manifest layers run.
      assert.throws(()=>nativePairedResidualMediaBefore(path),error=>error instanceof Error && (
        error.message.includes('lib/course-asset-sizes.ts: complete current file after VE frost placement')
        || error.message.includes('lib/course-asset-sizes.ts: complete current source, draft and unlisted bytes')
        || error.message.includes('complete live generated asset-size manifest digest')
        || /only the accepted VE Reading frost placement batch may be projected|complete current final-language manifest|complete manifest after only 15 measured changes|complete current manifest after only the ten measured card changes|entire current file matches the reviewed fairness layer|supplied complete Reading14 manifest|entire Reading14 release manifest/.test(error.message)
      ));
      writeFileSync(manifest,before);nativePairedResidualMediaBefore(path);
    `],{cwd:fixture,stdio:'pipe'});
  } finally {rmSync(fixture,{recursive:true,force:true});}
});
