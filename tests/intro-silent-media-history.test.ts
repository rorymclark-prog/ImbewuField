import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, readdirSync, copyFileSync, symlinkSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { silentIntroIntegration, validateSilentIntroMedia, silentIntroAssetSizesBefore, silentIntroMediaBefore, verifySilentIntroAsset, verifySilentIntroFrame } from './intro-silent-media-history-checks.ts';
import { reading14Files, reading14ManifestBefore } from './reading-comparisons-media-history-checks.ts';
import { lightestManifestBefore, lightestManifestProof } from './reading-title-lightest-media-history-checks.ts';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('the silent Introduction release validates25 measured assets and1902 unlisted assets before the exact post967 manifest rewind',()=>{
  validateSilentIntroMedia();
  assert.equal(sha(silentIntroAssetSizesBefore()),'60064c611c8140cd6b20875a8f673a933b9007f523a46460933d866b493d3571');
  const prior=silentIntroIntegration.actualAssets.filter((f:any)=>f.beforeBytes!==null);
  assert.equal(prior.length,3);
  for(const f of prior) assert.deepEqual(silentIntroMediaBefore(f.path),{bytes:f.beforeBytes,sha256:f.beforeSHA256});
});
test('extra or unlisted manifest entries and wrong measured aggregate cannot expose any dated silent-release media',()=>{
  const actual=readFileSync('lib/course-asset-sizes.ts','utf8');
  // 6 October: the later36 measured frames change the live aggregate; corrupt its current header.
  const currentHeader=actual.match(/^\/\/ \d+ files, [\d.]+ MB total\.$/m)?.[0];
  assert.ok(currentHeader);
  for(const mutated of [actual.replace('});',"  '/unlisted-extra.webp': 1,\n});"),actual.replace(currentHeader,'// Incorrect aggregate'),actual.replace("'/course-decks/intro-permaculture/st/slide-22.webp':", "'/renamed-old-st.webp':")]){
    assert.notEqual(mutated,actual);assert.throws(()=>silentIntroAssetSizesBefore(mutated));
  }
});
test('the newest four-card manifest rewinds exactly to main837 before older16-row histories and rejects caller drift',()=>{
  const live=readFileSync('lib/course-asset-sizes.ts','utf8');
  const predecessor=lightestManifestBefore(live);
  // PR985 became main after the original A snapshot. The exact A predecessor is
  // therefore its complete post-PR985/main837 manifest, not the older base29 file.
  const frozenHead=readFileSync('docs/study-translation-reviews/reading-title-lightest-next-2026-10-08/main-985-composition/before-main837/course-asset-sizes.ts.txt','utf8');
  assert.equal(predecessor,frozenHead,'the newest media layer exposes the exact complete main837 manifest');
  const originalBase29=readFileSync(lightestManifestProof.beforeSnapshot);
  assert.equal(createHash('sha256').update(originalBase29).digest('hex'),lightestManifestProof.beforeSha256,
    'the original immutable base29 proof snapshot remains intact after main integration');
  const beforeEntries=Object.fromEntries([...predecessor.matchAll(/^  '([^']+)': (\d+),$/gm)].map(m=>[m[1],Number(m[2])]));
  const afterEntries=Object.fromEntries([...live.matchAll(/^  '([^']+)': (\d+),$/gm)].map(m=>[m[1],Number(m[2])]));
  const olderRows=[
    ['/course-decks/intro-permaculture/ve/slide-14.webp',478238],
    ['/course-decks/reading-landscape/st/slide-07.webp',285908],
    ['/course-decks/reading-landscape/st/slide-15.webp',411414],
    ['/course-decks/reading-landscape/ts/slide-07.webp',288102],
    ['/course-decks/reading-landscape/ts/slide-15.webp',414510],
    ['/course-decks/reading-landscape/ve/slide-07.webp',297942],
    ['/course-decks/reading-landscape/ve/slide-14.webp',473972],
    ['/course-decks/reading-landscape/ve/slide-15.webp',422634],
    ['/course-decks/vegetables-staples/st/slide-06.webp',619468],
    ['/course-decks/vegetables-staples/ts/slide-06.webp',616970],
    ['/course-decks/vegetables-staples/ts/slide-11.webp',417894],
    ['/course-decks/vegetables-staples/ve/slide-04.webp',725656],
    ['/course-decks/vegetables-staples/ve/slide-06.webp',602216],
    ['/course-decks/vegetables-staples/ve/slide-11.webp',405364],
  ] as const;
  for(const [url,bytes] of olderRows){
    assert.equal(beforeEntries[url],bytes,`${url}: dated preexisting source-owned byte count is retained`);
    assert.equal(afterEntries[url],bytes,`${url}: this four-card batch leaves the older still untouched`);
  }
  assert.equal(beforeEntries['/course-decks/reading-landscape/ts/slide-12.webp'],473304,'TS12 exact previous bytes');
  assert.equal(beforeEntries['/course-decks/reading-landscape/ve/slide-12.webp'],471730,'VE12 exact previous bytes');
  assert.equal(afterEntries['/course-decks/reading-landscape/ts/slide-12.webp'],473120,'only the newly rendered TS12 size changes');
  assert.equal(afterEntries['/course-decks/reading-landscape/ve/slide-12.webp'],476936,'only the newly rendered VE12 size changes');
  const oldReading14=reading14Files['lib/course-asset-sizes.ts'];
  assert.equal(reading14ManifestBefore(predecessor),oldReading14.before,
    'all intervening complete layers are verified before preserving the original Reading14 assertion');
  const altered=predecessor.replace("'/course-decks/intro-permaculture/ve/slide-14.webp': 478238", "'/course-decks/intro-permaculture/ve/slide-14.webp': 478239");
  assert.notEqual(altered,predecessor);
  assert.throws(()=>reading14ManifestBefore(altered),/supplied complete Reading14 manifest/,
    'an arbitrary caller-changed historical manifest cannot use the new bridge');
  assert.throws(()=>lightestManifestBefore(live.replace("'/course-decks/intro-permaculture/ve/slide-14.webp': 478238", "'/course-decks/intro-permaculture/ve/slide-14.webp': 478239")),
    'current whole-manifest drift is rejected before predecessor exposure');
});
test('same-size new-frame corruption and dimension changes fail before historical descriptors, without editing protected assets',()=>{
  const frame=silentIntroIntegration.actualAssets[0];const bytes=readFileSync(frame.path);
  const corrupted=Buffer.from(bytes);corrupted[corrupted.length-1]^=1;
  assert.throws(()=>verifySilentIntroFrame(frame,corrupted));
  assert.throws(()=>verifySilentIntroFrame({...frame,height:frame.height-1},bytes));
  const old='/course-decks/intro-permaculture/st/slide-22.webp';const archive=readFileSync('public'+old);const bad=Buffer.from(archive);bad[bad.length-1]^=1;
  assert.throws(()=>verifySilentIntroAsset(old,bad),'unlisted archive corruption must also fail');
});

// 6 October 2026: a previously initialized historical view must not hide later disk drift.
// Use a real copied unlisted asset in an isolated child workspace so parallel test files
// never observe a deliberately corrupted public asset in the shared checkout.
test('same-size unlisted disk mutation after initialization withdraws the entire historical view',()=>{
  const fixture=mkdtempSync(join(tmpdir(),'imbewu-silent-media-mutation-'));
  const originalRoot=process.cwd();
  function mirror(source:string,target:string,parts:string[]) {
    mkdirSync(target,{recursive:true});
    for(const name of readdirSync(source)) {
      const from=join(source,name),to=join(target,name);
      if(name===parts[0]) {
        if(parts.length===1) copyFileSync(from,to);
        else mirror(from,to,parts.slice(1));
      } else symlinkSync(from,to,statSync(from).isDirectory()?'dir':'file');
    }
  }
  try {
    // The newest immutable media batch also binds the service-worker source;
    // link it into this isolated disk-mutation fixture so the full proof can run.
    for(const name of ['app','docs','lib']) symlinkSync(join(originalRoot,name),join(fixture,name),'dir');
    mirror(join(originalRoot,'public'),join(fixture,'public'),['course-images','vegetables-staples','vegetables-staples-l1.jpg']);
    const helper=pathToFileURL(join(originalRoot,'tests/intro-silent-media-history-checks.ts')).href;
    execFileSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';
      import {readFileSync,writeFileSync} from 'node:fs';
      import {validateSilentIntroMedia} from ${JSON.stringify(helper)};
      validateSilentIntroMedia();
      const path='public/course-images/vegetables-staples/vegetables-staples-l1.jpg';
      const original=readFileSync(path);const corrupt=Buffer.from(original);corrupt[corrupt.length-1]^=1;
      writeFileSync(path,corrupt);
      // The later full-inventory guard can reject first. Both routes must name
      // this actual same-size corrupted asset, not an unrelated setup failure.
      assert.throws(()=>validateSilentIntroMedia(),error=>
        error instanceof Error && error.message.includes(path) &&
        /entire current inventory SHA|exact current inventory hash|all current inventory hashes/.test(error.message));
      writeFileSync(path,original);validateSilentIntroMedia();
    `],{cwd:fixture,stdio:'pipe'});
  } finally {rmSync(fixture,{recursive:true,force:true});}
});
